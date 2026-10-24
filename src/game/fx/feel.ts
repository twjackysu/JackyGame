// Game feel 工具（05 §4）：hit-stop、慢動作、傷害數字、火花、衝擊環、大字。
import { getSettings, highFx } from '../settings';
import Phaser from 'phaser';

export const UI_FONT =
  '"Noto Sans TC", "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';
export const TITLE_FONT =
  '"Noto Serif TC", "Noto Serif CJK TC", "Source Han Serif TC", "PingFang TC", "Songti TC", serif';

/** 以真實時間等待（不受 scene.time.timeScale 影響） */
export const realWait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/** 以場景時間等待（會被慢動作拉長） */
export function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((r) => scene.time.delayedCall(ms, r));
}

/** 凍結所有補間（hit-stop） */
export async function hitStop(scene: Phaser.Scene, ms: number): Promise<void> {
  scene.tweens.pauseAll();
  await realWait(ms);
  scene.tweens.resumeAll();
}

const baseSpeed = new WeakMap<Phaser.Scene, number>();
const slowCount = new WeakMap<Phaser.Scene, number>();

/** 設定場景基礎速度（戰鬥 ×2），慢動作結束後回到這個值 */
export function setBaseSpeed(scene: Phaser.Scene, v: number): void {
  baseSpeed.set(scene, v);
  if ((slowCount.get(scene) ?? 0) <= 0) {
    scene.tweens.timeScale = v;
    scene.time.timeScale = v;
  }
}

/** 慢動作：補間與計時器一起放慢 */
export async function slowMo(scene: Phaser.Scene, scale: number, realMs: number): Promise<void> {
  const base = baseSpeed.get(scene) ?? 1;
  const n = (slowCount.get(scene) ?? 0) + 1;
  slowCount.set(scene, n);
  scene.tweens.timeScale = base * scale;
  scene.time.timeScale = base * scale;
  await realWait(realMs);
  const left = (slowCount.get(scene) ?? 1) - 1;
  slowCount.set(scene, left);
  if (left <= 0) {
    const b = baseSpeed.get(scene) ?? 1;
    scene.tweens.timeScale = b;
    scene.time.timeScale = b;
  }
}

export interface NumberStyle {
  color: string;
  size: number;
  stroke?: string;
  label?: string;
}

/** 彈跳傷害數字 */
export function floatNumber(scene: Phaser.Scene, x: number, y: number, text: string, st: NumberStyle): void {
  const t = scene.add
    .text(x + Phaser.Math.Between(-18, 18), y, text, {
      fontFamily: UI_FONT,
      fontSize: `${st.size}px`,
      fontStyle: '900',
      color: st.color,
      stroke: st.stroke ?? '#1a0f08',
      strokeThickness: Math.max(4, st.size / 7),
    })
    .setOrigin(0.5)
    .setDepth(900)
    .setScale(0.3);
  scene.tweens.add({ targets: t, scale: 1.25, duration: 110, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, scale: 1, delay: 110, duration: 120 });
  scene.tweens.add({ targets: t, y: y - 70, duration: 900, ease: 'Cubic.Out' });
  scene.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 350, onComplete: () => t.destroy() });
  if (st.label) {
    const l = scene.add
      .text(t.x, y - st.size * 0.85, st.label, {
        fontFamily: UI_FONT, fontSize: '22px', fontStyle: '900', color: st.color, stroke: '#000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(900);
    scene.tweens.add({ targets: l, y: l.y - 70, alpha: { from: 1, to: 0 }, duration: 1000, ease: 'Cubic.Out', onComplete: () => l.destroy() });
  }
}

/** 放射火花 */
export function sparks(
  scene: Phaser.Scene, x: number, y: number, n: number, tex = 'spark', tint?: number, speed = 480,
): void {
  const p = scene.add.particles(x, y, tex, {
    speed: { min: speed * 0.3, max: speed },
    angle: { min: 0, max: 360 },
    scale: { start: 1.2, end: 0 },
    lifespan: { min: 250, max: 650 },
    blendMode: Phaser.BlendModes.ADD,
    tint,
    emitting: false,
  });
  p.setDepth(800);
  p.explode(getSettings().lowFx ? Math.max(1, Math.round(n * 0.4)) : n);
  scene.time.delayedCall(900, () => p.destroy());
}

/** 擴散衝擊環 */
export function shockRing(scene: Phaser.Scene, x: number, y: number, color: number, maxR = 160, ms = 380, width = 8): void {
  const g = scene.add.graphics().setDepth(790).setBlendMode(Phaser.BlendModes.ADD);
  const o = { r: 10, a: 1 };
  scene.tweens.add({
    targets: o,
    r: maxR,
    a: 0,
    duration: ms,
    ease: 'Cubic.Out',
    onUpdate: () => {
      g.clear();
      g.lineStyle(width * o.a + 1, color, o.a);
      g.strokeCircle(x, y, o.r);
    },
    onComplete: () => g.destroy(),
  });
}

/** 畫面中央大字（PERFECT / BREAK / VICTORY） */
export function bigText(
  scene: Phaser.Scene, x: number, y: number, text: string, color: string, size = 72, hold = 450,
): Phaser.GameObjects.Text {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: TITLE_FONT, fontSize: `${size}px`, fontStyle: '900', color, stroke: '#140a04', strokeThickness: 10,
    })
    .setOrigin(0.5)
    .setDepth(950)
    .setScale(2.2)
    .setAlpha(0);
  if (scene.renderer.type === Phaser.WEBGL && highFx()) t.postFX?.addGlow(Phaser.Display.Color.HexStringToColor(color).color, 3, 0, false, 0.1, 12);
  scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, ease: 'Back.Out' });
  if (hold >= 0) {
    scene.tweens.add({ targets: t, alpha: 0, scale: 1.15, delay: 180 + hold, duration: 260, onComplete: () => t.destroy() });
  }
  return t;
}

/** 按鈕按下縮 0.94 + 回彈 */
export function pressBounce(scene: Phaser.Scene, obj: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject): void {
  scene.tweens.killTweensOf(obj);
  (obj as unknown as { setScale: (s: number) => void }).setScale(0.94);
  scene.tweens.add({ targets: obj, scale: 1, duration: 260, ease: 'Back.Out' });
}

/**
 * 鏡頭淡出後執行 fn。保險：若 FADE_OUT_COMPLETE 因其他鏡頭效果被吃掉，
 * 逾時後仍會執行（只執行一次），避免整個流程卡死在黑畫面。
 */
export function fadeOutThen(scene: Phaser.Scene, ms: number, fn: () => void): void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };
  const cam = scene.cameras.main;
  cam.fadeOut(ms, 0, 0, 0);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, run);
  scene.time.delayedCall(ms + 300, run);
}
