// 升級那一刻的演出（第 186 輪，D-386；純畫面）。
// 以前：camera.flash 把整個畫面（連 HUD、血條、敵人的預告）刷成一片淡黃約十幀，光柱是一塊 90×420 的平色長方形。
// 現在：畫面只在 HUD 底下「亮一下」；光柱是中心亮、兩側淡到 0、越往上越淡的柔光（外暈＋金色柱身＋白芯），
// 腳下一灘光、一串往上飄的光點。升級是「成長有感」最直接的一刻，戰鬥也沒停，所以不能蓋住畫面。
import Phaser from 'phaser';
import { getSettings } from '../settings';

/** 升級時全畫面亮一下的峰值（大招是 0.4；升級比大招常見，而且當下還在挨打，壓得更低） */
export function levelUpFlashPeak(lowFx: boolean): number {
  return lowFx ? 0.1 : 0.2;
}

export interface PillarLayer { w: number; h: number; color: number; alpha: number; ms: number }
/** 光柱由外到內三層：寬而淡的外暈、金色柱身、細的白芯。k＝畫面縮放。每一層都比舊的實心長方形（90×420、0.5）中心更亮、邊緣更淡 */
export function pillarLayers(k: number, lowFx: boolean): PillarLayer[] {
  const s = Math.max(0.7, Math.min(1.4, k));
  const all: PillarLayer[] = [
    { w: 320 * s, h: 600 * s, color: 0xffb84a, alpha: 0.5, ms: 1100 },
    { w: 150 * s, h: 680 * s, color: 0xffe08a, alpha: 0.8, ms: 1000 },
    { w: 40 * s, h: 740 * s, color: 0xfffbea, alpha: 0.9, ms: 760 },
  ];
  return lowFx ? all.slice(1) : all;
}

/** 光柱橫向的亮度（u＝離中線的距離÷半寬）：中心 1、邊緣 0，沒有硬邊 */
export function pillarAcross(u: number): number {
  const a = Math.abs(u);
  return a >= 1 ? 0 : (1 - a * a) * (1 - a * a);
}
/** 光柱縱向的亮度（v＝0 腳下、1 柱頂）：腳下最亮，往上淡到 0 */
export function pillarAlong(v: number): number {
  if (v <= 0) return 1;
  return v >= 1 ? 0 : (1 - v) * (1 - v * 0.5);
}

function pillarKey(scene: Phaser.Scene): string {
  const key = 'fx_level_pillar';
  if (!scene.textures.exists(key)) {
    const W = 64;
    const H = 128;
    const tex = scene.textures.createCanvas(key, W, H);
    if (tex) {
      const ctx = tex.getContext();
      const img = ctx.createImageData(W, H);
      for (let y = 0; y < H; y++) {
        const along = pillarAlong(1 - (y + 0.5) / H); // 貼圖底部＝腳下
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
          img.data[i + 3] = Math.round(255 * along * pillarAcross(((x + 0.5) / W) * 2 - 1));
        }
      }
      ctx.putImageData(img, 0, 0);
      tex.refresh();
    }
  }
  return key;
}

function glowKey(scene: Phaser.Scene): string {
  const key = 'fx_level_glow';
  if (!scene.textures.exists(key)) {
    const S = 96;
    const tex = scene.textures.createCanvas(key, S, S);
    if (tex) {
      const ctx = tex.getContext();
      const gr = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, S, S);
      tex.refresh();
    }
  }
  return key;
}

/** 全畫面亮一下（壓在 HUD 與按鍵下面，深度 47；和大招的閃光同一層） */
export function levelUpFlash(scene: Phaser.Scene, color = 0xffe08a, ms = 260): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const r = scene.add.rectangle(w / 2, h / 2, w, h, color, levelUpFlashPeak(getSettings().lowFx)).setScrollFactor(0).setDepth(47).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: r, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
}

/** 主角腳下升起的金色光柱。(x, y)＝主角腳下的畫面座標；follow 每幀回傳主角現在的位置（邊走邊升級時光柱跟著人） */
export function levelUpPillar(scene: Phaser.Scene, x: number, y: number, k: number, follow?: () => { x: number; y: number } | null): void {
  const low = getSettings().lowFx;
  const c = scene.add.container(x, y).setDepth(44);
  const layers = pillarLayers(k, low);
  for (const l of layers) {
    const im = scene.add.image(0, 10, pillarKey(scene)).setOrigin(0.5, 1).setDisplaySize(l.w * 0.35, l.h * 0.5).setTint(l.color).setAlpha(l.alpha).setBlendMode(Phaser.BlendModes.ADD);
    c.add(im);
    // 先竄高（0.14 秒），再收細淡掉
    scene.tweens.add({ targets: im, displayWidth: l.w, displayHeight: l.h, duration: 140, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: im, displayWidth: l.w * 0.3, alpha: 0, delay: 380, duration: l.ms - 380, ease: 'Cubic.easeIn' });
  }
  // 腳下一灘光（壓扁的柔光）
  const s = Math.max(0.7, Math.min(1.4, k));
  const pool = scene.add.image(0, 0, glowKey(scene)).setDisplaySize(120 * s, 50 * s).setTint(0xffd27a).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD);
  c.add(pool);
  scene.tweens.add({ targets: pool, displayWidth: 380 * s, displayHeight: 150 * s, alpha: 0, duration: 800, ease: 'Cubic.easeOut' });
  // 往上飄的光點（省電畫質少一半）
  const n = low ? 6 : 14;
  for (let i = 0; i < n; i++) {
    const dx = (Math.random() - 0.5) * 110 * s;
    const sz = (10 + Math.random() * 14) * s;
    const m = scene.add.image(dx, -Math.random() * 60 * s, glowKey(scene)).setDisplaySize(sz, sz).setTint(i % 3 === 0 ? 0xffffff : 0xffe08a).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    c.add(m);
    const delay = Math.random() * 350;
    scene.tweens.add({ targets: m, alpha: { from: 0, to: 1 }, delay, duration: 120 });
    scene.tweens.add({ targets: m, y: m.y - (220 + Math.random() * 260) * s, x: dx * 0.5, delay, duration: 700 + Math.random() * 400, ease: 'Sine.easeOut' });
    scene.tweens.add({ targets: m, alpha: 0, delay: delay + 450 + Math.random() * 250, duration: 400 });
  }
  const tick = (): void => { const p = follow?.(); if (p && c.active) c.setPosition(p.x, p.y); };
  if (follow) scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.time.delayedCall(1500, () => { scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick); c.destroy(); });
}
