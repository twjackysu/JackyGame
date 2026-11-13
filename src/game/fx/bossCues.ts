// Boss 大招與熔岩口的「演出」（第 153 輪 Q5，從 RtBattleScene.playEvents 照搬）：只有畫面與聲音，判定在引擎。
// 座標是畫面座標；k＝世界單位轉畫面的倍率（場景的 this.k）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { GAME_WIDTH } from '../config';
import { bigText, shockRing, sparks } from './feel';
import { softGlowKey, softPillarKey } from './levelUp';
import { VENT_COLUMN_DEPTH, ventLayers } from './ventColumn';
import { getSettings } from '../settings';

/** 暴怒岩王的熔心爆發（第 26 輪）：胸口熔心亮起＋大圈警告＋震畫面＋大字（at＝岩王在畫面上的位置；不在了就只有震動與大字） */
export function coreBurstCue(scene: Phaser.Scene, at: { x: number; y: number } | null, k: number): void {
  if (at) {
    shockRing(scene, at.x, at.y, 0xff8a3a, 5.2 * 100 * k, 1100, 8);
    sparks(scene, at.x, at.y - 60, 30, 'ember', 0xffb36a, 900);
  }
  scene.cameras.main.shake(300, 0.004);
  SFX.warn(true);
  bigText(scene, GAME_WIDTH / 2, 520, '熔心爆發——跑出圈外！', '#ffb36a', 40, 900);
}

/** 荊棘綻放（D-114）：狼后腳下冒出綠色孢子圈 */
export function queenBloomCue(scene: Phaser.Scene, x: number, y: number, k: number): void {
  shockRing(scene, x, y, 0x8adf4a, 3.2 * 100 * k, 900, 6);
  sparks(scene, x, y, 26, 'ember', 0xc8ff8a, 900);
}

/** 熔岩口噴發（D-125）：火星＋衝擊環＋往上衝的火柱（r＝噴發半徑，已乘過 k） */
export function ventEruptCue(scene: Phaser.Scene, x: number, y: number, r: number, topY = 0): void {
  sparks(scene, x, y, 22, 'ember', 0xff8a3a, 620);
  sparks(scene, x, y - 20, 10, 'spark', 0xffe0a0, 820);
  shockRing(scene, x, y, 0xff7a2a, r * 1.25, 380, 8);
  // 第 195 輪：火柱從平色長方形改成柔光三層（先竄高再收細淡掉），畫在 HUD 底下、柱頂不進標題列
  for (const l of ventLayers(r, y, topY, getSettings().lowFx)) {
    const im = scene.add.image(x, y + r * 0.15, softPillarKey(scene)).setOrigin(0.5, 1).setDisplaySize(l.w * 0.6, l.h * 0.35).setTint(l.color).setAlpha(l.alpha).setDepth(VENT_COLUMN_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: im, displayWidth: l.w, displayHeight: l.h, duration: 90, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: im, displayWidth: l.w * 0.25, alpha: 0, delay: 150, duration: l.ms - 150, ease: 'Cubic.easeIn', onComplete: () => im.destroy() });
  }
  // 噴發口上一團暖光（壓扁的柔光）
  const pool = scene.add.image(x, y, softGlowKey(scene)).setDisplaySize(r * 1.4, r * 0.9).setTint(0xffb060).setAlpha(0.8).setDepth(VENT_COLUMN_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: pool, displayWidth: r * 3.2, displayHeight: r * 2.0, alpha: 0, duration: 480, ease: 'Cubic.easeOut', onComplete: () => pool.destroy() });
}
