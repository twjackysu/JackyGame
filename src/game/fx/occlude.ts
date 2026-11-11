/**
 * 大隻的怪擋住主角時變半透明（第 174 輪）。
 * 立繪照 y 排前後：怪在主角南邊（畫面上比較下面）就畫在主角前面。星骸守望者、岩王這種比主角高兩三倍的，
 * 主角一站到牠北邊就整個人不見——看不到自己在哪、朝哪、有沒有站在紅圈裡。純函式，畫面層只照著設不透明度。
 */
export interface Box {
  /** 腳底中心（螢幕座標） */
  x: number;
  y: number;
  /** 立繪顯示的寬高 */
  w: number;
  h: number;
}

/** 擋住時怪的不透明度 */
export const OCCLUDE_ALPHA = 0.34;
/** 比主角高這麼多倍才算「大隻」；小怪蓋住半個身體不處理（不然一群狼圍上來整群忽明忽暗） */
export const OCCLUDE_MIN_RATIO = 1.5;

/** foe 會不會把 hero 蓋住：foe 畫在前面（腳比較下面）、夠大，而且主角的身體中心落在 foe 立繪的實心部分裡 */
export function coversHero(foe: Box, hero: Box): boolean {
  if (foe.y <= hero.y) return false; // 怪在主角後面（北邊）：主角畫在牠前面
  if (foe.h < hero.h * OCCLUDE_MIN_RATIO) return false;
  const cx = hero.x;
  const cy = hero.y - hero.h * 0.45;
  // 立繪四周有透明邊：左右各縮 18%、頭頂縮 8%
  return Math.abs(cx - foe.x) <= foe.w * 0.32 && cy >= foe.y - foe.h * 0.92 && cy <= foe.y;
}

/** 每幀往目標靠近（約 0.12 秒走完），不要一進一出就閃 */
export function occludeStep(cur: number, covered: boolean, dtMs: number): number {
  const to = covered ? OCCLUDE_ALPHA : 1;
  const step = ((1 - OCCLUDE_ALPHA) * Math.max(0, dtMs)) / 120;
  return cur < to ? Math.min(to, cur + step) : Math.max(to, cur - step);
}
