// 「還」的小跟班（D-157／D-158，第 150 輪 Q5 拆場景）：霧語森林的小狼、荊棘谷的白花、燼紅裂谷的燼心、星隕高原的星子。
// 半透明、跟在主角身後，戰鬥時躲進霧裡（變淡）。從 RtBattleScene 原封不動搬出來（純畫面）。
import Phaser from 'phaser';
import { enemiesOf, playerOf } from '../../core/battle/rt/engine';
import { UNIT, type BattleState } from '../../core/battle/rt/types';
import { GAME_WIDTH } from '../config';
import type { CachedDraw } from './cachedDraw';

type Kind = 'cub' | 'flower' | 'wisp' | 'star';
const KINDS: Readonly<Record<string, Kind>> = { mistwood: 'cub', thornvale: 'flower', emberrift: 'wisp', starfall: 'star' };

/** 場景提供的座標換算與縮放 */
export interface CompanionHost {
  k(): number;
  sx(x: number): number;
  sy(y: number): number;
  /** 可視範圍上下緣 */
  viewTop: number;
  viewBottom: number;
}

export class Companion {
  private cub: { x: number; y: number; a: number; t: number; face: number; kind: Kind } | null = null;

  /** 畫進小貼圖（第 154 輪，D-332）；沒有就直接畫在傳進來的畫筆上 */
  private cache: CachedDraw | null = null;

  constructor(private readonly h: CompanionHost) {}

  /** 場景 create 時給一張小貼圖（範圍見 COMPANION_BOX，s＝k×1.7） */
  setCache(c: CachedDraw | null): void {
    this.cache = c;
  }

  get active(): boolean {
    return this.cub !== null;
  }

  clear(): void {
    this.cub = null;
  }

  /** 在 (x, y) 叫出這張地圖的小跟班；這張地圖沒有就回 false */
  spawn(stageId: string, x: number, y: number, now: number): boolean {
    const kind = KINDS[stageId];
    if (!kind) return false;
    this.cub = { x, y, a: 0, t: now, face: 1, kind };
    return true;
  }

  draw(g: Phaser.GameObjects.Graphics, now: number, s: BattleState): void {
    const c = this.cub;
    if (!c) {
      this.cache?.hide();
      return;
    }
    const p = playerOf(s);
    const dt = Math.min(0.1, Math.max(0, (now - c.t) / 1000));
    c.t = now;
    const fl = Math.hypot(p.facingX, p.facingY) || 1;
    const fx = p.facingX / fl;
    const fy = p.facingY / fl;
    const tx = p.x - fx * UNIT * 1.1 + fy * UNIT * 0.5;
    const ty = p.y - fy * UNIT * 1.1 - fx * UNIT * 0.5;
    const d = Math.hypot(tx - c.x, ty - c.y);
    if (d > UNIT * 12) {
      c.x = tx;
      c.y = ty;
    } else if (d > UNIT * 0.3) {
      const k0 = Math.min(1, dt * (d > UNIT * 3 ? 5 : 2.5));
      if (Math.abs(tx - c.x) > 4) c.face = tx > c.x ? 1 : -1;
      c.x += (tx - c.x) * k0;
      c.y += (ty - c.y) * k0;
    }
    const fight = p.dead || enemiesOf(s).some((e) => e.mode === 'combat');
    c.a += ((fight ? 0.08 : 0.5) - c.a) * Math.min(1, dt * 3);
    const cx = this.h.sx(c.x);
    const cy = this.h.sy(c.y);
    if (cx < -60 || cx > GAME_WIDTH + 60 || cy < this.h.viewTop - 80 || cy > this.h.viewBottom + 60) {
      this.cache?.hide();
      return;
    }
    const moving = d > UNIT * 0.4;
    if (this.cache) this.cache.show(cx, cy, now, c.kind, (cg, fx, fy, t) => this.paint(cg, fx, fy, t, moving));
    else this.paint(g, cx, cy, now, moving);
  }

