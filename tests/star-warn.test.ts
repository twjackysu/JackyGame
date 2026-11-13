import { describe, expect, it } from 'vitest';
import { STAR_WARN, rimTicks, starFall } from '../src/game/fx/starWarn';

describe('墜星預告的長相（第 198 輪）', () => {
  it('整段預告都看得到星星：一開始就有位置和亮度，越接近落地越近越亮', () => {
    const a = starFall(0);
    expect(a.f).toBeGreaterThan(0);
    expect(a.a).toBeGreaterThanOrEqual(0.5);
    let prev = a;
    for (const p of [0.25, 0.5, 0.75, 1]) {
      const q = starFall(p);
      expect(q.f).toBeGreaterThan(prev.f);
      expect(q.a).toBeGreaterThan(prev.a);
      prev = q;
    }
    expect(starFall(1)).toEqual({ f: 1, a: 1 });
    expect(starFall(-3)).toEqual(starFall(0));
    expect(starFall(9)).toEqual(starFall(1));
  });

  it('外圍的刻度往圓心收：一輪裡越來越靠近圈邊、越來越實，始終在圈外', () => {
    const t0 = rimTicks(0, 0.5);
    const t1 = rimTicks(STAR_WARN.tickMs * 0.5, 0.5);
    const t2 = rimTicks(STAR_WARN.tickMs * 0.99, 0.5);
    expect(t0).toHaveLength(STAR_WARN.ticks);
    expect(t0[0]!.k).toBeCloseTo(STAR_WARN.tickFrom);
    expect(t1[0]!.k).toBeLessThan(t0[0]!.k);
    expect(t2[0]!.k).toBeLessThan(t1[0]!.k);
    expect(t2[0]!.k).toBeGreaterThan(1);
    expect(t2[0]!.a).toBeGreaterThan(t0[0]!.a);
    // 角度平均分散、彼此不同
    expect(new Set(t0.map((q) => q.ang.toFixed(3))).size).toBe(STAR_WARN.ticks);
    // 預告剛出現時也看得到
    expect(Math.min(...rimTicks(0, 0).map((q) => q.a))).toBeGreaterThan(0.15);
  });
});
