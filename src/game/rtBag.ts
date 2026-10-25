// 即時戰鬥行囊的純資料函式（D-091；有測試）。畫面在 ui/rtBagPanel.ts。
import { SWORDSMAN } from '../core/battle/rt/data';
import type { SkillMod } from '../core/battle/rt/types';
import { GEAR_SLOTS, gearBonus, gearScore, gearSkillMods, genGear, salvageDust, type GearSlot, type RtGear } from '../core/battle/rt/gear';

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

/** 身上最弱的部位（第 25 輪行商「為你挑選」）：每格分數 ÷ 同物品等級精良參考裝的分數，空格＝0；同分取前面的部位 */
export function weakestSlot(st: BagState, ilvl: number): GearSlot {
  let best: GearSlot = GEAR_SLOTS[0]!;
  let low = Infinity;
  for (const s of GEAR_SLOTS) {
    const ref = gearScore(genGear(7, 2, ilvl, { slot: s }), SWORDSMAN.hp, SWORDSMAN.atk) || 1;
    const r = gearScore(st.equip[s], SWORDSMAN.hp, SWORDSMAN.atk) / ref;
    if (r < low) {
      low = r;
      best = s;
    }
  }
  return best;
}

/** 背包裡比身上同部位好的（▲） */
export function isUpgrade(st: BagState, g: RtGear): boolean {
  return gearScore(g, SWORDSMAN.hp, SWORDSMAN.atk) > gearScore(st.equip[g.slot], SWORDSMAN.hp, SWORDSMAN.atk);
}


/** 身上裝備的技能特效合計（D-094） */
export function skillModsOf(st: BagState): Record<string, SkillMod> {
  return gearSkillMods(GEAR_SLOTS.map((s) => st.equip[s]));
}

/**
 * 撿到裝備但行囊滿了（D-100）：自動分解「最差的普通裝備」騰出位置。
 * 候選＝行囊裡的普通裝＋新撿到的（新的是普通才算）；比身上同部位好的（▲）不分解。
 * 回傳新的行囊、被分解的那件（可能就是新撿的）與得到的粉塵；沒得分解 → null（照舊提示行囊滿了）。
 */
export function addWithAutoSalvage(st: BagState, g: RtGear): { st: BagState; salvaged: RtGear | null; dust: number } | null {
  if (st.bag.length < BAG_MAX) return { st: { ...st, bag: [g, ...st.bag] }, salvaged: null, dust: 0 };
  const sc = (x: RtGear) => gearScore(x, SWORDSMAN.hp, SWORDSMAN.atk);
  const cands = [...st.bag, g].filter((x) => x.rarity === 1 && !(x.enh ?? 0) && !isUpgrade(st, x));
  if (!cands.length) return null;
  let worst = cands[0]!;
  for (const x of cands) if (sc(x) < sc(worst)) worst = x;
  const bag = worst.uid === g.uid ? st.bag : [g, ...st.bag.filter((x) => x.uid !== worst.uid)];
  return { st: { ...st, bag }, salvaged: worst, dust: salvageDust(worst) };
}
