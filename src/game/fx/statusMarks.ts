/**
 * 身上帶著持續狀態時的小記號（第 200 輪，D-401）。純畫法，畫面層用；狀態多久、扣多少血在引擎。
 *
 * 灼燒＝身上竄著小火苗、中毒＝往上冒的綠色泡泡、緩速＝腳邊往下沉的藍紫色箭頭、
 * 破甲＝頭旁一面裂開的紅盾、虛弱＝頭旁一支灰紫色向下箭頭。
 *
 * 以前火苗和泡泡只寫在冒險地圖裡、只畫在怪身上：競技場裡自己被燒、被下毒只看得到血在掉；
 * 緩速（十七招會上）兩邊都完全沒有記號。抽出來讓冒險地圖和競技場共用同一套。
 */
interface Pen {
  fillStyle(color: number, alpha?: number): Pen;
  lineStyle(width: number, color: number, alpha?: number): Pen;
  fillEllipse(x: number, y: number, w: number, h: number): Pen;
  fillCircle(x: number, y: number, r: number): Pen;
  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): Pen;
  fillRect(x: number, y: number, w: number, h: number): Pen;
  lineBetween(x0: number, y0: number, x1: number, y1: number): Pen;
}

export const STATUS_MARK = {
  burn: 0xff6a1a,
  burnCore: 0xffd04a,
  burnGlow: 0xff7a2a,
  poison: 0x9aff5a,
  slow: 0x9a8aff,
  slowLit: 0xd8d0ff,
  /** 緩速箭頭：一輪幾毫秒、往下沉多少（單位＝半徑）、幾支 */
  slowMs: 1100,
  slowDrop: 0.55,
  slowN: 2,
} as const;

/** 灼燒：一層會閃的橘光＋五根火苗。bodyH＝腳到頭的高度 */
export function drawBurn(g: Pen, id: number, px: number, py: number, bodyH: number, now: number): void {
  g.fillStyle(STATUS_MARK.burnGlow, 0.16 + 0.08 * Math.sin(now / 70 + id)).fillEllipse(px, py - bodyH * 0.45, bodyH * 1.1, bodyH * 1.2);
  for (let q = 0; q < 5; q++) {
    const fx1 = px + (q - 2) * bodyH * 0.15;
    const fy1 = py - bodyH * (0.28 + 0.12 * (q % 2));
    const hh = bodyH * (0.32 + 0.12 * Math.sin(now / 80 + q * 2 + id));
    const w0 = bodyH * 0.09;
    g.fillStyle(STATUS_MARK.burn, 0.8).fillTriangle(fx1 - w0, fy1, fx1 + w0, fy1, fx1 + Math.sin(now / 120 + q) * w0 * 0.6, fy1 - hh);
    g.fillStyle(STATUS_MARK.burnCore, 0.95).fillTriangle(fx1 - w0 * 0.45, fy1, fx1 + w0 * 0.45, fy1, fx1, fy1 - hh * 0.55);
  }
}

/** 中毒：四顆往上冒、越高越小越淡的綠泡泡 */
export function drawPoison(g: Pen, id: number, px: number, py: number, r: number, bodyH: number, now: number): void {
  for (let q = 0; q < 4; q++) {
    const t = (now / 900 + q / 4 + id * 0.13) % 1;
    g.fillStyle(STATUS_MARK.poison, 0.8 * (1 - t)).fillCircle(px + Math.sin(q * 2.3 + id) * r * 0.6, py - bodyH * (0.3 + 0.6 * t), 4 + 4 * (1 - t));
  }
}

export interface SlowChevron {
  /** 相對腳下（單位＝半徑；y 往下為正） */
  x: number;
  y: number;
  /** 0～1 */
  a: number;
}

/**
 * 緩速：腳兩側各一串往下沉的小箭頭（「被往下拖」）。往下沉、越沉越淡——和火苗、泡泡的「往上」分得開，不靠顏色也認得。
 * 只在腳邊，不擋身體與血條。
 */
export function slowChevrons(id: number, now: number): SlowChevron[] {
  const out: SlowChevron[] = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < STATUS_MARK.slowN; k++) {
      const t = (((now / STATUS_MARK.slowMs + k / STATUS_MARK.slowN + (side > 0 ? 0.25 : 0) + id * 0.37) % 1) + 1) % 1;
      out.push({ x: side * 1.15, y: -0.5 + t * STATUS_MARK.slowDrop, a: t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8 });
    }
  }
  return out;
}

export function drawSlow(g: Pen, id: number, px: number, py: number, r: number, now: number): void {
  const w = Math.max(6, r * 0.36);
  for (const c of slowChevrons(id, now)) {
    const x = px + c.x * r;
    const y = py + c.y * r;
    g.fillStyle(0x1a1438, 0.5 * c.a).fillTriangle(x - w - 1.5, y - 1.5, x + w + 1.5, y - 1.5, x, y + w + 2);
    g.fillStyle(STATUS_MARK.slow, 0.95 * c.a).fillTriangle(x - w, y, x + w, y, x, y + w);
    g.fillStyle(STATUS_MARK.slowLit, 0.9 * c.a).fillTriangle(x - w * 0.45, y, x + w * 0.45, y, x, y + w * 0.45);
  }
}

/** 破甲：頭的左邊一面裂開的紅盾 */
export function drawBreak(g: Pen, px: number, r: number, headY: number): void {
  const bx = px - r - 4;
  const by = headY + 10;
  g.fillStyle(0xff5a3a, 1).fillTriangle(bx - 7, by - 7, bx + 7, by - 7, bx, by + 9);
  g.lineStyle(2, 0x2a0a00, 1).lineBetween(bx - 2, by - 7, bx + 2, by + 1);
}

/** 虛弱：頭的右邊一支灰紫色向下箭頭 */
export function drawWeak(g: Pen, px: number, r: number, headY: number): void {
  const wx = px + r + 4;
  const wy = headY - 6;
  g.fillStyle(0xb08aff, 1).fillTriangle(wx - 6, wy, wx + 6, wy, wx, wy + 9);
  g.fillRect(wx - 2, wy - 7, 4, 7);
}
