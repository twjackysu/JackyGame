import { describe, expect, it } from 'vitest';
import { PEEK_IN, PEEK_HOLD, PEEK_TOTAL, peekFocus, peekWeight, peekBlocked } from '../src/game/cameraPeek';

describe('鏡頭看一眼（D-219）', () => {
  it('前後平滑、中間停住、結束歸零', () => {
    expect(peekWeight(0)).toBe(0);
    expect(peekWeight(-5)).toBe(0);
    expect(peekWeight(PEEK_IN / 2)).toBeCloseTo(0.5);
    expect(peekWeight(PEEK_IN + PEEK_HOLD / 2)).toBe(1);
    expect(peekWeight(PEEK_TOTAL)).toBe(0);
    let prev = 0;
    for (let t = 0; t <= PEEK_IN; t += 50) { const w = peekWeight(t); expect(w).toBeGreaterThanOrEqual(prev); prev = w; }
    for (let t = PEEK_IN + PEEK_HOLD; t < PEEK_TOTAL; t += 50) { const w = peekWeight(t); expect(w).toBeLessThanOrEqual(prev + 1e-9); prev = w; }
  });
  it('焦點落在主角和目標之間', () => {
    expect(peekFocus(0, 1000, 0, 0, 0)).toEqual({ x: 0, y: 1000 });
    const f = peekFocus(0, 1000, 0, 0, 1);
    expect(f.y).toBeCloseTo(300);
  });
});

describe('peekBlocked（D-220）', () => {
  it('身邊有交戰中的敵人才擋；死的、巡邏中的、遠的不算', () => {
    expect(peekBlocked([], 0, 0, 900)).toBe(false);
    expect(peekBlocked([{ x: 300, y: 0, mode: 'combat' }], 0, 0, 900)).toBe(true);
    expect(peekBlocked([{ x: 300, y: 0, mode: 'combat', dead: true }], 0, 0, 900)).toBe(false);
    expect(peekBlocked([{ x: 300, y: 0, mode: 'patrol' }], 0, 0, 900)).toBe(false);
    expect(peekBlocked([{ x: 1300, y: 0, mode: 'combat' }], 0, 0, 900)).toBe(false);
  });
});
