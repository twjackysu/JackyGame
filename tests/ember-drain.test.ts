import { describe, expect, it } from 'vitest';
import { chooseCommand, createBattle, resolveDefense, type BattleState } from '../src/core/battle/engine';
import { ENEMIES } from '../src/data/combatants';

/** 推到鐘喉蠕蟲出招，並把出招換成「吞噬星燼」、星燼設成 ember */
function devourSetup(ember: number, hpPct = 0.4): BattleState {
  let s = createBattle({
    party: [{ id: 'lian', level: 8 }, { id: 'serin', level: 8 }, { id: 'io', level: 8 }],
    enemies: ['boss_bellworm'], seed: 5,
  }).state;
  for (let i = 0; i < 50 && s.phase !== 'enemyTelegraph'; i++) s = chooseCommand(s, { type: 'guard' }).state;
  expect(s.phase).toBe('enemyTelegraph');
  const atk = ENEMIES.boss_bellworm!.attacks.find((a) => a.id === 'ember_devour')!;
  const boss = s.enemies[0]!;
  boss.hp = Math.round(boss.maxHp * hpPct);
  boss.bossPhase = 2;
  s.ember = ember;
  s.pendingEnemy = { enemy: 0, attack: atk, targets: [0, 1, 2], hits: [0] };
  return s;
}

describe('吞噬星燼 drainEmber', () => {
  it('防守失敗：吸走 3 點星燼並回復 3%/點', () => {
    const s0 = devourSetup(4);
    const hp0 = s0.enemies[0]!.hp;
    const r = resolveDefense(s0, ['fail']);
    expect(r.state.ember).toBe(1);
    const d = r.events.find((e) => e.type === 'emberDrained');
    expect(d && d.type === 'emberDrained' && d.amount).toBe(3);
    expect(r.state.enemies[0]!.hp).toBe(hp0 + Math.round(s0.enemies[0]!.maxHp * 0.09));
  });
  it('防守成功：只吸一半（向上取整）', () => {
    const r = resolveDefense(devourSetup(4), ['success']);
    expect(r.state.ember).toBe(2);
  });
  it('完美防守：不吸，還 +1', () => {
    const r = resolveDefense(devourSetup(2), ['perfect']);
    expect(r.events.some((e) => e.type === 'emberDrained')).toBe(false);
    expect(r.state.ember).toBe(3);
  });
  it('沒有星燼時什麼都不吸', () => {
    const r = resolveDefense(devourSetup(0), ['fail']);
    expect(r.events.some((e) => e.type === 'emberDrained')).toBe(false);
  });
});
