// 位移招的殘影與閃現（第 151 輪 Q5 拆場景，從 RtBattleScene 原封不動搬出來，純畫面）：
// - 劍／弓的位移招（衝鋒、流星衝、後躍、影步…）衝刺中每 45ms 留一個分身（第 26／71 輪）
// - 法杖的閃現：起點紫光消失、路上星屑、終點白紫閃光出現（第 34 輪）
import Phaser from 'phaser';
import { skillDef } from '../../core/battle/rt/engine';
import type { BattleState, Unit } from '../../core/battle/rt/types';
import { shockRing, sparks } from './feel';

export class DashFx {
  private ghostAt = 0;

  constructor(
    private readonly sc: Phaser.Scene,
    private readonly s: () => BattleState,
  ) {}

  /** 重開一場：殘影計時歸零（閃現的記號照舊留著，跟搬之前一樣） */
  reset(): void {
    this.ghostAt = 0;
  }

  /** 影步（變化二）殘影（第 26 輪）：衝刺中每 45ms 在原地留一個紫色分身，0.35 秒淡出 */
  shadowGhost(p: Unit, sp: Phaser.GameObjects.Image, now: number): void {
    const a = p.action;
    if (!a || a.kind !== 'skill' || now - this.ghostAt < 45) return;
    const sk = skillDef(this.s(), a.id);
    if (!sk?.dash || this.s().weapon === 'staff') return;
    // 第 71 輪：所有劍／弓的位移招（衝鋒、流星衝、後躍…）都留殘影；以前只有影步，衝鋒凍結看只有腳下三條細線
    const k = this.s().tick - a.start;
    if (k < sk.dash.fromTick || k > sk.dash.fromTick + sk.dash.ticks) return;
    const weak = sk.hits.some((h) => h.status?.id === 'weak');
    this.ghostAt = now;
    const gh = this.sc.add.image(sp.x, sp.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(sp.scaleX, sp.scaleY).setFlipX(sp.flipX).setDepth(sp.depth - 0.5).setTint(weak ? 0x7a4aff : this.s().weapon === 'bow' ? 0x8ad870 : 0x5ab0ff).setAlpha(weak ? 0.5 : 0.42);
    if (!weak) gh.setBlendMode(Phaser.BlendModes.ADD);
    this.sc.tweens.add({ targets: gh, alpha: 0, scaleX: sp.scaleX * 1.08, duration: 350, ease: 'Cubic.easeOut', onComplete: () => gh.destroy() });
  }

  /** 法杖的閃現類位移（第 34 輪）：起點一圈紫光「消失」、路上星屑、終點白紫閃光「出現」（純畫面） */
  private blinkMark = '';
  blinkFx(p: Unit, sp: Phaser.GameObjects.Image): void {
    const a = p.action;
    const cx = sp.x;
    const cy = sp.y - sp.displayHeight * 0.4;
    const appear = (): void => {
      const fl = this.sc.add.circle(cx, cy, 20, 0xffffff, 0.85).setDepth(sp.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
      this.sc.tweens.add({ targets: fl, scale: 3, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => fl.destroy() });
      shockRing(this.sc, cx, cy, 0xffffff, 60, 200, 4);
    };
    // 畫面幀數低、跳過位移結束那一幀時：動作結束就補「出現」
    if (this.blinkMark.endsWith(':s') && (!a || `${a.start}:s` !== this.blinkMark)) {
      this.blinkMark = this.blinkMark.replace(':s', ':e');
      appear();
    }
    if (!a || a.kind !== 'skill') return;
    const d = skillDef(this.s(), a.id)?.dash;
    if (!d) return;
    const k = this.s().tick - a.start;
    if (k >= d.fromTick && this.blinkMark !== `${a.start}:s`) {
      if (this.blinkMark === `${a.start}:e`) return;
      this.blinkMark = `${a.start}:s`;
      shockRing(this.sc, cx, cy, 0xc89aff, 70, 240, 6);
      sparks(this.sc, cx, cy, 14, 'spark', 0xe0c8ff, 420);
      const fl = this.sc.add.circle(cx, cy, 46, 0xd8c0ff, 0.6).setDepth(sp.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
      this.sc.tweens.add({ targets: fl, scale: 0.2, alpha: 0, duration: 220, onComplete: () => fl.destroy() });
      return;
    }
    if (k > d.fromTick && k < d.fromTick + d.ticks) sparks(this.sc, cx, cy, 2, 'spark', 0xc89aff, 260);
    if (k >= d.fromTick + d.ticks && this.blinkMark === `${a.start}:s`) {
      this.blinkMark = `${a.start}:e`;
      appear();
    }
  }
}
