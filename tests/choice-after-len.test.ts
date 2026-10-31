import { describe, expect, it } from 'vitest';
import { BOSS_CHOICES } from '../src/game/choices';

// D-209：抉擇結語排成一行（26px），超過 22 字在 720 寬放不下、變 3 行就會在 360×640 蓋住主角
describe('抉擇結語長度', () => {
  it('每句 after ≤ 22 字', () => {
    for (const c of BOSS_CHOICES) for (const k of ['take', 'spare'] as const) expect([...c[k].after].length, `${c.map}.${k}`).toBeLessThanOrEqual(22);
  });
});
