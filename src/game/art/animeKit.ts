// 動漫風立繪的 Canvas 2D 繪圖工具（不依賴 Phaser，可在測試頁面直接畫）。
// 做法：平滑曲線 Path2D → 底色漸層 → 賽璐珞陰影（裁切後疊色塊）→ 邊緣光（evenodd 月牙）→ 線稿。

export type P = [number, number] | [number, number, 1];
export type C = CanvasRenderingContext2D;

const isSharp = (p: P): boolean => p.length === 3;

/** Catmull-Rom 平滑曲線；第三個元素為 1 的點保持尖角（髮尖、下巴）。 */
export function curve(pts: P[], closed = true, tension = 1): Path2D {
  const path = new Path2D();
  const n = pts.length;
  if (n < 2) return path;
  const at = (i: number): P => (closed ? pts[((i % n) + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  path.moveTo(pts[0]![0], pts[0]![1]);
  const segs = closed ? n : n - 1;
  const k = tension / 6;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1x = isSharp(p1) ? p1[0] : p1[0] + (p2[0] - p0[0]) * k;
    const c1y = isSharp(p1) ? p1[1] : p1[1] + (p2[1] - p0[1]) * k;
    const c2x = isSharp(p2) ? p2[0] : p2[0] - (p3[0] - p1[0]) * k;
    const c2y = isSharp(p2) ? p2[1] : p2[1] - (p3[1] - p1[1]) * k;
    path.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
  }
  if (closed) path.closePath();
  return path;
}

/** 一綹頭髮：兩個髮根、尖端、彎曲量（正值往右彎）。 */
export function lock(rootL: P, rootR: P, tip: P, bend = 0, belly = 0.5, puff = 0.18): Path2D {
  const p = new Path2D();
  const mx = (a: P, b: P, t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const [lx, ly] = mx(rootL, tip, belly);
  const [rx, ry] = mx(rootR, tip, belly);
  const w = Math.hypot(rootR[0] - rootL[0], rootR[1] - rootL[1]) * puff;
  p.moveTo(rootL[0], rootL[1]);
  p.quadraticCurveTo(lx + bend - w, ly, tip[0], tip[1]);
  p.quadraticCurveTo(rx + bend + w, ry, rootR[0], rootR[1]);
  p.closePath();
  return p;
}

/** 一綹頭髮的兩側邊線（不含髮根），用於描線：髮根埋在髮團裡不畫線。 */
export function lockEdges(rootL: P, rootR: P, tip: P, bend = 0, belly = 0.5, puff = 0.18): Path2D {
  const p = new Path2D();
  const mx = (a: P, b: P, t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const [lx, ly] = mx(rootL, tip, belly);
  const [rx, ry] = mx(rootR, tip, belly);
  const w = Math.hypot(rootR[0] - rootL[0], rootR[1] - rootL[1]) * puff;
  p.moveTo(rootL[0], rootL[1]);
  p.quadraticCurveTo(lx + bend - w, ly, tip[0], tip[1]);
  p.quadraticCurveTo(rx + bend + w, ry, rootR[0], rootR[1]);
  return p;
}

export function vgrad(c: C, y0: number, y1: number, stops: [number, string][], x = 0): CanvasGradient {
  const g = c.createLinearGradient(x, y0, x, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

export function lgrad(c: C, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

export function rgrad(c: C, x: number, y: number, r0: number, r1: number, stops: [number, string][]): CanvasGradient {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

export function fill(c: C, path: Path2D, style: string | CanvasGradient, alpha = 1): void {
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = style;
  c.fill(path);
  c.restore();
}

export function line(c: C, path: Path2D, color: string, w: number, alpha = 1): void {
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke(path);
  c.restore();
}

/** 在 base 範圍內畫東西（裁切）。 */
export function within(c: C, base: Path2D, draw: () => void): void {
  c.save();
  c.clip(base);
  draw();
  c.restore();
}

/** 賽璐珞陰影：base 內疊一塊陰影形狀。 */
export function shade(c: C, base: Path2D, shadow: Path2D, color: string | CanvasGradient, alpha = 1): void {
  within(c, base, () => fill(c, shadow, color, alpha));
}

/** 邊緣光：base 內、但不在「base 往 (dx,dy) 平移」內的月牙區域。(dx,dy) 指向遠離光源的方向。 */
export function rim(c: C, base: Path2D, dx: number, dy: number, color: string | CanvasGradient, alpha = 1): void {
  const m = new Path2D();
  m.rect(-4000, -4000, 8000, 8000);
  m.addPath(base, new DOMMatrix().translate(dx, dy));
  within(c, base, () => {
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fill(m, 'evenodd');
    c.restore();
  });
}

/** 一個完整的部件：底色 → 陰影 → 邊緣光 → 線稿。 */
export function part(
  c: C, base: Path2D,
  o: {
    fill: string | CanvasGradient; shadow?: Path2D; shadowColor?: string | CanvasGradient; shadowAlpha?: number;
    rim?: [number, number, string | CanvasGradient, number?]; ink?: string; inkW?: number; extra?: () => void;
  },
): void {
  fill(c, base, o.fill);
  if (o.shadow && o.shadowColor) shade(c, base, o.shadow, o.shadowColor, o.shadowAlpha ?? 1);
  if (o.extra) within(c, base, o.extra);
  if (o.rim) rim(c, base, o.rim[0], o.rim[1], o.rim[2], o.rim[3] ?? 1);
  if (o.ink) line(c, base, o.ink, o.inkW ?? 3);
}

export function glow(c: C, x: number, y: number, r: number, color: string, a = 1): void {
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = a;
  c.fillStyle = rgrad(c, x, y, 0, r, [[0, color], [0.35, color.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.4})`)], [1, color.replace(/[\d.]+\)$/, '0)')]]);
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

export function sparkle(c: C, x: number, y: number, r: number, color: string, a = 1): void {
  glow(c, x, y, r * 2.4, color, 0.7 * a);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = a;
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x, y, x + r * 0.32, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r * 0.32, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.moveTo(x - r * 0.7, y);
  c.quadraticCurveTo(x, y, x, y - r * 0.18);
  c.quadraticCurveTo(x, y, x + r * 0.7, y);
  c.quadraticCurveTo(x, y, x, y + r * 0.18);
  c.quadraticCurveTo(x, y, x - r * 0.7, y);
  c.fill();
  c.restore();
}

export interface EyeStyle {
  /** 虹膜：上（深）、中、下（亮） */
  iris: [string, string, string];
  ink: string;
  /** 下方反光色（加亮混合） */
  shine: string;
  /** 眼睛高度 / 寬度 */
  open: number;
  /** 外眼角上揚（px） */
  lift: number;
  /** 睫毛粗細 */
  lash: number;
  /** 女性：外眼角睫毛分岔 */
  flick?: boolean;
  /** 虹膜看向（-1 左 ~ 1 右） */
  look?: number;
}

/**
 * 動漫眼睛。side=-1 為畫面左側那隻（外眼角在左）。
 * 高光方向兩眼一致（左上大、右下小）。
 */
export function animeEye(c: C, cx: number, cy: number, w: number, side: 1 | -1, st: EyeStyle): void {
  const h = w * st.open;
  const X = (lx: number): number => cx + side * lx;
  const inner: P = [X(-w * 0.5), cy + h * 0.12, 1];
  const outer: P = [X(w * 0.5), cy - st.lift, 1];
  const white = curve([
    inner,
    [X(-w * 0.28), cy - h * 0.42],
    [X(w * 0.05), cy - h * 0.56],
    [X(w * 0.34), cy - h * 0.42 - st.lift * 0.6],
    outer,
    [X(w * 0.3), cy + h * 0.36],
    [X(-w * 0.05), cy + h * 0.46],
    [X(-w * 0.34), cy + h * 0.34],
  ]);
  fill(c, white, '#fffaf6');
  // 上眼瞼投影
  shade(c, white, curve([[cx - w, cy - h], [cx + w, cy - h], [cx + w, cy - h * 0.18], [cx, cy - h * 0.05], [cx - w, cy - h * 0.18]]), 'rgba(120,130,170,0.45)');
  // 虹膜
  const ix = cx + (st.look ?? 0) * w * 0.08;
  const iy = cy + h * 0.06;
  const irx = w * 0.29;
  const iry = h * 0.56;
  within(c, white, () => {
    const iris = new Path2D();
    iris.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
    fill(c, iris, vgrad(c, iy - iry, iy + iry, [[0, st.iris[0]], [0.45, st.iris[1]], [1, st.iris[2]]]));
    // 虹膜放射紋
    c.save();
    c.clip(iris);
    c.globalAlpha = 0.25;
    c.strokeStyle = st.iris[0];
    c.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      c.beginPath();
      c.moveTo(ix + Math.cos(a) * irx * 0.35, iy + Math.sin(a) * iry * 0.35);
      c.lineTo(ix + Math.cos(a) * irx, iy + Math.sin(a) * iry);
      c.stroke();
    }
    c.restore();
    // 瞳孔
    const pupil = new Path2D();
    pupil.ellipse(ix, iy - iry * 0.05, irx * 0.42, iry * 0.46, 0, 0, Math.PI * 2);
    fill(c, pupil, st.iris[0]);
    fill(c, pupil, 'rgba(0,0,0,0.55)');
    // 上半部陰影
    const top = new Path2D();
    top.ellipse(ix, iy - iry * 0.75, irx * 1.2, iry * 0.55, 0, 0, Math.PI * 2);
    within(c, iris, () => fill(c, top, 'rgba(10,10,30,0.4)'));
    // 下方反光（加亮）
    c.save();
    c.clip(iris);
    c.globalCompositeOperation = 'lighter';
    const sh = new Path2D();
    sh.ellipse(ix, iy + iry * 0.62, irx * 0.75, iry * 0.38, 0, 0, Math.PI * 2);
    c.fillStyle = rgrad(c, ix, iy + iry * 0.7, 0, irx * 0.9, [[0, st.shine], [1, 'rgba(0,0,0,0)']]);
    c.fill(sh);
    c.restore();
    line(c, iris, st.iris[0], 2.2, 0.9);
    // 高光
    const h1 = new Path2D();
    h1.ellipse(ix - irx * 0.38, iy - iry * 0.38, irx * 0.34, iry * 0.24, -0.5, 0, Math.PI * 2);
    fill(c, h1, '#ffffff');
    const h2 = new Path2D();
    h2.ellipse(ix + irx * 0.42, iy + iry * 0.4, irx * 0.14, iry * 0.1, 0, 0, Math.PI * 2);
    fill(c, h2, '#ffffff', 0.9);
    const h3 = new Path2D();
    h3.arc(ix + irx * 0.18, iy - iry * 0.52, irx * 0.08, 0, Math.PI * 2);
    fill(c, h3, '#ffffff', 0.8);
  });
  // 上睫毛線（粗、外側更粗）
  const t = st.lash;
  const lash = curve([
    [X(-w * 0.56), cy + h * 0.16, 1],
    [X(-w * 0.3), cy - h * 0.44],
    [X(w * 0.05), cy - h * 0.6],
    [X(w * 0.36), cy - h * 0.46 - st.lift * 0.6],
    [X(w * 0.6), cy - st.lift - t * 0.2, 1],
    ...(st.flick ? ([[X(w * 0.72), cy - st.lift - t * 1.1, 1], [X(w * 0.58), cy - st.lift - t * 0.9]] as P[]) : []),
    [X(w * 0.64), cy - st.lift - t * 1.2, 1],
    [X(w * 0.36), cy - h * 0.46 - st.lift * 0.6 - t * 1.1],
    [X(w * 0.05), cy - h * 0.6 - t * 0.9],
    [X(-w * 0.32), cy - h * 0.44 - t * 0.6],
  ]);
  fill(c, lash, st.ink);
  // 雙眼皮
  line(c, curve([[X(-w * 0.2), cy - h * 0.72], [X(w * 0.12), cy - h * 0.8], [X(w * 0.42), cy - h * 0.66 - st.lift * 0.5]], false), st.ink, 1.6, 0.55);
  // 下睫毛
  line(c, curve([[X(w * 0.48), cy - st.lift * 0.6 + h * 0.08], [X(w * 0.28), cy + h * 0.4], [X(w * 0.0), cy + h * 0.48]], false), st.ink, 1.8, 0.7);
  line(c, white, st.ink, 1, 0.25);
}
