// 對話用地點背景（Canvas 程序繪製，一次生成後快取成材質）。
import Phaser from 'phaser';

export type BackdropId =
  | 'town' | 'tavern' | 'forest' | 'lake' | 'ruins' | 'mine' | 'bellhall' | 'deep'
  | 'capital_gate' | 'capital' | 'tourney' | 'inn' | 'market' | 'academy' | 'rooftop' | 'sewer';

// 注意：不能在模組頂層引用 config 的常數（config → scenes → 這裡 會循環 import）
const W = 720;
const H = 1280;

function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function grad(c: CanvasRenderingContext2D, stops: [number, string][]): void {
  const g = c.createLinearGradient(0, 0, 0, H);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  const g = c.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

function pine(c: CanvasRenderingContext2D, x: number, base: number, w: number, h: number): void {
  for (let k = 0; k < 4; k++) {
    const bw = (w / 2) * (1 - k * 0.2);
    const by = base - (h * k) / 4.2;
    c.beginPath();
    c.moveTo(x - bw, by);
    c.lineTo(x, by - h * 0.42);
    c.lineTo(x + bw, by);
    c.closePath();
    c.fill();
  }
}

/** 隧道木支架（梯形透視框）。 */
function timberFrame(c: CanvasRenderingContext2D, cx: number, top: number, bot: number, half: number, f: number): void {
  const t = 26 * f;
  c.fillStyle = `rgb(${46 * f + 14},${30 * f + 10},${18 * f + 8})`;
  c.fillRect(cx - half - t / 2, top, t, bot - top);
  c.fillRect(cx + half - t / 2, top, t, bot - top);
  c.fillRect(cx - half - t, top - t * 0.6, half * 2 + t * 2, t * 1.1);
  c.fillStyle = `rgba(255,180,100,${0.18 * f})`;
  c.fillRect(cx - half - t, top - t * 0.6, half * 2 + t * 2, 3 * f);
  c.fillRect(cx - half - t / 2, top, 3 * f, bot - top);
}

/** 星礦脈：細碎的藍色發光線段。 */
function oreVein(c: CanvasRenderingContext2D, r: () => number, x: number, y: number, len: number, col: string): void {
  c.strokeStyle = col;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x, y);
  let px = x;
  let py = y;
  for (let i = 0; i < 5; i++) {
    px += (len / 5) * (0.6 + r() * 0.8);
    py += (r() - 0.5) * 30;
    c.lineTo(px, py);
  }
  c.stroke();
}

