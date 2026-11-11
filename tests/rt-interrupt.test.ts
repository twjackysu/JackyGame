// 第 167 輪：怪在蓄力（預告）中被暈／凍住 → 這一招被打斷。
// 以前：`disabled` 直接 return，命中那個 tick 被跳過——招式不會命中，但預告永遠留在 s.telegraphs
// （地上一塊填滿、一直閃的紅色範圍，怪也一直是「蓄力中」的紅色），直到那隻怪死掉或脫戰。
import { describe, expect, it } from 'vitest';
import { addStatus, createBattle, playerOf, step } from '../src/core/battle/rt/engine';
import type { BattleState, Unit } from '../src/core/battle/rt/types';

function windup(): { s: BattleState; p: Unit; e: Unit; hit: number } {
  const s = createBattle({ stageId: 'forest_entry', seed: 7 });
  const p = playerOf(s);
  const e = s.units.find((u) => u.side === 'enemy')!;
  s.units = [p, e];
  e.x = p.x + 120; e.y = p.y; e.mode = 'combat';
  e.hp = e.maxHp = 100000; p.hp = p.maxHp = 100000;
  let n = 0;
  while (!s.telegraphs.length && n++ < 300) step(s, []);
  expect(s.telegraphs.length).toBe(1);
  return { s, p, e, hit: s.telegraphs[0]!.hitTick };
}
const hurt = (s: BattleState, p: Unit, from: number): number => s.events.filter((x) => x.type === 'damage' && x.dst === p.id && x.tick >= from).length;

describe('蓄力中被暈／凍住會打斷出招', () => {
  for (const id of ['freeze', 'stun'] as const) {
    for (const before of [8, 1]) {
      it(`${id}：命中前 ${before} tick 被控 → 預告立刻消失、這一招不會命中、有 interrupt 事件`, () => {
        const { s, p, e, hit } = windup();
        while (s.tick < hit - before) step(s, []);
        const atk = e.action!.id;
        addStatus(s, e, { id, ticks: 45 }, p);
        const t0 = s.tick;
        step(s, []);
        expect(s.telegraphs.filter((t) => t.ownerId === e.id)).toEqual([]);
        expect(e.action).toBeNull();
        expect(s.events.some((x) => x.type === 'interrupt' && x.id === e.id && x.attack === atk)).toBe(true);
        // 被控期間不會挨打；整段都沒有過期的預告留在場上
        for (let i = 0; i < 44; i++) { step(s, []); expect(s.telegraphs.some((t) => t.hitTick < s.tick)).toBe(false); }
        expect(hurt(s, p, t0)).toBe(0);
        // 解除之後照常再出招、會命中
        for (let i = 0; i < 240; i++) { step(s, []); expect(s.telegraphs.some((t) => t.hitTick < s.tick)).toBe(false); }
        expect(hurt(s, p, t0)).toBeGreaterThan(0);
      });
    }
  }

  it('很短的控場（比剩下的蓄力時間短）也算打斷，不會解除後補打', () => {
    const { s, p, e, hit } = windup();
    while (s.tick < hit - 10) step(s, []);
    addStatus(s, e, { id: 'stun', ticks: 3 }, p);
    const t0 = s.tick;
    while (s.tick <= hit + 2) step(s, []);
    expect(hurt(s, p, t0)).toBe(0);
    expect(s.events.filter((x) => x.type === 'interrupt').length).toBe(1);
  });

  it('命中之後（收招中）被控不算打斷', () => {
    const { s, p, e, hit } = windup();
    while (s.tick < hit + 1) step(s, []);
    addStatus(s, e, { id: 'stun', ticks: 30 }, p);
    for (let i = 0; i < 40; i++) step(s, []);
    expect(s.events.some((x) => x.type === 'interrupt')).toBe(false);
  });

  it('沒被控就照常命中（對照）', () => {
    const { s, p, hit } = windup();
    while (s.tick <= hit) step(s, []);
    expect(hurt(s, p, hit)).toBe(1);
  });
});
