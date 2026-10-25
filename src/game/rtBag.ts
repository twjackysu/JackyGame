// 即時戰鬥行囊的純資料函式（D-091；有測試）。畫面在 ui/rtBagPanel.ts。
import { SWORDSMAN } from '../core/battle/rt/data';
import type { SkillMod } from '../core/battle/rt/types';
import { GEAR_SLOTS, gearBonus, gearScore, gearSkillMods, type GearSlot, type RtGear } from '../core/battle/rt/gear';

export interface BagState {
  bag: RtGear[];
  equip: Partial<Record<GearSlot, RtGear>>;
}

export const BAG_MAX = 60;

/** 換上 g 之後的身上組合 */
export function equipWith(st: BagState, g: RtGear): BagState {
  const old = st.equip[g.slot];
  const bag = st.bag.filter((x) => x.uid !== g.uid);
  if (old) bag.unshift(old);
  return { bag, equip: { ...st.equip, [g.slot]: g } };
}

export function unequip(st: BagState, slot: GearSlot): BagState {
  const old = st.equip[slot];
  if (!old || st.bag.length >= BAG_MAX) return st;
  const equip = { ...st.equip };
  delete equip[slot];
  return { bag: [old, ...st.bag], equip };
}

export function bonusOf(st: BagState): { hp: number; atk: number; def: number } {
  return gearBonus(GEAR_SLOTS.map((s) => st.equip[s]), SWORDSMAN.hp, SWORDSMAN.atk);
}

/** 背包裡比身上同部位好的（▲） */
export function isUpgrade(st: BagState, g: RtGear): boolean {
  return gearScore(g, SWORDSMAN.hp, SWORDSMAN.atk) > gearScore(st.equip[g.slot], SWORDSMAN.hp, SWORDSMAN.atk);
}


/** 身上裝備的技能特效合計（D-094） */
export function skillModsOf(st: BagState): Record<string, SkillMod> {
  return gearSkillMods(GEAR_SLOTS.map((s) => st.equip[s]));
}
