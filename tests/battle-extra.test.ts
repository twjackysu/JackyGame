import { describe, expect, it } from 'vitest';
import {
  availableCommands,
  chooseCommand,
  createBattle,
  currentHero,
  resolveDefense,
  resolveTiming,
  type BattleEvent,
  type BattleState,
} from '../src/core/battle/engine';
import { damage, type DefenseResult } from '../src/core/battle/formulas';
import { ENEMIES } from '../src/data/combatants';

const LV4_PARTY = [{ id: 'lian' as const, level: 4 }, { id: 'rourke' as const, level: 4 }, { id: 'io' as const, level: 4 }];

/** 推進到指定英雄的指令階段；敵方攻擊一律以 def 結算，其餘英雄防禦 */
function untilHero(s: BattleState, id: string, def: DefenseResult = 'success', log?: BattleEvent[]): BattleState {
  for (let i = 0; i < 100; i++) {
    if (s.phase === 'playerCommand' && currentHero(s)?.id === id) return s;
    let r;
    if (s.phase === 'enemyTelegraph') r = resolveDefense(s, s.pendingEnemy!.hits.map(() => def));
    else if (s.phase === 'playerCommand') r = chooseCommand(s, { type: 'guard' });
    else throw new Error(`stuck in ${s.phase}`);
    log?.push(...r.events);
    s = r.state;
  }
  throw new Error('hero never acted');
}

/** 全員防禦、敵方攻擊以 def 結算，直到 stop 成立或戰鬥結束 */
function drive(s: BattleState, stop: (s: BattleState) => boolean, def: DefenseResult = 'perfect', log?: BattleEvent[]): BattleState {
  for (let i = 0; i < 500; i++) {
    if (stop(s) || s.phase === 'victory' || s.phase === 'defeat') return s;
    let r;
    if (s.phase === 'enemyTelegraph') r = resolveDefense(s, s.pendingEnemy!.hits.map(() => def));
    else if (s.phase === 'playerCommand') r = chooseCommand(s, { type: 'guard' });
    else throw new Error(`stuck in ${s.phase}`);
    log?.push(...r.events);
    s = r.state;
  }
  throw new Error('drive did not stop');
}

const usable = (s: BattleState, skillId: string) => availableCommands(s).find((c) => c.skillId === skillId)?.usable;
const telegraphs = (ev: BattleEvent[]) => ev.filter((e): e is Extract<BattleEvent, { type: 'telegraph' }> => e.type === 'telegraph');

