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
  /** 同元素的第二、三種圖示（畫面層用：火＝爆炸、光＝回復…；見 effectIcon.ts） */
  glyph?: 1 | 2;
  /** 合用的武器（沒有＝三把都合用） */
  weapons?: readonly WeaponKind[];
  /** 技能修正（加在裝備／技能點的修正上；上限照 SKILL_MOD_CAPS） */
  mods?: Record<string, SkillMod>;
  /** 這趟把某一欄換成變化打法（1＝變化、2＝變化二）：還沒練到滿級也能先試 */
  variant?: { skill: string; idx: 1 | 2 };
  /** 普攻命中：上狀態／每第 n 下在目標處炸開（半徑、倍率 %） */
  onAttack?: { status?: StatusApply; every?: { n: number; burst: EffectBurst } };
  /** 技能命中（skill 沒寫＝任何一欄）：上狀態／追加一段傷害（原本那一段的 echoPct%） */
  onSkillHit?: { skill?: string; status?: StatusApply; echoPct?: number };
  /** 擊殺：屍體處爆炸（半徑、倍率 %）／回復最大 HP 的 healPct% */
  onKill?: { burst?: { r: number; mult: number }; healPct?: number };
  /** 閃避：critTicks 內的下一次直接傷害必定暴擊／起點留下的殘影炸開 */
  onDodge?: { critTicks?: number; burst?: EffectBurst };
  /** 直接傷害暴擊：在目標處炸開，波及「其他」敵人（炸開的傷害不會再觸發） */
  onCrit?: { burst: EffectBurst };
  /** 護盾展開（第 4 欄）：以自己為中心震開 */
  onGuard?: { burst: EffectBurst };
  /** 處決：對生命低於 belowPct% 的敵人，直接傷害 +dmgPct% */
  execute?: { belowPct: number; dmgPct: number };
}
/** 範圍追加傷害：半徑、倍率 %（攻擊力）、可帶狀態 */
export interface EffectBurst {
  r: number;
  mult: number;
  status?: StatusApply;
}

const ALL_SKILLS = ['heavy_slash', 'whirlwind', 'charge', 'parry', 'blade_storm'] as const;

/**
 * 固定效果（三把武器都合用——技能欄 id 三把武器共用）。
 * 第一批 8 個（第 158 輪）＋第二批 6 個（第 163 輪，D-352：一趟最多拿 8 個、池子也只有 8 個＝每趟都拿到同一套，選擇沒有取捨）。
 */
export const EFFECTS: Record<string, EffectDef> = {
  ember_edge: { id: 'ember_edge', name: '餘燼之刃', desc: '普攻讓敵人灼燒 3 秒（可疊 3 層）', element: 'fire', onAttack: { status: { id: 'burn', ticks: sec(3), powerPct: 15 } } },
  ember_burst: { id: 'ember_burst', name: '燼爆', desc: '打倒的敵人會炸開，波及旁邊的敵人', element: 'fire', glyph: 1, onKill: { burst: { r: u(1.8), mult: 90 } } },
  shadow_step: { id: 'shadow_step', name: '影步', desc: '閃避後 3 秒內，下一擊必定暴擊', element: 'dark', onDodge: { critTicks: sec(3) } },
  quick_hands: { id: 'quick_hands', name: '疾雷', desc: '所有技能冷卻 −20%', element: 'thunder', glyph: 1, mods: Object.fromEntries(ALL_SKILLS.map((id) => [id, { cdPct: 20 }])) },
  wide_arc: { id: 'wide_arc', name: '廣域', desc: '「{whirlwind}」範圍 +30%、傷害 +15%', element: 'phys', mods: { whirlwind: { areaPct: 30, dmgPct: 15 } } },
  heavy_echo: { id: 'heavy_echo', name: '回響', desc: '「{heavy_slash}」命中後再補一段 50% 傷害', element: 'light', onSkillHit: { skill: 'heavy_slash', echoPct: 50 } },
  frost_touch: { id: 'frost_touch', name: '霜觸', desc: '技能命中的敵人緩速 2 秒', element: 'ice', onSkillHit: { status: { id: 'slow', ticks: sec(2) } } },
  storm_caller: { id: 'storm_caller', name: '召雷', desc: '每第 4 下普攻落下一道雷，波及周圍', element: 'thunder', onAttack: { every: { n: 4, burst: { r: u(1.6), mult: 160 } } } },
  crit_bloom: { id: 'crit_bloom', name: '綻光', desc: '暴擊時炸開一圈光，波及旁邊的敵人', element: 'light', glyph: 2, onCrit: { burst: { r: u(1.8), mult: 70 } } },
  after_image: { id: 'after_image', name: '殘影', desc: '閃避的起點留下殘影，炸傷追來的敵人', element: 'dark', glyph: 2, onDodge: { burst: { r: u(2), mult: 200 } } },
  guard_pulse: { id: 'guard_pulse', name: '震盾', desc: '放「{parry}」時震傷並緩速周圍', element: 'phys', glyph: 1, onGuard: { burst: { r: u(2.2), mult: 130, status: { id: 'slow', ticks: sec(2) } } } },
  venom_skill: { id: 'venom_skill', name: '蝕毒', desc: '技能命中讓敵人中毒 4 秒（可疊 5 層）', element: 'poison', onSkillHit: { status: { id: 'poison', ticks: sec(4), powerPct: 10 } } },
  executioner: { id: 'executioner', name: '斬首', desc: '對生命低於 30% 的敵人，傷害 +50%', element: 'phys', glyph: 2, execute: { belowPct: 30, dmgPct: 50 } },
  vital_ember: { id: 'vital_ember', name: '燼心', desc: '每打倒一隻敵人，回復 5% 生命', element: 'light', glyph: 1, onKill: { healPct: 5 } },
};
export const EFFECT_IDS: readonly string[] = Object.keys(EFFECTS);

