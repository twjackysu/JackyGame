// 夜光寶箱（D-108）：只在深夜打得開。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { validateStage } from '../src/core/battle/rt/maps/validate';

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
});
afterAll(() => {
  delete STAGES.mistwood;
});

describe('夜光寶箱（D-108）', () => {
  it('白天站上去打不開；深夜打得開、拿到內容；地圖仍 0 問題', () => {
    const st = makeMistwoodStage();
    expect(validateStage(st)).toEqual([]);
    const glow = st.chests!.filter((c) => c.nightOnly);
    expect(glow.length).toBe(2);
    for (const night of [false, true]) {
      const s = createBattle({ stageId: 'mistwood', seed: 1, night });
      expect(!!s.night).toBe(night);
      for (const c of glow) {
        const p = s.units[0]!;
        p.x = c.x;
        p.y = c.y + 50;
        const crystal0 = s.loot?.crystal ?? 0;
        step(s, []);
        expect(!!s.chestsOpened?.includes(c.id)).toBe(night);
        if (night) expect(s.loot!.crystal ?? 0).toBe(crystal0 + (c.loot.crystal ?? 0));
      }
    }
  });
});