describe('io: rewind (回溯)', () => {
  /** io + lian vs tr_beast：io、lian 防禦後，野獸以 ram 攻擊 lian（失敗），回到 round 2 io 的回合 */
  function afterHit(lianHp?: number) {
    let s = createBattle({ party: [{ id: 'io', level: 4 }, { id: 'lian', level: 4 }], enemies: ['tr_beast'], seed: 21 }).state;
    expect(currentHero(s)?.id).toBe('io');
    expect(usable(s, 'rewind')).toBe(false); // 尚無快照
    s = chooseCommand(s, { type: 'guard' }).state;
    s = chooseCommand(s, { type: 'guard' }).state;
    expect(s.phase).toBe('enemyTelegraph');
    s.pendingEnemy!.attack = ENEMIES.tr_beast!.attacks[1]!; // ram
    s.pendingEnemy!.targets = [1];
    s.pendingEnemy!.hits = [0];
    s.heroes[1]!.status.guarding = false;
    if (lianHp !== undefined) s.heroes[1]!.hp = lianHp;
    const before = s.heroes.map((h) => h.hp);
    s = resolveDefense(s, ['fail']).state;
    expect(currentHero(s)?.id).toBe('io');
    s.ember = 10;
    return { s, before };
  }

  it('restores HP to the pre-attack snapshot and costs 5 ember', () => {
    const { s, before } = afterHit();
    expect(s.heroes[1]!.hp).toBeLessThan(before[1]!);
    expect(usable(s, 'rewind')).toBe(true);
    const r = chooseCommand(s, { type: 'skill', skillId: 'rewind' });
    expect(r.state.heroes[1]!.hp).toBe(before[1]);
    expect(r.events.some((e) => e.type === 'heal' && e.target.index === 1 && e.amount === before[1]! - s.heroes[1]!.hp)).toBe(true);
    expect(r.state.ember).toBe(5);
    expect(r.events).toContainEqual({ type: 'ember', delta: -5, total: 5 });
    expect(r.state.usedOnce).toContain('rewind');
    expect(r.state.rewindSnapshot).toBeNull();
  });

  it('revives a hero downed by that attack', () => {
    const { s } = afterHit(5);
    expect(s.heroes[1]!.downed).toBe(true);
    expect(s.heroes[1]!.hp).toBe(0);
    const r = chooseCommand(s, { type: 'skill', skillId: 'rewind' });
    expect(r.state.heroes[1]).toMatchObject({ downed: false, hp: 5 });
    expect(r.events).toContainEqual({ type: 'revived', target: { side: 'hero', index: 1 }, hp: 5 });
  });

  it('is once per battle', () => {
    const { s } = afterHit();
    let t = chooseCommand(s, { type: 'skill', skillId: 'rewind' }).state;
    t = untilHero(t, 'io', 'fail');
    expect(t.rewindSnapshot).not.toBeNull(); // 新的敵方攻擊產生了新快照
    t.ember = 10;
    expect(usable(t, 'rewind')).toBe(false);
    expect(() => chooseCommand(t, { type: 'skill', skillId: 'rewind' })).toThrow();
  });

  it('is unusable with less than 5 ember', () => {
    const { s } = afterHit();
    s.ember = 4;
    expect(usable(s, 'rewind')).toBe(false);
  });
});

describe('io: silence (靜默)', () => {
  it('only usable when an enemy is howling, and clears howl', () => {
    let s = createBattle({ party: [{ id: 'io', level: 4 }], enemies: ['mist_wolf'], seed: 8 }).state;
    expect(currentHero(s)?.id).toBe('io');
    expect(usable(s, 'silence')).toBe(false);
    expect(() => chooseCommand(s, { type: 'skill', skillId: 'silence' })).toThrow();
    s.enemies[0]!.status.howl = 2;
    expect(usable(s, 'silence')).toBe(true);
    const sp = s.heroes[0]!.sp;
    const r = chooseCommand(s, { type: 'skill', skillId: 'silence' });
    expect(r.state.enemies[0]!.status.howl).toBe(0);
    expect(r.state.heroes[0]!.sp).toBe(sp - 2);
    expect(r.events).toContainEqual({ type: 'statusApplied', target: { side: 'enemy', index: 0 }, status: 'silenced' });
  });

  it('targets the howling enemy even if another target is given', () => {
    const s = createBattle({ party: [{ id: 'io', level: 4 }], enemies: ['mist_wolf', 'mist_wolf'], seed: 8 }).state;
    s.enemies[1]!.status.howl = 2;
    const r = chooseCommand(s, { type: 'skill', skillId: 'silence', target: 0 });
    expect(r.state.enemies[1]!.status.howl).toBe(0);
  });
});

