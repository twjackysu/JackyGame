/**
 * 隱藏寶箱的長相與開蓋演出（第 207 輪，D-415）。純資料＋純函式＋一個畫圖函式；什麼時候開、給什麼在引擎。
 *
 * 以前：兩塊暗褐色圓角長方形＋一條金色小方塊，在 390 寬的手機上只有 25px 左右——深色地面上是一小塊污漬，
 * 看不出是寶箱；打開的那一刻只有一圈衝擊環＋火星，箱子本身只是蓋子變黑、整個變半透明（幾乎消失）。
 *
 * 現在：
 * - 箱子大一號，有木板、兩條鐵箍、金色鎖片、弧形的蓋子與一道高光。
 * - 打開：蓋子往後掀（帶一點回彈）、箱口噴出一道金光與幾枚往外拋的金幣，光慢慢收掉。
 * - 開過的箱子：蓋子掀著、裡面是空的，看得出「這個開過了」，不再淡到看不見。
 * - 夜光寶箱同一套畫法、藍色配色（光柱與光圈照舊由場景畫）。
 */
import type Phaser from 'phaser';

export const CHEST_ART = {
  /** false＝舊的兩塊長方形 */
  on: true,
  /** 相對舊箱子（52×26）的放大倍數 */
  scale: 1.5,
  /** 蓋子掀開要幾毫秒 */
  lidMs: 300,
  /** 箱口的金光：多久收完 */
  glowMs: 1500,
  /** 往外拋的金幣：幾枚、飛多久、省電畫質幾枚 */
  coins: 7,
  coinsLow: 3,
  coinMs: 760,
  /** 開過的箱子留在地上的濃淡 */
  openedA: 0.8,
} as const;

export interface ChestPalette {
  wood: number;
  woodDark: number;
  woodLight: number;
  band: number;
  lock: number;
  inside: number;
  glow: number;
}

export const CHEST_DAY: ChestPalette = { wood: 0x8a5426, woodDark: 0x5a3416, woodLight: 0xb47a3c, band: 0x3c3440, lock: 0xf0c85a, inside: 0x1c0f08, glow: 0xffe08a };
export const CHEST_NIGHT: ChestPalette = { wood: 0x3c5c9c, woodDark: 0x263c6c, woodLight: 0x6a96dc, band: 0x1c2440, lock: 0xe8f4ff, inside: 0x0c1428, glow: 0xbfe0ff };

export interface ChestPose {
  /** 蓋子掀開多少：0＝蓋著、1＝全開（掀開途中會稍微超過 1 再彈回來） */
  lid: number;
  /** 箱口金光的濃淡 0～1 */
  glow: number;
  /** 往上的光柱高度比例 0～1 */
  beam: number;
}

/** 開箱後 age 毫秒的姿勢。age < 0（還沒開）＝蓋著；很久以後＝全開、沒有光 */
export function chestPose(age: number): ChestPose {
  const A = CHEST_ART;
  if (!(age >= 0)) return { lid: 0, glow: 0, beam: 0 };
  const t = Math.min(1, age / A.lidMs);
  // easeOutBack：衝過頭一點再回來
  const c = 1.9;
  const lid = 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  const gt = Math.min(1, age / A.glowMs);
  // 光：蓋子一掀就亮到滿，之後慢慢收
  const rise = Math.min(1, age / (A.lidMs * 0.6));
  const glow = rise * (1 - gt) ** 1.5;
  return { lid, glow, beam: rise * Math.max(0, 1 - gt * 1.6) };
}

export interface ChestCoin {
  /** 相對箱口的位置（單位＝箱子寬度）；y 往上為負 */
  x: number;
  y: number;
  a: number;
}

