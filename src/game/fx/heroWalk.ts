/**
 * 主角的走路（第 193 輪）：立繪切成「身體」＋兩隻靴子（scripts/cut-hero.py），走的時候靴子各自邁步、身體跟著起伏前傾，
 * 不再是整張圖一起上下彈（Jacky：「很像是貼紙貼上去的」）。純畫面：只讀單位的位置，不影響任何判定。
 * 這裡是純函式（步態）；怎麼擺到畫面上在 RtBattleScene。
 */
export const HERO_WALK = {
  /** 關掉＝退回整張立繪 */
  on: true,
  /** 一個循環（左右各一步）幾毫秒 */
  cycleMs: 400,
  /** 靴子前後擺多遠、抬多高（原圖 px；原圖約 600 高） */
  swing: 30,
  lift: 40,
  /** 靴子最多轉幾度（離地腳尖朝下、落地腳跟先著地） */
  rotDeg: 16,
  /** 身體前傾幾度、起伏多高（原圖 px） */
  leanDeg: 5,
  bob: 14,
  /** 起步／停下花多久把幅度拉滿／收回（毫秒） */
  easeMs: 110,
} as const;

export interface FootPose {
  /** 往前（面向的方向）為正，原圖 px */
  dx: number;
  /** 離地高度，原圖 px（≥0） */
  lift: number;
  /** 順著面向的方向轉幾度（正＝腳尖朝下） */
  rot: number;
  /** 這一腳是不是踩在地上 */
  down: boolean;
}

/** phase＝弧度（一圈＝左右各一步）；foot 0＝左、1＝右（差半圈）；amt 0～1＝走路的幅度（停下時收回站姿） */
export function footPose(phase: number, foot: 0 | 1, amt: number): FootPose {
  const TAU = Math.PI * 2;
  const u = (((phase + foot * Math.PI) % TAU) + TAU) % TAU;
  const W = HERO_WALK;
  if (u < Math.PI) {
    // 踩地：腳留在地上，相對身體從前面滑到後面
    return { dx: W.swing * (1 - (2 * u) / Math.PI) * amt, lift: 0, rot: 0, down: true };
  }
  const t = (u - Math.PI) / Math.PI;
  const e = t * t * (3 - 2 * t); // 離地後加速、落地前減速
  return { dx: W.swing * (-1 + 2 * e) * amt, lift: Math.sin(Math.PI * t) * W.lift * amt, rot: Math.cos(Math.PI * t) * W.rotDeg * amt, down: false };
}

/** 身體：兩腳交會時最高、跨最開時最低（一圈起伏兩次）；走的時候往前傾 */
export function bodyPose(phase: number, amt: number): { up: number; lean: number } {
  return { up: (0.5 - 0.5 * Math.cos(phase * 2)) * HERO_WALK.bob * amt, lean: HERO_WALK.leanDeg * amt };
}

/** 幅度往目標（走＝1、停＝0）靠近 */
export function easeAmt(amt: number, moving: boolean, dtMs: number): number {
  const step = Math.max(0, dtMs) / HERO_WALK.easeMs;
  return moving ? Math.min(1, amt + step) : Math.max(0, amt - step);
}

/** 這一幀有沒有哪隻腳剛落地（揚塵用）：回 0／1，沒有回 -1 */
export function footfall(prevPhase: number, phase: number): 0 | 1 | -1 {
  const k0 = Math.floor(prevPhase / Math.PI);
  const k1 = Math.floor(phase / Math.PI);
  if (k1 === k0) return -1;
  // 左腳在 phase 過 2πn 時落地、右腳在過 π(2n+1) 時落地
  return ((((k1 % 2) + 2) % 2) === 0 ? 0 : 1) as 0 | 1;
}
