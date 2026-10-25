// 裝備圖示（D-101）：六個部位的程式繪製剪影，白色系畫成材質，用稀有度顏色上色（setTint）。
// 之後若有 AI 圖（ART_REQUESTS），只要換掉 gearIconKey 回傳的材質即可。
import Phaser from 'phaser';
import type { GearSlot, Rarity } from '../../core/battle/rt/gear';
import { RARITY_COLOR } from '../../core/battle/rt/gear';

const S = 96; // 材質邊長（放大縮小都清楚）

type P = { x: number; y: number };
const pts = (a: number[]): P[] => {
  const out: P[] = [];
  for (let i = 0; i < a.length; i += 2) out.push({ x: a[i]!, y: a[i + 1]! });
  return out;
};

function draw(g: Phaser.GameObjects.Graphics, slot: GearSlot): void {
  const fill = 0xf2f2f2;
  const shade = 0xa8a8a8;
  const line = 0x2a2a2a;
  const poly = (a: number[], c = fill) => {
    g.fillStyle(c, 1).fillPoints(pts(a), true);
    g.lineStyle(4, line, 1).strokePoints(pts(a), true);
  };
  switch (slot) {
    case 'weapon':
      // 斜放的長劍：劍身、護手、握柄、柄頭
      poly([70, 10, 84, 12, 86, 26, 40, 70, 28, 60]);
      g.lineStyle(3, shade, 1).lineBetween(78, 18, 36, 62);
      poly([18, 54, 26, 46, 52, 72, 44, 80], shade);
      poly([30, 66, 36, 72, 20, 88, 14, 82], 0xc8c8c8);
      g.fillStyle(fill, 1).fillCircle(13, 89, 6);
      g.lineStyle(3, line, 1).strokeCircle(13, 89, 6);
      break;
    case 'head':
      // 頭盔：圓頂＋護頰＋眼縫
      poly([16, 62, 16, 42, 24, 24, 40, 14, 56, 14, 72, 24, 80, 42, 80, 62, 66, 80, 58, 80, 58, 58, 38, 58, 38, 80, 30, 80]);
      g.fillStyle(line, 1).fillRect(26, 44, 44, 7);
      g.lineStyle(3, shade, 1).lineBetween(48, 16, 48, 40);
      break;
    case 'body':
      // 胸甲：肩甲＋胸板＋腰線
      poly([10, 26, 30, 14, 40, 22, 56, 22, 66, 14, 86, 26, 80, 46, 72, 44, 72, 82, 24, 82, 24, 44, 16, 46]);
      g.lineStyle(3, shade, 1).lineBetween(48, 26, 48, 78).lineBetween(28, 62, 68, 62);
      break;
    case 'hands':
      // 護手：手背甲＋四指＋護腕
      poly([22, 88, 22, 64, 18, 44, 26, 40, 32, 52, 32, 26, 40, 24, 44, 46, 46, 18, 54, 18, 56, 46, 60, 24, 68, 26, 66, 50, 72, 36, 80, 40, 74, 66, 70, 88]);
      g.fillStyle(shade, 1).fillRect(24, 72, 44, 8);
      break;
    case 'ring':
      // 戒指：環＋寶石
      g.lineStyle(16, line, 1).strokeCircle(48, 58, 26);
      g.lineStyle(10, fill, 1).strokeCircle(48, 58, 26);
      poly([48, 12, 62, 26, 48, 40, 34, 26], 0xffffff);
      g.lineStyle(2, shade, 1).lineBetween(34, 26, 62, 26);
      break;
    case 'amulet':
      // 項鍊：V 字鍊＋墜子
      g.lineStyle(6, line, 1).lineBetween(16, 8, 48, 50).lineBetween(80, 8, 48, 50);
      g.lineStyle(3, fill, 1).lineBetween(16, 8, 48, 50).lineBetween(80, 8, 48, 50);
      poly([48, 44, 68, 64, 48, 90, 28, 64]);
      g.fillStyle(shade, 1).fillCircle(48, 66, 7);
      break;
  }
}

/** 取得（必要時產生）某部位的圖示材質 key */
export function gearIconKey(scene: Phaser.Scene, slot: GearSlot): string {
  const key = `gear_icon_${slot}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g, slot);
    g.generateTexture(key, S, S);
    g.destroy();
  }
  return key;
}

/**
 * 一個裝備圖示（含稀有度底光）。size＝顯示邊長（px）。
 * 稀有：金色底光慢慢脈動；精良：藍色淡底光。
 */
export function gearIcon(scene: Phaser.Scene, x: number, y: number, slot: GearSlot, rarity: Rarity | 0, size: number): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const col = rarity ? RARITY_COLOR[rarity] : 0x666677;
  if (rarity >= 2) {
    const glow = scene.add.circle(x, y, size * 0.55, col, rarity === 3 ? 0.35 : 0.2);
    if (rarity === 3) scene.tweens.add({ targets: glow, alpha: 0.12, scale: 1.12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    out.push(glow);
  }
  const img = scene.add.image(x, y, gearIconKey(scene, slot)).setDisplaySize(size, size).setTint(col);
  if (!rarity) img.setAlpha(0.45);
  out.push(img);
  return out;
}
