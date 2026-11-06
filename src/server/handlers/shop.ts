// 營火行商（第 141 輪 V2）：貨架、價格、折扣全部伺服器用 core/meta/shop.ts 算；客戶端只說「買哪件／賣哪些」。
import { BAG_MAX, weakestSlot } from '../../core/meta/bag';
import { CHOICE_MAPS, SHOP_GOODS, SHOP_REROLL, discountOf, isDeal, isPicked, sellPrice, shopBatch, shopIlvl, shopStock, stockPrice, withPick, type ShopRec } from '../../core/meta/shop';
import { ApiError } from '../../net/protocol';
import type { ShopView } from '../../net/views';
import type { CharacterRow } from '../repos/types';
import type { Ctx, HandlerTable } from '../router';
import { findItem, freshView, frontPos, gearOf, idParam, loadInv, type Inv } from './inv';

const recOf = (c: CharacterRow): ShopRec => ({ runs: c.stats.runs ?? 0, shop: c.shop });

/** 抉擇紀錄存在角色的劇情旗標 jg_choices（舊存檔原樣搬來） */
function discount(c: CharacterRow): number {
  try {
    return discountOf(JSON.parse(c.story.jg_choices ?? '{}'));
  } catch {
    return 0;
  }
}

function regionParam(v: unknown): string {
  if (typeof v !== 'string' || !(CHOICE_MAPS as readonly string[]).includes(v)) throw new ApiError('bad_request', 'region');
  return v;
}

function shopView(c: CharacterRow, region: string): ShopView {
  const rec = recOf(c);
  const off = discount(c);
  return {
    batch: shopBatch(rec).batch,
    region,
    stock: shopStock(rec, c.level, region).map((g) => ({ gear: g as unknown as Record<string, unknown>, price: stockPrice(rec, g, off), deal: isDeal(rec, g), picked: isPicked(g) })),
    goods: SHOP_GOODS.map((x) => ({ id: x.id, name: x.name, desc: x.desc, price: x.price })),
    reroll: SHOP_REROLL,
    discount: off,
  };
}

async function saveShop(ctx: Ctx, c: CharacterRow, shop: unknown): Promise<CharacterRow> {
  return ctx.r.characters.save({ ...c, shop });
}

/** 這批貨還沒決定「為你挑選」就照身上最弱的格子決定（和第一期面板打開時一樣） */
async function opened(ctx: Ctx, inv: Inv): Promise<CharacterRow> {
  const rec = recOf(inv.c);
  const next = withPick(rec, weakestSlot(inv.st, shopIlvl(inv.c.level)));
  return next === rec ? inv.c : saveShop(ctx, inv.c, next.shop);
}

export const shopHandlers: Pick<HandlerTable, 'shop.open' | 'shop.buy' | 'shop.buyGoods' | 'shop.sell' | 'shop.reroll'> = {
  'shop.open': async (ctx, p) => {
    const region = regionParam(p?.region);
    const inv = await loadInv(ctx, p?.characterId);
    return shopView(await opened(ctx, inv), region);
  },

  'shop.buy': async (ctx, p) => {
    const region = regionParam(p?.region);
    const uid = idParam(p?.uid, 'uid');
    const inv = await loadInv(ctx, p?.characterId);
    const c = await opened(ctx, inv);
    const rec = recOf(c);
    const g = shopStock(rec, c.level, region).find((x) => x.uid === uid);
    if (!g) throw new ApiError('not_found', 'offer');
    if (inv.bag.length >= BAG_MAX) throw new ApiError('rejected', 'bag full');
    const price = stockPrice(rec, g, discount(c));
    await ctx.r.wallets.apply(c.id, 'coin', -price, 'shop.buy', g.uid);
    const sh = shopBatch(rec);
    const after = await saveShop(ctx, c, { ...sh, sold: [...sh.sold, g.uid] });
    await ctx.r.items.save({ id: ctx.ids.next('itm'), ownerId: c.id, location: 'bag', pos: frontPos(inv), bound: false, gear: g as unknown as Record<string, unknown>, createdAt: ctx.clock.now(), version: 0 });
    return { character: await freshView(ctx, c.id), shop: shopView(after, region) };
  },

  'shop.buyGoods': async (ctx, p) => {
    const inv = await loadInv(ctx, p?.characterId);
    const it = SHOP_GOODS.find((x) => x.id === p?.goodsId);
    if (!it) throw new ApiError('bad_request', 'goodsId');
    await ctx.r.wallets.apply(inv.c.id, 'coin', -it.price, 'shop.goods', it.id);
    if (it.dust) await ctx.r.wallets.apply(inv.c.id, 'dust', it.dust, 'shop.goods', it.id);
    if (it.crystal) await ctx.r.wallets.apply(inv.c.id, 'crystal', it.crystal, 'shop.goods', it.id);
    return freshView(ctx, inv.c.id);
  },

  'shop.sell': async (ctx, p) => {
    const ids = p?.itemIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > BAG_MAX || new Set(ids).size !== ids.length) throw new ApiError('bad_request', 'itemIds');
    const inv = await loadInv(ctx, p?.characterId);
    let coin = 0;
    for (const id of ids) {
      const row = findItem(inv, id, 'bag');
      coin += sellPrice(gearOf(row));
      await ctx.r.items.delete(row.id);
    }
    await ctx.r.wallets.apply(inv.c.id, 'coin', coin, 'shop.sell');
    return { coin, character: await freshView(ctx, inv.c.id) };
  },

  'shop.reroll': async (ctx, p) => {
    const region = regionParam(p?.region);
    const inv = await loadInv(ctx, p?.characterId);
    await ctx.r.wallets.apply(inv.c.id, 'coin', -SHOP_REROLL, 'shop.reroll');
    const sh = shopBatch(recOf(inv.c));
    const after = await saveShop(ctx, inv.c, { batch: sh.batch + 1, sold: [] });
    return { character: await freshView(ctx, inv.c.id), shop: shopView(after, region) };
  },
};
