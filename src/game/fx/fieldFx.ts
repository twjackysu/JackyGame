// 戰場上的共用小特效（第 150 輪，Q5 拆場景）：刀光、墜星／星落衝擊、冰碎、弧月、地裂、六角護盾。
// 從 RtBattleScene 原封不動搬出來（純畫面）；長劍技能、Boss 招式與遠程特效（rangedFx.ts）都會用到。
import Phaser from 'phaser';
import { floatNumber, shockRing, sparks } from './feel';

/** 場景提供的座標換算與縮放 */
export interface FieldFxHost {
  /** 世界座標→畫面座標的縮放（會隨鏡頭變） */
  k(): number;
  sx(x: number): number;
  sy(y: number): number;
}

export class FieldFx {
  constructor(
    private readonly sc: Phaser.Scene,
    private readonly h: FieldFxHost,
  ) {}

  /** 刀光：以 (wx, wy) 為圓心、朝 ang 掃過 deg 度的弧（世界單位半徑 wr），疊三層、ADD 混色 */
  slash(wx: number, wy: number, ang: number, wr: number, deg: number, color: number, width: number): void {
    const g = this.sc.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
    const cx = this.h.sx(wx);
    const cy = this.h.sy(wy);
    const r = wr * this.h.k();
    const h = (deg / 2) * (Math.PI / 180);
    const draw = (t: number) => {
      g.clear();
      const end = ang - h + 2 * h * Math.min(1, t * 1.6);
      for (let i = 0; i < 3; i++) {
        g.lineStyle(width * (1.6 - i * 0.45), i === 2 ? 0xffffff : color, (1 - t) * (0.35 + i * 0.3));
        g.beginPath().arc(cx, cy, r * (0.82 + i * 0.09), ang - h, end).strokePath();
      }
    };
    draw(0);
    this.sc.tweens.addCounter({ from: 0, to: 1, duration: 170, onUpdate: (tw) => draw(tw.getValue() ?? 1), onComplete: () => g.destroy() });
  }

  /** 從右上方夜空落下的星星（f：0 → 1，1＝落地）；墜星與守望者的召喚墜星共用 */
  fallingStar(g: Phaser.GameObjects.Graphics, vx: number, vy: number, f: number): void {
    if (f <= 0) return;
    const d = (1 - f * f) * 560;
    const hx = vx + d * 0.55;
    const hy = vy - d;
    g.lineStyle(18, 0x6a86ff, 0.3 * f).lineBetween(hx, hy, hx + 110, hy - 200);
    g.lineStyle(8, 0xa8c0ff, 0.6 * f).lineBetween(hx, hy, hx + 80, hy - 145);
    g.lineStyle(3, 0xffffff, 0.95 * f).lineBetween(hx, hy, hx + 50, hy - 90);
    g.fillStyle(0x8aa8ff, 0.35 * f).fillCircle(hx, hy, 22 + 10 * f);
    g.fillStyle(0xffffff, f).fillCircle(hx, hy, 9 + 6 * f);
  }

  /** 墜星落地的爆開（白色閃光＋藍色衝擊環＋碎星） */
  starImpact(vx: number, vy: number, r: number): void {
    sparks(this.sc, vx, vy, 22, 'spark', 0xc8d8ff, 640);
    sparks(this.sc, vx, vy - 16, 10, 'ember', 0x8aa8ff, 820);
    shockRing(this.sc, vx, vy, 0x8aa8ff, r * 1.3, 380, 8);
    shockRing(this.sc, vx, vy, 0xffffff, r * 0.8, 240, 4);
    const fl = this.sc.add.circle(vx, vy, r * 1.1, 0xe0e8ff, 0.7).setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    this.sc.tweens.add({ targets: fl, scale: 1.5, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => fl.destroy() });
  }

