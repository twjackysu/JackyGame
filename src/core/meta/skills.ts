// 技能點（D-110）：每升一級得 1 點，自由點在五個技能上（每個最多 5 級），隨時免費重置。
// 第 141 輪（Q3）從 src/game/rtSkills.ts 搬到 core/meta；伺服器 handler（src/server/handlers/skills.ts）用同一份規則。
// 純資料函式（有測試）；存在霧語森林獨立紀錄 `RtRecord.skills`。效果用核心既有的 SkillMod（和裝備特效相加、照上限截斷）。
import { SKILL_VARIANTS, WEAPONS, variantB, type WeaponKind } from '../battle/rt/data';
import { GUARD_PCT_PER_POINT, SKILL_MOD_CAPS, STATUS_RULES, type SkillDefinition, type SkillMod } from '../battle/rt/types';

export const SKILL_MAX_RANK = 5;

/** 每個技能每一級的效果（說明字給面板用） */
export const SKILL_TREE: readonly { id: string; name: string; per: string; mod: (rank: number) => SkillMod }[] = [
  { id: 'heavy_slash', name: '重斬', per: '傷害 +8%', mod: (r) => ({ dmgPct: 8 * r }) },
  { id: 'whirlwind', name: '旋風斬', per: '範圍 +6%・傷害 +3%', mod: (r) => ({ areaPct: 6 * r, dmgPct: 3 * r }) },
  { id: 'charge', name: '破空劍氣', per: '冷卻 −5%・範圍 +4%', mod: (r) => ({ cdPct: 5 * r, distPct: 4 * r }) },
  { id: 'parry', name: '鐵壁斬', per: '傷害 +6%・每 2 級護盾 +5%', mod: (r) => ({ dmgPct: 6 * r, blockTicks: Math.floor(r / 2) }) },
  { id: 'blade_storm', name: '劍刃風暴', per: '傷害 +8%・冷卻 −3%', mod: (r) => ({ dmgPct: 8 * r, cdPct: 3 * r }) },
];

export type SkillRanks = Record<string, number>;

/**
 * 點到 rank 級時「現在的加成」寫成字（面板用；直接從 mod(rank) 算，和實際套用的數字是同一份）。
 * 0 級回空字串。
 */
export function rankTotalText(id: string, rank: number): string {
  const t = SKILL_TREE.find((x) => x.id === id);
  if (!t || rank <= 0) return '';
  const m = t.mod(Math.min(SKILL_MAX_RANK, rank));
  const out: string[] = [];
  if (m.areaPct) out.push(`範圍 +${m.areaPct}%`);
  if (m.dmgPct) out.push(`傷害 +${m.dmgPct}%`);
  if (m.cdPct) out.push(`冷卻 −${m.cdPct}%`);
  if (m.distPct) out.push(`範圍 +${m.distPct}%`);
  if (m.blockTicks) out.push(`護盾 +${m.blockTicks * GUARD_PCT_PER_POINT}%`);
  return out.join('・');
}

/** 這個修正在這一招上有沒有作用（RF-05b：面板只該寫有作用的；tests/rt-skills 檢查三把武器每一種打法都吃得到技能點的加成） */
export function modApplies(def: SkillDefinition, key: keyof SkillMod): boolean {
  switch (key) {
    case 'cdPct':
      return def.cooldownTicks > 0;
    case 'dmgPct':
      return def.hits.some((h) => h.mult > 0) || (def.block?.counter.mult ?? 0) > 0;
    case 'areaPct':
      return def.hits.length > 0 || !!def.block;
    case 'distPct':
      return def.dash ? def.dash.distance !== 0 : def.hits.length > 0; // D-346：沒有位移的招，距離修正併進範圍
    case 'blockTicks':
      return !!def.block || !!def.guard;
  }
}

/** 這一招附帶的持續傷害狀態（灼燒／中毒）。技能點與裝備的「傷害 +%」只加在直接命中，不加在持續傷害上——面板要講清楚 */
export function dotOf(def: SkillDefinition): 'burn' | 'poison' | null {
  for (const h of [...def.hits, ...(def.block ? [def.block.counter] : [])]) {
    const st = h.status;
    if (st && STATUS_RULES[st.id].dot && (st.powerPct ?? 0) > 0 && (st.id === 'burn' || st.id === 'poison')) return st.id;
  }
  return null;
}

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

/** 存檔裡的變化 id → 技能 id（`heavy_slash:b` → `heavy_slash`） */
const baseOfVariant = (x: string): string => (x.endsWith(':b') ? x.slice(0, -2) : x);

/** 技能變化（D-112／D-121）：只留「有這個變化版、而且這個技能滿 5 級」的 id；同一個技能只留一種；重置或退點後自動失效 */
export function cleanVariants(raw: unknown, r: SkillRanks): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string') continue;
    const base = baseOfVariant(id);
    const ok = id.endsWith(':b') ? !!WEAPONS.sword.variantsB[base] : !!SKILL_VARIANTS[id];
    if (!ok || (r[base] ?? 0) < SKILL_MAX_RANK || seen.has(base)) continue;
    seen.add(base);
    out.push(id);
  }
  return out.sort();
}

/** 這個技能現在選的是哪一種：0＝原招、1＝變化、2＝變化二 */
export function variantIndex(v: readonly string[], id: string): 0 | 1 | 2 {
  return v.includes(id) ? 1 : v.includes(variantB(id)) ? 2 : 0;
}

/** 切換一個技能的變化（原招 → 變化 → 變化二 → 原招；沒有變化二就在兩種之間切）；還沒滿級就回 null */
export function toggleVariant(v: readonly string[], id: string, r: SkillRanks, weapon: WeaponKind | boolean = 'sword'): string[] | null {
  const w = WEAPONS[weapon === true ? 'bow' : weapon === false ? 'sword' : weapon];
  if (!SKILL_VARIANTS[id] || (r[id] ?? 0) < SKILL_MAX_RANK) return null;
  const i = variantIndex(v, id);
  const rest = v.filter((x) => x !== id && x !== variantB(id));
  // 每種武器都有變化二（D-121／149／152）：原招 → 變化 → 變化二 → 原招
  const next = i === 0 ? id : i === 1 && w.variantsB[id] ? variantB(id) : null;
  return (next ? [...rest, next] : rest).sort();
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

/** 直接選一種打法（技能樹面板，D-272）：0＝原招、1＝變化、2＝變化二；沒滿級或沒有那種變化就回 null */
export function setVariant(v: readonly string[], id: string, idx: 0 | 1 | 2, r: SkillRanks, weapon: WeaponKind = 'sword'): string[] | null {
  const w = WEAPONS[weapon];
  if (!SKILL_VARIANTS[id] || (r[id] ?? 0) < SKILL_MAX_RANK) return null;
  if (idx === 2 && !w.variantsB[id]) return null;
  const rest = v.filter((x) => x !== id && x !== variantB(id));
  return (idx === 0 ? rest : [...rest, idx === 1 ? id : variantB(id)]).sort();
}
