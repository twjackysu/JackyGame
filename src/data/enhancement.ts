// 強化表（design/14 階段 2.4 的數值，D-053／design/13 題目 3 方案 A＋B）。
// 由 src/server/enhancement.ts（階段 2.4）讀取；這裡只放資料。改動任何數字都要 RULES_VERSION +1。
export interface EnhanceStep {
  /** 目標等級（從 to-1 強化到 to） */
  to: number;
  /** 成功率 0–1 */
  chance: number;
  /** 失敗時變成幾級：to-1 ＝保持不變；to-2 ＝降 1 級（不低於 SAFE_FLOOR） */
  failTo: number;
  /** 失敗累積的祝福值（滿 BLESSING_MAX 下次必成；綁實例與目標階段，降級不清） */
  blessingOnFail: number;
  /** 達到此等級後，裝備基礎數值 +%（不複利） */
  statPct: number;
  cost: { gold: number; mat_dust: number; mat_crystal?: number; mat_legend?: number };
}

export const MAX_ENHANCE = 10;
/** 失敗降級的下限（+5 以下必成，所以永遠不會掉到 +5 以下） */
export const SAFE_FLOOR = 5;
export const BLESSING_MAX = 100;

export const ENHANCE_STEPS: readonly EnhanceStep[] = [
  { to: 1, chance: 1, failTo: 0, blessingOnFail: 0, statPct: 3, cost: { gold: 20, mat_dust: 2 } },
  { to: 2, chance: 1, failTo: 1, blessingOnFail: 0, statPct: 6, cost: { gold: 30, mat_dust: 3 } },
  { to: 3, chance: 1, failTo: 2, blessingOnFail: 0, statPct: 9, cost: { gold: 45, mat_dust: 4 } },
  { to: 4, chance: 1, failTo: 3, blessingOnFail: 0, statPct: 12, cost: { gold: 60, mat_dust: 6 } },
  { to: 5, chance: 1, failTo: 4, blessingOnFail: 0, statPct: 15, cost: { gold: 80, mat_dust: 8 } },
  { to: 6, chance: 0.8, failTo: 5, blessingOnFail: 20, statPct: 19, cost: { gold: 110, mat_dust: 10, mat_crystal: 1 } },
  { to: 7, chance: 0.65, failTo: 5, blessingOnFail: 20, statPct: 23, cost: { gold: 140, mat_dust: 12, mat_crystal: 2 } },
  { to: 8, chance: 0.5, failTo: 6, blessingOnFail: 20, statPct: 28, cost: { gold: 180, mat_dust: 14, mat_crystal: 3 } },
  { to: 9, chance: 0.35, failTo: 7, blessingOnFail: 10, statPct: 32, cost: { gold: 230, mat_dust: 16, mat_crystal: 4, mat_legend: 1 } },
  { to: 10, chance: 0.2, failTo: 8, blessingOnFail: 10, statPct: 40, cost: { gold: 300, mat_dust: 20, mat_crystal: 5, mat_legend: 2 } },
];

/** 給玩家看的失敗後果文字（成功率與後果要直接顯示） */
export function failText(step: EnhanceStep): string {
  if (step.chance >= 1) return '必定成功';
  return step.failTo >= step.to - 1 ? '失敗：等級不變，累積星之祝福' : `失敗：降到 +${step.failTo}，累積星之祝福`;
}
