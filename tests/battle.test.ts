import { describe, expect, it } from 'vitest';
import {
  availableCommands,
  chooseCommand,
  createBattle,
  currentHero,
  resolveDefense,
  resolveTiming,
  totalLamps,
  type BattleState,
} from '../src/core/battle/engine';
import { damage, MAX_EMBER } from '../src/core/battle/formulas';
import { simulateBattle } from '../src/core/battle/sim';
import { ENEMIES } from '../src/data/combatants';

/** 推進到指定英雄的指令階段；敵方攻擊一律以 results 結算 */
function untilHero(s: BattleState, id: string, def: 'perfect' | 'success' | 'fail' = 'success'): BattleState {
  for (let i = 0; i < 50; i++) {
    if (s.phase === 'playerCommand' && currentHero(s)?.id === id) return s;
    if (s.phase === 'enemyTelegraph') s = resolveDefense(s, s.pendingEnemy!.hits.map(() => def)).state;
    else if (s.phase === 'playerCommand') s = chooseCommand(s, { type: 'guard' }).state;
    else throw new Error(`stuck in ${s.phase}`);
  }
  throw new Error('hero never acted');
}

describe('battle engine', () => {
  it('starts with fastest unit and START_EMBER', () => {
    const { state } = createBattle({ party: [{ id: 'lian', level: 4 }, { id: 'io', level: 4 }], enemies: ['tr_beast'], seed: 1 });
    expect(state.ember).toBe(2);
    expect(state.phase).toBe('playerCommand');
    expect(currentHero(state)?.id).toBe('io');
    expect(state.heroes[0]!.sp).toBe(3); // lian hasn't acted yet
    expect(state.heroes[1]!.sp).toBe(4); // io +1 at turn start
  });

  it('applies attack damage in variance range, weakness grants ember and break', () => {
    let s = createBattle({ party: [{ id: 'lian', level: 4 }], enemies: ['tr_beast'], seed: 7 }).state;
    s = chooseCommand(s, { type: 'attack', target: 0 }).state;
    expect(s.phase).toBe('playerTiming');
    const r = resolveTiming(s, 'good');
    const lian = s.heroes[0]!;
    const base = { atk: lian.atk, def: 2, skillMul: 1, timing: 'good' as const, weak: true };
    const lost = 120 - r.state.enemies[0]!.hp;
    expect(lost).toBeGreaterThanOrEqual(damage({ ...base, variance: 0.95 }));
    expect(lost).toBeLessThanOrEqual(damage({ ...base, variance: 1.05 }));
    expect(r.events.find((e) => e.type === 'damage')).toMatchObject({ weak: true, timing: 'good' });
    expect(r.state.ember).toBe(3); // weak hit +1
    expect(r.state.enemies[0]!.breakGauge).toBe(20);
  });

  it('places lamps (perfect +1), no ember gain, resonance clears all lamps', () => {
    let s = createBattle({
      party: [{ id: 'lian', level: 4 }], enemies: ['tr_beast'], seed: 3, flags: { tutorialEmber: true },
    }).state;
    expect(s.ember).toBe(10);
    s = chooseCommand(s, { type: 'skill', skillId: 'lamp_mark', target: 0 }).state;
    const r1 = resolveTiming(s, 'perfect');
    expect(r1.state.enemies[0]!.lamps).toBe(2);
    expect(r1.state.ember).toBe(9); // spent 1, perfect gives nothing
    expect(r1.events.some((e) => e.type === 'lampPlaced')).toBe(true);
    s = untilHero(r1.state, 'lian', 'success');
    const hpBefore = s.enemies[0]!.hp;
    const emberBefore = s.ember;
    s = chooseCommand(s, { type: 'skill', skillId: 'resonance' }).state;
    const r2 = resolveTiming(s, 'perfect');
    expect(totalLamps(r2.state)).toBe(0);
    expect(r2.state.ember).toBe(emberBefore - 3);
    const res = r2.events.find((e) => e.type === 'resonance');
    expect(res && res.type === 'resonance' && res.perTarget[0]!.lamps).toBe(2);
    expect(r2.state.enemies[0]!.hp).toBeLessThan(hpBefore);
  });

  it('lamp burn ticks at enemy turn start', () => {
    let s = createBattle({ party: [{ id: 'lian', level: 4 }], enemies: ['tr_beast'], seed: 5 }).state;
    s = chooseCommand(s, { type: 'skill', skillId: 'lamp_mark', target: 0 }).state;
    const r = resolveTiming(s, 'good');
    expect(r.events.some((e) => e.type === 'damage' && e.source === 'burn')).toBe(true);
  });

  it('caps ember at MAX_EMBER', () => {
    let s = createBattle({
      party: [{ id: 'lian', level: 4 }], enemies: ['tr_beast'], seed: 3, flags: { tutorialEmber: true },
    }).state;
    s = chooseCommand(s, { type: 'attack', target: 0 }).state;
    s = resolveTiming(s, 'perfect').state;
    expect(s.ember).toBe(MAX_EMBER);
  });

  it('breaks enemy: +2 ember, skips its next action, gauge resets', () => {
    let s = createBattle({ party: [{ id: 'lian', level: 4 }], enemies: ['tr_beast'], seed: 9 }).state;
    s.enemies[0]!.breakGauge = 10;
    s = chooseCommand(s, { type: 'attack', target: 0 }).state;
    const r = resolveTiming(s, 'good');
    expect(r.events.some((e) => e.type === 'break')).toBe(true);
    expect(r.events.some((e) => e.type === 'skip')).toBe(true);
    expect(r.state.ember).toBe(2 + 1 + 2);
    expect(r.state.enemies[0]!.broken).toBe(false);
    expect(r.state.enemies[0]!.breakGauge).toBe(30);
    expect(r.state.phase).toBe('playerCommand');
    expect(r.state.round).toBe(2);
  });

  it('perfect parry negates damage, counters and gives ember', () => {
    let s = createBattle({ party: [{ id: 'lian', level: 4 }], enemies: ['tr_beast'], seed: 11 }).state;
    s = chooseCommand(s, { type: 'guard' }).state;
    expect(s.phase).toBe('enemyTelegraph');
    s.pendingEnemy!.attack = ENEMIES.tr_beast!.attacks[0]!; // white claw
    const hp = s.heroes[0]!.hp;
    const ember = s.ember;
    const r = resolveDefense(s, ['perfect']);
    expect(r.state.heroes[0]!.hp).toBe(hp);
    expect(r.events.some((e) => e.type === 'counter')).toBe(true);
    expect(r.state.enemies[0]!.hp).toBeLessThan(120);
    expect(r.state.ember).toBe(ember + 1);
  });

  it('rourke counter stance counters on a normal parry', () => {
    let s = createBattle({ party: [{ id: 'rourke', level: 4 }], enemies: ['tr_beast'], seed: 2 }).state;
    s = chooseCommand(s, { type: 'skill', skillId: 'counter_stance' }).state;
    s.pendingEnemy!.attack = ENEMIES.tr_beast!.attacks[0]!;
    const r = resolveDefense(s, ['success']);
    expect(r.events.some((e) => e.type === 'counter')).toBe(true);
    expect(r.state.ember).toBe(2); // no perfect → no ember
  });

  it('defeat when all heroes downed', () => {
    let s = createBattle({ party: [{ id: 'lian', level: 4, hp: 1 }], enemies: ['tr_beast'], seed: 4 }).state;
    s = chooseCommand(s, { type: 'attack', target: 0 }).state;
    s = resolveTiming(s, 'miss').state;
    const r = resolveDefense(s, ['fail']);
    expect(r.state.phase).toBe('defeat');
    expect(r.events.some((e) => e.type === 'defeat')).toBe(true);
  });

  it('victory revives downed heroes to 1 HP', () => {
    let s = createBattle({
      party: [{ id: 'lian', level: 4 }, { id: 'io', level: 4, hp: 0 }], enemies: ['tr_beast'], seed: 4,
    }).state;
    expect(currentHero(s)?.id).toBe('lian'); // io downed → skipped
    s.enemies[0]!.hp = 1;
    s = chooseCommand(s, { type: 'attack', target: 0 }).state;
    const r = resolveTiming(s, 'good');
    expect(r.state.phase).toBe('victory');
    expect(r.state.heroes[1]).toMatchObject({ downed: false, hp: 1 });
  });

  it('lists commands with usability', () => {
    const s = createBattle({ party: [{ id: 'lian', level: 4 }], enemies: ['tr_beast'], seed: 1, items: { potion_s: 2 } }).state;
    const cmds = availableCommands(s);
    expect(cmds.find((c) => c.skillId === 'lamp_mark')?.usable).toBe(true);
    expect(cmds.find((c) => c.skillId === 'resonance')?.usable).toBe(false);
    expect(cmds.find((c) => c.skillId === 'guiding_light')).toBeUndefined();
    expect(cmds.find((c) => c.itemId === 'potion_s')).toMatchObject({ usable: true, count: 2 });
    expect(cmds.some((c) => c.type === 'guard')).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const party = [{ id: 'lian' as const, level: 4 }, { id: 'rourke' as const, level: 4 }, { id: 'io' as const, level: 4 }];
    const sk = { attack: { perfect: 0.3, good: 0.5 }, defense: 0.4 };
    expect(simulateBattle(party, 'boss_wolfking', sk, 42)).toEqual(simulateBattle(party, 'boss_wolfking', sk, 42));
    const a = createBattle({ party, enemies: ['boss_wolfking'], seed: 99 });
    const b = createBattle({ party, enemies: ['boss_wolfking'], seed: 99 });
    expect(a).toEqual(b);
  });
});

