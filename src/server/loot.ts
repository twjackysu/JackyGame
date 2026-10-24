// 裝備掉落與詞綴生成（design/14 階段 2.3；資料在 src/data/{affixes,lootTables,rules}.ts）。
// 權威邏輯：只依賴注入的 RandomProvider。輸出是可序列化的純資料。
import type { RandomProvider } from './ports';
import { AFFIXES, AFFIX_BY_ID, type AffixDef } from '../data/affixes';
import { AFFIX_COUNT, TIERS, tierRank, type GearSlot, type Tier } from '../data/rules';
import { LOOT_TABLES, PITY, type TierWeights } from '../data/lootTables';

export interface RolledAffix {
  id: string;
  value: number;
}

/** 某部位×稀有度可以抽的詞綴 */
export function affixPool(slot: GearSlot, tier: Tier): AffixDef[] {
  return AFFIXES.filter((a) => a.slots.includes(slot) && tierRank(tier) >= tierRank(a.minTier) && !!a.range[tier]);
}

function weightedPick<T>(items: readonly T[], weight: (t: T) => number, rng: RandomProvider): T | undefined {
  const total = items.reduce((n, t) => n + Math.max(0, weight(t)), 0);
  if (total <= 0) return undefined;
  let r = rng.nextFloat() * total;
  for (const t of items) {
    r -= Math.max(0, weight(t));
    if (r < 0) return t;
  }
  return items[items.length - 1];
}

/**
 * 抽 `count` 條詞綴（預設＝該稀有度的條數）：不重複、不違反互斥群組；`keep` 是要保留的既有詞綴（重鑄鎖定用）。
 * 池子不夠時能抽幾條算幾條（schema 測試保證正常資料一定抽得滿）。
 */
export function rollAffixes(slot: GearSlot, tier: Tier, rng: RandomProvider, count = AFFIX_COUNT[tier], keep: readonly RolledAffix[] = []): RolledAffix[] {
  const out: RolledAffix[] = [...keep];
  const usedGroups = new Set(keep.map((k) => AFFIX_BY_ID[k.id]?.group).filter(Boolean));
  let pool = affixPool(slot, tier).filter((a) => !usedGroups.has(a.group));
  while (out.length < count && pool.length) {
    const a = weightedPick(pool, (x) => x.weight, rng)!;
    const [lo, hi] = a.range[tier]!;
    out.push({ id: a.id, value: rng.nextInt(lo, hi) });
    pool = pool.filter((x) => x.group !== a.group);
  }
  return out;
}

/** 依權重表擲稀有度 */
export function rollTier(weights: TierWeights, rng: RandomProvider): Tier {
  const entries = TIERS.filter((t) => (weights[t] ?? 0) > 0);
  return weightedPick(entries, (t) => weights[t] ?? 0, rng) ?? 'common';
}

/** 保底計數（存在玩家資料裡；深淵階段 3.2 使用） */
export interface PityState {
  /** 連續幾場 Boss 沒出傳說以上 */
  sinceLegend: number;
  /** 連續幾場 Boss 沒出神級 */
  sinceDivine: number;
}

/** 套用軟／硬保底後的 Boss 稀有度權重（「星燼凝聚」） */
export function bossWeights(pity: PityState): TierWeights {
  const base = { ...LOOT_TABLES.abyss_boss!.tiers };
  if (pity.sinceDivine >= PITY.hardAt - 1) return { divine: 1 };
  const extra = Math.max(0, pity.sinceLegend - PITY.softAfter + 1) * PITY.softStep;
  if (extra > 0) base.legend = (base.legend ?? 0) + extra;
  return base;
}

/** Boss 掉落一次：回傳稀有度並更新保底計數 */
export function rollBossTier(pity: PityState, rng: RandomProvider): Tier {
  const t = rollTier(bossWeights(pity), rng);
  pity.sinceDivine = t === 'divine' ? 0 : pity.sinceDivine + 1;
  pity.sinceLegend = tierRank(t) >= tierRank('legend') ? 0 : pity.sinceLegend + 1;
  return t;
}

/** 檢查一組詞綴是否合法（測試與伺服器驗證用） */
export function affixesLegal(slot: GearSlot, tier: Tier, affixes: readonly RolledAffix[]): boolean {
  const groups = new Set<string>();
  for (const a of affixes) {
    const def = AFFIX_BY_ID[a.id];
    if (!def || !def.slots.includes(slot) || tierRank(tier) < tierRank(def.minTier)) return false;
    const r = def.range[tier];
    if (!r || a.value < r[0] || a.value > r[1] || !Number.isInteger(a.value)) return false;
    if (groups.has(def.group)) return false;
    groups.add(def.group);
  }
  return affixes.length <= AFFIX_COUNT[tier];
}
