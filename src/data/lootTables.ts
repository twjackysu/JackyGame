// 掉落表與保底（design/14 階段 1.3；擲骰在 src/server/loot.ts 與 abyss.ts，階段 2.3／3.2）。
// 初始值來自 design/13 題目 1b（「待測」），之後由模擬器校準；改動要 RULES_VERSION +1。
// 主線既有的固定掉落（drops.ts：小怪 3–5% 稀有、Boss 首殺必掉）維持不動。
import type { Tier } from './rules';

/** 依稀有度的權重表（加總必須 > 0；顯示機率＝權重／總和） */
export type TierWeights = Partial<Record<Tier, number>>;

export interface LootTable {
  id: string;
  /** 每次擲幾件裝備 */
  rolls: number;
  /** 掉裝備的機率（0–1）；1 ＝必掉 */
  chance: number;
  tiers: TierWeights;
  /** 額外材料（固定＋範圍） */
  materials?: Partial<Record<'mat_dust' | 'mat_crystal' | 'mat_legend', readonly [number, number]>>;
  gold?: readonly [number, number];
}

export const LOOT_TABLES: Record<string, LootTable> = {
  // 深淵一般戰鬥房
  abyss_room: { id: 'abyss_room', rolls: 1, chance: 0.35, tiers: { common: 50, magic: 35, rare: 13, epic: 2 }, materials: { mat_dust: [1, 3] }, gold: [10, 25] },
  // 深淵寶箱／事件房
  abyss_chest: { id: 'abyss_chest', rolls: 1, chance: 1, tiers: { magic: 45, rare: 40, epic: 13, legend: 2 }, materials: { mat_dust: [2, 4] }, gold: [20, 40] },
  // 精英
  abyss_elite: { id: 'abyss_elite', rolls: 1, chance: 1, tiers: { rare: 60, epic: 32, legend: 7.5, divine: 0.5 }, materials: { mat_dust: [3, 5], mat_crystal: [1, 2] }, gold: [30, 60] },
  // Boss：必掉一件主裝備（稀有 45／史詩 35／傳說 18／神級 2）
  abyss_boss: { id: 'abyss_boss', rolls: 1, chance: 1, tiers: { rare: 45, epic: 35, legend: 18, divine: 2 }, materials: { mat_dust: [5, 8], mat_crystal: [2, 3] }, gold: [60, 120] },
};

/**
 * 保底（世界觀包裝：「星燼凝聚」——不是抽卡）。
 * - 軟保底：連續 `softAfter` 場 Boss 沒出傳說以上，之後每場傳說權重 +`softStep`（加在原權重上）。
 * - 硬保底：連續 `hardAt` 場 Boss 沒出神級，下一場 Boss 必出神級。
 * - 重複神級 → 神格碎片 `dupDivineShards` 個；`craftDivineCost` 個碎片可指定製作已見過的神級。
 */
export const PITY = {
  softAfter: 10,
  softStep: 4,
  hardAt: 40,
  dupDivineShards: 5,
  craftDivineCost: 20,
} as const;

/** 分解得到的材料（依稀有度） */
export const SALVAGE: Record<Tier, Partial<Record<'mat_dust' | 'mat_crystal' | 'mat_legend', number>>> = {
  common: { mat_dust: 1 },
  magic: { mat_dust: 2 },
  rare: { mat_dust: 4, mat_crystal: 1 },
  epic: { mat_dust: 6, mat_crystal: 2 },
  legend: { mat_dust: 8, mat_crystal: 3, mat_legend: 1 },
  divine: { mat_dust: 10, mat_crystal: 4, mat_legend: 2 },
};

/** 一鍵分解預設只動這些稀有度；傳說以上自動鎖定 */
export const QUICK_SALVAGE_TIERS: readonly Tier[] = ['common', 'magic', 'rare'];
