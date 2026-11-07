// 深夜的動態光照（A3，第 152 輪）：純畫面、不碰戰鬥亂數。
// 以前深夜只有一張「以主角為中心的暗角」圖；現在改成一張半解析度的黑幕 RenderTexture，
// 每一幀先鋪滿夜色，再用柔邊筆刷「擦出」光源：主角（和以前同一條明暗曲線）、畫面內的營火（會閃動），
// 以及短暫的閃光（怪物倒下、大招）。省電畫質（lowFx）不建它，場景照舊用那張靜態暗角圖。
import Phaser from 'phaser';

const DARK = 0x060a24;
const DARK_A = 0.74;
/** 黑幕用半解析度（畫面 2 倍放大），手機上每幀只鋪 360×(高/2) 一次 */
const RES = 0.5;
const BRUSH = 128; // 筆刷半徑（貼圖 256×256）
/** 主角光：舊暗角圖顯示成 3200×3200 → 半徑 1600 畫面像素 */
const PLAYER_R = 1600;
const MAX_FLASH = 12;

interface Flash {
  x: number;
  y: number;
  r: number;
  t0: number;
  dur: number;
}

export interface LightSpot {
  x: number;
  y: number;
  /** 半徑（畫面像素） */
  r: number;
  /** 亮度 0～1 */
  a: number;
  /** 會閃動（火） */
  flicker: boolean;
}

/** 擦除筆刷：白色＋alpha 曲線（alpha 越高擦得越亮） */
function brush(scene: Phaser.Scene, key: string, stops: [number, number][]): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, BRUSH * 2, BRUSH * 2);
  if (!tex) return key;
  const ctx = tex.getContext();
  const gr = ctx.createRadialGradient(BRUSH, BRUSH, 0, BRUSH, BRUSH, BRUSH);
  for (const [at, a] of stops) gr.addColorStop(at, `rgba(255,255,255,${a})`);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, BRUSH * 2, BRUSH * 2);
  tex.refresh();
  return key;
}

export class NightLight {
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly playerBrush: string;
  private readonly softBrush: string;
  private readonly flashes: Flash[] = [];

  constructor(private readonly scene: Phaser.Scene, width: number, height: number, depth: number) {
    // 舊暗角圖的明暗：中心 0 → 0.1 處 0.05 → 0.28 處 0.5 → 0.5 處 0.68 → 邊緣 0.74；
    // 黑幕 0.74 被擦掉 a 之後剩 0.74×(1−a)，所以 a = 1 − 原本/0.74。
    this.playerBrush = brush(scene, 'rt_night_light_player', [[0, 1], [0.1, 0.93], [0.28, 0.32], [0.5, 0.08], [1, 0]]);
    this.softBrush = brush(scene, 'rt_night_light_soft', [[0, 1], [0.3, 0.82], [0.65, 0.3], [1, 0]]);
    this.rt = scene.add.renderTexture(0, 0, Math.ceil(width * RES), Math.ceil(height * RES)).setOrigin(0, 0).setScale(1 / RES).setDepth(depth);
  }

  /** 短暫的閃光（畫面座標）：r 是半徑（畫面像素），dur 毫秒內淡掉 */
  flash(x: number, y: number, r: number, dur: number): void {
    if (this.flashes.length >= MAX_FLASH) this.flashes.shift();
    this.flashes.push({ x, y, r, t0: this.scene.time.now, dur });
  }

  /** 每幀：鋪夜色 → 擦出主角、固定光源（營火、傳送門）、閃光 */
  update(now: number, px: number, py: number, spots: readonly LightSpot[]): void {
    const rt = this.rt;
    rt.clear();
    rt.fill(DARK, DARK_A);
    const s = PLAYER_R / BRUSH;
    rt.stamp(this.playerBrush, undefined, px * RES, py * RES, { scale: s * RES, erase: true });
    for (let i = 0; i < spots.length; i++) {
      const f = spots[i]!;
      const flick = f.flicker ? 1 + 0.07 * Math.sin(now / 110 + i * 1.7) + 0.04 * Math.sin(now / 47 + i) : 1 + 0.03 * Math.sin(now / 600 + i);
      rt.stamp(this.softBrush, undefined, f.x * RES, f.y * RES, { scale: ((f.r * flick) / BRUSH) * RES, alpha: f.a, erase: true });
    }
    let w = 0;
    for (let i = 0; i < this.flashes.length; i++) {
      const fl = this.flashes[i]!;
      const t = (now - fl.t0) / fl.dur;
      if (t >= 1) continue;
      this.flashes[w++] = fl;
      const a = 1 - t * t;
      rt.stamp(this.softBrush, undefined, fl.x * RES, fl.y * RES, { scale: ((fl.r * (0.7 + 0.3 * a)) / BRUSH) * RES, alpha: a, erase: true });
    }
    this.flashes.length = w;
  }

  destroy(): void {
    this.rt.destroy();
  }
}

/** 省電畫質的深夜暗角（D-103 原本的做法：一張跟著主角的靜態圖；第 152 輪從 RtBattleScene 搬來） */
export function nightShadeTexture(scene: Phaser.Scene): string {
  const key = 'rt_night_shade';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 512, 512);
  if (!tex) return key;
  const ctx = tex.getContext();
  const gr = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  gr.addColorStop(0, 'rgba(6,10,36,0)');
  gr.addColorStop(0.1, 'rgba(6,10,36,0.05)');
  gr.addColorStop(0.28, 'rgba(6,10,36,0.5)');
  gr.addColorStop(0.5, 'rgba(6,10,36,0.68)');
  gr.addColorStop(1, 'rgba(6,10,36,0.74)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 512, 512);
  tex.refresh();
  return key;
}

/** 營火的暖色光暈（ADD 疊加；第 152 輪從 RtBattleScene 搬來） */
export function fireGlowTexture(scene: Phaser.Scene): string {
  const key = 'rt_fire_glow';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 256, 256);
  if (!tex) return key;
  const ctx = tex.getContext();
  const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,190,90,0.8)');
  gr.addColorStop(0.35, 'rgba(255,140,50,0.32)');
  gr.addColorStop(1, 'rgba(255,100,30,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 256, 256);
  tex.refresh();
  return key;
}
