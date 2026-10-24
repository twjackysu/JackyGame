import { describe, expect, it } from 'vitest';
import { shouldDowngrade } from '../src/game/perf/fpsGuard';

describe('shouldDowngrade', () => {
  it('樣本不足不降', () => expect(shouldDowngrade([20, 20, 20])).toBe(false));
  it('連續 8 秒低於 42 才降', () => {
    expect(shouldDowngrade([60, 60, 30, 30, 30, 30, 30, 30, 30, 30])).toBe(true);
    expect(shouldDowngrade([30, 30, 30, 30, 30, 30, 30, 59])).toBe(false);
  });
  it('0 fps（分頁暫停）不算', () => expect(shouldDowngrade([0, 0, 0, 0, 0, 0, 0, 0])).toBe(false));
});
