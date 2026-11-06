// 面對面交易（託管，F3，第 144 輪，24 §4.2、26-security）：客戶端只說「我放這些」「我鎖定」「我確認第幾版」；
// 放進去的物品搬到 trade:<id>、金幣先扣（託管），所以交換時不會「東西不見了／錢不夠」；雙方都對同一版確認，
// 才在同一個資料庫交易裡把物品換主人、金幣發給對方。取消或過期：雙方的東西全部退回。
// 對象：另一個帳號的角色（線上）或自己的另一個角色（多角色）；綁定的物品不能放。
import { BAG_MAX } from '../../core/meta/bag';
import { TRADE_TTL_MS, cancel, confirm, lock, newTrade, setOffer, validOffer, type TradeResult, type TradeSide } from '../../core/meta/trade';
import { ApiError } from '../../net/protocol';
import type { TradeView, WeaponView } from '../../net/views';
import { simRoster } from '../sim/roster';
import type { TradeRow } from '../repos/types';
import type { Ctx, HandlerTable } from '../router';
import { ownCharacter } from './common';
import { freshView, frontPos, idParam, loadInv } from './inv';

/** 一個角色同時開著的交易上限 */
const MAX_OPEN_TRADES = 3;

const loc = (t: TradeRow) => `trade:${t.id}`;
const charOf = (t: TradeRow, s: TradeSide) => (s === 'a' ? t.aCharacterId : t.bCharacterId);
const other = (s: TradeSide): TradeSide => (s === 'a' ? 'b' : 'a');

async function view(ctx: Ctx, t: TradeRow, side: TradeSide): Promise<TradeView> {
  const offer = async (s: TradeSide) => {
    const rows = (await ctx.r.items.listByOwner(charOf(t, s))).filter((r) => r.location === loc(t));
    const order = t.state.offer[s].items;
    return { items: order.map((id) => rows.find((r) => r.id === id)).filter((r) => !!r).map((r) => ({ id: r.id, gear: r.gear })), coin: t.state.offer[s].coin };
  };
  const o = other(side);
  return {
    id: t.id,
    partnerName: side === 'a' ? t.bName : t.aName,
    status: t.state.status,
    rev: t.state.rev,
    mine: await offer(side),
    theirs: await offer(o),
    locked: { me: t.state.locked[side], them: t.state.locked[o] },
    confirmed: { me: t.state.confirmed[side], them: t.state.confirmed[o] },
    expiresAt: t.expiresAt,
  };
}

/** 把一方託管的東西退回（物品回行囊最前面、金幣退回） */
async function refund(ctx: Ctx, t: TradeRow, s: TradeSide): Promise<void> {
  const c = charOf(t, s);
  const rows = await ctx.r.items.listByOwner(c);
  let pos = Math.min(0, ...rows.filter((r) => r.location === 'bag').map((r) => r.pos));
  for (const r of rows) if (r.location === loc(t)) await ctx.r.items.save({ ...r, location: 'bag', pos: --pos });
  if (t.state.offer[s].coin > 0) await ctx.r.wallets.apply(c, 'coin', t.state.offer[s].coin, 'trade.refund', t.id);
}

/** 讀一筆、確認是這個角色的、過期的順便退回；回傳 [交易, 我是哪一邊] */
async function myTrade(ctx: Ctx, characterId: unknown, tradeId: unknown): Promise<[TradeRow, TradeSide, string]> {
  const c = await ownCharacter(ctx, characterId);
  let t = await ctx.r.trades.get(idParam(tradeId, 'tradeId'));
  if (!t || (t.aCharacterId !== c.id && t.bCharacterId !== c.id)) throw new ApiError('not_found', 'trade');
  const side: TradeSide = t.aCharacterId === c.id ? 'a' : 'b';
  if (t.state.status === 'open' && ctx.clock.now() > t.expiresAt) {
    await refund(ctx, t, 'a');
    await refund(ctx, t, 'b');
    t = await ctx.r.trades.save({ ...t, state: { ...t.state, status: 'expired', locked: { a: false, b: false }, confirmed: { a: false, b: false } } });
  }
  return [t, side, c.id];
}

const apply = (r: TradeResult) => {
  if (!r.ok) throw new ApiError(r.why === 'bad offer' ? 'bad_request' : 'rejected', r.why);
  return r.state;
};

async function done(ctx: Ctx, t: TradeRow, side: TradeSide, cid: string) {
  return { trade: await view(ctx, t, side), character: await freshView(ctx, cid) };
}

/** 雙方都確認了：物品換主人、金幣發給對方（託管時已經扣過） */
async function execute(ctx: Ctx, t: TradeRow): Promise<void> {
  for (const s of ['a', 'b'] as const) {
    const to = charOf(t, other(s));
    const incoming = (await ctx.r.items.listByOwner(charOf(t, s))).filter((r) => r.location === loc(t));
    const theirs = await ctx.r.items.listByOwner(to);
    const bag = theirs.filter((r) => r.location === 'bag');
    if (bag.length + incoming.length > BAG_MAX) throw new ApiError('rejected', 'bag full');
    let pos = Math.min(0, ...bag.map((r) => r.pos));
    for (const r of incoming) await ctx.r.items.save({ ...r, ownerId: to, location: 'bag', pos: --pos });
    if (t.state.offer[s].coin > 0) await ctx.r.wallets.apply(to, 'coin', t.state.offer[s].coin, 'trade.receive', t.id);
  }
}

