// design/14 階段 2.1：效果框架接進戰鬥引擎與模擬器
import { describe, expect, it } from 'vitest';
import { createBattle } from '../src/core/battle/engine';
import { simulateBattle } from '../src/core/battle/sim';
import type { EffectDef, EffectInstance } from '../src/core/battle/effects';

const party = [{ id: 'lian' as const, level: 6 }, { id: 'serin' as const, level: 6 }, { id: 'io' as const, level: 6 }];
const skill = { attack: { perfect: 0.6, good: 0.3 }, defense: 0.6 };
const eff = (key: string, def: EffectDef, ownerHero = 0): EffectInstance => ({ key, def, ownerHero, origin: 'equipment' });

const perfectEmber: EffectDef = { id: 'pe', trigger: 'OnCritical', ops: [{ op: 'modifyResource', resource: 'ember', delta: 1 }], limit: { count: 1, scope: 'round', owner: 'source' } };
const killHeal: EffectDef = { id: 'kh', trigger: 'OnEnemyKilled', ops: [{ op: 'heal', pct: 10, to: 'team' }], limit: { count: 3, scope: 'battle', owner: 'source' }, who: 'team' };
const echo: EffectDef = { id: 'echo', trigger: 'OnResonance', ops: [{ op: 'extraResonance', scale: 0.5 }], limit: { count: 99, scope: 'action', owner: 'team' }, who: 'team', allowDerived: true };
const bonusDmg: EffectDef = { id: 'bd', trigger: 'OnAttack', ops: [{ op: 'modifyDamage', pct: 20 }], limit: { count: 1, scope: 'action', owner: 'source' } };

describe('效果接進引擎', () => {
  it('沒有效果時戰鬥狀態與原本完全相同', () => {
    const a = createBattle({ party, enemies: ['mist_wolf'], seed: 3 });
    expect(a.state.effects).toBeUndefined();
    expect(a.state.effectBus).toBeUndefined();
  });

  it('模擬器可以載入裝備效果，且會實際觸發', () => {
    const r = simulateBattle(party, 'forest_a', skill, 11, { effects: [eff('lamp#1:pe', perfectEmber), eff('ring#2:kh', killHeal, 1), eff('blade#3:bd', bonusDmg, 1)] });
    expect(r.won).toBe(true);
    expect(r.effectsFired!['lamp#1:pe']).toBeGreaterThan(0);
    expect(r.effectsFired!['ring#2:kh']).toBeGreaterThan(0);
    expect(r.effectsFired!['blade#3:bd']).toBeGreaterThan(0);
  });

  it('加傷害效果讓戰鬥變快（200 場平均回合數不增加）', () => {
    let base = 0;
    let buffed = 0;
    for (let i = 0; i < 200; i++) {
      base += simulateBattle(party, 'forest_a', skill, i).rounds;
      buffed += simulateBattle(party, 'forest_a', skill, i, { effects: [0, 1, 2].map((h) => eff(`bd${h}`, bonusDmg, h)) }).rounds;
    }
    expect(buffed).toBeLessThanOrEqual(base);
  });

  it('「共鳴時再共鳴」裝 3 件也不會無限循環（Boss 戰 100 場都能結束）', () => {
    for (let i = 0; i < 100; i++) {
      const r = simulateBattle(party, 'boss_wolfking', skill, i, { effects: [0, 1, 2].map((h) => eff(`echo${h}`, echo, h)) });
      expect(r.rounds).toBeLessThanOrEqual(40);
    }
  });

  it('同種子同效果 → 結果完全相同', () => {
    const run = () => simulateBattle(party, 'forest_a', skill, 5, { effects: [eff('x', perfectEmber)] });
    expect(run()).toEqual(run());
  });
});
