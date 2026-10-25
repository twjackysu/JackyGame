// 精英詞綴（D-113）：會移動的地圖精英出生時 60% 帶迅捷／堅韌／狂暴其一。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENEMIES, STAGES } from '../src/core/battle/rt/data';
import { applyAffix, createBattle, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { makeTestWorldStage } from '../src/core/battle/rt/maps/testWorld';
import { ELITE_AFFIX_IDS, ELITE_AFFIXES, type Unit } from '../src/core/battle/rt/types';

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
  STAGES.test_world = makeTestWorldStage();
});
afterAll(() => {
  delete STAGES.mistwood;
  delete STAGES.test_world;
});

describe('精英詞綴（D-113）', () => {
  it('霧語森林：狼群首領精英約六成帶詞綴、三種都會出現；一般怪與不會動的母樹不帶', () => {
    const seen: Record<string, number> = {};
    let n = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = createBattle({ stageId: 'mistwood', seed });
      step(s, []);
      for (const u of s.units) {
        if (u.side !== 'enemy') continue;
        if (u.tier !== 'elite' || (ENEMIES[u.defId]?.speed ?? 0) <= 0) expect(u.affix).toBeUndefined();
        if (u.groupId === 'elite') {
          n++;
          if (u.affix) seen[u.affix] = (seen[u.affix] ?? 0) + 1;
        }
      }
    }
    const withAffix = Object.values(seen).reduce((a, b) => a + b, 0);
    expect(withAffix / n).toBeGreaterThan(0.4);
    expect(withAffix / n).toBeLessThan(0.8);
    for (const a of ELITE_AFFIX_IDS) expect(seen[a] ?? 0).toBeGreaterThan(0);
  });

  it('沒設 eliteAffixes 的關卡不抽（舊關卡不受影響）', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = createBattle({ stageId: 'test_world', seed });
      step(s, []);
      expect(s.units.some((u) => u.affix)).toBe(false);
    }
  });

  it('效果：迅捷移動 +35%、堅韌 HP +70%', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 1 });
    const base = s.units.find((u) => u.defId === 'wolf')!;
    const a = { ...base } as Unit;
    applyAffix(a, 'swift');
    expect(a.speedPerTick).toBe(Math.round((base.speedPerTick * (100 + ELITE_AFFIXES.swift.speedPct!)) / 100));
    const b = { ...base } as Unit;
    applyAffix(b, 'tough');
    expect(b.maxHp).toBe(Math.round((base.maxHp * 170) / 100));
    expect(b.hp).toBe(b.maxHp);
  });
});
