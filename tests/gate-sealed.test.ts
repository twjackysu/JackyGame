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

import { eliteFighting } from '../src/game/gateRules';
describe('巡邏精英纏鬥中（D-234，跨區不報地名）', () => {
  const el = { elite: true, hp: 800, maxHp: 1000, mode: 'combat', dist: 4 };
  it('精英交戰中被打掉血、在 12 格內 → 是', () => {
    expect(eliteFighting([el])).toBe(true);
  });
  it('滿血、沒在打、太遠、死了、一般怪、Boss（另外算） → 否', () => {
    expect(eliteFighting([{ ...el, hp: 1000 }])).toBe(false);
    expect(eliteFighting([{ ...el, mode: 'returning' }])).toBe(false);
    expect(eliteFighting([{ ...el, dist: 15 }])).toBe(false);
    expect(eliteFighting([{ ...el, dead: true }])).toBe(false);
    expect(eliteFighting([{ ...el, elite: false }])).toBe(false);
    expect(eliteFighting([{ ...el, boss: true }])).toBe(false);
  });
});
