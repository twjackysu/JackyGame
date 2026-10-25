// 即時戰鬥的裝備（P4-2，D-091）：純資料與純函式，不依賴 Phaser。
// 掉落「有沒有、什麼稀有度、物品等級」由核心決定（獨立掉落亂數，不影響戰鬥）；撿到後用 (種子) 產生實際裝備。
import type { SkillMod } from './types';
import { SKILL_MOD_CAPS } from './types';

export type GearSlot = 'weapon' | 'head' | 'body' | 'hands' | 'ring' | 'amulet';
export const GEAR_SLOTS: GearSlot[] = ['weapon', 'head', 'body', 'hands', 'ring', 'amulet'];
export const SLOT_NAME: Record<GearSlot, string> = { weapon: '武器', head: '頭盔', body: '鎧甲', hands: '護手', ring: '戒指', amulet: '項鍊' };

export type Rarity = 1 | 2 | 3;
export const RARITY_NAME: Record<Rarity, string> = { 1: '普通', 2: '精良', 3: '稀有' };
export const RARITY_COLOR: Record<Rarity, number> = { 1: 0xd8d8d8, 2: 0x6ab0ff, 3: 0xffc040 };

export type AffixStat = 'atk' | 'hp' | 'def' | 'atkPct' | 'hpPct';
export const AFFIX_NAME: Record<AffixStat, string> = { atk: '攻擊', hp: 'HP', def: '防禦', atkPct: '攻擊', hpPct: 'HP' };
const AFFIX_PREFIX: Record<AffixStat, string> = { atk: '鋒利的', hp: '厚實的', def: '堅固的', atkPct: '嗜血的', hpPct: '強韌的' };

export interface RtGear {
  uid: string;
  slot: GearSlot;
  rarity: Rarity;
  /** 物品等級：越深的地區、越強的怪越高 */
  ilvl: number;
  name: string;
  base: { atk?: number; hp?: number; def?: number };
  affixes: { stat: AffixStat; value: number }[];
  /** 強化等級（營火旁強化，D-092）；每級底數值 +10% */
  enh?: number;
  /** 稀有裝備的技能特效（D-094、D-098）：冷卻 −%、傷害 +%、範圍 +%、格擋窗口 +ticks、衝鋒距離 +% */
  special?: { skill: string; kind: SpecialKind; value: number };
  /** 深夜掉的稀有（D-108）：三條詞綴、名字「夜燼・…」 */
  night?: boolean;
}

export type SpecialKind = 'cd' | 'dmg' | 'area' | 'block' | 'dist';
/** 每個技能可以抽到的特效種類（第三種是「參數型」，D-098） */
export const SPECIAL_KINDS: Record<string, SpecialKind[]> = {
  heavy_slash: ['cd', 'dmg', 'area'],
  whirlwind: ['cd', 'dmg', 'area'],
  charge: ['cd', 'dmg', 'dist'],
  parry: ['cd', 'dmg', 'block'],
  blade_storm: ['cd', 'dmg', 'area'],
};

/** 精良裝備帶（減半）技能特效的機率（%，D-106） */
export const PRO_SPECIAL_PCT = 35;

/** 特效數值範圍（t∈[0,1)；精良減半） */
function specialValue(kind: SpecialKind, t: number): number {
  switch (kind) {
    case 'cd':
      return Math.round(8 + 7 * t);
    case 'dmg':
      return Math.round(12 + 13 * t);
    case 'area':
      return Math.round(15 + 15 * t);
    case 'block':
      return 2 + Math.floor(3 * t); // 2～4 ticks（約 0.07～0.13 秒）
    case 'dist':
      return Math.round(20 + 20 * t);
  }
}

/** 可以出現在特效上的技能（名稱只給顯示用） */
export const SPECIAL_SKILLS: Record<string, string> = { heavy_slash: '重斬', whirlwind: '旋風斬', charge: '衝鋒', parry: '格擋反擊', blade_storm: '劍刃風暴' };

