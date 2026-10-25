// 技能點（D-110）：純資料函式＋效果真的進到戰鬥。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SKILLS, STAGES } from '../src/core/battle/rt/data';
import { createBattle, dashDistance, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { SKILL_MOD_CAPS } from '../src/core/battle/rt/types';
import { SKILL_MAX_RANK, SKILL_TREE, addRank, cleanRanks, mergeMods, rankMods, skillPoints, usedPoints } from '../src/game/rtSkills';

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
});
afterAll(() => {
  delete STAGES.mistwood;
});

describe('技能點（D-110）', () => {
  it('技能都存在；點數＝等級−1；每個最多 5 級；沒點數不能點', () => {
    for (const t of SKILL_TREE) expect(SKILLS[t.id]).toBeDefined();
    expect(skillPoints(1)).toBe(0);
    expect(skillPoints(8)).toBe(7);
    expect(addRank({}, 'heavy_slash', 1)).toBeNull();
    let r = {};
    for (let k = 0; k < SKILL_MAX_RANK; k++) r = addRank(r, 'heavy_slash', 20)!;
    expect(addRank(r, 'heavy_slash', 20)).toBeNull();
    expect(addRank(r, 'dragon', 20)).toBeNull();
    expect(usedPoints(r)).toBe(5);
    expect(addRank(r, 'charge', 6)).toBeNull();
    expect(addRank(r, 'charge', 7)).toEqual({ heavy_slash: 5, charge: 1 });
  });

  it('壞資料：未知技能丟掉、超過 5 截斷、總數超過點數就全部退回', () => {
    expect(cleanRanks({ heavy_slash: 2, dragon: 3, charge: -1, parry: 1.5 }, 5)).toEqual({ heavy_slash: 2 });
    expect(cleanRanks({ heavy_slash: 9 }, 10)).toEqual({ heavy_slash: 5 });
    expect(cleanRanks({ heavy_slash: 3, charge: 3 }, 5)).toEqual({});
    expect(cleanRanks('x', 5)).toEqual({});
  });

  it('和裝備特效相加、照上限截斷；效果真的進到戰鬥', () => {
    const m = mergeMods({ charge: { cdPct: 30, distPct: 40 } }, rankMods({ charge: 5, parry: 4 }));
    expect(m.charge).toEqual({ cdPct: SKILL_MOD_CAPS.cdPct, distPct: SKILL_MOD_CAPS.distPct });
    expect(m.parry).toEqual({ dmgPct: 24, blockTicks: 2 });
    const a = createBattle({ stageId: 'mistwood', seed: 1 });
    const b = createBattle({ stageId: 'mistwood', seed: 1, skillMods: rankMods({ charge: 5 }) });
    expect(dashDistance(b, 'charge')).toBeGreaterThan(dashDistance(a, 'charge'));
    step(a, [{ type: 'skill', id: 'charge' }]);
    step(b, [{ type: 'skill', id: 'charge' }]);
    expect(b.units[0]!.ready.charge! - b.tick).toBeLessThan(a.units[0]!.ready.charge! - a.tick);
  });
});
