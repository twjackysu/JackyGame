// 長螢幕支援（D-142，第 31 輪）：設計解析度寬 720、高至少 1280（9:16）。
// 手機多半比 9:16 更長（19.5:9、20:9），以前上下會留黑邊、操作鍵浮在畫面中間；
// 現在開機時依視窗比例把高度拉長（最多 1600），多出來的 TALL 給地圖視野，操作鍵貼齊畫面下緣。
// 純資料模組（不 import Phaser），測試在 node 裡跑時 TALL = 0，一切跟以前一樣。

export const BASE_HEIGHT = 1280;
const MAX_HEIGHT = 1600;

function computeHeight(): number {
  if (typeof window === 'undefined' || !window.innerWidth || !window.innerHeight) return BASE_HEIGHT;
  // 用遊戲容器（#game，已扣掉瀏海／底部橫條的安全區）的大小；拿不到才用整個視窗
  const el = typeof document !== 'undefined' ? document.getElementById('game') : null;
  const w = el?.clientWidth || window.innerWidth;
  const hh = el?.clientHeight || window.innerHeight;
  const h = Math.round((720 * hh) / w / 2) * 2;
  return Math.max(BASE_HEIGHT, Math.min(MAX_HEIGHT, h));
}

/** 這次開機的畫面高度（720 寬的座標） */
export const GAME_HEIGHT = computeHeight();
/** 比 1280 多出來的高度：貼齊下緣的東西（操作鍵、營火捷徑）都往下移這麼多 */
export const TALL = GAME_HEIGHT - BASE_HEIGHT;
