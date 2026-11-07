// Boss 大招與熔岩口的「演出」（第 153 輪 Q5，從 RtBattleScene.playEvents 照搬）：只有畫面與聲音，判定在引擎。
// 座標是畫面座標；k＝世界單位轉畫面的倍率（場景的 this.k）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { GAME_WIDTH } from '../config';
import { bigText, shockRing, sparks } from './feel';

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
export function ventEruptCue(scene: Phaser.Scene, x: number, y: number, r: number): void {
  sparks(scene, x, y, 22, 'ember', 0xff8a3a, 620);
  sparks(scene, x, y - 20, 10, 'spark', 0xffe0a0, 820);
  shockRing(scene, x, y, 0xff7a2a, r * 1.25, 380, 8);
  const col = scene.add.rectangle(x, y, r * 0.9, r * 3.2, 0xffa040, 0.55).setOrigin(0.5, 1).setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: col, scaleX: 0.2, alpha: 0, duration: 420, ease: 'Cubic.easeIn', onComplete: () => col.destroy() });
}
