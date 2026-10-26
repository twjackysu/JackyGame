// 置中大字不互相重疊（第 38 輪，D-162）：升級、稀有裝備、第一次提示、回營火說明常常同一秒出現，
// 以前各自寫死 y（470／560／600／700）會疊成一團。新的大字若和「還沒開始淡出」的置中大字重疊，
// 就往下排到它下面；往下超過 limit 時改排到最上面那則的上方。純函式，方便測試。

export type Band = readonly [top: number, bottom: number];

const GAP = 6;

/**
 * 回傳新大字的中心 y；上下都放不下（往上會壓到左上角小地圖／懸賞板，ceil 以上）就回傳 null＝先排隊，
 * 等前面的大字淡出再出（第 39 輪：Boss 倒下、抉擇、稀有裝備、新地圖開放同時出，以前會被推到 HUD 上）。
 */
export function stackY(y: number, h: number, busy: readonly Band[], limit: number, ceil = 120): number | null {
  const half = h / 2;
  const hits = (cy: number): Band | undefined => busy.find(([t, b]) => cy - half < b + GAP && cy + half > t - GAP);
  let cy = y;
  for (let i = 0; i <= busy.length; i++) {
    const b = hits(cy);
    if (!b) break;
    cy = b[1] + GAP + half;
  }
  if (cy + half <= limit && !hits(cy)) return cy;
  // 下面放不下：排到全部的上方；上方也不夠（會超過 ceil）就排隊
  const top = Math.min(...busy.map(([t]) => t));
  const up = top - GAP - half;
  if (up - half >= ceil && !hits(up)) return up;
  return null;
}
