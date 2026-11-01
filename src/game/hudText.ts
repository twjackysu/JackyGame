import type Phaser from 'phaser';
import { TICKS_PER_SEC } from '../core/battle/rt/types';

/** 按鈕冷卻秒數：3 秒以上顯示整數、最後 3 秒才到小數一位（第 83 輪：每 0.1 秒換字＝每顆鍵每秒重傳 10 次文字貼圖，手機上是可觀的負擔） */
export function cdText(ticks: number): string {
  const sec = ticks / TICKS_PER_SEC;
  return sec >= 3 ? String(Math.ceil(sec)) : sec.toFixed(1);
}

/** 只在顏色真的變了才 setColor（第 83 輪：Phaser 的 setColor 每次都重畫文字＋重傳貼圖，HUD 每幀呼叫＝每秒 60 次 texImage2D） */
export function textColor(t: Phaser.GameObjects.Text, c: string): Phaser.GameObjects.Text {
  if (t.style.color !== c) t.setColor(c);
  return t;
}

