// 裝備、買賣（純邏輯，不 import phaser）。資料：src/data/equipment.ts。
import { statsAtLevel, type BaseStats } from '../battle/formulas';
import { HEROES } from '../../data/combatants';
import { treeEffect, treeSkills } from './skillTree';
import type { HeroId } from '../battle/skills';
import { ITEM_DEFS, SHOPS, itemDef, type ItemDef } from '../../data/equipment';
import { EQUIP_SLOTS, slotType, type EquipSlot } from '../../data/rules';
import { enhanceMultiplier } from '../../data/enhancement';
import type { GameState, MemberId } from './gameState';
import type { Perk } from '../battle/engine';
import { addItem, bagCount, bagIds, freeInstances, hasTemplate, isGearTemplate, templateOf, type GearOrigin } from './gear';

export const SELL_RATE = 0.5;

/** 某位成員所有已裝備物品的數值加總 */
export function gearBonus(s: GameState, member: MemberId): Required<BaseStats> {
  const out = { hp: 0, atk: 0, def: 0, spd: 0 };
  const eq = s.members[member]?.equipment ?? {};
  for (const slot of EQUIP_SLOTS) {
    const inst = eq[slot] ? s.gear[eq[slot]!] : undefined;
    const b = inst ? ITEM_DEFS[inst.templateId]?.bonus : undefined;
    if (!b || !inst) continue;
    // 強化只放大基礎數值（不複利；SPD 不受強化影響）
    const k = enhanceMultiplier(inst.enhancement);
    out.hp += Math.round((b.hp ?? 0) * k);
    out.atk += Math.round((b.atk ?? 0) * k);
    out.def += Math.round((b.def ?? 0) * k);
    out.spd += b.spd ?? 0;
  }
  return out;
}

export function canEquip(member: MemberId, def: ItemDef | undefined): boolean {
  return !!def && def.kind === 'gear' && !!def.slot && (!def.for || def.for.includes(member));
}

/** 某成員某欄位穿著的裝備模板 id */
export function wornTemplate(s: GameState, member: MemberId, slot: EquipSlot): string | undefined {
  return templateOf(s, s.members[member]?.equipment[slot]);
}

/** 某成員身上有沒有穿這個模板（任何欄位） */
export function wears(s: GameState, member: MemberId, templateId: string): boolean {
  return EQUIP_SLOTS.some((sl) => wornTemplate(s, member, sl) === templateId);
}

/** 模板可以放的欄位（飾品有 2 格） */
export function slotsFor(templateId: string): EquipSlot[] {
  const t = ITEM_DEFS[templateId]?.slot;
  return t ? EQUIP_SLOTS.filter((sl) => slotType(sl) === t) : [];
}

/** 換上這個模板會放進哪一格：指定的格子（合法時）→ 第一個空格 → 第一格 */
export function targetSlot(s: GameState, member: MemberId, templateId: string, prefer?: EquipSlot): EquipSlot | undefined {
  const opts = slotsFor(templateId);
  if (prefer && opts.includes(prefer)) return prefer;
  const eq = s.members[member]?.equipment ?? {};
  return opts.find((sl) => !eq[sl]) ?? opts[0];
}

/**
 * 從背包裝上（原本那件自動回到背包）。`ref` 可以是 instanceId，或模板 id（取背包裡第一件）。成功回傳 true。
 */
export function equip(s: GameState, member: MemberId, ref: string, slot?: EquipSlot): boolean {
  const m = s.members[member];
  const inst = s.gear[ref] ?? freeInstances(s, ref)[0];
  if (!m || !inst) return false;
  const def = ITEM_DEFS[inst.templateId];
  if (!canEquip(member, def)) return false;
  // 已經穿在別人身上的實例不能直接搶
  for (const other of Object.values(s.members)) if (other && Object.values(other.equipment).includes(inst.instanceId)) return false;
  const to = targetSlot(s, member, inst.templateId, slot);
  if (!to) return false;
  m.equipment[to] = inst.instanceId;
  return true;
}

export function unequip(s: GameState, member: MemberId, slot: EquipSlot): boolean {
  const m = s.members[member];
  if (!m || !m.equipment[slot]) return false;
  delete m.equipment[slot]; // 實例仍在 s.gear → 回到背包
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
  if (!ITEM_DEFS[id] || ITEM_DEFS[id]!.price <= 0 || (ITEM_DEFS[id]!.rarity ?? 'common') !== 'common' || s.gold < p) return false;
  s.gold -= p;
  give(s, id, 1, 'shop');
  return true;
}

