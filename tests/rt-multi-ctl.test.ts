// Q6 第一步（第 143 輪）：每個玩家自己的控制狀態（PlayerCtl）、指令帶 pid、隊伍判斷。
// 單人（pid 0）完全照舊（golden hash 測試另外守著）；這裡只確認第二個玩家的狀態不會寫到主角身上。
import { describe, expect, it } from 'vitest';
import { createBattle, ctlOf, hostile, playerOf, step, teamOf } from '../src/core/battle/rt/engine';
import type { BattleState, Unit } from '../src/core/battle/rt/types';

function withSecond(s: BattleState, team = 0): Unit {
  const p0 = playerOf(s);
  const p1: Unit = { ...structuredClone(p0), id: s.nextId++, pid: 1, team, x: p0.x + 40 };
  s.units.push(p1);
  s.others = [{ manualMove: null, potions: 2 }];
  return p1;
}

describe('多玩家控制狀態（Q6 第一步）', () => {
  it('playerOf(s, pid)、ctlOf：pid 0 是 BattleState 本身，pid 1 在 others', () => {
    const s = createBattle({ stageId: 'forest_entry', seed: 1 });
    const p1 = withSecond(s);
    expect(playerOf(s)).toBe(s.units[0]);
    expect(playerOf(s, 1)).toBe(p1);
    expect(ctlOf(s, playerOf(s))).toBe(s);
    expect(ctlOf(s, p1)).toBe(s.others![0]);
  });

  it('pid 1 的移動、藥水只動到自己的狀態', () => {
    const s = createBattle({ stageId: 'forest_entry', seed: 1 });
    const p1 = withSecond(s);
    const potions0 = s.potions;
    p1.hp = Math.floor(p1.maxHp / 2);
    step(s, [{ pid: 1, type: 'move', dx: 1000, dy: 0 }, { pid: 1, type: 'potion' }]);
    expect(s.others![0]!.manualMove).toEqual({ dx: 1000, dy: 0 });
    expect(s.manualMove).toBeNull();
    expect(s.others![0]!.potions).toBe(1);
    expect(s.potions).toBe(potions0);
    expect(p1.hp).toBeGreaterThan(Math.floor(p1.maxHp / 2));
    // 下一個 tick 沒指令：手動移動清掉（每個玩家都一樣）
    step(s, []);
    expect(s.others![0]!.manualMove).toBeNull();
  });

  it('隊伍：沒設照 side；PvP 時兩個玩家不同隊就互為敵對', () => {
    const s = createBattle({ stageId: 'forest_entry', seed: 1 });
    const p0 = playerOf(s);
    const ally = withSecond(s, 0);
    const e = s.units.find((u) => u.side === 'enemy')!;
    expect(teamOf(p0)).toBe(0);
    expect(teamOf(e)).toBe(1);
    expect(hostile(p0, e)).toBe(true);
    expect(hostile(p0, ally)).toBe(false);
    ally.team = 2;
    expect(hostile(p0, ally)).toBe(true);
  });

  it('多人：怪找最近的敵對玩家打；兩個人都會自己行動；全倒才算輸', () => {
    const s = createBattle({ stageId: 'wolf_king', seed: 7 });
    const p0 = playerOf(s);
    const e = s.units.find((u) => u.side === 'enemy')!;
    const p1 = withSecond(s);
    // 主角躲到最遠的角落、第二個玩家貼著怪
    p0.x = e.x < s.arena.w / 2 ? s.arena.w - p0.r - 1 : p0.r + 1;
    p0.y = e.y < s.arena.h / 2 ? s.arena.h - p0.r - 1 : p0.r + 1;
    p1.x = e.x + e.r + p1.r + 10;
    p1.y = e.y;
    p1.hp = p1.maxHp = 100000;
    const hp0 = p0.hp;
    for (let t = 0; t < 30 * 8; t++) step(s, [{ pid: 0, type: 'move', dx: 0, dy: 0 }]);
    expect(p1.hp).toBeLessThan(p1.maxHp);
    expect(p0.hp).toBe(hp0);
    // 第二個玩家也會自己追擊出手（updatePlayer 每個 pid 都跑）
    expect(e.hp).toBeLessThan(e.maxHp);
    // 只有一個倒下不算輸
    p0.hp = 0;
    p0.dead = true;
    step(s, []);
    expect(s.outcome).toBe('running');
  });
});
