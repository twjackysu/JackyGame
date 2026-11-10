// 燼火祝福觸發時的演出（P2，第 163 輪從 RtBattleScene.playBlessEvent 拆出來）：
// core 的 blessProc 事件帶效果 id、位置、實際波及半徑（已換成螢幕像素）；這裡只畫，不決定任何結果。
// 元素視覺語言照工程原則：火＝橘紅火星爆炸、雷＝藍白電弧、光＝金白光環、暗＝深紫暗影、物理＝衝擊波碎片。
import Phaser from 'phaser';
import type { EffectDef } from '../../core/battle/rt/effects';
import { getSettings } from '../settings';
import { ELEMENT_LOOK } from './effectIcon';
import { shockRing, sparks } from './feel';

const fade = (sc: Phaser.Scene, g: Phaser.GameObjects.Graphics, ms: number, ease = 'Cubic.easeIn'): void => {
  sc.tweens.add({ targets: g, alpha: 0, duration: ms, ease, onComplete: () => g.destroy() });
};

/** x,y＝螢幕座標；R＝波及半徑（螢幕像素；沒有範圍的效果是 0） */
export function playBlessProc(sc: Phaser.Scene, d: EffectDef | undefined, x: number, y: number, R: number): void {
  const lite = getSettings().lowFx;
  const L = ELEMENT_LOOK[d?.element ?? 'fire'];
  const add = (): Phaser.GameObjects.Graphics => sc.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
  if (d?.onAttack?.every) {
    // 召雷：天上劈下一道藍白閃電，落點一圈電光（圈＝實際波及範圍）
    const g = add();
    const H = 380;
    const pts: { x: number; y: number }[] = [];
    const lean = (Math.random() - 0.5) * 70;
    for (let q = 0; q <= 7; q++) pts.push({ x: x + lean * (1 - q / 7) + (q === 7 ? 0 : (Math.random() - 0.5) * 40), y: y - H + (H * q) / 7 });
    g.lineStyle(22, 0x6a8aff, 0.2).strokePoints(pts, false).lineStyle(11, 0x8ac4ff, 0.45).strokePoints(pts, false).lineStyle(4, 0xffffff, 1).strokePoints(pts, false);
    g.fillStyle(0xe8f4ff, 0.5).fillEllipse(x, y, R * 1.5, R * 0.75).fillStyle(0xffffff, 0.8).fillEllipse(x, y, R * 0.55, R * 0.28);
    fade(sc, g, 280);
    shockRing(sc, x, y, 0x9fd0ff, R, 280, 7);
    sparks(sc, x, y - 10, lite ? 5 : 12, 'spark', 0xcfe4ff, 420);
    sc.cameras.main.shake(60, 0.003);
  } else if (d?.onCrit) {
    // 綻光：金白光環＋八道往外的光芒
    const g = add();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      g.lineStyle(6, L.color, 0.5).lineBetween(x + Math.cos(a) * R * 0.25, y + Math.sin(a) * R * 0.25, x + Math.cos(a) * R * 0.95, y + Math.sin(a) * R * 0.95);
      g.lineStyle(2, 0xffffff, 0.95).lineBetween(x + Math.cos(a) * R * 0.25, y + Math.sin(a) * R * 0.25, x + Math.cos(a) * R * 0.9, y + Math.sin(a) * R * 0.9);
    }
    g.fillStyle(L.light, 0.55).fillCircle(x, y, R * 0.22);
    fade(sc, g, 260);
    shockRing(sc, x, y, L.light, R, 260, 6);
    if (!lite) sparks(sc, x, y, 8, 'spark', L.light, 380);
  } else if (d?.onDodge?.burst) {
    // 殘影：起點一團深紫的人影往內縮、再炸開一圈暗影
    const g = sc.add.graphics().setDepth(690);
    g.fillStyle(0x2a1048, 0.75).fillEllipse(x, y - 34, 46, 84).fillStyle(L.color, 0.5).fillEllipse(x, y - 34, 30, 62);
    g.fillStyle(0x2a1048, 0.4).fillCircle(x, y, R);
    fade(sc, g, 320, 'Quad.easeOut');
    shockRing(sc, x, y, L.color, R, 320, 12);
    shockRing(sc, x, y, L.light, R * 0.6, 240, 4);
    sparks(sc, x, y - 20, lite ? 5 : 14, 'ember', L.light, 460);
  } else if (d?.onGuard) {
    // 震盾：以自己為中心的一圈厚衝擊波（白＋土色），地上一圈碎屑
    shockRing(sc, x, y, 0xffffff, R, 300, 14);
    shockRing(sc, x, y, L.color, R * 0.8, 380, 8);
    const g = add();
    g.fillStyle(0xffffff, 0.22).fillCircle(x, y, R * 0.9);
    fade(sc, g, 180);
    sparks(sc, x, y, lite ? 6 : 16, 'spark', 0xe8dcc0, 520);
    sc.cameras.main.shake(70, 0.003);
  } else if (d?.execute) {
    // 斬首：目標身上一個白色的交叉斬痕
    const g = add();
    const k = 46;
    for (const s of [-1, 1]) {
      g.lineStyle(12, 0xff5a4a, 0.35).lineBetween(x - k, y - 30 - k * s, x + k, y - 30 + k * s);
      g.lineStyle(4, 0xffffff, 1).lineBetween(x - k, y - 30 - k * s, x + k, y - 30 + k * s);
    }
    fade(sc, g, 240);
    if (!lite) sparks(sc, x, y - 30, 8, 'spark', 0xffe0d8, 420);
  } else if (R > 0) {
    // 燼爆（與之後其他的範圍效果）：元素色的爆炸，圈的大小＝實際波及範圍
    shockRing(sc, x, y, L.color, R, 300, 10);
    sparks(sc, x, y - 16, lite ? 8 : 18, 'ember', L.light, 560);
    sc.cameras.main.shake(60, 0.0025);
  } else shockRing(sc, x, y - 24, L.light, 64, 220, 5);
}
