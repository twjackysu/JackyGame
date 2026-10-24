import { describe, expect, it } from 'vitest';
import { createBattle } from '../src/core/battle/engine';
import { START_EMBER, START_SP } from '../src/core/battle/formulas';
import { battleParty, totalBonus } from '../src/core/state/equip';
import { newGame } from '../src/core/state/gameState';
import { learn, learnState, pointsLeft, pointsTotal, resetTree, treeEffect, treeFor } from '../src/core/state/skillTree';
import { TREE } from '../src/data/skillTree';

describe('技能樹', () => {
  it('每位角色兩條分支 × 4 階，id 唯一', () => {
    for (const m of ['lian', 'serin', 'rourke', 'io', 'liora'] as const) {
      const ns = treeFor(m);
      expect(ns.length).toBe(8);
      expect(new Set(ns.map((n) => `${n.branch}-${n.tier}`)).size).toBe(8);
    }
    expect(new Set(TREE.map((n) => n.id)).size).toBe(TREE.length);
  });
  it('技能點 = 等級 − 1；要照順序學；點數不夠不能學；重置退回', () => {
    const s = newGame();
    expect(pointsTotal(s, 'lian')).toBe(0);
    expect(learnState(s, 'lian', 'lian_0_1')).toBe('points');
    s.members.lian!.level = 5;
    expect(pointsLeft(s, 'lian')).toBe(4);
    expect(learnState(s, 'lian', 'lian_0_2')).toBe('locked');
    expect(learn(s, 'lian', 'lian_0_1')).toBe(true);
    expect(learn(s, 'lian', 'lian_0_1')).toBe(false);
    expect(learn(s, 'lian', 'lian_0_2')).toBe(true);
    expect(learn(s, 'lian', 'lian_0_3')).toBe(true);
    expect(pointsLeft(s, 'lian')).toBe(1);
    expect(learnState(s, 'lian', 'lian_0_4')).toBe('points'); // 第 4 階 2 點
    expect(learnState(s, 'lian', 'serin_0_1')).toBe('wrong');
    resetTree(s, 'lian');
    expect(pointsLeft(s, 'lian')).toBe(4);
  });
  it('效果進戰鬥：攻擊％、開場 SP、開場星燼', () => {
    const s = newGame();
    s.members.lian!.level = 10;
    const plain = createBattle({ party: battleParty(s), enemies: ['mist_wolf'], seed: 1 }).state;
    for (const id of ['lian_0_1', 'lian_0_2', 'lian_0_3', 'lian_1_1', 'lian_1_2', 'lian_1_3']) expect(learn(s, 'lian', id), id).toBe(true);
    const e = treeEffect(s, 'lian');
    expect(e.atkPct).toBe(14);
    const st = createBattle({ party: battleParty(s), enemies: ['mist_wolf'], seed: 1 }).state;
    expect(st.heroes[0]!.atk).toBeGreaterThan(plain.heroes[0]!.atk);
    expect(st.heroes[0]!.maxHp).toBe(plain.heroes[0]!.maxHp + totalBonus(s, 'lian').hp);
    expect(st.ember).toBe(START_EMBER + 1);
    // 第一個行動者的 SP 可能已經 +1（輪到自己），用 ≥ 比較
    expect(st.heroes[0]!.sp).toBeGreaterThanOrEqual(START_SP + 1);
  });
});