describe('lian: guiding_light (引路之光)', () => {
  it('requires the guidingLight flag', () => {
    let s = createBattle({ party: [{ id: 'io', level: 4 }, { id: 'lian', level: 4 }], enemies: ['tr_beast'], seed: 3 }).state;
    s = chooseCommand(s, { type: 'guard' }).state;
    expect(currentHero(s)?.id).toBe('lian');
    expect(availableCommands(s).find((c) => c.skillId === 'guiding_light')).toBeUndefined();
    expect(() => chooseCommand(s, { type: 'skill', skillId: 'guiding_light' })).toThrow();
  });

  it('reveals weakness, empowers other allies, next attack x1.3 then clears', () => {
    let s = createBattle({
      party: [{ id: 'io', level: 4 }, { id: 'lian', level: 4 }], enemies: ['tr_beast'], seed: 3, flags: { guidingLight: true },
    }).state;
    s = chooseCommand(s, { type: 'guard' }).state;
    expect(currentHero(s)?.id).toBe('lian');
    expect(usable(s, 'guiding_light')).toBe(true);
    const r = chooseCommand(s, { type: 'skill', skillId: 'guiding_light' });
    expect(r.events).toContainEqual({ type: 'statusApplied', target: { side: 'enemy', index: 0 }, status: 'weakRevealed', rounds: 2 });
    s = r.state;
    expect(s.enemies[0]!.status.weakRevealed).toBe(2);
    expect(s.heroes[0]!.status.empowered).toBe(true); // io
    expect(s.heroes[1]!.status.empowered).toBe(false); // lian 自己不受影響
    expect(s.heroes[1]!.sp).toBe(4 - 2);

    s = untilHero(s, 'io', 'perfect');
    expect(s.heroes[0]!.status.empowered).toBe(true);
    const io = s.heroes[0]!;
    const beast = s.enemies[0]!;
    const hp0 = beast.hp;
    s = chooseCommand(s, { type: 'attack', target: 0 }).state;
    const after = resolveTiming(s, 'good').state;
    const lost = hp0 - after.enemies[0]!.hp;
    const base = { atk: io.atk, def: beast.def, timing: 'good' as const };
    expect(lost).toBeGreaterThanOrEqual(damage({ ...base, skillMul: 0.9 * 1.3, variance: 0.95 }));
    expect(lost).toBeLessThanOrEqual(damage({ ...base, skillMul: 0.9 * 1.3, variance: 1.05 }));
    expect(lost).toBeGreaterThan(damage({ ...base, skillMul: 0.9, variance: 1.05 }));
    expect(after.heroes[0]!.status.empowered).toBe(false);
  });
});

describe('rourke: veteran_instinct (老兵的直覺)', () => {
  it('adds 200ms telegraph lead for 2 rounds', () => {
    let s = createBattle({ party: [{ id: 'rourke', level: 4 }], enemies: ['tr_beast'], seed: 5 }).state;
    expect(currentHero(s)?.id).toBe('rourke');
    const r1 = chooseCommand(s, { type: 'skill', skillId: 'veteran_instinct' });
    expect(r1.state.round).toBe(1);
    expect(telegraphs(r1.events)[0]?.leadBonusMs).toBe(200);
    s = resolveDefense(r1.state, ['perfect']).state;
    expect(s.round).toBe(2);
    const r2 = chooseCommand(s, { type: 'guard' });
    expect(telegraphs(r2.events)[0]?.leadBonusMs).toBe(200);
    s = resolveDefense(r2.state, ['perfect']).state;
    expect(s.round).toBe(3);
    const r3 = chooseCommand(s, { type: 'guard' });
    expect(telegraphs(r3.events)[0]?.leadBonusMs).toBe(0);
    expect(r3.state.telegraphLeadBonusMs).toBe(0);
  });
});

