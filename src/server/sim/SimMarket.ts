// 模擬玩家（24 §5，第 143 輪）：讓單機的拍賣所「感覺像線上」。
// - 不用常駐計時器：玩家打開拍賣所（market.browse／mine）時，依經過的時間補跑每個模擬玩家的行動。
// - 模擬玩家只透過和真人一樣的公開 handler 上架、購買、賣行商、領回過期掛單（GameServer.run，同一份驗證與交易）。
//   唯一的內部動作是 simStep「刷到」裝備（真人是打怪），見 handlers.ts。
// - 線上版：GameServerOptions.sim 不開就完全沒有模擬玩家（或保留當填充機器人）。
import { BAG_MAX } from '../../core/meta/bag';
import { SHOP_GOODS, buyPrice } from '../../core/meta/shop';
import { isGear, type RtGear } from '../../core/battle/rt/gear';
import { ApiError, type Method } from '../../net/protocol';
import type { CharacterView, ListingView } from '../../net/views';
import type { Clock } from '../clock';
import type { AnyHandler, GameServer } from '../GameServer';
import { HANDLERS } from '../handlers';
import type { Ctx } from '../router';
import { SIM_BACKLOG, SIM_MAX_LISTINGS, simState, simStep, type SimDecision, type SimState } from './handlers';
import { simRoster, type SimPlayer } from './roster';

export interface SimOptions {
  /** 模擬玩家人數（預設 30） */
  players?: number;
  /** 一次補跑最多幾個行動（避免打開拍賣所卡太久） */
  maxActions?: number;
  /** 兩次補跑之間至少隔多久（毫秒） */
  throttleMs?: number;
}

export interface SimStats {
  actions: number;
  listed: number;
  bought: number;
  /** 其中買走真人的掛單 */
  boughtFromPlayers: number;
  soldToShop: number;
  reclaimed: number;
  /** 花在行商材料上的金幣（回收） */
  spentAtShop: number;
  /** 被規則拒絕的動作（錢不夠、行囊滿、掛單上限…），正常會有一些 */
  rejected: number;
}

const BROWSE_PAGES = 3;
/** 金幣超過這個數，整理行囊時就去行商買材料花掉 */
export const SIM_COIN_CAP = 2500;
const SIM_SPEND_MAX = 25;

export class SimMarket {
  readonly roster: SimPlayer[];
  readonly stats: SimStats = { actions: 0, listed: 0, bought: 0, boughtFromPlayers: 0, soldToShop: 0, reclaimed: 0, spentAtShop: 0, rejected: 0 };
  private states = new Map<string, SimState>();
  private expired = new Set<string>();
  private busy?: Promise<void>;
  private lastRun = -Infinity;
  private readonly maxActions: number;
  private readonly throttleMs: number;

  constructor(
    private readonly server: GameServer,
    private readonly clock: Clock,
    o: SimOptions,
  ) {
    this.roster = simRoster(o.players);
    this.maxActions = o.maxActions ?? 24;
    this.throttleMs = o.throttleMs ?? 60_000;
  }

  /** 補跑到現在（同時只跑一份；throttle 內再叫直接回）。錯誤不往外丟：拍賣所照常能開 */
  catchUp(force = false): Promise<void> {
    if (this.busy) return this.busy;
    const now = this.clock.now();
    if (!force && now - this.lastRun < this.throttleMs) return Promise.resolve();
    this.lastRun = now;
    this.busy = this.runAll(now)
      .catch(() => undefined)
      .finally(() => {
        this.busy = undefined;
      });
    return this.busy;
  }

  private internal<T>(sim: SimPlayer, method: string, fn: (ctx: Ctx) => Promise<T>): Promise<T> {
    return this.server.run(sim.accountId, method, undefined, undefined, (ctx) => fn(ctx)).then((j) => JSON.parse(j) as T);
  }

  /** 走公開 handler（和真人一樣）；被規則拒絕回 undefined */
  private async call<T>(sim: SimPlayer, method: Method, params: unknown, requestId?: string): Promise<T | undefined> {
    try {
      return JSON.parse(await this.server.run(sim.accountId, method, params, requestId, HANDLERS[method] as AnyHandler)) as T;
    } catch (e) {
      if (e instanceof ApiError && e.code !== 'internal') {
        this.stats.rejected++;
        return undefined;
      }
      throw e;
    }
  }

