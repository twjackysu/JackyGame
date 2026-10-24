// 自由探索地圖的程式美術：把整張區域畫進一張 canvas（地塊＋建築＋樹），以及 NPC／寶箱／告示的小圖。
import type { AreaDef, Building } from '../../core/explore/area';
import { tileAt, type Grid } from '../../core/explore/grid';

export const TILE = 48;

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const GRASS = ['#1f3a2c', '#22402f', '#1c3628', '#25432f'];

function grass(c: CanvasRenderingContext2D, x: number, y: number, r: () => number, flowers: boolean): void {
  c.fillStyle = GRASS[Math.floor(r() * GRASS.length)]!;
  c.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 7; i++) {
    const gx = x + r() * TILE;
    const gy = y + r() * TILE;
    c.strokeStyle = r() < 0.5 ? 'rgba(90,140,90,0.55)' : 'rgba(20,40,28,0.7)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(gx, gy);
    c.lineTo(gx + (r() - 0.5) * 4, gy - 4 - r() * 4);
    c.stroke();
  }
  if (flowers) {
    const cols = ['#ffd27a', '#ff9ab8', '#b8c4ff', '#ffffff'];
    for (let i = 0; i < 5; i++) {
      c.fillStyle = cols[Math.floor(r() * cols.length)]!;
      c.beginPath();
      c.arc(x + 6 + r() * (TILE - 12), y + 6 + r() * (TILE - 12), 2.5, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function road(c: CanvasRenderingContext2D, x: number, y: number, r: () => number): void {
  c.fillStyle = '#4a4650';
  c.fillRect(x, y, TILE, TILE);
  // 石板：兩列錯位
  for (let row = 0; row < 3; row++) {
    const off = row % 2 === 0 ? 0 : TILE / 4;
    for (let col = -1; col < 3; col++) {
      const sx = x + off + col * (TILE / 2);
      const sy = y + row * (TILE / 3);
      const shade = 70 + Math.floor(r() * 26);
      c.fillStyle = `rgb(${shade},${shade - 4},${shade + 8})`;
      const x0 = Math.max(x, sx + 1);
      const x1 = Math.min(x + TILE, sx + TILE / 2 - 1);
      if (x1 > x0) c.fillRect(x0, sy + 1, x1 - x0, TILE / 3 - 2);
    }
  }
}

function water(c: CanvasRenderingContext2D, x: number, y: number, r: () => number): void {
  const g = c.createLinearGradient(x, y, x, y + TILE);
  g.addColorStop(0, '#1a3a5a');
  g.addColorStop(1, '#14304a');
  c.fillStyle = g;
  c.fillRect(x, y, TILE, TILE);
  c.strokeStyle = 'rgba(160,210,255,0.25)';
  c.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const wy = y + 10 + r() * 28;
    const wx = x + r() * 20;
    c.beginPath();
    c.moveTo(wx, wy);
    c.quadraticCurveTo(wx + 7, wy - 3, wx + 14, wy);
    c.stroke();
  }
}

function tree(c: CanvasRenderingContext2D, x: number, y: number, r: () => number): void {
  const cx = x + TILE / 2 + (r() - 0.5) * 6;
  const cy = y + TILE / 2;
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.ellipse(cx, cy + 16, 18, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#3a2a1e';
  c.fillRect(cx - 3, cy + 4, 6, 12);
  const layers: [number, number, string][] = [[0, 20, '#14301f'], [-5, 15, '#1d4229'], [-10, 10, '#2a5a36']];
  for (const [dy, rad, col] of layers) {
    c.fillStyle = col;
    c.beginPath();
    c.arc(cx, cy + dy, rad, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = 'rgba(160,220,150,0.25)';
  c.beginPath();
  c.arc(cx - 4, cy - 14, 4, 0, Math.PI * 2);
  c.fill();
}

function wall(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.fillStyle = '#3a3640';
  c.fillRect(x, y, TILE, TILE);
  c.fillStyle = '#56505e';
  for (let row = 0; row < 4; row++) {
    const off = row % 2 === 0 ? 0 : 12;
    for (let col = -1; col < 3; col++) {
      const bx = x + off + col * 24;
      const x0 = Math.max(x, bx + 1);
      const x1 = Math.min(x + TILE, bx + 23);
      if (x1 > x0) c.fillRect(x0, y + row * 12 + 1, x1 - x0, 10);
    }
  }
  c.fillStyle = '#2a2630';
  c.fillRect(x, y, TILE, 6);
}

function building(c: CanvasRenderingContext2D, b: Building): void {
  const x = b.x * TILE;
  const y = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  const roofH = Math.round(h * 0.58);
  // 陰影
  c.fillStyle = 'rgba(0,0,0,0.4)';
  c.fillRect(x + 8, y + 10, w, h);
  // 牆面
  c.fillStyle = b.wall;
  c.fillRect(x, y + roofH - 6, w, h - roofH + 6);
  c.fillStyle = 'rgba(0,0,0,0.18)';
  for (let px = x + 12; px < x + w; px += 24) c.fillRect(px, y + roofH, 2, h - roofH);
  // 屋頂（3/4 視角：梯形＋瓦片橫紋）
  c.fillStyle = b.roof;
  c.beginPath();
  c.moveTo(x - 6, y + roofH);
  c.lineTo(x + 10, y);
  c.lineTo(x + w - 10, y);
  c.lineTo(x + w + 6, y + roofH);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.28)';
  c.lineWidth = 2;
  for (let ry = y + 10; ry < y + roofH; ry += 10) {
    c.beginPath();
    c.moveTo(x - 6 + ((ry - y) / roofH) * -0, ry);
    c.lineTo(x + w + 6, ry);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fillRect(x + 10, y, w - 20, 4);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(x - 6, y + roofH - 4, w + 12, 6);
  // 窗戶
  const wy = y + roofH + 14;
  for (let px = x + 18; px + 22 < x + w - 8; px += 52) {
    c.fillStyle = b.lit ? '#ffcf80' : '#262a3a';
    c.fillRect(px, wy, 20, 22);
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(px + 9, wy, 2, 22);
    c.fillRect(px, wy + 10, 20, 2);
  }
  // 招牌
  if (b.sign) {
    c.font = '700 20px "Noto Sans TC", "PingFang TC", sans-serif';
    const tw = c.measureText(b.sign).width + 18;
    const sx = x + w / 2 - tw / 2;
    const sy = y + roofH - 34;
    c.fillStyle = '#2a1a10';
    c.fillRect(sx, sy, tw, 28);
    c.strokeStyle = '#c8a060';
    c.lineWidth = 2;
    c.strokeRect(sx, sy, tw, 28);
    c.fillStyle = '#ffe2a8';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(b.sign, x + w / 2, sy + 15);
  }
}

function door(c: CanvasRenderingContext2D, tx: number, ty: number): void {
  const x = tx * TILE + 10;
  const y = ty * TILE + 8;
  c.fillStyle = '#3a2416';
  c.beginPath();
  c.moveTo(x, y + 40);
  c.lineTo(x, y + 12);
  c.arc(x + 14, y + 12, 14, Math.PI, 0);
  c.lineTo(x + 28, y + 40);
  c.closePath();
  c.fill();
  c.strokeStyle = '#8a6040';
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = '#ffd27a';
  c.beginPath();
  c.arc(x + 22, y + 26, 2, 0, Math.PI * 2);
  c.fill();
}

/**
 * 把整張區域畫進 canvas（尺寸 grid.w*TILE × grid.h*TILE）。路燈、井在這裡畫底座，光暈由場景加。
 * hasArt(key) = 該 AI 美術物件已載入：樹／路燈／井／有 prop 的建築改由場景用圖片精靈畫（才能跟角色前後排序），這裡只畫地面與陰影。
 */
export function drawAreaGround(c: CanvasRenderingContext2D, a: AreaDef, g: Grid, hasArt: (key: string) => boolean = () => false): void {
  const artTree = hasArt('prop_tree_a');
  const artLamp = hasArt('prop_lamppost');
  const artWell = hasArt('prop_well');
  const r = rng(a.id.length * 977 + g.w * 31 + g.h);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const t = tileAt(g, x, y);
      const px = x * TILE;
      const py = y * TILE;
      if (t === '=' || t === 'G' || t === 'L' || t === 'o') road(c, px, py, r);
      else if (t === '~') water(c, px, py, r);
      else if (t === 'W') wall(c, px, py);
      else grass(c, px, py, r, t === ',');
    }
  }
  // 水岸
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (tileAt(g, x, y) !== '~') continue;
      c.strokeStyle = 'rgba(200,230,255,0.35)';
      c.lineWidth = 3;
      const px = x * TILE;
      const py = y * TILE;
      if (tileAt(g, x, y - 1) !== '~') { c.beginPath(); c.moveTo(px, py + 1); c.lineTo(px + TILE, py + 1); c.stroke(); }
      if (tileAt(g, x, y + 1) !== '~') { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(px, py + TILE - 5, TILE, 5); }
    }
  }
  // 物件（由上到下畫，下面的蓋住上面的）
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const t = tileAt(g, x, y);
      const px = x * TILE;
      const py = y * TILE;
      if (t === 'T') {
        if (artTree) {
          c.fillStyle = 'rgba(0,0,0,0.3)';
          c.beginPath();
          c.ellipse(px + 24, py + 40, 20, 7, 0, 0, Math.PI * 2);
          c.fill();
        } else tree(c, px, py, r);
      } else if (t === 'L') {
        if (artLamp) continue;
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.beginPath();
        c.ellipse(px + 24, py + 42, 10, 4, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#2a2a32';
        c.fillRect(px + 21, py + 8, 6, 34);
        c.fillStyle = '#3a3a44';
        c.fillRect(px + 15, py + 4, 18, 14);
        c.fillStyle = '#ffd27a';
        c.fillRect(px + 18, py + 7, 12, 8);
      } else if (t === 'o') {
        // 井（兩格寬時只在左格畫一次）
        if (tileAt(g, x - 1, y) === 'o' || artWell) continue;
        const w2 = tileAt(g, x + 1, y) === 'o' ? TILE * 2 : TILE;
        c.fillStyle = '#5a5662';
        c.beginPath();
        c.ellipse(px + w2 / 2, py + 26, w2 / 2 - 4, 18, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#0e1a26';
        c.beginPath();
        c.ellipse(px + w2 / 2, py + 24, w2 / 2 - 14, 11, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(120,200,255,0.35)';
        c.beginPath();
        c.ellipse(px + w2 / 2 - 6, py + 22, 6, 3, 0, 0, Math.PI * 2);
        c.fill();
      } else if (t === 'G') {
        c.fillStyle = 'rgba(255,210,122,0.12)';
        c.fillRect(px, py, TILE, TILE);
      }
    }
  }
  // 城門拱
  for (let x = 0; x < g.w; x++) {
    for (let y = 0; y < g.h; y++) {
      if (tileAt(g, x, y) === 'G' && tileAt(g, x - 1, y) !== 'G') {
        let w = 1;
        while (tileAt(g, x + w, y) === 'G') w++;
        const px = x * TILE;
        const py = y * TILE;
        c.fillStyle = '#2a2630';
        c.fillRect(px - 12, py - 20, 12, TILE + 20);
        c.fillRect(px + w * TILE, py - 20, 12, TILE + 20);
        c.fillRect(px - 12, py - 28, w * TILE + 24, 12);
        c.fillStyle = '#ffd27a';
        c.fillRect(px - 8, py - 26, 4, 6);
        c.fillRect(px + w * TILE + 4, py - 26, 4, 6);
      }
    }
  }
  for (const b of a.buildings) {
    if (b.prop && hasArt(b.prop)) {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse((b.x + b.w / 2) * TILE + 10, (b.y + b.h) * TILE - 6, (b.w * TILE) / 2 + 6, 16, 0, 0, Math.PI * 2);
      c.fill();
    } else building(c, b);
  }
  for (const e of a.entities) {
    if (e.kind !== 'door') continue;
    const b = a.buildings.find((bb) => e.x >= bb.x && e.x < bb.x + bb.w && e.y >= bb.y && e.y < bb.y + bb.h);
    if (!b?.prop || !hasArt(b.prop)) door(c, e.x, e.y);
  }
}

/** Q 版 NPC 小人（2 倍解析度 64×96，顯示 0.5 → 32×48 左右，再依場景縮放） */
export function drawChibi(c: CanvasRenderingContext2D, body: string, hair: string): void {
  c.save();
  c.scale(2, 2);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.ellipse(16, 45, 11, 3.5, 0, 0, Math.PI * 2);
  c.fill();
  // 身體
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(8, 44);
  c.lineTo(10, 26);
  c.quadraticCurveTo(16, 22, 22, 26);
  c.lineTo(24, 44);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.fillRect(16, 26, 8, 18);
  // 頭
  c.fillStyle = '#f2d2b8';
  c.beginPath();
  c.arc(16, 17, 10, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = hair;
  c.beginPath();
  c.arc(16, 15, 10.5, Math.PI * 1.02, Math.PI * 1.98);
  c.lineTo(26, 18);
  c.quadraticCurveTo(20, 11, 12, 13);
  c.lineTo(6, 18);
  c.closePath();
  c.fill();
  c.fillStyle = '#2a1a1a';
  c.fillRect(11.5, 18, 2, 3);
  c.fillRect(18.5, 18, 2, 3);
  c.fillStyle = 'rgba(255,140,140,0.4)';
  c.fillRect(9.5, 22, 3, 1.5);
  c.fillRect(19.5, 22, 3, 1.5);
  c.restore();
}

export function drawChest(c: CanvasRenderingContext2D, open: boolean): void {
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.ellipse(24, 40, 18, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#6a3e1e';
  c.fillRect(8, 20, 32, 20);
  c.fillStyle = open ? '#2a160a' : '#8a5428';
  c.fillRect(8, open ? 10 : 12, 32, open ? 8 : 10);
  c.fillStyle = '#d8a848';
  c.fillRect(8, 20, 32, 3);
  c.fillRect(21, 18, 6, 8);
  if (open) {
    c.fillStyle = 'rgba(255,220,120,0.6)';
    c.fillRect(12, 18, 24, 3);
  }
}

export function drawSignBoard(c: CanvasRenderingContext2D): void {
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.ellipse(24, 42, 14, 4, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#3a2416';
  c.fillRect(12, 24, 4, 18);
  c.fillRect(32, 24, 4, 18);
  c.fillStyle = '#8a6040';
  c.fillRect(6, 8, 36, 22);
  c.fillStyle = '#e8d8b0';
  c.fillRect(10, 12, 12, 8);
  c.fillRect(25, 13, 13, 10);
}
