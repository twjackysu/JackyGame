// 模擬玩家（24 §5，第 143 輪）：讓單機的拍賣所「感覺像線上」。
// - 不用常駐計時器：玩家打開拍賣所（market.browse／mine）時，依經過的時間補跑每個模擬玩家的行動。
// - 模擬玩家只透過和真人一樣的公開 handler 上架、購買、賣行商、領回過期掛單（GameServer.run，同一份驗證與交易）。
//   唯一的內部動作是 simStep「刷到」裝備（真人是打怪），見 handlers.ts。
// - 線上版：GameServerOptions.sim 不開就完全沒有模擬玩家（或保留當填充機器人）。
import { BAG_MAX } from '../../core/meta/bag';
import { SHOP_GOODS, buyPrice } from '../../core/meta/shop';
import { isGear, type RtGear } from '../../core/battle/rt/gear';
import { ApiError, type Method } from '../../net/protocol';
import type { CharacterView, ListingView, TradeView } from '../../net/views';
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

  /** 這個帳號是不是模擬玩家 */
  simOf(accountId: string): SimPlayer | undefined {
    return this.roster.find((s) => s.accountId === accountId);
  }

  /** 模擬玩家面對面賣出的開價：行商買價 ×（0.45～0.85，越會殺價開越低；跟它在拍賣所的定價同一個區間，不含隨機） */
  askFor(sim: SimPlayer, g: RtGear): number {
    return Math.max(1, Math.round(buyPrice(g) * (0.45 + 0.4 * (1 - sim.thrift))));
  }

  /** 模擬玩家願意出的收購價：行商買價 ×（0.35～0.80，越會殺價越低） */
  bidFor(sim: SimPlayer, gears: readonly Record<string, unknown>[]): number {
    const f = 0.35 + 0.45 * (1 - sim.thrift);
    return gears.reduce((sum, g) => sum + (isGear(g) ? Math.max(1, Math.floor(buyPrice(g as unknown as RtGear) * f)) : 0), 0);
  }

  /**
   * 面對面交易的對象是模擬玩家（F3 單機版，第 144 輪）：真人每做一個動作，模擬玩家就照「收購」的規則回應一步，
   * 一樣只走公開的 trade.* handler：對方放了物品 → 出價（上限是自己的金幣）；對方鎖定 → 跟著鎖；對方確認 → 跟著確認。
   * 對方只放金幣（第 146 輪）→ 反過來「賣」：放上開價買得起的最貴一件（askFor）。
   * 回傳有沒有動作（有的話 GameServer 會把真人的回應換成最新的交易狀態）。
   */
  async respondTrade(sim: SimPlayer, characterId: string, tradeId: string): Promise<boolean> {
    const v = await this.call<{ trade: TradeView; character: CharacterView }>(sim, 'trade.get', { characterId, tradeId });
    if (!v || v.trade.status !== 'open') return false;
    const t = v.trade;
    // 對方只放金幣、沒放物品＝想跟我買（第 146 輪）：挑「開價買得起」的最貴一件放上去，金幣不收找零以外的錢
    if (!t.theirs.items.length && t.theirs.coin > 0) {
      const pool = [...t.mine.items, ...v.character.items.filter((i) => i.location === 'bag' && !i.bound)];
      let best: { id: string; ask: number } | null = null;
      for (const it of pool) {
        if (!isGear(it.gear)) continue;
        const ask = this.askFor(sim, it.gear as unknown as RtGear);
        if (ask <= t.theirs.coin && (!best || ask > best.ask)) best = { id: it.id, ask };
      }
      // 行囊裡沒有合適的：把拍賣所自己掛著、開價買得起的最貴一件撤下來賣（模擬冒險者刷到的東西多半已經上架）
      if (!best && !t.mine.items.length) {
        const mine = await this.call<{ listings: ListingView[]; character: CharacterView }>(sim, 'market.mine', { characterId });
        const ls = (mine?.listings ?? []).filter((l) => l.status === 'open' && l.price <= t.theirs.coin).sort((x, y) => y.price - x.price)[0];
        if (ls) {
          const back = await this.call<CharacterView>(sim, 'market.cancel', { characterId, listingId: ls.id });
          const uid = (ls.gear as { uid?: unknown }).uid;
          const it = back?.items.find((i) => i.location === 'bag' && (i.gear as { uid?: unknown }).uid === uid);
          if (it) best = { id: it.id, ask: ls.price };
        }
      }
      const items = best ? [best.id] : [];
      if (t.mine.coin || t.mine.items.length !== items.length || t.mine.items[0]?.id !== items[0]) return !!(await this.call(sim, 'trade.offer', { characterId, tradeId, items, coin: 0 }));
      if (items.length && t.locked.them && !t.locked.me) return !!(await this.call(sim, 'trade.lock', { characterId, tradeId }));
      if (items.length && t.locked.them && t.locked.me && t.confirmed.them && !t.confirmed.me) return !!(await this.call(sim, 'trade.confirm', { characterId, tradeId, rev: t.rev }));
      return false;
    }
    const want = Math.min(v.character.wallet.coin + t.mine.coin, this.bidFor(sim, t.theirs.items.map((i) => i.gear)));
    if (t.mine.coin !== want || t.mine.items.length) return !!(await this.call(sim, 'trade.offer', { characterId, tradeId, items: [], coin: want }));
    if (want > 0 && t.locked.them && !t.locked.me) return !!(await this.call(sim, 'trade.lock', { characterId, tradeId }));
    if (t.locked.them && t.locked.me && t.confirmed.them && !t.confirmed.me) return !!(await this.call(sim, 'trade.confirm', { characterId, tradeId, rev: t.rev }));
    return false;
  }

  private isSimName(name: string): boolean {
    return this.roster.some((s) => s.name === name);
  }
}