/** 結晶簇。 */
function crystal(c: CanvasRenderingContext2D, x: number, y: number, h: number, tilt: number, fill: string, edge: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(-h * 0.18, 0);
  c.lineTo(-h * 0.14, -h * 0.75);
  c.lineTo(0, -h);
  c.lineTo(h * 0.14, -h * 0.75);
  c.lineTo(h * 0.18, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(0, -h);
  c.lineTo(0, 0);
  c.stroke();
  c.restore();
}

/** 遠古巨鐘剪影（含裂痕）。 */
function bell(c: CanvasRenderingContext2D, cx: number, top: number, w: number, h: number, body: string | CanvasGradient, rim: string): void {
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(cx - w * 0.16, top);
  c.quadraticCurveTo(cx - w * 0.34, top + h * 0.05, cx - w * 0.34, top + h * 0.4);
  c.quadraticCurveTo(cx - w * 0.36, top + h * 0.82, cx - w * 0.5, top + h);
  c.lineTo(cx + w * 0.5, top + h);
  c.quadraticCurveTo(cx + w * 0.36, top + h * 0.82, cx + w * 0.34, top + h * 0.4);
  c.quadraticCurveTo(cx + w * 0.34, top + h * 0.05, cx + w * 0.16, top);
  c.closePath();
  c.fill();
  // 鐘頂環（吊耳）
  c.beginPath();
  c.ellipse(cx, top - h * 0.03, w * 0.07, h * 0.07, 0, Math.PI, 0);
  c.fill();
  c.strokeStyle = body;
  c.lineWidth = w * 0.035;
  c.beginPath();
  c.arc(cx, top - h * 0.08, w * 0.06, Math.PI, 0);
  c.stroke();
  // 唇緣
  c.fillRect(cx - w * 0.52, top + h - h * 0.05, w * 1.04, h * 0.07);
  // 邊緣光＋紋帶
  c.strokeStyle = rim;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(cx - w * 0.16, top);
  c.quadraticCurveTo(cx - w * 0.34, top + h * 0.05, cx - w * 0.34, top + h * 0.4);
  c.quadraticCurveTo(cx - w * 0.36, top + h * 0.82, cx - w * 0.5, top + h);
  c.stroke();
  for (const k of [0.3, 0.78]) {
    const hw = k < 0.5 ? w * 0.34 : w * 0.42;
    c.beginPath();
    c.moveTo(cx - hw, top + h * k);
    c.lineTo(cx + hw, top + h * k);
    c.stroke();
  }
}

// ======================================================================
// 第三章「星冠」：王都星冠城
// ======================================================================
type C2 = CanvasRenderingContext2D;
type Ch3Id = 'capital_gate' | 'capital' | 'tourney' | 'inn' | 'market' | 'academy' | 'rooftop' | 'sewer';

function stars(c: C2, r: () => number, n: number, maxY: number): void {
  for (let i = 0; i < n; i++) {
    const s = r() < 0.12 ? 2.2 : 1.3;
    c.fillStyle = `rgba(230,236,255,${0.15 + r() * 0.6})`;
    c.fillRect(r() * W, r() * maxY, s, s);
  }
}

/** 尖塔剪影（塔身＋尖頂＋一格窗光）。 */
function spire(c: C2, x: number, base: number, w: number, h: number, body: string, win?: string): void {
  c.fillStyle = body;
  c.fillRect(x - w / 2, base - h * 0.62, w, h * 0.62);
  c.beginPath();
  c.moveTo(x - w * 0.62, base - h * 0.62);
  c.lineTo(x, base - h);
  c.lineTo(x + w * 0.62, base - h * 0.62);
  c.closePath();
  c.fill();
  if (win) {
    c.fillStyle = win;
    c.fillRect(x - w * 0.12, base - h * 0.55, w * 0.24, h * 0.06);
  }
}

/** 星冠塔：收窄的塔身，頂端五尖冠環，冠尖點金光，冠上懸一顆星。 */
function crownTower(c: C2, x: number, base: number, w: number, h: number, body: string, light: number): void {
  const top = base - h * 0.78;
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(x - w * 0.5, base);
  c.lineTo(x - w * 0.3, top);
  c.lineTo(x + w * 0.3, top);
  c.lineTo(x + w * 0.5, base);
  c.closePath();
  c.fill();
  // 冠環
  const cw = w * 0.95;
  const peaks: [number, number][] = [];
  c.beginPath();
  c.moveTo(x - cw * 0.42, top + h * 0.03);
  for (let i = 0; i <= 8; i++) {
    const px = x - cw / 2 + (cw * i) / 8;
    const py = top - (i % 2 === 0 ? h * (i === 4 ? 0.2 : 0.14) : h * 0.05);
    c.lineTo(px, py);
    if (i % 2 === 0) peaks.push([px, py]);
  }
  c.lineTo(x + cw * 0.42, top + h * 0.03);
  c.closePath();
  c.fill();
  if (light <= 0) return;
  // 冠帶與窗列
  c.fillStyle = `rgba(255,200,120,${0.5 * light})`;
  c.fillRect(x - cw * 0.42, top - h * 0.01, cw * 0.84, Math.max(2, h * 0.008));
  for (let k = 1; k < 7; k++) {
    const yy = top + (h * 0.78 * k) / 7;
    const ww = w * (0.3 + (0.2 * k) / 7);
    c.fillStyle = `rgba(255,200,130,${(0.18 + (k % 2) * 0.12) * light})`;
    c.fillRect(x - ww * 0.18, yy, ww * 0.36, Math.max(2, h * 0.012));
  }
  for (const [px, py] of peaks) {
    glow(c, px, py, 26 * light + 6, `rgba(255,210,130,${0.55 * light})`);
    c.fillStyle = `rgba(255,240,200,${light})`;
    c.beginPath();
    c.arc(px, py, Math.max(1.5, w * 0.025), 0, Math.PI * 2);
    c.fill();
  }
  const sy = top - h * 0.27;
  glow(c, x, sy, 60 * light + 10, `rgba(255,220,150,${0.6 * light})`);
  c.fillStyle = `rgba(255,248,225,${light})`;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = (i % 2 === 0 ? 1 : 0.4) * Math.max(4, w * 0.09);
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    c.lineTo(x + Math.cos(a) * rr, sy + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

/** 紙燈籠（暖光暈＋上下木蓋）。col = 'r,g,b'。 */
function paperLantern(c: C2, x: number, y: number, s: number, col: string): void {
  glow(c, x, y, 54 * s, `rgba(${col},0.32)`);
  const g = c.createRadialGradient(x - 3 * s, y - 4 * s, 1, x, y, 16 * s);
  g.addColorStop(0, '#fff6d8');
  g.addColorStop(0.45, `rgb(${col})`);
  g.addColorStop(1, `rgba(${col},0.55)`);
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y, 11 * s, 14 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(90,30,10,0.45)';
  c.lineWidth = 1;
  for (const k of [-0.5, 0, 0.5]) {
    c.beginPath();
    c.ellipse(x, y, 11 * s * Math.cos(k), 14 * s, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = '#2a140c';
  c.fillRect(x - 6 * s, y - 16 * s, 12 * s, 4 * s);
  c.fillRect(x - 5 * s, y + 13 * s, 10 * s, 3 * s);
}

function moon(c: C2, x: number, y: number, rad: number): void {
  glow(c, x, y, rad * 3, 'rgba(190,210,255,0.22)');
  glow(c, x, y, rad * 1.6, 'rgba(220,230,255,0.35)');
  const g = c.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
  g.addColorStop(0, '#fbf8ee');
  g.addColorStop(0.7, '#dfe2ee');
  g.addColorStop(1, '#b4bcd6');
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, rad, 0, Math.PI * 2);
  c.fill();
  const r = rng(Math.round(rad * 7));
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * rad * 0.75;
    c.fillStyle = `rgba(120,130,170,${0.08 + r() * 0.12})`;
    c.beginPath();
    c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rad * (0.04 + r() * 0.12), 0, Math.PI * 2);
    c.fill();
  }
}

/** 路燈（鐵柱＋燈籠罩＋光暈）。 */
function streetLamp(c: C2, x: number, base: number, h: number, s: number, col = '255,200,130'): void {
  c.fillStyle = '#07050a';
  c.fillRect(x - 3 * s, base - h, 6 * s, h);
  c.fillRect(x - 10 * s, base - 8 * s, 20 * s, 8 * s);
  glow(c, x, base - h - 10 * s, 120 * s, `rgba(${col},0.45)`);
  c.fillStyle = '#100a0c';
  c.beginPath();
  c.moveTo(x - 12 * s, base - h - 20 * s);
  c.lineTo(x, base - h - 32 * s);
  c.lineTo(x + 12 * s, base - h - 20 * s);
  c.fill();
  c.fillStyle = `rgb(${col})`;
  c.fillRect(x - 8 * s, base - h - 20 * s, 16 * s, 18 * s);
  c.fillStyle = 'rgba(255,255,240,0.9)';
  c.fillRect(x - 3 * s, base - h - 16 * s, 6 * s, 10 * s);
}

function city(c: C2, r: () => number, base: number, n: number, body: string, win: string, minH: number, maxH: number): void {
  for (let i = 0; i < n; i++) {
    const x = (i / n) * W + r() * 30 - 10;
    const w = 26 + r() * 40;
    const h = minH + r() * (maxH - minH);
    if (r() < 0.35) spire(c, x, base, w * 0.6, h * 1.6, body, win);
    else {
      c.fillStyle = body;
      c.fillRect(x - w / 2, base - h, w, h);
      c.beginPath();
      c.moveTo(x - w / 2 - 4, base - h);
      c.lineTo(x, base - h - w * 0.45);
      c.lineTo(x + w / 2 + 4, base - h);
      c.fill();
      if (r() < 0.7) {
        c.fillStyle = win;
        c.fillRect(x - 4, base - h * 0.7, 6, 8);
      }
    }
  }
}

const DRAW_CH3: Record<Ch3Id, (c: C2) => void> = {
  // 王都城門（黃昏）：夕陽從巨大拱門後透出，兩座塔樓垂著星冠紋章旗。
  capital_gate: (c) => {
    grad(c, [[0, '#110b22'], [0.24, '#34203e'], [0.42, '#8a4438'], [0.52, '#e08a4a'], [0.56, '#2a1620'], [1, '#07050a']]);
    const r = rng(51);
    stars(c, r, 50, 260);
    glow(c, 360, 690, 560, 'rgba(255,140,70,0.32)');
    glow(c, 360, 700, 150, 'rgba(255,225,170,0.7)');
    for (let i = 0; i < 18; i++) spire(c, 10 + i * 42 + r() * 16, 700, 14 + r() * 14, 110 + r() * 190, 'rgba(70,34,52,0.7)');
    crownTower(c, 360, 690, 96, 560, 'rgba(46,22,40,0.92)', 0.75);
    // 城牆
    c.fillStyle = '#140a14';
    c.fillRect(0, 640, W, 360);
    for (let x = 0; x < W; x += 40) c.fillRect(x, 620, 24, 22);
    c.fillStyle = 'rgba(255,170,100,0.4)';
    c.fillRect(0, 640, W, 2);
    for (let x = 0; x < W; x += 40) c.fillRect(x, 620, 24, 2);
    // 石磚紋
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 1.5;
    for (let y = 670; y < 1000; y += 34) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }
    // 兩側塔樓
    for (const side of [-1, 1]) {
      const cx = 360 + side * 215;
      c.fillStyle = '#0f070f';
      c.fillRect(cx - 95, 380, 190, 640);
      c.fillStyle = 'rgba(255,160,90,0.45)';
      c.fillRect(side < 0 ? cx + 92 : cx - 95, 380, 3, 640);
      c.fillStyle = '#0b050b';
      c.beginPath();
      c.moveTo(cx - 112, 384);
      c.lineTo(cx, 150);
      c.lineTo(cx + 112, 384);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,170,100,0.5)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(cx, 150);
      c.lineTo(cx - side * 112, 384);
      c.stroke();
      c.fillStyle = '#0b050b';
      c.fillRect(cx - 2, 110, 4, 44);
      glow(c, cx, 108, 24, 'rgba(255,210,140,0.7)');
      // 箭窗
      for (const y of [460, 560]) {
        c.fillStyle = 'rgba(255,180,100,0.85)';
        c.fillRect(cx - side * 52 - 4, y, 8, 26);
        glow(c, cx - side * 52, y + 13, 30, 'rgba(255,170,90,0.3)');
      }
      // 旗幟
      const bx = cx + side * 18;
      const bg = c.createLinearGradient(bx - 36, 0, bx + 36, 0);
      bg.addColorStop(side < 0 ? 1 : 0, '#8a2a30');
      bg.addColorStop(side < 0 ? 0 : 1, '#3a0c16');
      c.fillStyle = bg;
      c.beginPath();
      c.moveTo(bx - 36, 410);
      c.lineTo(bx + 36, 410);
      c.lineTo(bx + 36, 660);
      c.lineTo(bx, 630);
      c.lineTo(bx - 36, 660);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,205,120,0.7)';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#1a0a0c';
      c.fillRect(bx - 44, 402, 88, 10);
      glow(c, bx, 500, 40, 'rgba(255,210,130,0.45)');
      c.fillStyle = '#ffd890';
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? 18 : 7;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        c.lineTo(bx + Math.cos(a) * rr, 500 + Math.sin(a) * rr);
      }
      c.closePath();
      c.fill();
    }
    // 中央門樓與拱門（門內透出夕光）
    c.fillStyle = '#120912';
    c.fillRect(262, 470, 196, 560);
    for (let x = 262; x < 458; x += 28) c.fillRect(x, 452, 18, 20);
    const arch = (): void => {
      c.beginPath();
      c.moveTo(292, 1010);
      c.lineTo(292, 650);
      c.quadraticCurveTo(292, 548, 360, 540);
      c.quadraticCurveTo(428, 548, 428, 650);
      c.lineTo(428, 1010);
      c.closePath();
    };
    const ag = c.createLinearGradient(0, 540, 0, 1010);
    ag.addColorStop(0, '#ffe0a8');
    ag.addColorStop(0.35, '#ff9a5a');
    ag.addColorStop(1, '#5a2418');
    c.fillStyle = ag;
    arch();
    c.fill();
    c.strokeStyle = 'rgba(255,200,130,0.85)';
    c.lineWidth = 4;
    arch();
    c.stroke();
    // 升起的閘門
    c.fillStyle = 'rgba(20,10,14,0.85)';
    for (let x = 300; x < 424; x += 16) c.fillRect(x, 548, 5, 70);
    c.fillRect(296, 600, 128, 5);
    for (let x = 300; x < 424; x += 16) {
      c.beginPath();
      c.moveTo(x - 1, 618);
      c.lineTo(x + 2.5, 632);
      c.lineTo(x + 6, 618);
      c.fill();
    }
    // 拱心石的星紋
    glow(c, 360, 520, 44, 'rgba(255,220,150,0.6)');
    c.fillStyle = '#ffe6b0';
    c.beginPath();
    c.moveTo(360, 506);
    c.lineTo(366, 520);
    c.lineTo(360, 534);
    c.lineTo(354, 520);
    c.fill();
    // 門內遠處的人影
    c.fillStyle = 'rgba(60,24,20,0.75)';
    for (const [x, h] of [[330, 46], [346, 40], [392, 50]] as [number, number][]) {
      c.fillRect(x - 5, 1010 - h - 60, 10, h);
      c.beginPath();
      c.arc(x, 1010 - h - 66, 6, 0, Math.PI * 2);
      c.fill();
    }
    // 道路
    c.fillStyle = '#0a0608';
    c.beginPath();
    c.moveTo(292, 1010);
    c.lineTo(428, 1010);
    c.lineTo(W + 140, H);
    c.lineTo(-140, H);
    c.fill();
    glow(c, 360, 1040, 320, 'rgba(255,150,80,0.28)');
    c.strokeStyle = 'rgba(255,180,110,0.14)';
    c.lineWidth = 2;
    for (let y = 1024; y < H; y += (y - 980) * 0.4) {
      const t = (y - 1010) / (H - 1010);
      c.beginPath();
      c.moveTo(292 - t * 432, y);
      c.lineTo(428 + t * 432, y);
      c.stroke();
    }
    streetLamp(c, 150, 1180, 230, 1.1);
    streetLamp(c, 570, 1180, 230, 1.1);
    // 黃昏塵埃
    for (let i = 0; i < 60; i++) {
      c.fillStyle = `rgba(255,210,150,${0.12 + r() * 0.35})`;
      c.fillRect(200 + r() * 320, 500 + r() * 600, 1.6, 1.6);
    }
  },

  // 星冠廣場（入夜）：中央的星冠塔、群塔、星紋地磚與街燈。
  capital: (c) => {
    grad(c, [[0, '#05071a'], [0.32, '#121a3c'], [0.5, '#2a2650'], [0.58, '#141026'], [1, '#06050c']]);
    const r = rng(57);
    stars(c, r, 140, 560);
    glow(c, 360, 280, 420, 'rgba(255,200,120,0.1)');
    city(c, r, 720, 24, 'rgba(34,32,70,0.85)', 'rgba(255,200,130,0.45)', 80, 180);
    glow(c, 360, 200, 260, 'rgba(255,210,130,0.18)');
    crownTower(c, 360, 760, 170, 680, '#0d0b20', 1);
    c.strokeStyle = 'rgba(170,180,255,0.4)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(360 - 85, 760);
    c.lineTo(360 - 51, 760 - 680 * 0.78);
    c.stroke();
    // 兩側列柱建築
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 0 : 500;
      c.fillStyle = '#0c0a1a';
      c.fillRect(x0, 540, 220, 260);
      c.beginPath();
      c.moveTo(x0 - 10, 540);
      c.lineTo(x0 + 110, 470);
      c.lineTo(x0 + 230, 540);
      c.fill();
      c.strokeStyle = 'rgba(180,190,255,0.3)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x0 - 10, 540);
      c.lineTo(x0 + 110, 470);
      c.lineTo(x0 + 230, 540);
      c.stroke();
      for (let k = 0; k < 5; k++) {
        const cx = x0 + 22 + k * 44;
        c.fillStyle = 'rgba(255,190,120,0.22)';
        c.fillRect(cx + 6, 570, 26, 180);
        c.fillStyle = '#16142a';
        c.fillRect(cx - 4, 556, 12, 230);
        c.fillStyle = 'rgba(190,200,255,0.25)';
        c.fillRect(cx - 4, 556, 2, 230);
      }
    }
    // 廣場地面＋星紋馬賽克
    const fg = c.createLinearGradient(0, 780, 0, H);
    fg.addColorStop(0, '#15122a');
    fg.addColorStop(1, '#05040a');
    c.fillStyle = fg;
    c.fillRect(0, 780, W, H - 780);
    glow(c, 360, 960, 380, 'rgba(255,200,130,0.12)');
    c.strokeStyle = 'rgba(255,210,140,0.28)';
    c.lineWidth = 2;
    for (const rx of [320, 230, 140, 60]) {
      c.beginPath();
      c.ellipse(360, 980, rx, rx * 0.3, 0, 0, Math.PI * 2);
      c.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      c.beginPath();
      c.moveTo(360 + Math.cos(a) * 60, 980 + Math.sin(a) * 18);
      c.lineTo(360 + Math.cos(a) * 320, 980 + Math.sin(a) * 96);
      c.stroke();
    }
    glow(c, 360, 980, 70, 'rgba(255,220,150,0.5)');
    streetLamp(c, 70, 1060, 300, 1.2);
    streetLamp(c, 650, 1060, 300, 1.2);
    streetLamp(c, 200, 860, 150, 0.7);
    streetLamp(c, 520, 860, 150, 0.7);
  },

  // 比武大廳：垂掛的旗幟、看台人影，頂上的光柱照著中央牌桌。
  tourney: (c) => {
    grad(c, [[0, '#0a0610'], [0.45, '#1c0e1c'], [1, '#050306']]);
    const r = rng(61);
    // 背牆拱窗
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 140;
      c.fillStyle = 'rgba(60,40,80,0.35)';
      c.beginPath();
      c.moveTo(x - 34, 520);
      c.lineTo(x - 34, 260);
      c.arc(x, 260, 34, Math.PI, 0);
      c.lineTo(x + 34, 520);
      c.fill();
    }
    // 光柱
    for (const [w0, w1, a] of [[90, 330, 0.06], [50, 200, 0.08]] as [number, number, number][]) {
      c.fillStyle = `rgba(255,230,180,${a})`;
      c.beginPath();
      c.moveTo(360 - w0, 0);
      c.lineTo(360 + w0, 0);
      c.lineTo(360 + w1, 800);
      c.lineTo(360 - w1, 800);
      c.fill();
    }
    // 旗幟
    for (let i = 0; i < 7; i++) {
      const x = 50 + i * 103;
      const len = 330 + (i % 2) * 70 - Math.abs(i - 3) * 10;
      const red = i % 2 === 0;
      const bg = c.createLinearGradient(0, 0, 0, len);
      bg.addColorStop(0, red ? '#7a1a28' : '#1e2e6a');
      bg.addColorStop(1, red ? '#2a0810' : '#0a1028');
      c.fillStyle = bg;
      c.beginPath();
      c.moveTo(x - 30, 0);
      c.lineTo(x + 30, 0);
      c.lineTo(x + 30, len);
      c.lineTo(x, len - 26);
      c.lineTo(x - 30, len);
      c.fill();
      c.fillStyle = 'rgba(255,205,120,0.65)';
      c.fillRect(x - 30, 0, 3, len);
      c.fillRect(x + 27, 0, 3, len);
      // 紋章：牌面菱形／星
      const ey = len * 0.55;
      glow(c, x, ey, 30, 'rgba(255,210,130,0.3)');
      c.fillStyle = '#e8c070';
      c.beginPath();
      if (red) {
        c.moveTo(x, ey - 16);
        c.lineTo(x + 11, ey);
        c.lineTo(x, ey + 16);
        c.lineTo(x - 11, ey);
      } else {
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 === 0 ? 14 : 6;
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          c.lineTo(x + Math.cos(a) * rr, ey + Math.sin(a) * rr);
        }
      }
      c.closePath();
      c.fill();
    }
    // 吊燈
    c.strokeStyle = '#000';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(360, 0);
    c.lineTo(360, 120);
    c.stroke();
    c.strokeStyle = '#3a2a1a';
    c.lineWidth = 5;
    c.beginPath();
    c.ellipse(360, 130, 110, 20, 0, 0, Math.PI * 2);
    c.stroke();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const x = 360 + Math.cos(a) * 110;
      const y = 124 + Math.sin(a) * 20;
      glow(c, x, y, 26, 'rgba(255,200,120,0.6)');
      c.fillStyle = '#fff0c0';
      c.fillRect(x - 1.5, y - 8, 3, 8);
    }
    // 看台人影（兩側，三排）
    for (let row = 0; row < 3; row++) {
      const y = 470 + row * 70;
      const sc = 0.8 + row * 0.2;
      for (let x = 10; x < W; x += 30 * sc + r() * 8) {
        if (Math.abs(x - 360) < 150 - row * 10) continue;
        c.fillStyle = `rgb(${10 + row * 3},${8 + row * 2},${14 + row * 3})`;
        c.beginPath();
        c.arc(x, y, 10 * sc, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.ellipse(x, y + 26 * sc, 16 * sc, 18 * sc, 0, Math.PI, 0);
        c.fill();
        c.fillRect(x - 16 * sc, y + 26 * sc, 32 * sc, 40);
        if (r() < 0.4) {
          c.fillStyle = 'rgba(255,200,140,0.35)';
          c.fillRect(x + (x < 360 ? 7 : -9) * sc, y - 6 * sc, 2, 10 * sc);
        }
      }
      c.fillStyle = 'rgba(255,200,130,0.15)';
      c.fillRect(0, y + 62, W, 2);
    }
    // 地板＋光池
    const fg = c.createLinearGradient(0, 700, 0, H);
    fg.addColorStop(0, '#1a1018');
    fg.addColorStop(1, '#050306');
    c.fillStyle = fg;
    c.fillRect(0, 700, W, H - 700);
    glow(c, 360, 760, 300, 'rgba(255,220,160,0.3)');
    // 中央牌桌
    c.fillStyle = '#0c0608';
    c.beginPath();
    c.ellipse(360, 770, 236, 66, 0, 0, Math.PI);
    c.lineTo(124, 770);
    c.fill();
    c.fillRect(124, 744, 472, 30);
    c.fillStyle = '#2a1408';
    c.beginPath();
    c.ellipse(360, 744, 236, 64, 0, 0, Math.PI * 2);
    c.fill();
    const tg = c.createRadialGradient(360, 730, 10, 360, 744, 220);
    tg.addColorStop(0, '#2e6a50');
    tg.addColorStop(1, '#0a2418');
    c.fillStyle = tg;
    c.beginPath();
    c.ellipse(360, 744, 214, 54, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,210,130,0.8)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(360, 744, 236, 64, 0, Math.PI, Math.PI * 2);
    c.stroke();
    // 桌上的牌
    for (const [x, y, rot, glowc] of [[300, 740, -0.3, ''], [330, 736, -0.1, ''], [420, 742, 0.25, 'rgba(160,200,255,0.6)'], [380, 752, 0.05, 'rgba(255,200,120,0.6)']] as [number, number, number, string][]) {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.scale(1, 0.45);
      if (glowc) glow(c, 0, 0, 40, glowc);
      c.fillStyle = '#efe6d4';
      c.fillRect(-14, -20, 28, 40);
      c.strokeStyle = '#8a6a3a';
      c.lineWidth = 2;
      c.strokeRect(-11, -17, 22, 34);
      c.restore();
    }
    for (let k = 0; k < 5; k++) {
      c.fillStyle = k % 2 ? '#c8a050' : '#6a2a2a';
      c.beginPath();
      c.ellipse(250, 750 - k * 4, 13, 5, 0, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 50; i++) {
      c.fillStyle = `rgba(255,230,180,${0.1 + r() * 0.3})`;
      c.fillRect(260 + r() * 200, 100 + r() * 620, 1.5, 1.5);
    }
  },

  // 旅店房間（夜）：月光穿過窗格落在地板上，牆角斜倚著斧槍，桌上一支燭火。
  inn: (c) => {
    grad(c, [[0, '#0b0a14'], [0.55, '#18121e'], [1, '#070508']]);
    const r = rng(67);
    // 木板牆
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = 3;
    for (let x = 0; x < W; x += 48) {
      c.beginPath();
      c.moveTo(x + r() * 4, 0);
      c.lineTo(x, 820);
      c.stroke();
    }
    // 斜屋頂樑
    c.fillStyle = '#0a070c';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(W, 0);
    c.lineTo(W, 60);
    c.lineTo(0, 200);
    c.fill();
    c.fillStyle = '#140e12';
    c.fillRect(0, 196, W, 0);
    // 窗外夜景
    const wx = 90;
    const wy = 230;
    const ww = 230;
    const wh = 330;
    const sky = c.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, '#0e1636');
    sky.addColorStop(1, '#2a2a50');
    c.fillStyle = sky;
    c.fillRect(wx, wy, ww, wh);
    c.save();
    c.beginPath();
    c.rect(wx, wy, ww, wh);
    c.clip();
    stars(c, r, 30, wy + wh);
    moon(c, wx + 150, wy + 90, 42);
    city(c, r, wy + wh, 9, 'rgba(14,14,34,0.95)', 'rgba(255,200,130,0.7)', 40, 120);
    crownTower(c, wx + 70, wy + wh, 34, 250, 'rgba(14,14,34,0.95)', 0.6);
    c.restore();
    // 窗框
    c.fillStyle = '#1e140e';
    c.fillRect(wx - 14, wy - 14, ww + 28, 14);
    c.fillRect(wx - 14, wy + wh, ww + 28, 18);
    c.fillRect(wx - 14, wy, 14, wh);
    c.fillRect(wx + ww, wy, 14, wh);
    c.fillRect(wx + ww / 2 - 5, wy, 10, wh);
    c.fillRect(wx, wy + wh * 0.45 - 5, ww, 10);
    c.fillStyle = 'rgba(180,200,255,0.4)';
    c.fillRect(wx - 14, wy + wh + 0, ww + 28, 2);
    // 月光光束與地板上的窗影
    c.fillStyle = 'rgba(160,190,255,0.07)';
    c.beginPath();
    c.moveTo(wx, wy);
    c.lineTo(wx + ww, wy);
    c.lineTo(wx + ww + 300, 1080);
    c.lineTo(wx + 140, 1080);
    c.fill();
    const fl = c.createLinearGradient(0, 820, 0, H);
    fl.addColorStop(0, '#1a1216');
    fl.addColorStop(1, '#060406');
    c.fillStyle = fl;
    c.fillRect(0, 820, W, H - 820);
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = 2;
    for (let y = 840; y < H; y += (y - 780) * 0.3) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }
    c.fillStyle = 'rgba(170,200,255,0.16)';
    for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as [number, number][]) {
      const x0 = 300 + qx * 130 + qy * 60;
      const y0 = 880 + qy * 90;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x0 + 118, y0);
      c.lineTo(x0 + 172, y0 + 80);
      c.lineTo(x0 + 54, y0 + 80);
      c.fill();
    }
    // 床
    c.fillStyle = '#120c10';
    c.fillRect(440, 640, 280, 220);
    c.fillStyle = '#2a2034';
    c.beginPath();
    c.moveTo(450, 690);
    c.quadraticCurveTo(580, 660, 720, 690);
    c.lineTo(720, 800);
    c.lineTo(450, 800);
    c.fill();
    c.fillStyle = 'rgba(180,200,255,0.25)';
    c.fillRect(450, 688, 270, 2);
    c.fillStyle = '#3a3044';
    c.beginPath();
    c.ellipse(670, 668, 50, 18, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1a1014';
    c.fillRect(430, 560, 18, 300);
    // 斜倚的斧槍
    c.strokeStyle = '#0a0608';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(372, 840);
    c.lineTo(408, 250);
    c.stroke();
    c.strokeStyle = 'rgba(180,200,255,0.4)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(368, 840);
    c.lineTo(404, 250);
    c.stroke();
    c.fillStyle = '#16141c';
    c.beginPath();
    c.moveTo(406, 280);
    c.lineTo(456, 268);
    c.quadraticCurveTo(462, 300, 452, 336);
    c.lineTo(404, 318);
    c.fill();
    c.strokeStyle = 'rgba(200,215,255,0.55)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(456, 268);
    c.quadraticCurveTo(462, 300, 452, 336);
    c.stroke();
    c.fillStyle = '#16141c';
    c.beginPath();
    c.moveTo(402, 254);
    c.lineTo(410, 200);
    c.lineTo(414, 254);
    c.fill();
    // 小桌與燭火
    c.fillStyle = '#140c0a';
    c.fillRect(560, 560, 140, 12);
    c.fillRect(574, 572, 8, 90);
    c.fillRect(678, 572, 8, 90);
    glow(c, 620, 520, 200, 'rgba(255,170,80,0.35)');
    c.fillStyle = '#e8dcc8';
    c.fillRect(614, 526, 12, 34);
    glow(c, 620, 516, 30, 'rgba(255,220,140,0.9)');
    c.fillStyle = '#fff4c8';
    c.beginPath();
    c.ellipse(620, 518, 4, 9, 0, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(200,215,255,${0.1 + r() * 0.3})`;
      c.fillRect(wx + r() * 380, wy + r() * 640, 1.4, 1.4);
    }
  },

  // 夜市：紙燈籠串橫過街道，兩側攤棚與人潮剪影，遠方是星冠塔。
  market: (c) => {
    grad(c, [[0, '#070614'], [0.3, '#1c1034'], [0.52, '#40182a'], [0.6, '#1a0c14'], [1, '#080406']]);
    const r = rng(71);
    stars(c, r, 50, 320);
    crownTower(c, 360, 560, 60, 360, 'rgba(36,18,44,0.9)', 0.6);
    city(c, r, 600, 22, 'rgba(30,14,30,0.92)', 'rgba(255,190,120,0.6)', 50, 140);
    glow(c, 360, 640, 460, 'rgba(255,130,70,0.25)');
    // 地面
    const fg = c.createLinearGradient(0, 600, 0, H);
    fg.addColorStop(0, '#2a1418');
    fg.addColorStop(1, '#070406');
    c.fillStyle = fg;
    c.fillRect(0, 600, W, H - 600);
    glow(c, 360, 900, 420, 'rgba(255,140,80,0.14)');
    c.strokeStyle = 'rgba(255,170,110,0.1)';
    c.lineWidth = 2;
    for (let y = 620; y < H; y += (y - 560) * 0.22) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }
    for (let i = -7; i <= 7; i++) {
      c.beginPath();
      c.moveTo(360 + i * 30, 610);
      c.lineTo(360 + i * 150, H);
      c.stroke();
    }
    // 兩側攤棚（遠 → 近）
    for (let k = 3; k >= 0; k--) {
      const f = 1 - k * 0.2;
      for (const side of [-1, 1]) {
        const w = 250 * f;
        const x = side < 0 ? 90 + k * 75 : 630 - k * 75;
        const top = 620 - 200 * f;
        const ctr = 620 + 140 * f;
        // 棚架
        c.fillStyle = '#0c0608';
        c.fillRect(x - w / 2, top, 6 * f, ctr - top + 60 * f);
        c.fillRect(x + w / 2 - 6 * f, top, 6 * f, ctr - top + 60 * f);
        // 條紋遮棚
        for (let s = 0; s < 6; s++) {
          c.fillStyle = s % 2 ? `rgb(${120 * f + 30},${30 * f + 14},${30 * f + 16})` : `rgb(${200 * f + 30},${150 * f + 20},${100 * f + 20})`;
          const sx = x - w / 2 - 10 * f + ((w + 20 * f) * s) / 6;
          c.beginPath();
          c.moveTo(sx + 12 * f, top - 30 * f);
          c.lineTo(sx + 12 * f + (w * 0.86) / 6, top - 30 * f);
          c.lineTo(sx + (w + 20 * f) / 6, top + 10 * f);
          c.lineTo(sx, top + 10 * f);
          c.fill();
        }
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(x - w / 2 - 10 * f, top + 6 * f, w + 20 * f, 4 * f);
        // 攤內暖光＋貨物
        glow(c, x, ctr - 50 * f, 130 * f, 'rgba(255,170,90,0.35)');
        for (let g = 0; g < 5; g++) {
          c.fillStyle = ['#5a3a20', '#7a2a1a', '#3a4a2a', '#8a6a2a'][Math.floor(r() * 4)] ?? '#444';
          c.beginPath();
          c.arc(x - w * 0.35 + g * w * 0.17, ctr - 6 * f, 10 * f, Math.PI, 0);
          c.fill();
        }
        c.fillStyle = '#140a0a';
        c.fillRect(x - w / 2, ctr, w, 60 * f);
        c.fillStyle = 'rgba(255,200,130,0.4)';
        c.fillRect(x - w / 2, ctr, w, 2);
      }
    }
    // 人潮剪影
    for (let i = 0; i < 16; i++) {
      const x = 180 + r() * 360;
      const s = 0.5 + r() * 0.4;
      const y = 700 + s * 60;
      c.fillStyle = `rgba(${8 + s * 10},${4 + s * 6},${8 + s * 8},0.95)`;
      c.beginPath();
      c.arc(x, y - 70 * s, 11 * s, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(x, y, 18 * s, 56 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,170,100,0.3)';
      c.fillRect(x - 9 * s, y - 80 * s, 2, 14 * s);
    }
    // 燈籠串（懸鏈線）
    for (const [y0, sag, s, col] of [[160, 70, 1.15, '255,120,70'], [300, 60, 0.95, '255,170,80'], [420, 46, 0.75, '255,110,90'], [510, 30, 0.6, '255,190,110']] as [number, number, number, string][]) {
      c.strokeStyle = 'rgba(10,6,8,0.9)';
      c.lineWidth = 2;
      c.beginPath();
      for (let x = 0; x <= W; x += 20) {
        const t = (x - 360) / 360;
        const y = y0 + sag * (1 - t * t);
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      for (let x = 30 + r() * 20; x < W; x += 70 * s) {
        const t = (x - 360) / 360;
        paperLantern(c, x, y0 + sag * (1 - t * t) + 18 * s, s, col);
      }
    }
    // 蒸氣
    for (let i = 0; i < 6; i++) glow(c, 120 + r() * 480, 560 + r() * 160, 90, 'rgba(255,230,210,0.07)');
  },

  // 星詠研究院大廳：巨大的黃銅星儀，冷藍光自高窗灑落。
  academy: (c) => {
    grad(c, [[0, '#03060e'], [0.4, '#0b1528'], [0.75, '#09111e'], [1, '#03050a']]);
    const r = rng(79);
    // 高窗與光束
    for (const x of [130, 360, 590]) {
      const wg = c.createLinearGradient(0, 70, 0, 500);
      wg.addColorStop(0, 'rgba(170,215,255,0.5)');
      wg.addColorStop(1, 'rgba(90,140,220,0.18)');
      c.fillStyle = wg;
      c.beginPath();
      c.moveTo(x - 56, 500);
      c.lineTo(x - 56, 140);
      c.arc(x, 140, 56, Math.PI, 0);
      c.lineTo(x + 56, 500);
      c.fill();
      c.strokeStyle = 'rgba(10,16,30,0.9)';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(x, 84);
      c.lineTo(x, 500);
      for (const y of [200, 300, 400]) {
        c.moveTo(x - 56, y);
        c.lineTo(x + 56, y);
      }
      c.stroke();
      c.fillStyle = 'rgba(140,190,255,0.05)';
      c.beginPath();
      c.moveTo(x - 56, 140);
      c.lineTo(x + 56, 140);
      c.lineTo(x + 200, 1000);
      c.lineTo(x + 20, 1000);
      c.fill();
    }
    // 柱
    for (const x of [245, 475, 20, 700]) {
      c.fillStyle = '#070b16';
      c.fillRect(x - 22, 0, 44, 900);
      c.fillStyle = 'rgba(160,200,255,0.25)';
      c.fillRect(x - 22, 0, 3, 900);
    }
    // 書架（下半兩側）
    for (const x0 of [0, 520]) {
      c.fillStyle = '#0a0e18';
      c.fillRect(x0, 600, 200, 300);
      for (let y = 620; y < 900; y += 48) {
        c.fillStyle = '#05070c';
        c.fillRect(x0, y + 40, 200, 6);
        for (let bx = x0 + 6; bx < x0 + 194; bx += 8 + r() * 6) {
          c.fillStyle = `rgba(${40 + r() * 50},${40 + r() * 40},${60 + r() * 60},0.9)`;
          c.fillRect(bx, y + 8 + r() * 8, 6, 32);
        }
      }
    }
    // 地板＋倒影
    const fg = c.createLinearGradient(0, 860, 0, H);
    fg.addColorStop(0, '#101a2c');
    fg.addColorStop(1, '#03050a');
    c.fillStyle = fg;
    c.fillRect(0, 860, W, H - 860);
    c.strokeStyle = 'rgba(140,190,255,0.12)';
    c.lineWidth = 1.5;
    for (let i = -8; i <= 8; i++) {
      c.beginPath();
      c.moveTo(360 + i * 30, 860);
      c.lineTo(360 + i * 140, H);
      c.stroke();
    }
    glow(c, 360, 900, 300, 'rgba(120,190,255,0.18)');
    // 星儀支柱
    c.fillStyle = '#2a1e10';
    c.beginPath();
    c.moveTo(330, 880);
    c.lineTo(346, 470);
    c.lineTo(374, 470);
    c.lineTo(390, 880);
    c.fill();
    c.fillStyle = 'rgba(255,210,140,0.5)';
    c.fillRect(346, 470, 3, 410);
    c.fillStyle = '#3a2a14';
    c.beginPath();
    c.ellipse(360, 884, 110, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,200,120,0.6)';
    c.lineWidth = 2;
    c.stroke();
    // 星儀環
    const cx = 360;
    const cy = 440;
    glow(c, cx, cy, 340, 'rgba(110,180,255,0.18)');
    const rings: [number, number, number, number][] = [[300, 70, -0.25, 5], [250, 110, 0.35, 4], [200, 60, 1.1, 3.5], [150, 40, -0.9, 3]];
    for (const [rx, ry, rot, lw] of rings) {
      c.strokeStyle = '#6a4a20';
      c.lineWidth = lw + 3;
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = 'rgba(255,215,140,0.85)';
      c.lineWidth = lw * 0.5;
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, rot, Math.PI * 0.9, Math.PI * 1.9);
      c.stroke();
    }
    // 星體
    const bodies: [number, number, number, string][] = [[300, 0.6, 12, '120,200,255'], [250, 2.4, 9, '255,190,120'], [200, 4.2, 8, '200,160,255'], [150, 1.5, 6, '160,230,255'], [300, 3.7, 7, '230,240,255']];
    rings.forEach(([rx, ry, rot], i) => {
      const b = bodies[i];
      if (!b) return;
      const [, t, rad, col] = b;
      const ex = Math.cos(t) * rx;
      const ey = Math.sin(t) * ry;
      const x = cx + ex * Math.cos(rot) - ey * Math.sin(rot);
      const y = cy + ex * Math.sin(rot) + ey * Math.cos(rot);
      glow(c, x, y, rad * 4, `rgba(${col},0.5)`);
      const pg = c.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 1, x, y, rad);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(1, `rgb(${col})`);
      c.fillStyle = pg;
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
    });
    // 核心（冷白星）
    glow(c, cx, cy, 160, 'rgba(150,210,255,0.55)');
    const core = c.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, 38);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.5, '#cfeaff');
    core.addColorStop(1, '#4a8ad8');
    c.fillStyle = core;
    c.beginPath();
    c.arc(cx, cy, 38, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,215,140,0.9)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx, cy, 48, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 48, cy + Math.sin(a) * 48);
      c.lineTo(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58);
      c.stroke();
    }
    // 符文光塵
    for (let i = 0; i < 70; i++) {
      c.fillStyle = `rgba(170,220,255,${0.15 + r() * 0.5})`;
      c.fillRect(r() * W, 100 + r() * 800, 1.6, 1.6);
    }
  },

  // 鐘樓屋頂（夜）：巨大的月亮、腳下的王都燈海、尖塔刺破月面。
  rooftop: (c) => {
    grad(c, [[0, '#03040c'], [0.35, '#0c1230'], [0.6, '#1c1e3e'], [0.66, '#0e0c1c'], [1, '#04040a']]);
    const r = rng(83);
    stars(c, r, 160, 700);
    moon(c, 410, 390, 220);
    // 流雲
    for (const [x, y, w, h] of [[300, 330, 260, 16], [520, 450, 220, 12], [160, 520, 300, 18], [430, 250, 160, 9]] as [number, number, number, number][]) {
      c.fillStyle = 'rgba(12,14,34,0.55)';
      c.beginPath();
      c.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(200,215,255,0.12)';
      c.beginPath();
      c.ellipse(x, y - h * 0.5, w * 0.8, h * 0.35, 0, 0, Math.PI * 2);
      c.fill();
    }
    // 遠方城市與尖塔（月前剪影）
    spire(c, 330, 800, 40, 520, '#080a1a', 'rgba(255,200,130,0.6)');
    spire(c, 520, 800, 26, 360, '#0a0c1e', 'rgba(255,200,130,0.5)');
    crownTower(c, 640, 800, 80, 520, '#090b1c', 0.9);
    city(c, r, 800, 26, '#0b0d20', 'rgba(255,190,120,0.7)', 30, 110);
    const below = c.createLinearGradient(0, 790, 0, 980);
    below.addColorStop(0, '#0a0a1c');
    below.addColorStop(1, '#05050c');
    c.fillStyle = below;
    c.fillRect(0, 800, W, 200);
    for (let i = 0; i < 140; i++) {
      const y = 806 + Math.pow(r(), 0.7) * 170;
      c.fillStyle = `rgba(255,${170 + r() * 60},${90 + r() * 60},${0.3 + r() * 0.6})`;
      c.fillRect(r() * W, y, 2, 2);
    }
    glow(c, 360, 880, 400, 'rgba(255,160,90,0.1)');
    // 鐘樓的鐘亭（左）
    c.fillStyle = '#05050c';
    c.fillRect(30, 600, 220, 420);
    c.beginPath();
    c.moveTo(14, 604);
    c.lineTo(140, 470);
    c.lineTo(266, 604);
    c.fill();
    c.fillRect(137, 400, 6, 74);
    glow(c, 140, 398, 20, 'rgba(220,230,255,0.6)');
    c.strokeStyle = 'rgba(210,225,255,0.55)';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(140, 470);
    c.lineTo(266, 604);
    c.moveTo(250, 604);
    c.lineTo(250, 1020);
    c.stroke();
    c.fillStyle = '#121838';
    c.beginPath();
    c.moveTo(70, 940);
    c.lineTo(70, 700);
    c.arc(140, 700, 70, Math.PI, 0);
    c.lineTo(210, 940);
    c.fill();
    const bg = c.createLinearGradient(80, 0, 200, 0);
    bg.addColorStop(0, '#0a0a12');
    bg.addColorStop(1, '#5a4a3a');
    bell(c, 140, 700, 120, 150, bg, 'rgba(220,230,255,0.6)');
    // 前景屋脊
    c.fillStyle = '#06060e';
    c.beginPath();
    c.moveTo(0, 1060);
    c.lineTo(420, 950);
    c.lineTo(W, 1010);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    c.strokeStyle = 'rgba(210,225,255,0.6)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 1060);
    c.lineTo(420, 950);
    c.lineTo(W, 1010);
    c.stroke();
    c.strokeStyle = 'rgba(160,180,230,0.12)';
    c.lineWidth = 2;
    for (let k = 1; k < 8; k++) {
      c.beginPath();
      c.moveTo(0, 1060 + k * 34);
      c.lineTo(420, 950 + k * 40);
      c.lineTo(W, 1010 + k * 36);
      c.stroke();
    }
    // 風
    c.strokeStyle = 'rgba(200,215,255,0.1)';
    c.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const y = 200 + r() * 700;
      const x = r() * W;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 80, y - 10, x + 180, y + 4);
      c.stroke();
    }
  },

  // 下水道：層層磚拱延伸到深處，中間是水道，管線沿牆，柵口漏下一道光，盡頭泛著蝕的紫光。
  sewer: (c) => {
    grad(c, [[0, '#050708'], [0.5, '#0c1212'], [1, '#030405']]);
    const r = rng(89);
    const vx = 360;
    const vy = 560;
    glow(c, vx, vy, 260, 'rgba(160,80,230,0.32)');
    glow(c, vx, vy + 20, 90, 'rgba(210,140,255,0.4)');
    // 磚拱（遠 → 近）
    for (let k = 7; k >= 0; k--) {
      const f = 1 - k / 8;
      const hw = 50 + 420 * f * f;
      const spring = vy - 10 - 260 * f * f;
      const floor = vy + 40 + 760 * f * f;
      const sh = Math.round(14 + 30 * f);
      c.strokeStyle = `rgb(${sh},${sh + 6},${sh + 2})`;
      c.lineWidth = 10 + 50 * f;
      c.beginPath();
      c.moveTo(vx - hw, floor);
      c.lineTo(vx - hw, spring);
      c.arc(vx, spring, hw, Math.PI, 0);
      c.lineTo(vx + hw, floor);
      c.stroke();
      c.strokeStyle = `rgba(150,200,190,${0.1 + 0.15 * f})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(vx, spring, hw - (5 + 25 * f), Math.PI * 1.05, Math.PI * 1.6);
      c.stroke();
      // 拱上磚縫
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = 1.5;
      for (let b = 0; b <= 10; b++) {
        const a = Math.PI + (b / 10) * Math.PI;
        const r0 = hw - (5 + 25 * f);
        const r1 = hw + (5 + 25 * f);
        c.beginPath();
        c.moveTo(vx + Math.cos(a) * r0, spring + Math.sin(a) * r0);
        c.lineTo(vx + Math.cos(a) * r1, spring + Math.sin(a) * r1);
        c.stroke();
      }
    }
    // 走道
    c.fillStyle = '#0e1414';
    c.beginPath();
    c.moveTo(vx - 50, vy + 40);
    c.lineTo(vx + 50, vy + 40);
    c.lineTo(W, 1080);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.lineTo(0, 1080);
    c.fill();
    // 水道
    const wg = c.createLinearGradient(0, vy + 40, 0, H);
    wg.addColorStop(0, '#2a1a3a');
    wg.addColorStop(0.3, '#0e2422');
    wg.addColorStop(1, '#040a0a');
    c.fillStyle = wg;
    c.beginPath();
    c.moveTo(vx - 26, vy + 40);
    c.lineTo(vx + 26, vy + 40);
    c.lineTo(560, H);
    c.lineTo(160, H);
    c.fill();
    c.strokeStyle = 'rgba(150,230,200,0.25)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(vx - 26, vy + 40);
    c.lineTo(160, H);
    c.moveTo(vx + 26, vy + 40);
    c.lineTo(560, H);
    c.stroke();
    for (let i = 0; i < 40; i++) {
      const t = Math.pow(r(), 0.8);
      const y = vy + 50 + t * (H - vy - 50);
      const half = 26 + t * 174;
      const w = 10 + t * 60 * r();
      c.fillStyle = r() < 0.4 ? `rgba(200,140,255,${0.15 + r() * 0.2})` : `rgba(160,230,210,${0.08 + r() * 0.15})`;
      c.fillRect(vx + (r() - 0.5) * half * 1.6 - w / 2, y, w, 1.5 + t * 2);
    }
    // 管線（左牆）
    for (const [y0, th, col] of [[760, 22, '#1e2a28'], [820, 14, '#2a2420']] as [number, number, string][]) {
      c.strokeStyle = col;
      c.lineWidth = th;
      c.beginPath();
      c.moveTo(0, y0 + 80);
      c.lineTo(vx - 70, vy + 10 + (y0 - 760) * 0.2);
      c.stroke();
      c.strokeStyle = 'rgba(170,220,200,0.3)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, y0 + 80 - th / 2);
      c.lineTo(vx - 70, vy + 10 + (y0 - 760) * 0.2 - 2);
      c.stroke();
    }
    // 右牆直管＋滴水
    c.fillStyle = '#1a2422';
    c.fillRect(600, 0, 26, 900);
    c.fillStyle = 'rgba(170,220,200,0.3)';
    c.fillRect(600, 0, 3, 900);
    c.fillStyle = '#243230';
    c.fillRect(592, 320, 42, 16);
    c.fillRect(592, 640, 42, 16);
    c.fillStyle = '#1a2422';
    c.fillRect(560, 880, 66, 26);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = 'rgba(170,230,210,0.5)';
      c.fillRect(570, 920 + i * 34, 2, 12);
    }
    // 柵口光束
    c.fillStyle = 'rgba(190,220,210,0.07)';
    c.beginPath();
    c.moveTo(420, 0);
    c.lineTo(520, 0);
    c.lineTo(470, 1000);
    c.lineTo(250, 1000);
    c.fill();
    glow(c, 470, 10, 90, 'rgba(200,230,220,0.35)');
    c.fillStyle = 'rgba(10,14,14,0.9)';
    for (let x = 424; x < 520; x += 16) c.fillRect(x, 0, 5, 26);
    // 蝕的紫色裂紋
    c.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      c.strokeStyle = `rgba(190,100,255,${0.25 + r() * 0.35})`;
      let x = vx + (r() - 0.5) * 140;
      let y = vy + 30;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (r() - 0.5) * 120;
        y += r() * 80 - 50;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(210,160,255,${0.15 + r() * 0.4})`;
      c.fillRect(vx + (r() - 0.5) * 500, 300 + r() * 600, 1.6, 1.6);
    }
  },
};

const DRAW: Record<Exclude<BackdropId, 'ruins'>, (c: CanvasRenderingContext2D) => void> = {
  ...DRAW_CH3,
  town: (c) => {
    grad(c, [[0, '#070912'], [0.45, '#1c1830'], [0.62, '#2a1c24'], [1, '#0a0708']]);
    const r = rng(3);
    for (let i = 0; i < 70; i++) {
      c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`;
      c.fillRect(r() * W, r() * 380, 1.5, 1.5);
    }
    glow(c, 360, 760, 420, 'rgba(255,160,80,0.25)');
    // 兩側房屋（透視）
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const f = 1 - k * 0.2;
        const bw = 200 * f;
        const bh = 420 * f;
        const x = side < 0 ? 0 + k * 70 : W - bw - k * 70;
        const y = 820 - bh - k * 20;
        c.fillStyle = `rgb(${24 + k * 6},${18 + k * 5},${26 + k * 6})`;
        c.fillRect(x, y, bw, bh + k * 20);
        c.beginPath();
        c.moveTo(x - 10, y);
        c.lineTo(x + bw / 2, y - 90 * f);
        c.lineTo(x + bw + 10, y);
        c.fill();
        // 窗
        c.fillStyle = 'rgba(255,190,110,0.85)';
        for (let j = 0; j < 2; j++) c.fillRect(x + bw * (0.25 + j * 0.35), y + bh * 0.3, 22 * f, 30 * f);
        glow(c, x + bw * 0.5, y + bh * 0.35, 90 * f, 'rgba(255,170,90,0.18)');
      }
    }
    // 石板路
    c.fillStyle = '#120d10';
    c.beginPath();
    c.moveTo(250, 820);
    c.lineTo(470, 820);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    c.strokeStyle = 'rgba(255,190,110,0.12)';
    for (let y = 840; y < H; y += (y - 760) * 0.35) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
    }
    // 路燈
    for (const x of [200, 520]) {
      c.fillStyle = '#0a0808';
      c.fillRect(x - 3, 560, 6, 260);
      glow(c, x, 560, 80, 'rgba(255,190,110,0.6)');
    }
  },
  tavern: (c) => {
    grad(c, [[0, '#120a06'], [0.5, '#2a160c'], [1, '#0a0604']]);
    // 木牆
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 3;
    for (let x = 0; x < W; x += 60) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 720);
      c.stroke();
    }
    // 樑
    c.fillStyle = '#1a0e08';
    c.fillRect(0, 90, W, 40);
    c.fillRect(0, 700, W, 30);
    // 吊燈
    for (const x of [180, 540]) {
      c.strokeStyle = '#000';
      c.beginPath();
      c.moveTo(x, 130);
      c.lineTo(x, 250);
      c.stroke();
      glow(c, x, 270, 220, 'rgba(255,170,80,0.45)');
      c.fillStyle = '#ffd27a';
      c.beginPath();
      c.arc(x, 270, 12, 0, Math.PI * 2);
      c.fill();
    }
    // 酒架
    c.fillStyle = '#140a06';
    c.fillRect(80, 360, 560, 16);
    c.fillRect(80, 470, 560, 16);
    const r = rng(9);
    for (let i = 0; i < 18; i++) {
      const x = 100 + i * 30;
      const row = i % 2;
      c.fillStyle = ['#3a5a2a', '#5a2a2a', '#2a3a5a', '#6a4a1a'][Math.floor(r() * 4)] ?? '#333';
      c.fillRect(x, 300 + row * 110, 14, 60);
      c.fillRect(x + 4, 288 + row * 110, 6, 14);
    }
    // 吧台
    c.fillStyle = '#1e1008';
    c.fillRect(0, 760, W, 90);
    c.fillStyle = 'rgba(255,200,120,0.25)';
    c.fillRect(0, 760, W, 4);
    c.fillStyle = '#0a0604';
    c.fillRect(0, 850, W, H - 850);
  },
  forest: (c) => {
    grad(c, [[0, '#040810'], [0.4, '#0c1a2c'], [0.6, '#0a1418'], [1, '#04060a']]);
    glow(c, 520, 180, 200, 'rgba(200,230,255,0.35)');
    const r = rng(5);
    const layers: [number, string, number, number][] = [[560, '#0f1d2a', 80, 260], [680, '#0a141e', 110, 360], [820, '#05080c', 150, 480]];
    for (const [base, col, w, h] of layers) {
      c.fillStyle = col;
      for (let x = -40; x < W + 60; x += w * (0.6 + r() * 0.5)) pine(c, x, base, w, h * (0.6 + r() * 0.5));
      c.fillRect(0, base - 2, W, H - base);
    }
    glow(c, 360, 760, 300, 'rgba(255,160,80,0.18)');
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(210,255,160,${0.3 + r() * 0.5})`;
      c.beginPath();
      c.arc(r() * W, 400 + r() * 500, 1.5 + r() * 1.5, 0, Math.PI * 2);
      c.fill();
    }
  },
  lake: (c) => {
    grad(c, [[0, '#050a14'], [0.45, '#10243a'], [0.55, '#1a3a50'], [1, '#050a10']]);
    glow(c, 360, 300, 260, 'rgba(200,230,255,0.4)');
    c.fillStyle = 'rgba(220,240,255,0.9)';
    c.beginPath();
    c.arc(360, 300, 40, 0, Math.PI * 2);
    c.fill();
    // 湖面
    const lg = c.createLinearGradient(0, 640, 0, H);
    lg.addColorStop(0, '#16324a');
    lg.addColorStop(1, '#040810');
    c.fillStyle = lg;
    c.fillRect(0, 640, W, H - 640);
    // 倒影
    for (let y = 660; y < 1000; y += 14) {
      const w = 60 + Math.sin(y * 0.3) * 30;
      c.fillStyle = `rgba(200,230,255,${0.35 - (y - 660) / 1200})`;
      c.fillRect(360 - w / 2, y, w, 3);
    }
    // 遠岸
    c.fillStyle = '#081420';
    const r = rng(7);
    for (let x = -30; x < W + 40; x += 50 + r() * 40) pine(c, x, 640, 60, 120 + r() * 80);
    // 霧
    for (let i = 0; i < 6; i++) glow(c, r() * W, 620 + r() * 80, 200, 'rgba(160,200,230,0.12)');
  },
  mine: (c) => {
    grad(c, [[0, '#0a0706'], [0.4, '#1e140c'], [0.7, '#140d08'], [1, '#050404']]);
    const r = rng(21);
    // 岩壁紋理
    for (let i = 0; i < 160; i++) {
      c.fillStyle = `rgba(${60 + r() * 40},${44 + r() * 30},${30 + r() * 20},${0.08 + r() * 0.12})`;
      c.beginPath();
      c.ellipse(r() * W, r() * H, 10 + r() * 50, 6 + r() * 26, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    // 隧道深處的暖光
    glow(c, 360, 640, 320, 'rgba(255,150,60,0.3)');
    c.fillStyle = '#050304';
    c.beginPath();
    c.ellipse(360, 650, 70, 90, 0, 0, Math.PI * 2);
    c.fill();
    glow(c, 360, 660, 60, 'rgba(255,170,80,0.35)');
    // 星礦脈（淡藍）
    for (let i = 0; i < 9; i++) {
      const x = r() < 0.5 ? r() * 200 : 520 + r() * 200;
      oreVein(c, r, x - 40, 200 + r() * 700, 80 + r() * 80, `rgba(120,190,255,${0.25 + r() * 0.25})`);
    }
    for (let i = 0; i < 30; i++) {
      const x = r() < 0.5 ? r() * 220 : 500 + r() * 220;
      glow(c, x, 150 + r() * 800, 8 + r() * 10, 'rgba(140,210,255,0.5)');
    }
    // 由遠至近的木支架
    for (let k = 4; k >= 0; k--) {
      const f = 1 - k * 0.18;
      const half = 120 + 230 * f;
      const top = 640 - 520 * f;
      const bot = 660 + 300 * f;
      timberFrame(c, 360, top, bot, half, f);
    }
    // 吊燈
    for (const [x, y, s] of [[200, 330, 1], [520, 330, 1], [290, 520, 0.6], [430, 520, 0.6]] as [number, number, number][]) {
      c.strokeStyle = '#000';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y - 80 * s);
      c.lineTo(x, y);
      c.stroke();
      glow(c, x, y + 14 * s, 160 * s, 'rgba(255,170,80,0.5)');
      c.fillStyle = '#ffd27a';
      c.fillRect(x - 7 * s, y, 14 * s, 22 * s);
      c.fillStyle = '#2a1a10';
      c.fillRect(x - 9 * s, y - 4 * s, 18 * s, 5 * s);
    }
    // 地面＋鐵軌（透視）
    c.fillStyle = '#0c0806';
    c.beginPath();
    c.moveTo(250, 700);
    c.lineTo(470, 700);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    c.fillStyle = '#2a1a10';
    for (let y = 712; y < H; y += (y - 650) * 0.28) {
      const t = (y - 700) / (H - 700);
      const hw = 40 + t * 300;
      c.fillRect(360 - hw, y, hw * 2, 4 + t * 16);
    }
    c.strokeStyle = 'rgba(255,190,120,0.5)';
    c.lineWidth = 3;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(360 + side * 26, 700);
      c.lineTo(360 + side * 240, H);
      c.stroke();
    }
  },
  bellhall: (c) => {
    grad(c, [[0, '#06040c'], [0.35, '#160c24'], [0.7, '#0e0816'], [1, '#040308']]);
    const r = rng(33);
    // 洞穴穹頂（鐘乳石）
    c.fillStyle = '#05030a';
    c.beginPath();
    c.moveTo(0, 0);
    for (let x = 0; x <= W; x += 30) c.lineTo(x, 60 + r() * 60 + (x % 90 === 0 ? 70 : 0));
    c.lineTo(W, 0);
    c.fill();
    // 紫色幽光
    glow(c, 360, 560, 460, 'rgba(160,90,255,0.28)');
    glow(c, 360, 860, 240, 'rgba(200,120,255,0.3)');
    // 懸鐘的鎖鏈
    c.strokeStyle = '#1a1424';
    c.lineWidth = 10;
    for (const x of [300, 420]) {
      c.beginPath();
      c.moveTo(x, 80);
      c.lineTo(360 + (x - 360) * 0.2, 240);
      c.stroke();
    }
    // 巨鐘
    const bg = c.createLinearGradient(140, 0, 580, 0);
    bg.addColorStop(0, '#3a2a1c');
    bg.addColorStop(0.35, '#5a4026');
    bg.addColorStop(1, '#140c10');
    bell(c, 360, 260, 520, 560, bg, 'rgba(220,170,255,0.55)');
    // 銅綠斑
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(80,140,120,${0.08 + r() * 0.12})`;
      c.beginPath();
      c.arc(220 + r() * 280, 320 + r() * 460, 6 + r() * 20, 0, Math.PI * 2);
      c.fill();
    }
    // 裂痕（透出紫光）
    c.strokeStyle = 'rgba(210,150,255,0.9)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(380, 280);
    c.lineTo(366, 380);
    c.lineTo(400, 460);
    c.lineTo(372, 560);
    c.lineTo(410, 660);
    c.lineTo(392, 810);
    c.stroke();
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(400, 460);
    c.lineTo(450, 500);
    c.moveTo(372, 560);
    c.lineTo(320, 610);
    c.stroke();
    glow(c, 392, 560, 120, 'rgba(190,120,255,0.25)');
    // 地面與碎石
    c.fillStyle = '#07050c';
    c.fillRect(0, 860, W, H - 860);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(${30 + r() * 20},${22 + r() * 16},${40 + r() * 20},0.9)`;
      c.beginPath();
      c.ellipse(r() * W, 850 + r() * 120, 10 + r() * 40, 5 + r() * 14, 0, 0, Math.PI * 2);
      c.fill();
    }
    // 粉塵
    for (let i = 0; i < 90; i++) {
      c.fillStyle = `rgba(220,190,255,${0.15 + r() * 0.4})`;
      c.fillRect(r() * W, 120 + r() * 800, 1.5 + r() * 1.5, 1.5 + r() * 1.5);
    }
    // 光束
    c.fillStyle = 'rgba(200,160,255,0.05)';
    c.beginPath();
    c.moveTo(300, 0);
    c.lineTo(380, 0);
    c.lineTo(560, 900);
    c.lineTo(340, 900);
    c.fill();
  },
  deep: (c) => {
    grad(c, [[0, '#030206'], [0.5, '#0c0614'], [0.8, '#160820'], [1, '#050208']]);
    const r = rng(47);
    // 岩層
    for (let i = 0; i < 6; i++) {
      c.fillStyle = `rgba(${18 + i * 3},${12 + i * 2},${26 + i * 4},0.8)`;
      c.beginPath();
      c.moveTo(0, 200 + i * 170);
      for (let x = 0; x <= W; x += 60) c.lineTo(x, 200 + i * 170 + Math.sin(x * 0.01 + i) * 30 + r() * 20);
      c.lineTo(W, 200 + i * 170 + 40);
      c.lineTo(0, 200 + i * 170 + 40);
      c.fill();
    }
    // 兩側岩壁
    c.fillStyle = '#040208';
    for (const side of [0, 1]) {
      c.beginPath();
      c.moveTo(side * W, 0);
      for (let y = 0; y <= H; y += 80) c.lineTo(side ? W - 80 - r() * 90 : 80 + r() * 90, y);
      c.lineTo(side * W, H);
      c.fill();
    }
    // 蝕：底部的紫色腐化光
    glow(c, 360, 1000, 480, 'rgba(150,40,220,0.35)');
    glow(c, 360, 1060, 200, 'rgba(220,90,255,0.4)');
    // 蝕的觸鬚紋
    c.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      c.strokeStyle = `rgba(200,80,255,${0.2 + r() * 0.35})`;
      let x = 360 + (r() - 0.5) * 300;
      let y = 1080;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 90;
        y -= 40 + r() * 60;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    // 礦晶（藍紫）
    for (let i = 0; i < 16; i++) {
      const left = i % 2 === 0;
      const x = left ? 40 + r() * 170 : W - 40 - r() * 170;
      const y = 300 + r() * 850;
      const h = 30 + r() * 70;
      const purple = r() < 0.5;
      glow(c, x, y - h * 0.5, h * 1.2, purple ? 'rgba(190,90,255,0.3)' : 'rgba(110,180,255,0.3)');
      crystal(c, x, y, h, (left ? 1 : -1) * (0.2 + r() * 0.5), purple ? 'rgba(150,70,220,0.85)' : 'rgba(80,140,230,0.85)', 'rgba(255,255,255,0.6)');
    }
    // 地面
    c.fillStyle = '#060309';
    c.beginPath();
    c.moveTo(0, 1120);
    c.quadraticCurveTo(360, 1060, W, 1120);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    // 飄浮孢粒
    for (let i = 0; i < 60; i++) {
      c.fillStyle = `rgba(230,160,255,${0.2 + r() * 0.5})`;
      c.beginPath();
      c.arc(150 + r() * 420, 400 + r() * 700, 1 + r() * 2, 0, Math.PI * 2);
      c.fill();
    }
  },
};

/** 取得（必要時生成）背景材質 key；ruins 由 DialogueScene 自己畫。 */
export function backdropKey(scene: Phaser.Scene, id: BackdropId): string {
  if (id === 'ruins') return 'bg_ruins';
  const key = `bg_dlg_${id}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, W, H);
    if (tex) {
      DRAW[id](tex.getContext());
      tex.refresh();
    }
  }
  return key;
}

