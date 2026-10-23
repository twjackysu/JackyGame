import Phaser from 'phaser';
import { applyEffects } from '../../core/state/gameState';
import { CHAPTER_MAPS } from '../../data/maps';
import { session } from '../session';

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
    // ?chapter=2：直接以「第 1 章已完成」的新存檔開始（測試第 2 章用）
    if (['2', '3', '4', '5'].includes(q.get('chapter') ?? '')) {
      const s = session.newGame();
      for (const f of Object.values(CHAPTER_MAPS.ch1.done)) s.flags[f] = true;
      Object.assign(s.flags, { wick_lake: true, wick_hunter: true, wick_shrine: true, io_named: true });
      applyEffects(s, [{ join: 'io' }]);
      // &join=serin,liora：額外加入同伴（測試隊伍編成）
      for (const id of (q.get('join') ?? '').split(',').filter(Boolean)) applyEffects(s, [{ join: id as 'serin' }]);
      for (const m of Object.values(s.members)) if (m) m.level = Math.max(m.level, 5);
      s.location = { region: 'ch2', node: 'greylamp_plaza' };
      // ?chapter=3：再加上「第 2 章已完成」（瑟琳、莉歐拉在隊，Lv9）
      if (['3', '4', '5'].includes(q.get('chapter') ?? '')) {
        for (const f of Object.values(CHAPTER_MAPS.ch2.done)) s.flags[f] = true;
        Object.assign(s.flags, { serin_stayed: true, serin_told_future: true, bond_serin_1: true, bond_liora_1: true });
        applyEffects(s, [{ join: 'serin' }, { join: 'liora' }]);
        for (const m of Object.values(s.members)) if (m) m.level = Math.max(m.level, 9);
        s.gold += 120;
        s.location = { region: 'ch3', node: 'capital_gate' };
      }
      // ?chapter=4：再加上「第 3 章已完成」（臥底路線、洛克倒戈、伊歐被帶走）
      if (['4', '5'].includes(q.get('chapter') ?? '')) {
        for (const f of Object.values(CHAPTER_MAPS.ch3.done)) s.flags[f] = true;
        Object.assign(s.flags, { double_agent: true, rourke_turned: true, io_taken: true, tourney_champion: true });
        applyEffects(s, [{ join: 'rourke' }, { leave: 'io' }]);
        for (const m of Object.values(s.members)) if (m) m.level = Math.max(m.level, 13);
        s.location = { region: 'ch4', node: 'academy_entrance' };
      }
      // ?chapter=5：再加上「第 4 章已完成」（伊歐救回、星核熄滅）
      if (q.get('chapter') === '5') {
        for (const f of Object.values(CHAPTER_MAPS.ch4.done)) s.flags[f] = true;
        Object.assign(s.flags, { io_rescued: true, core_sealed: true, research_destroyed: true, tia_rescued: true, rift_open: true });
        applyEffects(s, [{ join: 'io' }, { divergence: 50 }, { affinity: 'io', delta: 55 }, { affinity: 'serin', delta: 50 }]);
        for (const m of Object.values(s.members)) if (m) m.level = Math.max(m.level, 16);
        s.location = { region: 'ch5', node: 'rift_edge' };
      }
      session.save();
    }
    if (q.get('scene') === 'Battle') this.scene.start('Battle');
    else if (q.get('scene') === 'Map') this.scene.start('Map');
    else if (q.get('scene') === 'Cards') this.scene.start('Cards', { match: q.get('match') ?? 'demo' });
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