describe('rourke: counter_stance (反擊架勢)', () => {
  function whiteTelegraph(stance: boolean) {
    const s = createBattle({ party: [{ id: 'rourke', level: 4 }], enemies: ['tr_beast'], seed: 2 }).state;
    const r = chooseCommand(s, stance ? { type: 'skill', skillId: 'counter_stance' } : { type: 'guard' });
    expect(r.state.phase).toBe('enemyTelegraph');
    r.state.pendingEnemy!.attack = ENEMIES.tr_beast!.attacks[0]!; // white claw
    r.state.pendingEnemy!.hits = [0];
    return r.state;
  }

  it('success parry with stance counters', () => {
    const s = whiteTelegraph(true);
    expect(s.heroes[0]!.status.counterStance).toBe(true);
    const r = resolveDefense(s, ['success']);
    const c = r.events.find((e) => e.type === 'counter');
    expect(c).toMatchObject({ type: 'counter', hero: 0, enemy: 0 });
    expect(r.state.enemies[0]!.hp).toBeLessThan(120);
  });

  it('success parry without stance does not counter, perfect does', () => {
    const s = whiteTelegraph(false);
    expect(resolveDefense(s, ['success']).events.some((e) => e.type === 'counter')).toBe(false);
    expect(resolveDefense(s, ['perfect']).events.some((e) => e.type === 'counter')).toBe(true);
  });

  it('stance does not counter a failed parry or a red telegraph', () => {
    const s = whiteTelegraph(true);
    expect(resolveDefense(s, ['fail']).events.some((e) => e.type === 'counter')).toBe(false);
    s.pendingEnemy!.attack = ENEMIES.tr_beast!.attacks[1]!; // red ram
    expect(resolveDefense(s, ['success']).events.some((e) => e.type === 'counter')).toBe(false);
  });

  it('stance resets at rourke next turn start', () => {
    const s = whiteTelegraph(true);
    const t = resolveDefense(s, ['perfect']).state;
    expect(currentHero(t)?.id).toBe('rourke');
    expect(t.heroes[0]!.status.counterStance).toBe(false);
  });
});

describe('boss_wolfking', () => {
  it('acts twice per round', () => {
    const log: BattleEvent[] = [];
    const s = createBattle({ party: LV4_PARTY, enemies: ['boss_wolfking'], seed: 77 });
    log.push(...s.events);
    drive(s.state, (t) => t.round > 5, 'perfect', log);
    const perRound = new Map<number, number>();
    for (const e of log) {
      if (e.type === 'turnStart' && e.actor.side === 'enemy') perRound.set(e.round, (perRound.get(e.round) ?? 0) + 1);
    }
    for (let r = 1; r <= 5; r++) expect(perRound.get(r)).toBe(2);
  });

  it('phase-2 attacks never appear in phase 1', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = createBattle({ party: LV4_PARTY, enemies: ['boss_wolfking'], seed }).state;
      for (let i = 0; i < 200 && s.phase !== 'victory' && s.phase !== 'defeat'; i++) {
        if (s.phase === 'enemyTelegraph') {
          if (s.enemies[0]!.bossPhase === 1) expect(['pounce', 'claws']).toContain(s.pendingEnemy!.attack.id);
          s = resolveDefense(s, s.pendingEnemy!.hits.map(() => 'perfect')).state;
        } else s = chooseCommand(s, { type: 'guard' }).state;
      }
    }
  });

  /** 第 1 回合由 lian 完美攻擊把 Boss 打到 50% 以下 */
  function toPhase2(seed: number) {
    let s = createBattle({ party: LV4_PARTY, enemies: ['boss_wolfking'], seed }).state;
    s = untilHero(s, 'lian');
    expect(s.round).toBe(1);
    s.enemies[0]!.hp = 240;
    s = chooseCommand(s, { type: 'attack', target: 0 }).state;
    return resolveTiming(s, 'perfect');
  }

  it('below 50% HP: phaseChange, fog windowScale 0.7 for 3 rounds', () => {
    const r = toPhase2(5);
    expect(r.events).toContainEqual({ type: 'phaseChange', enemy: 0, phase: 2 });
    expect(r.state.enemies[0]!.bossPhase).toBe(2);
    expect(r.state.windowScale).toBe(0.7);
    expect(r.state.fogRounds).toBe(3);
    const log: BattleEvent[] = [...r.events];
    let s = drive(r.state, (t) => t.round >= 3, 'perfect', log);
    expect(s.windowScale).toBe(0.7);
    const tg = telegraphs(log);
    expect(tg.length).toBeGreaterThan(0);
    for (const t of tg) expect(t.windowScale).toBe(0.7);
    s = drive(s, (t) => t.round >= 4, 'perfect');
    expect(s.windowScale).toBe(1);
    expect(s.fogRounds).toBe(0);
    // phaseChange 只發生一次
    const later: BattleEvent[] = [];
    drive(s, (t) => t.round >= 6, 'perfect', later);
    expect(later.some((e) => e.type === 'phaseChange')).toBe(false);
  });

  it('phase 2 uses fog_raid (aoe) and lunge', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20 && seen.size < 2; seed++) {
      const r = toPhase2(seed);
      const log: BattleEvent[] = [...r.events];
      drive(r.state, (t) => t.round >= 8, 'perfect', log);
      for (const t of telegraphs(log)) {
        if (t.attack === 'fog_raid') {
          seen.add('fog_raid');
          expect(t.targets).toEqual([0, 1, 2]);
          expect(t.telegraph).toBe('purple');
        }
        if (t.attack === 'lunge') {
          seen.add('lunge');
          expect(t.targets).toHaveLength(1);
        }
      }
    }
    expect(seen).toEqual(new Set(['fog_raid', 'lunge']));
  });
});

