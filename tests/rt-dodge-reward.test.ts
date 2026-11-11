// 第 168 輪（D-365）：閃過敵人的攻擊有回報——回 MP、閃避冷卻退一半。
// 以前：被打到回 2 MP、閃過去回 0（閃得好反而比較慢放大招）；五欄全自動後閃避是唯一要自己按的招。
import { describe, expect, it } from 'vitest';
import { addPlayer, createBattle, playerOf, step } from '../src/core/battle/rt/engine';
import { SWORDSMAN as PLAYER } from '../src/core/battle/rt/data';
import type { BattleState, Unit } from '../src/core/battle/rt/types';

function windup(setup: Parameters<typeof createBattle>[0] = { stageId: 'forest_entry', seed: 7 }): { s: BattleState; p: Unit; e: Unit; hit: number } {
  const s = createBattle(setup);
  const p = playerOf(s);
  const e = s.units.find((u) => u.side === 'enemy')!;
  s.units = [p, e];
  e.x = p.x + 120; e.y = p.y; e.mode = 'combat';
  e.hp = e.maxHp = 100000; p.hp = p.maxHp = 100000; p.atk = 1;
  let n = 0;
  while (!s.telegraphs.length && n++ < 300) step(s, []);
  expect(s.telegraphs.length).toBe(1);
  return { s, p, e, hit: s.telegraphs[0]!.hitTick };
}

describe('閃過攻擊的回報', () => {
  it('命中前一刻閃避 → 沒受傷、回 MP、閃避冷卻剩一半；dodged 事件帶 mp', () => {
    const { s, p, hit } = windup();
    while (s.tick < hit - 2) step(s, []);
    const mp0 = p.mp;
    step(s, [{ type: 'dodge', dx: 0, dy: -100 }]);
    const cdFull = p.ready['dodge']! - s.tick;
    const t0 = s.tick;
    while (s.tick <= hit + 1) step(s, []);
    const ev = s.events.filter((x) => x.type === 'dodged' && x.tick >= t0);
    expect(ev.length).toBe(1);
    expect(ev[0]).toMatchObject({ id: p.id, mp: PLAYER.mpGain.dodge });
    expect(s.events.some((x) => x.type === 'damage' && x.dst === p.id && x.tick >= t0)).toBe(false);
    expect(p.mp).toBe(mp0 + PLAYER.mpGain.dodge);
    expect(PLAYER.mpGain.dodge).toBeGreaterThan(PLAYER.mpGain.hurt); // 閃過去要比挨打划算
    const left = p.ready['dodge']! - s.tick;
    expect(left).toBeLessThan(cdFull * 0.6);
    expect(left).toBeGreaterThan(0); // 不是直接歸零（不能無限翻滾）
  });

  it('沒有東西打過來的空翻滾：沒有回報、冷卻照舊', () => {
    const s = createBattle({ stageId: 'forest_entry', seed: 7 });
    const p = playerOf(s);
    s.units = [p];
    step(s, [{ type: 'dodge', dx: 0, dy: -100 }]);
    const ready = p.ready['dodge']!;
    for (let i = 0; i < 20; i++) step(s, []);
    expect(p.mp).toBe(0);
    expect(p.ready['dodge']).toBe(ready);
  });

  it('同一次翻滾閃過兩下只給一次', () => {
    const { s, p, e, hit } = windup();
    // 複製一隻正在出同一招的怪：兩下在同一個 tick 落下
    const e2: Unit = { ...structuredClone(e), id: 9999 };
    s.units.push(e2);
    s.telegraphs.push({ ...structuredClone(s.telegraphs[0]!), ownerId: e2.id });
    const mp0 = p.mp;
    while (s.tick < hit - 2) step(s, []);
    step(s, [{ type: 'dodge', dx: 0, dy: -100 }]);
    while (s.tick <= hit + 1) step(s, []);
    const ev = s.events.filter((x) => x.type === 'dodged');
    expect(ev.length).toBe(2);
    expect(ev.filter((x) => x.type === 'dodged' && x.mp).length).toBe(1);
    expect(p.mp).toBeLessThan(mp0 + PLAYER.mpGain.dodge * 2); // 中間自己的普攻可能再 +1
  });

  it('復活的無敵時間擋掉的攻擊不算（不是自己閃的）', () => {
    const { s, p, hit } = windup();
    while (s.tick < hit - 1) step(s, []);
    p.invulnUntil = hit + 5;
    const mp0 = p.mp;
    while (s.tick <= hit + 1) step(s, []);
    expect(s.events.some((x) => x.type === 'dodged')).toBe(true);
    expect(p.mp).toBe(mp0);
  });

  it('競技場不給（PvP 平衡不動）', () => {
    const s = createBattle({ stageId: 'pvp_arena', seed: 3 });
    const a = playerOf(s);
    const b = addPlayer(s, { team: 1 });
    a.x = 1000; a.y = 1000; b.x = 1100; b.y = 1000;
    let got = false;
    for (let i = 0; i < 400 && !got; i++) {
      // b 一直普攻 a；a 每次冷卻好就閃
      step(s, [{ type: 'dodge', dx: 0, dy: -100 }]);
      a.x = 1000; a.y = 1000; b.x = 1100; b.y = 1000;
      got = s.events.some((x) => x.type === 'dodged');
    }
    for (const x of s.events) if (x.type === 'dodged') expect('mp' in x && x.mp).toBeFalsy();
  });
});
