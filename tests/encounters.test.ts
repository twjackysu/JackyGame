import { describe, expect, it } from 'vitest';
import { rivalEncounterEcho, claimThanks, cleanEncounters, ENCOUNTERS, encountersOf, meet, openEncounters, pendingThanks, worth } from '../src/game/encounters';
import { isSolidAt } from '../src/core/battle/rt/engine';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { makeThornvaleStage } from '../src/core/battle/rt/maps/thornvale';
import { makeEmberriftStage } from '../src/core/battle/rt/maps/emberrift';
import { makeStarfallStage } from '../src/core/battle/rt/maps/starfall';
import { MEMORIES } from '../src/game/memories';
import { STORY_ENCOUNTERS } from '../src/game/finaleStats';
import { WORLD_MAPS } from '../src/game/worldMaps';

describe('路上的相遇（D-159）', () => {
  it('主線三張圖各兩個、星隕高原一個；站在可以走的地上、離怪與記憶夠遠、id／選項不重複、回禮比「取」多', () => {
    for (const m of WORLD_MAPS) expect(encountersOf(m.id).length, m.id).toBe(m.postGame ? 1 : 2);
    expect(STORY_ENCOUNTERS.length).toBe(6);
    expect(new Set(ENCOUNTERS.map((e) => e.id)).size).toBe(ENCOUNTERS.length);
    const stages: Record<string, ReturnType<typeof makeMistwoodStage>> = { mistwood: makeMistwoodStage(), thornvale: makeThornvaleStage(), emberrift: makeEmberriftStage(), starfall: makeStarfallStage() };
    for (const e of ENCOUNTERS) {
      const sol = stages[e.map]!.arena.solid!;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) expect(isSolidAt(sol, (e.tx + dx) * 100 + 50, (e.ty + dy) * 100 + 50), `${e.id} ${dx},${dy}`).toBe(false);
      expect(worth(e.thanks)).toBeGreaterThan(worth(e.take));
      expect(worth(e.take)).toBeGreaterThan(0);
      expect(e.take.label).not.toBe(e.spare.label);
      // 第 37 輪起的相遇：一般怪的重生點至少 8 格外（不在打架時才會觸發，太近會一直被打斷；第 36 輪三個刻意放在怪旁邊＝要先清怪）；和記憶／其他相遇至少 6 格
      if (!['mw_hunter', 'tv_mule', 'er_miner'].includes(e.id)) for (const g of stages[e.map]!.spawnGroups ?? []) expect(Math.hypot(g.cx / 100 - e.tx, g.cy / 100 - e.ty), `${e.id}↔${g.id}`).toBeGreaterThan(8);
      for (const o of [...MEMORIES, ...ENCOUNTERS]) if (o !== e && o.map === e.map) expect(Math.hypot(o.tx - e.tx, o.ty - e.ty), `${e.id}↔${o.id}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('只能選一次；助 → 下次進地圖道謝一次；壞資料丟掉', () => {
    expect(cleanEncounters([1])).toEqual({});
    expect(cleanEncounters({ mw_hunter: 'spare', tv_mule: 'eat', nope: 'take', er_miner: 'thanked' })).toEqual({ mw_hunter: 'spare', er_miner: 'thanked' });
    const a = meet({}, 'mw_hunter', 'spare')!;
    expect(meet(a, 'mw_hunter', 'take')).toBeNull();
    expect(meet(a, 'nope', 'take')).toBeNull();
    expect(openEncounters(a, 'mistwood').map((e) => e.id)).toEqual(['mw_herbs']);
    expect(pendingThanks(a, 'mistwood').map((e) => e.id)).toEqual(['mw_hunter']);
    expect(pendingThanks(a, 'thornvale')).toEqual([]);
    const b = claimThanks(a, 'mw_hunter')!;
    expect(b.mw_hunter).toBe('thanked');
    expect(claimThanks(b, 'mw_hunter')).toBeNull();
    expect(pendingThanks(b, 'mistwood')).toEqual([]);
    const t = meet({}, 'tv_mule', 'take')!;
    expect(pendingThanks(t, 'thornvale')).toEqual([]);
    expect(claimThanks(t, 'tv_mule')).toBeNull();
    expect(openEncounters({}, 'mistwood').map((e) => e.id)).toEqual(['mw_hunter', 'mw_herbs']);
  });

  it('燼牌對手會提起同一張地圖的相遇', () => {
    expect(rivalEncounterEcho('vela', {})).toBeNull();
    expect(rivalEncounterEcho('sol', { mw_hunter: 'take' })).toBeNull();
    expect(rivalEncounterEcho('merchant', { mw_hunter: 'take' })).not.toBe(rivalEncounterEcho('merchant', { mw_hunter: 'spare' }));
    expect(rivalEncounterEcho('goran', { er_miner: 'thanked' })).toBe(rivalEncounterEcho('goran', { er_miner: 'spare' }));
    // 兩個都選過：依亂數挑其中一句；別張圖的相遇不會被提起
    const both = { tv_mule: 'take', tv_thief: 'spare', mw_hunter: 'take' } as const;
    const a = rivalEncounterEcho('vela', both, () => 0), b = rivalEncounterEcho('vela', both, () => 0.99);
    expect(a).not.toBe(b);
    expect([a, b]).toContain(rivalEncounterEcho('vela', { tv_mule: 'take' }));
    expect(rivalEncounterEcho('sol', { sf_courier: 'spare' })).not.toBeNull();
  });
});
