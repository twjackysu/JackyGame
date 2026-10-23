import { describe, expect, it } from 'vitest';
import { availableCommands, chooseCommand, createBattle, currentHero, resolveDefense, resolveTiming, type BattleState } from '../src/core/battle/engine';

function untilHero(s: BattleState, id: string): BattleState {
  for (let i = 0; i < 100; i++) {
    if (s.phase === 'playerCommand' && currentHero(s)?.id === id) return s;
    if (s.phase === 'enemyTelegraph') s = resolveDefense(s, s.pendingEnemy!.hits.map(() => 'perfect')).state;
    else s = chooseCommand(s, { type: 'guard' }).state;
  }
  throw new Error('never');
}

describe('瑟琳/莉歐拉技能與連攜技', () => {
  const party = [{ id: 'lian' as const, level: 9 }, { id: 'serin' as const, level: 9 }, { id: 'liora' as const, level: 9 }];
  it('破陣斬削破防條；爆破術打全體', () => {
    let b = untilHero(createBattle({ party, enemies: ['boss_bellworm'], seed: 3 }).state, 'serin');
    const g0 = b.enemies[0]!.breakGauge;
    b = chooseCommand(b, { type: 'skill', skillId: 'break_slash', target: 0 }).state;
    b = resolveTiming(b, 'perfect').state;
    expect(b.enemies[0]!.breakGauge).toBeLessThanOrEqual(g0 - 30);
    let s = untilHero(createBattle({ party, enemies: ['rock_beetle', 'lamp_wraith'], seed: 3 }).state, 'liora');
    const hp = s.enemies.map((e) => e.hp);
    s = chooseCommand(s, { type: 'skill', skillId: 'blast_art' }).state;
    const r = resolveTiming(s, 'good');
    const dmgTargets = new Set(r.events.filter((e) => e.type === 'damage' && e.target.side === 'enemy').map((e) => (e.type === 'damage' ? e.target.index : -1)));
    expect(dmgTargets.size).toBe(hp.filter((h) => h > 0).length);
  });
  it('連攜技需要連恩在場與 4 星燼，並發出 combo 事件', () => {
    let s = untilHero(createBattle({ party, enemies: ['boss_bellworm'], seed: 3 }).state, 'serin');
    s.ember = 2;
    expect(availableCommands(s).find((c) => c.skillId === 'lamp_slash')?.usable).toBe(false);
    s.ember = 5;
    expect(availableCommands(s).find((c) => c.skillId === 'lamp_slash')?.usable).toBe(true);
    s.heroes.find((h) => h.id === 'lian')!.downed = true;
    expect(availableCommands(s).find((c) => c.skillId === 'lamp_slash')?.usable).toBe(false);
    s.heroes.find((h) => h.id === 'lian')!.downed = false;
    s = chooseCommand(s, { type: 'skill', skillId: 'lamp_slash', target: 0 }).state;
    expect(s.ember).toBe(1);
    const r = resolveTiming(s, 'perfect');
    expect(r.events.some((e) => e.type === 'combo')).toBe(true);
  });
});
