/**
 * 技能範圍的畫法（直線＝光路、扇形／圓／環＝由內往外變實＋外緣亮弧）。第 182～183 輪寫在 RtBattleScene 裡，
 * 第 185 輪搬出來讓競技場共用。只畫圖：cx、cy 是畫面座標，k 是「世界單位 → 畫面像素」的倍率；顏色與透明度由 AreaLook 決定。
 */
import type Phaser from 'phaser';
import type { Shape } from '../../core/battle/rt/types';
import { LANE_LAYERS, LANE_SEGS, LANE_TICK, RING_INNER_EDGE, SECTOR_BANDS, SECTOR_SIDE, laneBand, ringBands, type AreaLook } from './areaLook';

/** 玩家直線技能的範圍＝光路（第 182 輪，D-378）：沒有封閉外框，近亮遠淡、中間一條芯、兩側淡出的邊線、末端兩個小角 */
export function drawSoftLane(g: Phaser.GameObjects.Graphics, sh: Extract<Shape, { type: 'line' }>, cx: number, cy: number, k: number, dx: number, dy: number, al: AreaLook): void {
  const ang = Math.atan2(dy, dx);
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const w = (sh.width / 2) * k;
  const L = sh.len * k;
  const at = (a: number, b: number) => ({ x: cx + a * c - b * sn, y: cy + a * sn + b * c });
  for (let i = 0; i < LANE_SEGS; i++) {
    const a0 = (L * i) / LANE_SEGS;
    const a1 = (L * (i + 1)) / LANE_SEGS;
    const m = laneBand(i);
    for (const ly of LANE_LAYERS) g.fillStyle(al.fill, al.fillA * ly.a * m).fillPoints([at(a0, -w * ly.w), at(a1, -w * ly.w), at(a1, w * ly.w), at(a0, w * ly.w)], true);
    g.lineStyle(1.5, al.edge, al.edgeA * 0.75 * m);
    for (const side of [-1, 1]) {
      const p0 = at(a0, side * w);
      const p1 = at(a1, side * w);
      g.lineBetween(p0.x, p0.y, p1.x, p1.y);
    }
  }
  // 末端：兩個小角（射程到這裡），不封口
  const tk = Math.min(L * 0.2, w * 2 * LANE_TICK);
  g.lineStyle(2, al.edge, al.edgeA * 0.9);
  for (const side of [-1, 1]) {
    const e = at(L, side * w);
    const e1 = at(L, side * w * 0.45);
    const e2 = at(L - tk, side * w);
    g.lineBetween(e.x, e.y, e1.x, e1.y).lineBetween(e.x, e.y, e2.x, e2.y);
  }
}

/** 玩家扇形技能的範圍＝斬擊掃過的範圍（第 182 輪，D-378）：外緣一圈亮弧，裡面由內往外變實，兩條半徑邊幾乎不畫 */
export function drawSoftSector(g: Phaser.GameObjects.Graphics, sh: Extract<Shape, { type: 'sector' }>, cx: number, cy: number, k: number, dx: number, dy: number, al: AreaLook): void {
  const ang = Math.atan2(dy, dx);
  const half = ((sh.deg / 2) * Math.PI) / 180;
  const R = sh.r * k;
  for (const b of SECTOR_BANDS) {
    g.fillStyle(al.fill, al.fillA * b.a).beginPath();
    g.arc(cx, cy, R * b.r1, ang - half, ang + half);
    if (b.r0 > 0) g.arc(cx, cy, R * b.r0, ang + half, ang - half, true);
    else g.lineTo(cx, cy);
    g.closePath().fillPath();
  }
  g.lineStyle(2.5, al.edge, al.edgeA).beginPath().arc(cx, cy, R, ang - half, ang + half).strokePath();
  g.lineStyle(1, al.edge, al.edgeA * SECTOR_SIDE);
  for (const sd of [-1, 1]) g.lineBetween(cx + Math.cos(ang + sd * half) * R * 0.3, cy + Math.sin(ang + sd * half) * R * 0.3, cx + Math.cos(ang + sd * half) * R, cy + Math.sin(ang + sd * half) * R);
}

/** 圓／環的技能範圍（第 183 輪）：跟扇形同一套——由內往外變實、外緣一圈亮弧，顏色跟著武器／屬性（以前是一塊灰藍色的平圓盤） */
export function drawSoftRound(g: Phaser.GameObjects.Graphics, sh: Extract<Shape, { type: 'circle' | 'ring' }>, cx: number, cy: number, k: number, al: AreaLook): void {
  const bands = sh.type === 'circle' ? SECTOR_BANDS.map((b) => ({ r0: b.r0 * sh.r, r1: b.r1 * sh.r, a: b.a })) : ringBands(sh.rIn, sh.rOut);
  for (const b of bands) {
    g.fillStyle(al.fill, al.fillA * b.a).beginPath();
    g.arc(cx, cy, b.r1 * k, 0, Math.PI * 2);
    if (b.r0 > 0) g.arc(cx, cy, b.r0 * k, Math.PI * 2, 0, true);
    g.closePath().fillPath();
  }
  g.lineStyle(2, al.edge, al.edgeA).strokeCircle(cx, cy, (sh.type === 'circle' ? sh.r : sh.rOut) * k);
  if (sh.type === 'ring') g.lineStyle(1.5, al.edge, al.edgeA * RING_INNER_EDGE).strokeCircle(cx, cy, sh.rIn * k);
}

/** 依形狀分派（競技場用） */
export function drawSoftArea(g: Phaser.GameObjects.Graphics, sh: Shape, cx: number, cy: number, k: number, dx: number, dy: number, al: AreaLook): void {
  if (sh.type === 'line') drawSoftLane(g, sh, cx, cy, k, dx, dy, al);
  else if (sh.type === 'sector') drawSoftSector(g, sh, cx, cy, k, dx, dy, al);
  else drawSoftRound(g, sh, cx, cy, k, al);
}
