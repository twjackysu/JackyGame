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
