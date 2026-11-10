// 效果池（第三期 P2／P3 共用，D-343）：資料驅動的「會改變打法的效果」。
// P2 燼火祝福＝這趟暫時擁有（回營火休息或倒下就清空）；P3 獨特效果裝備＝永久擁有；兩邊從這一池取用。
// 這裡只有資料與純函式；結算在 engine.ts（畫面層只讀事件演出）。
import { WEAPONS, type WeaponKind } from './data';
import { sec, u, type SkillMod, type StatusApply } from './types';

/** 視覺語言（工程原則的元素表）：畫面層照這個挑顏色與粒子 */
export type EffectElement = 'fire' | 'ice' | 'thunder' | 'poison' | 'phys' | 'light' | 'dark';

export interface EffectDef {
  id: string;
  name: string;
  /** 一句話、手機上看得完 */
  desc: string;
  element: EffectElement;
  /** 合用的武器（沒有＝三把都合用） */
  weapons?: readonly WeaponKind[];
  /** 技能修正（加在裝備／技能點的修正上；上限照 SKILL_MOD_CAPS） */
  mods?: Record<string, SkillMod>;
  /** 這趟把某一欄換成變化打法（1＝變化、2＝變化二）：還沒練到滿級也能先試 */
  variant?: { skill: string; idx: 1 | 2 };
  /** 普攻命中：上狀態 */
  onAttack?: { status: StatusApply };
  /** 技能命中（skill 沒寫＝任何一欄）：上狀態／追加一段傷害（原本那一段的 echoPct%） */
  onSkillHit?: { skill?: string; status?: StatusApply; echoPct?: number };
  /** 擊殺：屍體處爆炸（半徑、倍率 %）／回復最大 HP 的 healPct% */
  onKill?: { burst?: { r: number; mult: number }; healPct?: number };
  /** 閃避後 critTicks 內的下一次直接傷害必定暴擊 */
  onDodge?: { critTicks: number };
}

const ALL_SKILLS = ['heavy_slash', 'whirlwind', 'charge', 'parry', 'blade_storm'] as const;

/** 固定效果（第一批 8 個，三把武器都合用——技能欄 id 三把武器共用） */
export const EFFECTS: Record<string, EffectDef> = {
  ember_edge: { id: 'ember_edge', name: '餘燼之刃', desc: '普攻讓敵人灼燒 3 秒（可疊 3 層）', element: 'fire', onAttack: { status: { id: 'burn', ticks: sec(3), powerPct: 20 } } },
  ember_burst: { id: 'ember_burst', name: '燼爆', desc: '打倒的敵人會炸開，波及旁邊的敵人', element: 'fire', onKill: { burst: { r: u(1.8), mult: 90 } } },
  shadow_step: { id: 'shadow_step', name: '影步', desc: '閃避後 3 秒內，下一擊必定暴擊', element: 'dark', onDodge: { critTicks: sec(3) } },
  quick_hands: { id: 'quick_hands', name: '疾雷', desc: '所有技能冷卻 −20%', element: 'thunder', mods: Object.fromEntries(ALL_SKILLS.map((id) => [id, { cdPct: 20 }])) },
  wide_arc: { id: 'wide_arc', name: '廣域', desc: '第二欄的範圍技：範圍 +30%、傷害 +15%', element: 'phys', mods: { whirlwind: { areaPct: 30, dmgPct: 15 } } },
  heavy_echo: { id: 'heavy_echo', name: '回響', desc: '第一欄的技能命中後，再補一段 50% 的傷害', element: 'light', onSkillHit: { skill: 'heavy_slash', echoPct: 50 } },
  frost_touch: { id: 'frost_touch', name: '霜觸', desc: '技能命中的敵人緩速 2 秒', element: 'ice', onSkillHit: { status: { id: 'slow', ticks: sec(2) } } },
  vital_ember: { id: 'vital_ember', name: '燼心', desc: '每打倒一隻敵人，回復 5% 生命', element: 'light', onKill: { healPct: 5 } },
};
export const EFFECT_IDS: readonly string[] = Object.keys(EFFECTS);

/** 「這趟試用變化打法」的效果 id（動態產生：五欄 × 兩種變化） */
export const tryVariantId = (skill: string, idx: 1 | 2): string => `try:${skill}:${idx}`;

/** 查效果；`try:` 開頭的依武器產生（名稱與說明用那把武器的變化打法） */
export function effectDef(id: string, weapon: WeaponKind = 'sword'): EffectDef | undefined {
  if (!id.startsWith('try:')) return EFFECTS[id];
  const [, skill, k] = id.split(':');
  const idx = k === '1' ? 1 : k === '2' ? 2 : 0;
  if (!skill || !idx) return undefined;
  const w = WEAPONS[weapon];
  const alt = (idx === 1 ? w.variants : w.variantsB)[skill];
  const base = w.skills[skill];
  if (!alt || !base) return undefined;
  return { id, name: `試招・${alt.variantName}`, desc: `這趟「${base.name}」改用「${alt.variantName}」`, element: 'dark', variant: { skill, idx } };
}

/** 祝福的節奏（P2 小樣；實測後再調）：第 n 個祝福要累積幾點（小怪 1、精英 2、Boss 5）；一趟最多幾個；重抽次數 */
export const BLESS_RULES = { need: [3, 5, 7, 8, 9, 10], max: 8, rerolls: 1, choices: 3 } as const;
export const blessNeed = (taken: number): number => BLESS_RULES.need[Math.min(taken, BLESS_RULES.need.length - 1)]!;

/** 把效果的技能修正疊到基礎修正上（不改原物件；上限由使用的地方照 SKILL_MOD_CAPS 夾） */
export function mergeEffectMods(base: Record<string, SkillMod> | undefined, effects: readonly EffectDef[]): Record<string, SkillMod> | undefined {
  let out: Record<string, SkillMod> | undefined;
  for (const e of effects) {
    if (!e.mods) continue;
    out ??= { ...(base ?? {}) };
    for (const [skill, m] of Object.entries(e.mods)) {
      const cur: SkillMod = { ...(out[skill] ?? {}) };
      for (const k of Object.keys(m) as (keyof SkillMod)[]) cur[k] = (cur[k] ?? 0) + (m[k] ?? 0);
      out[skill] = cur;
    }
  }
  return out ?? base;
}
