// 小地圖（Q5 拆 RtBattleScene 第三塊，第 147 輪）：原本是場景的 drawMinimap（行為與畫法完全不變）。
// 每幀把場景的狀態交進來畫；系統不持有場景。
import Phaser from 'phaser';
import { ENEMIES, STAGES } from '../../core/battle/rt/data';
import { enemiesOf, playerOf } from '../../core/battle/rt/engine';
import { RARITY_COLOR } from '../../core/battle/rt/gear';
import { UNIT, type BattleState, type EliteAffix } from '../../core/battle/rt/types';
import { GAME_WIDTH } from '../config';

export const AFFIX_COLOR: Record<EliteAffix, number> = { swift: 0x5af0ff, tough: 0x9adf6a, frenzy: 0xff5a4a };

export interface MinimapView {
  mini: { x: number; y: number; w: number; h: number; s: number } | null;
  s: BattleState;
  now: number;
  stageId: string;
  /** 場景鏡頭：世界座標 → 螢幕（x＝ox＋wx×k） */
  ox: number;
  oy: number;
  k: number;
  /** 可視範圍上下緣（螢幕座標） */
  viewTop: number;
  viewBottom: number;
  gates: readonly { x: number; y: number; back: boolean }[];
  memLeft: readonly { tx: number; ty: number }[];
}