describe('battle balance sim (boss_wolfking, Lv4 lian/rourke/io)', () => {
  const party = [{ id: 'lian' as const, level: 4 }, { id: 'rourke' as const, level: 4 }, { id: 'io' as const, level: 4 }];
  const run = (label: string, sk: Parameters<typeof simulateBattle>[2]) => {
    const N = 300;
    let wins = 0;
    let rounds = 0;
    let maxRounds = 0;
    let hpLost = 0;
    for (let i = 0; i < N; i++) {
      const r = simulateBattle(party, 'boss_wolfking', sk, 1000 + i);
      if (r.won) wins++;
      rounds += r.rounds;
      hpLost += r.hpLostPct;
      maxRounds = Math.max(maxRounds, r.rounds);
    }
    const out = { winRate: wins / N, avgRounds: rounds / N, maxRounds, avgHpLost: hpLost / N };
    console.log(`[sim] ${label}`, JSON.stringify(out));
    return out;
  };

  it('novice and expert win rates', () => {
    const novice = run('novice', { attack: { perfect: 0.3, good: 0.5 }, defense: 0.4 });
    const expert = run('expert', { attack: { perfect: 0.7, good: 0.25 }, defense: 0.85 });
    expect(novice.maxRounds).toBeLessThanOrEqual(40);
    expect(expert.maxRounds).toBeLessThanOrEqual(40);
    expect(novice.winRate).toBeGreaterThanOrEqual(0.4);
    expect(novice.winRate).toBeLessThanOrEqual(0.99);
    expect(expert.winRate).toBeGreaterThanOrEqual(0.9);
  }, 60_000);
});
