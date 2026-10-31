// 置中大字不互相重疊（第 38 輪，D-162）：升級、稀有裝備、第一次提示、回營火說明常常同一秒出現，
// 以前各自寫死 y（470／560／600／700）會疊成一團。新的大字若和「還沒開始淡出」的置中大字重疊，
// 就往下排到它下面；往下超過 limit 時改排到最上面那則的上方。純函式，方便測試。

export type Band = readonly [top: number, bottom: number];

const GAP = 16; // 第 42 輪：6 太擠（兩則提示字邊貼在一起像一整塊，描邊＋光暈還會互相碰到）
/** 原位和主角重疊超過這麼多（px）才挪；只擦到頭頂的不動（第 75 輪） */
const HERO_OVERLAP = 50;

/**
 * 回傳新大字的中心 y；上下都放不下（往上會壓到左上角小地圖／懸賞板，ceil 以上）就回傳 null＝先排隊，
 * 等前面的大字淡出再出（第 39 輪：Boss 倒下、抉擇、稀有裝備、新地圖開放同時出，以前會被推到 HUD 上）。
 */
export function stackY(y: number, h: number, busy: readonly Band[], limit: number, ceil = 120, avoid?: Band): number | null {
  const half = h / 2;
  // 第 75 輪：原位就壓在主角身上（重疊超過 HERO_OVERLAP）→ 先試主角下方（放得下才挪），再照常避開其他大字；
  // 挪下去反而要排隊（下面被提示佔滿）就退回原位的排法——Boss 的「跑出圈外！」這種警告不能因為讓位而晚出。
  // 360×640 主角約在 490～630，560 的相遇結語、升級字以前整塊蓋住主角；390×844 主角在 630～770，原位不受影響
  if (avoid && Math.min(y + half, avoid[1]) - Math.max(y - half, avoid[0]) > HERO_OVERLAP) {
    const below = avoid[1] + GAP + half;
    if (below + half <= limit) {
      const r = stackFrom(below, half, busy, limit, ceil, avoid);
      if (r !== null) return r;
    }
  }
  return stackFrom(y, half, busy, limit, ceil, avoid);
}

function stackFrom(y: number, half: number, busy: readonly Band[], limit: number, ceil: number, avoid?: Band): number | null {
  if (!busy.length) return y;
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
  // 第 74 輪：往上排會蓋住主角（avoid＝主角在畫面上的範圍）也排隊——360×640 打 Boss 時兩則提示疊起來正好壓在主角身上
  const onHero = avoid !== undefined && up - half < avoid[1] && up + half > avoid[0];
  if (up - half >= ceil && !hits(up) && !onHero) return up;
  return null;
}
