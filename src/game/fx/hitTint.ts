// 命中火花的顏色（第三期 Q2，D-335）：照「元素視覺語言」一眼分得出來——
// 火＝橘紅、冰＝淺藍、毒＝紫綠、減速＝灰藍、破甲／虛弱＝淡紫；沒有元素就看武器（劍＝白金、弓＝青白、杖＝紫）。
// 純畫面資料：不影響傷害。
import type { SkillDefinition, SkillHit } from '../../core/battle/rt/types';

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

/** 小冷卻圖示的底色與外框（第 165 輪）：五顆以前全是同一種棕色，冷卻中只剩數字，分不出哪顆是哪招 */
export interface BadgeLook {
  fill: number;
  rim: number;
  /** 冷卻中的外框（同色相、暗一階） */
  dim: number;
}

/** 元素鮮明的招用元素色（和 effectIcon 的 ELEMENT_LOOK 同一套語言）：火橘、冰青、毒綠；減速／破甲這類附帶效果不算 */
const BADGE_STATUS: Readonly<Record<string, number>> = { burn: 0xff7a2c, freeze: 0x4ad0ff, poison: 0x8ad838 };
/** 其餘照技能欄固定一色，色相拉開：第一欄金、第二欄青綠、第三欄紫、護盾欄銀白、大招粉紅 */
const BADGE_SLOT: Readonly<Record<string, number>> = { heavy_slash: 0xf0c050, whirlwind: 0x40c890, charge: 0x9a7aff, parry: 0xdfe6f2, blade_storm: 0xff7ad0 };

/** 把顏色壓暗成底色（保留色相，亮度約三成） */
function shade(c: number, k: number): number {
  const r = Math.round(((c >> 16) & 255) * k);
  const g = Math.round(((c >> 8) & 255) * k);
  const b = Math.round((c & 255) * k);
  return (r << 16) | (g << 8) | b;
}

/** slot＝技能欄 id（heavy_slash／whirlwind／charge／parry／blade_storm；換打法後 def.id 會變，欄位 id 不變） */
export function skillBadge(slot: string, def: SkillDefinition | undefined): BadgeLook {
  // 護盾招的「打一下」常帶狀態，但玩家認它是護盾 → 一律用護盾欄的顏色
  // 第三欄也固定用自己的顏色：它的變化常和第一欄同元素（法杖的冰槍＋寒霜結界），兩顆會撞色
  const el = def?.guard || slot === 'charge' ? undefined : skillElement(def);
  const rim = (el && BADGE_STATUS[el]) || BADGE_SLOT[slot] || BADGE_SLOT.heavy_slash!;
  return { fill: shade(rim, 0.3), rim, dim: shade(rim, 0.6) };
}

/**
 * 長弓直線箭的長相（第 166 輪）：原招的穿雲箭／縛足箭／風障射擊以前是同一條白線，連放時分不出誰是誰。
 * 照資料分（不寫招式 id）：護盾招＝guard（和風障同色）、帶減速的＝snare（翠綠＋命中的怪腳下繩環）、沒帶狀態的重箭＝pierce（白金＋音爆環）。
 * 大招與其他元素（火／毒／冰／破甲）照原本的顏色，回 undefined。
 */
export function bowLineLook(def: SkillDefinition, hit: Pick<SkillHit, 'mult' | 'status' | 'shape'>): 'pierce' | 'snare' | 'guard' | undefined {
  if (hit.shape.type !== 'line' || def.role === 'ult') return undefined;
  if (def.guard) return hit.status ? undefined : 'guard';
  if (hit.status?.id === 'slow') return 'snare';
  if (!hit.status && hit.mult >= 150) return 'pierce';
  return undefined;
}
