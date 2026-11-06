// 行囊的共用讀寫：資料表的 items（location＝bag／equip:<slot>）↔ core/meta/bag.ts 的 BagState
import { GEAR_SLOTS, isGear, type GearSlot, type RtGear } from '../../core/battle/rt/gear';
import type { BagState } from '../../core/meta/bag';
import { ApiError } from '../../net/protocol';
import type { CharacterRow, ItemRow } from '../repos/types';
import type { Ctx } from '../router';
import { characterView } from '../views';
import { ownCharacter } from './common';

export interface Inv {
  c: CharacterRow;
  rows: ItemRow[];
  bag: ItemRow[];
  equip: Partial<Record<GearSlot, ItemRow>>;
  st: BagState;
}

/** 字串參數（id 類）：型別與長度先擋（26-security §輸入驗證） */
export function idParam(v: unknown, what: string): string {
  if (typeof v !== 'string' || !v || v.length > 64) throw new ApiError('bad_request', what);
  return v;
}

export function slotParam(v: unknown): GearSlot {
  if (typeof v !== 'string' || !(GEAR_SLOTS as readonly string[]).includes(v)) throw new ApiError('bad_request', 'slot');
  return v as GearSlot;
}

export const gearOf = (row: ItemRow): RtGear => {
  if (!isGear(row.gear)) throw new ApiError('internal', 'bad gear row');
  return row.gear;
};

export async function loadInv(ctx: Ctx, characterId: unknown): Promise<Inv> {
  const c = await ownCharacter(ctx, characterId);
  const rows = await ctx.r.items.listByOwner(c.id);
  const bag = rows.filter((r) => r.location === 'bag').sort((a, b) => a.pos - b.pos);
  const equip: Inv['equip'] = {};
  for (const r of rows) {
    if (!r.location.startsWith('equip:')) continue;
    const s = r.location.slice(6) as GearSlot;
    if ((GEAR_SLOTS as readonly string[]).includes(s)) equip[s] = r;
  }
  const st: BagState = { bag: bag.filter((r) => isGear(r.gear)).map(gearOf), equip: {} };
  for (const s of GEAR_SLOTS) if (equip[s] && isGear(equip[s]!.gear)) st.equip[s] = gearOf(equip[s]!);
  return { c, rows, bag, equip, st };
}

/** 放到行囊最前面（第一期的 unshift）的 pos */
export const frontPos = (inv: Inv): number => Math.min(0, ...inv.bag.map((r) => r.pos)) - 1;

/** 找自己行囊（或身上）的一件；別人的、不存在的、在拍賣所的一律 not_found */
export function findItem(inv: Inv, itemId: unknown, where: 'bag' | 'bagOrEquip'): ItemRow {
  const id = idParam(itemId, 'itemId');
  const row = inv.rows.find((r) => r.id === id);
  if (!row || !(row.location === 'bag' || (where === 'bagOrEquip' && row.location.startsWith('equip:')))) throw new ApiError('not_found', 'item');
  return row;
}

/** 寫入後重新讀角色（版本號已經變了） */
export async function freshView(ctx: Ctx, id: string) {
  return characterView(ctx.r, (await ctx.r.characters.get(id))!);
}
