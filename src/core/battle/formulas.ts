// 戰鬥公式（03 §3、§7；09 §1–2）。純函式，供戰鬥引擎與平衡模擬共用。

export type Element = 'phys' | 'fire' | 'light' | 'water' | 'earth' | 'umbra';
export type Timing = 'perfect' | 'good' | 'miss';
export type Telegraph = 'white' | 'red' | 'purple'; // 白光=點擊格擋、紅光=滑動閃避、紫光=長按引路

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface Stats extends BaseStats {
  level: number;
}

/** 角色成長（03 §7.1） */
export function statsAtLevel(base: BaseStats, level: number): Stats {
  const l = level - 1;
  return {
    level,
    hp: Math.round(base.hp * (1 + 0.12 * l)),
    atk: Math.round(base.atk * (1 + 0.1 * l)),
    def: Math.round(base.def * (1 + 0.08 * l)),
    spd: base.spd,
  };
}

export const TIMING_MUL: Record<Timing, number> = { perfect: 1.5, good: 1.15, miss: 0.85 };

/** 判定窗口（毫秒，±）。霧中縮小 30%。 */
export const WINDOWS = {
  attackPerfect: 60,
  attackGood: 150,
  parryPerfect: 80,
  parryGood: 150,
  dodgeLead: 250, // 滑動須在命中前 250ms 內開始
  dodgePerfect: 80,
  holdLead: 400, // 長按須在命中前 400ms 內開始並持續到命中
} as const;

export function judgeAttack(deltaMs: number, windowScale = 1): Timing {
  const d = Math.abs(deltaMs);
  if (d <= WINDOWS.attackPerfect * windowScale) return 'perfect';
  if (d <= WINDOWS.attackGood * windowScale) return 'good';
  return 'miss';
}

/** 防守結果（03 §3.3）。deltaMs = 輸入時間 − 命中時間（負值＝提早）。 */
export type DefenseInput = { kind: 'tap' | 'swipe' | 'hold' | 'none'; deltaMs: number; holdUntilImpact?: boolean };
export type DefenseResult = 'perfect' | 'success' | 'fail';

export function judgeDefense(tele: Telegraph, input: DefenseInput, windowScale = 1): DefenseResult {
  const d = input.deltaMs;
  if (tele === 'white') {
    if (input.kind !== 'tap') return 'fail';
    if (Math.abs(d) <= WINDOWS.parryPerfect * windowScale) return 'perfect';
    if (Math.abs(d) <= WINDOWS.parryGood * windowScale) return 'success';
    return 'fail';
  }
  if (tele === 'red') {
    if (input.kind !== 'swipe') return 'fail';
    if (Math.abs(d) <= WINDOWS.dodgePerfect * windowScale) return 'perfect';
    if (d <= 0 && d >= -WINDOWS.dodgeLead * windowScale) return 'success';
    return 'fail';
  }
  // purple
  if (input.kind !== 'hold' || !input.holdUntilImpact) return 'fail';
  return d <= 0 && d >= -WINDOWS.holdLead * windowScale ? 'success' : 'fail';
}

/** 受到的傷害倍率（防守後） */
export function defenseMul(tele: Telegraph, r: DefenseResult): number {
  if (r === 'fail') return 1;
  if (tele === 'white') return r === 'perfect' ? 0 : 0.3;
  return 0; // 閃避成功 / 引路抵消
}

export interface DamageInput {
  atk: number;
  def: number;
  skillMul: number;
  timing?: Timing; // 我方攻擊才有
  weak?: boolean;
  resist?: boolean;
  broken?: boolean;
  guarding?: boolean; // 目標「防禦」中
  variance?: number; // 0.95~1.05，測試時可固定 1
}

/** 傷害公式（03 §7.2，比例減傷） */
export function damage(i: DamageInput): number {
  const timing = i.timing ? TIMING_MUL[i.timing] : 1;
  const elem = i.weak ? 1.5 : i.resist ? 0.5 : 1;
  const brk = i.broken ? 1.5 : 1;
  const guard = i.guarding ? 0.5 : 1;
  const v = i.variance ?? 1;
  return Math.max(1, Math.round(i.atk * i.skillMul * timing * elem * brk * guard * (40 / (40 + i.def)) * v));
}

/** 共鳴：目標身上 n 盞、全場 N 盞時的技能倍率（03 §3.5） */
export function resonanceMul(n: number, totalLamps: number): number {
  if (n <= 0) return 0;
  return n * 0.4 * (1 + 0.15 * (totalLamps - 1));
}

export const MAX_LAMPS = 5;
export const MAX_EMBER = 10;
export const START_EMBER = 2;
export const MAX_SP = 6;
export const START_SP = 3;

/** 連戰帶傷（洛克三段決鬥 D-028）：下一段從上一段結束時的 HP% 再回 20% 開始，最低 35% */
export const HP_CARRY_FROM: Record<string, string> = { rourke_2: 'rourke_1', rourke_3: 'rourke_2' };
export function carriedHp(maxHp: number, pct: number | undefined): number {
  if (pct === undefined || !Number.isFinite(pct)) return maxHp;
  return Math.round(maxHp * Math.min(1, Math.max(0.35, pct + 0.2)));
}
