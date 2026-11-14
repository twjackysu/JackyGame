// 技能樹下面「打法」格子的長相（第 204 輪，純畫面、不依賴 Phaser）。
// 以前三排都是同一種暗色直角方塊＋兩三個字：三種打法看起來一樣，選中的是一整塊洋紅，鎖頭是 14px 的 emoji。
// 現在每格左邊畫那種打法在戰鬥畫面底部的小圖示（火橘、冰青、毒綠…一眼看出差在哪），
// 沒解鎖＝圖示變淡＋右上角畫出來的鎖；能選＝亮框；使用中＝粉框＋右上角打勾。BRANCH_CELL.on=false 回舊樣子。
export const BRANCH_CELL = {
  on: true,
  w: 128,
  h: 60,
  radius: 10,
  /** 圖示圓心離格子中心（往左）與半徑 */
  iconDx: -45,
  iconR: 15,
  /** 字放在圖示右邊剩下那一段的正中間 */
  textDx: 16,
  /** 字能用的寬度（右緣留一點、不碰右上角的記號） */
  textW: 78,
  /** 沒解鎖時圖示的透明度 */
  lockedIconA: 0.38,
  /** 右上角的記號（鎖／勾）圓心 */
  markDx: 59,
  markDy: -26,
  markR: 10,
} as const;

export type BranchState = 'locked' | 'open' | 'on';

export interface BranchLook {
  fill: number;
  stroke: number;
  strokeW: number;
  text: string;
  bold: boolean;
  iconA: number;
  mark: 'lock' | 'check' | null;
}

const LOOK: Readonly<Record<BranchState, BranchLook>> = {
  locked: { fill: 0x141008, stroke: 0x3a3020, strokeW: 2, text: '#8a8070', bold: false, iconA: BRANCH_CELL.lockedIconA, mark: 'lock' },
  open: { fill: 0x2a1e10, stroke: 0xc8a060, strokeW: 2, text: '#f0e4c8', bold: false, iconA: 1, mark: null },
  on: { fill: 0x3a1634, stroke: 0xffb6f0, strokeW: 4, text: '#ffd6f6', bold: true, iconA: 1, mark: 'check' },
};

export function branchState(full: boolean, chosen: boolean): BranchState {
  return !full ? 'locked' : chosen ? 'on' : 'open';
}

export function branchLook(st: BranchState): BranchLook {
  return LOOK[st];
}

/** 字級：照字數縮，保證放得進圖示右邊那一段（中文字寬≈字級） */
export function branchFont(label: string): number {
  const n = Math.max(1, [...label].length);
  return Math.max(14, Math.min(22, Math.floor(BRANCH_CELL.textW / n)));
}
