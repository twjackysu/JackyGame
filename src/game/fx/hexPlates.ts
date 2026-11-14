// 法杖護盾架起來的瞬間（D-402，第 201 輪）：六片六角晶片排在主角「身邊一圈」往外張開。
// 以前是一顆罩在身上的六角線框（外框＋內框＋六條穿過身體的輻條＋填色），加上護盾罩、光環、數字，主角有十幾幀整個被蓋住。
// 規則：晶片不進主角那一直條（頭到腳），所以放在左右與四個斜角，不放正上正下。純資料，畫在 fieldFx.hexShield。
export const HEX_PLATES = {
  /** 六片的圓心離身體中心多遠（px，張開後） */
  ring: 74,
  /** 每片的外接圓半徑 */
  plate: 21,
  /** 剛出現時整圈的比例（往外張到 1） */
  from: 0.78,
  /** 主角那一直條的半寬：晶片在最小比例時也不能進來 */
  bodyHalf: 14,
  fill: 0xc89aff,
  edge: 0xe9dcff,
  fillA: 0.2,
  edgeA: 0.95,
};

export interface HexPlate {
  x: number;
  y: number;
  r: number;
}

/** 六片晶片的位置（相對身體中心）：0°、60°、120°…——左右各一、四個斜角，正上正下不放 */
export function hexPlates(ring = HEX_PLATES.ring, r = HEX_PLATES.plate): HexPlate[] {
  const out: HexPlate[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    out.push({ x: Math.cos(a) * ring, y: Math.sin(a) * ring, r });
  }
  return out;
}

/** 尖端朝上的六角形頂點（相對晶片中心） */
export function hexPoints(r: number): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, i) => ({ x: Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * r, y: Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * r }));
}

/** 這片晶片在某個比例下最靠近中線的 x 距離（<bodyHalf 就是壓到主角） */
export function plateClearance(p: HexPlate, scale: number): number {
  const half = p.r * Math.cos(Math.PI / 6); // 尖端朝上的六角形左右半寬
  return Math.abs(p.x) * scale - half * scale;
}
