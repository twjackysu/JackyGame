// Game feel 工具（05 §4）：hit-stop、慢動作、傷害數字、火花、衝擊環、大字。
import { getSettings, highFx } from '../settings';
import Phaser from 'phaser';
import { stackY, type Band } from './bannerStack';
import { numberSlot, type NumRect } from './numberSlot';

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

/** 最近跳出的數字（第 51 輪）：同一刻打中並排的兩隻怪，兩個「105」會黏成「105105」→ 新數字碰到還很新的就往上疊一層 */
const recentNums = new WeakMap<Phaser.Scene, NumRect[]>();

/** 彈跳傷害數字 */
export function floatNumber(scene: Phaser.Scene, x: number, y0: number, text: string, st: NumberStyle): Phaser.GameObjects.Text {
  // 第 64 輪：畫面內的怪貼著左右邊時，長字（「被發現了！」）被切掉一半 → 夾回畫面內（畫面外的不動）
  const sw = scene.scale.width;
  const half = (text.length * st.size * 0.62) / 2 + 6;
  let nx = x + Phaser.Math.Between(-18, 18);
  if (x >= 0 && x <= sw && half * 2 < sw) nx = Math.max(half, Math.min(sw - half, nx));
  let list = recentNums.get(scene);
  if (!list) { list = []; recentNums.set(scene, list); }
  const y = numberSlot(list, nx, y0, text.length * st.size * 0.62 + 8, st.size * 0.95, scene.time.now);
  const t = scene.add
    .text(nx, y, text, {
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
  return t;
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

/** 往上排的大字不能高過這裡（左上角小地圖＋懸賞板到 y≈425、目標字在 95～150） */
const BANNER_CEIL = 430;
/** 置中大字的深度（抉擇面板開著時會把這一層藏起來，第 43 輪） */
export const BANNER_DEPTH = 950;
const AVOID = new WeakMap<Phaser.Scene, Band>();
/** 主角在畫面上的上下範圍（場景每幀更新）；往上疊的置中大字不蓋在這裡，改排隊（第 74 輪） */
export function setBannerAvoid(scene: Phaser.Scene, band: Band | null): void {
  if (band) AVOID.set(scene, band);
  else AVOID.delete(scene);
}
const BANNERS = new WeakMap<Phaser.Scene, { t: { active: boolean; y: number }; h: number; fading: boolean }[]>();

/**
 * 把一塊不是 bigText 的置中大字（例如 Boss 登場的名字＋稱號）登記成「佔用中」，ms 毫秒後讓出（第 53 輪，D-184）：
 * 以前 Boss 登場那一刻 Bot／玩家放大招，「星河貫射！」會直接蓋在「星骸守望者」上面。
 */
export function reserveBanner(scene: Phaser.Scene, cy: number, h: number, ms: number): void {
  const e = { t: { active: true, y: cy }, h, fading: false };
  const live = (BANNERS.get(scene) ?? []).filter((b) => b.t.active && !b.fading);
  live.push(e);
  BANNERS.set(scene, live);
  scene.tweens.addCounter({ from: 0, to: 1, duration: ms, onComplete: () => { e.fading = true; e.t.active = false; } });
}

/** 畫面中央大字（PERFECT / BREAK / VICTORY） */
export function bigText(
  scene: Phaser.Scene, x: number, y: number, text: string, color: string, size = 72, hold = 450,
): Phaser.GameObjects.Text {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: TITLE_FONT, fontSize: `${size}px`, fontStyle: '900', color, stroke: '#140a04', strokeThickness: 10, align: 'center', // 第 43 輪：多行大字以前靠左（第二行短的時候歪一邊）
    })
    .setOrigin(0.5)
    .setDepth(BANNER_DEPTH)
    .setScale(2.2)
    .setAlpha(0);
  let entry: { fading: boolean } | null = null;
  const show = (): void => {
    if (!t.active) return;
    if (scene.renderer.type === Phaser.WEBGL && highFx()) t.postFX?.addGlow(Phaser.Display.Color.HexStringToColor(color).color, 3, 0, false, 0.1, 12);
    scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, ease: 'Back.Out' });
    if (hold >= 0) {
      // 開始淡出就讓出位置（用補間自己的時鐘：掉幀時補間會比 scene.time 慢）
      scene.tweens.add({ targets: t, alpha: 0, scale: 1.15, delay: 180 + hold, duration: 260, onStart: () => { if (entry) entry.fading = true; }, onComplete: () => t.destroy() });
    }
  };
  // 置中的公告大字互相避開（D-162）：只看同一個場景、水平置中、還沒開始淡出的；
  // 上下都沒位置就排隊（D-164），每 0.25 秒（補間時鐘）再試一次，最多等約 6 秒就照原位出
  if (Math.abs(x - scene.scale.width / 2) < 1 && hold >= 0) {
    const h = t.height;
    let tries = 0;
    const place = (): void => {
      if (!t.active || !scene.sys.isActive()) return;
      const live = (BANNERS.get(scene) ?? []).filter((b) => b.t.active && !b.fading);
      const busy: Band[] = live.map((b) => [b.t.y - b.h / 2, b.t.y + b.h / 2]);
      const cy = busy.length ? stackY(y, h, busy, scene.scale.height * 0.62, BANNER_CEIL, AVOID.get(scene)) : y;
      if (cy === null && tries++ < 24) {
        scene.tweens.addCounter({ from: 0, to: 1, duration: 250, onComplete: place });
        return;
      }
      t.setY(cy ?? y);
      const e = { t, h, fading: false };
      entry = e;
      live.push(e);
      BANNERS.set(scene, live);
      show();
    };
    place();
  } else show();
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
