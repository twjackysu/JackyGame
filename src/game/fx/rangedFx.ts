// 遠程武器的技能特效（第 150 輪，Q5 拆場景）：長弓的箭／箭雨／光箭、法杖的魔彈／魔法陣／隕星／雷暴，以及時間凝滯、虛空奇點。
// 從 RtBattleScene 原封不動搬出來（純畫面，不碰戰鬥狀態）；場景透過 RangedFxHost 給座標換算、縮放、頓幀和幾個共用小特效。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { UNIT, type Shape } from '../../core/battle/rt/types';
import { getSettings } from '../settings';
import { shockRing, softFlash, sparks, ultFlash } from './feel';
import { stormStrikes } from './hitTint';

/** 場景提供給遠程特效的東西 */
export interface RangedFxHost {
  /** 世界座標→畫面座標的縮放（會隨鏡頭變） */
  k(): number;
  sx(x: number): number;
  sy(y: number): number;
  /** 頓幀至少 ms 毫秒 */
  hitStop(ms: number): void;
  /** 可視範圍的上緣（HUD 底下） */
  viewTop: number;
  slash(x: number, y: number, ang: number, r: number, deg: number, color: number, width: number): void;
  starImpact(vx: number, vy: number, r: number, tone?: 'star' | 'fire'): void;
  fallingStar(g: Phaser.GameObjects.Graphics, vx: number, vy: number, f: number): void;
  spawnFrost(x: number, y: number, r: number): void;
}

export class RangedFx {
  private lastBowSfx = 0;

  constructor(
    private readonly sc: Phaser.Scene,
    private readonly h: RangedFxHost,
  ) {}

