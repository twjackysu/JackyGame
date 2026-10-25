// 荊棘巡獵者（D-117）：會巡邏的世界精英。待機時沿路線走、發現玩家照常追、脫戰回到離開路線的地方再繼續走。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { makeThornvaleStage, STALKER_PATROL } from '../src/core/battle/rt/maps/thornvale';
import { validateStage } from '../src/core/battle/rt/maps/validate';
import { sec, u, type BattleState, type Unit } from '../src/core/battle/rt/types';

const stalker = (s: BattleState): Unit | undefined => s.units.find((x) => x.defId === 'thorn_stalker' && !x.dead);
/** 把玩家放在迴廊東南（看得到巡邏範圍、但在仇恨範圍外），讓巡獵者不會沉睡 */
function watch(s: BattleState): void {
  const p = s.units[0]!;
  p.x = u(33) + 50;
  p.y = u(43) + 50;
}

describe('荊棘巡獵者', () => {
  beforeAll(() => {
    STAGES.thornvale = makeThornvaleStage();
  });
  afterAll(() => {
    delete STAGES.thornvale;
  });

  it('巡邏點都通過驗證；開場站在第一個點、是精英', () => {
    expect(validateStage(makeThornvaleStage())).toEqual([]);
    const s = createBattle({ stageId: 'thornvale', seed: 1, level: 6 });
    const e = stalker(s)!;
    expect(e.tier).toBe('elite');
    expect(Math.hypot(e.x - STALKER_PATROL[0]!.x, e.y - STALKER_PATROL[0]!.y)).toBeLessThan(u(0.5));
  });

  it('玩家不靠近時沿路線走完一圈（每個點都到過）、不會卡住', () => {
    const s = createBattle({ stageId: 'thornvale', seed: 1, level: 6 });
    watch(s);
    const seen = new Set<number>();
    let moved = 0;
    let last = { x: stalker(s)!.x, y: stalker(s)!.y };
    while (s.tick < sec(120)) {
      step(s, []);
      watch(s);
      const e = stalker(s)!;
      expect(e.mode).not.toBe('combat');
      for (let i = 0; i < STALKER_PATROL.length; i++) if (Math.hypot(e.x - STALKER_PATROL[i]!.x, e.y - STALKER_PATROL[i]!.y) <= u(0.5)) seen.add(i);
      moved += Math.hypot(e.x - last.x, e.y - last.y);
      last = { x: e.x, y: e.y };
    }
    expect(seen.size).toBe(STALKER_PATROL.length);
    expect(moved).toBeGreaterThan(u(30));
  });

  it('玩家走近 → 進戰鬥；玩家跑遠 → 回到離開路線的地方、回滿血、繼續巡邏', () => {
    const s = createBattle({ stageId: 'thornvale', seed: 2, level: 6 });
    watch(s);
    for (let i = 0; i < sec(10); i++) {
      step(s, []);
      watch(s);
    }
    const e = stalker(s)!;
    const p = s.units[0]!;
    // 站到巡獵者前面 3 格
    p.x = e.x + u(3);
    p.y = e.y;
    let t = 0;
    while (e.mode !== 'combat' && t++ < sec(3)) step(s, []);
    expect(e.mode).toBe('combat');
    const left = { x: e.homeX!, y: e.homeY! };
    // 玩家瞬間跑回谷口
    p.x = u(24) + 50;
    p.y = u(73) + 50;
    p.hp = p.maxHp;
    t = 0;
    while (e.mode !== 'idle' && t++ < sec(30)) step(s, []);
    expect(e.mode).toBe('idle');
    expect(e.hp).toBe(e.maxHp);
    expect(Math.hypot(e.x - left.x, e.y - left.y)).toBeLessThan(u(0.5));
    // 繼續巡邏（玩家回到觀察點，避免沉睡）
    watch(s);
    const at = { x: e.x, y: e.y };
    for (let i = 0; i < sec(5); i++) {
      step(s, []);
      watch(s);
    }
    expect(Math.hypot(e.x - at.x, e.y - at.y)).toBeGreaterThan(u(2));
  });
});
