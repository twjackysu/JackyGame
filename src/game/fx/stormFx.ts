// 劍刃風暴系列的持續特效（第 150 輪，Q5 拆場景）：施放期間每幀畫的旋風、星落一閃的蓄力、破空斬月的夜空。
// 從 RtBattleScene 原封不動搬出來（純畫面，數值不動）；場景每幀把兩層 graphics 與座標換算交進來。
import Phaser from 'phaser';
import { playerOf, skillDef, skillShape } from '../../core/battle/rt/engine';
import type { BattleState, Unit } from '../../core/battle/rt/types';
import { getSettings } from '../settings';

/** 場景給的畫布與座標換算 */
export interface StormView {
  /** 地面層（主角腳下） */
  lo: Phaser.GameObjects.Graphics;
  /** 角色上層 */
  hi: Phaser.GameObjects.Graphics;
  k: number;
  sx(x: number): number;
  sy(y: number): number;
  /** 可視範圍的上緣 */
  viewTop: number;
}

/**
 * 劍刃風暴（第 70 輪，D-202）：以前只有每 0.27 秒一閃的兩道刀弧，凍結在中段看幾乎什麼都沒有。
 * 施放期間每幀畫一團持續的旋風：地上粉色光圈＋三道彗尾氣流＋六把繞身旋轉的光刃。純畫面，數值不動。
 * 只認「多段圓形命中、沒有瞄準」的大招（劍刃風暴本體），變化（星落一閃、破空斬月）各有自己的特效。
 */
