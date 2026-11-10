// D-347／D-348（Jacky 11/10 晚上）：①移動的時候也能普攻、放技能（不會被定住）②技能可以疊放——一招還在放時再放別招，兩招各自打完、互不打斷。
import { describe, expect, it } from 'vitest';
import { createBattle, MOVE_CAST_FACTOR, playerOf, step } from '../src/core/battle/rt/engine';
import type { BattleCommand, BattleState, Unit } from '../src/core/battle/rt/types';

const mk = (extra: Record<string, unknown> = {}): BattleState => createBattle({ stageId: 'forest_entry', seed: 5, ...extra });
/** 把場上的怪換成指定位置的幾隻（不會出手、血很厚） */
function arrange(s: BattleState, at: [number, number][], mode: Unit['mode'] = 'combat'): Unit[] {
  const p = playerOf(s);
  const proto = s.units.find((u) => u.side === 'enemy')!;
  const es = at.map(([dx, dy], i) => ({ ...structuredClone(proto), id: 900 + i, x: p.x + dx, y: p.y + dy, dead: false, hp: 100000, maxHp: 100000, mode, nextAttackTick: 1e9, speedPerTick: 0 }));
  s.units = [p, ...es];
  return es;
}
const dmg = (s: BattleState, skill: string, from = 0) => s.events.slice(from).filter((e) => e.type === 'damage' && e.skill === skill);
const MOVE: BattleCommand = { type: 'move', dx: 0, dy: -1 }; // 往上走（主角開場在場地下緣）

describe('邊走邊打（D-347）', () => {
  it('搖桿一直推著：每個 tick 都在走，射程內的交戰中敵人照樣被普攻打到', () => {
    const s = mk();
    const p = playerOf(s);
    arrange(s, [[100, -60]]);
    p.targetId = null;
    let stuck = 0;
    for (let i = 0; i < 40; i++) {
      const y = p.y;
      step(s, [MOVE]);
      if (p.y === y) stuck++;
    }
    expect(stuck).toBe(0);
    expect(dmg(s, 'attack').length).toBeGreaterThan(0);
  });

  it('路過睡著的怪不會順手打醒（牠自己醒來追人才打）；點地移動也一樣邊走邊打', () => {
    const s = mk();
    const p = playerOf(s);
    const [e] = arrange(s, [[100, -60]], 'idle');
    p.targetId = null;
    for (let i = 0; i < 40; i++) {
      const asleep = e!.mode !== 'combat';
      const n = s.events.length;
      step(s, [MOVE]);
      if (asleep && e!.mode !== 'combat') expect(dmg(s, 'attack', n).length).toBe(0);
    }
    const s2 = mk();
    const p2 = playerOf(s2);
    arrange(s2, [[100, -100]]);
    p2.targetId = null;
    step(s2, [{ type: 'moveTo', x: p2.x, y: p2.y - 250 }]);
    for (let i = 0; i < 30; i++) step(s2);
    expect(dmg(s2, 'attack').length).toBeGreaterThan(0);
    expect(p2.y).toBeLessThan(playerOf(mk()).y - 150);
  });

  it('原本會定住的招（重斬）施放中也能走（速度打折），方向在施放時鎖定、照樣打到', () => {
    const s = mk();
    const p = playerOf(s);
    const [e] = arrange(s, [[150, 0]]);
    p.targetId = e!.id;
    const y0 = p.y;
    step(s, [{ type: 'skill', id: 'heavy_slash' }, MOVE]);
    for (let i = 0; i < 6; i++) step(s, [MOVE]);
    expect(p.action?.kind).toBe('skill');
    const moved = y0 - p.y;
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(Math.ceil(p.speedPerTick * 7 * MOVE_CAST_FACTOR) + 7);
    for (let i = 0; i < 12; i++) step(s, [MOVE]);
    expect(dmg(s, 'heavy_slash').length).toBe(1);
  });

});

