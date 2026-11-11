// Game feel 工具（05 §4）：hit-stop、慢動作、傷害數字、火花、衝擊環、大字。
import { getSettings, highFx } from '../settings';
import Phaser from 'phaser';
import { pinY, stackY, type Band } from './bannerStack';
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
  /** 數字分級（A5，第 152 輪）：crit＝金色漸層＋光暈＋大彈跳；ult＝粉紫漸層＋光暈＋更大彈跳 */
  tier?: 'crit' | 'ult';
}

const TIER: Record<'crit' | 'ult', { top: string; bottom: string; glow: string; pop: number; tilt: number }> = {
  crit: { top: '#fff6c8', bottom: '#ffb020', glow: '#ff9a20', pop: 1.55, tilt: 8 },
  ult: { top: '#ffe8ff', bottom: '#ff5ad0', glow: '#ff4ac0', pop: 1.7, tilt: 0 },
};

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
  const tier = st.tier ? TIER[st.tier] : null;
  if (tier) {
    // 漸層字＋光暈只算一次（文字貼圖產生時），之後每幀成本跟普通數字一樣
    const glow = !getSettings().lowFx;
    const pad = glow ? 12 : 0;
    if (glow) t.setPadding(pad, pad, pad, pad); // 留白：不然光暈被字框切成方塊（要在算漸層之前，漸層照留白後的高度）
    const grd = t.context.createLinearGradient(0, pad, 0, t.height - pad);
    grd.addColorStop(0.15, tier.top);
    grd.addColorStop(0.85, tier.bottom);
    t.setFill(grd);
    if (glow) t.setShadow(0, 0, tier.glow, 10, true, true);
    if (tier.tilt) t.setAngle(Phaser.Math.Between(-tier.tilt, tier.tilt));
  }
  scene.tweens.add({ targets: t, scale: tier?.pop ?? 1.25, duration: tier ? 130 : 110, ease: 'Back.Out' });
  scene.tweens.add({ targets: t, scale: 1, delay: tier ? 130 : 110, duration: tier ? 160 : 120 });
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

/** 同一瞬間的命中火花上限：旋風斬掃到一整群狼時不一次開十幾個發射器（手機） */
const hitBudget = new WeakMap<Phaser.Scene, { at: number; n: number }>();
const HIT_WINDOW_MS = 90;
const HIT_MAX = 6;

/**
 * 命中火花（第三期 Q2）：朝被打飛的方向噴成一個扇形（ang 弧度），顏色看元素／武器（fx/hitTint）。
 * 回傳 false＝這一瞬間已經噴太多、這次省略。
 */
