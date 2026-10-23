import Phaser from 'phaser';

/**
 * Generates every texture procedurally (no image assets), then starts the title.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeGlowDot('ember', 32, [0xffffff, 0xffe2a8, 0xffa54a, 0xff5a1f]);
    this.makeGlowDot('spark', 16, [0xffffff, 0xcfe8ff, 0x7fb6ff]);
    this.makeGlowDot('glow', 256, [0xffd9a0, 0xff9a4a, 0x8a3cff], 0.55);
    this.makeStar('star', 4);
    this.makeShard('shard', 18, 48);
    // 除錯入口（06 §7）：?scene=Battle&enc=boss_wolfking
    const q = new URLSearchParams(window.location.search);
    if (q.get('scene') === 'Battle') this.scene.start('Battle');
    else if (q.get('scene') === 'Dialogue') this.scene.start('Dialogue', { script: q.get('script') ?? 'ch0', node: q.get('node') ?? undefined });
    else this.scene.start('Title');
  }

  /** Soft radial dot built from concentric translucent circles. */
  private makeGlowDot(key: string, size: number, ramp: number[], maxAlpha = 1): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const r = size / 2;
    const steps = Math.max(8, Math.floor(r));
    for (let i = steps; i >= 1; i--) {
      const f = i / steps; // 1 = outer, 0 = center
      const idx = Math.min(ramp.length - 1, Math.floor((1 - f) * ramp.length));
      const color = ramp[ramp.length - 1 - idx] ?? 0xffffff;
      g.fillStyle(color, maxAlpha * (1 - f) ** 1.6 * 0.35 + 0.02);
      g.fillCircle(r, r, r * f);
    }
    g.fillStyle(ramp[0] ?? 0xffffff, maxAlpha);
    g.fillCircle(r, r, Math.max(1, r * 0.12));
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeStar(key: string, size: number): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  /** A thin diamond shard used for the sigil behind the title. */
  private makeShard(key: string, w: number, h: number): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xfff0c8, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(w / 2, 0),
        new Phaser.Math.Vector2(w, h / 2),
        new Phaser.Math.Vector2(w / 2, h),
        new Phaser.Math.Vector2(0, h / 2),
      ],
      true,
    );
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