export const ENH_MAX = 10;
/** 強化 +N → +N+1 的費用與成功率（+1～+5 必成；之後逐級下降；失敗只扣材料，不會掉級） */
export function enhanceCost(enh: number): { dust: number; crystal: number; rate: number } {
  const n = enh + 1;
  return { dust: 2 + 2 * n, crystal: n > 5 ? n - 5 : 0, rate: n <= 5 ? 100 : Math.max(30, 100 - (n - 5) * 14) };
}

/** 分解得到的粉塵（稀有度、物品等級、強化越高越多） */
export function salvageDust(g: RtGear): number {
  return g.rarity * 2 + Math.floor(g.ilvl / 2) + (g.enh ?? 0);
}

/** 顯示名稱（含強化 +N） */
export function gearTitle(g: RtGear): string {
  return g.enh ? `+${g.enh} ${g.name}` : g.name;
}

const enhMul = (g: RtGear): number => 1 + 0.1 * (g.enh ?? 0);

export interface GearStats {
  atk: number;
  hp: number;
  def: number;
  atkPct: number;
  hpPct: number;
}

/** 各部位不同等級段的名稱（ilvl 1–2、3–4、5–6、7+） */
const NAMES: Record<GearSlot, string[]> = {
  weapon: ['鐵劍', '狼牙劍', '霧鋼劍', '王牙大劍'],
  head: ['皮帽', '狼皮兜帽', '霧鋼頭盔', '王冠盔'],
  body: ['皮甲', '狼皮甲', '霧鋼鎧', '王鬃重鎧'],
  hands: ['皮手套', '狼爪護手', '霧鋼護手', '王爪臂鎧'],
  ring: ['銅戒', '狼牙戒', '霧晶戒', '王眼戒'],
  amulet: ['木項鍊', '狼牙項鍊', '霧晶項鍊', '王心項鍊'],
};

