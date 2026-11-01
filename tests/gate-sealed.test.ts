import { describe, expect, it } from 'vitest';
import { gateSealed } from '../src/game/gateRules';

describe('光門封住（D-218）', () => {
  const boss = { boss: true, hp: 900, maxHp: 1000, mode: 'combat' };
  it('Boss 交戰中被打掉血 → 封住', () => {
    expect(gateSealed([boss])).toBe(true);
    expect(gateSealed([{ ...boss, mode: 'returning' }])).toBe(true);
  });
  it('只是跑過滿血的 Boss、Boss 沒在打、Boss 死了、一般怪 → 不封', () => {
    expect(gateSealed([{ ...boss, hp: 1000 }])).toBe(false);
    expect(gateSealed([{ ...boss, mode: 'idle' }])).toBe(false);
    expect(gateSealed([{ ...boss, dead: true }])).toBe(false);
    expect(gateSealed([{ ...boss, boss: false }])).toBe(false);
  });
});
