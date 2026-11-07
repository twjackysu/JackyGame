// 拍賣所（第 142 輪，V4 先行，24 §4.1／4.3、26-security）：客戶端只說「賣哪件、賣多少」「買哪一筆」，
// 上架費、手續費、物品換主人、帳本都在同一個資料庫交易裡由伺服器做；任何一步失敗整筆回滾。
// 綁定的物品不能上架；不能買自己帳號的掛單（左手換右手走面對面交易）；過期的掛單買不到，賣家看「我的掛單」時退回行囊。
import { BAG_MAX } from '../../core/meta/bag';
import { GEAR_SLOTS } from '../../core/battle/rt/gear';
import { HISTORY_N, LISTING_MS, MARKET_PAGE, MAX_OPEN_LISTINGS, REF_COMBOS_MAX, REF_MIN_SALES, listFee, priceStats, refKey, saleFee, sellerGets, validPrice } from '../../core/meta/market';
import { ApiError } from '../../net/protocol';
import type { ListingView } from '../../net/views';
import type { ListingRow } from '../repos/types';
import type { Ctx, HandlerTable } from '../router';
import { findItem, freshView, frontPos, gearOf, idParam, loadInv } from './inv';
import { ownCharacter } from './common';

const view = (l: ListingRow, accountId: string): ListingView => ({ id: l.id, sellerName: l.sellerName, mine: l.sellerAccountId === accountId, price: l.price, status: l.status, gear: l.gear, createdAt: l.createdAt, expiresAt: l.expiresAt });

/** 掛單時間到了但還標 open：當作過期 */
const alive = (l: ListingRow, now: number) => l.status === 'open' && l.expiresAt > now;

async function openListing(ctx: Ctx, id: unknown): Promise<ListingRow> {
  const l = await ctx.r.listings.get(idParam(id, 'listingId'));
  if (!l || !alive(l, ctx.clock.now())) throw new ApiError('not_found', 'listing');
  return l;
}

/** 掛單上的物品退回賣家行囊最前面 */
async function giveBack(ctx: Ctx, l: ListingRow): Promise<void> {
  const it = await ctx.r.items.get(l.itemId);
  if (!it || it.location !== `market:${l.id}`) return;
  const inv = await loadInv(ctx, l.sellerCharacterId);
  await ctx.r.items.save({ ...it, location: 'bag', pos: frontPos(inv) });
}