describe('技能疊放（D-348）', () => {
  it('旋風斬放到一半再放大招：兩招每一段都打到，誰也沒被打斷', () => {
    const s = mk();
    const p = playerOf(s);
    const [e] = arrange(s, [[120, 0]]);
    p.targetId = e!.id;
    p.mp = 100;
    step(s, [{ type: 'skill', id: 'whirlwind' }]);
    for (let i = 0; i < 5; i++) step(s);
    step(s, [{ type: 'skill', id: 'blade_storm' }]);
    expect(p.action?.id).toBe('whirlwind');
    expect(p.casts?.map((c) => c.id)).toEqual(['blade_storm']);
    for (let i = 0; i < 100; i++) step(s);
    expect(dmg(s, 'whirlwind').length).toBe(3);
    expect(dmg(s, 'blade_storm').length).toBe(9);
    expect(p.casts).toBeUndefined();
    expect(p.action?.kind ?? 'attack').toBe('attack');
  });

  it('疊放的招不受閃避打斷；主角可以繼續普攻；同一招不能疊（第 3 欄不位移了可以疊，D-346）', () => {
    const s = mk();
    const p = playerOf(s);
    const [e] = arrange(s, [[120, 0]]);
    p.targetId = e!.id;
    p.mp = 100;
    step(s, [{ type: 'skill', id: 'heavy_slash' }]);
    step(s, [{ type: 'skill', id: 'blade_storm' }]);
    p.ready['blade_storm'] = 0;
    step(s, [{ type: 'skill', id: 'blade_storm' }]);
    expect(p.casts?.length).toBe(1);
    step(s, [{ type: 'dodge', dx: 0, dy: -1 }]);
    expect(p.action?.kind).toBe('dodge');
    const from = s.events.length;
    for (let i = 0; i < 100; i++) step(s);
    expect(dmg(s, 'blade_storm').length).toBeGreaterThanOrEqual(1);
    expect(dmg(s, 'attack', from).length).toBeGreaterThan(0);
  });

  it('自動施放會疊：四欄都好了就接連放出去，不用等上一招收完', () => {
    const s = mk({ autoSkills: ['blade_storm', 'whirlwind', 'heavy_slash', 'parry'] });
    const p = playerOf(s);
    const es = arrange(s, [[120, 0], [0, 130], [-110, 0]]);
    p.targetId = es[0]!.id;
    p.mp = 100;
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      step(s);
      peak = Math.max(peak, (p.action?.kind === 'skill' ? 1 : 0) + (p.casts?.length ?? 0));
    }
    expect(peak).toBeGreaterThanOrEqual(3);
    const cast = new Set(s.events.filter((e) => e.type === 'cast').map((e) => (e.type === 'cast' ? e.skill : '')));
    expect([...cast].sort()).toEqual(['blade_storm', 'heavy_slash', 'parry', 'whirlwind']);
  });
});

describe('遠程不往怪身上貼（D-349）', () => {
  it('長弓／法杖：目標已經在普攻射程內，放可以邊走的招時站在原地不靠近；長劍照舊會貼上去', () => {
    for (const [weapon, closer] of [['bow', false], ['staff', false], [undefined, true]] as const) {
      const s = mk({ weapon });
      const p = playerOf(s);
      const [e] = arrange(s, [[0, -300]]);
      p.targetId = e!.id;
      p.nextAttackTick = 1e9; // 只看技能施放中的移動
      const d0 = Math.hypot(e!.x - p.x, e!.y - p.y);
      for (const id of ['whirlwind', 'parry']) {
        p.ready[id] = 0;
        step(s, [{ type: 'skill', id }]);
        for (let i = 0; i < 40; i++) step(s);
      }
      const d1 = Math.hypot(e!.x - p.x, e!.y - p.y);
      if (closer) expect(d1).toBeLessThan(d0 - 50);
      else expect(d1).toBe(d0);
    }
  });
});
