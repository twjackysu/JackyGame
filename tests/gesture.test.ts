import { describe, expect, it } from 'vitest';
import { GestureTracker } from '../src/core/input/gesture';

describe('GestureTracker', () => {
  it('detects tap with press timestamp', () => {
    const g = new GestureTracker();
    g.pointerDown(1000, 10, 10);
    expect(g.pointerUp(1080, 12, 11)).toEqual([{ kind: 'tap', at: 1000, x: 10, y: 10 }]);
  });

  it('detects swipe on move, timestamped at swipe start', () => {
    const g = new GestureTracker();
    g.pointerDown(0, 100, 100);
    expect(g.pointerMove(50, 120, 100)).toEqual([]);
    const out = g.pointerMove(90, 160, 110);
    expect(out[0]).toMatchObject({ kind: 'swipe', at: 0, dir: 'right' });
    expect(g.pointerUp(120, 200, 110)).toEqual([]);
  });

  it('slow drag is not a swipe', () => {
    const g = new GestureTracker();
    g.pointerDown(0, 0, 0);
    expect(g.pointerMove(200, 10, 0)).toEqual([]);
    const out = g.pointerMove(400, 100, 0); // 超過 300ms 才移動夠遠 → 已成為長按
    expect(out.map((x) => x.kind)).toEqual(['holdStart']);
  });

  it('detects hold start via update and hold end on release', () => {
    const g = new GestureTracker();
    g.pointerDown(0, 5, 5);
    expect(g.update(200)).toEqual([]);
    expect(g.update(360)).toEqual([{ kind: 'holdStart', at: 0, x: 5, y: 5 }]);
    expect(g.isHolding).toBe(true);
    expect(g.pointerUp(900, 5, 5)).toEqual([{ kind: 'holdEnd', at: 900, startedAt: 0, x: 5, y: 5 }]);
  });

  it('emits hold pair on release when update was never called', () => {
    const g = new GestureTracker();
    g.pointerDown(0, 0, 0);
    expect(g.pointerUp(500, 0, 0).map((x) => x.kind)).toEqual(['holdStart', 'holdEnd']);
  });

  it('swipe direction vertical', () => {
    const g = new GestureTracker();
    g.pointerDown(0, 0, 0);
    expect(g.pointerUp(100, 5, -80)[0]).toMatchObject({ kind: 'swipe', dir: 'up' });
  });
});
