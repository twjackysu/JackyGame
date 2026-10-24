import { describe, expect, it } from 'vitest';
import {
  findPath, nearestWalkable, parseGrid, pathToAdjacent, reachable, slideMove, walkable,
} from '../src/core/explore/grid';
import { chestFlag, interact, markerOf, nextObjective, present } from '../src/core/explore/area';
import { AREAS } from '../src/data/areas';
import { newGame, applyEffects } from '../src/core/state/gameState';
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
});
