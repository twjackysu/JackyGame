// 強化（design/14 階段 2.4；數值在 src/data/enhancement.ts）。權威邏輯：只依賴注入的亂數，不碰瀏覽器。
// +0→+5 必成；+6 80%（失敗保持）；+7 65%、+8 50%（失敗降 1 級，不低於 +5）；+9 35%、+10 20%（失敗保持，D-058）。
// 失敗累積「星之祝福」，綁實例與目標階段、降級不清；滿 BLESSING_MAX 下次必成，成功後該階段祝福歸零。
import type { RandomProvider } from './ports';
import { BLESSING_MAX, ENHANCE_STEPS, MAX_ENHANCE, SAFE_FLOOR, type EnhanceStep } from '../data/enhancement';
import { RULES_VERSION } from '../data/rules';

/** 強化需要的實例欄位（EquipmentInstance 的子集） */
export interface Enhanceable {
  enhancement: number;
  /** 目標階段 → 祝福值 */
  blessings?: Partial<Record<number, number>>;
}

export interface EnhanceRoll {
  success: boolean;
  /** 這次是祝福滿了必成 */
  guaranteed: boolean;
  from: number;
  to: number;
  /** 結果等級 */
  level: number;
  /** 目標階段的祝福值（結算後） */
  blessing: number;
  chance: number;
  rulesVersion: number;
}

export function nextStep(level: number): EnhanceStep | undefined {
  return level >= MAX_ENHANCE ? undefined : ENHANCE_STEPS[level];
}

export function blessingOf(inst: Enhanceable, target: number): number {
  return inst.blessings?.[target] ?? 0;
}

/** 給 UI：下一次的成功率（祝福滿 = 1）與失敗後果 */
export function preview(inst: Enhanceable): { step: EnhanceStep; chance: number; blessing: number } | undefined {
  const step = nextStep(inst.enhancement);
  if (!step) return undefined;
  const blessing = blessingOf(inst, step.to);
  return { step, chance: blessing >= BLESSING_MAX ? 1 : step.chance, blessing };
}

/** 擲一次強化並直接修改實例（不處理成本；成本由 GameApi 檢查與扣除） */
export function rollEnhance(inst: Enhanceable, rng: RandomProvider): EnhanceRoll | undefined {
  const step = nextStep(inst.enhancement);
  if (!step) return undefined;
  const from = inst.enhancement;
  const before = blessingOf(inst, step.to);
  const guaranteed = step.chance < 1 && before >= BLESSING_MAX;
  // 必成的階段不擲骰（不吃亂數序列）
  const success = step.chance >= 1 || guaranteed || rng.nextFloat() < step.chance;
  inst.blessings = { ...(inst.blessings ?? {}) };
  if (success) {
    inst.enhancement = step.to;
    delete inst.blessings[step.to];
  } else {
    inst.enhancement = Math.max(Math.min(SAFE_FLOOR, from), step.failTo);
    inst.blessings[step.to] = Math.min(BLESSING_MAX, before + step.blessingOnFail);
  }
  return {
    success, guaranteed, from, to: step.to, level: inst.enhancement,
    blessing: blessingOf(inst, step.to), chance: guaranteed ? 1 : step.chance, rulesVersion: RULES_VERSION,
  };
}

export { enhanceMultiplier } from '../data/enhancement';
