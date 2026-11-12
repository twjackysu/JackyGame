/**
 * 玩家技能範圍（直線、扇形）的長相（第 182 輪，D-378）。純函式，畫面層用；不影響命中判定。
 *
 * 以前：一塊 0.1 的平藍＋一圈 0.5 的淡藍外框。在霧語森林的綠地上還好，到了燼紅裂谷／星隕高原的深色地面，
 * 直線招變成一塊灰色的長方形玻璃片（像介面的框或除錯框），扇形是一片灰色的披薩，而且三把武器、所有屬性都同一個顏色。
 *
 * 現在：
 * - 顏色跟著武器與屬性走（劍＝金、弓＝青綠、杖＝藍紫；火＝橘、冰＝淺藍、毒＝綠、緩速＝紫）。
 * - 直線＝「光路」：沒有封閉的外框；靠近主角亮、越遠越淡（但末端仍看得到），中間有一條較亮的芯，兩側是淡出的邊線，
 *   末端只有兩個小角標示射程。
 * - 扇形＝「斬擊的掃過範圍」：外緣一圈亮弧、兩條半徑邊幾乎不畫，裡面由內往外變實。
 * - 圓與環（第 183 輪）：以前一樣是 0.1 的平藍＋淡藍外框，深色地面上是一塊灰色的圓盤，不分武器。
 *   現在跟扇形同一套：顏色跟著武器／屬性，裡面由內往外變實（中間幾乎透明，不蓋住主角和專屬特效），外緣一圈亮弧。
 *敵人的預告是另一套（`telegraphLook.ts`：紅／亮紫／藍，有外框與箭頭）。
 */
export type AreaWeapon = 'sword' | 'bow' | 'staff';

export interface AreaLook {
  /** 填色 */
  fill: number;
  /** 邊線／外弧的亮色 */
  edge: number;
  /** 填色的基準透明度（最亮處） */
  fillA: number;
  /** 邊線的基準透明度（最亮處） */
  edgeA: number;
}

const WEAPON: Record<AreaWeapon, { fill: number; edge: number }> = {
  sword: { fill: 0xffc860, edge: 0xfff0c0 },
  bow: { fill: 0x6ee8b8, edge: 0xd0ffe8 },
  staff: { fill: 0x8a9cff, edge: 0xd8dcff },
};

const STATUS: Record<string, { fill: number; edge: number }> = {
  burn: { fill: 0xff8a3a, edge: 0xffd0a0 },
  freeze: { fill: 0x4fd0ff, edge: 0xc8f4ff },
  poison: { fill: 0x7ad84a, edge: 0xd8ffb0 },
  slow: { fill: 0xa08aff, edge: 0xe0d8ff },
};

/** 玩家範圍絕不能用敵人預告的紅（0xff3a3a）或亮紫（0xd24cff）——那是「危險」的顏色 */
export function areaLook(weapon: AreaWeapon, status?: string): AreaLook {
  const c = (status && STATUS[status]) || WEAPON[weapon];
  return { fill: c.fill, edge: c.edge, fillA: 0.16, edgeA: 0.6 };
}

/** 直線切成幾段畫（每段一個透明度） */
export const LANE_SEGS = 10;
/** 末端至少留幾成亮度：射程是玩法資訊，不能淡到看不見 */
export const LANE_FAR = 0.28;

/** 直線第 i 段（0＝靠主角）的亮度倍率：1 → LANE_FAR，單調遞減 */
export function laneBand(i: number, n: number = LANE_SEGS): number {
  if (n <= 1) return 1;
  const t = Math.min(1, Math.max(0, i / (n - 1)));
  return 1 - (1 - LANE_FAR) * t;
}

/** 直線橫向分三層疊起來（寬度比例、亮度倍率）：邊緣淡、中間實，才像一道光而不是一片平板 */
export const LANE_LAYERS: readonly { w: number; a: number }[] = [
  { w: 1, a: 0.4 },
  { w: 0.62, a: 0.45 },
  { w: 0.28, a: 0.7 },
];
/** 末端角標沿長度方向的長度佔寬度的比例 */
export const LANE_TICK = 0.3;

/** 扇形由內往外分幾圈畫；第 j 圈（0＝最內）的內外半徑比例與亮度倍率 */
export const SECTOR_BANDS: readonly { r0: number; r1: number; a: number }[] = [
  { r0: 0, r1: 0.55, a: 0.3 },
  { r0: 0.55, r1: 0.82, a: 0.6 },
  { r0: 0.82, r1: 1, a: 1 },
];
/** 扇形兩條半徑邊的透明度相對外弧的比例（幾乎不畫，才不像一片切好的框） */
export const SECTOR_SIDE = 0.22;

/** 環（內外半徑之間）由內往外分幾圈畫：內半淡、外半實；回傳每一圈的內外半徑與亮度倍率 */
export function ringBands(rIn: number, rOut: number): { r0: number; r1: number; a: number }[] {
  const mid = rIn + (rOut - rIn) * 0.55;
  return [
    { r0: rIn, r1: mid, a: 0.45 },
    { r0: mid, r1: rOut, a: 1 },
  ];
}
/** 環的內圈邊線相對外圈的亮度（內圈只是「這裡面打不到」的提示，不搶外圈） */
export const RING_INNER_EDGE = 0.5;
