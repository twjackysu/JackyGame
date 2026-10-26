// 星隕高原（D-138）的程式美術：星骸守望者（Boss）、晶殼魔像。開機時畫成材質（之後有 AI 圖就換掉，見 ART_REQUESTS）。
// 深色背景上要靠深色描邊＋亮面＋白色稜線分出輪廓；發光的星核是視線焦點。
import Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
type P = [number, number];

function glow(g: G, x: number, y: number, r: number, color: number): void {
  for (let i = 5; i >= 1; i--) g.fillStyle(color, 0.08 * (6 - i)).fillCircle(x, y, r * (i / 5) * 1.6);
}

function mix(a: number, b: number, f: number): number {
  const c = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * f);
  return (c(16) << 16) | (c(8) << 8) | c(0);
}

/** 一塊晶石（第 31 輪改成切面）：描邊 → 從中心切成三角面，每面依光線方向（左上）在暗色與亮色之間上色 →
 *  中心內光 → 面與面之間的稜線（迎光的邊是白色、背光的邊是淡藍） */
function crystal(g: G, pts: P[], body: number, light: number): void {
  const v = pts.map(([x, y]) => new Phaser.Math.Vector2(x, y));
  g.lineStyle(6, 0x05060e, 1).strokePoints(v, true);
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  // 稍微偏上的「頂點」讓切面像隆起的晶體
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length - 3;
  const lx = -0.6;
  const ly = -0.8;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    const mx = (a[0] + b[0]) / 2 - cx;
    const my = (a[1] + b[1]) / 2 - cy;
    const d = Math.hypot(mx, my) || 1;
    const lit = Math.max(0, Math.min(1, 0.5 + 0.5 * ((mx / d) * lx + (my / d) * ly)));
    g.fillStyle(mix(mix(body, 0x05060e, 0.35), light, lit * 0.9), 1).fillTriangle(a[0], a[1], b[0], b[1], cx, cy);
  });
  // 內光：中心一點淡淡的亮
  const r = Math.min(...pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy))) * 0.6;
  g.fillStyle(light, 0.18).fillCircle(cx, cy, r);
  // 稜線
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    const mx = (a[0] + b[0]) / 2 - cx;
    const my = (a[1] + b[1]) / 2 - cy;
    const lit = (mx * lx + my * ly) > 0;
    g.lineStyle(1.5, lit ? 0xf0f4ff : 0x8aa0ff, lit ? 0.85 : 0.35).lineBetween(a[0], a[1], cx, cy);
    if (lit) g.lineStyle(2, 0xe8eeff, 0.7).lineBetween(a[0], a[1], b[0], b[1]);
  });
}

/** 從星核往外的發光裂紋（折線） */
function crack(g: G, pts: P[], color: number): void {
  const v = pts.map(([x, y]) => new Phaser.Math.Vector2(x, y));
  g.lineStyle(5, color, 0.25).strokePoints(v, false);
  g.lineStyle(2, 0xe8f0ff, 0.9).strokePoints(v, false);
}

function sparkle(g: G, x: number, y: number, r: number): void {
  g.fillStyle(0xffffff, 1).fillTriangle(x - r * 0.25, y, x + r * 0.25, y, x, y - r).fillTriangle(x - r * 0.25, y, x + r * 0.25, y, x, y + r);
  g.fillTriangle(x, y - r * 0.25, x, y + r * 0.25, x - r, y).fillTriangle(x, y - r * 0.25, x, y + r * 0.25, x + r, y);
}

