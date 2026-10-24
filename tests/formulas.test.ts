import { describe, expect, it } from 'vitest';
import {
  HP_CARRY_FROM,
  carriedHp,
  damage,
  defenseMul,
  judgeAttack,
  judgeDefense,
  resonanceMul,
  statsAtLevel,
} from '../src/core/battle/formulas';
import { ENCOUNTERS, ENEMIES, HEROES } from '../src/data/combatants';

describe('battle formulas', () => {
  it('stats grow per 03 §7.1', () => {
    expect(statsAtLevel(HEROES.lian.base, 1)).toMatchObject({ hp: 90, atk: 14, def: 8 });
    expect(statsAtLevel(HEROES.lian.base, 4)).toMatchObject({ hp: 122, atk: 18, def: 10 });
  });

  it('damage uses proportional defense', () => {
    expect(damage({ atk: 40, def: 40, skillMul: 1 })).toBe(20);
    expect(damage({ atk: 40, def: 0, skillMul: 1, timing: 'perfect', weak: true })).toBe(90);
    expect(damage({ atk: 1, def: 999, skillMul: 0.1 })).toBe(1);
  });

  it('resonance multiplier: 5 lamps on one target = 3.2x', () => {
    expect(resonanceMul(5, 5)).toBeCloseTo(3.2);
    expect(resonanceMul(1, 1)).toBeCloseTo(0.4);
    expect(resonanceMul(0, 3)).toBe(0);
  });

  it('judges attack timing windows', () => {
    expect(judgeAttack(50)).toBe('perfect');
    expect(judgeAttack(-120)).toBe('good');
    expect(judgeAttack(200)).toBe('miss');
    expect(judgeAttack(50, 0.7)).toBe('good'); // 霧中窗口縮小
  });

  it('judges defense by telegraph color', () => {
    expect(judgeDefense('white', { kind: 'tap', deltaMs: -30 })).toBe('perfect');
    expect(judgeDefense('white', { kind: 'tap', deltaMs: 120 })).toBe('success');
    expect(judgeDefense('white', { kind: 'swipe', deltaMs: 0 })).toBe('fail');
    expect(judgeDefense('red', { kind: 'swipe', deltaMs: -200 })).toBe('success');
    expect(judgeDefense('red', { kind: 'swipe', deltaMs: 100 })).toBe('fail');
    expect(judgeDefense('purple', { kind: 'hold', deltaMs: -300, holdUntilImpact: true })).toBe('success');
    expect(judgeDefense('purple', { kind: 'hold', deltaMs: -300, holdUntilImpact: false })).toBe('fail');
    expect(defenseMul('white', 'success')).toBeCloseTo(0.3);
    expect(defenseMul('red', 'success')).toBe(0);
  });

  it('wolf king pounce ≈ 21% of Lv4 Lian MaxHP (09 target)', () => {
    const lian = statsAtLevel(HEROES.lian.base, 4);
    const k = ENEMIES.boss_wolfking!;
    const d = damage({ atk: k.atk, def: lian.def, skillMul: 1 });
    expect(d / lian.hp).toBeGreaterThan(0.18);
    expect(d / lian.hp).toBeLessThan(0.24);
  });

  it('every encounter references known enemies', () => {
    for (const ids of Object.values(ENCOUNTERS)) for (const id of ids) expect(ENEMIES[id]).toBeDefined();
  });
});

describe('carriedHp 連戰帶傷', () => {
  it('上一段 HP% + 20%，介於 35%–100%', () => {
    expect(carriedHp(200, undefined)).toBe(200);
    expect(carriedHp(200, 0.5)).toBe(140);
    expect(carriedHp(200, 0)).toBe(70);
    expect(carriedHp(200, 0.95)).toBe(200);
    expect(HP_CARRY_FROM.rourke_3).toBe('rourke_2');
  });
});