/** xorshift32（與核心同款；只在這裡用，不碰戰鬥亂數） */
function rng(seed: number): () => number {
  let x = seed >>> 0 || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

const MULT: Record<Rarity, number> = { 1: 1, 2: 1.25, 3: 1.5 };

/** 底數值：部位決定吃哪些屬性 */
function baseOf(slot: GearSlot, L: number, m: number): RtGear['base'] {
  const r = (n: number) => Math.max(1, Math.round(n * m));
  switch (slot) {
    case 'weapon':
      return { atk: r(1 + 0.8 * L) };
    case 'body':
      return { hp: r(20 + 10 * L), def: r(1 + 0.5 * L) };
    case 'head':
      return { hp: r(12 + 7 * L), def: r(1 + 0.3 * L) };
    case 'hands':
      return { atk: r(0.5 + 0.3 * L), def: r(1 + 0.3 * L) };
    case 'ring':
      return { atk: r(0.5 + 0.3 * L) };
    case 'amulet':
      return { hp: r(10 + 6 * L) };
  }
}

function affixValue(stat: AffixStat, L: number, t: number): number {
  switch (stat) {
    case 'atk':
      return Math.round(1 + L * (0.2 + 0.3 * t));
    case 'hp':
      return Math.round(6 + L * (3 + 3 * t));
    case 'def':
      return Math.round(1 + L * (0.2 + 0.3 * t));
    case 'atkPct':
      return Math.round(1 + 2 * t + L * 0.2);
    case 'hpPct':
      return Math.round(2 + 2 * t + L * 0.2);
  }
}

/** 由種子產生一件裝備（同種子同結果） */
/** 地區名稱標記（D-114）：荊棘谷掉的精良／稀有名字改成「荊芒／荊冠」，數值與亂數完全一樣 */
const REGION_TAG: Record<string, [string, string]> = { mistwood: ['薄霧', '霧語'], thornvale: ['荊芒', '荊冠'], emberrift: ['燼紋', '燼心'] };

export function genGear(seed: number, rarity: Rarity, ilvl: number, opts?: { night?: boolean; region?: string; slot?: GearSlot }): RtGear {
  const R = rng(seed);
  for (let i = 0; i < 3; i++) R();
  const L = Math.max(1, Math.min(12, Math.floor(ilvl)));
  // opts.slot：指定部位（第 25 輪行商「為你挑選」）；照樣抽一次亂數，其他結果與沒指定時相同
  const drawn = GEAR_SLOTS[Math.floor(R() * GEAR_SLOTS.length)]!;
  const slot = opts?.slot ?? drawn;
  const base = baseOf(slot, L, MULT[rarity]);
  const pool: AffixStat[] = ['atk', 'hp', 'def', 'atkPct', 'hpPct'];
  const affixes: RtGear['affixes'] = [];
  for (let i = 0; i < rarity - 1; i++) {
    const k = Math.floor(R() * pool.length);
    const stat = pool.splice(k, 1)[0]!;
    affixes.push({ stat, value: affixValue(stat, L, R()) });
  }
  // 稀有：必有一條技能特效；精良：PRO_SPECIAL_PCT% 機率有一條、數值減半（D-106；普通的結果不變）
  let special: RtGear['special'];
  if (rarity === 3 || (rarity === 2 && R() * 100 < PRO_SPECIAL_PCT)) {
    const ids = Object.keys(SPECIAL_SKILLS);
    const skill = ids[Math.floor(R() * ids.length)]!;
    const kinds = SPECIAL_KINDS[skill] ?? ['cd', 'dmg'];
    const kind = kinds[Math.floor(R() * kinds.length)]!;
    const v = specialValue(kind, R());
    special = { skill, kind, value: rarity === 3 ? v : Math.max(1, Math.round(v / 2)) };
  }
  const names = NAMES[slot];
  const baseName = names[Math.min(names.length - 1, Math.floor((L - 1) / 2))]!;
  const tag = REGION_TAG[opts?.region ?? 'mistwood'] ?? REGION_TAG.mistwood!;
  const name = rarity === 1 ? baseName : rarity === 2 ? `${AFFIX_PREFIX[affixes[0]!.stat]}${baseName}${special ? `・${tag[0]}` : ''}` : `${AFFIX_PREFIX[affixes[0]!.stat]}${baseName}・${tag[1]}`;
  const g: RtGear = { uid: (seed >>> 0).toString(36) + L.toString(36) + rarity, slot, rarity, ilvl: L, name, base, affixes };
  if (special) g.special = special;
  // 深夜的稀有（D-108）：多一條詞綴、名字改「夜燼」；亂數接在最後抽，白天的結果不變
  if (opts?.night && rarity === 3) {
    const k = Math.floor(R() * pool.length);
    const stat = pool.splice(k, 1)[0]!;
    affixes.push({ stat, value: affixValue(stat, L, R()) });
    g.name = `夜燼・${AFFIX_PREFIX[affixes[0]!.stat]}${baseName}`;
    g.night = true;
  }
  return g;
}

export function gearStats(items: (RtGear | undefined | null)[]): GearStats {
  const s: GearStats = { atk: 0, hp: 0, def: 0, atkPct: 0, hpPct: 0 };
  for (const g of items) {
    if (!g) continue;
    const m = enhMul(g);
    s.atk += Math.round((g.base.atk ?? 0) * m);
    s.hp += Math.round((g.base.hp ?? 0) * m);
    s.def += Math.round((g.base.def ?? 0) * m);
    for (const a of g.affixes) s[a.stat] += a.value;
  }
  return s;
}

/** 裝備換算成核心的平加成（百分比以角色基礎數值換算） */
export function gearBonus(items: (RtGear | undefined | null)[], baseHp: number, baseAtk: number): { hp: number; atk: number; def: number } {
  const s = gearStats(items);
  return {
    hp: s.hp + Math.round(((baseHp + s.hp) * s.hpPct) / 100),
    atk: s.atk + Math.round(((baseAtk + s.atk) * s.atkPct) / 100),
    def: s.def,
  };
}

/** 比較用的分數（攻擊最重要；給 Bot 自動換裝與「推薦」標記） */
export function gearScore(g: RtGear | undefined | null, baseHp: number, baseAtk: number): number {
  if (!g) return 0;
  const b = gearBonus([g], baseHp, baseAtk);
  return b.atk * 4 + b.hp * 0.25 + b.def * 3 + (g.special ? (g.rarity === 3 ? 25 : 12) : 0);
}

/** 一行數值說明（「攻擊 +12・HP +80」） */
export function gearLines(g: RtGear): string[] {
  const out: string[] = [];
  const m = enhMul(g);
  if (g.base.atk) out.push(`攻擊 +${Math.round(g.base.atk * m)}`);
  if (g.base.hp) out.push(`HP +${Math.round(g.base.hp * m)}`);
  if (g.base.def) out.push(`防禦 +${Math.round(g.base.def * m)}`);
  for (const a of g.affixes) out.push(`✦ ${AFFIX_NAME[a.stat]} +${a.value}${a.stat.endsWith('Pct') ? '%' : ''}`);
  if (g.special) out.push(specialText(specialOf(g)!) + ((g.enh ?? 0) >= 7 ? '（強化加成）' : ''));
  return out;
}

/** 強化讓特效變強（D-102）：+7 起 ×1.25、+10 ×1.5（格擋判定 +1／+2 ticks） */
export function specialOf(g: RtGear): RtGear['special'] {
  const sp = g.special;
  if (!sp) return undefined;
  const e = g.enh ?? 0;
  if (e < 7) return sp;
  if (sp.kind === 'block') return { ...sp, value: sp.value + (e >= 10 ? 2 : 1) };
  return { ...sp, value: Math.round(sp.value * (e >= 10 ? 1.5 : 1.25)) };
}

export function specialText(sp: NonNullable<RtGear['special']>): string {
  const n = SPECIAL_SKILLS[sp.skill] ?? sp.skill;
  switch (sp.kind) {
    case 'cd':
      return `★ ${n}冷卻 −${sp.value}%`;
    case 'dmg':
      return `★ ${n}傷害 +${sp.value}%`;
    case 'area':
      return `★ ${n}範圍 +${sp.value}%`;
    case 'block':
      return `★ ${n}判定 +${(sp.value / 30).toFixed(2)} 秒`;
    case 'dist':
      return `★ ${n}距離 +${sp.value}%`;
  }
}

/** 身上裝備的技能修正合計（上限 SKILL_MOD_CAPS，引擎也會夾） */
export function gearSkillMods(items: (RtGear | undefined | null)[]): Record<string, SkillMod> {
  const out: Record<string, SkillMod> = {};
  for (const g of items) {
    const sp = g ? specialOf(g) : undefined;
    if (!sp) continue;
    const m = (out[sp.skill] ??= {});
    if (sp.kind === 'cd') m.cdPct = Math.min(SKILL_MOD_CAPS.cdPct, (m.cdPct ?? 0) + sp.value);
    else if (sp.kind === 'dmg') m.dmgPct = (m.dmgPct ?? 0) + sp.value;
    else if (sp.kind === 'area') m.areaPct = Math.min(SKILL_MOD_CAPS.areaPct, (m.areaPct ?? 0) + sp.value);
    else if (sp.kind === 'block') m.blockTicks = Math.min(SKILL_MOD_CAPS.blockTicks, (m.blockTicks ?? 0) + sp.value);
    else if (sp.kind === 'dist') m.distPct = Math.min(SKILL_MOD_CAPS.distPct, (m.distPct ?? 0) + sp.value);
  }
  return out;
}

/** 讀檔時檢查一件裝備的形狀（壞資料丟掉） */
export function isGear(x: unknown): x is RtGear {
  const g = x as RtGear;
  return !!g && typeof g.uid === 'string' && (g.enh === undefined || (Number.isInteger(g.enh) && g.enh >= 0 && g.enh <= ENH_MAX)) && GEAR_SLOTS.includes(g.slot) && [1, 2, 3].includes(g.rarity) && typeof g.name === 'string' && !!g.base && Array.isArray(g.affixes);
}
