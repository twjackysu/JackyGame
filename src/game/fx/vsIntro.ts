// 競技場開場的 VS 演出（第 153 輪）：對手的橫幅從右邊滑進來（上）、你的從左邊（下），中間大大的「VS」砸下來＋光圈火花。
// 純外觀；時間到自己淡出銷毀（場景關掉時 Phaser 會一起收）。
import Phaser from 'phaser';
import { TITLE_FONT, UI_FONT, shockRing, sparks } from './feel';

export interface VsSide {
  name: string;
  /** 第二行（武器・段位 分） */
  sub: string;
  color: number;
}

const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export function vsIntro(scene: Phaser.Scene, cx: number, cy: number, me: VsSide, foe: VsSide, holdMs: number): void {
  const W = scene.scale.width;
  const made: Phaser.GameObjects.GameObject[] = [];
  const banner = (side: VsSide, y: number, fromRight: boolean): void => {
    const c = scene.add.container(fromRight ? W + 400 : -400, y).setDepth(82);
    const g = scene.add.graphics();
    const bw = W - 80;
    // 斜切的橫幅：深底＋隊伍色的邊與光條
    const sk = 26;
    g.fillStyle(0x0a0d1a, 0.92).fillPoints([new Phaser.Math.Vector2(-bw / 2 + sk, -48), new Phaser.Math.Vector2(bw / 2, -48), new Phaser.Math.Vector2(bw / 2 - sk, 48), new Phaser.Math.Vector2(-bw / 2, 48)], true);
    g.fillStyle(side.color, 0.28).fillPoints([new Phaser.Math.Vector2(-bw / 2 + sk, -48), new Phaser.Math.Vector2(bw / 2, -48), new Phaser.Math.Vector2(bw / 2 - 6, -30), new Phaser.Math.Vector2(-bw / 2 + sk - 6, -30)], true);
    g.lineStyle(3, side.color, 0.9).strokePoints([new Phaser.Math.Vector2(-bw / 2 + sk, -48), new Phaser.Math.Vector2(bw / 2, -48), new Phaser.Math.Vector2(bw / 2 - sk, 48), new Phaser.Math.Vector2(-bw / 2, 48)], true);
    c.add(g);
    c.add(scene.add.text(0, -8, side.name, { fontFamily: TITLE_FONT, fontSize: '40px', color: '#ffffff', stroke: css(side.color), strokeThickness: 3 }).setOrigin(0.5));
    c.add(scene.add.text(0, 30, side.sub, { fontFamily: UI_FONT, fontSize: '22px', color: '#d8e0f0' }).setOrigin(0.5));
    made.push(c);
    scene.tweens.add({ targets: c, x: W / 2, duration: 320, ease: 'Back.Out', delay: fromRight ? 0 : 90 });
  };
  banner(foe, cy - 120, true);
  banner(me, cy + 120, false);
  const vs = scene.add.text(cx, cy, 'VS', { fontFamily: TITLE_FONT, fontSize: '96px', fontStyle: '700', color: '#ffd27a', stroke: '#3a2208', strokeThickness: 10 }).setOrigin(0.5).setDepth(83).setScale(2.6).setAlpha(0);
  made.push(vs);
  scene.tweens.add({
    targets: vs,
    scale: 1,
    alpha: 1,
    duration: 260,
    delay: 300,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      if (!vs.active) return;
      shockRing(scene, cx, cy, 0xffd27a, 220, 520, 8);
      sparks(scene, cx, cy, 24, 'spark', 0xffe0a0, 520);
      scene.cameras.main.shake(140, 0.006);
    },
  });
  scene.time.delayedCall(holdMs, () => {
    for (const o of made) if (o.active) scene.tweens.add({ targets: o, alpha: 0, duration: 200, onComplete: () => o.destroy() });
  });
}
