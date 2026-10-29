// 幕名卡（第 55 輪，D-187）：第一次踏進每張大地圖，畫面上下滑入電影黑條，中間浮出「第二幕　荊棘谷」＋一句話。
// 純畫面、不擋操作（出生點在營火旁，附近沒有怪）；每張圖只播一次（`jg_chapter_<id>`）。
import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { BANNER_DEPTH, TITLE_FONT, UI_FONT, reserveBanner } from '../fx/feel';
import type { ChapterLabel } from '../chapters';
export { chapterLabel, chapterSeen, markChapterSeen } from '../chapters';

/** 播幕名卡；回傳整段（含淡出）的毫秒數，呼叫端可以等它播完再出地圖說明 */
export function playChapterCard(scene: Phaser.Scene, lab: ChapterLabel, cy: number, barTop: number, barBottom: number): number {
  const W = GAME_WIDTH;
  const hold = 2300;
  const total = 300 + hold + 600;
  reserveBanner(scene, cy, 230, total);
  const col = Phaser.Display.Color.HexStringToColor(lab.color).color;
  const bars = scene.add.graphics().setDepth(BANNER_DEPTH - 2).setScrollFactor(0);
  const barH = 64;
  const prog = { k: 0 };
  // 上黑條從 HUD 下緣長出來、下黑條從畫面底長上來（和 Boss 登場的電影框同一個感覺）
  const drawBars = (): void => {
    bars.clear();
    bars.fillStyle(0x000000, 0.85).fillRect(0, barTop, W, barH * prog.k);
    bars.fillRect(0, barBottom - barH * prog.k, W, barH * prog.k);
  };
  drawBars();
  scene.tweens.add({ targets: prog, k: 1, duration: 300, ease: 'Cubic.easeOut', onUpdate: drawBars });

  const c = scene.add.container(W / 2, cy).setDepth(BANNER_DEPTH + 5).setAlpha(0);
  const glow = scene.add.graphics();
  glow.fillStyle(0x000000, 0.42).fillRect(-W / 2, -110, W, 220);
  for (let i = 0; i < 4; i++) glow.fillStyle(col, 0.05).fillEllipse(0, 0, 520 - i * 90, 150 - i * 26);
  const kick = scene.add.text(0, -66, lab.kicker, { fontFamily: TITLE_FONT, fontSize: '30px', fontStyle: '700', color: '#f4e6c0', stroke: '#140a04', strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(10);
  const name = scene.add.text(0, 2, lab.title, { fontFamily: TITLE_FONT, fontSize: '76px', fontStyle: '900', color: lab.color, stroke: '#140a04', strokeThickness: 10 }).setOrigin(0.5).setLetterSpacing(14);
  name.setShadow(0, 0, lab.color, 18, true, true);
  const rule = scene.add.graphics();
  const line = scene.add.text(0, 76, lab.line, { fontFamily: UI_FONT, fontSize: '24px', color: '#e8ddc8', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setAlpha(0);
  c.add([glow, rule, kick, name, line]);
  const r = { w: 0 };
  scene.tweens.add({
    targets: r, w: 1, delay: 250, duration: 700, ease: 'Cubic.easeOut',
    onUpdate: () => {
      rule.clear();
      rule.fillStyle(col, 0.9).fillRect(-200 * r.w, 46, 400 * r.w, 2);
      rule.fillStyle(0xffffff, 0.9).fillRect(-30 * r.w, 45, 60 * r.w, 4);
    },
  });
  name.setScale(1.25);
  scene.tweens.add({ targets: c, alpha: 1, duration: 420, delay: 120 });
  scene.tweens.add({ targets: name, scale: 1, duration: 900, delay: 120, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: line, alpha: 1, duration: 500, delay: 700 });
  scene.tweens.add({ targets: c, alpha: 0, delay: 300 + hold, duration: 600, onComplete: () => c.destroy() });
  scene.tweens.add({
    targets: prog, k: 0, delay: 300 + hold, duration: 500, ease: 'Cubic.easeIn', onUpdate: drawBars, onComplete: () => bars.destroy(),
  });
  return total;
}