export function sell(s: GameState, id: string): boolean {
  const p = sellPrice(id);
  if (p <= 0 || bagCount(s, id) <= 0) return false;
  if (isGearTemplate(id) && !freeInstances(s, id).some((g) => !g.locked)) return false; // 上鎖的不能賣
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
  return bagIds(s).filter((id) => sellPrice(id) > 0);
}

/** 是否持有（背包或身上裝備） */
export function owns(s: GameState, id: string): boolean {
  return hasTemplate(s, id);
}

/** 裝備＋技能樹的總加成（技能樹的 % 以等級基礎數值計算） */
export function totalBonus(s: GameState, m: MemberId): Required<BaseStats> {
  const g = gearBonus(s, m);
  const t = treeEffect(s, m);
  const base = statsAtLevel(HEROES[m].base, s.members[m]?.level ?? 1);
  return {
    hp: g.hp + Math.round((base.hp * t.hpPct) / 100),
    atk: g.atk + Math.round((base.atk * t.atkPct) / 100),
    def: g.def + Math.round((base.def * t.defPct) / 100),
    spd: g.spd + t.spd,
  };
}

/** 戰鬥上場隊伍（前 3 位）＋裝備與技能樹加成 */
export function battleParty(s: GameState): { id: HeroId; level: number; bonus: Required<BaseStats>; startSp: number; startEmber: number; perks: Perk[]; skills: string[] }[] {
  return s.party.slice(0, 3).map((m) => {
    const t = treeEffect(s, m);
    return { id: m as HeroId, level: s.members[m]?.level ?? 1, bonus: totalBonus(s, m), startSp: t.startSp, startEmber: t.startEmber, perks: gearPerks(s, m), skills: treeSkills(s, m) };
  });
}

/** 身上神級裝備的特效 */
export function gearPerks(s: GameState, member: MemberId): Perk[] {
  const eq = s.members[member]?.equipment ?? {};
  const out: Perk[] = [];
  for (const slot of EQUIP_SLOTS) {
    const t = templateOf(s, eq[slot]);
    const p = t ? ITEM_DEFS[t]?.perk : undefined;
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** 把掉落寫進背包，並設定 Boss 首殺旗標 */
export function grantDrops(s: GameState, items: readonly string[], defeated: readonly string[]): void {
  for (const id of items) give(s, id, 1, 'drop');
  for (const e of defeated) if (e.startsWith('boss_')) s.flags[`kill_${e}`] = true;
  for (const id of items) s.flags[`seen_${id}`] = true;
}

/**
 * 裝備前後的差異（UI 顯示 ▲▼ 用）：換上 id 之後的加成 − 現在的加成
 */
export function gearDelta(s: GameState, member: MemberId, id: string, slot?: EquipSlot): Required<BaseStats> {
  const def = ITEM_DEFS[id];
  const to = targetSlot(s, member, id, slot);
  if (!def?.slot || !to) return { hp: 0, atk: 0, def: 0, spd: 0 };
  const curId = s.members[member]?.equipment[to];
  const curInst = curId ? s.gear[curId] : undefined;
  const k = enhanceMultiplier(curInst?.enhancement ?? 0);
  const pb = curInst ? ITEM_DEFS[curInst.templateId]?.bonus ?? {} : {};
  const prev = { hp: Math.round((pb.hp ?? 0) * k), atk: Math.round((pb.atk ?? 0) * k), def: Math.round((pb.def ?? 0) * k), spd: pb.spd ?? 0 };
  const nb = def.bonus ?? {};
  return {
    hp: (nb.hp ?? 0) - (prev.hp ?? 0),
    atk: (nb.atk ?? 0) - (prev.atk ?? 0),
    def: (nb.def ?? 0) - (prev.def ?? 0),
    spd: (nb.spd ?? 0) - (prev.spd ?? 0),
  };
}

function give(s: GameState, id: string, n: number, origin: GearOrigin = 'story'): void {
  addItem(s, id, n, origin);
}
function take(s: GameState, id: string, n: number): void {
  addItem(s, id, -n);
}
