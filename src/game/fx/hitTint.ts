// 命中火花的顏色（第三期 Q2，D-335）：照「元素視覺語言」一眼分得出來——
// 火＝橘紅、冰＝淺藍、毒＝紫綠、減速＝灰藍、破甲／虛弱＝淡紫；沒有元素就看武器（劍＝白金、弓＝青白、杖＝紫）。
// 純畫面資料：不影響傷害。
import type { SkillDefinition } from '../../core/battle/rt/types';

export interface HitLook {
  color: number;
  /** 粒子貼圖：火用暖色的 ember，其他用冷白的 spark */
  tex: 'spark' | 'ember';
}

const ELEMENT: Readonly<Record<string, HitLook>> = {
  burn: { color: 0xff7a2a, tex: 'ember' },
  freeze: { color: 0x9fe8ff, tex: 'spark' },
  poison: { color: 0xb46aff, tex: 'spark' },
  slow: { color: 0xa8c8ff, tex: 'spark' },
  weak: { color: 0xd8a8ff, tex: 'spark' },
  break: { color: 0xffe08a, tex: 'spark' },
};

const WEAPON: Readonly<Record<string, HitLook>> = {
  sword: { color: 0xfff0c8, tex: 'spark' },
  bow: { color: 0xc8f4ff, tex: 'spark' },
  staff: { color: 0xc89aff, tex: 'spark' },
};

export const CRIT_LOOK: HitLook = { color: 0xffd05a, tex: 'ember' };

/** 這招帶的第一個狀態（命中段、或格擋反擊） */
export function skillElement(def: SkillDefinition | undefined): string | undefined {
  if (!def) return undefined;
  for (const h of def.hits) if (h.status) return h.status.id;
  return def.block?.counter.status?.id;
}

/** 這一下命中的火花長相：暴擊金色優先，再看招式元素，最後看武器 */
export function hitLook(weapon: string | undefined, def: SkillDefinition | undefined, crit: boolean): HitLook {
  if (crit) return CRIT_LOOK;
  const el = skillElement(def);
  return (el && ELEMENT[el]) || WEAPON[weapon ?? 'sword'] || WEAPON.sword!;
}
