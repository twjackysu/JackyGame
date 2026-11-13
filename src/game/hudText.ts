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


/** HUD 時間：一分鐘內顯示「12.3 秒」，之後「3:05」 */
export function hudClock(tick: number): string {
  const sec = tick / TICKS_PER_SEC;
  if (sec < 60) return `${sec.toFixed(1)} 秒`;
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

/** 頂端 HUD 一行要的數字（Q5 拆場景，第 148 輪：場景算好數字，這裡只排字） */
export interface HudLineView {
  /** 等級（沒有等級制的關卡不寫） */
  lv?: number;
  hp: number;
  maxHp: number;
  mp: number;
  /** 有掉落的關卡：武器強化、金幣、粉塵；沒有就寫剩幾隻敵人 */
  loot?: { enh: number; coin: number; dust: number };
  enemies: number;
  tick: number;
}

/** 右邊兩行：金幣／粉塵（沒有掉落的關卡寫敵人數）、武器強化＋時間（第 192 輪：等級、HP、MP 改成左邊的條，不再排成一行字） */
export function hudSide(v: HudLineView): string {
  const top = v.loot ? `金 ${v.loot.coin}　粉塵 ${v.loot.dust}` : `敵人 ${v.enemies}`;
  const enh = v.loot?.enh ? `武器 +${v.loot.enh}　` : '';
  return `${top}\n${enh}${hudClock(v.tick)}`;
}

/** 血條裡的字 */
export function hudHp(hp: number, maxHp: number): string {
  return `${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
}