export function drawMinimap(g: Phaser.GameObjects.Graphics, v: MinimapView): void {
  const m = v.mini;
  if (!m) return;
  const s = v.s;
  const now = v.now;
  // 目前畫面範圍
  const vx = (0 - v.ox) * m.s / v.k;
  const vy = (v.viewTop - v.oy) * m.s / v.k;
  const x0 = Math.max(0, vx);
  const y0 = Math.max(0, vy);
  const x1 = Math.min(m.w, vx + (GAME_WIDTH / v.k) * m.s);
  const y1 = Math.min(m.h, vy + ((v.viewBottom - v.viewTop) / v.k) * m.s);
  if (x1 > x0 && y1 > y0) g.lineStyle(1, 0xffffff, 0.45).strokeRect(m.x + x0, m.y + y0, x1 - x0, y1 - y0);
  for (const c of STAGES[v.stageId]?.campfires ?? []) {
    g.fillStyle(0xffa040, 0.6 + 0.4 * Math.sin(now / 200)).fillCircle(m.x + c.x * m.s, m.y + c.y * m.s, 4);
  }
  // 光門（D-186）：小菱形，往下一張青色、回程暖色
  for (const gt of v.gates) {
    const gx = m.x + gt.x * m.s;
    const gy = m.y + gt.y * m.s;
    g.fillStyle(gt.back ? 0xffd8a8 : 0x9fe8ff, 0.75 + 0.25 * Math.sin(now / 250)).fillTriangle(gx, gy - 4, gx + 3, gy, gx - 3, gy).fillTriangle(gx, gy + 4, gx + 3, gy, gx - 3, gy);
  }
  // Boss 巢穴：骷髏記號（圓＋叉），暴怒版是紅色
  const bz = STAGES[v.stageId]?.bossZone;
  if (bz) {
    const bx = m.x + bz.x * m.s;
    const by = m.y + bz.y * m.s;
    const col = s.bossFury ? 0xff5040 : 0xe8dcc0;
    g.lineStyle(1.5, col, 0.9).strokeCircle(bx, by, 6);
    g.lineBetween(bx - 3, by - 3, bx + 3, by + 3).lineBetween(bx - 3, by + 3, bx + 3, by - 3);
  }
  // 開過的寶箱：灰色小方塊（沒開的不畫，留給玩家自己找）
  for (const c of STAGES[v.stageId]?.chests ?? []) {
    // 夜光寶箱（D-108）：深夜時在小地圖上閃藍光
    if (c.nightOnly) {
      if (s.night && !(s.chestsOpened ?? []).includes(c.id)) g.fillStyle(0x9fd0ff, 0.6 + 0.4 * Math.sin(now / 200)).fillRect(m.x + c.x * m.s - 3, m.y + c.y * m.s - 3, 6, 6);
      continue;
    }
    if ((s.chestsOpened ?? []).includes(c.id)) g.fillStyle(0x8a8070, 0.8).fillRect(m.x + c.x * m.s - 2, m.y + c.y * m.s - 2, 4, 4);
  }
  for (const mem of v.memLeft) g.fillStyle(0xd0a8ff, 0.6 + 0.4 * Math.sin(now / 300)).fillCircle(m.x + (mem.tx * UNIT + UNIT / 2) * m.s, m.y + (mem.ty * UNIT + UNIT / 2) * m.s, 3);
  let lastCol = -1;
  let lastAl = -1;
  for (const e of enemiesOf(s)) {
    const elite = e.tier === 'elite' || ENEMIES[e.defId]?.boss;
    if (e.defId === 'thorn_mother') {
      // 荊棘母樹：綠色小樹記號（D-107）
      const tx = m.x + e.x * m.s;
      const ty = m.y + e.y * m.s;
      g.fillStyle(e.mode === 'combat' ? 0xff5a4a : 0x6aff7a, 0.95).fillTriangle(tx, ty - 6, tx - 5, ty + 3, tx + 5, ty + 3);
      g.fillStyle(0x8a6a40, 1).fillRect(tx - 1, ty + 3, 2, 3);
      lastCol = -1;
      continue;
    }
    if (e.patrol) {
      // 巡邏的世界精英（D-117）：橘色箭頭，指向牠正在走的方向
      const tx = m.x + e.x * m.s;
      const ty = m.y + e.y * m.s;
      const a = Math.atan2(e.facingY, e.facingX);
      const pt = (an: number, rr: number) => ({ x: tx + Math.cos(a + an) * rr, y: ty + Math.sin(a + an) * rr });
      g.fillStyle(e.mode === 'combat' ? 0xff5a4a : 0xff8a5c, e.mode === 'dormant' ? 0.6 : 1).fillPoints([pt(0, 6), pt(2.5, 4.5), pt(Math.PI, 2), pt(-2.5, 4.5)], true);
      lastCol = -1;
      continue;
    }
    const col = e.mode === 'combat' ? 0xff5a4a : e.affix ? AFFIX_COLOR[e.affix] : elite ? 0xffa040 : 0xc06a6a;
    const al = e.mode === 'dormant' ? 0.5 : 0.95;
    // 手機效能（第 34 輪）：一般怪畫 4×4 方塊（圓要好幾個指令），顏色沒變就不重設 fillStyle
    if (col !== lastCol || al !== lastAl) {
      g.fillStyle(col, al);
      lastCol = col;
      lastAl = al;
    }
    if (elite) {
      g.fillCircle(m.x + e.x * m.s, m.y + e.y * m.s, 3.5);
      lastCol = -1;
    } else g.fillRect(m.x + e.x * m.s - 2, m.y + e.y * m.s - 2, 4, 4);
  }
  // 地上的精良以上裝備（D-100）：稀有度顏色的閃爍菱形，免得錯過
  for (const it of s.ground ?? []) {
    if (it.kind !== 'gear' || (it.rarity ?? 1) < 2) continue;
    const gx = m.x + it.x * m.s;
    const gy = m.y + it.y * m.s;
    const r = 3 + Math.sin(now / 150) * 1.2;
    g.fillStyle(RARITY_COLOR[it.rarity ?? 2], 1).fillPoints([{ x: gx, y: gy - r - 1 }, { x: gx + r, y: gy }, { x: gx, y: gy + r + 1 }, { x: gx - r, y: gy }], true);
  }
  if (s.moveGoal) g.fillStyle(0x9fd8ff, 0.9).fillCircle(m.x + s.moveGoal.x * m.s, m.y + s.moveGoal.y * m.s, 2.5);
  const p = playerOf(s);
  g.fillStyle(0xffffff, 1).fillCircle(m.x + p.x * m.s, m.y + p.y * m.s, 3.5);
  g.lineStyle(1.5, 0x9fd8ff, 0.5 + 0.5 * Math.sin(now / 250)).strokeCircle(m.x + p.x * m.s, m.y + p.y * m.s, 6);
}