export const marketHandlers: Pick<HandlerTable, 'market.list' | 'market.cancel' | 'market.buy' | 'market.browse' | 'market.mine' | 'market.history'> = {
  'market.list': async (ctx, p) => {
    const price = p?.price;
    if (!validPrice(price)) throw new ApiError('bad_request', 'price');
    const inv = await loadInv(ctx, p?.characterId);
    const row = findItem(inv, p?.itemId, 'bag');
    if (row.bound) throw new ApiError('rejected', 'bound item');
    const g = gearOf(row);
    const open = (await ctx.r.listings.listBySeller(inv.c.id, 200)).filter((l) => alive(l, ctx.clock.now()));
    if (open.length >= MAX_OPEN_LISTINGS) throw new ApiError('rejected', 'too many listings');
    const id = ctx.ids.next('mkt');
    await ctx.r.wallets.apply(inv.c.id, 'coin', -listFee(price), 'market.listFee', id);
    const now = ctx.clock.now();
    const l: ListingRow = { id, sellerAccountId: ctx.accountId, sellerCharacterId: inv.c.id, sellerName: inv.c.name, itemId: row.id, price, status: 'open', slot: g.slot, rarity: g.rarity, ilvl: g.ilvl, gear: row.gear, createdAt: now, expiresAt: now + LISTING_MS, version: 0 };
    await ctx.r.items.save({ ...row, location: `market:${id}`, pos: 0 });
    await ctx.r.listings.save(l);
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'market.list', detail: JSON.stringify({ listing: id, item: row.id, price }), at: now });
    return { listing: view(l, ctx.accountId), character: await freshView(ctx, inv.c.id) };
  },

  'market.cancel': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const l = await ctx.r.listings.get(idParam(p?.listingId, 'listingId'));
    if (!l || l.sellerCharacterId !== c.id || l.status !== 'open') throw new ApiError('not_found', 'listing');
    await giveBack(ctx, l);
    await ctx.r.listings.save({ ...l, status: 'cancelled', closedAt: ctx.clock.now() });
    return freshView(ctx, c.id);
  },

  'market.buy': async (ctx, p) => {
    const inv = await loadInv(ctx, p?.characterId);
    const l = await openListing(ctx, p?.listingId);
    if (l.sellerAccountId === ctx.accountId) throw new ApiError('rejected', 'own listing');
    if (inv.bag.length >= BAG_MAX) throw new ApiError('rejected', 'bag full');
    const it = await ctx.r.items.get(l.itemId);
    if (!it || it.location !== `market:${l.id}`) throw new ApiError('internal', 'listing item missing');
    await ctx.r.wallets.apply(inv.c.id, 'coin', -l.price, 'market.buy', l.id);
    await ctx.r.wallets.apply(l.sellerCharacterId, 'coin', sellerGets(l.price), 'market.sold', l.id);
    await ctx.r.items.save({ ...it, ownerId: inv.c.id, location: 'bag', pos: frontPos(inv) });
    const now = ctx.clock.now();
    await ctx.r.listings.save({ ...l, status: 'sold', closedAt: now, buyerCharacterId: inv.c.id });
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'market.buy', detail: JSON.stringify({ listing: l.id, item: it.id, price: l.price, fee: saleFee(l.price), seller: l.sellerCharacterId }), at: now });
    return freshView(ctx, inv.c.id);
  },

  'market.browse': async (ctx, p) => {
    const slot = p?.slot;
    if (slot !== undefined && (typeof slot !== 'string' || !(GEAR_SLOTS as readonly string[]).includes(slot))) throw new ApiError('bad_request', 'slot');
    const rarity = p?.rarity;
    if (rarity !== undefined && (typeof rarity !== 'number' || !Number.isInteger(rarity) || rarity < 0 || rarity > 5)) throw new ApiError('bad_request', 'rarity');
    const page = p?.page ?? 0;
    if (typeof page !== 'number' || !Number.isInteger(page) || page < 0 || page > 500) throw new ApiError('bad_request', 'page');
    if (p?.refs !== undefined && typeof p.refs !== 'boolean') throw new ApiError('bad_request', 'refs');
    const rows = await ctx.r.listings.listOpen({ slot, rarity, aliveAt: ctx.clock.now(), offset: page * MARKET_PAGE, limit: MARKET_PAGE });
    const listings = rows.map((l) => view(l, ctx.accountId));
    if (!p?.refs) return { listings, page };
    // 行情（第 154 輪，D-333）：這頁出現的「部位×稀有度」各自最近成交的中位數；最多 REF_COMBOS_MAX 組、成交太少的不給。
    // 只有中位數一個數字，不帶任何成交明細（同 market.history，不洩漏其他玩家資料）。模擬冒險者逛的時候不要（refs 不帶）
    const combos = [...new Set(rows.map((l) => refKey(l.slot, l.rarity)))].slice(0, REF_COMBOS_MAX);
    const refs: Record<string, number> = {};
    for (const key of combos) {
      const [s, r] = key.split(':');
      const st = priceStats((await ctx.r.listings.listSold({ slot: s!, rarity: Number(r), limit: HISTORY_N })).map((l) => l.price));
      if (st && st.n >= REF_MIN_SALES) refs[key] = st.median;
    }
    return { listings, page, refs };
  },

  'market.history': async (ctx, p) => {
    const slot = p?.slot;
    if (typeof slot !== 'string' || !(GEAR_SLOTS as readonly string[]).includes(slot)) throw new ApiError('bad_request', 'slot');
    const rarity = p?.rarity;
    if (typeof rarity !== 'number' || !Number.isInteger(rarity) || rarity < 0 || rarity > 5) throw new ApiError('bad_request', 'rarity');
    // 只給價格、物品等級、時間：誰賣誰買不外流（26-security：不洩漏其他玩家資料）
    const rows = await ctx.r.listings.listSold({ slot, rarity, limit: HISTORY_N });
    return { sales: rows.map((l) => ({ price: l.price, ilvl: l.ilvl, at: l.closedAt ?? l.createdAt })) };
  },

  'market.mine': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const now = ctx.clock.now();
    const out: ListingRow[] = [];
    for (const l of await ctx.r.listings.listBySeller(c.id, 50)) {
      if (l.status === 'open' && l.expiresAt <= now) {
        await giveBack(ctx, l);
        out.push(await ctx.r.listings.save({ ...l, status: 'expired', closedAt: now }));
      } else out.push(l);
    }
    // 賣出通知（第 149 輪，D-320）：上次看過之後才成交的（模擬冒險者／別的玩家在你不在時買走）。第一次看拍賣所只記時間、不通知舊的
    const seen = c.marketSeenAt;
    const news = seen === undefined ? [] : out.filter((l) => l.status === 'sold' && (l.closedAt ?? 0) > seen);
    const upTo = Math.max(seen ?? now, ...news.map((l) => l.closedAt ?? 0));
    if (upTo !== seen) await ctx.r.characters.save({ ...(await ownCharacter(ctx, c.id)), marketSeenAt: upTo });
    return { listings: out.map((l) => view(l, ctx.accountId)), news: news.map((l) => view(l, ctx.accountId)), character: await freshView(ctx, c.id) };
  },
};
