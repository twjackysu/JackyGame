import { describe, expect, it } from 'vitest';
import { ICE_CASE, iceShards, thawBlink } from '../src/game/fx/iceCase';

describe('被冰住的怪的長相（第 199 輪）', () => {
  it('同一隻怪每一幀的冰晶都一樣；不同的怪不一樣', () => {
    expect(iceShards(7)).toEqual(iceShards(7));
    expect(iceShards(7)).not.toEqual(iceShards(8));
  });

  it('兩側的冰晶高、正前方的矮：不擋住怪的身體', () => {
    for (const id of [1, 12, 99]) {
      const sh = iceShards(id);
      const front = sh.filter((q) => Math.abs(q.x) < 0.5);
      const sides = sh.filter((q) => Math.abs(q.x) > 1);
      expect(front.length).toBeGreaterThan(0);
      expect(sides.length).toBeGreaterThanOrEqual(2);
      expect(Math.max(...front.map((q) => q.h))).toBeLessThan(1);
      expect(Math.min(...sides.map((q) => q.h))).toBeGreaterThan(1.2);
    }
  });

  it('由後往前排（後面的先畫）', () => {
    const sh = iceShards(3);
    for (let i = 1; i < sh.length; i++) expect(sh[i]!.y).toBeGreaterThanOrEqual(sh[i - 1]!.y);
  });

  it('快解凍才閃；閃的時候也不會完全消失', () => {
    expect(thawBlink(ICE_CASE.thawTicks, 0)).toBe(1);
    expect(thawBlink(60, 70)).toBe(1);
    const seen = new Set([0, 70, 140, 210].map((t) => thawBlink(5, t)));
    expect(seen.size).toBe(2);
    expect(Math.min(...seen)).toBeGreaterThan(0.2);
  });
});
