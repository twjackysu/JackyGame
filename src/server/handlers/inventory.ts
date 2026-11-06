// 行囊：穿、脫、分解、強化（第 141 輪 V2）。規則在 core/meta/bag.ts，強化的擲骰用 ctx.rng（伺服器）。
// 26-security：只接受「意圖」（哪件、哪格）；費用、成功與否、得到多少粉塵全部伺服器算。
import { enhanceCost, salvageDust } from '../../core/battle/rt/gear';
import { BAG_MAX, enhanceRoll } from '../../core/meta/bag';
import { ApiError } from '../../net/protocol';
import type { HandlerTable } from '../router';
import { findItem, freshView, frontPos, gearOf, loadInv, slotParam } from './inv';

export const inventoryHandlers: Pick<HandlerTable, 'inventory.equip' | 'inventory.unequip' | 'inventory.salvage' | 'enhance.do'> = {
  'inventory.equip': async (ctx, p) => {
    const inv = await loadInv(ctx, p?.characterId);
    const row = findItem(inv, p?.itemId, 'bag');
    const g = gearOf(row);
    const old = inv.equip[g.slot];
    const pos = frontPos(inv);
    await ctx.r.items.save({ ...row, location: `equip:${g.slot}`, pos: 0 });
    if (old) await ctx.r.items.save({ ...old, location: 'bag', pos });
    return freshView(ctx, inv.c.id);
  },

  'inventory.unequip': async (ctx, p) => {
    const inv = await loadInv(ctx, p?.characterId);
    const slot = slotParam(p?.slot);
    const row = inv.equip[slot];
    if (!row) throw new ApiError('not_found', 'slot empty');
    if (inv.bag.length >= BAG_MAX) throw new ApiError('rejected', 'bag full');
    await ctx.r.items.save({ ...row, location: 'bag', pos: frontPos(inv) });
    return freshView(ctx, inv.c.id);
  },

  'inventory.salvage': async (ctx, p) => {
    const inv = await loadInv(ctx, p?.characterId);
    const row = findItem(inv, p?.itemId, 'bag');
    const dust = salvageDust(gearOf(row));
    await ctx.r.items.delete(row.id);
    await ctx.r.wallets.apply(inv.c.id, 'dust', dust, 'salvage', row.id);
    return { dust, character: await freshView(ctx, inv.c.id) };
  },

  'enhance.do': async (ctx, p) => {
    const inv = await loadInv(ctx, p?.characterId);
    const row = findItem(inv, p?.itemId, 'bagOrEquip');
    const g = gearOf(row);
    const roll = enhanceRoll(g, ctx.rng);
    if (!roll) throw new ApiError('rejected', 'max enhance');
    const c = enhanceCost(g.enh ?? 0);
    // 材料不夠：wallets.apply 丟 rejected，整個交易回滾
    if (c.dust) await ctx.r.wallets.apply(inv.c.id, 'dust', -c.dust, 'enhance', row.id);
    if (c.crystal) await ctx.r.wallets.apply(inv.c.id, 'crystal', -c.crystal, 'enhance', row.id);
    if (roll.ok) await ctx.r.items.save({ ...row, gear: roll.gear as unknown as Record<string, unknown> });
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'enhance.do', detail: JSON.stringify({ item: row.id, from: g.enh ?? 0, ok: roll.ok }), at: ctx.clock.now() });
    return { ok: roll.ok, enh: roll.gear.enh ?? 0, character: await freshView(ctx, inv.c.id) };
  },
};
