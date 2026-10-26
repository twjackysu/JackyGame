import { WEAPONS, WEAPON_IDS, type WeaponKind } from '../core/battle/rt/data';
import { SPECIAL_SKILLS } from '../core/battle/rt/gear';
// 武器選擇（D-147／152）：劍（預設）、長弓、法杖。存在這台裝置的 localStorage `jg_weapon`，所有大地圖共用；
// 換武器要重新進入地圖（戰鬥中的數值是開場時算好的）。資料一律查 `WEAPONS` 表。
export type WeaponId = WeaponKind;
const STORE = 'jg_weapon';

export const WEAPON_NAME: Record<WeaponId, string> = Object.fromEntries(WEAPON_IDS.map((w) => [w, WEAPONS[w].name])) as Record<WeaponId, string>;

export function isWeapon(x: unknown): x is WeaponId {
  return typeof x === 'string' && (WEAPON_IDS as readonly string[]).includes(x);
}

export function loadWeapon(): WeaponId {
  try {
    const w = localStorage.getItem(STORE);
    return isWeapon(w) ? w : 'sword';
  } catch {
    return 'sword';
  }
}

export function saveWeapon(w: WeaponId): void {
  try {
    localStorage.setItem(STORE, w);
  } catch {
    /* 私密模式等：只在這次有效 */
  }
}

/** 下一種武器（☰／標題的切換按鈕：長劍 → 長弓 → 法杖 → 長劍） */
export function nextWeapon(w: WeaponId): WeaponId {
  return WEAPON_IDS[(WEAPON_IDS.indexOf(w) + 1) % WEAPON_IDS.length] ?? 'sword';
}

/** 給 createBattle 的欄位（劍＝不帶，舊結果完全不變） */
export function weaponSetup(w: WeaponId): 'bow' | 'staff' | undefined {
  return w === 'sword' ? undefined : w;
}

/** 裝備特效顯示用的技能名（長弓／法杖＝自己的招式名） */
export function skillNames(w: WeaponId = loadWeapon()): Record<string, string> {
  if (w === 'sword') return SPECIAL_SKILLS;
  return Object.fromEntries(Object.entries(WEAPONS[w].skills).map(([id, d]) => [id, d.name]));
}

/** 武器欄裝備的顯示名跟著目前武器換字（第 34 輪）：拿長弓撿到「霧鋼劍」顯示成「霧鋼弓」、法杖顯示「霧鋼杖」；存檔裡的名字不變 */
const NOUN: Record<WeaponId, { big: string; one: string } | null> = { sword: null, bow: { big: '長弓', one: '弓' }, staff: { big: '法杖', one: '杖' } };
export function gearName(g: { slot: string; name: string }, w: WeaponId = loadWeapon()): string {
  const n = NOUN[w];
  if (!n || g.slot !== 'weapon') return g.name;
  return g.name.replace(/(大劍|劍)(?=・|$)/, (m) => (m === '大劍' ? n.big : n.one));
}
/** gearTitle 的武器版（含強化 +N） */
export function gearTitleW(g: { slot: string; name: string; enh?: number }, w: WeaponId = loadWeapon()): string {
  return g.enh ? `+${g.enh} ${gearName(g, w)}` : gearName(g, w);
}
