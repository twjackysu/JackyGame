/**
 * 畫面外箭頭要不要畫（D-176）。
 * 有小地圖的大地圖：待機的一般怪只在小地圖上；待機的精英只在 ELITE_ARROW_M 公尺內才有大箭頭
 * （第 45 輪：新存檔一進森林畫面上緣就有四個大箭頭，三個擠在「目標」字條旁，指的是 Lv1 打不動的精英）。
 * Boss（這張圖的目標）與正在追你的怪一律畫。
 */
export const ELITE_ARROW_M = 25;

export function showOffscreenArrow(o: { mini: boolean; elite: boolean; boss: boolean; combat: boolean; distM: number }): boolean {
  if (!o.mini || o.combat || o.boss) return true;
  if (!o.elite) return false;
  return o.distM <= ELITE_ARROW_M;
}

/** 右上角的祝福火苗、身上的祝福圖示、獨特效果圖示佔的範圍（畫面座標；和 RtBattleScene.drawBlessHud 的排法一致）。
 *  taken＝這趟的祝福數、perm＝裝備帶的獨特效果數、off＝這張圖沒開祝福（只剩獨特效果那一排）。沒有東西回 null。 */
export function blessHudRect(W: number, o: { taken: number; perm: number; off: boolean }): { left: number; top: number; right: number; bottom: number } | null {
  if (o.off) return o.perm > 0 ? { left: W - 46 - (o.perm - 1) * 44 - 26, top: 170, right: W, bottom: 222 } : null;
  const flameLeft = W - 46 - 36 - (o.taken > 0 ? 30 + (o.taken - 1) * 50 + 24 : 0);
  const permLeft = o.perm > 0 ? W - 46 - 66 - (o.perm - 1) * 44 - 26 : W;
  return { left: Math.min(flameLeft, permLeft), top: 160, right: W, bottom: o.perm > 0 ? 288 : 256 };
}

/** 畫面外箭頭落在右上角那一組圖示上（第 171 輪：Boss 的大箭頭與「22m」疊在火苗和祝福圖示上，兩邊都看不清楚）→ 挪到那一組下面。
 *  回新的 y；沒有碰到就原樣。m＝箭頭自己的半徑。 */
export function belowBlessHud(cx: number, cy: number, r: { left: number; top: number; right: number; bottom: number } | null, m: number): number {
  if (!r) return cy;
  return cx > r.left - m && cx < r.right + m && cy > r.top - m && cy < r.bottom + m ? r.bottom + m : cy;
}
