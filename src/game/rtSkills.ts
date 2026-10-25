// 技能點（D-110）：每升一級得 1 點，自由點在五個技能上（每個最多 5 級），隨時免費重置。
// 純資料函式（有測試）；存在霧語森林獨立紀錄 `RtRecord.skills`。效果用核心既有的 SkillMod（和裝備特效相加、照上限截斷）。
import { SKILL_VARIANTS } from '../core/battle/rt/data';
import { SKILL_MOD_CAPS, type SkillMod } from '../core/battle/rt/types';

export const SKILL_MAX_RANK = 5;

/** 每個技能每一級的效果（說明字給面板用） */
export const SKILL_TREE: readonly { id: string; name: string; per: string; mod: (rank: number) => SkillMod }[] = [
  { id: 'heavy_slash', name: '重斬', per: '傷害 +8%', mod: (r) => ({ dmgPct: 8 * r }) },
  { id: 'whirlwind', name: '旋風斬', per: '範圍 +6%・傷害 +3%', mod: (r) => ({ areaPct: 6 * r, dmgPct: 3 * r }) },
  { id: 'charge', name: '衝鋒', per: '冷卻 −5%・距離 +4%', mod: (r) => ({ cdPct: 5 * r, distPct: 4 * r }) },
  { id: 'parry', name: '格擋反擊', per: '反擊傷害 +6%・每 2 級判定 +1 tick', mod: (r) => ({ dmgPct: 6 * r, blockTicks: Math.floor(r / 2) }) },
  { id: 'blade_storm', name: '劍刃風暴', per: '傷害 +8%・冷卻 −3%', mod: (r) => ({ dmgPct: 8 * r, cdPct: 3 * r }) },
];

export type SkillRanks = Record<string, number>;

/** 這個等級總共有幾點 */
export function skillPoints(level: number): number {
  return Math.max(0, Math.floor(level) - 1);
}

export function usedPoints(r: SkillRanks): number {
  return Object.values(r).reduce((n, v) => n + v, 0);
}

/** 讀檔檢查：未知技能丟掉、每個 0～5、總數超過等級的點數就全部退回 */
export function cleanRanks(raw: unknown, level: number): SkillRanks {
  const out: SkillRanks = {};
  const r = (raw ?? {}) as Record<string, unknown>;
  for (const t of SKILL_TREE) {
    const v = r[t.id];
    if (Number.isInteger(v) && (v as number) > 0) out[t.id] = Math.min(SKILL_MAX_RANK, v as number);
  }
  return usedPoints(out) > skillPoints(level) ? {} : out;
}

/** 點一級；不行（沒點數、已滿、沒這個技能）就回 null */
export function addRank(r: SkillRanks, id: string, level: number): SkillRanks | null {
  if (!SKILL_TREE.some((t) => t.id === id)) return null;
  if ((r[id] ?? 0) >= SKILL_MAX_RANK || usedPoints(r) >= skillPoints(level)) return null;
  return { ...r, [id]: (r[id] ?? 0) + 1 };
}

/** 技能變化（D-112）：只留「有變化版、而且這個技能滿 5 級」的 id；重置或退點後自動失效 */
export function cleanVariants(raw: unknown, r: SkillRanks): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && !!SKILL_VARIANTS[id] && (r[id] ?? 0) >= SKILL_MAX_RANK))].sort();
}

/** 切換一個技能的變化；還沒滿級就回 null */
export function toggleVariant(v: readonly string[], id: string, r: SkillRanks): string[] | null {
  if (!SKILL_VARIANTS[id] || (r[id] ?? 0) < SKILL_MAX_RANK) return null;
  return v.includes(id) ? v.filter((x) => x !== id) : [...v, id].sort();
}

export function rankMods(r: SkillRanks): Record<string, SkillMod> {
  const out: Record<string, SkillMod> = {};
  for (const t of SKILL_TREE) if (r[t.id]) out[t.id] = t.mod(r[t.id]!);
  return out;
}

/** 兩組技能修正相加（裝備＋技能點），照 SKILL_MOD_CAPS 截斷 */
export function mergeMods(a: Record<string, SkillMod>, b: Record<string, SkillMod>): Record<string, SkillMod> {
  const out: Record<string, SkillMod> = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id] ?? {};
    const y = b[id] ?? {};
    const m: SkillMod = {};
    const add = (k: keyof SkillMod, cap?: number): void => {
      const v = (x[k] ?? 0) + (y[k] ?? 0);
      if (v) m[k] = cap === undefined ? v : Math.min(cap, v);
    };
    add('cdPct', SKILL_MOD_CAPS.cdPct);
    add('dmgPct');
    add('areaPct', SKILL_MOD_CAPS.areaPct);
    add('blockTicks', SKILL_MOD_CAPS.blockTicks);
    add('distPct', SKILL_MOD_CAPS.distPct);
    if (Object.keys(m).length) out[id] = m;
  }
  return out;
}