/** 星骸守望者 220×260：墜星化成的晶石巨人——頭上一圈晶冠、胸口星核、背後兩片晶翼、右手握著星槍 */
export function makeStarSentinel(scene: Phaser.Scene, key = 'enemy_star_sentinel'): void {
  if (scene.textures.exists(key)) return;
  const W = 220;
  const H = 260;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const D = 0x2c2f66;
  const M = 0x4a50a0;
  const L = 0x8a96e8;
  // 背後晶翼
  glow(g, 110, 110, 70, 0x5a6aff);
  crystal(g, [[70, 90], [8, 30], [30, 120], [60, 140]], D, M);
  crystal(g, [[150, 90], [212, 30], [190, 120], [160, 140]], D, M);
  // 星槍（右手，斜立）
  g.lineStyle(9, 0x05060e, 1).lineBetween(196, 250, 176, 20);
  g.lineStyle(5, 0xc8d4ff, 1).lineBetween(196, 250, 176, 20);
  crystal(g, [[176, 4], [186, 34], [176, 44], [166, 34]], L, 0xe0e8ff);
  // 腿
  crystal(g, [[74, 172], [102, 172], [98, 248], [66, 248]], D, M);
  crystal(g, [[118, 172], [146, 172], [154, 248], [122, 248]], D, M);
  // 手臂
  crystal(g, [[40, 92], [66, 96], [60, 176], [30, 168]], D, M);
  crystal(g, [[154, 96], [180, 92], [190, 168], [160, 176]], D, M);
  crystal(g, [[26, 164], [62, 172], [54, 204], [22, 196]], M, L); // 拳
  crystal(g, [[158, 172], [194, 164], [198, 196], [166, 204]], M, L);
  // 軀幹（倒三角）＋肩甲
  crystal(g, [[52, 78], [168, 78], [140, 180], [80, 180]], M, L);
  crystal(g, [[30, 70], [78, 64], [70, 104], [26, 100]], L, 0xd0d8ff);
  crystal(g, [[142, 64], [190, 70], [194, 100], [150, 104]], L, 0xd0d8ff);
  // 頭＋晶冠
  crystal(g, [[90, 34], [130, 34], [126, 72], [94, 72]], D, M);
  for (const [x, h] of [[88, 22], [100, 34], [110, 42], [120, 34], [132, 22]] as const) crystal(g, [[x - 6, 36], [x + 6, 36], [x, 36 - h]], L, 0xe8ecff);
  // 眼
  glow(g, 102, 52, 7, 0xa8c8ff);
  glow(g, 118, 52, 7, 0xa8c8ff);
  g.fillStyle(0xf0f6ff, 1).fillRect(96, 50, 11, 4).fillRect(113, 50, 11, 4);
  // 星核往外的發光裂紋
  crack(g, [[110, 120], [92, 104], [86, 86]], 0x9ab8ff);
  crack(g, [[110, 120], [132, 108], [140, 88]], 0x9ab8ff);
  crack(g, [[110, 120], [98, 146], [102, 170]], 0x9ab8ff);
  crack(g, [[110, 120], [124, 150], [118, 176]], 0x9ab8ff);
  // 星核
  glow(g, 110, 120, 30, 0x9ab8ff);
  g.fillStyle(0x7a9aff, 1).fillCircle(110, 120, 16);
  g.fillStyle(0xd8e4ff, 1).fillCircle(110, 120, 9);
  sparkle(g, 110, 120, 22);
  // 身上的星點
  for (const [x, y, r] of [[70, 130, 5], [150, 140, 4], [40, 120, 4], [180, 120, 4], [86, 220, 4], [138, 214, 5]] as const) sparkle(g, x, y, r);
  g.generateTexture(key, W, H);
  g.destroy();
}

/** 晶殼魔像 140×130：矮胖的晶石塊，頭頂幾根晶刺、中間一顆藍色核心 */
export function makeCrystalGolem(scene: Phaser.Scene, key = 'enemy_crystal_golem'): void {
  if (scene.textures.exists(key)) return;
  const W = 140;
  const H = 130;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  glow(g, 70, 80, 36, 0x5a6aff);
  crystal(g, [[20, 70], [56, 52], [60, 120], [16, 116]], 0x2c2f66, 0x4a50a0);
  crystal(g, [[84, 52], [120, 70], [124, 116], [80, 120]], 0x2c2f66, 0x4a50a0);
  crystal(g, [[36, 44], [104, 44], [112, 112], [28, 112]], 0x4a50a0, 0x8a96e8);
  for (const [x, h] of [[44, 30], [62, 42], [80, 36], [98, 26]] as const) crystal(g, [[x - 8, 46], [x + 8, 46], [x + 3, 46 - h]], 0x8a96e8, 0xe0e8ff);
  crack(g, [[70, 82], [52, 96], [46, 110]], 0x9ab8ff);
  crack(g, [[70, 82], [90, 98], [94, 110]], 0x9ab8ff);
  glow(g, 70, 82, 14, 0xa8c8ff);
  g.fillStyle(0x7a9aff, 1).fillCircle(70, 82, 9);
  g.fillStyle(0xe8f0ff, 1).fillCircle(70, 82, 4);
  glow(g, 56, 64, 5, 0xa8c8ff);
  glow(g, 84, 64, 5, 0xa8c8ff);
  g.fillStyle(0xf0f6ff, 1).fillRect(51, 62, 9, 4).fillRect(80, 62, 9, 4);
  g.generateTexture(key, W, H);
  g.destroy();
}
