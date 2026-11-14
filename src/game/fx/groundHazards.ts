// 地上的荊棘、熔岩裂縫與冰晶（第 150 輪，Q5 拆場景）：Boss 招式命中那一刻長出來、停一下、枯萎／融化。
// 從 RtBattleScene 原封不動搬出來（純畫面、用 Math.random 不影響戰鬥）；場景把預告 queue 進來，每幀呼叫 draw*。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { playerOf } from '../../core/battle/rt/engine';
import { UNIT, type BattleState, type Telegraph } from '../../core/battle/rt/types';
import { GAME_WIDTH } from '../config';
import type { FieldFx } from './fieldFx';
import { FROST_GROUND, frostCracks, frostRimArcs, frostWave } from './frostGround';
import { shockRing, sparks } from './feel';

/** 結霜圈的放射漸層貼圖（D-412）：只建一次 */
function frostTexture(scene: Phaser.Scene): string {
  const key = 'fx_frost_ground';
  if (scene.textures.exists(key)) return key;
  const S = 256;
  const tex = scene.textures.createCanvas(key, S, S);
  if (!tex) return key;
  const ctx = tex.getContext();
  const c = FROST_GROUND.color;
  const grad = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [at, a] of FROST_GROUND.stops) grad.addColorStop(at, `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  tex.refresh();
  return key;
}

/** 燼心岩王與黑曜首領（D-125）：命中那一刻地上裂出熔岩（走 queue，命中時改呼叫 spawnLava） */
export const LAVA_ATTACKS = new Set(['colossus_fissure', 'colossus_fissure2', 'colossus_stomp', 'colossus_quake', 'obs_slam', 'slime_splash', 'magma_burst', 'magma_charge', 'colossus_core_burst']);
/** 星骸守望者的召喚墜星（第 31 輪）：預告畫成藍白色＋從夜空落下的星星，落地時跟地圖的落星一樣爆開 */
export const METEOR_ATTACKS = new Set(['sentinel_meteor', 'sentinel_meteor2', 'eclipse_howl']);

function lerpColor(a: number, b: number, t: number): number {
  const m = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/** 場景提供的座標換算、縮放與共用特效 */
export interface GroundHazardsHost {
  k(): number;
  sx(x: number): number;
  sy(y: number): number;
  ffx: FieldFx;
  /** 可視範圍的下緣 */
  viewBottom: number;
}

export class GroundHazards {
  /** 地面長出的荊棘（狼后／母樹的毒刺、根系環、綻放命中時；只是畫面） */
  private thorns: { x: number; y: number; born: number; size: number; seed: number; wither?: number }[] = [];
  /** 霜旋（D-121）在地上留下的冰晶與結霜圈（純畫面，世界座標） */
  private frost: { x: number; y: number; born: number; size: number; seed: number; ring?: number; img?: Phaser.GameObjects.Image }[] = [];
  /** 還沒命中的預告（荊棘／熔岩／墜星；命中那一刻才長出來） */
  private pending: Telegraph[] = [];

  constructor(
    private readonly sc: Phaser.Scene,
    private readonly h: GroundHazardsHost,
  ) {}

  /** 換地圖／重開：全部清掉 */
  reset(): void {
    this.thorns = [];
    this.pending = [];
    for (const f of this.frost) if (f.img?.active) f.img.destroy();
    this.frost = [];
  }

  /** 記下一個預告，命中那一刻在範圍裡長出東西 */
  queue(t: Telegraph): void {
    this.pending.push({ ...t });
  }

  /** 這隻怪的招被打斷了（暈／凍）：還沒落地的不要長出來 */
  cancel(ownerId: number): void {
    this.pending = this.pending.filter((t) => t.ownerId !== ownerId);
  }

  /** 熔岩裂地（D-125）：命中範圍裡裂出發光的熔岩紋＋火星，1.4 秒冷卻變暗（純畫面） */
  private spawnLava(t: Telegraph): void {
    const sh = t.shape;
    const g = this.sc.add.graphics().setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    const lines: [number, number][][] = [];
    const zig = (x0: number, y0: number, x1: number, y1: number, n: number, amp: number): [number, number][] => {
      const pts: [number, number][] = [];
      const nx = -(y1 - y0);
      const ny = x1 - x0;
      const L = Math.hypot(nx, ny) || 1;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const o = i === 0 || i === n ? 0 : (Math.random() - 0.5) * amp;
        pts.push([x0 + (x1 - x0) * f + (nx / L) * o, y0 + (y1 - y0) * f + (ny / L) * o]);
      }
      return pts;
    };
    if (sh.type === 'line') {
      const ex = t.ox + (t.dirX / 1000) * sh.len;
      const ey = t.oy + (t.dirY / 1000) * sh.len;
      lines.push(zig(t.ox, t.oy, ex, ey, 9, sh.width * 0.5));
      for (let i = 0; i < 4; i++) {
        const f = 0.2 + Math.random() * 0.7;
        const bx = t.ox + (ex - t.ox) * f;
        const by = t.oy + (ey - t.oy) * f;
        const a = Math.atan2(ey - t.oy, ex - t.ox) + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.6);
        lines.push(zig(bx, by, bx + Math.cos(a) * sh.width * 0.9, by + Math.sin(a) * sh.width * 0.9, 3, sh.width * 0.2));
      }
    } else if (sh.type === 'circle' || sh.type === 'ring') {
      const r0 = sh.type === 'ring' ? sh.rIn : sh.r * 0.15;
      const r1 = sh.type === 'ring' ? sh.rOut : sh.r;
      const n = sh.type === 'ring' ? 10 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        lines.push(zig(t.ox + Math.cos(a) * r0, t.oy + Math.sin(a) * r0, t.ox + Math.cos(a) * r1, t.oy + Math.sin(a) * r1, 4, (r1 - r0) * 0.25));
      }
    } else return;
    const draw = (heat: number) => {
      g.clear();
      for (const pts of lines) {
        const v = pts.map(([x, y]) => new Phaser.Math.Vector2(this.h.sx(x), this.h.sy(y)));
        g.lineStyle(16, 0xc8401a, 0.35 * heat).strokePoints(v, false);
        g.lineStyle(7, 0xff7a2a, 0.85 * heat).strokePoints(v, false);
        g.lineStyle(2.5, 0xffe6a0, heat).strokePoints(v, false);
      }
    };
    draw(1);
    const o = { h: 1 };
    // 跟著鏡頭：每幀用世界座標重畫（1.4 秒）
    this.sc.tweens.add({ targets: o, h: 0, duration: 1400, ease: 'Quad.easeIn', onUpdate: () => draw(o.h), onComplete: () => g.destroy() });
    sparks(this.sc, this.h.sx(t.ox), this.h.sy(t.oy), 14, 'ember', 0xff8a3a, 520);
  }

  /** 命中的那一刻在預告範圍裡長出荊棘（狼后／母樹，第 23 輪；純畫面、用 Math.random 不影響戰鬥） */
  private spawnThorns(t: Telegraph): void {
    const now = this.sc.time.now;
    const pts: [number, number][] = [];
    const sh = t.shape;
    if (sh.type === 'ring') {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        const r = sh.rIn + (sh.rOut - sh.rIn) * (0.2 + Math.random() * 0.7);
        pts.push([t.ox + Math.cos(a) * r, t.oy + Math.sin(a) * r]);
      }
    } else if (sh.type === 'circle') {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = sh.r * Math.sqrt(0.08 + Math.random() * 0.9);
        pts.push([t.ox + Math.cos(a) * r, t.oy + Math.sin(a) * r]);
      }
    } else if (sh.type === 'line') {
      const n = 7;
      for (let i = 1; i <= n; i++) {
        const d = (sh.len * i) / (n + 0.5);
        const off = (Math.random() - 0.5) * sh.width * 0.7;
        const dx = t.dirX / 1000; // 預告方向是 1000 倍整數（引擎的 DIR）；第 26 輪修：以前直接乘，直線荊棘長在 1000 倍遠的地方
        const dy = t.dirY / 1000;
        pts.push([t.ox + dx * d - dy * off, t.oy + dy * d + dx * off]);
      }
    } else return;
    const big = sh.type !== 'line';
    pts.forEach(([x, y], i) => this.thorns.push({ x, y, born: now + i * (big ? 12 : 30), size: (big ? 0.62 : 0.52) + Math.random() * 0.3, seed: Math.random() * 1000 }));
    if (this.thorns.length > 120) this.thorns.splice(0, this.thorns.length - 120);
  }

  /** 狼后／母樹倒下：地上的荊棘全部提早枯萎，周圍再冒一圈枯枝與落葉 */
  thornWither(x: number, y: number, queen: boolean): void {
    const now = this.sc.time.now;
    for (const f of this.thorns) f.wither = Math.min(f.wither ?? Infinity, now + Math.random() * 300);
    const n = queen ? 22 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = UNIT * (1.2 + Math.random() * (queen ? 2.6 : 1.6));
      this.thorns.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, born: now - 400, size: 0.5 + Math.random() * 0.35, seed: Math.random() * 1000, wither: now + 200 + Math.random() * 500 });
    }
    // 落葉：褐色＋暗紫的碎片往外飄
    for (let i = 0; i < (queen ? 3 : 2); i++) this.sc.time.delayedCall(250 + i * 220, () => {
      sparks(this.sc, this.h.sx(x), this.h.sy(y), 18, 'ember', i % 2 ? 0x8a5a3a : 0x7a3a5a, 900);
      shockRing(this.sc, this.h.sx(x), this.h.sy(y), 0x8a6a4a, (140 + i * 80) * this.h.k(), 700, 5);
    });
  }

  /** 每幀畫地面荊棘：0.15 秒長出 → 停留 → 枯萎變褐、縮回地面 */
  drawThorns(g: Phaser.GameObjects.Graphics, now: number, s: BattleState): void {
    if (this.pending.length) {
      this.pending = this.pending.filter((t) => {
        if (s.tick < t.hitTick) return true;
        if (METEOR_ATTACKS.has(t.attackId)) {
          const pl = playerOf(s);
          const r = t.shape.type === 'circle' ? t.shape.r : UNIT;
          this.h.ffx.starImpact(this.h.sx(t.ox), this.h.sy(t.oy), r * this.h.k());
          if (Math.hypot(pl.x - t.ox, pl.y - t.oy) < UNIT * 8) {
            this.sc.cameras.main.shake(130, 0.005);
            SFX.hitHeavy();
          }
        } else if (LAVA_ATTACKS.has(t.attackId)) this.spawnLava(t);
        else this.spawnThorns(t);
        return false;
      });
    }
    if (!this.thorns.length) return;
    const HOLD = 1300;
    const FADE = 500;
    const k = this.h.k();
    this.thorns = this.thorns.filter((f) => {
      const age = now - f.born;
      if (age < 0) return true;
      const wStart = f.wither ?? f.born + HOLD;
      const w = Math.max(0, Math.min(1, (now - wStart) / FADE));
      if (w >= 1) return false;
      const px = this.h.sx(f.x);
      const py = this.h.sy(f.y);
      if (px < -80 || px > GAME_WIDTH + 80 || py < -80 || py > this.h.viewBottom + 80) return true;
      const grow = Math.min(1, age / 150);
      const pop = grow < 1 ? grow : 1 + 0.12 * Math.max(0, 1 - (age - 150) / 200);
      const h = UNIT * f.size * k * pop * (1 - 0.6 * w);
      const base = h * 0.42;
      // 顏色：紫紅 → 枯褐
      const col = w > 0 ? lerpColor(0x6a2a4a, 0x5a4630, w) : 0x6a2a4a;
      const hi = w > 0 ? lerpColor(0xc0507a, 0x8a7050, w) : 0xc0507a;
      const al = 1 - w * 0.8;
      g.fillStyle(0x000000, 0.25 * al).fillEllipse(px, py + 2, base * 2.6, base * 0.8);
      for (let j = -1; j <= 1; j++) {
        const lean = j * 0.45 + Math.sin(f.seed + j) * 0.15;
        const hh = h * (j === 0 ? 1 : 0.7);
        const tx = px + Math.sin(lean) * hh;
        const ty = py - Math.cos(lean) * hh;
        const bx = px + j * base * 0.6;
        g.fillStyle(col, al).fillTriangle(bx - base * 0.35, py, bx + base * 0.35, py, tx, ty);
        g.fillStyle(hi, al * 0.9).fillTriangle(bx - base * 0.08, py - 1, bx + base * 0.12, py - 1, tx, ty);
      }
      // 剛長出來時刺尖的毒綠閃光
      if (age < 300 && w === 0) g.fillStyle(0xc8ff8a, 0.8 * (1 - age / 300)).fillCircle(px + Math.sin(f.seed) * 2, py - h, 3 + 4 * (1 - age / 300));
      return true;
    });
  }

  /** 霜旋（D-121）：腳下一圈結霜＋十幾根冰晶，1.5 秒後融化（純畫面，Math.random） */
  spawnFrost(x: number, y: number, r: number): void {
    const now = this.sc.time.now;
    this.frost.push({ x, y, born: now, size: r, seed: 1 + Math.floor(Math.random() * 1e6), ring: 1 });
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * Math.sqrt(0.1 + Math.random() * 0.85);
      this.frost.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, born: now + i * 10, size: 0.35 + Math.random() * 0.3, seed: Math.random() * 1000 });
    }
    if (this.frost.length > 90) for (const f of this.frost.splice(0, this.frost.length - 90)) if (f.img?.active) f.img.destroy();
  }

  drawFrost(g: Phaser.GameObjects.Graphics, now: number): void {
    if (!this.frost.length) return;
    const LIFE = 1500;
    const k = this.h.k();
    this.frost = this.frost.filter((f) => {
      const age = now - f.born;
      if (age < 0) return true;
      if (age > LIFE + 400) {
        if (f.img?.active) f.img.destroy();
        return false;
      }
      const melt = Math.max(0, (age - LIFE) / 400);
      const px = this.h.sx(f.x);
      const py = this.h.sy(f.y);
      if (f.ring) {
        // 結霜圈：淡藍圓＋白色細邊，從中心擴開
        const grow = Math.min(1, age / 200);
        const R = f.size * k * grow;
        if (!FROST_GROUND.on) {
          f.img?.setVisible(false);
          g.fillStyle(0xbff4ff, 0.16 * (1 - melt)).fillEllipse(px, py, R * 2, R * 1.4);
          g.lineStyle(2, 0xe8fcff, 0.45 * (1 - melt)).strokeEllipse(px, py, R * 2, R * 1.4);
          return true;
        }
        // D-412：中間透、邊緣濃的霜（一圈圈粗線疊出來）＋從中心裂出去的霜紋＋一段一段的碎冰邊
        const F = FROST_GROUND;
        const fade = 1 - melt;
        const q = F.squash;
        f.img ??= this.sc.add.image(px, py, frostTexture(this.sc)).setDepth(8.9);
        f.img.setVisible(true).setPosition(px, py).setDisplaySize(R * 2, R * 2 * q).setAlpha(fade);
        const wv = frostWave(age);
        if (wv) g.lineStyle(F.waveW * wv.a + 1, F.rim, 0.85 * wv.a).strokeEllipse(px, py, f.size * k * 2 * wv.r, f.size * k * 2 * wv.r * q);
        for (const line of frostCracks(f.seed)) {
          g.lineStyle(1.5, F.rim, F.crackA * fade * grow).beginPath();
          line.forEach((p, i) => (i ? g.lineTo(px + p.x * R, py + p.y * R * q) : g.moveTo(px + p.x * R, py + p.y * R * q)));
          g.strokePath();
        }
        for (const [a0, a1] of frostRimArcs(f.seed)) {
          g.lineStyle(2.5, F.rim, F.rimA * fade).beginPath();
          const n = 6;
          for (let i = 0; i <= n; i++) {
            const a = a0 + ((a1 - a0) * i) / n;
            const x = px + Math.cos(a) * R;
            const y = py + Math.sin(a) * R * q;
            if (i) g.lineTo(x, y);
            else g.moveTo(x, y);
          }
          g.strokePath();
        }
        return true;
      }
      // 冰晶：細長的菱形，長出來時一閃
      const grow = Math.min(1, age / 120);
      const h = UNIT * f.size * k * grow * (1 - 0.7 * melt);
      const w = h * 0.28;
      const lean = Math.sin(f.seed) * 0.35;
      const tx = px + Math.sin(lean) * h;
      const ty = py - Math.cos(lean) * h;
      const al = 0.85 * (1 - melt);
      g.fillStyle(0x7ad8f0, al).fillTriangle(px - w, py, px + w, py, tx, ty);
      g.fillStyle(0xeafcff, al).fillTriangle(px - w * 0.2, py - 1, px + w * 0.4, py - 1, tx, ty);
      if (age < 260) g.fillStyle(0xffffff, 0.8 * (1 - age / 260)).fillCircle(tx, ty, 2 + 4 * (1 - age / 260));
      return true;
    });
  }
}
