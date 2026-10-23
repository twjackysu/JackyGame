import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, pick, randInt } from '../src/core/rng';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('matches known reference values', () => {
    const r = mulberry32(1);
    expect(r()).toBeCloseTo(0.6270739405881613, 12);
    expect(r()).toBeCloseTo(0.002735721180215478, 12);
  });

  it('differs for different seeds and stays in [0,1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toEqual(b());
    const r = mulberry32(123);
    for (let i = 0; i < 10_000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt covers the inclusive range', () => {
    const r = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randInt(r, 1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('pick throws on empty arrays and hashSeed is stable', () => {
    expect(() => pick(mulberry32(1), [])).toThrow();
    expect(hashSeed('starfall')).toBe(hashSeed('starfall'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});