  /**
   * 時間凝滯（法杖變化二的格擋，第 35 輪）：地上浮出一面鐘——12 道刻度、兩根指針飛快倒轉後停住，再整面碎成冰藍光點。純畫面。
   */
  private timeClock(x: number, y: number, rUnits: number): void {
    const vx = this.h.sx(x);
    const vy = this.h.sy(y);
    const R = rUnits * this.h.k();
    const g = this.sc.add.graphics().setDepth(689).setBlendMode(Phaser.BlendModes.ADD).setPosition(vx, vy);
    const col = 0xa8ecff;
    this.sc.tweens.addCounter({ from: 0, to: 1, duration: 900, onUpdate: (tw) => {
      const t = tw.getValue() ?? 1;
      const grow = Math.min(1, t * 4);
      const rr = R * (0.6 + 0.4 * grow);
      g.clear();
      g.fillStyle(0x6ab8ff, 0.1 * grow).fillEllipse(0, 0, rr * 2, rr * 1.2);
      g.lineStyle(5, col, 0.85 * grow).strokeEllipse(0, 0, rr * 2, rr * 1.2).lineStyle(2, 0xffffff, 0.5 * grow).strokeEllipse(0, 0, rr * 1.75, rr * 1.05);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r0 = rr * (i % 3 === 0 ? 0.72 : 0.8);
        g.lineStyle(i % 3 === 0 ? 4 : 2, 0xe8fcff, 0.9 * grow).lineBetween(Math.cos(a) * r0, Math.sin(a) * r0 * 0.6, Math.cos(a) * rr * 0.9, Math.sin(a) * rr * 0.9 * 0.6);
      }
      // 指針：前 60% 飛快倒轉（減速），之後停在 12 點
      const spin = t < 0.6 ? (1 - t / 0.6) ** 2 * Math.PI * 6 : 0;
      const am = -Math.PI / 2 - spin;
      const ah = -Math.PI / 2 - spin / 12 - Math.PI / 6;
      g.lineStyle(5, 0xffffff, grow).lineBetween(0, 0, Math.cos(am) * rr * 0.68, Math.sin(am) * rr * 0.68 * 0.6);
      g.lineStyle(7, col, grow).lineBetween(0, 0, Math.cos(ah) * rr * 0.45, Math.sin(ah) * rr * 0.45 * 0.6);
      g.fillStyle(0xffffff, grow).fillCircle(0, 0, 7);
      g.setAlpha(t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25);
    }, onComplete: () => {
      g.destroy();
      sparks(this.sc, vx, vy, 18, 'spark', col, 420);
    } });
    softFlash(this.sc, 0xbfe8ff);
    SFX.timeStop();
  }

  /**
   * 虛空奇點（法杖變化二的大招，第 35 輪）：中央一顆黑洞＋紫色吸積環，周圍的光點被吸進去。
   * 每段命中呼叫一次，同一次施放共用同一個黑洞（`voidFx` 存著，最後一段後 0.5 秒收掉）。純畫面。
   */
  private voidFx: { g: Phaser.GameObjects.Graphics; until: number; x: number; y: number; R: number; motes: { a: number; d: number; v: number }[] } | null = null;
  private voidHole(x: number, y: number, rUnits: number): void {
    const now = this.sc.time.now;
    if (this.voidFx && this.voidFx.g.active) {
      const v = this.voidFx;
      v.until = now + 650;
      v.x = x;
      v.y = y;
      for (let i = 0; i < 4; i++) v.motes.push({ a: Math.random() * Math.PI * 2, d: 1, v: 0.9 + Math.random() * 0.8 });
      this.sc.cameras.main.shake(50, 0.003);
      return;
    }
    const g = this.sc.add.graphics().setDepth(691);
    const v = (this.voidFx = { g, until: now + 650, x, y, R: rUnits * this.h.k(), motes: [] as { a: number; d: number; v: number }[] });
    for (let i = 0; i < 14; i++) v.motes.push({ a: Math.random() * Math.PI * 2, d: 0.4 + Math.random() * 0.6, v: 0.9 + Math.random() * 0.8 });
    let last = now;
    const tick = (): void => {
      if (!g.active) return;
      const t = this.sc.time.now;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const fade = Math.max(0, Math.min(1, (v.until - t) / 300));
      if (fade <= 0) {
        g.destroy();
        if (this.voidFx === v) this.voidFx = null;
        sparks(this.sc, this.h.sx(v.x), this.h.sy(v.y) - 30, 14, 'spark', 0xc89aff, 380);
        return;
      }
      const cx = this.h.sx(v.x);
      const cy = this.h.sy(v.y) - 30;
      const R = v.R;
      const core = R * 0.16 * (0.6 + 0.4 * fade);
      g.clear();
      // 外圈：被扭曲的淡紫色漩渦（三條旋臂）
      for (let arm = 0; arm < 3; arm++) {
        const pts: { x: number; y: number }[] = [];
        for (let q = 0; q <= 14; q++) {
          const f = q / 14;
          const a = t / 260 + arm * ((Math.PI * 2) / 3) + f * 3.2;
          const rr = core + (R * 0.85 - core) * f;
          pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.6 });
        }
        g.lineStyle(9, 0x8a5aff, 0.35 * fade).strokePoints(pts, false);
        g.lineStyle(3, 0xd8c0ff, 0.7 * fade).strokePoints(pts, false);
      }
      // 被吸進去的光點：越靠近越快
      for (const m of v.motes) {
        m.d -= dt * m.v * (1.3 - m.d);
        m.a += dt * (2.5 / Math.max(0.15, m.d));
        if (m.d <= 0.12) {
          m.d = 0.8 + Math.random() * 0.25;
          m.a = Math.random() * Math.PI * 2;
        }
        const mx = cx + Math.cos(m.a) * R * m.d;
        const my = cy + Math.sin(m.a) * R * m.d * 0.6;
        g.fillStyle(0xe8d8ff, fade * Math.min(1, m.d * 2)).fillCircle(mx, my, 3 + 3 * m.d);
      }
      // 吸積環＋黑洞本體（最後畫，蓋在最上面）
      g.lineStyle(8, 0xb070ff, 0.75 * fade).strokeEllipse(cx, cy, core * 3.2, core * 1.5);
      g.lineStyle(3, 0xffffff, 0.8 * fade).strokeEllipse(cx, cy, core * 2.9, core * 1.3);
      g.fillStyle(0x05010c, fade).fillCircle(cx, cy, core);
      g.lineStyle(2, 0xd8b0ff, 0.9 * fade).strokeCircle(cx, cy, core + 1);
      this.sc.time.delayedCall(16, tick);
    };
    tick();
    SFX.voidOpen();
    shockRing(this.sc, this.h.sx(x), this.h.sy(y) - 30, 0x8a5aff, v.R, 400, 6);
    this.sc.cameras.main.shake(120, 0.005);
  }

  /** 長弓普攻（D-147）：箭從主角飛到目標（約 0.1 秒）＋細尾光 */
  arrowShot(x0: number, y0: number, x1: number, y1: number, color: number, ms = 90): void {
    if (this.sc.time.now - this.lastBowSfx > 60) {
      this.lastBowSfx = this.sc.time.now;
      SFX.bowShot();
    }
    const ax = this.h.sx(x0);
    const ay = this.h.sy(y0) - 20;
    const bx = this.h.sx(x1);
    const by = this.h.sy(y1) - 20;
    const ang = Math.atan2(by - ay, bx - ax);
    const tail = this.sc.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    // 第 71 輪：箭道多一層寬光（以前只有 3px 細線，散射凍結看幾乎看不到箭）
    tail.lineStyle(10, color, 0.22).lineBetween(ax, ay, bx, by);
    tail.lineStyle(3, color, 0.8).lineBetween(ax, ay, bx, by);
    tail.lineStyle(1.5, 0xffffff, 0.9).lineBetween(ax + (bx - ax) * 0.4, ay + (by - ay) * 0.4, bx, by);
    this.sc.tweens.add({ targets: tail, alpha: 0, duration: 260, onComplete: () => tail.destroy() });
    const arrow = this.sc.add.graphics().setDepth(691).setPosition(ax, ay).setRotation(ang);
    arrow.lineStyle(4, 0x8a6a40, 1).lineBetween(-34, 0, 8, 0);
    arrow.fillStyle(0xf4f8ff, 1).fillTriangle(16, 0, 4, -7, 4, 7);
    arrow.fillStyle(color, 1).fillTriangle(-34, 0, -44, -8, -30, 0).fillTriangle(-34, 0, -44, 8, -30, 0);
    this.sc.tweens.add({ targets: arrow, x: bx, y: by, duration: ms, ease: 'Linear', onComplete: () => {
      arrow.destroy();
      sparks(this.sc, bx, by, 5, 'spark', color, 220);
    } });
  }

  /** 法杖普攻（D-152）：發光的魔彈飛過去，身後拖一道光，命中時小爆開 */
  magicBolt(x0: number, y0: number, x1: number, y1: number, color: number, ms = 130): void {
    if (this.sc.time.now - this.lastBowSfx > 60) {
      this.lastBowSfx = this.sc.time.now;
      SFX.magicBolt();
    }
    const ax = this.h.sx(x0);
    const ay = this.h.sy(y0) - 34;
    const bx = this.h.sx(x1);
    const by = this.h.sy(y1) - 20;
    const tail = this.sc.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    const orb = this.sc.add.graphics().setDepth(691).setBlendMode(Phaser.BlendModes.ADD).setPosition(ax, ay);
    orb.fillStyle(color, 0.35).fillCircle(0, 0, 18).fillStyle(color, 0.8).fillCircle(0, 0, 10).fillStyle(0xffffff, 1).fillCircle(0, 0, 5);
    this.sc.tweens.addCounter({ from: 0, to: 1, duration: ms, onUpdate: (tw) => {
      const t = tw.getValue() ?? 1;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 18;
      orb.setPosition(x, y);
      tail.clear().lineStyle(6, color, 0.35).lineBetween(ax + (bx - ax) * Math.max(0, t - 0.4), ay + (by - ay) * Math.max(0, t - 0.4), x, y);
    }, onComplete: () => {
      orb.destroy();
      this.sc.tweens.add({ targets: tail, alpha: 0, duration: 140, onComplete: () => tail.destroy() });
      sparks(this.sc, bx, by, 7, 'spark', color, 260);
      shockRing(this.sc, bx, by, color, 26, 180, 3);
    } });
  }

  /**
   * 法杖技能特效（D-152；資料驅動：依命中形狀與狀態畫）。
   * 直線＝飛出去的魔彈（灼燒＝火球、冰凍＝冰槍、中毒＝魂彈）、圓＝符文魔法陣爆開（大招單發＝隕星、多段＝流星）、
   * 環＝火環、扇形（不會出現在法杖，保底）＝刀光。blink：1＝瞬移落地（往前）、−1＝往後瞬移。
   */
  staffFx(x: number, y: number, ang: number, hs: Shape, ult: boolean, single: boolean, blink: number, st?: string, strike = false, foes: readonly { x: number; y: number; r?: number }[] = []): void {
    const col = st === 'burn' ? 0xff8a3a : st === 'freeze' ? 0xa8ecff : st === 'poison' ? 0x9aff6a : st === 'weak' ? 0xb08aff : st === 'break' ? 0xffd05a : 0xc89aff;
    const vx = this.h.sx(x);
    const vy = this.h.sy(y);
    SFX.magicBlast();
    if (hs.type === 'line') {
      const L = hs.len * this.h.k();
      const ex = vx + Math.cos(ang) * L;
      const ey = vy + Math.sin(ang) * L * 0.92;
      const trail = this.sc.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
      const orb = this.sc.add.graphics().setDepth(692).setBlendMode(Phaser.BlendModes.ADD);
      const w = Math.max(14, hs.width * this.h.k() * 0.5);
      if (st === 'freeze') {
        // 冰槍：細長的菱形
        orb.fillStyle(col, 0.5).fillTriangle(w * 2.4, 0, -w * 1.6, -w * 0.7, -w * 1.6, w * 0.7).fillStyle(0xffffff, 1).fillTriangle(w * 2, 0, -w, -w * 0.3, -w, w * 0.3);
      } else orb.fillStyle(col, 0.3).fillCircle(0, 0, w * 1.4).fillStyle(col, 0.85).fillCircle(0, 0, w * 0.8).fillStyle(0xffffff, 1).fillCircle(0, 0, w * 0.4);
      orb.setRotation(ang).setPosition(vx, vy - 30);
      this.sc.tweens.addCounter({ from: 0, to: 1, duration: 200, onUpdate: (tw) => {
        const t = tw.getValue() ?? 1;
        const cx = vx + (ex - vx) * t;
        const cy = vy - 30 + (ey - vy) * t;
        orb.setPosition(cx, cy);
        trail.clear().lineStyle(w * 1.3, col, 0.25).lineBetween(vx, vy - 30, cx, cy).lineStyle(w * 0.4, 0xffffff, 0.5).lineBetween(vx + (cx - vx) * 0.5, vy - 30 + (cy - vy + 30) * 0.5, cx, cy);
        if (Math.random() < 0.5) sparks(this.sc, cx, cy, 1, st === 'freeze' ? 'spark' : 'ember', col, 360);
      }, onComplete: () => {
        orb.destroy();
        this.sc.tweens.add({ targets: trail, alpha: 0, duration: 260, onComplete: () => trail.destroy() });
        sparks(this.sc, ex, ey - 30, 14, 'spark', col, 480);
        shockRing(this.sc, ex, ey - 20, col, w * 3.2, 300, 6);
      } });
      if (hs.len >= UNIT * 7) {
        this.sc.cameras.main.shake(90, 0.005);
        this.h.hitStop(60);
      }
      return;
    }
    if (hs.type === 'ring') {
      // 火環：內外兩圈＋一圈火星
      shockRing(this.sc, vx, vy, col, hs.rOut * this.h.k(), 420, 12);
      shockRing(this.sc, vx, vy, 0xffffff, hs.rIn * this.h.k(), 300, 4);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = ((hs.rIn + hs.rOut) / 2) * this.h.k();
        sparks(this.sc, vx + Math.cos(a) * r, vy + Math.sin(a) * r * 0.6, 2, 'ember', col, 520);
      }
      return;
    }
    if (hs.type === 'sector') {
      this.h.slash(x, y, ang, hs.r, hs.deg + 30, col, 8);
      return;
    }
    const R = hs.r * this.h.k();
    if (ult && single) {
      // 隕星術：夜空砸下一顆大隕星（星落的光柱＋墜星落地）
      this.starfall(x, y, hs.r, true);
      this.h.starImpact(vx, vy, R, 'fire');
      // 落點留下燃燒的隕石坑 2.5 秒（純畫面）
      const cr = this.sc.add.graphics().setDepth(5).setPosition(vx, vy);
      cr.fillStyle(0x1a0c06, 0.55).fillEllipse(0, 0, R * 1.5, R * 0.9);
      cr.fillStyle(0xff6a2a, 0.35).fillEllipse(0, 0, R * 0.9, R * 0.5);
      for (let i = 0; i < 7; i++) {
        const a0 = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
        const r1 = R * (0.55 + Math.random() * 0.25);
        cr.lineStyle(3, 0xffa040, 0.85).lineBetween(Math.cos(a0) * R * 0.25, Math.sin(a0) * R * 0.15, Math.cos(a0) * r1, Math.sin(a0) * r1 * 0.6);
      }
      this.sc.tweens.add({ targets: cr, alpha: 0, delay: 1600, duration: 900, onComplete: () => cr.destroy() });
      for (let i = 0; i < 4; i++) this.sc.time.delayedCall(300 + i * 450, () => sparks(this.sc, vx + (Math.random() - 0.5) * R, vy + (Math.random() - 0.5) * R * 0.5, 4, 'ember', 0xff8a3a, 600));
      sparks(this.sc, vx, vy, 26, 'ember', 0xff8a3a, 820);
      this.sc.cameras.main.shake(260, 0.012);
      ultFlash(this.sc, 0xffe6c8, 220, { x: vx, y: vy });
      this.h.hitStop(150);
      return;
    }
    if (ult && st === 'slow') {
      // 虛空奇點（第 35 輪）：黑洞＋被吸進去的光點
      this.voidHole(x, y, hs.r);
      return;
    }
    if (ult) {
      // 流星雨：每段在範圍裡隨機落一顆小流星
      // 第 70 輪（D-202）：一波只落一顆太稀 → 一波三顆（低特效兩顆）錯開 70ms，越後面越小
      const nm = getSettings().lowFx ? 2 : 3;
      for (let j = 0; j < nm; j++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * R * 0.85;
        // 第 178 輪：每一波最大的那顆砸在圈裡的怪身上（以前三顆都隨機，常砸在空地或主角頭上），其餘照舊隨機散落
        const on = j === 0 ? stormStrikes(x, y, hs.r, foes, 1, Math.random)[0] : undefined;
        const px = on?.on ? this.h.sx(on.x) : vx + Math.cos(a) * d;
        const py = on?.on ? this.h.sy(on.y) - 10 : vy + Math.sin(a) * d * 0.6;
        const fire = (): void => {
          const g = this.sc.add.graphics().setDepth(692).setBlendMode(Phaser.BlendModes.ADD);
          this.sc.tweens.addCounter({ from: 0, to: 1, duration: 160, onUpdate: (tw) => {
            g.clear();
            this.h.fallingStar(g, px, py, tw.getValue() ?? 1);
          }, onComplete: () => {
            g.destroy();
            this.h.starImpact(px, py, R * (j === 0 ? 0.35 : 0.24));
          } });
        };
        if (j === 0) fire();
        else this.sc.time.delayedCall(j * 70, fire);
      }
      // 第 179 輪：地上的圈和震動等第一顆落地（160ms）才出現——場景會提早 FX_LEAD 幾個 tick 叫這裡，落地正好是扣血那一刻
      this.sc.time.delayedCall(160, () => {
        shockRing(this.sc, vx, vy, st === 'slow' ? 0x8a6aff : 0xc89aff, R, 260, 4);
        this.sc.cameras.main.shake(70, 0.004);
      });
      return;
    }
    if (strike && !ult && hs.type === 'circle') {
      // 落雷（第 162 輪，D-346）：一道粗的藍白閃電從天上劈在落點，旁邊兩道細的分岔；地上一圈電光往外炸
      const lite = getSettings().lowFx;
      const bolt = this.sc.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
      const H = 420;
      const zig = (ox: number, top: number, amp: number, n: number): { x: number; y: number }[] => {
        const pts: { x: number; y: number }[] = [];
        for (let q = 0; q <= n; q++) pts.push({ x: vx + ox * (1 - q / n) + (q === n ? 0 : (Math.random() - 0.5) * amp), y: vy - top + (top * q) / n });
        return pts;
      };
      const main = zig((Math.random() - 0.5) * 60, H, 44, 8);
      bolt.lineStyle(26, 0x6a8aff, 0.18).strokePoints(main, false).lineStyle(13, 0x8ac4ff, 0.45).strokePoints(main, false).lineStyle(4, 0xffffff, 1).strokePoints(main, false);
      if (!lite) for (const side of [-1, 1]) {
        const br = zig(side * (50 + Math.random() * 40), H * 0.55, 30, 5);
        bolt.lineStyle(7, 0x8ab0ff, 0.35).strokePoints(br, false).lineStyle(2, 0xf0f6ff, 0.9).strokePoints(br, false);
      }
      bolt.fillStyle(0xe8f4ff, 0.55).fillEllipse(vx, vy, R * 1.5, R * 0.75).fillStyle(0xffffff, 0.8).fillEllipse(vx, vy, R * 0.6, R * 0.3);
      this.sc.tweens.add({ targets: bolt, alpha: 0, duration: 300, ease: 'Cubic.easeIn', onComplete: () => bolt.destroy() });
      shockRing(this.sc, vx, vy, 0x9fd0ff, R, 280, 7);
      shockRing(this.sc, vx, vy, 0xffffff, R * 0.55, 200, 3);
      sparks(this.sc, vx, vy, lite ? 8 : 16, 'spark', 0xd0e6ff, 460);
      this.sc.cameras.main.shake(80, 0.004);
      return;
    }
    if (!single && st === 'slow') {
      // 雷暴：每段從天上劈下 2 道閃電（鋸齒線）。第 178 輪：先劈圈裡的怪（劈中的比較粗、怪身上炸一圈電光），沒有怪才落在空地
      for (const m of stormStrikes(x, y, hs.r, foes, 2, Math.random)) {
        const tx = this.h.sx(m.x);
        const ty = this.h.sy(m.y) - (m.on ? 14 : 0);
        const bolt = this.sc.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
        const pts: { x: number; y: number }[] = [];
        for (let q = 0; q <= 6; q++) pts.push({ x: tx + (q === 6 ? 0 : (Math.random() - 0.5) * 34), y: ty - 320 + (320 * q) / 6 });
        const w = m.on ? 1.35 : 0.8;
        bolt.lineStyle(16 * w, 0x8a7aff, 0.2).strokePoints(pts, false).lineStyle(9 * w, 0x8ab0ff, 0.4).strokePoints(pts, false).lineStyle(3 * w, 0xffffff, m.on ? 1 : 0.8).strokePoints(pts, false);
        bolt.fillStyle(0xe8f0ff, m.on ? 0.6 : 0.4).fillEllipse(tx, ty, m.on ? 84 : 60, m.on ? 40 : 26);
        this.sc.tweens.add({ targets: bolt, alpha: 0, duration: 260, onComplete: () => bolt.destroy() });
        sparks(this.sc, tx, ty, m.on ? 9 : 4, 'spark', 0xc8d8ff, 300);
        shockRing(this.sc, tx, ty, 0x9fc0ff, m.on ? 44 : 30, 200, 3);
      }
      this.sc.cameras.main.shake(60, 0.003);
      return;
    }
    // 魔法陣：地上一圈符文＋往外炸開
    const g = this.sc.add.graphics().setDepth(689).setBlendMode(Phaser.BlendModes.ADD).setPosition(vx, vy);
    g.lineStyle(4, col, 0.9).strokeEllipse(0, 0, R * 2, R * 1.2).lineStyle(2, 0xffffff, 0.6).strokeEllipse(0, 0, R * 1.6, R * 0.96);
    for (let i = 0; i < 6; i++) {
      const a1 = (i / 6) * Math.PI * 2;
      const a2 = a1 + (Math.PI * 2 * 2) / 6;
      g.lineStyle(2, col, 0.7).lineBetween(Math.cos(a1) * R * 0.8, Math.sin(a1) * R * 0.48, Math.cos(a2) * R * 0.8, Math.sin(a2) * R * 0.48);
    }
    this.sc.tweens.add({ targets: g, alpha: 0, scaleX: 1.15, scaleY: 1.15, duration: 520, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
    shockRing(this.sc, vx, vy, col, R * 1.1, 360, 9);
    sparks(this.sc, vx, vy, 16, st === 'burn' ? 'ember' : 'spark', col, 520);
    if (st === 'freeze' && blink === 0 && single && R >= 4 * UNIT * this.h.k() - 1) this.timeClock(x, y, hs.r); // 時間凝滯（4 格冰凍反擊）
    if (st === 'freeze') {
      this.h.spawnFrost(x, y, hs.r);
      softFlash(this.sc, 0xbfe8ff);
    }
    if (blink !== 0) {
      // 閃現：從起點到落點一道紫色殘光
      const back = blink > 0 ? -1 : 1;
      const L = 5 * UNIT * this.h.k();
      const t = this.sc.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
      t.lineStyle(10, 0xc89aff, 0.35).lineBetween(vx, vy - 30, vx + Math.cos(ang) * L * back, vy - 30 + Math.sin(ang) * L * back);
      t.lineStyle(3, 0xffffff, 0.8).lineBetween(vx, vy - 30, vx + Math.cos(ang) * L * back, vy - 30 + Math.sin(ang) * L * back);
      this.sc.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
    }
    this.sc.cameras.main.shake(90, 0.005);
  }

  /** 穿透箭／星河貫射（D-147）：一道沿直線的光箭——箭頭飛到底，身後留下發光的軌跡 */
  arrowBeam(x: number, y: number, ang: number, len: number, width: number, color: number, heavy = false): void {
    SFX.bowShot();
    const px = this.h.sx(x);
    const py = this.h.sy(y) - 20;
    const L = len * this.h.k();
    const W = Math.max(10, width * this.h.k() * (heavy ? 0.5 : 0.3));
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const g = this.sc.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(color, 0.35).fillTriangle(px - cy * W, py + cx * W, px + cy * W, py - cx * W, px + cx * L, py + cy * L);
    g.lineStyle(heavy ? 6 : 4, 0xffffff, 0.9).lineBetween(px, py, px + cx * L, py + cy * L);
    this.sc.tweens.add({ targets: g, alpha: 0, duration: heavy ? 420 : 300, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    const head = this.sc.add.graphics().setDepth(692).setPosition(px, py).setRotation(ang).setBlendMode(Phaser.BlendModes.ADD);
    const s = heavy ? 1.6 : 1.2;
    head.fillStyle(color, 0.6).fillCircle(0, 0, 18 * s);
    head.fillStyle(0xffffff, 1).fillTriangle(22 * s, 0, -8 * s, -9 * s, -8 * s, 9 * s);
    this.sc.tweens.add({ targets: head, x: px + cx * L, y: py + cy * L, duration: heavy ? 160 : 120, ease: 'Cubic.easeOut', onComplete: () => {
      head.destroy();
      sparks(this.sc, px + cx * L, py + cy * L, heavy ? 14 : 8, 'spark', color, 360);
    } });
    for (let i = 1; i <= 3; i++) this.sc.time.delayedCall(i * 30, () => sparks(this.sc, px + (cx * L * i) / 3, py + (cy * L * i) / 3, 4, 'spark', color, 260));
    if (heavy) this.sc.cameras.main.shake(110, 0.005);
  }

  private ultShot = 0;

  /**
   * 星河貫射的連射（第 169 輪）：一道比判定窄的星光帶（外粉內白）＋白色箭頭飛到底＋沿著箭道往前飄的四角星屑；
   * 連射的每一箭輪流走上、中、下三條箭道，六箭看起來是一條「河」而不是同一條線閃六次。最後一箭（破甲）仍是 skyLance。純畫面。
   */
  private starStream(x: number, y: number, ang: number, len: number, width: number): void {
    SFX.bowShot();
    const k = this.h.k();
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    const W = (width * k) / 2;
    const off = ((this.ultShot++ % 3) - 1) * W * 0.4;
    const px = this.h.sx(x) - sn * off;
    const py = this.h.sy(y) - 20 + c * off;
    const L = len * k;
    const g = this.sc.add.graphics().setDepth(689).setBlendMode(Phaser.BlendModes.ADD);
    const band = (w: number, col: number, a: number): void => {
      g.fillStyle(col, a).fillPoints([
        new Phaser.Math.Vector2(px - sn * w, py + c * w),
        new Phaser.Math.Vector2(px + c * L - sn * w * 0.5, py + sn * L + c * w * 0.5),
        new Phaser.Math.Vector2(px + c * L + sn * w * 0.5, py + sn * L - c * w * 0.5),
        new Phaser.Math.Vector2(px + sn * w, py - c * w),
      ], true);
    };
    band(W * 0.62, 0xff7ad0, 0.22);
    band(W * 0.32, 0xffb0e8, 0.36);
    band(W * 0.1, 0xffffff, 0.95);
    this.sc.tweens.add({ targets: g, alpha: 0, duration: 380, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    const head = this.sc.add.graphics().setDepth(692).setPosition(px, py).setRotation(ang).setBlendMode(Phaser.BlendModes.ADD);
    head.fillStyle(0xff9ae0, 0.6).fillCircle(0, 0, 26);
    head.fillStyle(0xffffff, 1).fillTriangle(34, 0, -12, -13, -12, 13);
    this.sc.tweens.add({ targets: head, x: px + c * L, y: py + sn * L, duration: 150, ease: 'Cubic.easeOut', onComplete: () => {
      head.destroy();
      sparks(this.sc, px + c * L, py + sn * L, 10, 'spark', 0xff9ae0, 360);
    } });
    const n = getSettings().lowFx ? 5 : 12;
    for (let i = 0; i < n; i++) {
      const d = ((i + Math.random()) / n) * L;
      const lat = (Math.random() - 0.5) * W * 1.1;
      const r = 6 + Math.random() * 9;
      const st = this.sc.add.graphics().setDepth(691).setBlendMode(Phaser.BlendModes.ADD).setPosition(px + c * d - sn * lat, py + sn * d + c * lat);
      st.fillStyle(i % 3 ? 0xffd0f2 : 0xffffff, 1);
      st.fillPoints([new Phaser.Math.Vector2(0, -r * 1.7), new Phaser.Math.Vector2(r * 0.34, 0), new Phaser.Math.Vector2(0, r * 1.7), new Phaser.Math.Vector2(-r * 0.34, 0)], true);
      st.fillPoints([new Phaser.Math.Vector2(-r * 1.7, 0), new Phaser.Math.Vector2(0, -r * 0.34), new Phaser.Math.Vector2(r * 1.7, 0), new Phaser.Math.Vector2(0, r * 0.34)], true);
      st.setAlpha(0).setScale(0.4);
      const fly = 50 + Math.random() * 70;
      this.sc.tweens.add({ targets: st, alpha: { from: 1, to: 0 }, scale: { from: 1.15, to: 0.3 }, x: st.x + c * fly, y: st.y + sn * fly, delay: (d / L) * 130, duration: 380 + Math.random() * 220, ease: 'Quad.easeOut', onComplete: () => st.destroy() });
    }
    this.sc.cameras.main.shake(80, 0.003);
  }

  /** 穿雲箭的音爆環（第 166 輪）：箭道上三圈垂直於箭的扁環，一圈比一圈大、依序炸開。純畫面 */
  private sonicRings(x: number, y: number, ang: number, len: number, color: number): void {
    const px = this.h.sx(x);
    const py = this.h.sy(y) - 20;
    const L = len * this.h.k();
    const n = getSettings().lowFx ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const f = 0.22 + (0.6 * i) / Math.max(1, n - 1);
      const g = this.sc.add.graphics().setDepth(691).setBlendMode(Phaser.BlendModes.ADD).setPosition(px + Math.cos(ang) * L * f, py + Math.sin(ang) * L * f).setRotation(ang).setAlpha(0);
      const R = 22 + i * 10;
      g.lineStyle(7, color, 0.5).strokeEllipse(0, 0, R * 0.7, R * 2);
      g.lineStyle(3, 0xffffff, 0.95).strokeEllipse(0, 0, R * 0.7, R * 2);
      g.setScale(0.35);
      this.sc.tweens.add({ targets: g, alpha: { from: 1, to: 0 }, scale: 1.7, delay: 25 + i * 45, duration: 300, ease: 'Cubic.easeOut', onStart: () => g.setAlpha(1), onComplete: () => g.destroy() });
    }
  }

  /**
   * 破甲的大招箭（天穹一矢、星河貫射最後一箭；第 70 輪，D-202）：以前只有一條細白線，凍結看很單薄。
   * 加一道和判定一樣寬的光帶（外粉內白、從箭道往外淡）、沿途三圈衝擊環、起點一團光。純畫面。
   */
  private skyLance(x: number, y: number, ang: number, len: number, width: number): void {
    const px = this.h.sx(x);
    const py = this.h.sy(y) - 20;
    const L = len * this.h.k();
    const W = (width * this.h.k()) / 2;
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    const g = this.sc.add.graphics().setDepth(689).setBlendMode(Phaser.BlendModes.ADD);
    const band = (w: number, col: number, a: number): void => {
      g.fillStyle(col, a).fillPoints([
        new Phaser.Math.Vector2(px - sn * w, py + c * w),
        new Phaser.Math.Vector2(px + c * L - sn * w * 0.7, py + sn * L + c * w * 0.7),
        new Phaser.Math.Vector2(px + c * L + sn * w * 0.7, py + sn * L - c * w * 0.7),
        new Phaser.Math.Vector2(px + sn * w, py - c * w),
      ], true);
    };
    band(W, 0xff7ad0, 0.18);
    band(W * 0.62, 0xff9ae0, 0.28);
    band(W * 0.3, 0xffe0f6, 0.55);
    band(W * 0.1, 0xffffff, 0.95);
    g.fillStyle(0xffd0f0, 0.45).fillCircle(px, py, W * 0.55);
    g.fillStyle(0xffffff, 0.8).fillCircle(px, py, W * 0.2);
    this.sc.tweens.add({ targets: g, alpha: 0, duration: 650, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
    for (let i = 1; i <= 3; i++) {
      const f = i / 3.4;
      this.sc.time.delayedCall(i * 40, () => shockRing(this.sc, px + c * L * f, py + sn * L * f, 0xff9ae0, W * 1.3, 420, 5));
    }
  }

  /** 長弓技能的畫面（D-147）：直線＝光箭、扇形＝一排扇形的箭（後躍射擊多一道往後的殘影）、圓＝四面射出 */
  bowFx(x: number, y: number, ang: number, hs: Shape, ult: boolean, leap: boolean, brk: boolean, frost = false, st?: string, look?: 'pierce' | 'snare' | 'guard'): void {
    // 變化二的箭（D-149）：灼燒＝火箭、中毒＝綠毒箭、虛弱＝紫色殘月
    const elem = st === 'burn' ? 0xff8a3a : st === 'poison' ? 0xa8ff6a : st === 'weak' ? 0xc8a0ff : 0;
    if (hs.type === 'ring' || (ult && hs.type === 'circle')) {
      // 環形箭雨／流星箭雨（D-149）：箭從天上落進範圍
      // 第 170 輪：流星箭雨（大招）以前一波只有 8 支灰白細箭，是九個大招裡最稀疏的 → 自己的畫法（粉白星箭＋落地星芒）
      if (ult && hs.type === 'circle') this.meteorRain(x, y, hs.r);
      else this.arrowRain(x, y, hs.type === 'ring' ? hs.rIn : 0, hs.type === 'ring' ? hs.rOut : hs.r, ult ? 0xff9ae0 : 0x9fe0ff, ult ? 8 : getSettings().lowFx ? 12 : 16, ult);
      return;
    }
    if (hs.type === 'line') {
      // 第 166 輪：三支原招的直線箭各有長相——穿雲箭＝白金重箭＋沿途音爆環、縛足箭＝翠綠細箭（命中的怪腳下收緊繩環，場景畫）、風障射擊＝和風障同色的薄荷綠
      const lc = look === 'pierce' ? 0xffe6a0 : look === 'snare' ? 0x8affc0 : look === 'guard' ? 0x9dffc8 : 0x9fe0ff;
      // 第 169 輪：星河貫射的前五箭以前是「一片淡三角形＋一條白線」重複五次，不像大招 → 每一箭是一道星光帶＋沿途的星屑，三條箭道輪流射
      if (ult && !brk) this.starStream(x, y, ang, hs.len, hs.width);
      else this.arrowBeam(x, y, ang, hs.len, hs.width, ult ? 0xff9ae0 : brk ? 0xff8a6a : elem || lc, ult || look === 'pierce');
      if (look === 'pierce' && !ult) this.sonicRings(x, y, ang, hs.len, lc);
      if (st === 'burn') {
        // 燼火箭：沿著箭道留下一串火星
        for (let i = 1; i <= 5; i++) {
          const d = (hs.len * i) / 5;
          this.sc.time.delayedCall(i * 22, () => sparks(this.sc, this.h.sx(x + Math.cos(ang) * d), this.h.sy(y + Math.sin(ang) * d) - 20, 5, 'ember', 0xff9a3a, 520));
        }
      }
      if (ult && brk) {
        this.skyLance(x, y, ang, hs.len, hs.width);
        ultFlash(this.sc, 0xffb4f0, 220, { x: this.h.sx(x), y: this.h.sy(y) });
        this.h.hitStop(120);
      }
      return;
    }
    const r = hs.type === 'sector' || hs.type === 'circle' ? hs.r : UNIT * 3;
    const span = hs.type === 'sector' ? (hs.deg * Math.PI) / 180 : Math.PI * 2;
    const n = hs.type === 'sector' ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const a = hs.type === 'sector' ? ang - span / 2 + (span * i) / (n - 1) : ang + (span * i) / n;
      const ex = x + Math.cos(a) * r;
      const ey = y + Math.sin(a) * r;
      this.sc.time.delayedCall(i * 12, () => this.arrowShot(x, y, ex, ey, elem || (frost ? 0xbff4ff : leap ? 0xc8f0a0 : 0x9fe0ff)));
    }
    if (st === 'poison' || st === 'weak') {
      // 蝕毒後躍＝前方一團綠色毒霧；殘月見切＝一道紫色弧月
      const fx = this.h.sx(x) + Math.cos(ang) * r * 0.6 * this.h.k();
      const fy = this.h.sy(y) + Math.sin(ang) * r * 0.6 * this.h.k();
      if (st === 'poison') {
        for (let i = 0; i < 5; i++) {
          const puff = this.sc.add.circle(fx + (Math.random() - 0.5) * 60, fy + (Math.random() - 0.5) * 40, 18 + Math.random() * 14, 0x7ad04a, 0.45).setDepth(689);
          this.sc.tweens.add({ targets: puff, scale: 2.2, alpha: 0, y: puff.y - 30, duration: 700 + i * 80, ease: 'Cubic.easeOut', onComplete: () => puff.destroy() });
        }
        sparks(this.sc, fx, fy, 10, 'spark', 0xc8ff8a, 500);
      } else this.h.slash(x, y, ang, r, span * (180 / Math.PI) + 20, 0xc8a0ff, 9);
    }
    if (frost) {
      // 霜箭後躍（D-148）：前方一團寒氣
      const fx = this.h.sx(x) + Math.cos(ang) * r * 0.6 * this.h.k();
      const fy = this.h.sy(y) + Math.sin(ang) * r * 0.6 * this.h.k();
      shockRing(this.sc, fx, fy, 0xbff4ff, r * 0.5 * this.h.k(), 420, 8);
      sparks(this.sc, fx, fy, 18, 'spark', 0xd8fbff, 600);
      softFlash(this.sc, 0xbfe8ff);
    }
    if (leap) {
      // 後躍：腳下一圈風壓
      shockRing(this.sc, this.h.sx(x), this.h.sy(y), 0xc8f0a0, 70, 260, 5);
      sparks(this.sc, this.h.sx(x), this.h.sy(y), 8, 'spark', 0xe0ffd0, 300);
    }
  }

  /**
   * 流星箭雨的一波（第 170 輪）：比一般箭雨粗的粉白星箭（外粉、中淡粉、白芯＋四角星箭頭）從右上斜斜落進範圍，
   * 落地一顆四角星芒＋地上一小片粉光；每三支多一圈光與火花。每波的落點用「分格＋抖動」鋪開，不會幾支擠在一起、另一邊空著。純畫面。
   */
  private meteorRain(x: number, y: number, r: number): void {
    if (this.sc.time.now - this.lastBowSfx > 60) {
      this.lastBowSfx = this.sc.time.now;
      SFX.bowShot();
    }
    const lite = getSettings().lowFx;
    const n = lite ? 7 : 14;
    const k = this.h.k();
    const cx = this.h.sx(x);
    const cy = this.h.sy(y);
    const R = r * k;
    const rot = Math.random() * Math.PI * 2;
    const star = (g: Phaser.GameObjects.Graphics, q: number): void => {
      g.fillPoints([new Phaser.Math.Vector2(0, -q * 1.7), new Phaser.Math.Vector2(q * 0.34, 0), new Phaser.Math.Vector2(0, q * 1.7), new Phaser.Math.Vector2(-q * 0.34, 0)], true);
      g.fillPoints([new Phaser.Math.Vector2(-q * 1.7, 0), new Phaser.Math.Vector2(0, -q * 0.34), new Phaser.Math.Vector2(q * 1.7, 0), new Phaser.Math.Vector2(0, q * 0.34)], true);
    };
    for (let i = 0; i < n; i++) {
      // 黃金角螺旋：n 個落點平均鋪滿整個圓，每波轉一個隨機角度
      const a = rot + i * 2.39996;
      const d = Math.sqrt((i + 0.35 + Math.random() * 0.5) / n) * R * 0.94;
      const tx = cx + Math.cos(a) * d;
      const ty = cy + Math.sin(a) * d;
      const H = 300 + Math.random() * 90;
      const g = this.sc.add.graphics().setDepth(692).setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(13, 0xff7ad0, 0.3).lineBetween(0, 0, 92, -H * 0.62);
      g.lineStyle(6, 0xffb0e8, 0.7).lineBetween(0, 0, 66, -H * 0.44);
      g.lineStyle(2.5, 0xffffff, 1).lineBetween(0, 0, 44, -H * 0.3);
      g.fillStyle(0xff9ae0, 0.55).fillCircle(0, 0, 11);
      g.fillStyle(0xffffff, 1);
      star(g, 7);
      g.setPosition(tx + H * 0.3, ty - H).setAlpha(0.25);
      const big = i % 3 === 0;
      this.sc.tweens.add({ targets: g, x: tx, y: ty, alpha: 1, duration: 185 + (i % 4) * 18, delay: i * 13, ease: 'Quad.easeIn', onComplete: () => {
        g.destroy();
        const f = this.sc.add.graphics().setDepth(691).setBlendMode(Phaser.BlendModes.ADD).setPosition(tx, ty);
        f.fillStyle(0xff7ad0, 0.3).fillEllipse(0, 4, big ? 64 : 44, big ? 28 : 20);
        f.fillStyle(big ? 0xffffff : 0xffd0f2, 1);
        star(f, big ? 13 : 9);
        this.sc.tweens.add({ targets: f, alpha: 0, scale: { from: 0.7, to: 1.5 }, duration: big ? 300 : 230, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
        if (big) {
          shockRing(this.sc, tx, ty, 0xff9ae0, 50, 260, 4);
          if (!lite) sparks(this.sc, tx, ty, 6, 'spark', 0xffb0e8, 320);
        }
      } });
    }
    // 每一波地上亮一下：淡粉的底＋一圈往外擴的細邊（範圍看得出來，但不是一塊平平的色塊）
    // 第 179 輪：等第一批箭落地（約 0.2 秒）才亮，和扣血同一刻
    this.sc.time.delayedCall(190, () => {
      const gl = this.sc.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD).setPosition(cx, cy);
      gl.fillStyle(0xff3aa8, 0.1).fillCircle(0, 0, R);
      gl.lineStyle(3, 0xff8ad8, 0.7).strokeCircle(0, 0, R);
      this.sc.tweens.add({ targets: gl, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => gl.destroy() });
    });
  }

  /** 箭雨（D-149）：n 支箭從右上的天空斜斜落進 rIn～rOut 的範圍，落地迸出小火花；大招版是粉紅的星箭、落地多一圈光 */
  private arrowRain(x: number, y: number, rIn: number, rOut: number, color: number, n: number, star: boolean): void {
    if (this.sc.time.now - this.lastBowSfx > 60) {
      this.lastBowSfx = this.sc.time.now;
      SFX.bowShot();
    }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = rIn + Math.sqrt(Math.random()) * (rOut - rIn);
      const tx = this.h.sx(x + Math.cos(a) * d);
      const ty = this.h.sy(y + Math.sin(a) * d);
      const g = this.sc.add.graphics().setDepth(692).setBlendMode(Phaser.BlendModes.ADD);
      const H = 260 + Math.random() * 80;
      g.lineStyle(star ? 7 : 6, color, star ? 0.5 : 0.45).lineBetween(0, 0, 70, -H * 0.5);
      g.lineStyle(star ? 2 : 2.5, 0xffffff, 0.95).lineBetween(0, 0, 40, -H * 0.28);
      g.fillStyle(0xffffff, 1).fillCircle(0, 0, star ? 6 : 3.5);
      g.setPosition(tx + H * 0.25, ty - H * 0.9).setAlpha(0.2);
      this.sc.tweens.add({ targets: g, x: tx, y: ty, alpha: 1, duration: 150 + i * 14, delay: i * 26, ease: 'Quad.easeIn', onComplete: () => {
        g.destroy();
        sparks(this.sc, tx, ty, star ? 7 : 4, 'spark', color, 300);
        if (star) shockRing(this.sc, tx, ty, color, 46, 260, 4);
      } });
    }
    if (rIn > 0) this.sc.time.delayedCall(140, () => shockRing(this.sc, this.h.sx(x), this.h.sy(y), color, rOut * this.h.k(), 360, 3)); // 第 179 輪：等第一支箭落地
    else if (star) {
      // 第 69 輪：流星箭雨每一波地上亮一圈粉光（以前一波只有 5 支細箭，整招看起來稀稀落落）
      const R = rOut * this.h.k();
      const gl = this.sc.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD).setPosition(this.h.sx(x), this.h.sy(y));
      gl.fillStyle(color, 0.13).fillCircle(0, 0, R);
      gl.fillStyle(0xffffff, 0.08).fillCircle(0, 0, R * 0.55);
      gl.lineStyle(3, color, 0.55).strokeCircle(0, 0, R);
      this.sc.tweens.add({ targets: gl, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => gl.destroy() });
    }
  }

  /** 星落一閃（D-112）：天上落下的光柱＋落地衝擊環 */
  starfall(x: number, y: number, r: number, fire = false): void {
    // 第 183 輪：隕星術的光柱跟著火的橘紅（以前和其他大招一樣是粉紅色，落地卻是橘色的火）
    const c = fire ? { wide: 0xff7a2a, core: 0xffe6c0, spark: 0xffd0a0 } : { wide: 0xff7ad0, core: 0xffe0f6, spark: 0xffd0f0 };
    const px = this.h.sx(x);
    const py = this.h.sy(y);
    const g = this.sc.add.graphics().setDepth(695).setBlendMode(Phaser.BlendModes.ADD);
    // 第 53 輪（D-184）：光柱從畫面上緣的 HUD 底下開始（以前一路畫到頂，把地圖名稱和 HP／MP 那行洗成一片白）
    const top = Math.max(this.h.viewTop, py - 900);
    const H = Math.max(0, py - top);
    g.fillStyle(c.wide, 0.35).fillRect(px - 46, top, 92, H);
    g.fillStyle(c.core, 0.8).fillRect(px - 14, top, 28, H);
    this.sc.tweens.add({ targets: g, alpha: 0, duration: 420, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    shockRing(this.sc, px, py, c.wide, r * this.h.k() * 1.3, 520, 14);
    sparks(this.sc, px, py, 28, 'spark', c.spark, 620);
    ultFlash(this.sc, fire ? 0xffe6c8 : 0xffc8f0, 220, { x: px, y: py });
  }
}
