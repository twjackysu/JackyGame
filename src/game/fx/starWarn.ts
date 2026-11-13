/**
 * 墜星預告的長相（第 198 輪，D-397）。純函式，畫面層用；命中判定在引擎（vents／telegraph）。
 *
 * 以前：星隕高原地圖上的墜星預告是一顆平靜的藍色圓盤＋幾圈白線，星星最後 0.7 秒才出現——
 * 實際看畫面像一個「增益法陣」，和法杖護盾的藍圈、地面的藍色調混在一起，看不出是要砸下來的東西。
 *
 * 現在：整段預告都看得到那顆星從右上方落下來（先暗後亮、越來越近），一條細光把它和落點連起來；
 * 落點外圍有一圈往圓心收的刻度；填色長到整個圈（和敵人招式一樣「填滿就命中」）、最後兩成外框閃白。
 * 省電畫質也照畫（這是玩法資訊）。
 */
export const STAR_WARN = {
  /** 預告剛出現時星星離落點多遠（0＝最遠、1＝落地；餵給 fallingStar 的 f） */
  minF: 0.3,
  /** 預告剛出現時星星有多亮 */
  minA: 0.55,
  /** 星星到落點那條細光的透明度上限 */
  guideA: 0.45,
  /** 落點外圍往圓心收的刻度：幾個、一輪幾毫秒、從幾倍半徑收到幾倍半徑 */
  ticks: 8,
  tickMs: 620,
  tickFrom: 1.3,
  tickTo: 1.04,
} as const;

/** 星星在空中的位置與亮度：整段預告都有（以前 prog < 0.5 時完全看不到） */
export function starFall(prog: number): { f: number; a: number } {
  const p = Math.min(1, Math.max(0, prog));
  return { f: STAR_WARN.minF + (1 - STAR_WARN.minF) * p, a: STAR_WARN.minA + (1 - STAR_WARN.minA) * p };
}

/** 往圓心收的刻度：每個的角度、離圓心幾倍半徑、透明度（剛出現淡、收到圈邊最實） */
export function rimTicks(nowMs: number, prog: number): { ang: number; k: number; a: number }[] {
  const n = STAR_WARN.ticks;
  const ph = (((nowMs % STAR_WARN.tickMs) + STAR_WARN.tickMs) % STAR_WARN.tickMs) / STAR_WARN.tickMs;
  const k = STAR_WARN.tickFrom + (STAR_WARN.tickTo - STAR_WARN.tickFrom) * ph;
  const a = (0.35 + 0.65 * ph) * (0.6 + 0.4 * Math.min(1, Math.max(0, prog)));
  const out: { ang: number; k: number; a: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ ang: (i / n) * Math.PI * 2 + Math.PI / n, k, a });
  return out;
}