function rng(seed: number): () => number {
  let a = (seed | 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 從箱口拋出來的金幣：拋物線（先往上、再落回箱子兩側的地上），落地前淡掉。同一個種子同一組軌跡 */
export function chestCoins(seed: number, age: number, n: number = CHEST_ART.coins): ChestCoin[] {
  const A = CHEST_ART;
  if (!(age >= 0) || age >= A.coinMs) return [];
  const r = rng(seed);
  const out: ChestCoin[] = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const vx = side * (0.35 + r() * 0.75);
    const up = 0.9 + r() * 0.7;
    const delay = r() * 0.18;
    const t = (age / A.coinMs - delay) / (1 - delay);
    if (t <= 0) continue;
    // y：t=0 在箱口、頂點在 t=0.4、t=0.8 回到箱口高度，之後落到箱底（最多 +0.35）
    const y = -up * 4 * t * (0.8 - t);
    out.push({ x: vx * t, y: Math.min(0.35, y), a: t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1 });
  }
  return out;
}

/**
 * 畫一個寶箱。cx, cy＝箱子的地面中心（和舊畫法同一個錨點）；k＝世界到畫面的倍率（已乘過舊的 1.4）。
 * g＝地面層（箱子本身）；top＝畫在暈影上面的那層（光與金幣；不給就都畫在 g）。
 */
export function drawChest(
  g: Phaser.GameObjects.Graphics,
  top: Phaser.GameObjects.Graphics | null,
  cx: number,
  cy: number,
  k0: number,
  pal: ChestPalette,
  alpha: number,
  pose: ChestPose,
  coins: ChestCoin[],
  glint: boolean,
): void {
  const k = k0 * CHEST_ART.scale;
  const W = 52 * k;
  const H = 24 * k;
  const x0 = cx - W / 2;
  const yTop = cy - 8 * k; // 箱身上緣（箱口）
  const lid = Math.max(0, pose.lid);
  const fx = top ?? g;
  // 影子
  g.fillStyle(0x000000, 0.38 * alpha).fillEllipse(cx, yTop + H + 3 * k, W * 1.2, 12 * k);
  // 掀開的蓋子（在箱身後面）：越開越高、看到的是蓋子內側
  if (lid > 0.02) {
    const lh = 20 * k * Math.min(1.15, lid);
    g.fillStyle(pal.woodDark, alpha).fillRoundedRect(x0 - 1 * k, yTop - lh, W + 2 * k, lh + 2 * k, { tl: 6 * k, tr: 6 * k, bl: 0, br: 0 });
    g.fillStyle(pal.inside, 0.55 * alpha).fillRoundedRect(x0 + 4 * k, yTop - lh + 4 * k, W - 8 * k, Math.max(0, lh - 4 * k), 3 * k);
    g.fillStyle(pal.band, alpha).fillRect(x0 + 7 * k, yTop - lh, 5 * k, lh).fillRect(x0 + W - 12 * k, yTop - lh, 5 * k, lh);
    g.lineStyle(Math.max(1, 1.5 * k), pal.lock, 0.8 * alpha).lineBetween(x0 + 2 * k, yTop - lh + 1 * k, x0 + W - 2 * k, yTop - lh + 1 * k);
  }
  // 箱身
  g.fillStyle(pal.wood, alpha).fillRoundedRect(x0, yTop, W, H, { tl: 0, tr: 0, bl: 4 * k, br: 4 * k });
  g.fillStyle(pal.woodDark, 0.55 * alpha).fillRect(x0, yTop + H * 0.48, W, Math.max(1, 1.5 * k)); // 木板縫
  g.fillStyle(pal.woodDark, 0.5 * alpha).fillRoundedRect(x0, yTop + H - 5 * k, W, 5 * k, { tl: 0, tr: 0, bl: 4 * k, br: 4 * k }); // 底部暗一點
  g.fillStyle(pal.band, alpha).fillRect(x0 + 7 * k, yTop, 5 * k, H).fillRect(x0 + W - 12 * k, yTop, 5 * k, H);
  if (lid > 0.02) {
    // 箱口：一條暗的開口；有光時填金色
    g.fillStyle(pal.inside, alpha).fillRect(x0 + 2 * k, yTop - 1 * k, W - 4 * k, 5 * k);
    if (pose.glow > 0.01) g.fillStyle(pal.glow, Math.min(1, pose.glow * 1.2) * alpha).fillRect(x0 + 3 * k, yTop - 1 * k, W - 6 * k, 4 * k);
  } else {
    // 蓋著的蓋子：弧形頂、亮邊、鐵箍接上去
    const lh = 15 * k;
    g.fillStyle(pal.wood, alpha).fillRoundedRect(x0 - 2 * k, yTop - lh, W + 4 * k, lh + 1 * k, { tl: 8 * k, tr: 8 * k, bl: 1 * k, br: 1 * k });
    g.fillStyle(pal.woodLight, 0.9 * alpha).fillRoundedRect(x0 + 2 * k, yTop - lh + 2 * k, W - 4 * k, 4 * k, 2 * k);
    g.fillStyle(pal.band, alpha).fillRect(x0 + 7 * k, yTop - lh, 5 * k, lh).fillRect(x0 + W - 12 * k, yTop - lh, 5 * k, lh);
    g.fillStyle(pal.woodDark, 0.8 * alpha).fillRect(x0 - 2 * k, yTop - 1 * k, W + 4 * k, Math.max(1, 2 * k)); // 蓋子和箱身的縫
  }
  // 鎖片（開了以後垂在箱身上、暗一點）
  g.fillStyle(pal.lock, (lid > 0.02 ? 0.7 : 1) * alpha).fillRoundedRect(cx - 5 * k, yTop - (lid > 0.02 ? -2 : 4) * k, 10 * k, 11 * k, 2 * k);
  g.fillStyle(pal.woodDark, 0.9 * alpha).fillCircle(cx, yTop + (lid > 0.02 ? 7 : 1) * k, 1.8 * k);
  if (glint && lid <= 0.02) g.fillStyle(0xffffff, 0.95 * alpha).fillCircle(x0 + W - 6 * k, yTop - 11 * k, 2.5 * k);
  // 箱口的光：一團柔光＋往上收窄的光柱（幾層疊出柔邊）
  if (pose.glow > 0.01) {
    const ga = pose.glow * alpha;
    for (let i = 0; i < 4; i++) fx.fillStyle(pal.glow, ga * (0.1 + i * 0.05)).fillEllipse(cx, yTop - 2 * k, W * (1.9 - i * 0.4), 26 * k * (1.5 - i * 0.3));
    if (pose.beam > 0.01) {
      const bh = 110 * k * pose.beam;
      for (let i = 0; i < 3; i++) {
        const w0 = (W - 8 * k) * (1 - i * 0.28);
        const w1 = w0 * 1.7;
        fx.fillStyle(pal.glow, ga * (0.07 + i * 0.05));
        fx.beginPath();
        fx.moveTo(cx - w0 / 2, yTop);
        fx.lineTo(cx + w0 / 2, yTop);
        fx.lineTo(cx + w1 / 2, yTop - bh);
        fx.lineTo(cx - w1 / 2, yTop - bh);
        fx.closePath();
        fx.fillPath();
      }
    }
  }
  for (const c of coins) {
    const x = cx + c.x * W;
    const y = yTop + c.y * W;
    fx.fillStyle(0x8a5a10, c.a * alpha).fillCircle(x, y + 1 * k, 3.6 * k);
    fx.fillStyle(0xffd24a, c.a * alpha).fillCircle(x, y, 3.4 * k);
    fx.fillStyle(0xfff4c0, c.a * alpha).fillCircle(x - 1 * k, y - 1 * k, 1.3 * k);
  }
}
