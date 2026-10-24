import { describe, expect, it } from 'vitest';
import {
  findPath, nearestWalkable, parseGrid, pathToAdjacent, reachable, slideMove, walkable,
} from '../src/core/explore/grid';
import { chestFlag, interact, markerOf, nextObjective, present } from '../src/core/explore/area';
import { AREAS } from '../src/data/areas';
import { newGame, applyEffects, check } from '../src/core/state/gameState';
import { SCRIPTS } from '../src/game/session';

const SMALL = [
  '#####',
  '#...#',
  '#.#.#',
  '#...#',
  '#####',
];

describe('explore grid', () => {
  it('parses and rejects ragged rows', () => {
    const g = parseGrid(SMALL);
    expect(g.w).toBe(5);
    expect(g.h).toBe(5);
    expect(() => parseGrid(['...', '..'])).toThrow();
  });
  it('collision: walls, out of bounds, rects, blockers', () => {
    const g = parseGrid(['....', '....'], [{ x: 1, y: 0, w: 2, h: 1 }]);
    expect(walkable(g, 0, 0)).toBe(true);
    expect(walkable(g, 1, 0)).toBe(false);
    expect(walkable(g, -1, 0)).toBe(false);
    expect(walkable(g, 4, 0)).toBe(false);
    expect(walkable(g, 0, 1, new Set(['0,1']))).toBe(false);
    expect(walkable(parseGrid(SMALL), 0, 0)).toBe(false); // '#' 未定義 → 不可走
  });
  it('A* finds shortest path around obstacles without corner cutting', () => {
    const g = parseGrid(SMALL);
    const p = findPath(g, { x: 1, y: 1 }, { x: 3, y: 3 })!;
    expect(p).not.toBeNull();
    expect(p[p.length - 1]).toEqual({ x: 3, y: 3 });
    expect(p.length).toBe(4); // 中間有柱子，不能斜切牆角
    for (const s of p) expect(walkable(g, s.x, s.y)).toBe(true);
    expect(findPath(g, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
    expect(findPath(g, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });
  it('A* uses diagonals in open space', () => {
    const g = parseGrid(['.....', '.....', '.....', '.....', '.....']);
    expect(findPath(g, { x: 0, y: 0 }, { x: 4, y: 4 })!.length).toBe(4);
  });
  it('pathToAdjacent and nearestWalkable', () => {
    const g = parseGrid(SMALL);
    const r = pathToAdjacent(g, { x: 1, y: 1 }, { x: 2, y: 2 })!;
    expect(Math.abs(r.stand.x - 2) + Math.abs(r.stand.y - 2)).toBe(1);
    expect(nearestWalkable(g, { x: 2, y: 2 })).not.toBeNull();
    expect(nearestWalkable(g, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });
  it('slideMove stops at walls and slides along them', () => {
    const g = parseGrid(['...', '...', 'TTT']);
    // 往右下推：y 被牆擋住，x 仍然前進
    const r = slideMove(g, 50, 80, 10, 30, 48, 10);
    expect(r.x).toBe(60);
    expect(r.y).toBe(80);
  });
});

describe('area data', () => {
  for (const a of Object.values(AREAS)) {
    describe(a.id, () => {
      const g = parseGrid(a.rows, a.buildings);
      const blockers = new Set(a.entities.filter((e) => e.kind !== 'gate').map((e) => `${e.x},${e.y}`));
      it('spawns are walkable', () => {
        for (const sp of Object.values(a.spawns)) expect(walkable(g, sp.x, sp.y, blockers)).toBe(true);
      });
      it('every entity is reachable from the default spawn', () => {
        const reach = reachable(g, a.spawns['default']!, blockers);
        for (const e of a.entities) {
          const ok = e.kind === 'gate'
            ? reach.has(`${e.x},${e.y}`)
            : [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => reach.has(`${e.x + dx!},${e.y + dy!}`));
          expect(ok, `${e.id} unreachable`).toBe(true);
        }
      });
      it('talk targets exist in scripts; ids unique', () => {
        const ids = new Set<string>();
        for (const e of a.entities) {
          expect(ids.has(e.id)).toBe(false);
          ids.add(e.id);
          if (e.talk) expect(SCRIPTS[e.talk.script]?.nodes[e.talk.node], `${e.talk.script}/${e.talk.node}`).toBeTruthy();
        }
      });
    });
  }
});

describe('entity logic (greylamp)', () => {
  const a = AREAS['greylamp']!;
  const byId = (id: string) => a.entities.find((e) => e.id === id)!;
  it('main objective follows chapter 1 flags', () => {
    const s = newGame();
    expect(nextObjective(s, a)?.id).toBe('orphanage');
    expect(markerOf(s, a.id, byId('tavern'))).toBe('none'); // 未拿提燈：酒館未開放
    applyEffects(s, [{ flag: 'ch1_got_lantern' }]);
    expect(nextObjective(s, a)?.id).toBe('tavern');
    expect(markerOf(s, a.id, byId('store'))).toBe('shop');
    applyEffects(s, [{ flag: 'ch1_rourke_joined' }]);
    expect(nextObjective(s, a)?.id).toBe('gate');
    applyEffects(s, [{ flag: 'ch1_left_town' }]);
    expect(nextObjective(s, a)).toBeUndefined();
    expect(markerOf(s, a.id, byId('guard'))).toBe('chat');
  });
  it('interact: locked door says lines, open door runs script, chest once', () => {
    const s = newGame();
    expect(interact(s, a.id, byId('tavern')).kind).toBe('say');
    expect(interact(s, a.id, byId('orphanage'))).toMatchObject({ kind: 'script', script: 'ch1', node: 'orphanage' });
    expect(interact(s, a.id, byId('gate'))).toMatchObject({ kind: 'say' });
    applyEffects(s, [{ flag: 'ch1_rourke_joined' }]);
    expect(interact(s, a.id, byId('gate'))).toMatchObject({ kind: 'script', node: 'town_gate' });
    expect(byId('gate').to).toEqual({ area: 'mistwood', spawn: 'north' });
    const c = interact(s, a.id, byId('pond_chest'));
    expect(c.kind).toBe('loot');
    if (c.kind === 'loot') applyEffects(s, c.effects);
    expect(s.flags[chestFlag(a.id, 'pond_chest')]).toBe(true);
    expect(interact(s, a.id, byId('pond_chest')).kind).toBe('empty');
    expect(present(s, byId('kid'))).toBe(true);
  });
  it('chat lines pick by random', () => {
    const s = newGame();
    const g = byId('guard');
    const first = interact(s, a.id, g, 0);
    const last = interact(s, a.id, g, 0.999);
    expect(first).not.toEqual(last);
  });
});

describe('mistwood', () => {
  const a = AREAS['mistwood']!;
  const byId = (id: string) => a.entities.find((e) => e.id === id)!;
  it('objectives: caravan → lake → hunter; waiting hides the !', () => {
    const s = newGame();
    applyEffects(s, [{ flag: 'ch1_got_lantern' }, { flag: 'ch1_rourke_joined' }, { flag: 'ch1_left_town' }]);
    expect(nextObjective(s, a)?.id).toBe('forest_edge');
    applyEffects(s, [{ flag: 'ch1_caravan_done' }]);
    expect(nextObjective(s, a)?.id).toBe('mist_lake');
    applyEffects(s, [{ flag: 'ch1_io_joined' }]);
    expect(nextObjective(s, a)?.id).toBe('hunter_hut');
    applyEffects(s, [{ flag: 'bern_wait' }]);
    expect(markerOf(s, a.id, byId('hunter_hut'))).toBe('chat');
    expect(nextObjective(s, a)).toBeUndefined();
    applyEffects(s, [{ flag: 'ch1_path_cleared' }]);
    expect(nextObjective(s, a)?.id).toBe('hunter_hut');
  });
  it('enemies have valid encounters and no marker', async () => {
    const { ENCOUNTERS } = await import('../src/data/combatants');
    const s = newGame();
    for (const e of a.entities.filter((x) => x.kind === 'enemy')) {
      expect(ENCOUNTERS[e.battle!], e.id).toBeTruthy();
      expect(markerOf(s, a.id, e)).toBe('none');
    }
  });
  it('exits link back', () => {
    expect(byId('north_exit').to).toEqual({ area: 'greylamp', spawn: 'gate' });
    expect(AREAS['greylamp']!.spawns['gate']).toBeTruthy();
    expect(byId('south_exit').to).toEqual({ area: 'wolfpath', spawn: 'north' });
    expect(AREAS['wolfpath']!.entities.find((e) => e.id === 'north_exit')!.to).toEqual({ area: 'mistwood', spawn: 'south' });
  });
});

describe('wolfpath', () => {
  const a = AREAS['wolfpath']!;
  it('second half of chapter 1 in order', () => {
    const s = newGame();
    applyEffects(s, [{ flag: 'ch1_met_bern' }]);
    expect(nextObjective(s, a)?.id).toBe('wolf_path');
    applyEffects(s, [{ flag: 'ch1_path_cleared' }, { flag: 'wick_shrine' }, { flag: 'wick_lake' }]);
    expect(nextObjective(s, a)).toBeUndefined(); // 還差獵人的燈芯
    applyEffects(s, [{ flag: 'wick_hunter' }]);
    expect(nextObjective(s, a)?.id).toBe('lighthouse');
    applyEffects(s, [{ flag: 'ch1_legacy' }]);
    expect(nextObjective(s, a)?.id).toBe('campfire');
    expect(markerOf(s, a.id, a.entities.find((e) => e.id === 'fallen_log')!)).toBe('side');
    applyEffects(s, [{ flag: 'ch1_campfire' }]);
    expect(nextObjective(s, a)?.id).toBe('wolf_den');
  });
  it('every world-map location of chapter 1 is in some area', async () => {
    const { CHAPTER_MAPS } = await import('../src/data/maps');
    const ids = new Set(Object.values(AREAS).flatMap((x) => x.entities.map((e) => e.talk?.node)));
    for (const e of CHAPTER_MAPS.ch1.entries) expect(ids.has(e.node), e.node).toBe(true);
  });
  it('every world-map location of chapter 2 is in some area (ch2 script)', async () => {
    const { CHAPTER_MAPS } = await import('../src/data/maps');
    const ids = new Set(Object.values(AREAS).flatMap((x) => x.entities.filter((e) => e.talk?.script === 'ch2').map((e) => e.talk!.node)));
    for (const e of CHAPTER_MAPS.ch2.entries) expect(ids.has(e.node), e.node).toBe(true);
  });
  it('every world-map location of chapter 3 is in the capital; objectives follow the story', async () => {
    const { CHAPTER_MAPS } = await import('../src/data/maps');
    const cap = AREAS['capital']!;
    for (const e of CHAPTER_MAPS.ch3.entries) {
      const ent = cap.entities.find((x) => x.talk?.script === 'ch3' && x.talk.node === e.node);
      expect(ent, e.node).toBeTruthy();
      expect(ent!.done, e.node).toBe(CHAPTER_MAPS.ch3.done[e.location]);
      expect(cap.spawns[e.location], e.location).toBeTruthy();
    }
    const s = newGame();
    const order: [string, string | undefined][] = [
      ['ch2_complete', 'capital_gate'], ['ch3_entered', 'crown_plaza'], ['ch3_plaza_done', 'rourke_lodging'], ['ch3_rourke_met', 'tourney_hall'],
      ['ch3_tourney_done', 'academy'], ['ch3_academy_done', 'inn_night'], ['ch3_betrayal', 'rooftop'], ['ch3_duel_done', 'crown_plaza_dawn'], ['ch3_complete', undefined],
    ];
    for (const [flag, next] of order) {
      applyEffects(s, [{ flag }]);
      expect(nextObjective(s, cap)?.id, flag).toBe(next);
    }
  });
  it('chapter 2 main objectives follow the story order in the mine', () => {
    const a = AREAS['mine']!;
    const s = newGame();
    const order: [string, string][] = [
      ['ch2_camp_done', 'upper_tunnel'], ['ch2_liora_joined', 'mid_tunnel'], ['ch2_mid_cleared', 'bell_hall'],
      ['ch2_bell_done', 'mine_campfire'], ['ch2_campfire', 'deep_level'], ['ch2_deep_done', 'bell_throat'],
    ];
    for (const [flag, next] of order) {
      applyEffects(s, [{ flag }]);
      expect(nextObjective(s, a)?.id, flag).toBe(next);
    }
    applyEffects(s, [{ flag: 'ch2_complete' }]);
    expect(nextObjective(s, a)).toBeUndefined();
  });
  it('mine gate is locked until the camp talk; serin waits on the plaza only in chapter 2', () => {
    const s = newGame();
    const gate = AREAS['minecamp']!.entities.find((e) => e.id === 'mine_gate')!;
    expect(check(s, gate.requires!)).toBe(false);
    applyEffects(s, [{ flag: 'ch2_camp_done' }]);
    expect(check(s, gate.requires!)).toBe(true);
    const serin = AREAS['greylamp']!.entities.find((e) => e.id === 'serin_plaza')!;
    expect(present(s, serin)).toBe(false);
    for (const flag of ['ch1_got_lantern', 'ch1_rourke_joined', 'ch1_left_town', 'ch1_complete']) applyEffects(s, [{ flag }]);
    expect(present(s, serin)).toBe(true);
    expect(nextObjective(s, AREAS['greylamp']!)?.id).toBe('serin_plaza');
  });
});

describe('greylamp side quest: four plaza lamps', () => {
  const a = AREAS['greylamp']!;
  const lamps = a.entities.filter((e) => e.kind === 'lamp');
  it('lamps sit on lamp-post tiles and need the quest first', () => {
    expect(lamps.length).toBe(4);
    for (const l of lamps) expect(a.rows[l.y]![l.x]).toBe('L');
    const s = newGame();
    applyEffects(s, [{ flag: 'ch1_got_lantern' }]);
    expect(interact(s, a.id, lamps[0]!).kind).toBe('say');
    expect(markerOf(s, a.id, lamps[0]!)).toBe('none');
    expect(markerOf(s, a.id, a.entities.find((e) => e.id === 'lamplighter')!)).toBe('side');
    applyEffects(s, [{ flag: 'q_lamps' }]);
    expect(markerOf(s, a.id, lamps[0]!)).toBe('side');
    const r = interact(s, a.id, lamps[0]!);
    expect(r).toEqual({ kind: 'lamp', flag: 'lamp_greylamp_plaza_lamp_1' });
    applyEffects(s, [{ flag: 'lamp_greylamp_plaza_lamp_1' }]);
    expect(markerOf(s, a.id, lamps[0]!)).toBe('none');
    expect(interact(s, a.id, lamps[0]!).kind).toBe('say');
  });
  it('lamplighter script: start → wait → reward', async () => {
    const { DialogueRunner } = await import('../src/core/dialogue/runner');
    const s = newGame();
    applyEffects(s, [{ flag: 'ch1_got_lantern' }]);
    const run = (node: string, pick = 0) => {
      const r = new DialogueRunner({ ...SCRIPTS['ch1']!, start: node }, s);
      for (let i = 0; i < 40; i++) {
        const st = r.next();
        if (st.kind === 'end') return;
        if (st.kind === 'choice') r.choose(pick);
      }
    };
    run('lamplighter');
    expect(s.flags['q_lamps']).toBe(true);
    applyEffects(s, [{ flag: 'q_lamps_lit' }]);
    const g = s.gold;
    run('lamplighter');
    expect(s.flags['q_lamps_rewarded']).toBe(true);
    expect(s.gold).toBe(g + 40);
  });
});

describe('等級差逃跑', () => {
  it('差 5 級以上逃跑；Boss 不逃', async () => {
    const { outleveled } = await import('../src/core/explore/area');
    expect(outleveled(7, 2)).toBe(true);
    expect(outleveled(6, 2)).toBe(false);
    expect(outleveled(20, 2, true)).toBe(false);
  });
});

describe('同伴閒聊', () => {
  it('每個區域每位同伴都有台詞', async () => {
    const { banterFor } = await import('../src/data/banter');
    for (const area of Object.keys(AREAS)) for (const m of ['io', 'rourke', 'serin', 'liora'] as const) expect(banterFor(area, m).length, `${area}/${m}`).toBeGreaterThan(0);
  });
});
