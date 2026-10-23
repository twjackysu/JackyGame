// 對話用地點背景（Canvas 程序繪製，一次生成後快取成材質）。
import Phaser from 'phaser';

export type BackdropId = 'town' | 'tavern' | 'forest' | 'lake' | 'ruins';

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
  if (location === 'tavern' || location === 'general_store') return 'tavern';
  if (location === 'orphanage' || location === 'town_gate') return 'town';
  if (location === 'mist_lake') return 'lake';
  if (location === 'lighthouse') return 'ruins';
  return 'forest';
}
