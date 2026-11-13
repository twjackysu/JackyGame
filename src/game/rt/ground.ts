// 冒險地圖的地面（第 150 輪，Q5 拆場景）：深色地面＋斑點草叢＋牆＋上下緣漸層，畫成分塊材質放進一個 container。
// 從 RtBattleScene 原封不動搬出來（純畫面、固定種子，不碰戰鬥 PRNG）。
import { THORN_BUSH, thornLobes } from './thornBush';
import { EMBER_CRACK_HALF, emberCrack } from './emberCrack';
import { EMBER_ROCK, emberRock } from './emberRock';
import { TREE_CROWN, crownLobes } from './treeCrown';
import Phaser from 'phaser';
import { STAGES } from '../../core/battle/rt/data';
import { activeHazards } from '../../core/battle/rt/engine';
import type { BattleState } from '../../core/battle/rt/types';
import { GAME_WIDTH } from '../config';
import { WORLD_MAPS, worldMap } from '../worldMaps';

/** 地面材質分塊大小（px） */
const GROUND_CHUNK = 1024;
/** 地圖上下緣內側陰影的高度（畫面 px，第 64 輪） */
const EDGE_SHADE = 90;

/** 地圖下緣外的漸層（第 48 輪）：上＝地面色（略暗），下＝底色 */
export function edgeFadeTexture(scene: Phaser.Scene, stageId: string): string {
  const P = (worldMap(stageId) ?? WORLD_MAPS[0]!).palette;
  const key = `rt_edgefade_${P.ground.toString(16)}_${P.under.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 4, 256);
  if (!tex) return '__DEFAULT';
  const ctx = tex.getContext();
  const a = Phaser.Display.Color.IntegerToColor(P.ground);
  const b = Phaser.Display.Color.IntegerToColor(P.under);
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, `rgb(${a.red * 0.85 | 0},${a.green * 0.85 | 0},${a.blue * 0.85 | 0})`);
  grd.addColorStop(0.55, `rgb(${(a.red + b.red) / 2 | 0},${(a.green + b.green) / 2 | 0},${(a.blue + b.blue) / 2 | 0})`);
  grd.addColorStop(1, `rgb(${b.red},${b.green},${b.blue})`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 4, 256);
  tex.refresh();
  return key;
}

/** 地圖上下緣內側的陰影（第 64 輪）：上＝漸層起點色（地面色略暗）不透明，下＝透明；接得上 edgeFadeTexture */
export function edgeShadeTexture(scene: Phaser.Scene, stageId: string): string {
  const P = (worldMap(stageId) ?? WORLD_MAPS[0]!).palette;
  const key = `rt_edgeshade_${P.ground.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 4, 128);
  if (!tex) return '__DEFAULT';
  const ctx = tex.getContext();
  const a = Phaser.Display.Color.IntegerToColor(P.ground);
  const c = `${a.red * 0.85 | 0},${a.green * 0.85 | 0},${a.blue * 0.85 | 0}`;
  const grd = ctx.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, `rgba(${c},1)`);
  grd.addColorStop(0.3, `rgba(${c},0.7)`);
  grd.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 4, 128);
  tex.refresh();
  return key;
}

/** 零星岩塊的顏色（第 196 輪）：[側面底色, 頂面, 受光邊的細亮線]。森林＝偏冷的暗灰、荊棘谷＝跟乾土同一個色系的褐灰 */
const LONE_ROCK = { forest: [0x3c4244, 0x596164, 0x9aa4a8], thorn: [0x3e302c, 0x5a4840, 0x927466] } as const;

/** 格線淡一點（A6，第 152 輪）：以前 1.0，地面一格一格的感覺太重 */
const GRID_ALPHA = 0.55;

