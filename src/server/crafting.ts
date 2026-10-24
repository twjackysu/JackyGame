// 重鑄與分解（design/14 階段 2.5、2.6）。權威邏輯，只依賴注入的 RandomProvider。
import type { RandomProvider } from './ports';
import type { EquipmentInstance } from '../core/state/gear';
import { ITEM_DEFS } from '../data/equipment';
import { AFFIX_COUNT, type GearSlot, type Tier } from '../data/rules';
import { REROLL, rerollCost } from '../data/enhancement';
import { QUICK_SALVAGE_TIERS, SALVAGE } from '../data/lootTables';
import { rollAffixes, type RolledAffix } from './loot';

/** 實例的長尾稀有度；主線舊裝備依模板推算（common→common、rare→rare、legendary(神級)→divine） */
export function tierOf(inst: EquipmentInstance): Tier {
  if (inst.tier) return inst.tier;
  const r = ITEM_DEFS[inst.templateId]?.rarity ?? 'common';
  return r === 'legendary' ? 'divine' : r === 'rare' ? 'rare' : 'common';
}

export function slotTypeOf(inst: EquipmentInstance): GearSlot | undefined {
  const s = ITEM_DEFS[inst.templateId]?.slot;
  return s === 'weapon' || s === 'armor' || s === 'charm' ? s : undefined;
}

export type RerollError = 'no_affixes' | 'bad_locks' | 'pending';

/** 檢查能不能重鑄（不改狀態）；回傳成本或錯誤 */
export function rerollCheck(inst: EquipmentInstance, locks: readonly number[]): { cost: ReturnType<typeof rerollCost> } | { error: RerollError } {
  if (inst.pendingAffixes) return { error: 'pending' };
  const n = AFFIX_COUNT[tierOf(inst)];
  if (n === 0 || !slotTypeOf(inst)) return { error: 'no_affixes' };
  const uniq = new Set(locks);
  if (uniq.size !== locks.length || locks.length > REROLL.maxLocks || locks.length >= n || locks.some((i) => i < 0 || i >= inst.affixes.length)) return { error: 'bad_locks' };
  return { cost: rerollCost(inst.rerolls ?? 0, locks.length) };
}

/**
 * 重鑄：鎖住的詞綴保留，其他重抽，結果放進 pendingAffixes 等玩家決定（固定傳說效果不在 affixes 裡，不會被動到）。
 * 呼叫前要先 rerollCheck 並扣成本。
 */
export function rollReroll(inst: EquipmentInstance, locks: readonly number[], rng: RandomProvider): RolledAffix[] {
  const tier = tierOf(inst);
  const slot = slotTypeOf(inst)!;
  const keep = locks.map((i) => ({ ...inst.affixes[i]! }));
  const next = rollAffixes(slot, tier, rng, AFFIX_COUNT[tier], keep);
  inst.pendingAffixes = next;
  inst.rerolls = (inst.rerolls ?? 0) + 1;
  return next;
}

/** 接受新詞綴，或保留舊詞綴（裝備不會因為重鑄倒退） */
export function settleReroll(inst: EquipmentInstance, accept: boolean): boolean {
  if (!inst.pendingAffixes) return false;
  if (accept) inst.affixes = inst.pendingAffixes;
  delete inst.pendingAffixes;
  return true;
}

/** 分解得到的材料 */
export function salvageYield(inst: EquipmentInstance): Partial<Record<string, number>> {
  const base = SALVAGE[tierOf(inst)];
  // 強化過的多還一點粉塵（強化 +1 一顆）
  return { ...base, mat_dust: (base.mat_dust ?? 0) + Math.max(0, inst.enhancement) };
}

/** 能不能分解：沒穿在身上、沒上鎖、不是重要物品；傳說以上要明確指定（一鍵分解不會動到） */
export function canSalvage(inst: EquipmentInstance, worn: ReadonlySet<string>, quick: boolean): boolean {
  if (worn.has(inst.instanceId) || inst.locked) return false;
  const def = ITEM_DEFS[inst.templateId];
  // 非賣品（舊提燈等劇情鑰匙）永遠不能分解
  if (!def || def.kind !== 'gear' || def.price <= 0) return false;
  if (quick) return QUICK_SALVAGE_TIERS.includes(tierOf(inst));
  return true;
}