export const tradeHandlers: Pick<HandlerTable, 'trade.partners' | 'trade.open' | 'trade.offer' | 'trade.lock' | 'trade.confirm' | 'trade.cancel' | 'trade.get'> = {
  'trade.partners': async (ctx, p) => {
    const me = await ownCharacter(ctx, p?.characterId);
    const now = ctx.clock.now();
    // 還開著的交易（離開面板再回來可以接著做；過期的不列，下次 get 時退回）
    const open = (await ctx.r.trades.listByCharacter(me.id, 20)).filter((t) => t.state.status === 'open' && t.expiresAt >= now).map((t) => ({ id: t.id, partnerName: t.aCharacterId === me.id ? t.bName : t.aName }));
    if (!ctx.local) return { partners: [], open };
    const partners: { characterId: string; name: string; weapon: WeaponView }[] = [];
    for (const s of simRoster()) {
      const [c] = await ctx.r.characters.listByAccount(s.accountId);
      if (c) partners.push({ characterId: c.id, name: c.name, weapon: c.weapon });
    }
    return { partners, open };
  },

  'trade.open': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const partner = await ctx.r.characters.get(idParam(p?.partnerCharacterId, 'partnerCharacterId'));
    if (!partner || partner.id === c.id) throw new ApiError('not_found', 'partner');
    const now = ctx.clock.now();
    const open = (await ctx.r.trades.listByCharacter(c.id, 50)).filter((t) => t.state.status === 'open' && t.expiresAt >= now);
    if (open.length >= MAX_OPEN_TRADES) throw new ApiError('rejected', 'too many trades');
    const t = await ctx.r.trades.save({ id: ctx.ids.next('trd'), aAccountId: ctx.accountId, aCharacterId: c.id, aName: c.name, bAccountId: partner.accountId, bCharacterId: partner.id, bName: partner.name, state: newTrade(), createdAt: now, expiresAt: now + TRADE_TTL_MS, version: 0 });
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'trade.open', detail: JSON.stringify({ trade: t.id, a: c.id, b: partner.id }), at: now });
    return done(ctx, t, 'a', c.id);
  },

  'trade.offer': async (ctx, p) => {
    const want = { items: p?.items, coin: p?.coin };
    if (!validOffer(want)) throw new ApiError('bad_request', 'offer');
    const [t, side, cid] = await myTrade(ctx, p?.characterId, p?.tradeId);
    const state = apply(setOffer(t.state, side, want));
    const inv = await loadInv(ctx, cid);
    const old = new Set(t.state.offer[side].items);
    const next = new Set(want.items);
    // 拿出來的退回行囊；新放的要在行囊裡、不能是綁定的
    let pos = frontPos(inv);
    for (const r of inv.rows) if (r.location === loc(t) && !next.has(r.id)) await ctx.r.items.save({ ...r, location: 'bag', pos: pos-- });
    for (const id of want.items) {
      if (old.has(id)) {
        if (!inv.rows.some((r) => r.id === id && r.location === loc(t))) throw new ApiError('internal', 'escrow item missing');
        continue;
      }
      const r = inv.rows.find((x) => x.id === id && x.location === 'bag');
      if (!r) throw new ApiError('not_found', 'item');
      if (r.bound) throw new ApiError('rejected', 'bound item');
      await ctx.r.items.save({ ...r, location: loc(t), pos: 0 });
    }
    // 金幣託管：多放的先扣、少放的退回（扣到負數＝錢不夠，整筆回滾）
    const delta = want.coin - t.state.offer[side].coin;
    if (delta) await ctx.r.wallets.apply(cid, 'coin', -delta, delta > 0 ? 'trade.escrow' : 'trade.refund', t.id);
    const saved = await ctx.r.trades.save({ ...t, state });
    return done(ctx, saved, side, cid);
  },

  'trade.lock': async (ctx, p) => {
    const [t, side, cid] = await myTrade(ctx, p?.characterId, p?.tradeId);
    const saved = await ctx.r.trades.save({ ...t, state: apply(lock(t.state, side)) });
    return done(ctx, saved, side, cid);
  },

  'trade.confirm': async (ctx, p) => {
    const rev = p?.rev;
    if (typeof rev !== 'number' || !Number.isSafeInteger(rev)) throw new ApiError('bad_request', 'rev');
    const [t, side, cid] = await myTrade(ctx, p?.characterId, p?.tradeId);
    const state = apply(confirm(t.state, side, rev));
    const saved = await ctx.r.trades.save({ ...t, state });
    if (state.status === 'done') {
      await execute(ctx, saved);
      await ctx.r.audit.add({ accountId: ctx.accountId, action: 'trade.done', detail: JSON.stringify({ trade: t.id, a: t.aCharacterId, b: t.bCharacterId, offer: state.offer }), at: ctx.clock.now() });
    }
    return done(ctx, saved, side, cid);
  },

  'trade.cancel': async (ctx, p) => {
    const [t, side, cid] = await myTrade(ctx, p?.characterId, p?.tradeId);
    const state = apply(cancel(t.state));
    await refund(ctx, t, 'a');
    await refund(ctx, t, 'b');
    const saved = await ctx.r.trades.save({ ...t, state });
    return done(ctx, saved, side, cid);
  },

  'trade.get': async (ctx, p) => {
    const [t, side, cid] = await myTrade(ctx, p?.characterId, p?.tradeId);
    return done(ctx, t, side, cid);
  },
};
