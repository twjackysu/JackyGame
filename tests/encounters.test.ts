import { describe, expect, it } from 'vitest';
import { rivalEncounterEcho, claimThanks, cleanEncounters, ENCOUNTERS, encountersOf, meet, openEncounters, pendingThanks, worth } from '../src/game/encounters';
import { isSolidAt } from '../src/core/battle/rt/engine';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { makeThornvaleStage } from '../src/core/battle/rt/maps/thornvale';
import { makeEmberriftStage } from '../src/core/battle/rt/maps/emberrift';
import { WORLD_MAPS } from '../src/game/worldMaps';

describe('路上的相遇（D-159）', () => {
  it('三張主線地圖各一個、站在可以走的地上、id／選項不重複、回禮比「取」多', () => {
    const story = WORLD_MAPS.filter((m) => !m.postGame).map((m) => m.id);
    expect(ENCOUNTERS.map((e) => e.map).sort()).toEqual([...story].sort());
    expect(new Set(ENCOUNTERS.map((e) => e.id)).size).toBe(ENCOUNTERS.length);
    const stages: Record<string, ReturnType<typeof makeMistwoodStage>> = { mistwood: makeMistwoodStage(), thornvale: makeThornvaleStage(), emberrift: makeEmberriftStage() };
    for (const e of ENCOUNTERS) {
      const sol = stages[e.map]!.arena.solid!;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(isSolidAt(sol, (e.tx + dx) * 100 + 50, (e.ty + dy) * 100 + 50), `${e.id} ${dx},${dy}`).toBe(false);
      expect(worth(e.thanks)).toBeGreaterThan(worth(e.take));
      expect(worth(e.take)).toBeGreaterThan(0);
      expect(e.take.label).not.toBe(e.spare.label);
    }
  });

  it('只能選一次；助 → 下次進地圖道謝一次；壞資料丟掉', () => {
    expect(cleanEncounters([1])).toEqual({});
    expect(cleanEncounters({ mw_hunter: 'spare', tv_mule: 'eat', nope: 'take', er_miner: 'thanked' })).toEqual({ mw_hunter: 'spare', er_miner: 'thanked' });
    expect(openEncounters({}, 'mistwood').map((e) => e.id)).toEqual(['mw_hunter']);
    const a = meet({}, 'mw_hunter', 'spare')!;
    expect(meet(a, 'mw_hunter', 'take')).toBeNull();
    expect(meet(a, 'nope', 'take')).toBeNull();
    expect(openEncounters(a, 'mistwood')).toEqual([]);
    expect(pendingThanks(a, 'mistwood').map((e) => e.id)).toEqual(['mw_hunter']);
    expect(pendingThanks(a, 'thornvale')).toEqual([]);
    const b = claimThanks(a, 'mw_hunter')!;
    expect(b.mw_hunter).toBe('thanked');
    expect(claimThanks(b, 'mw_hunter')).toBeNull();
    expect(pendingThanks(b, 'mistwood')).toEqual([]);
    const t = meet({}, 'tv_mule', 'take')!;
    expect(pendingThanks(t, 'thornvale')).toEqual([]);
    expect(claimThanks(t, 'tv_mule')).toBeNull();
    expect(encountersOf('starfall')).toEqual([]);
  });

  it('燼牌對手會提起同一張地圖的相遇', () => {
    expect(rivalEncounterEcho('vela', {})).toBeNull();
    expect(rivalEncounterEcho('sol', { mw_hunter: 'take' })).toBeNull();
    expect(rivalEncounterEcho('merchant', { mw_hunter: 'take' })).not.toBe(rivalEncounterEcho('merchant', { mw_hunter: 'spare' }));
    expect(rivalEncounterEcho('goran', { er_miner: 'thanked' })).toBe(rivalEncounterEcho('goran', { er_miner: 'spare' }));
  });
});
