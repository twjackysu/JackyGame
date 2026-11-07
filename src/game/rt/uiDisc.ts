// 冒險地圖的圓形按鈕底（技能鍵、大招、藥水、搖桿底座）烤成貼圖（第 154 輪，D-332 同一招）。
// Phaser 的 Graphics 每畫一個圓都要算 100 個點（每幀配置新物件、填色還要切三角形）；按鈕底每幀 16 個圓 → 改成圖片，
// 只有會變的部分（冷卻扇形、MP 環、閃爍外框）留在畫筆。同樣的顏色／半徑只烤一次。
import type Phaser from 'phaser';

export interface DiscStyle {
  r: number;
  fill: number;
  fillA: number;
  /** 外框寬（0＝沒有） */
  lw: number;
  stroke: number;
  strokeA: number;
}

export function discTexture(scene: Phaser.Scene, d: DiscStyle): string {
  const key = `ui_disc_${d.r}_${d.fill}_${d.fillA}_${d.lw}_${d.stroke}_${d.strokeA}`;
  if (!scene.textures.exists(key)) {
    const size = 2 * Math.ceil(d.r + d.lw / 2 + 2);
    const c = size / 2;
    const g = scene.make.graphics({}, false);
    g.fillStyle(d.fill, d.fillA).fillCircle(c, c, d.r);
    if (d.lw > 0) g.lineStyle(d.lw, d.stroke, d.strokeA).strokeCircle(c, c, d.r);
    g.generateTexture(key, size, size);
    g.destroy();
  }
  return key;
}

/** 一組固定位置編號的圓底圖片（第 i 顆按鈕用第 i 張），每幀呼叫 show 換顏色／位置 */
export class DiscLayer {
  private imgs: Phaser.GameObjects.Image[] = [];
  constructor(private readonly scene: Phaser.Scene, private readonly depth: number) {}

  show(i: number, x: number, y: number, d: DiscStyle): void {
    const key = discTexture(this.scene, d);
    let im = this.imgs[i];
    if (!im) im = this.imgs[i] = this.scene.add.image(x, y, key).setDepth(this.depth);
    else if (im.texture.key !== key) im.setTexture(key);
    im.setPosition(x, y);
  }
}