/** 「這趟試用變化打法」的效果 id（動態產生：五欄 × 兩種變化） */
export const tryVariantId = (skill: string, idx: 1 | 2): string => `try:${skill}:${idx}`;

const resolved = new Map<string, EffectDef | undefined>();
/** 查效果（依武器把說明裡的 {技能欄 id} 換成那把武器的招式名）；結果有快取，不要改回傳的物件 */
export function effectDef(id: string, weapon: WeaponKind = 'sword'): EffectDef | undefined {
  const key = `${weapon}:${id}`;
  if (resolved.has(key)) return resolved.get(key);
  const d = buildEffect(id, weapon);
  resolved.set(key, d);
  return d;
}

function buildEffect(id: string, weapon: WeaponKind): EffectDef | undefined {
  if (!id.startsWith('try:')) {
    const d = EFFECTS[id];
    return d && { ...d, desc: d.desc.replace(/\{(\w+)\}/g, (m, skill: string) => WEAPONS[weapon].skills[skill]?.name ?? m) };
  }
  const [, skill, k] = id.split(':');
  const idx = k === '1' ? 1 : k === '2' ? 2 : 0;
  if (!skill || !idx) return undefined;
  const w = WEAPONS[weapon];
  const alt = (idx === 1 ? w.variants : w.variantsB)[skill];
  const base = w.skills[skill];
  if (!alt || !base) return undefined;
  return { id, name: `試招・${alt.variantName}`, desc: `「${base.name}」這趟改用：${alt.desc}`, element: 'dark', glyph: 1, variant: { skill, idx } };
}

/**
 * 祝福的節奏：第 n 個祝福要累積幾點（小怪 1、精英 2、Boss 5）；一趟最多幾個；重抽次數。
 * 第 162 輪（D-351）3／5／7／8／9／10 → 3／4／5／5／6／6：用「五欄自動、只管走位」的 Bot 在霧語森林量 10 分鐘（三把武器 × 3 種子），
 * 舊門檻第三個之後要等 100～250 秒才有下一次選擇（目標 40～90 秒）；新門檻大多落在 30～100 秒。
 */
export const BLESS_RULES = { need: [3, 4, 5, 5, 6, 6], max: 8, rerolls: 1, choices: 3 } as const;
export const blessNeed = (taken: number): number => BLESS_RULES.need[Math.min(taken, BLESS_RULES.need.length - 1)]!;

/**
 * 蓋著的牌（D-383；Jacky 11/12「賭博的形式用在其他方式」）：三選一下面多一張翻開才知道的牌。
 * from＝身上已經有幾個祝福才開始出現（第一手不出：新玩家先看懂三選一）；
 * doublePct＝一次兩個祝福、cursedPct＝一個祝福＋一道燼痕、其餘＝一個祝福；翻出來的都不是檯面上那三張。
 * 燼痕：這趟被敵人打到的傷害 +cursePct%（可疊，最多 curseMax 層；和祝福一起消散）。
 * on＝false 就整個關掉（不出牌、gamble 指令無效）。
 */
export const BLESS_GAMBLE = { on: true, from: 1, doublePct: 35, cursedPct: 30, cursePct: 20, curseMax: 3 } as const;
/** 燼痕讓主角多吃幾 % 傷害 */
export const gambleCursePct = (stacks: number): number => Math.max(0, Math.min(BLESS_GAMBLE.curseMax, stacks)) * BLESS_GAMBLE.cursePct;

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
