// 熔岩口噴發的火柱長相（第 195 輪；純函式，`bossCues.ventEruptCue` 照著畫）。
// 以前是一塊平色的橘色長方形（寬 0.9r、高 3.2r、ADD），depth 690——比標題列和小地圖還高，
// 噴發口在畫面上緣附近時整塊蓋在等級、血條、小地圖上。現在是中心亮、兩側淡到 0、越往上越淡的柔光三層，
// 畫在 HUD 底下，而且柱頂不會伸進標題列。

export interface VentLayer { w: number; h: number; color: number; alpha: number; ms: number }

/** 火柱所在的 depth：單位與地面特效上面、巢穴紅圈（46）與 HUD（48 以上）下面 */
export const VENT_COLUMN_DEPTH = 44;

/**
 * r＝噴發半徑（畫面像素）、y＝噴發口的畫面 y、topY＝標題列下緣。由外到內：暗橘外暈、橘黃柱身、白黃的芯。
 * 柱高最多 3.2r，但不超過噴發口到標題列的距離（貼著上緣的噴發口就是一根矮柱）；省電畫質少外暈那一層。
 */
export function ventLayers(r: number, y: number, topY: number, lowFx: boolean): VentLayer[] {
  const room = Math.max(0, y - topY);
  const h = Math.min(r * 3.2, room);
  if (h < r * 0.4) return [];
  const all: VentLayer[] = [
    { w: r * 2.0, h: h * 0.8, color: 0xff5a1a, alpha: 0.5, ms: 520 },
    { w: r * 1.1, h: h * 0.92, color: 0xffa040, alpha: 0.85, ms: 460 },
    { w: r * 0.38, h, color: 0xfff0c0, alpha: 0.9, ms: 360 },
  ];
  return lowFx ? all.slice(1) : all;
}