/** 地點 → 背景 */
export function backdropFor(script: string, location: string): BackdropId {
  if (script === 'ch0') return 'ruins';
  if (script === 'ch2') {
    if (location === 'greylamp_plaza' || location === 'town_gate' || location === 'orphanage') return 'town';
    if (location === 'tavern' || location === 'general_store') return 'tavern';
    if (location === 'bell_hall') return 'bellhall';
    if (location === 'deep_level' || location === 'bell_throat') return 'deep';
    return 'mine';
  }
  if (script === 'ch3') {
    if (location === 'capital_gate') return 'capital_gate';
    if (location === 'tourney_hall') return 'tourney';
    if (location === 'rourke_lodging' || location === 'inn_night') return 'inn';
    if (location === 'night_market') return 'market';
    if (location === 'academy') return 'academy';
    if (location === 'rooftop') return 'rooftop';
    return 'capital';
  }
  if (location === 'tavern' || location === 'general_store') return 'tavern';
  if (location === 'orphanage' || location === 'town_gate') return 'town';
  if (location === 'mist_lake') return 'lake';
  if (location === 'lighthouse') return 'ruins';
  return 'forest';
}

/** 戰鬥遭遇 → 背景（null = 由 BattleScene 用預設背景）。 */
export function battleBackdropFor(encounter: string): BackdropId | null {
  if (encounter === 'boss_bellworm' || encounter.startsWith('deep_')) return 'deep';
  if (encounter === 'bell_hall') return 'bellhall';
  if (encounter.startsWith('mine_')) return 'mine';
  if (encounter === 'sewer_rats') return 'sewer';
  if (encounter === 'alley_thugs') return 'market';
  if (encounter === 'academy_guard') return 'academy';
  if (encounter === 'rourke_1' || encounter === 'rourke_2' || encounter === 'rourke_3') return 'rooftop';
  return null;
}
