// 金幣飛進錢包（第 151 輪）：拍賣所「你的掛單賣掉了」時，幾枚金幣從通知字飛到上面的金幣數字。純畫面。
import Phaser from 'phaser';
import { getSettings } from '../settings';

/** 金幣數量：照賺到的錢，3～10 枚（低特效模式減半） */
export function coinCount(gain: number): number {
  const n = Math.max(3, Math.min(10, Math.round(Math.log10(Math.max(1, gain)) * 3)));
  return n;
}

/**
 * 從 from 飛到 to；每枚走一段弧線、到了閃一下。回傳建立的物件（面板關掉時呼叫者要收掉，D-254）。
 * depth 用 995（面板 960 之上、跟通知字同層）。
 */
export function coinFly(scene: Phaser.Scene, from: { x: number; y: number }, to: { x: number; y: number }, gain: number): Phaser.GameObjects.GameObject[] {
  const made: Phaser.GameObjects.GameObject[] = [];
  const n = getSettings().lowFx ? Math.ceil(coinCount(gain) / 2) : coinCount(gain);
  for (let i = 0; i < n; i++) {
    const c = scene.add.container(from.x + (i - (n - 1) / 2) * 30, from.y).setDepth(995).setAlpha(0);
    const g = scene.add.graphics();
    g.fillStyle(0xffd27a, 0.25).fillCircle(0, 0, 24);
    g.fillStyle(0xb8862a, 1).fillCircle(0, 0, 15);
    g.fillStyle(0xffe08a, 1).fillCircle(-1.5, -1.5, 12.5);
    g.fillStyle(0xfff6d0, 0.9).fillCircle(-5, -5, 4);
    c.add(g);
    made.push(c);
    const start = { x: c.x, y: c.y };
    const side = (i % 2 ? 1 : -1) * (60 + (i * 23) % 70);
    const o = { t: 0 };
    scene.tweens.add({ targets: c, alpha: 1, duration: 120, delay: 200 + i * 70 });
    scene.tweens.add({
      targets: o,
      t: 1,
      delay: 200 + i * 70,
      duration: 620,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        // 二次貝茲：往旁邊鼓出去再收進錢包
        const u = o.t;
        const mx = (start.x + to.x) / 2 + side;
        const my = Math.min(start.y, to.y) + (Math.abs(start.y - to.y) * 0.35);
        c.x = (1 - u) * (1 - u) * start.x + 2 * (1 - u) * u * mx + u * u * to.x;
        c.y = (1 - u) * (1 - u) * start.y + 2 * (1 - u) * u * my + u * u * to.y;
        c.setScale(1 - 0.35 * u);
      },
      onComplete: () => {
        if (!c.active) return;
        const ring = scene.add.graphics().setDepth(995).setBlendMode(Phaser.BlendModes.ADD);
        made.push(ring);
        const r = { v: 4, a: 0.9 };
        scene.tweens.add({ targets: r, v: 36, a: 0, duration: 260, onUpdate: () => ring.clear().lineStyle(3, 0xffe08a, r.a).strokeCircle(to.x, to.y, r.v), onComplete: () => ring.destroy() });
        c.destroy();
      },
    });
  }
  return made;
}
