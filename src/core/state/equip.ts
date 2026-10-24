// 裝備、買賣（純邏輯，不 import phaser）。資料：src/data/equipment.ts。
import type { BaseStats } from '../battle/formulas';
import type { HeroId } from '../battle/skills';
import { ITEM_DEFS, SHOPS, SLOTS, itemDef, type ItemDef, type Slot } from '../../data/equipment';
import type { GameState, MemberId } from './gameState';

export const SELL_RATE = 0.5;

/** 某位成員所有已裝備物品的數值加總 */
export function gearBonus(s: GameState, member: MemberId): Required<BaseStats> {
  const out = { hp: 0, atk: 0, def: 0, spd: 0 };
  const eq = s.members[member]?.equipment ?? {};
  for (const slot of SLOTS) {
    const id = eq[slot];
    const b = id ? ITEM_DEFS[id]?.bonus : undefined;
    if (!b) continue;
    out.hp += b.hp ?? 0;
    out.atk += b.atk ?? 0;
    out.def += b.def ?? 0;
    out.spd += b.spd ?? 0;
  }
  return out;
}

export function canEquip(member: MemberId, def: ItemDef | undefined): boolean {
  return !!def && def.kind === 'gear' && !!def.slot && (!def.for || def.for.includes(member));
}

/** 從背包裝上（原本那件放回背包）。成功回傳 true。 */
export function equip(s: GameState, member: MemberId, id: string): boolean {
  const m = s.members[member];
  const def = ITEM_DEFS[id];
  if (!m || !canEquip(member, def) || (s.inventory[id] ?? 0) <= 0) return false;
  const slot = def!.slot!;
  const prev = m.equipment[slot];
  take(s, id, 1);
  if (prev) give(s, prev, 1);
  m.equipment[slot] = id;
  return true;
}

export function unequip(s: GameState, member: MemberId, slot: Slot): boolean {
  const m = s.members[member];
  const id = m?.equipment[slot];
  if (!m || !id) return false;
  delete m.equipment[slot];
  give(s, id, 1);
  return true;
}

/** 買價（折扣 %） */
export function buyPrice(id: string, discountPct = 0): number {
  return Math.max(1, Math.round(itemDef(id).price * (1 - discountPct / 100)));
}

/** 賣價：0 = 不能賣（重要物品、非賣品） */
export function sellPrice(id: string): number {
  const d = itemDef(id);
  if (d.kind === 'key' || d.price <= 0) return 0;
  return Math.max(1, Math.floor(d.price * SELL_RATE));
}

export function buy(s: GameState, id: string, discountPct = 0): boolean {
  const p = buyPrice(id, discountPct);
  if (!ITEM_DEFS[id] || ITEM_DEFS[id]!.price <= 0 || s.gold < p) return false;
  s.gold -= p;
  give(s, id, 1);
  return true;
}

export function sell(s: GameState, id: string): boolean {
  const p = sellPrice(id);
  if (p <= 0 || (s.inventory[id] ?? 0) <= 0) return false;
  take(s, id, 1);
  s.gold += p;
  return true;
}

/** 商店貨架（資料順序） */
export function shopStock(shopId: string): string[] {
  return [...(SHOPS[shopId]?.stock ?? SHOPS['ch1_general']!.stock)];
}

/** 背包中可以賣的東西 */
export function sellable(s: GameState): string[] {
  return Object.keys(s.inventory).filter((id) => (s.inventory[id] ?? 0) > 0 && sellPrice(id) > 0);
}

/** 是否持有（背包或身上裝備） */
export function owns(s: GameState, id: string): boolean {
  if ((s.inventory[id] ?? 0) > 0) return true;
  return Object.values(s.members).some((m) => m && Object.values(m.equipment).includes(id));
}

/** 戰鬥上場隊伍（前 3 位）＋裝備加成 */
export function battleParty(s: GameState): { id: HeroId; level: number; bonus: Required<BaseStats> }[] {
  return s.party.slice(0, 3).map((m) => ({ id: m as HeroId, level: s.members[m]?.level ?? 1, bonus: gearBonus(s, m) }));
}

/**
 * 裝備前後的差異（UI 顯示 ▲▼ 用）：換上 id 之後的加成 − 現在的加成
 */
export function gearDelta(s: GameState, member: MemberId, id: string): Required<BaseStats> {
  const def = ITEM_DEFS[id];
  if (!def?.slot) return { hp: 0, atk: 0, def: 0, spd: 0 };
  const eq = s.members[member]?.equipment ?? {};
  const prev = eq[def.slot] ? ITEM_DEFS[eq[def.slot]!]?.bonus ?? {} : {};
  const nb = def.bonus ?? {};
  return {
    hp: (nb.hp ?? 0) - (prev.hp ?? 0),
    atk: (nb.atk ?? 0) - (prev.atk ?? 0),
    def: (nb.def ?? 0) - (prev.def ?? 0),
    spd: (nb.spd ?? 0) - (prev.spd ?? 0),
  };
}

function give(s: GameState, id: string, n: number): void {
  s.inventory[id] = (s.inventory[id] ?? 0) + n;
}
function take(s: GameState, id: string, n: number): void {
  const v = (s.inventory[id] ?? 0) - n;
  if (v <= 0) delete s.inventory[id];
  else s.inventory[id] = v;
}
