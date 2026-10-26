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
