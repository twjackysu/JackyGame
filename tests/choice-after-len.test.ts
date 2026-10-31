import { describe, expect, it } from 'vitest';
import { BOSS_CHOICES } from '../src/game/choices';
import { ENCOUNTERS } from '../src/game/encounters';

// D-209：抉擇結語排成一行（26px），超過 22 字在 720 寬放不下、變 3 行就會在 360×640 蓋住主角
describe('抉擇結語長度', () => {
  it('每句 after ≤ 22 字', () => {
    for (const c of BOSS_CHOICES) for (const k of ['take', 'spare'] as const) expect([...c[k].after].length, `${c.map}.${k}`).toBeLessThanOrEqual(22);
  });
  // D-210：路上的相遇選完的結語也排成一行
  it('相遇的 after ≤ 22 字、後果一行 ≤ 26 字', () => {
    for (const e of ENCOUNTERS) for (const k of ['take', 'spare'] as const) expect([...e[k].after].length, `${e.id}.${k}`).toBeLessThanOrEqual(22);
    for (const e of ENCOUNTERS) if (e.escort) expect([...`（她會跟在你身後——帶她到${e.escort.place}）`].length, e.id).toBeLessThanOrEqual(26);
  });
});
