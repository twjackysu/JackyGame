// 燼紅裂谷（D-125）的程式美術：熔渣史萊姆、燼心岩王。開機時畫成材質（之後有 AI 圖就換掉，見 ART_REQUESTS）。
import Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

/** 發光的熔岩裂紋：外層暗橘粗線＋內層亮黃細線 */
function crack(g: G, pts: [number, number][], w = 1): void {
  const v = pts.map(([x, y]) => new Phaser.Math.Vector2(x, y));
  g.lineStyle(7 * w, 0xc8401a, 0.55).strokePoints(v, false);
  g.lineStyle(3 * w, 0xff9a3a, 0.95).strokePoints(v, false);
  g.lineStyle(1.2 * w, 0xffe6a0, 1).strokePoints(v, false);
}

function glow(g: G, x: number, y: number, r: number, color = 0xff8a3a): void {
  for (let i = 5; i >= 1; i--) g.fillStyle(color, 0.08 * (6 - i)).fillCircle(x, y, r * (i / 5) * 1.6);
}

/** 熔渣史萊姆 128×112：焦黑外殼的熔岩團，殼裂開的地方透出熔芯，兩隻發光的眼睛 */
export function makeSlagSlime(scene: Phaser.Scene, key = 'enemy_slag_slime'): void {
  if (scene.textures.exists(key)) return;
  const W = 128;
  const H = 112;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  glow(g, 64, 70, 34, 0xff6a20);
  // 熔芯（底層亮橘）
  g.fillStyle(0xd8501a, 1).fillEllipse(64, 72, 112, 76);
  g.fillStyle(0xff8a2a, 1).fillEllipse(64, 76, 86, 50);
  // 焦黑外殼（幾塊不規則的殼片蓋在上面，縫隙露出熔芯）
  g.fillStyle(0x2a201e, 1);
  g.fillEllipse(44, 58, 58, 44);
  g.fillEllipse(84, 56, 54, 42);
  g.fillEllipse(64, 40, 56, 34);
  g.fillEllipse(30, 82, 40, 26);
  g.fillEllipse(98, 82, 40, 26);
  g.fillStyle(0x3e302c, 1);
  g.fillEllipse(40, 52, 30, 18);
  g.fillEllipse(80, 48, 28, 16);
  g.fillEllipse(62, 34, 30, 14);
  g.fillStyle(0x5a4a44, 0.8).fillEllipse(56, 30, 14, 6);
  crack(g, [[30, 70], [46, 66], [58, 74], [72, 66], [92, 72]], 0.8);
  crack(g, [[64, 46], [60, 56], [66, 64]], 0.6);
  // 眼睛
  glow(g, 50, 64, 7, 0xffd060);
  glow(g, 78, 64, 7, 0xffd060);
  g.fillStyle(0xfff2b0, 1).fillEllipse(50, 64, 10, 5).fillEllipse(78, 64, 10, 5);
  // 底部滴落
  g.fillStyle(0xff9a3a, 1).fillCircle(24, 100, 5).fillCircle(102, 102, 4).fillCircle(64, 106, 5);
  g.generateTexture(key, W, H);
  g.destroy();
}

/** 燼心岩王 220×250：玄武岩巨像，胸口熔心、肩上冒火、拳頭垂到膝下 */
export function makeEmberColossus(scene: Phaser.Scene, key = 'enemy_ember_colossus'): void {
  if (scene.textures.exists(key)) return;
  const W = 220;
  const H = 250;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // 岩塊：深色描邊（背景也是深色，要靠輪廓與亮面分出來）＋本體＋左上亮面＋高光
  const rock = (x: number, y: number, w: number, h: number, dark = false) => {
    const rr = Math.min(w, h) * 0.3;
    g.fillStyle(0x080404, 1).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, rr + 2);
    g.fillStyle(dark ? 0x3e3430 : 0x564a44, 1).fillRoundedRect(x, y, w, h, rr);
    g.fillStyle(dark ? 0x54483f : 0x76665c, 1).fillRoundedRect(x + w * 0.1, y + h * 0.06, w * 0.6, h * 0.38, Math.min(w, h) * 0.2);
    g.fillStyle(0xa89484, 0.7).fillEllipse(x + w * 0.32, y + h * 0.16, w * 0.3, h * 0.08);
    g.fillStyle(0x1a1210, 0.35).fillRoundedRect(x, y + h * 0.7, w, h * 0.3, rr * 0.6);
  };
  // 腿
  rock(62, 168, 38, 74, true);
  rock(120, 168, 38, 74, true);
  // 手臂（後）＋拳頭
  rock(14, 84, 44, 92, true);
  rock(162, 84, 44, 92, true);
  rock(8, 168, 54, 50);
  rock(158, 168, 54, 50);
  // 軀幹
  glow(g, 110, 128, 46, 0xff6a20);
  rock(46, 70, 128, 116);
  // 肩甲
  rock(30, 62, 58, 40);
  rock(132, 62, 58, 40);
  // 頭
  rock(84, 26, 52, 48, true);
  // 熔心（胸口）
  glow(g, 110, 124, 26, 0xffa040);
  g.fillStyle(0xff7a2a, 1).fillCircle(110, 124, 18);
  g.fillStyle(0xffd070, 1).fillCircle(110, 124, 10);
  g.fillStyle(0xfff6d0, 1).fillCircle(108, 121, 4);
  crack(g, [[110, 142], [100, 160], [108, 178]], 1);
  crack(g, [[92, 112], [70, 100], [58, 108]], 0.9);
  crack(g, [[128, 112], [150, 98], [160, 112]], 0.9);
  crack(g, [[30, 190], [44, 200], [38, 212]], 0.7);
  crack(g, [[186, 186], [174, 200], [184, 210]], 0.7);
  crack(g, [[76, 200], [82, 220]], 0.6);
  crack(g, [[140, 204], [136, 226]], 0.6);
  // 眼睛
  glow(g, 100, 48, 8, 0xffd060);
  glow(g, 120, 48, 8, 0xffd060);
  g.fillStyle(0xfff2b0, 1).fillRect(93, 46, 14, 5).fillRect(113, 46, 14, 5);
  // 肩上的火
  for (const [fx, fy] of [[52, 60], [168, 60]] as const) {
    glow(g, fx, fy, 12, 0xff8a2a);
    g.fillStyle(0xff7a2a, 0.9).fillTriangle(fx - 10, fy + 4, fx + 10, fy + 4, fx, fy - 22);
    g.fillStyle(0xffd070, 1).fillTriangle(fx - 5, fy + 3, fx + 5, fy + 3, fx, fy - 12);
  }
  g.generateTexture(key, W, H);
  g.destroy();
}