export function hitSparks(scene: Phaser.Scene, x: number, y: number, ang: number, n: number, tex: string, tint: number, speed = 340, spread = 40): boolean {
  const now = scene.time.now;
  let b = hitBudget.get(scene);
  if (!b || now - b.at > HIT_WINDOW_MS) { b = { at: now, n: 0 }; hitBudget.set(scene, b); }
  if (b.n >= (getSettings().lowFx ? 3 : HIT_MAX)) return false;
  b.n++;
  const deg = Phaser.Math.RadToDeg(ang);
  const p = scene.add.particles(x, y, tex, {
    speed: { min: speed * 0.35, max: speed },
    angle: { min: deg - spread, max: deg + spread },
    scale: { start: tex === 'ember' ? 0.7 : 1.3, end: 0 },
    lifespan: { min: 160, max: 380 },
    blendMode: Phaser.BlendModes.ADD,
    tint,
    emitting: false,
  });
  p.setDepth(800);
  p.explode(getSettings().lowFx ? Math.max(2, Math.round(n * 0.5)) : n);
  scene.time.delayedCall(480, () => p.destroy());
  return true;
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
export function setBannerAvoid(scene: Phaser.Scene, band: Band | null, keep: Band | null = null): void {
  if (band) AVOID.set(scene, band);
  else AVOID.delete(scene);
  if (keep) KEEP.set(scene, keep);
  else KEEP.delete(scene);
}
/** 主角頭上不能放大字的一帶（第 90 輪：交戰中的 Boss 在主角上方） */
const KEEP = new WeakMap<Phaser.Scene, Band>();
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

/**
 * 固定位置的大字（x 偏 1px、不排隊）出現時讓開正在顯示的置中大字，並登記成佔用中（第 76 輪）：
 * 升級數值小字以前蓋在「撿到裝備了！」教學上；之後出的提示也會避開它。
 */
export function pinBanner(scene: Phaser.Scene, t: Phaser.GameObjects.Text, ms: number): void {
  const live = (BANNERS.get(scene) ?? []).filter((b) => b.t.active && !b.fading);
  const busy: Band[] = live.map((b) => [b.t.y - b.h / 2, b.t.y + b.h / 2]);
  t.setY(pinY(t.y, t.height, busy, scene.scale.height * 0.62, BANNER_CEIL, AVOID.get(scene), KEEP.get(scene)));
  reserveBanner(scene, t.y, t.height, ms);
}

/** 這一帶（中心 cy、高 h）現在有沒有置中大字佔著（第 87 輪：隱藏首領的字要挪到主角下方前先看那裡空不空） */
export function bannerBusy(scene: Phaser.Scene, cy: number, h: number): boolean {
  return (BANNERS.get(scene) ?? []).some((b) => b.t.active && !b.fading && cy - h / 2 < b.t.y + b.h / 2 && cy + h / 2 > b.t.y - b.h / 2);
}

const softFlashAt = new WeakMap<Phaser.Scene, number>();
/**
 * 輕的全畫面染色（第 166 輪）：一般技能（冰系）以前用 camera.flash，那一瞬間整個畫面接近全白。
 * 技能改成全自動、還會疊放之後，帶兩三招冰系就是每兩三秒白一次，敵人的紅圈預告也跟著被蓋掉。
 * 這個只疊一層淡淡的顏色（峰值 peak，預設 0.2）再淡出；240ms 內不重複。大招、Boss 演出仍用 camera.flash。
 */
export function softFlash(scene: Phaser.Scene, color: number, ms = 160, peak = 0.2): void {
  const now = scene.time.now;
  if (now - (softFlashAt.get(scene) ?? -1e9) < 240) return;
  softFlashAt.set(scene, now);
  const w = scene.scale.width;
  const h = scene.scale.height;
  const r = scene.add.rectangle(w / 2, h / 2, w, h, color, getSettings().lowFx ? peak * 0.6 : peak).setScrollFactor(0).setDepth(850).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: r, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
}

/** 大招閃光的峰值不透明度（第 177 輪，D-372）：省電模式再淡一些。上限刻意壓在五成以下——再亮就看不到敵人的紅圈 */
export function ultFlashPeak(lowFx: boolean): number {
  return lowFx ? 0.24 : 0.4;
}

const ultFlashRect = new WeakMap<Phaser.Scene, Phaser.GameObjects.Rectangle>();
/**
 * 大招出手／落地的全畫面閃光（第 177 輪，D-372）。以前用 camera.flash：第一幀整個畫面（連 HUD、Boss 的紅圈預告）幾乎全白，
 * 要七八幀才退完，出手一次、落地再一次。大招改成自動之後，這是玩家沒按任何鍵、每四十幾秒自己來兩次的全白。
 * 改成疊一層加亮的顏色（峰值四成），深度 47＝壓在 HUD 與按鍵下面：畫面照樣「亮一下」，但紅圈、血條、按鍵一直看得到。
 * 上一道還沒退完就接著來（出手後很快落地）時換掉舊的，不會疊成全白。
 */
export function ultFlash(scene: Phaser.Scene, color: number, ms = 220): void {
  ultFlashRect.get(scene)?.destroy();
  const w = scene.scale.width;
  const h = scene.scale.height;
  const r = scene.add.rectangle(w / 2, h / 2, w, h, color, ultFlashPeak(getSettings().lowFx)).setScrollFactor(0).setDepth(47).setBlendMode(Phaser.BlendModes.ADD);
  ultFlashRect.set(scene, r);
  scene.tweens.add({ targets: r, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
}

/**
 * 危險紅暈的圖（第 170 輪）：中間透明、越靠邊越紅的一張貼圖，拉成整個畫面；不透明度由場景每幀照 `dangerAlpha` 設。
 * 深度 46＝蓋在場地與特效上、壓在 HUD 與按鍵（50 以上）下面，不會把血條、按鍵、大字染紅。
 */
export function dangerVignette(scene: Phaser.Scene): Phaser.GameObjects.Image {
  const key = 'fx_danger_vignette';
  if (!scene.textures.exists(key)) {
    const S = 256;
    const tex = scene.textures.createCanvas(key, S, S);
    if (tex) {
      const ctx = tex.getContext();
      const gr = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.72);
      gr.addColorStop(0, 'rgba(220,20,36,0)');
      gr.addColorStop(0.45, 'rgba(220,20,36,0.22)');
      gr.addColorStop(0.8, 'rgba(200,12,30,0.75)');
      gr.addColorStop(1, 'rgba(170,6,24,1)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, S, S);
      tex.refresh();
    }
  }
  const w = scene.scale.width;
  const h = scene.scale.height;
  return scene.add.image(w / 2, h / 2, key).setDisplaySize(w, h).setScrollFactor(0).setDepth(46).setAlpha(0).setVisible(false);
}

/** 畫面中央大字（PERFECT / BREAK / VICTORY） */
export function bigText(
  scene: Phaser.Scene, x: number, y: number, text: string, color: string, size = 72, hold = 450,
  /** 不急的說明：原位壓主角、主角下方又暫時被佔住時排隊等（不照原位蓋主角，第 76 輪） */
  patient = false,
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
      const cy = stackY(y, h, busy, scene.scale.height * 0.62, BANNER_CEIL, AVOID.get(scene), patient, KEEP.get(scene));
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