describe('umbra_boar wallCrash', () => {
  function boarTelegraph(attackIdx: number) {
    const s = createBattle({ party: [{ id: 'rourke', level: 4 }], enemies: ['umbra_boar'], seed: 13 }).state;
    const t = chooseCommand(s, { type: 'guard' }).state;
    expect(t.phase).toBe('enemyTelegraph');
    t.pendingEnemy!.attack = ENEMIES.umbra_boar!.attacks[attackIdx]!;
    t.pendingEnemy!.hits = [0];
    return t;
  }

  it('dodging charge reduces break gauge by 20', () => {
    const s = boarTelegraph(0);
    expect(s.enemies[0]!.breakGauge).toBe(40);
    expect(resolveDefense(s, ['success']).state.enemies[0]!.breakGauge).toBe(20);
    expect(resolveDefense(s, ['perfect']).state.enemies[0]!.breakGauge).toBe(20);
    expect(resolveDefense(s, ['fail']).state.enemies[0]!.breakGauge).toBe(40);
  });

  it('dodging charge can break the boar', () => {
    const s = boarTelegraph(0);
    s.enemies[0]!.breakGauge = 15;
    const r = resolveDefense(s, ['success']);
    expect(r.events).toContainEqual({ type: 'break', target: 0 });
  });

  it('other attacks do not reduce break gauge', () => {
    const s = boarTelegraph(1); // umbra_bite
    expect(resolveDefense(s, ['success']).state.enemies[0]!.breakGauge).toBe(40);
  });
});

describe('taunt', () => {
  it('single-target enemy attacks target the taunting hero', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let s = createBattle({ party: LV4_PARTY, enemies: ['mist_wolf', 'mist_wolf'], seed }).state;
      s = untilHero(s, 'rourke', 'perfect');
      expect(s.round).toBe(1);
      const r = chooseCommand(s, { type: 'skill', skillId: 'taunt' });
      expect(r.events).toContainEqual({ type: 'statusApplied', target: { side: 'hero', index: 1 }, status: 'taunt', rounds: 2 });
      const log: BattleEvent[] = [...r.events];
      drive(r.state, (t) => t.round >= 3, 'perfect', log);
      const tg = telegraphs(log);
      expect(tg.length).toBeGreaterThan(0);
      for (const t of tg) expect(t.targets).toEqual([1]);
    }
  });

  it('taunt expires: without it targets vary', () => {
    const targets = new Set<number>();
    for (let seed = 1; seed <= 10; seed++) {
      const log: BattleEvent[] = [];
      const c = createBattle({ party: LV4_PARTY, enemies: ['mist_wolf', 'mist_wolf'], seed });
      log.push(...c.events);
      drive(c.state, (t) => t.round >= 3, 'perfect', log);
      for (const t of telegraphs(log)) t.targets.forEach((i) => targets.add(i));
    }
    expect(targets.size).toBeGreaterThan(1);
  });
});
