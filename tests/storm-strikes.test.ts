import { describe, expect, it } from 'vitest';
import { stormStrikes } from '../src/game/fx/hitTint';

// 第 178 輪：雷暴的閃電先劈圈裡的怪，沒有怪才落在空地（純畫面）
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]!; };

describe('雷暴的落點', () => {
  it('圈裡有怪就劈在怪身上', () => {
    const foes = [{ x: 200, y: 0 }, { x: 0, y: 150 }, { x: 900, y: 0 }];
    const m = stormStrikes(0, 0, 260, foes, 2, seq(0));
    expect(m).toEqual([{ x: 200, y: 0, on: true }, { x: 0, y: 150, on: true }]);
  });
  it('圈外的怪不劈；不夠的用圈內的空地補滿', () => {
    const m = stormStrikes(0, 0, 260, [{ x: 100, y: 0 }, { x: 900, y: 0 }], 2, seq(0.5));
    expect(m).toHaveLength(2);
    expect(m[0]).toEqual({ x: 100, y: 0, on: true });
    expect(m[1]!.on).toBe(false);
    expect(Math.hypot(m[1]!.x, m[1]!.y)).toBeLessThanOrEqual(260);
  });
  it('怪比閃電多時，每一波從不同的怪開始輪', () => {
    const foes = [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }];
    const a = stormStrikes(0, 0, 260, foes, 2, seq(0));
    const b = stormStrikes(0, 0, 260, foes, 2, seq(0.99));
    expect(a.map((q) => q.x)).toEqual([10, 20]);
    expect(b.map((q) => q.x)).toEqual([30, 10]);
  });
  it('大隻的怪身體碰到圈就算（和核心的圓形判定一致）', () => {
    expect(stormStrikes(0, 0, 260, [{ x: 300, y: 0, r: 60 }], 1, seq(0))[0]!.on).toBe(true);
    expect(stormStrikes(0, 0, 260, [{ x: 300, y: 0, r: 20 }], 1, seq(0))[0]!.on).toBe(false);
  });
  it('沒有怪：全部落在圈裡的空地', () => {
    const m = stormStrikes(50, 50, 100, [], 2, seq(0.3, 0.7));
    expect(m.every((q) => !q.on && Math.hypot(q.x - 50, q.y - 50) <= 100)).toBe(true);
  });
});