  /** 腳底在 (cx, cy) 畫跟班（從 draw 拆出來，內容不變） */
  private paint(g: Phaser.GameObjects.Graphics, cx: number, cy: number, now: number, moving: boolean): void {
    const c = this.cub!;
    const k = this.h.k() * 1.7;
    if (c.kind !== 'cub') {
      // 荊棘谷＝母樹的白花精（浮著轉）、燼紅裂谷＝燼心的小火靈（跳動的火球）
      const bob = Math.sin(now / 400) * 6 * k;
      const hy = cy - 40 * k + bob;
      if (c.kind === 'star') {
        // 星隕高原＝回到夜空的那顆星留下的小星星：四芒星慢慢轉、拖一道淡藍光尾（D-158）
        const tw = 0.75 + 0.25 * Math.sin(now / 230);
        const rot = now / 1400;
        g.fillStyle(0x9fc8ff, c.a * 0.3 * tw).fillCircle(cx, hy, 26 * k);
        if (moving) g.fillStyle(0xbcd8ff, c.a * 0.35).fillEllipse(cx - c.face * 16 * k, hy + 3 * k, 26 * k, 6 * k);
        const al = Math.min(1, c.a * 1.9);
        for (let q = 0; q < 4; q++) {
          const an = rot + (q * Math.PI) / 2;
          const L = (q % 2 ? 13 : 20) * k * tw;
          const ox = Math.cos(an);
          const oy = Math.sin(an);
          g.fillStyle(0xeaf4ff, al).fillTriangle(cx + ox * L, hy + oy * L, cx - oy * 4 * k, hy + ox * 4 * k, cx + oy * 4 * k, hy - ox * 4 * k);
        }
        g.fillStyle(0xffffff, al).fillCircle(cx, hy, 4.5 * k);
      } else if (c.kind === 'flower') {
        g.fillStyle(0xffffff, c.a * 0.3).fillCircle(cx, hy, 18 * k);
        for (let q = 0; q < 5; q++) {
          const an = (q / 5) * Math.PI * 2 + now / 900;
          g.fillStyle(0xf8f4ff, c.a * 1.6 > 1 ? 1 : c.a * 1.6).fillEllipse(cx + Math.cos(an) * 7 * k, hy + Math.sin(an) * 6 * k, 10 * k, 8 * k);
        }
        g.fillStyle(0xffe08a, Math.min(1, c.a * 2)).fillCircle(cx, hy, 3.5 * k);
      } else {
        const beat = Math.max(0, Math.sin(now / 160)) ** 3;
        g.fillStyle(0xff8a3a, c.a * 0.35).fillCircle(cx, hy, (16 + 4 * beat) * k);
        g.fillStyle(0xff6a1a, Math.min(1, c.a * 1.8)).fillTriangle(cx - 7 * k, hy + 3 * k, cx + 7 * k, hy + 3 * k, cx + Math.sin(now / 120) * 3 * k, hy - 16 * k);
        g.fillStyle(0xff6a1a, Math.min(1, c.a * 1.8)).fillCircle(cx, hy + 2 * k, 7 * k);
        g.fillStyle(0xffd04a, Math.min(1, c.a * 2)).fillCircle(cx, hy + 2 * k, 3.5 * k);
      }
      g.fillStyle(0x000000, c.a * 0.3).fillEllipse(cx, cy, 20 * k, 6 * k);
      return;
    }
    const hop = moving ? Math.abs(Math.sin(now / 110)) * 5 * k : 0;
    const f = c.face;
    const a = c.a * (0.85 + 0.15 * Math.sin(now / 500));
    g.fillStyle(0xcfe4ff, a * 0.25).fillEllipse(cx, cy - 12 * k, 64 * k, 34 * k);
    g.fillStyle(0xd8e8ff, a).fillEllipse(cx, cy - 12 * k - hop, 30 * k, 20 * k);
    g.fillCircle(cx + f * 13 * k, cy - 24 * k - hop, 10 * k);
    g.fillTriangle(cx + f * 8 * k, cy - 30 * k - hop, cx + f * 10 * k, cy - 42 * k - hop, cx + f * 14 * k, cy - 31 * k - hop);
    g.fillTriangle(cx + f * 14 * k, cy - 31 * k - hop, cx + f * 18 * k, cy - 42 * k - hop, cx + f * 20 * k, cy - 28 * k - hop);
    const sw = Math.sin(now / (moving ? 90 : 300)) * 5 * k;
    g.lineStyle(5 * k, 0xd8e8ff, a).lineBetween(cx - f * 13 * k, cy - 14 * k - hop, cx - f * 24 * k, cy - 24 * k - hop + sw);
    g.fillStyle(0x6ab8ff, Math.min(1, a * 1.8)).fillCircle(cx + f * 16 * k, cy - 26 * k - hop, 1.8 * k);
  }
}

/** 跟班小貼圖的範圍（腳底為原點、單位＝k×1.7；第 154 輪照四種樣子的畫法量的再留邊） */
export const COMPANION_BOX = { l: -50, t: -84, r: 50, b: 12 } as const;

