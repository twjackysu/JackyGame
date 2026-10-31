// 長螢幕支援（D-142，第 31 輪）：設計解析度寬 720、高至少 1280（9:16）。
// 手機多半比 9:16 更長（19.5:9、20:9），以前上下會留黑邊、操作鍵浮在畫面中間；
// 現在開機時依視窗比例把高度拉長（最多 1600），多出來的 TALL 給地圖視野，操作鍵貼齊畫面下緣。
// 純資料模組（不 import Phaser），測試在 node 裡跑時 TALL = 0，一切跟以前一樣。

export const BASE_HEIGHT = 1280;
const MAX_HEIGHT = 1600;

/**
 * 依容器大小算 720 寬座標下的畫面高度（1280～1600）。
 * 觸控裝置橫著開機（瀏覽器分頁、手機剛好橫拿）時當作直式算（D-216）：遊戲只支援直式，
 * 轉回直式後才不會被 1280 高鎖住、上下留一大截黑邊；橫著的時候 orientation.ts 會蓋「請轉成直式」。
 */
export function portraitHeight(w: number, hh: number, touch: boolean): number {
  if (touch && w > hh) [w, hh] = [hh, w];
  const h = Math.round((720 * hh) / w / 2) * 2;
  return Math.max(BASE_HEIGHT, Math.min(MAX_HEIGHT, h));
}

/** 手機／平板（粗指標）才算觸控；桌機橫向視窗照舊 1280 */
export function isTouchScreen(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

function computeHeight(): number {
  if (typeof window === 'undefined' || !window.innerWidth || !window.innerHeight) return BASE_HEIGHT;
  // 用遊戲容器（#game，已扣掉瀏海／底部橫條的安全區）的大小；拿不到才用整個視窗
  const el = typeof document !== 'undefined' ? document.getElementById('game') : null;
  const w = el?.clientWidth || window.innerWidth;
  const hh = el?.clientHeight || window.innerHeight;
  return portraitHeight(w, hh, isTouchScreen());
}

/** 這次開機的畫面高度（720 寬的座標） */
export const GAME_HEIGHT = computeHeight();
/** 比 1280 多出來的高度：貼齊下緣的東西（操作鍵、營火捷徑）都往下移這麼多 */
export const TALL = GAME_HEIGHT - BASE_HEIGHT;
