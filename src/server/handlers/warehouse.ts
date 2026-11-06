// 帳號共用倉庫（F1，D-302）：40 格，同一個帳號的角色都拿得到。物品 ownerId＝wh:<帳號>、location＝warehouse。
// 只有行囊裡的能放（穿著的、拍賣中、交易中的不行）；綁定的可以放（綁定是綁帳號，不是綁角色）。
import { BAG_MAX } from '../../core/meta/bag';
import { WAREHOUSE_MAX, nextPos, warehouseOwner } from '../../core/meta/roster';
import { ApiError } from '../../net/protocol';
import type { WarehouseView } from '../../net/views';
import type { Ctx, HandlerTable } from '../router';
import { characterView } from '../views';
import { ownCharacter } from './common';
import { idParam } from './inv';

async function view(ctx: Ctx): Promise<WarehouseView> {
  const rows = (await ctx.r.items.listByOwner(warehouseOwner(ctx.accountId))).filter((r) => r.location === 'warehouse').sort((a, b) => a.pos - b.pos);
  return { max: WAREHOUSE_MAX, items: rows.map((i) => ({ id: i.id, location: i.location, pos: i.pos, bound: i.bound, gear: i.gear })) };
}

export const warehouseHandlers: Pick<HandlerTable, 'warehouse.get' | 'warehouse.put' | 'warehouse.take'> = {
  'warehouse.get': async (ctx) => view(ctx),

  'warehouse.put': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const id = idParam(p?.itemId, 'itemId');
    const it = await ctx.r.items.get(id);
    if (!it || it.ownerId !== c.id || it.location !== 'bag') throw new ApiError('not_found', 'item');
    const owner = warehouseOwner(ctx.accountId);
    const stored = (await ctx.r.items.listByOwner(owner)).filter((r) => r.location === 'warehouse');
    if (stored.length >= WAREHOUSE_MAX) throw new ApiError('rejected', 'warehouse full');
    await ctx.r.items.save({ ...it, ownerId: owner, location: 'warehouse', pos: nextPos(stored) });
    return { warehouse: await view(ctx), character: await characterView(ctx.r, c) };
  },

  'warehouse.take': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const id = idParam(p?.itemId, 'itemId');
    const it = await ctx.r.items.get(id);
    if (!it || it.ownerId !== warehouseOwner(ctx.accountId) || it.location !== 'warehouse') throw new ApiError('not_found', 'item');
    const bag = (await ctx.r.items.listByOwner(c.id)).filter((r) => r.location === 'bag');
    if (bag.length >= BAG_MAX) throw new ApiError('rejected', 'bag full');
    await ctx.r.items.save({ ...it, ownerId: c.id, location: 'bag', pos: nextPos(bag) });
    return { warehouse: await view(ctx), character: await characterView(ctx.r, c) };
  },
};
