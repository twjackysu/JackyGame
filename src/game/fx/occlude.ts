/**
 * 大隻的怪擋住主角時變半透明（第 174 輪），主角再畫一份疊在牠身上（第 185 輪）。
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

/**
 * 擋住時怪的不透明度。第 174 輪是 0.34：在星隕／裂谷的深色地面上，正在打的精英整隻變成幾乎看不見的鬼影。
 * 第 185 輪改成「怪只淡一點＋把主角再畫一份疊在怪身上」（heroGhostAlpha）：主角看得到，怪也還是一隻實在的怪；
 * 留三成透明是為了還看得到牠身體底下的地面預告。
 */
export const OCCLUDE_ALPHA = 0.7;
/** 被擋住時疊在怪身上的那一份主角的不透明度（完全擋住時） */
export const HERO_GHOST_ALPHA = 0.72;

/** 疊在怪身上的主角要多實：跟著擋住牠的怪淡出的進度走（minOcc＝擋住主角的怪裡最淡的不透明度；沒被擋＝1） */
export function heroGhostAlpha(minOcc: number): number {
  const t = (1 - minOcc) / (1 - OCCLUDE_ALPHA);
  return HERO_GHOST_ALPHA * Math.min(1, Math.max(0, t));
}
/** 比主角高這麼多倍才算「大隻」；小怪蓋住半個身體不處理（不然一群狼圍上來整群忽明忽暗） */
export const OCCLUDE_MIN_RATIO = 1.5;

/**
 * 小怪也會蓋住主角（第 202 輪）：和主角差不多高的狼站到主角南邊，主角只剩一撮頭髮（四張圖都一樣，被圍時一半的時間看不到自己）。
 * 小怪不變淡（一群狼忽明忽暗更亂），只把主角再畫一份疊在牠們身上；比擋在大怪後面時淡一點，看得出是「隔著怪」。
 * crowd=false 回到「只處理大隻的」。
 */
export const OCCLUDE = { crowd: true, crowdGhost: 0.6, crowdMs: 110 };

/**
 * 小怪（比主角高不到 OCCLUDE_MIN_RATIO 倍）蓋住主角：畫在前面、主角的身體中心落在牠立繪的實心部分裡。
 * foe.y 傳立繪真正的下緣（不是腳底的格子位置：狼的立繪原點在腳上面一點，用腳底算會漏掉一半）；front＝牠畫在主角前面（照深度）。
 */
export function crowdCoversHero(foe: Box, hero: Box, front: boolean = foe.y > hero.y): boolean {
  if (!OCCLUDE.crowd) return false;
  if (!front) return false;
  if (foe.h >= hero.h * OCCLUDE_MIN_RATIO) return false; // 大隻的走 coversHero
  const cx = hero.x;
  const cy = hero.y - hero.h * 0.45;
  return Math.abs(cx - foe.x) <= foe.w * 0.34 && cy >= foe.y - foe.h * 0.9 && cy <= foe.y;
}

/** 被小怪蓋住的進度（0～1），慢慢進慢慢出：怪在身邊繞來繞去時不要一閃一閃 */
export function crowdStep(cur: number, covered: boolean, dtMs: number): number {
  const step = Math.max(0, dtMs) / OCCLUDE.crowdMs;
  return covered ? Math.min(1, cur + step) : Math.max(0, cur - step);
}

/** 疊在怪身上的主角最後多實：大怪那一份和小怪那一份取比較實的 */
export function ghostAlpha(minOcc: number, crowdT: number): number {
  return Math.max(heroGhostAlpha(minOcc), OCCLUDE.crowdGhost * Math.min(1, Math.max(0, crowdT)));
}

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

/** 小怪的血條壓在主角的頭和胸口上時畫多淡（第 202 輪）：被三隻狼圍住，三條紅條正好橫在主角臉上；精英與主角自己的照舊 */
export const BAR_OVER_HERO_ALPHA = 0.38;

/** 血條（左上角 x,y、寬 w、高 h）有沒有壓到主角的頭到胸口（腳底往上 30%～95%、左右各 38%） */
export function barOverHero(bar: { x: number; y: number; w: number; h: number }, hero: Box): boolean {
  const l = hero.x - hero.w * 0.38;
  const r = hero.x + hero.w * 0.38;
  const t = hero.y - hero.h * 0.95;
  const b = hero.y - hero.h * 0.3;
  return bar.x < r && bar.x + bar.w > l && bar.y < b && bar.y + bar.h > t;
}
