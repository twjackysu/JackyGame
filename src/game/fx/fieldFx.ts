// 戰場上的共用小特效（第 150 輪，Q5 拆場景）：刀光、墜星／星落衝擊、冰碎、弧月、地裂、六角護盾。
// 從 RtBattleScene 原封不動搬出來（純畫面）；長劍技能、Boss 招式與遠程特效（rangedFx.ts）都會用到。
import { HEX_PLATES, hexPlates, hexPoints } from './hexPlates';
import Phaser from 'phaser';
import { floatNumber, shockRing, sparks } from './feel';
import { groundPalette } from './hitTint';
import type { GroundPalette } from './hitTint';
import { impactFlash, impactTint, softFlashStops } from './impactLook';
import type { ImpactTone } from './impactLook';

/** 柔光貼圖（白色、中心亮往邊緣淡到 0）；上色與大小由用的人決定 */
function softFlashKey(scene: Phaser.Scene): string {
  const key = 'fx_soft_flash';
  if (!scene.textures.exists(key)) {
    const S = 128;
    const tex = scene.textures.createCanvas(key, S, S);
    if (tex) {
      const ctx = tex.getContext();
      const gr = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      for (const [o, a] of softFlashStops()) gr.addColorStop(o, `rgba(255,255,255,${a})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, S, S);
      tex.refresh();
    }
  }
  return key;
}

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

  /**
   * 重斬的刀光（第 166 輪）：以前和普攻一樣是一道細弧，凍結看分不出這一下比較重。
   * 一片中間厚、兩端尖的月牙掃過去（外層武器色、內層白芯）、刀鋒前緣一道亮線，掃到底在正前方迸一圈衝擊＋碎光。純畫面。
   */
  cleave(wx: number, wy: number, ang: number, wr: number, deg: number, color: number, lite = false): void {
    const g = this.sc.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
    const cx = this.h.sx(wx);
    const cy = this.h.sy(wy);
    const r = wr * this.h.k() * 1.06;
    const h = (deg / 2) * (Math.PI / 180);
    const N = 14;
    const crescent = (a0: number, a1: number, thick: number, rr: number): { x: number; y: number }[] => {
      const out: { x: number; y: number }[] = [];
      for (let i = 0; i <= N; i++) { const a = a0 + ((a1 - a0) * i) / N; out.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr }); }
      for (let i = N; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / N; const ri = rr * (1 - thick * Math.sin((Math.PI * i) / N)); out.push({ x: cx + Math.cos(a) * ri, y: cy + Math.sin(a) * ri }); }
      return out;
    };
    const draw = (t: number) => {
      g.clear();
      const sweep = Math.min(1, t * 2.4);
      const a0 = ang - h;
      const a1 = a0 + 2 * h * sweep;
      const fade = 1 - t * t;
      // 尾端跟著收：掃完之後月牙從起點那一側消失，看起來是「揮過去」不是「一片扇形閃一下」
      const tail = a0 + 2 * h * Math.max(0, t * 1.5 - 0.5);
      g.fillStyle(color, 0.55 * fade).fillPoints(crescent(tail, a1, 0.42, r), true);
      g.fillStyle(0xffffff, 0.9 * fade).fillPoints(crescent(tail, a1, 0.16, r), true);
      g.lineStyle(3, 0xffffff, 0.8 * fade).beginPath().arc(cx, cy, r * 1.04, tail, a1).strokePath();
      if (sweep < 1) g.lineStyle(5, 0xffffff, 0.95).lineBetween(cx + Math.cos(a1) * r * 0.5, cy + Math.sin(a1) * r * 0.5, cx + Math.cos(a1) * r * 1.1, cy + Math.sin(a1) * r * 1.1);
    };
    draw(0);
    this.sc.tweens.addCounter({ from: 0, to: 1, duration: 260, onUpdate: (tw) => draw(tw.getValue() ?? 1), onComplete: () => g.destroy() });
    // 掃到正前方的那一刻：衝擊環＋往前噴的碎光
    const fx = cx + Math.cos(ang) * r * 0.8;
    const fy = cy + Math.sin(ang) * r * 0.8;
    this.sc.time.delayedCall(55, () => {
      shockRing(this.sc, fx, fy, color, r * 0.55, 240, 6);
      if (!lite) sparks(this.sc, fx, fy, 10, 'spark', 0xfff2c8, 380);
    });
  }

  /**
   * 縛足（第 166 輪）：被縛足箭射中的怪腳下一圈往內收緊的繩環＋四個釘點。以前三支直線箭（穿雲／縛足／風障）長得一模一樣。純畫面。
   * r＝怪的半徑（世界單位）
   */
  snare(wx: number, wy: number, wr: number, color = 0x8affc0): void {
    const g = this.sc.add.graphics().setDepth(688);
    const cx = this.h.sx(wx);
    const cy = this.h.sy(wy);
    const R = Math.max(26, wr * this.h.k() * 1.5);
    const draw = (t: number) => {
      g.clear();
      const k = 1.9 - 0.9 * Math.min(1, t * 3.2); // 前三成時間從外面收緊
      const a = t < 0.75 ? 1 : (1 - t) / 0.25;
      g.lineStyle(4, 0x0a2a1a, 0.5 * a).strokeEllipse(cx, cy + 2, R * 2 * k, R * 1.1 * k);
      g.lineStyle(3, color, 0.95 * a).strokeEllipse(cx, cy, R * 2 * k, R * 1.1 * k);
      g.lineStyle(1.5, 0xffffff, 0.8 * a).strokeEllipse(cx, cy, R * 2 * k * 0.8, R * 1.1 * k * 0.8);
      for (let q = 0; q < 4; q++) {
        const an = (q / 4) * Math.PI * 2 + 0.6 + t * 1.2;
        const px = cx + Math.cos(an) * R * k;
        const py = cy + Math.sin(an) * R * 0.55 * k;
        g.fillStyle(0xffffff, a).fillCircle(px, py, 3.5).lineStyle(2, color, 0.8 * a).lineBetween(px, py, cx + Math.cos(an) * R * k * 0.45, cy + Math.sin(an) * R * 0.55 * k * 0.45);
      }
    };
    draw(0);
    this.sc.tweens.addCounter({ from: 0, to: 1, duration: 720, onUpdate: (tw) => draw(tw.getValue() ?? 1), onComplete: () => g.destroy() });
  }

  /** 從右上方夜空落下的星星（f：0 → 1，1＝落地）；墜星與守望者的召喚墜星共用 */
  fallingStar(g: Phaser.GameObjects.Graphics, vx: number, vy: number, f: number, a = f, guide = 0): void {
    if (f <= 0) return;
    const d = (1 - f * f) * 560;
    const hx = vx + d * 0.55;
    const hy = vy - d;
    // 第 198 輪：a＝亮度（預設跟 f 一樣）、guide＝星星到落點那條細光（看得出它要砸在哪）
    if (guide > 0 && d > 24) g.lineStyle(2, 0xc4d6ff, guide).lineBetween(hx, hy, vx, vy);
    g.lineStyle(18, 0x6a86ff, 0.3 * a).lineBetween(hx, hy, hx + 110, hy - 200);
    g.lineStyle(8, 0xa8c0ff, 0.6 * a).lineBetween(hx, hy, hx + 80, hy - 145);
    g.lineStyle(3, 0xffffff, 0.95 * a).lineBetween(hx, hy, hx + 50, hy - 90);
    g.fillStyle(0x8aa8ff, 0.35 * a).fillCircle(hx, hy, 22 + 10 * f);
    g.fillStyle(0xffffff, a).fillCircle(hx, hy, 9 + 6 * f);
  }

  /** 墜星落地的爆開（閃光＋衝擊環＋碎星）。tone：star＝藍白（敵人的墜星）、fire＝橘紅（玩家的隕星術）。
   *  第 183 輪：閃光從「一整塊淡藍圓」改成中心亮、外圈薄的幾層（`impactLook.ts`）——以前在不暗的地面上是一顆純白大圓盤，蓋住怪和數字。 */
  starImpact(vx: number, vy: number, r: number, tone: ImpactTone = 'star'): void {
    const c = impactTint(tone);
    sparks(this.sc, vx, vy, 22, 'spark', c.spark, 640);
    sparks(this.sc, vx, vy - 16, 10, 'ember', c.ember, 820);
    shockRing(this.sc, vx, vy, c.ring, r * 1.3, 380, 8);
    shockRing(this.sc, vx, vy, 0xffffff, r * 0.8, 240, 4);
    const fl = this.sc.add.container(vx, vy).setDepth(690);
    for (const l of impactFlash(r, tone)) fl.add(this.sc.add.image(0, 0, softFlashKey(this.sc)).setDisplaySize(l.r * 2, l.r * 2).setTint(l.color).setAlpha(l.alpha).setBlendMode(Phaser.BlendModes.ADD));
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

  /** false＝回到舊的六角線框（罩在身上；拍對照用） */
  plates = true;

  hexShield(x: number, y: number): void {
    const cx = this.h.sx(x);
    const cy = this.h.sy(y) - 40;
    const g = this.sc.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD).setPosition(cx, cy);
    if (this.plates) {
      // D-402：六片晶片排在身邊一圈往外張開，不蓋住主角（位置規則在 fx/hexPlates.ts）
      const P = HEX_PLATES;
      for (const p of hexPlates()) {
        const pts = hexPoints(p.r).map((v) => ({ x: p.x + v.x, y: p.y + v.y }));
        g.fillStyle(P.fill, P.fillA).fillPoints(pts, true);
        g.lineStyle(2.5, P.edge, P.edgeA).strokePoints(pts, true);
        const inner = hexPoints(p.r * 0.5).map((v) => ({ x: p.x + v.x, y: p.y + v.y }));
        g.lineStyle(1.2, 0xffffff, 0.55).strokePoints(inner, true);
      }
      g.setScale(P.from);
      this.sc.tweens.add({ targets: g, scale: 1, duration: 150, ease: 'Back.easeOut' });
      this.sc.tweens.add({ targets: g, scale: 1.16, alpha: 0, delay: 240, duration: 260, onComplete: () => g.destroy() });
      sparks(this.sc, cx, cy, 10, 'spark', P.edge, 420);
      return;
    }
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
  /**
   * 飛出去的劍氣（第 162 輪，D-346 的破空劍氣／流星劍氣）：一道月牙從主角往前飛到直線盡頭，後面拖一條淡光，到底碎成火花。
   * 純畫面：命中在 core 的那一個 tick 就結算了，這裡只是把「一整條直線都打得到」畫成看得懂的東西。
   */
  swordWave(x: number, y: number, ang: number, len: number, width: number, color = 0x9fd8ff, lite = false): void {
    const k = this.h.k();
    const px = this.h.sx(x);
    const py = this.h.sy(y) - 18;
    const L = len * k;
    const R = Math.max(26, width * k * 0.62);
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const trail = this.sc.add.graphics().setDepth(689).setBlendMode(Phaser.BlendModes.ADD);
    const w = this.sc.add.graphics().setDepth(691).setBlendMode(Phaser.BlendModes.ADD).setRotation(ang);
    // 月牙：外圈淡色寬弧＋中間亮弧＋白芯，圓心在後面，弧往前鼓
    w.lineStyle(R * 0.55, color, 0.28).beginPath().arc(-R * 0.7, 0, R, -1.05, 1.05).strokePath();
    w.lineStyle(R * 0.3, color, 0.75).beginPath().arc(-R * 0.7, 0, R, -0.95, 0.95).strokePath();
    w.lineStyle(Math.max(3, R * 0.1), 0xffffff, 1).beginPath().arc(-R * 0.7, 0, R * 1.04, -0.85, 0.85).strokePath();
    const start = R * 0.9;
    this.sc.tweens.addCounter({ from: 0, to: 1, duration: 190, ease: 'Sine.easeOut', onUpdate: (tw) => {
      const t = tw.getValue() ?? 1;
      const d = start + (L - start) * t;
      const wx = px + cx * d;
      const wy = py + cy * d;
      w.setPosition(wx, wy).setScale(1 + 0.25 * t, 1 + 0.25 * t);
      const d0 = start + (d - start) * 0.25;
      trail.clear();
      trail.lineStyle(R * 1.3, color, 0.12).lineBetween(px + cx * d0, py + cy * d0, wx, wy);
      trail.lineStyle(R * 0.35, 0xffffff, 0.3).lineBetween(px + cx * (d0 + (d - d0) * 0.5), py + cy * (d0 + (d - d0) * 0.5), wx, wy);
    }, onComplete: () => {
      const ex = px + cx * L;
      const ey = py + cy * L;
      sparks(this.sc, ex, ey, lite ? 5 : 10, 'spark', 0xe8f6ff, 380);
      this.sc.tweens.add({ targets: [w, trail], alpha: 0, duration: 140, onComplete: () => { w.destroy(); trail.destroy(); } });
    } });
    sparks(this.sc, px + cx * start, py + cy * start, lite ? 3 : 6, 'spark', color, 260);
  }

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
  /**
   * 爪痕（第 167 輪）：敵人的窄扇形招落下的那一刻，三道由細到粗再收尖的弧痕掃過整個扇形。
   * size：1＝Boss、0.75＝精英、0.5＝一般怪（一般怪只畫兩層、不噴碎光）。純畫面。
   */
  clawMarks(wx: number, wy: number, ang: number, wr: number, deg: number, color: number, size = 1): void {
    const g = this.sc.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
    const cx = this.h.sx(wx);
    const cy = this.h.sy(wy);
    const r = wr * this.h.k();
    const h = (deg / 2) * (Math.PI / 180);
    const N = 10;
    const streak = (a0: number, a1: number, rr: number, thick: number): { x: number; y: number }[] => {
      const out: { x: number; y: number }[] = [];
      for (let i = 0; i <= N; i++) { const a = a0 + ((a1 - a0) * i) / N; const w = thick * Math.sin((Math.PI * i) / N); out.push({ x: cx + Math.cos(a) * (rr + w), y: cy + Math.sin(a) * (rr + w) }); }
      for (let i = N; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / N; const w = thick * Math.sin((Math.PI * i) / N); out.push({ x: cx + Math.cos(a) * (rr - w), y: cy + Math.sin(a) * (rr - w) }); }
      return out;
    };
    const draw = (t: number) => {
      g.clear();
      const sweep = Math.min(1, t * 3);
      const fade = 1 - t * t;
      const a0 = ang + h;
      const a1 = a0 - 2 * h * sweep;
      for (let i = 0; i < 3; i++) {
        const rr = r * (0.5 + i * 0.2);
        const th = r * (0.045 + i * 0.012) * (0.6 + size * 0.5);
        g.fillStyle(color, 0.6 * fade).fillPoints(streak(a0, a1, rr, th * 1.9), true);
        g.fillStyle(0xffffff, 0.95 * fade).fillPoints(streak(a0, a1, rr, th * 0.8), true);
      }
    };
    draw(0);
    this.sc.tweens.addCounter({ from: 0, to: 1, duration: 200 + size * 120, onUpdate: (tw) => draw(tw.getValue() ?? 1), onComplete: () => g.destroy() });
    if (size >= 0.75) sparks(this.sc, cx + Math.cos(ang) * r * 0.7, cy + Math.sin(ang) * r * 0.7, Math.round(8 * size), 'spark', color, 360);
  }

  /**
   * 咬合（第 167 輪）：敵人的寬扇形招落下的那一刻，上下兩排牙從扇形兩側往中線合起來，咬合瞬間中線一道白光＋衝擊環。
   * size 同 clawMarks。純畫面。
   */
  fangBite(wx: number, wy: number, ang: number, wr: number, deg: number, color: number, size = 1): void {
    const g = this.sc.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
    const cx = this.h.sx(wx);
    const cy = this.h.sy(wy);
    const r = wr * this.h.k();
    const h = (deg / 2) * (Math.PI / 180);
    const FANGS = size >= 0.75 ? 4 : 3;
    const SNAP = 0.38; // 合起來的時間點（0～1）
    const draw = (t: number) => {
      g.clear();
      const close = Math.min(1, t / SNAP);
      const e = close * close; // 越合越快
      const fade = t < SNAP ? 1 : 1 - ((t - SNAP) / (1 - SNAP)) ** 2;
      for (const j of [-1, 1]) {
        const a = ang + j * h * (1 - e * 0.94);
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        // 往中線的方向（垂直於這一排牙）
        const nx = -uy * -j;
        const ny = ux * -j;
        g.lineStyle(4 + size * 3, color, 0.75 * fade).lineBetween(cx + ux * r * 0.22, cy + uy * r * 0.22, cx + ux * r * 1.02, cy + uy * r * 1.02);
        for (let i = 0; i < FANGS; i++) {
          const d0 = r * (0.26 + (0.74 * i) / FANGS);
          const d1 = r * (0.26 + (0.74 * (i + 1)) / FANGS);
          const mid = (d0 + d1) / 2;
          const len = r * (0.2 + 0.1 * Math.sin((Math.PI * (i + 0.5)) / FANGS)) * (0.7 + size * 0.3);
          const tip = { x: cx + ux * mid + nx * len, y: cy + uy * mid + ny * len };
          g.fillStyle(color, 0.55 * fade).fillTriangle(cx + ux * d0, cy + uy * d0, cx + ux * d1, cy + uy * d1, tip.x, tip.y);
          const q0 = mid - (d1 - d0) * 0.26;
          const q1 = mid + (d1 - d0) * 0.26;
          g.fillStyle(0xffffff, 0.95 * fade).fillTriangle(cx + ux * q0, cy + uy * q0, cx + ux * q1, cy + uy * q1, cx + ux * mid + nx * len * 0.9, cy + uy * mid + ny * len * 0.9);
        }
      }
      if (t >= SNAP) {
        const f = (t - SNAP) / (1 - SNAP);
        g.lineStyle((10 + size * 8) * (1 - f), 0xffffff, 0.9 * (1 - f)).lineBetween(cx + Math.cos(ang) * r * 0.15, cy + Math.sin(ang) * r * 0.15, cx + Math.cos(ang) * r * 1.08, cy + Math.sin(ang) * r * 1.08);
      }
    };
    draw(0);
    this.sc.tweens.addCounter({ from: 0, to: 1, duration: 260 + size * 160, onUpdate: (tw) => draw(tw.getValue() ?? 1), onComplete: () => g.destroy() });
    if (size >= 0.75) {
      const fx = cx + Math.cos(ang) * r * 0.62;
      const fy = cy + Math.sin(ang) * r * 0.62;
      this.sc.time.delayedCall((260 + size * 160) * SNAP, () => {
        shockRing(this.sc, fx, fy, color, r * 0.5, 260, 6);
        sparks(this.sc, fx, fy, Math.round(12 * size), 'spark', 0xffffff, 380);
      });
    }
  }

  /**
   * 震波（第 167 輪）：敵人的環形招落下的那一刻，一圈波從內緣推到外緣，沿途翹起一圈碎石、揚塵。
   * 內圈（安全區）什麼都不畫——看得出「貼著牠才沒事」。純畫面。
   */
  quakeBurst(wx: number, wy: number, wrIn: number, wrOut: number, color: number, size = 1, pal: GroundPalette = groundPalette('')): void {
    const cx = this.h.sx(wx);
    const cy = this.h.sy(wy);
    const rIn = wrIn * this.h.k();
    const rOut = wrOut * this.h.k();
    const g = this.sc.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    const rocks = this.sc.add.graphics().setDepth(691);
    const N = Math.round(10 + size * 8);
    const draw = (t: number) => {
      g.clear();
      rocks.clear();
      const e = 1 - (1 - t) ** 3;
      const rr = rIn + (rOut - rIn) * e;
      const fade = 1 - t * t;
      g.lineStyle(14 * fade + 4, color, 0.75 * fade).strokeCircle(cx, cy, rr);
      g.lineStyle(4, 0xffffff, 0.9 * fade).strokeCircle(cx, cy, rr + 4);
      g.lineStyle(6, color, 0.35 * fade).strokeCircle(cx, cy, rIn + (rr - rIn) * 0.55);
      // 碎石：波經過的地方翹起來、再落回去
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + (i % 3) * 0.21;
        const d = rIn + (rOut - rIn) * (0.18 + 0.74 * (((i * 7) % 10) / 10));
        const local = Math.max(0, Math.min(1, (rr - d) / ((rOut - rIn) * 0.5) + 0.15));
        if (local <= 0) continue;
        const up = Math.sin(Math.PI * Math.min(1, local)) * (14 + size * 12);
        const w = 7 + ((i * 5) % 4) * 2 + size * 3;
        const bx = cx + Math.cos(a) * d;
        const by = cy + Math.sin(a) * d;
        // 晶片（星隕）瘦高一點、頂端一點亮光；其他地圖是矮胖的碎石
        const hw = pal.glow ? w * 0.62 : w;
        const hh = pal.glow ? (up + w) * 1.35 : up + w;
        rocks.fillStyle(i % 2 ? pal.rockA : pal.rockB, 0.95 * fade).fillTriangle(bx - hw, by, bx + hw, by, bx + (i % 2 ? 3 : -3), by - hh);
        rocks.fillStyle(pal.shadow, 0.5 * fade).fillEllipse(bx, by + 2, w * 2.2, w * 0.7);
        if (pal.glow && up > 4) g.fillStyle(0xffffff, 0.8 * fade).fillCircle(bx + (i % 2 ? 3 : -3), by - hh, 3 + size * 2);
      }
    };
    draw(0);
    this.sc.tweens.addCounter({ from: 0, to: 1, duration: 420 + size * 120, onUpdate: (tw) => draw(tw.getValue() ?? 1), onComplete: () => { g.destroy(); rocks.destroy(); } });
    if (size >= 0.75) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.4; sparks(this.sc, cx + Math.cos(a) * (rIn + rOut) * 0.5, cy + Math.sin(a) * (rIn + rOut) * 0.5, 4, 'spark', pal.spark, 360); }
  }

  /** 砸地（第 167 輪）：敵人的圓形招落下的那一刻，一圈衝擊＋放射狀裂痕。純畫面。 */
  slamBurst(wx: number, wy: number, wr: number, color: number, size = 1): void {
    const cx = this.h.sx(wx);
    const cy = this.h.sy(wy);
    const r = wr * this.h.k();
    shockRing(this.sc, cx, cy, color, r * 1.05, 300, 5 + size * 3);
    const g = this.sc.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    const N = 7;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.3;
      const m = a + (i % 2 ? 0.16 : -0.16);
      g.lineStyle(2 + size * 2, i % 2 ? 0xffffff : color, 0.85).beginPath().moveTo(cx + Math.cos(a) * r * 0.12, cy + Math.sin(a) * r * 0.12).lineTo(cx + Math.cos(m) * r * 0.5, cy + Math.sin(m) * r * 0.5).lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92).strokePath();
    }
    this.sc.tweens.add({ targets: g, alpha: 0, duration: 340, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
  }
}
