import { describe, expect, it } from 'vitest';
import { FROST_GROUND, frostCracks, frostRimArcs, frostWave } from '../src/game/fx/frostGround';

// 結霜圈的長相（D-412）：純資料——裂紋不出圈、同一個種子畫出同一組、邊緣是斷開的
describe('frostGround', () => {
  it('濃淡：中間最淡、快到邊緣最濃、最外面淡出成柔邊', () => {
    const s = FROST_GROUND.stops;
    expect(s[0]![0]).toBe(0);
    expect(s[s.length - 1]).toEqual([1, 0]);
    for (let i = 1; i < s.length; i++) expect(s[i]![0]).toBeGreaterThan(s[i - 1]![0]);
    const peak = s.reduce((m, q) => (q[1] > m[1] ? q : m));
    expect(peak[0]).toBeGreaterThan(0.8);
    expect(s[0]![1]).toBeLessThan(peak[1] / 4);
  });
  it('霜紋：條數與節數照設定，全部在圈內，離中心越來越遠', () => {
    for (const seed of [1, 7, 12345, 999999]) {
      const lines = frostCracks(seed);
      expect(lines).toHaveLength(FROST_GROUND.cracks);
      for (const l of lines) {
        expect(l).toHaveLength(FROST_GROUND.crackSteps + 1);
        let prev = 0;
        for (const p of l) {
          const d = Math.hypot(p.x, p.y);
          expect(d).toBeLessThan(0.95);
          expect(d).toBeGreaterThan(prev);
          prev = d;
        }
      }
    }
  });
  it('同一個種子畫出同一組（不會每幀亂跳），不同種子不一樣', () => {
    expect(frostCracks(42)).toEqual(frostCracks(42));
    expect(frostRimArcs(42)).toEqual(frostRimArcs(42));
    expect(frostCracks(42)).not.toEqual(frostCracks(43));
  });
  it('邊緣是一段一段的：每段在自己那一格裡、段與段不相連', () => {
    for (const seed of [1, 7, 12345]) {
      const arcs = frostRimArcs(seed);
      const step = (Math.PI * 2) / FROST_GROUND.rimSegs;
      expect(arcs).toHaveLength(FROST_GROUND.rimSegs);
      arcs.forEach(([a0, a1], i) => {
        expect(a1).toBeGreaterThan(a0);
        expect(a0).toBeGreaterThanOrEqual(i * step - 1e-9);
        expect(a1).toBeLessThanOrEqual((i + 1) * step + 1e-9);
        expect(a1 - a0).toBeLessThan(step);
      });
    }
  });
  it('寒氣波：從裡面往外推過結霜圈的邊、越推越淡，時間到就沒了', () => {
    expect(frostWave(-1)).toBeNull();
    expect(frostWave(FROST_GROUND.waveMs)).toBeNull();
    const a = frostWave(0)!;
    const b = frostWave(FROST_GROUND.waveMs / 2)!;
    const c = frostWave(FROST_GROUND.waveMs - 1)!;
    expect(a.r).toBeLessThan(b.r);
    expect(b.r).toBeLessThan(c.r);
    expect(c.r).toBeGreaterThan(1);
    expect(c.r).toBeLessThanOrEqual(FROST_GROUND.waveReach);
    expect(a.a).toBeGreaterThan(b.a);
    expect(c.a).toBeLessThan(0.05);
  });
});
