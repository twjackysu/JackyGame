// 開寶箱的字從寶箱旁邊跳出來（D-411，第 206 輪）。
// 以前「找到隱藏寶箱！」＋「結晶 ×3　金幣 ×160」是兩行置中大字（y 390／446）：離寶箱很遠（寶箱本身只有一小塊暗褐色）、
// 壓在左上角懸賞板邊上；旁邊有怪時整條蓋在怪和牠的血條上，和地區名、開場說明疊成三層。
// 現在標題和每一樣東西各自從寶箱裡跳出來，排在寶箱「背對主角」的那一側，跟著寶箱走（鏡頭移動不會漂掉）。純資料＋純函式。
export const CHEST_POP = {
  /** false＝回到置中大字 */
  on: true,
  /** 離寶箱中線多遠（px，遊戲座標） */
  side: 52,
  /** 最下面那一行比寶箱中心高多少 */
  up: 6,
  /** 行距 */
  lineH: 36,
  headSize: 30,
  lootSize: 26,
  /** 每一樣晚多少毫秒跳出來 */
  stagger: 170,
  /** 最後一樣出來後停多久（毫秒） */
  hold: 1500,
  /** 離畫面左右邊至少留多少 */
  margin: 14,
  /** 上面不能高過這條線（HUD 的血條與目標字） */
  top: 150,
};

/** 每樣戰利品的字色（和怪掉的「+7 金」「粉塵 +3」同一組） */
export const CHEST_LOOT_COLOR: Record<string, string> = { gold: '#ffd27a', dust: '#9fd8ff', crystal: '#d0a0ff', potion: '#7dffb0' };

export type ChestPopLayout = {
  /** 相對寶箱中心的 x；文字的錨點在 originX 那一側 */
  dx: number;
  originX: 0 | 1;
  /** 每一行相對寶箱中心的 y（第 0 行＝標題，在最上面） */
  dys: number[];
};

/**
 * 字排在寶箱哪一側：背對主角的那一側；那一側放不下（寶箱貼著畫面邊）就換另一側。
 * cx／heroX＝畫面座標；w＝最寬那一行的寬度；sw＝畫面寬；cy 只用來把整疊往下壓、不頂到 HUD。
 */
export function chestPopLayout(cx: number, cy: number, heroX: number, w: number, lines: number, sw: number): ChestPopLayout {
  const P = CHEST_POP;
  const fitsRight = cx + P.side + w <= sw - P.margin;
  const fitsLeft = cx - P.side - w >= P.margin;
  const wantRight = heroX <= cx;
  const right = wantRight ? fitsRight || !fitsLeft : !(fitsLeft || !fitsRight);
  const bottom = -P.up;
  let top = bottom - (lines - 1) * P.lineH;
  // 寶箱在畫面很上面：整疊往下挪到不碰 HUD（寧可排到寶箱下面那一側，也不蓋血條）
  const shift = Math.max(0, P.top - (cy + top));
  top += shift;
  return { dx: right ? P.side : -P.side, originX: right ? 0 : 1, dys: Array.from({ length: lines }, (_, i) => top + i * P.lineH) };
}