export function drawStorm(v: StormView, s: BattleState, now: number): void {
  const lo = v.lo.clear();
  const hi = v.hi.clear();
  if (s.weapon === 'bow') return;
  const p = playerOf(s);
  const a = p.action;
  if (!a || a.kind !== 'skill' || p.dead) return;
  const sk = skillDef(s, a.id);
  if (!sk || sk.aimTicks) return;
  const h0 = sk.hits[0];
  if (!h0) return;
  const hs = skillShape(s, a.id, h0.shape);
  if (hs.type !== 'circle') return;
  const k = s.tick - a.start;
  // 旋風斬／霜旋（原地轉的多段圓）：小一號、藍（霜旋冰青）、三把刃；龍捲（全速移動）與衝鋒類另有畫法
  const mini = sk.role !== 'ult';
  if (mini && (s.weapon === 'staff' || sk.dash || sk.moveFactor >= 1 || sk.hits.length < 3)) return;
  const icy = h0.status?.id === 'freeze';
  const C = mini ? (icy ? [0x8ae8ff, 0xd8fbff, 0xbff4ff] : [0x6ab8ff, 0xd0ecff, 0x9fd8ff]) : [0xff7ad0, 0xffe0f6, 0xffc0ec];
  if (s.weapon === 'staff') {
    if (sk.hits.length >= 4 && !h0.status && !h0.ahead) drawMeteorSky(v, lo, hi, p, hs.r, k, sk.castTicks, now);
    return;
  }
  if (!mini && sk.hits.length === 1) {
    drawStarCharge(v, lo, hi, p, hs.r, k, h0.atTick, now);
    return;
  }
  const f = Math.min(1, k / sk.castTicks);
  // 前 0.15 秒長出來、最後 0.15 秒收掉
  const grow = Math.min(1, k / 5) * Math.min(1, (sk.castTicks - k) / 5 + 0.25);
  const cx = v.sx(p.x);
  const cy = v.sy(p.y);
  const R = hs.r * v.k * (0.85 + 0.15 * grow);
  const lowFx = getSettings().lowFx;
  // 地上：粉色光暈（兩層）＋邊緣一圈閃爍
  // 外圈較亮的「風牆」（中心留暗，看得到主角）
  for (let q = mini ? 2 : 0; q < 4; q++) lo.lineStyle(R * 0.08, C[0]!, (0.05 + q * 0.035) * grow).strokeCircle(cx, cy, R * (0.66 + q * 0.09));
  lo.lineStyle(3, C[2]!, (0.45 + 0.25 * Math.sin(now / 45)) * grow).strokeCircle(cx, cy, R);
  // 地上的螺旋風痕（跟著轉）
  for (let i = 0; i < (mini ? 0 : 8); i++) {
    const t = -now / 120 + (i * Math.PI) / 4;
    lo.lineStyle(2, 0xffb0e8, 0.3 * grow).beginPath().arc(cx, cy, R * (0.35 + 0.06 * (i % 3)), t, t + 0.7).strokePath();
  }
  // 三道彗尾氣流（越外圈越慢），尾巴淡出
  const rot = now / 85;
  const seg = lowFx ? 5 : 9;
  for (let j = mini ? 1 : 0; j < 3; j++) {
    const rr = R * (0.45 + 0.22 * j);
    const base = rot * (1.25 - j * 0.2) + (j * Math.PI * 2) / 3;
    // 疊幾層同一個起點、越長越細越淡的弧 → 一條沒有接縫的彗尾
    for (let q = 0; q < seg; q++) {
      const len = 1.9 * ((q + 1) / seg);
      hi.lineStyle(12 * (1 - q / seg) + 1.5, j === 1 ? C[1]! : C[0]!, (0.16 + 0.1 * (1 - q / seg)) * grow).beginPath().arc(cx, cy, rr, base - len, base).strokePath();
    }
    hi.lineStyle(2, 0xffffff, 0.85 * grow).beginPath().arc(cx, cy, rr, base - 0.5, base).strokePath();
  }
  // 六把繞身的光刃：沿切線方向的細長菱形
  const n = mini ? 3 : 6;
  const br = R * 0.82;
  const ba = now / 70;
  for (let i = 0; i < n; i++) {
    const t = ba + (i * Math.PI * 2) / n;
    const bx = cx + Math.cos(t) * br;
    const by = cy + Math.sin(t) * br * 0.92;
    const tx = -Math.sin(t);
    const ty = Math.cos(t);
    const nx = Math.cos(t);
    const ny = Math.sin(t);
    const L = R * 0.22;
    const W = R * 0.045;
    const pts = [
      new Phaser.Math.Vector2(bx + tx * L, by + ty * L),
      new Phaser.Math.Vector2(bx + nx * W, by + ny * W),
      new Phaser.Math.Vector2(bx - tx * L * 0.6, by - ty * L * 0.6),
      new Phaser.Math.Vector2(bx - nx * W, by - ny * W),
    ];
    // 刀身後面拖一段殘光（往旋轉的反方向）
    for (let q = 0; q < 4; q++) hi.lineStyle(W * (2.4 - q * 0.5), C[0]!, 0.22 * grow).beginPath().arc(cx, cy, br, t - 0.15 - q * 0.15, t).strokePath();
    hi.fillStyle(0xffffff, 0.95 * grow).fillPoints(pts, true);
  }
  // 收尾那一擊之前（最後 20%）中心越來越亮，蓄力感
  if (!mini && f > 0.8) hi.fillStyle(0xfff0fa, (f - 0.8) * 2.2 * grow).fillCircle(cx, cy, R * 0.3);
}

/**
 * 星落一閃蓄力（第 70 輪，D-202）：0.9 秒裡金色圈收緊、內圈長滿，天上一道細光往下伸、星屑往中心落，
 * 打下去那一刻接 starfall 光柱。以前只有一塊平平的藍色範圍。純畫面。
 */