  /** 碎甲斬命中（第 26 輪）：敵人身上迸出 6～9 片紅褐盾片，旋轉、往外飛、落地淡出（純畫面） */
  shatter(x: number, y: number, r: number): void {
    const n = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const g = this.sc.add.graphics().setDepth(795);
      const sz = (9 + Math.random() * 8) * Math.max(0.8, r / 40);
      const col = i % 3 === 0 ? 0xffb09a : i % 3 === 1 ? 0xd04a32 : 0x8a2e1e;
      g.fillStyle(col, 1).fillTriangle(-sz, -sz * 0.6, sz * 0.9, -sz * 0.3, -sz * 0.2, sz);
      g.lineStyle(2, 0x2a0a00, 0.9).strokeTriangle(-sz, -sz * 0.6, sz * 0.9, -sz * 0.3, -sz * 0.2, sz);
      g.setPosition(x, y).setRotation(Math.random() * Math.PI * 2);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = r * (1.4 + Math.random() * 1.4);
      const ex = x + Math.cos(a) * d;
      const ey = y + Math.sin(a) * d * 0.55 + r * 0.8; // 往外飛、最後掉到腳邊
      this.sc.tweens.add({ targets: g, x: ex, duration: 520, ease: 'Cubic.easeOut' });
      this.sc.tweens.add({ targets: g, y: { from: y, to: ey }, duration: 520, ease: 'Back.easeIn' });
      this.sc.tweens.add({ targets: g, rotation: g.rotation + (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4), duration: 520 });
      this.sc.tweens.add({ targets: g, alpha: 0, delay: 620, duration: 380, onComplete: () => g.destroy() });
    }
    shockRing(this.sc, x, y, 0xff6a4a, r * 1.8, 260, 5);
    floatNumber(this.sc, x, y - r * 0.8, '破甲', { color: '#ff8a6a', size: 22 });
  }

  hexShield(x: number, y: number): void {
    const cx = this.h.sx(x);
    const cy = this.h.sy(y) - 40;
    const g = this.sc.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD).setPosition(cx, cy);
    const R = 78;
    const hex = (r: number) => Array.from({ length: 6 }, (_, i) => ({ x: Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * r, y: Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * r }));
    g.fillStyle(0xc89aff, 0.18).fillPoints(hex(R), true);
    g.lineStyle(5, 0xe0c8ff, 0.95).strokePoints(hex(R), true);
    g.lineStyle(2, 0xffffff, 0.6).strokePoints(hex(R * 0.7), true);
    for (const v of hex(R)) g.lineStyle(1.5, 0xc89aff, 0.6).lineBetween(0, 0, v.x, v.y);
    g.setScale(0.6);
    this.sc.tweens.add({ targets: g, scale: 1.1, duration: 140, ease: 'Back.easeOut' });
    this.sc.tweens.add({ targets: g, alpha: 0, delay: 260, duration: 260, onComplete: () => g.destroy() });
    sparks(this.sc, cx, cy, 16, 'spark', 0xe0c8ff, 520);
  }

  /** 破空斬月（D-121）：一道白金月牙沿著劍氣方向飛出去 */
  moonArc(x: number, y: number, ang: number, len: number, width: number): void {
    const R = width * this.h.k() * 1.3;
    const g = this.sc.add.graphics().setDepth(692).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0xfff2c0, 0.95).beginPath();
    g.arc(0, 0, R, -1.25, 1.25, false);
    g.arc(-R * 0.38, 0, R * 0.92, 1.1, -1.1, true);
    g.closePath().fillPath();
    g.fillStyle(0xffffff, 0.9).beginPath();
    g.arc(0, 0, R * 0.96, -0.8, 0.8, false);
    g.arc(-R * 0.2, 0, R * 0.9, 0.75, -0.75, true);
    g.closePath().fillPath();
    const px = this.h.sx(x);
    const py = this.h.sy(y);
    g.setPosition(px, py).setRotation(ang).setScale(0.6);
    const L = len * this.h.k();
    this.sc.tweens.add({ targets: g, x: px + Math.cos(ang) * L, y: py + Math.sin(ang) * L, scale: 1.15, duration: 340, ease: 'Cubic.easeOut' });
    this.sc.tweens.add({ targets: g, alpha: 0, delay: 200, duration: 260, onComplete: () => g.destroy() });
  }

  /** 裂地斬（D-112）：沿直線裂開的地面＋金色劍氣，從玩家往前一路炸開 */
  groundSplit(x: number, y: number, ang: number, len: number, width: number): void {
    const px = this.h.sx(x);
    const py = this.h.sy(y);
    const L = len * this.h.k();
    const W = width * this.h.k();
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const g = this.sc.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    // 劍氣：從窄到寬的楔形
    g.fillStyle(0xffd05a, 0.55).fillTriangle(px - cy * W * 0.15, py + cx * W * 0.15, px + cy * W * 0.15, py - cx * W * 0.15, px + cx * L, py + cy * L);
    g.fillStyle(0xfff4d0, 0.85).fillTriangle(px - cy * W * 0.05, py + cx * W * 0.05, px + cy * W * 0.05, py - cx * W * 0.05, px + cx * L * 0.95, py + cy * L * 0.95);
    // 地面裂痕：沿線左右抖動的折線
    g.lineStyle(3, 0xffa040, 0.9).beginPath().moveTo(px, py);
    for (let i = 1; i <= 8; i++) {
      const d = (L * i) / 8;
      const off = (i % 2 ? 1 : -1) * W * 0.25 * (0.5 + ((i * 37) % 10) / 20);
      g.lineTo(px + cx * d - cy * off, py + cy * d + cx * off);
    }
    g.strokePath();
    this.sc.tweens.add({ targets: g, alpha: 0, duration: 380, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    for (let i = 1; i <= 4; i++) {
      const d = (L * i) / 4;
      this.sc.time.delayedCall(i * 35, () => sparks(this.sc, px + cx * d, py + cy * d, 6, 'spark', 0xffd05a, 320));
    }
    this.sc.cameras.main.shake(120, 0.006);
  }
}
