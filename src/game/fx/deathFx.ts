// 怪物倒下的樣子（第三期 Q1，D-335）：依種類不一樣，不再全部「變白壓扁」。
// 純畫面：只在 death 事件之後播，不影響戰鬥結果（掉落、經驗都在 core／伺服器算完了）。
//   beast 野獸（狼）＝被打的方向倒地、滑一小段、揚塵後淡出
//   plant 植物（菇、母樹）＝枯萎縮下去、變褐、孢子往上飄
//   slime 史萊姆＝鼓起來爆開、液滴拋物線落下、地上留一灘
//   stone 石頭／晶體（魔像、岩王、守望者）＝碎成幾塊飛散落地
import type Phaser from 'phaser';
import { getSettings } from '../settings';

export type DeathKind = 'beast' | 'plant' | 'slime' | 'stone';

const KIND: Readonly<Record<string, DeathKind>> = {
  thorn_shooter: 'plant', thorn_mother: 'plant', ember_shroom: 'plant', star_shroom: 'plant',
  slag_slime: 'slime',
  crystal_golem: 'stone', ember_colossus: 'stone', star_sentinel: 'stone',
};

/** 這種怪倒下用哪一種演出（沒列的都是野獸：目前其他全是狼） */
export function deathKind(defId: string): DeathKind {
  return KIND[defId] ?? 'beast';
}

/** 碎塊／液滴的顏色（沒列的用立繪染色或預設） */
const DEBRIS: Readonly<Record<string, number>> = {
  slag_slime: 0xff8a3a, ember_shroom: 0xffb080, star_shroom: 0xa8b8ff, thorn_shooter: 0xa8e07a, thorn_mother: 0x9aff7a,
  crystal_golem: 0xc8a8ff, ember_colossus: 0xffa050, star_sentinel: 0xc8d8ff,
};

export interface DeathOpts {
  /** 被打飛的方向：>0 往右倒、<0 往左倒 */
  dir: number;
  /** 立繪原本的染色（沒有就不給） */
  tint?: number;
  /** Boss：慢一點、碎塊多一點 */
  boss?: boolean;
}

function puff(
  scene: Phaser.Scene, x: number, y: number, depth: number, n: number, tint: number,
  cfg: { speed: [number, number]; angle: [number, number]; gravityY: number; life: [number, number]; scale: number; add: boolean; tex?: string },
): void {
  const p = scene.add.particles(x, y, cfg.tex ?? 'ember', {
    speed: { min: cfg.speed[0], max: cfg.speed[1] },
    angle: { min: cfg.angle[0], max: cfg.angle[1] },
    gravityY: cfg.gravityY,
    scale: { start: cfg.scale, end: 0 },
    alpha: { start: cfg.add ? 1 : 0.6, end: 0 },
    lifespan: { min: cfg.life[0], max: cfg.life[1] },
    blendMode: cfg.add ? 'ADD' : 'NORMAL',
    tint,
    emitting: false,
  });
  p.setDepth(depth);
  p.explode(getSettings().lowFx ? Math.max(2, Math.round(n * 0.4)) : n);
  scene.time.delayedCall(cfg.life[1] + 100, () => p.destroy());
}