function drawStarCharge(v: StormView, lo: Phaser.GameObjects.Graphics, hi: Phaser.GameObjects.Graphics, p: Unit, wr: number, k: number, hitTick: number, now: number): void {
  if (k > hitTick) return;
  const prog = Math.min(1, k / Math.max(1, hitTick));
  const cx = v.sx(p.x);
  const cy = v.sy(p.y);
  const R = wr * v.k;
  lo.fillStyle(0xffd27a, 0.06 + 0.1 * prog).fillCircle(cx, cy, R);
  lo.fillStyle(0xfff0c0, 0.18 * prog).fillCircle(cx, cy, R * prog);
  lo.lineStyle(3, 0xffe08a, 0.5 + 0.4 * prog).strokeCircle(cx, cy, R);
  // 一圈往內收的刻度光
  const rc = R * (1.25 - 0.25 * prog);
  hi.lineStyle(2, 0xfff0c0, 0.35 + 0.4 * prog).strokeCircle(cx, cy, rc);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2 + now / 600;
    hi.lineStyle(3, 0xffe08a, 0.6 * prog + 0.2).lineBetween(cx + Math.cos(t) * rc, cy + Math.sin(t) * rc, cx + Math.cos(t) * (rc - R * 0.1), cy + Math.sin(t) * (rc - R * 0.1));
  }
  // 天上的細光往下伸到主角頭上
  const top = Math.max(v.viewTop, cy - R * 3.2);
  const bot = top + (cy - top) * prog;
  hi.fillStyle(0xfff4d0, 0.25 + 0.35 * prog).fillRect(cx - 3 - 5 * prog, top, 6 + 10 * prog, bot - top);
  hi.fillStyle(0xffffff, 0.8).fillRect(cx - 1.5, top, 3, bot - top);
  // 星屑往中心落（位置用時間算，凍結時也看得到）
  const n = getSettings().lowFx ? 6 : 12;
  for (let i = 0; i < n; i++) {
    const ph = ((now / 700 + i / n) % 1);
    const t = (i * 2.399) % (Math.PI * 2);
    const d = R * (1.1 - ph);
    const sx = cx + Math.cos(t) * d;
    const sy = cy + Math.sin(t) * d * 0.9 - (1 - ph) * R * 0.4;
    hi.fillStyle(0xfff0c0, 0.9 * ph).fillCircle(sx, sy, 2 + 3 * ph);
  }
}

/** 流星雨施放中（第 70 輪，D-202）：範圍裡一片紫色星空，邊緣一圈星光、星星閃爍（流星本身在 staffFx 每波落下）。純畫面 */
function drawMeteorSky(v: StormView, lo: Phaser.GameObjects.Graphics, hi: Phaser.GameObjects.Graphics, p: Unit, wr: number, k: number, cast: number, now: number): void {
  const grow = Math.min(1, k / 5) * Math.min(1, (cast - k) / 5 + 0.25);
  const cx = v.sx(p.x);
  const cy = v.sy(p.y);
  const R = wr * v.k;
  // 和流星落點一樣是壓扁的橢圓（y × 0.6 之外再留一點邊）
  for (let q = 0; q < 4; q++) lo.fillStyle(0x6a4aff, (0.04 + q * 0.025) * grow).fillEllipse(cx, cy, R * 2 * (1 - q * 0.18), R * 1.3 * (1 - q * 0.18));
  lo.lineStyle(3, 0xc89aff, (0.5 + 0.2 * Math.sin(now / 80)) * grow).strokeEllipse(cx, cy, R * 2, R * 1.3);
  lo.lineStyle(1.5, 0xe8d8ff, 0.4 * grow).strokeEllipse(cx, cy, R * 1.8, R * 1.17);
  const n = getSettings().lowFx ? 10 : 22;
  for (let i = 0; i < n; i++) {
    const a = (i * 2.399) % (Math.PI * 2);
    const d = Math.sqrt(((i * 0.618) % 1)) * R * 0.92;
    const tw = 0.5 + 0.5 * Math.sin(now / 160 + i * 1.7);
    const sx = cx + Math.cos(a) * d;
    const sy = cy + Math.sin(a) * d * 0.62;
    hi.fillStyle(0xe8d8ff, 0.7 * tw * grow).fillCircle(sx, sy, 1.5 + 2 * tw);
    if (i % 4 === 0) hi.lineStyle(1.5, 0xffffff, 0.6 * tw * grow).lineBetween(sx - 6 * tw, sy, sx + 6 * tw, sy).lineBetween(sx, sy - 6 * tw, sx, sy + 6 * tw);
  }
}