/** 座標雜湊亂數（分塊重畫時每塊結果一致；不碰戰鬥 PRNG） */
function h01(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 顏色乘一個亮度係數（>1 變亮，<1 變暗） */
function tone(c: number, f: number): number {
  const ch = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

/**
 * 地面去重複感（A6，第 152 輪）：畫在斑點底下。
 * 1) 大塊明暗色塊：每 700 單位一塊，用 4 層半透明同心橢圓假裝柔邊，讓大地圖有「這片比較亮、那片比較暗」的起伏；
 * 2) 小 decal：森林＝落葉＋小石子，荊棘谷＝乾裂紋＋紅褐石子，燼紅裂谷＝焦黑裂紋（少數帶暗橘餘燼）＋灰燼點，星隕高原＝碎星晶＋淡光點。
 * 世界座標 × k；只畫這一塊附近的（亂數用索引雜湊，所以每塊畫出同一張圖）。
 */
function paintVariety(g: Phaser.GameObjects.Graphics, decor: 'forest' | 'thorn' | 'ember' | 'star', ground: number, aw: number, ah: number, k: number, bx0: number, by0: number, bx1: number, by1: number): void {
  const out = (x: number, y: number, m: number): boolean => x < bx0 - m || x > bx1 + m || y < by0 - m || y > by1 + m;
  const hiC = decor === 'forest' ? 0x1f3524 : tone(ground, 1.25);
  const loC = tone(ground, 0.72);
  const nPatch = Math.ceil((aw * ah) / (700 * 700));
  for (let i = 0; i < nPatch; i++) {
    const x = h01(i, 1) * aw * k;
    const y = h01(i, 2) * ah * k;
    const rw = (220 + h01(i, 3) * 320) * k;
    const rh = rw * (0.55 + h01(i, 4) * 0.35);
    if (out(x, y, rw)) continue;
    const c = h01(i, 5) < 0.5 ? hiC : loC;
    for (let l = 0; l < 4; l++) {
      const f = 1 - l * 0.22;
      g.fillStyle(c, 0.11).fillEllipse(x, y, rw * 2 * f, rh * 2 * f);
    }
  }
  const nDecal = Math.ceil((aw * ah) / 45000);
  for (let i = 0; i < nDecal; i++) {
    const x = h01(i, 11) * aw * k;
    const y = h01(i, 12) * ah * k;
    if (out(x, y, 30)) continue;
    const r = h01(i, 13);
    const ang = h01(i, 14) * Math.PI * 2;
    const sz = (6 + h01(i, 15) * 8) * k * 2.5;
    if (decor === 'forest') {
      if (r < 0.45) {
        // 落葉：兩三片扁橢圓疊在一起（一小撮，比單片自然）
        const col = r < 0.15 ? 0x5a4a22 : r < 0.3 ? 0x4a5226 : 0x5e3a1c;
        const n = 2 + (h01(i, 16) < 0.5 ? 1 : 0);
        for (let t = 0; t < n; t++) {
          const lx = x + Math.cos(ang + t * 2.1) * sz * 0.35;
          const ly = y + Math.sin(ang + t * 2.1) * sz * 0.25;
          g.fillStyle(col, 0.38).fillEllipse(lx, ly, sz * 0.75, sz * 0.38);
        }
      } else if (r < 0.75) {
        g.fillStyle(0x2a332c, 0.7).fillCircle(x, y, sz * 0.3);
        g.fillStyle(0x4a554c, 0.5).fillCircle(x - sz * 0.08, y - sz * 0.08, sz * 0.14);
      }
      // 其餘（約 1/4）留白：地面不要每一處都有東西
    } else if (decor === 'thorn' || decor === 'ember') {
      if (r < 0.45) {
        // 乾裂紋／焦黑裂紋：三段折線
        let px = x;
        let py = y;
        const segs: number[] = [px, py];
        for (let t = 0; t < 3; t++) {
          const a2 = ang + (h01(i, 20 + t) - 0.5) * 1.4;
          px += Math.cos(a2) * sz * 0.9;
          py += Math.sin(a2) * sz * 0.9;
          segs.push(px, py);
        }
        g.lineStyle(2, tone(ground, 0.55), 0.85);
        for (let t = 0; t < 3; t++) g.lineBetween(segs[t * 2]!, segs[t * 2 + 1]!, segs[t * 2 + 2]!, segs[t * 2 + 3]!);
        if (decor === 'ember' && h01(i, 25) < 0.3) {
          g.lineStyle(1, 0xff6a2a, 0.35);
          for (let t = 0; t < 3; t++) g.lineBetween(segs[t * 2]!, segs[t * 2 + 1]!, segs[t * 2 + 2]!, segs[t * 2 + 3]!);
        }
      } else if (decor === 'thorn') {
        g.fillStyle(0x3a2620, 0.75).fillCircle(x, y, sz * 0.28);
        g.fillStyle(0x5a3e30, 0.5).fillCircle(x - sz * 0.07, y - sz * 0.07, sz * 0.12);
      } else {
        // 灰燼點
        g.fillStyle(0x5a5250, 0.35).fillCircle(x, y, sz * 0.18);
        g.fillStyle(0x3a3230, 0.5).fillCircle(x + sz * 0.3, y + sz * 0.1, sz * 0.12);
      }
    } else {
      if (r < 0.4) {
        // 碎星晶：小菱形＋亮點
        const w = sz * 0.22;
        const hh = sz * 0.45;
        g.fillStyle(0x4a56a8, 0.6).fillTriangle(x - w, y, x + w, y, x, y - hh).fillTriangle(x - w, y, x + w, y, x, y + hh * 0.5);
        g.fillStyle(0xc8d4ff, 0.5).fillCircle(x, y - hh * 0.3, Math.max(1, sz * 0.07));
      } else {
        g.fillStyle(0xaab4ff, 0.18 + h01(i, 26) * 0.2).fillCircle(x, y, Math.max(1, sz * 0.1));
      }
    }
  }
}

/** 地面：深綠＋格線＋零星草叢＋牆（世界座標 × k，原點在場地左上） */
export function makeGround(scene: Phaser.Scene, s: BattleState, stageId: string, k: number, viewH: number): Phaser.GameObjects.Container {
  const a = s.arena;
  const W = a.w * k;
  const H = a.h * k;
  const key = `rt_ground_${stageId}_${a.w}x${a.h}`;
  const PAD = 8;
  const TW = Math.ceil(W) + PAD * 2;
  const TH = Math.ceil(H) + PAD * 2;
  const box = scene.add.container(0, 0);
  // 分塊：每塊最多 GROUND_CHUNK px；小關卡只有一塊（跟以前一樣）
  const nx = Math.ceil(TW / GROUND_CHUNK);
  const ny = Math.ceil(TH / GROUND_CHUNK);
  const chunkKey = (i: number, j: number): string => (nx * ny === 1 ? key : `${key}_${i}_${j}`);
  const place = (): Phaser.GameObjects.Container => {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      box.add(scene.add.image(i * GROUND_CHUNK - PAD, j * GROUND_CHUNK - PAD, chunkKey(i, j)).setOrigin(0));
    }
    // 第 48 輪：鏡頭可以往地圖下緣外多捲約 30%（讓主角不被按鈕擋住），長螢幕上那一大塊是硬切的純黑。
    // 在下緣外接一條「地面色→底色」的漸層，像地圖邊緣沒入黑暗（材質只有 4×256，拉伸畫）
    if (W > GAME_WIDTH || H > viewH) {
      box.add(scene.add.image(-PAD, H + PAD - 2, edgeFadeTexture(scene, stageId)).setOrigin(0).setDisplaySize(W + PAD * 2, 560));
      // 第 63 輪：上緣外也接一條（鏡頭可以往上多捲 TOP_EXTRA）
      box.add(scene.add.image(-PAD, -PAD + 2 - 360, edgeFadeTexture(scene, stageId)).setOrigin(0).setFlipY(true).setDisplaySize(W + PAD * 2, 360));
      // 第 64 輪：地圖上下緣的牆被材質邊硬切成一條亮線（星隕高原的水晶最明顯）→ 邊緣內側壓一層「底色→透明」的陰影，牆沒入黑暗
      const shade = edgeShadeTexture(scene, stageId);
      box.add(scene.add.image(-PAD, -PAD, shade).setOrigin(0).setDisplaySize(W + PAD * 2, EDGE_SHADE + PAD));
      box.add(scene.add.image(-PAD, H + PAD, shade).setOrigin(0, 0).setFlipY(true).setDisplaySize(W + PAD * 2, EDGE_SHADE + PAD).setY(H + PAD - (EDGE_SHADE + PAD)));
    }
    return box;
  };
  // 省記憶體（第 31 輪）：一張大地圖的地面材質約 50MB（GPU），以前四張圖都留著；換圖時把別張圖的地面丟掉，回來再畫
  for (const tk of scene.textures.getTextureKeys()) if (tk.startsWith('rt_ground_') && tk !== key && !tk.startsWith(`${key}_`)) scene.textures.remove(tk);
  if (scene.textures.exists(chunkKey(0, 0))) return place();
  // 每塊各自重畫一次（Graphics.generateTexture 不吃物件位置，要用 translateCanvas 平移；同一個固定種子，所以每塊畫出同一張地圖）
  // 地圖色調（D-114）：荊棘谷是紅褐色乾土＋紫紅荊棘叢，其他沿用森林綠
  const wmp = worldMap(stageId) ?? WORLD_MAPS[0]!;
  const tv = wmp.decor === 'thorn';
  const ember = wmp.decor === 'ember';
  const starD = wmp.decor === 'star';
  const P = wmp.palette;
  const paint = (g: Phaser.GameObjects.Graphics, bx0: number, by0: number, bx1: number, by1: number): void => {
    g.fillStyle(P.ground, 1).fillRect(0, 0, W, H);
    paintVariety(g, wmp.decor, P.ground, a.w, a.h, k, bx0, by0, bx1, by1);
    // 固定種子的地面斑點（不影響戰鬥 PRNG）
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < (a.w * a.h) / 9000; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const dark = rnd() < 0.5;
      const ew = 30 + rnd() * 60;
      const eh = 14 + rnd() * 24;
      const grass = rnd() < 0.3 ? [0, 1, 2, 3, 4].map(() => rnd() * 8) : null;
      // 亂數照樣消耗（每塊畫出同一張圖），只是這塊外面的不畫
      if (x < bx0 - 80 || x > bx1 + 80 || y < by0 - 40 || y > by1 + 40) continue;
      g.fillStyle(dark ? P.spotA : P.spotB, 0.8).fillEllipse(x, y, ew, eh);
      if (grass) {
        g.lineStyle(2, P.grass, 0.8);
        for (let j = -2; j <= 2; j++) g.lineBetween(x + j * 4, y, x + j * 6, y - 10 - grass[j + 2]!);
      }
    }
    // 毒沼（D-114）：暗綠泥水＋亮綠泡泡＋深色邊（畫在格線下面）
    for (const h of activeHazards(s)) {
      const hx = h.x * k;
      const hy = h.y * k;
      const hr2 = h.r * k;
      if (hx + hr2 < bx0 - 40 || hx - hr2 > bx1 + 40 || hy + hr2 < by0 - 40 || hy - hr2 > by1 + 40) continue;
      g.fillStyle(0x0e1608, 0.9).fillEllipse(hx, hy + hr2 * 0.06, hr2 * 2.15, hr2 * 1.95);
      g.fillStyle(0x2c4418, 0.95).fillEllipse(hx, hy, hr2 * 2, hr2 * 1.8);
      g.fillStyle(0x46682a, 0.8).fillEllipse(hx - hr2 * 0.15, hy - hr2 * 0.12, hr2 * 1.3, hr2 * 1.05);
      let bs = Math.round(h.x * 7 + h.y * 13);
      const br = () => ((bs = (bs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let b = 0; b < 9; b++) {
        const ang = br() * Math.PI * 2;
        const rr = Math.sqrt(br()) * hr2 * 0.75;
        g.fillStyle(0x9adf5a, 0.35 + br() * 0.35).fillCircle(hx + Math.cos(ang) * rr, hy + Math.sin(ang) * rr * 0.9, 3 + br() * 7);
      }
    }
    // 噴發口（D-125）：焦黑火山口＋暗紅熔岩芯（噴發預告另外每幀畫）
    for (const v of STAGES[stageId]?.vents ?? []) {
      const vx = v.x * k;
      const vy = v.y * k;
      const vr = v.r * k;
      if (vx + vr < bx0 - 40 || vx - vr > bx1 + 40 || vy + vr < by0 - 40 || vy - vr > by1 + 40) continue;
      if (starD) {
        // 墜星落點（D-138）：被砸出來的淺坑＋放射裂痕＋坑底一塊發光的星晶
        g.fillStyle(0x070812, 0.85).fillEllipse(vx, vy, vr * 2.1, vr * 1.8);
        g.fillStyle(0x1c2140, 1).fillEllipse(vx, vy, vr * 1.5, vr * 1.25);
        g.lineStyle(2, 0x4a5aa0, 0.7);
        for (let t = 0; t < 7; t++) {
          const a2 = (t / 7) * Math.PI * 2 + vx * 0.01;
          g.lineBetween(vx + Math.cos(a2) * vr * 0.7, vy + Math.sin(a2) * vr * 0.6, vx + Math.cos(a2) * vr * 1.15, vy + Math.sin(a2) * vr * 0.98);
        }
        // 坑底的星晶碎塊（菱形，避免看起來像箭頭）
        g.fillStyle(0x6a7ad8, 0.9).fillPoints([new Phaser.Math.Vector2(vx, vy - vr * 0.3), new Phaser.Math.Vector2(vx + vr * 0.17, vy), new Phaser.Math.Vector2(vx, vy + vr * 0.22), new Phaser.Math.Vector2(vx - vr * 0.17, vy)], true);
        g.fillStyle(0xd8e0ff, 0.9).fillPoints([new Phaser.Math.Vector2(vx, vy - vr * 0.18), new Phaser.Math.Vector2(vx + vr * 0.07, vy), new Phaser.Math.Vector2(vx, vy + vr * 0.1), new Phaser.Math.Vector2(vx - vr * 0.07, vy)], true);
        continue;
      }
      g.fillStyle(0x0a0606, 0.9).fillEllipse(vx, vy, vr * 2.2, vr * 1.9);
      g.fillStyle(0x3a1a10, 1).fillEllipse(vx, vy, vr * 1.5, vr * 1.25);
      g.fillStyle(0x8a2a10, 0.9).fillEllipse(vx, vy, vr * 0.8, vr * 0.6);
      g.fillStyle(0xff7a2a, 0.7).fillEllipse(vx, vy, vr * 0.36, vr * 0.26);
      g.lineStyle(2, 0x5a2a18, 0.8).strokeEllipse(vx, vy, vr * 2.0, vr * 1.7);
    }
    g.lineStyle(1, P.grid, GRID_ALPHA);
    for (let x = 0; x <= a.w; x += 100) g.lineBetween(x * k, 0, x * k, H);
    for (let y = 0; y <= a.h; y += 100) g.lineBetween(0, y * k, W, y * k);
    // 障礙物（D-070／D-071）：成片的（周圍 8 格有 5 格以上也是障礙）畫成樹林，零散的畫成圓石。
    // 每格用座標雜湊當亂數（分塊時只畫這一塊附近的格子，結果仍一致）
    if (a.solid) {
      const c = a.solid.cell * k;
      const rows = a.solid.rows;
      const solidAt = (x: number, y: number): boolean => x < 0 || y < 0 || y >= rows.length || x >= rows[y]!.length || rows[y]![x] === '#';
      const dense = (x: number, y: number): boolean => {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && solidAt(x + dx, y + dy)) n++;
        return n >= 5;
      };
      const hr = (x: number, y: number, i: number): number => {
        let h = (x * 374761393 + y * 668265263 + i * 2246822519) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      };
      const cx0 = Math.max(0, Math.floor(bx0 / c) - 1);
      const cx1 = Math.ceil(bx1 / c) + 1;
      const cy0 = Math.max(0, Math.floor(by0 / c) - 1);
      const cy1 = Math.min(rows.length - 1, Math.ceil(by1 / c) + 1);
      // 樹林底（深色地面，讓林帶讀起來是一整片）
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= Math.min(cx1, rows[cy]!.length - 1); cx++) {
        if (rows[cy]![cx] === '#' && dense(cx, cy)) g.fillStyle(P.under, 1).fillRect(cx * c - 1, cy * c - 1, c + 2, c + 2);
      }
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= Math.min(cx1, rows[cy]!.length - 1); cx++) {
        if (rows[cy]![cx] !== '#') continue;
        const x = cx * c;
        const y = cy * c;
        if (dense(cx, cy)) {
          // 樹冠：影子＋兩層葉團＋左上亮面（由上往下畫，下面的樹蓋住上面的，有前後感）
          const ox = (hr(cx, cy, 1) - 0.5) * c * 0.3;
          const oy = (hr(cx, cy, 2) - 0.5) * c * 0.3;
          const r = c * (0.62 + hr(cx, cy, 3) * 0.18);
          g.fillStyle(0x050a06, 0.5).fillEllipse(x + c / 2 + ox + c * 0.12, y + c * 0.75 + oy, r * 2.1, r * 1.1);
          const forest = wmp.decor === 'forest';
          if (!ember && !forest) g.fillStyle(hr(cx, cy, 4) < 0.5 ? P.crownA : P.crownB, 1).fillCircle(x + c / 2 + ox, y + c / 2 + oy, r);
          if (forest) {
            // 樹冠（第 196 輪改）：以前是三個同心圓（深綠＋淺綠＋高光點），像一排排綠色鈕扣。現在是一團葉簇：輪廓有起伏、右下暗、左上亮
            const mx = x + c / 2 + ox;
            const my = y + c / 2 + oy;
            const base = hr(cx, cy, 4) < 0.5 ? P.crownA : P.crownB;
            for (const L of crownLobes((i) => hr(cx, cy, 60 + i))) {
              if (L.tone === 3) g.fillStyle(P.crownTop, TREE_CROWN.tipA);
              else g.fillStyle(L.tone === 2 ? P.crownHi : L.tone === 1 ? tone(base, TREE_CROWN.shadeTone) : base, 1);
              g.fillCircle(mx + L.x * r, my + L.y * r, L.r * r);
            }
          } else if (ember) {
            // 燼岩（第 196 輪改）：以前是灰色大圓＋亮面＋高光點，鋪滿畫面像一池鐵球。現在是有稜角的岩塊：側面照受光方向分明暗、頂面一階亮、沒有圓形高光
            const mx = x + c / 2 + ox;
            const my = y + c / 2 + oy;
            const rk = emberRock((i) => hr(cx, cy, 50 + i));
            const base = hr(cx, cy, 4) < 0.5 ? P.crownA : P.crownB;
            const poly = (pts: number[]): Phaser.Math.Vector2[] => {
              const out: Phaser.Math.Vector2[] = [];
              for (let t = 0; t < pts.length; t += 2) out.push(new Phaser.Math.Vector2(mx + pts[t]! * r, my + pts[t + 1]! * r));
              return out;
            };
            for (const f of rk.sides) g.fillStyle(tone(base, f.tone), 1).fillPoints(poly(f.pts), true);
            g.fillStyle(tone(P.crownHi, rk.top.tone), 1).fillPoints(poly(rk.top.pts), true);
            g.lineStyle(EMBER_ROCK.rimW, P.crownTop, EMBER_ROCK.rimA);
            for (const e of rk.rims) g.lineBetween(mx + e[0]! * r, my + e[1]! * r, mx + e[2]! * r, my + e[3]! * r);
          } else if (tv) {
            // 荊棘叢（第 195 輪改）：以前和樹冠同一招（大圓＋亮面＋高光）配上紫紅色，看起來是一顆顆發亮的氣球，鋪滿畫面時比主角和怪還搶眼。
            // 現在是幾團深色的葉簇＋短刺，沒有高光；漿果變小變暗、變少（以前的亮紅點像掉落物）
            const mx = x + c / 2 + ox;
            const my = y + c / 2 + oy;
            for (const L of thornLobes(hr(cx, cy, 5), hr(cx, cy, 6), hr(cx, cy, 7))) g.fillStyle(L.hi ? P.crownHi : P.crownB, 1).fillCircle(mx + L.x * r, my + L.y * r, L.r * r);
            g.lineStyle(THORN_BUSH.thornW, THORN_BUSH.thornColor, THORN_BUSH.thornA);
            for (let t = 0; t < THORN_BUSH.thorns; t++) {
              const ang = hr(cx, cy, 10 + t) * Math.PI * 2;
              const d0 = r * (0.35 + hr(cx, cy, 40 + t) * 0.5);
              const bx = mx + Math.cos(ang) * d0;
              const by = my + Math.sin(ang) * d0;
              g.lineBetween(bx, by, bx + Math.cos(ang) * r * THORN_BUSH.thornLen, by + Math.sin(ang) * r * THORN_BUSH.thornLen);
            }
            if (hr(cx, cy, 15) < THORN_BUSH.berryRate) g.fillStyle(THORN_BUSH.berryColor, 0.9).fillCircle(mx + r * 0.25, my + r * 0.1, r * THORN_BUSH.berryR);
          } else {
            g.fillStyle(P.crownHi, 1).fillCircle(x + c / 2 + ox - r * 0.2, y + c / 2 + oy - r * 0.25, r * 0.62);
            g.fillStyle(P.crownTop, 0.7).fillCircle(x + c / 2 + ox - r * 0.35, y + c / 2 + oy - r * 0.4, r * 0.28);
          }
          if (starD && hr(cx, cy, 30) < 0.85) {
            // 星晶（D-138）：樹冠位置長出一簇藍紫色晶柱（亮面＋白色稜線）
            const bx = x + c / 2 + ox;
            const by = y + c / 2 + oy + r * 0.2;
            for (let t = 0; t < 3; t++) {
              const lean = (hr(cx, cy, 31 + t) - 0.5) * r * 0.9;
              const hh = r * (0.9 + hr(cx, cy, 34 + t) * 0.8);
              const ww = r * 0.22;
              const px = bx + (t - 1) * r * 0.42;
              g.fillStyle(t === 1 ? 0x7a86e0 : 0x5a62b8, 1).fillTriangle(px - ww, by, px + ww, by, px + lean, by - hh);
              g.fillStyle(0xc8d4ff, 0.75).fillTriangle(px - ww * 0.2, by, px + ww * 0.5, by, px + lean, by - hh);
            }
          }
          const ek = ember ? emberCrack(hr(cx, cy, 20)) : 'none';
          if (ek !== 'none') {
            // 燼岩（D-125；第 191 輪改）：大部分是短而暗的餘燼縫、少數是亮的熔岩裂紋（外層暗橘、內層亮黃＋一圈暖光）
            const hot = ek === 'hot';
            const half = r * EMBER_CRACK_HALF[ek];
            const ang = hr(cx, cy, 21) * Math.PI;
            const mx = x + c / 2 + ox + (hot ? 0 : r * 0.18);
            const my = y + c / 2 + oy + (hot ? 0 : r * 0.22);
            const x0 = mx - Math.cos(ang) * half;
            const y0 = my - Math.sin(ang) * half;
            const xm = mx + (hr(cx, cy, 22) - 0.5) * r * 0.4;
            const ym = my + (hr(cx, cy, 23) - 0.5) * r * 0.4;
            const x1 = mx + Math.cos(ang) * half;
            const y1 = my + Math.sin(ang) * half;
            if (hot) {
              g.fillStyle(0xff6a1a, 0.1).fillCircle(mx, my, r * 0.85);
              g.lineStyle(5, 0xc8401a, 0.5).lineBetween(x0, y0, xm, ym).lineBetween(xm, ym, x1, y1);
              g.lineStyle(2, 0xffb04a, 0.9).lineBetween(x0, y0, xm, ym).lineBetween(xm, ym, x1, y1);
            } else {
              g.lineStyle(4, 0x6a1e0c, 0.5).lineBetween(x0, y0, xm, ym).lineBetween(xm, ym, x1, y1);
              g.lineStyle(1.5, 0xc85a1e, 0.6).lineBetween(x0, y0, xm, ym).lineBetween(xm, ym, x1, y1);
            }
          }
          continue;
        }
        const j = hr(cx, cy, 5) * 0.12;
        if (starD) {
          // 星隕高原的零星晶柱（D-138）：影子＋三根發光晶柱
          g.fillStyle(0x04050c, 0.6).fillEllipse(x + c * 0.55, y + c * 0.82, c * 1.05, c * 0.4);
          g.fillStyle(0x3a3e7a, 1).fillTriangle(x + c * 0.12, y + c * 0.86, x + c * 0.5, y + c * 0.86, x + c * 0.26, y + c * 0.2);
          g.fillStyle(0x6a76d0, 1).fillTriangle(x + c * 0.3, y + c * 0.9, x + c * 0.74, y + c * 0.9, x + c * (0.5 + j), y - c * 0.1);
          g.fillStyle(0x4a52a0, 1).fillTriangle(x + c * 0.6, y + c * 0.88, x + c * 0.92, y + c * 0.88, x + c * 0.82, y + c * 0.36);
          g.fillStyle(0xd8e0ff, 0.8).fillTriangle(x + c * 0.48, y + c * 0.9, x + c * 0.6, y + c * 0.9, x + c * (0.5 + j), y - c * 0.1);
          continue;
        }
        {
          // 零星的岩塊（第 196 輪改）：以前森林／荊棘谷是藍灰色的圓角方塊＋亮面（一顆顆鍵帽，荊棘谷裡比主角還亮），
          // 燼紅裂谷是圓角方形＋每顆一道亮橘斜線。現在三張圖都是有稜角的岩塊（和燼岩岩壁同一個 emberRock），顏色跟著地圖走、亮度壓低
          const mx = x + c * 0.5;
          const my = y + c * 0.46;
          const r = c * (0.5 + j);
          const rk = emberRock((i) => hr(cx, cy, 50 + i));
          const [rb, rt, rr] = ember ? [P.crownB, tone(P.crownHi, 1.08), P.crownTop] : tv ? LONE_ROCK.thorn : LONE_ROCK.forest;
          const poly = (pts: number[]): Phaser.Math.Vector2[] => {
            const out: Phaser.Math.Vector2[] = [];
            for (let t = 0; t < pts.length; t += 2) out.push(new Phaser.Math.Vector2(mx + pts[t]! * r, my + pts[t + 1]! * r));
            return out;
          };
          g.fillStyle(0x050303, 0.6).fillEllipse(x + c * 0.56, y + c * 0.84, c * 1.15, c * 0.42);
          for (const f of rk.sides) g.fillStyle(tone(rb, f.tone), 1).fillPoints(poly(f.pts), true);
          g.fillStyle(tone(rt, rk.top.tone), 1).fillPoints(poly(rk.top.pts), true);
          g.lineStyle(EMBER_ROCK.rimW, rr, EMBER_ROCK.rimA + 0.1);
          for (const e of rk.rims) g.lineBetween(mx + e[0]! * r, my + e[1]! * r, mx + e[2]! * r, my + e[3]! * r);
          if (ember && hr(cx, cy, 20) < 0.4) {
            const hot = hr(cx, cy, 20) < 0.12;
            g.lineStyle(hot ? 4 : 3, hot ? 0xc8401a : 0x6a1e0c, 0.55).lineBetween(x + c * 0.36, y + c * 0.3, x + c * 0.56, y + c * 0.68);
            g.lineStyle(hot ? 2 : 1.5, hot ? 0xffb04a : 0xc85a1e, hot ? 0.9 : 0.6).lineBetween(x + c * 0.36, y + c * 0.3, x + c * 0.56, y + c * 0.68);
          }
          // 森林的石頭腳邊長一點青苔
          if (!ember && !tv && hr(cx, cy, 6) < 0.5) g.fillStyle(0x3f6b3a, 0.85).fillEllipse(x + c * (0.25 + hr(cx, cy, 7) * 0.5), y + c * 0.9, c * 0.3, c * 0.1);
        }
      }
    }
    g.lineStyle(10, 0x0a120d, 1).strokeRect(-5, -5, W + 10, H + 10);
    g.lineStyle(3, P.edge, 1).strokeRect(0, 0, W, H);
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const rx = i * GROUND_CHUNK;
    const ry = j * GROUND_CHUNK;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.translateCanvas(PAD - rx, PAD - ry);
    paint(g, rx - PAD, ry - PAD, rx - PAD + GROUND_CHUNK, ry - PAD + GROUND_CHUNK);
    g.generateTexture(chunkKey(i, j), Math.min(GROUND_CHUNK, TW - rx), Math.min(GROUND_CHUNK, TH - ry));
    g.destroy();
  }
  return place();
}