/** 播倒下演出；sp 交給這裡管，播完自己 destroy */
export function playDeath(scene: Phaser.Scene, sp: Phaser.GameObjects.Image, defId: string, o: DeathOpts): void {
  const kind = deathKind(defId);
  const slow = o.boss ? 1.6 : 1;
  const dir = o.dir < 0 ? -1 : 1;
  const col = DEBRIS[defId] ?? o.tint ?? 0xd8d0c0;
  const footY = sp.y;
  const midY = sp.y - sp.displayHeight * 0.45;
  const restore = (): void => { if (o.tint) sp.setTint(o.tint); else sp.clearTint(); };
  scene.tweens.killTweensOf(sp);
  sp.setTintFill(0xffffff); // 先白一下（最後一擊的受擊閃光）
  const done = (): void => { sp.destroy(); };

  if (kind === 'stone') {
    // 碎成 n×n 塊：同一張貼圖切格（每張貼圖只加一次 frame），各自往外飛、落地、淡出
    const n = getSettings().lowFx ? 2 : o.boss ? 4 : 3;
    const f = sp.frame;
    const cw = f.cutWidth / n;
    const ch = f.cutHeight / n;
    const left = sp.x - sp.displayWidth * sp.originX;
    const top = sp.y - sp.displayHeight * sp.originY;
    const sx = sp.scaleX;
    const sy = sp.scaleY;
    scene.time.delayedCall(70, () => {
      if (!sp.scene) return;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const name = `shard${n}_${i}_${j}`;
        if (!sp.texture.has(name)) sp.texture.add(name, f.sourceIndex, f.cutX + i * cw, f.cutY + j * ch, cw, ch);
        const col0 = sp.flipX ? n - 1 - i : i;
        const x0 = left + (col0 + 0.5) * cw * sx;
        const y0 = top + (j + 0.5) * ch * sy;
        const im = scene.add.image(x0, y0, sp.texture.key, name).setScale(sx, sy).setFlipX(sp.flipX).setDepth(sp.depth);
        if (o.tint) im.setTint(o.tint);
        // 往外＋被打的方向；上排飛得高
        const vx = ((col0 + 0.5) / n - 0.5) * 260 + dir * 90 + (((i * 7 + j * 13) % 5) - 2) * 14;
        const vy = -180 - (n - 1 - j) * 70 - ((i * 5 + j * 3) % 4) * 22;
        const spin = (((i * 3 + j * 5) % 7) - 3) * 60;
        const land = footY - ch * sy * 0.3;
        const t = { v: 0 };
        scene.tweens.add({
          targets: t, v: 1, duration: 620 * slow,
          onUpdate: () => {
            const s = t.v * 0.62 * slow;
            im.setPosition(x0 + vx * s, Math.min(land, y0 + vy * s + 900 * s * s)).setAngle(spin * t.v).setAlpha(t.v < 0.6 ? 1 : 1 - (t.v - 0.6) / 0.4);
          },
          onComplete: () => im.destroy(),
        });
      }
      puff(scene, sp.x, midY, sp.depth + 1, o.boss ? 22 : 12, col, { speed: [80, 300], angle: [0, 360], gravityY: 300, life: [260, 620], scale: 0.9, add: true, tex: 'spark' });
      done();
    });
    return;
  }

  if (kind === 'slime') {
    // 鼓起來 → 爆開
    scene.tweens.add({
      targets: sp, scaleX: sp.scaleX * 1.4, scaleY: sp.scaleY * 1.25, duration: 100 * slow, ease: 'Quad.Out',
      onComplete: () => {
        puff(scene, sp.x, midY, sp.depth + 1, 16, col, { speed: [140, 380], angle: [-165, -15], gravityY: 950, life: [380, 700], scale: 0.85, add: true });
        const g = scene.add.graphics().setDepth(sp.depth - 1).setPosition(sp.x, footY);
        g.fillStyle(col, 0.32).fillEllipse(0, 0, sp.displayWidth * 0.8, sp.displayWidth * 0.26);
        g.setScale(0.3);
        scene.tweens.add({ targets: g, scale: 1, duration: 160, ease: 'Cubic.Out' });
        scene.tweens.add({ targets: g, alpha: 0, delay: 500, duration: 700, onComplete: () => g.destroy() });
        done();
      },
    });
    return;
  }

  if (kind === 'plant') {
    // 枯萎：變褐、往下縮；孢子往上飄
    scene.time.delayedCall(70, () => { if (sp.scene) sp.setTint(0x8a7448); });
    puff(scene, sp.x, midY, sp.depth + 1, 10, col, { speed: [20, 90], angle: [-150, -30], gravityY: -60, life: [500, 1000], scale: 0.55, add: true });
    scene.tweens.add({ targets: sp, scaleY: sp.scaleY * 0.3, scaleX: sp.scaleX * 1.08, duration: 360 * slow, ease: 'Quad.In' });
    scene.tweens.add({ targets: sp, alpha: 0, delay: 330 * slow, duration: 220, onComplete: done });
    return;
  }

  // 野獸：朝被打的方向倒下（立繪原點在腳底，所以是繞著腳倒）、滑一小段、揚塵
  scene.time.delayedCall(70, () => { if (sp.scene) restore(); });
  scene.tweens.add({ targets: sp, angle: dir * 84, x: sp.x + dir * 22, duration: 240 * slow, ease: 'Quad.In' });
  scene.time.delayedCall(230 * slow, () => {
    if (sp.scene) puff(scene, sp.x + dir * sp.displayHeight * 0.4, footY, sp.depth - 1, 7, 0xb8b0a0, { speed: [20, 80], angle: [-170, -10], gravityY: -20, life: [300, 560], scale: 0.7, add: false });
  });
  scene.tweens.add({ targets: sp, alpha: 0, delay: 300 * slow, duration: 320, onComplete: done });
}
