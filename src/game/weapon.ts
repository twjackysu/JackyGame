import { BOW_SKILLS } from '../core/battle/rt/data';
import { SPECIAL_SKILLS } from '../core/battle/rt/gear';
// 武器選擇（D-147）：劍（預設）或長弓。存在這台裝置的 localStorage `jg_weapon`，所有大地圖共用；
// 換武器要重新進入地圖（戰鬥中的數值是開場時算好的）。
export type WeaponId = 'sword' | 'bow';
const STORE = 'jg_weapon';

export const WEAPON_NAME: Record<WeaponId, string> = { sword: '長劍', bow: '長弓' };

export function loadWeapon(): WeaponId {
  try {
    return localStorage.getItem(STORE) === 'bow' ? 'bow' : 'sword';
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

/** 給 createBattle 的欄位（劍＝不帶，舊結果完全不變） */
export function weaponSetup(w: WeaponId): 'bow' | undefined {
  return w === 'bow' ? 'bow' : undefined;
}

/** 裝備特效顯示用的技能名（長弓＝弓的招式名） */
export function skillNames(w: WeaponId = loadWeapon()): Record<string, string> {
  if (w === 'sword') return SPECIAL_SKILLS;
  return Object.fromEntries(Object.entries(BOW_SKILLS).map(([id, d]) => [id, d.name]));
}
