// 模擬玩家專用的伺服器內部 handler（不在 protocol.ts、不在 HANDLERS 表裡：客戶端送 "sim.step" 只會拿到 unknown_method）。
// 只做兩件「真人是靠打怪做到」的事：建角色、每次上線「刷到」一件裝備和一點金幣（V5 的 loot.claim 做好後改走它）。
// 上架、購買、賣行商、領回過期掛單一律走和真人一樣的公開 handler（SimMarket 呼叫），不直接改資料庫。
import { genGear, type Rarity } from '../../core/battle/rt/gear';
import { buyPrice } from '../../core/meta/shop';
import { hashSeed, mulberry32 } from '../../core/rng';
import { ApiError } from '../../net/protocol';
import type { Ctx } from '../router';
import { createCharacter } from '../handlers/build';
import { frontPos, loadInv } from '../handlers/inv';
import type { SimPlayer } from './roster';

const DAY = 24 * 3600 * 1000;
/** 離開太久不補跑全部：最多補最近幾次（不然一週沒開遊戲，一打開就爆出幾百筆掛單） */
export const SIM_BACKLOG = 3;
/** 同時開著的掛單上限（比真人的 20 少，讓市場不會被模擬玩家塞滿） */
export const SIM_MAX_LISTINGS = 4;

export interface SimState {
  characterId: string;
  last: number;
  n: number;
}

export type SimDecision =
  | { kind: 'wait' }
  | { kind: 'list'; itemId: string; price: number }
  | { kind: 'shop'; factor: number; coin: number }
  | { kind: 'tidy'; keep: number };

const stateOf = (c: { id: string; story: Record<string, string> }): SimState => ({ characterId: c.id, last: Number(c.story.sim_last) || 0, n: Number(c.story.sim_n) || 0 });

const regionOf = (ilvl: number): string => (ilvl <= 3 ? 'mistwood' : ilvl <= 6 ? 'thornvale' : ilvl <= 9 ? 'emberrift' : 'starfall');

/** 拿模擬玩家的角色；沒有就建一個（第一次開拍賣所時）。剛建的往回推幾次行動，讓市場一開始就有貨 */
export async function simState(ctx: Ctx, sim: SimPlayer): Promise<SimState> {
  if (ctx.accountId !== sim.accountId) throw new ApiError('internal', 'sim account mismatch');
  const [c] = await ctx.r.characters.listByAccount(sim.accountId);
  if (c) return stateOf(c);
  const now = ctx.clock.now();
  if (!(await ctx.r.accounts.get(sim.accountId))) await ctx.r.accounts.put({ id: sim.accountId, displayName: sim.name, createdAt: now });
  const story = { sim_spawn: String(now), sim_last: String(now - SIM_BACKLOG * sim.intervalMs), sim_n: '0' };
  const level = Math.min(30, 2 + sim.tier * 3);
  const made = await createCharacter(ctx, { slot: 0, name: sim.name, weapon: sim.weapon, level, xp: 0, stats: {}, skills: null, variants: null, bounty: null, shop: null, maps: {}, story, items: [], wallet: { coin: sim.startCoin, dust: 0, crystal: 0 } }, 'sim.spawn');
  return stateOf(made);
}

/** 往前走一次行動：決定這次要做什麼；要上架的話先「刷到」那件裝備。行動序號 n 不對就不做（重送安全） */
export async function simStep(ctx: Ctx, sim: SimPlayer, n: number): Promise<{ state: SimState; decision: SimDecision }> {
  const inv = await loadInv(ctx, (await simState(ctx, sim)).characterId);
  const c = inv.c;
  const st = stateOf(c);
  const now = ctx.clock.now();
  if (st.n !== n) return { state: st, decision: { kind: 'wait' } };
  const last = Math.max(st.last, now - SIM_BACKLOG * sim.intervalMs);
  const at = last + sim.intervalMs;
  if (at > now) return { state: st, decision: { kind: 'wait' } };

  const R = mulberry32(hashSeed(`${sim.seed}:${n}`));
  const days = (at - (Number(c.story.sim_spawn) || at)) / DAY;
  const roll = R();
  let decision: SimDecision;
  // 剛建的前兩次一定是上架：第一次打開拍賣所就有貨
  if (roll < 0.5 || n < 2) {
    const ilvl = Math.max(1, Math.min(12, sim.tier + Math.floor(days / 2) + Math.floor(R() * 3) - 1));
    const rr = R();
    const rarity: Rarity = rr < 0.55 ? 1 : rr < 0.9 ? 2 : 3;
    const g = genGear(hashSeed(`${sim.seed}:${n}:loot`), rarity, ilvl, { region: regionOf(ilvl) });
    const id = ctx.ids.next('itm');
    await ctx.r.items.save({ id, ownerId: c.id, location: 'bag', pos: frontPos(inv), bound: false, gear: g as unknown as Record<string, unknown>, createdAt: now, version: 0 });
    await ctx.r.wallets.apply(c.id, 'coin', 5 + Math.floor(R() * 16), 'sim.farm', `sim:${n}`);
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'sim.farm', detail: JSON.stringify({ n, item: id, rarity, ilvl }), at: now });
    // 定價：行商買價的 45%～85%（越會殺價的賣越便宜）× ±10%
    const price = Math.max(1, Math.round(buyPrice(g) * (0.45 + 0.4 * (1 - sim.thrift)) * (0.9 + R() * 0.2)));
    decision = { kind: 'list', itemId: id, price };
  } else if (roll < 0.85) {
    // 願意出的價：行商買價的 35%～80% × ±15%
    const coin = (await ctx.r.wallets.balances(c.id)).coin;
    decision = { kind: 'shop', factor: (0.35 + 0.45 * (1 - sim.thrift)) * (0.85 + R() * 0.3), coin };
  } else decision = { kind: 'tidy', keep: 6 + Math.floor(R() * 6) };

  const saved = await ctx.r.characters.save({ ...c, story: { ...c.story, sim_last: String(at), sim_n: String(n + 1) } });
  return { state: stateOf(saved), decision };
}
