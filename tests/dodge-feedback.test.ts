import { describe, expect, it } from 'vitest';
import { dodgeFeedback } from '../src/game/fx/hitTint';

describe('閃過攻擊的回饋分級（純畫面）', () => {
  it('第一下是大的：有大字、有環、有短停頓', () => {
    const f = dodgeFeedback(10_000, false);
    expect(f.big).toBe(true);
    expect(f.ring).toBeGreaterThan(0);
    expect(f.stopMs).toBeGreaterThan(0);
    expect(f.stopMs).toBeLessThanOrEqual(120); // 停太久會卡手
  });
  it('同一次翻滾 0.5 秒內連閃幾下：後面只冒小字、不重複停頓', () => {
    const f = dodgeFeedback(200, true);
    expect(f).toEqual({ big: false, stopMs: 0, ring: 0, flash: false });
  });
  it('Boss 的招比一般怪大；省電畫質不閃全畫面', () => {
    const n = dodgeFeedback(9999, false);
    const b = dodgeFeedback(9999, true);
    expect(b.stopMs).toBeGreaterThan(n.stopMs);
    expect(b.ring).toBeGreaterThan(n.ring);
    expect(n.flash).toBe(false);
    expect(b.flash).toBe(true);
    expect(dodgeFeedback(9999, true, true).flash).toBe(false);
  });
});
