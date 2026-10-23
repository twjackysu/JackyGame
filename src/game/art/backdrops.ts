// 對話用地點背景（Canvas 程序繪製，一次生成後快取成材質）。
import Phaser from 'phaser';

export type BackdropId = 'town' | 'tavern' | 'forest' | 'lake' | 'ruins' | 'mine' | 'bellhall' | 'deep';

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

const DRAW: Record<Exclude<BackdropId, 'ruins'>, (c: CanvasRenderingContext2D) => void> = {
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
  if (location === 'tavern' || location === 'general_store') return 'tavern';
  if (location === 'orphanage' || location === 'town_gate') return 'town';
  if (location === 'mist_lake') return 'lake';
  if (location === 'lighthouse') return 'ruins';
  return 'forest';
}