  private async runAll(now: number): Promise<void> {
    for (const sim of this.roster) if (!this.states.has(sim.accountId)) this.states.set(sim.accountId, await this.internal(sim, 'sim.state', (ctx) => simState(ctx, sim)));
    // 誰到期了：每人最多補 SIM_BACKLOG 次，依時間先後排，一次最多 maxActions 個
    const due: { sim: SimPlayer; at: number }[] = [];
    for (const sim of this.roster) {
      const st = this.states.get(sim.accountId)!;
      let at = Math.max(st.last, now - SIM_BACKLOG * sim.intervalMs) + sim.intervalMs;
      for (let k = 0; k < SIM_BACKLOG && at <= now; k++, at += sim.intervalMs) due.push({ sim, at });
    }
    due.sort((a, b) => a.at - b.at || (a.sim.accountId < b.sim.accountId ? -1 : 1));
    for (const { sim } of due.slice(0, this.maxActions)) await this.act(sim);
  }

  private async act(sim: SimPlayer): Promise<void> {
    const n = this.states.get(sim.accountId)!.n;
    const { state, decision } = await this.internal(sim, 'sim.step', (ctx) => simStep(ctx, sim, n));
    this.states.set(sim.accountId, state);
    if (decision.kind === 'wait') return;
    this.stats.actions++;
    await this.carryOut(sim, state.characterId, n, decision);
  }

  private async carryOut(sim: SimPlayer, characterId: string, n: number, d: SimDecision): Promise<void> {
    const rid = (what: string) => `sim:${n}:${what}`;
    if (d.kind === 'list') {
      const mine = await this.call<{ listings: ListingView[] }>(sim, 'market.mine', { characterId }, rid('mine'));
      if ((mine?.listings.filter((l) => l.status === 'open').length ?? 0) >= SIM_MAX_LISTINGS) return;
      if (await this.call(sim, 'market.list', { characterId, itemId: d.itemId, price: d.price }, rid('list'))) this.stats.listed++;
      return;
    }
    if (d.kind === 'shop') {
      for (let page = 0; page < BROWSE_PAGES; page++) {
        const res = await this.call<{ listings: ListingView[] }>(sim, 'market.browse', { page });
        if (!res?.listings.length) return;
        const deal = res.listings.find((l) => !l.mine && isGear(l.gear) && l.price <= d.coin && l.price <= buyPrice(l.gear as unknown as RtGear) * d.factor);
        if (deal) {
          if (await this.call(sim, 'market.buy', { characterId, listingId: deal.id }, rid('buy'))) {
            this.stats.bought++;
            if (!this.isSimName(deal.sellerName)) this.stats.boughtFromPlayers++;
          }
          return;
        }
      }
      return;
    }
    if (d.kind !== 'tidy') return;
    // tidy：領回過期的掛單，行囊裡多的賣給行商
    const mine = await this.call<{ listings: ListingView[]; character: CharacterView }>(sim, 'market.mine', { characterId }, rid('mine'));
    if (!mine) return;
    for (const l of mine.listings) if (l.status === 'expired') this.expired.add(l.id);
    this.stats.reclaimed = this.expired.size;
    const bag = mine.character.items.filter((i) => i.location === 'bag').sort((a, b) => a.pos - b.pos);
    const extra = bag.slice(Math.min(d.keep, BAG_MAX));
    let coin = mine.character.wallet.coin;
    if (extra.length) {
      const sold = await this.call<{ character: CharacterView }>(sim, 'shop.sell', { characterId, itemIds: extra.map((i) => i.id) }, rid('sell'));
      if (sold) {
        this.stats.soldToShop += extra.length;
        coin = sold.character.wallet.coin;
      }
    }
    // 錢太多就去行商買強化材料（和真人一樣的金幣回收），模擬玩家的購買力才不會一直漲
    const goods = SHOP_GOODS.find((g) => g.id === 'dust')!;
    for (let k = 0; k < SIM_SPEND_MAX && coin - goods.price >= SIM_COIN_CAP; k++) {
      if (!(await this.call(sim, 'shop.buyGoods', { characterId, goodsId: goods.id }, rid(`goods${k}`)))) break;
      coin -= goods.price;
      this.stats.spentAtShop += goods.price;
    }
  }

  private isSimName(name: string): boolean {
    return this.roster.some((s) => s.name === name);
  }
}
