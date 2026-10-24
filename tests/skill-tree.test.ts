import { describe, expect, it } from 'vitest';
import { availableCommands, chooseCommand, createBattle, resolveTiming, type BattleState } from '../src/core/battle/engine';
import { START_EMBER, START_SP } from '../src/core/battle/formulas';
import { SKILLS } from '../src/core/battle/skills';
import { battleParty, totalBonus } from '../src/core/state/equip';
import { newGame } from '../src/core/state/gameState';
import {
  bossPoints, branchPoints, learn, learnState, learned, missingText, pointsLeft, pointsTotal, rankOf, resetCost, resetTree, treeEffect, treeFor, treeSkills,
} from '../src/core/state/skillTree';
import { BOSS_POINT_KILLS, TREE, TREE_BY_ID } from '../src/data/skillTree';

const HEROES = ['lian', 'serin', 'rourke', 'io', 'liora'] as const;

describe('技能樹 v2 資料', () => {
  it('每人 2 分支 × 6 節點、id 唯一、前置都存在且在同分支、底部是主動技能', () => {
    for (const m of HEROES) {
      const ns = treeFor(m);
      expect(ns.length).toBe(12);
      for (const n of ns) for (const [id, r] of n.requires.nodes ?? []) {
        const p = TREE_BY_ID[id];
        expect(p, id).toBeDefined();
        expect(p!.branch).toBe(n.branch);
        expect(p!.row).toBeLessThan(n.row);
        expect(r).toBeLessThanOrEqual(p!.maxRank);
      }
      const ult = ns.find((n) => n.branch === 0 && n.row === 4)!;
      expect(ult.skill, m).toBeDefined();
      expect(SKILLS[ult.skill!]?.hero).toBe(m);
      expect(SKILLS[ult.skill!]?.tree).toBe(true);
    }
    expect(new Set(TREE.map((n) => n.id)).size).toBe(TREE.length);
  });
  it('門檻可以達成：每條分支照順序都能點到底，且不能點滿全部（要取捨）', () => {
    for (const m of HEROES) {
      const s = newGame();
      s.members[m] = { id: m, level: 40, xp: 0, hp: 100, equipment: {} };
      for (const br of [0, 1] as const) {
        const ns = treeFor(m).filter((n) => n.branch === br).sort((a, b) => a.row - b.row || a.col - b.col);
        for (const n of ns) for (let r = 0; r < n.maxRank; r++) expect(learn(s, m, n.id), `${n.id} r${r + 1}`).toBe(true);
      }
      const all = treeFor(m).reduce((a, n) => a + n.maxRank * n.cost, 0);
      expect(all).toBeGreaterThan(17 + BOSS_POINT_KILLS.length); // 終章約 Lv18 ＋ 全 Boss 也點不滿
    }
  });
});

describe('技能樹 v2 規則', () => {
  it('點數 = 等級 − 1 ＋ Boss 首殺；多等級節點；前置與分支點數', () => {
    const s = newGame();
    expect(pointsTotal(s, 'lian')).toBe(0);
    expect(learnState(s, 'lian', 'lian_0a')).toBe('points');
    s.members.lian!.level = 6;
    s.flags['kill_boss_wolfking'] = true;
    expect(bossPoints(s)).toBe(1);
    expect(pointsLeft(s, 'lian')).toBe(6);
    expect(learnState(s, 'lian', 'lian_0b')).toBe('locked');
    expect(missingText(s, 'lian', TREE_BY_ID['lian_0b']!)).toContain('剪燈芯');
    expect(learn(s, 'lian', 'lian_0a')).toBe(true);
    expect(learn(s, 'lian', 'lian_0b')).toBe(true);
    expect(learnState(s, 'lian', 'lian_0c')).toBe('locked'); // 需要 A Lv2
    expect(learn(s, 'lian', 'lian_0a')).toBe(true);
    expect(rankOf(s, 'lian', 'lian_0a')).toBe(2);
    expect(learnState(s, 'lian', 'lian_0d')).toBe('locked'); // 分支 3 點 < 4
    expect(missingText(s, 'lian', TREE_BY_ID['lian_0d']!)).toContain('此分支 4 點（目前 3）');
    expect(learn(s, 'lian', 'lian_0a')).toBe(true);
    expect(learnState(s, 'lian', 'lian_0a')).toBe('maxed');
    expect(branchPoints(s, 'lian', 0)).toBe(4);
    expect(learn(s, 'lian', 'lian_0d')).toBe(true);
    expect(treeEffect(s, 'lian').atkPct).toBe(9 + 3);
    expect(learnState(s, 'lian', 'serin_0a')).toBe('wrong');
  });
  it('v1 舊存檔的 id 自動退點', () => {
    const s = newGame();
    s.members.lian!.level = 5;
    s.tree = { lian: ['lian_0_1', 'lian_0_2', 'lian_1_1'] };
    expect(learned(s, 'lian')).toEqual([]);
    expect(pointsLeft(s, 'lian')).toBe(4);
  });
  it('重置：營火免費、其他地方要金幣，錢不夠失敗', () => {
    const s = newGame();
    s.members.lian!.level = 4;
    learn(s, 'lian', 'lian_0a');
    learn(s, 'lian', 'lian_0a');
    expect(resetCost(s, 'lian', true)).toBe(0);
    expect(resetCost(s, 'lian', false)).toBe(30);
    s.gold = 10;
    expect(resetTree(s, 'lian', false)).toBe(false);
    expect(learned(s, 'lian').length).toBe(2);
    s.gold = 50;
    expect(resetTree(s, 'lian', false)).toBe(true);
    expect(s.gold).toBe(20);
    expect(pointsLeft(s, 'lian')).toBe(3);
  });
  it('效果進戰鬥：攻擊％、開場 SP、開場星燼', () => {
    const s = newGame();
    s.members.lian!.level = 12;
    const plain = createBattle({ party: battleParty(s), enemies: ['mist_wolf'], seed: 1 }).state;
    for (const id of ['lian_0a', 'lian_0a', 'lian_0b', 'lian_0c', 'lian_0a', 'lian_0d', 'lian_0d', 'lian_0e']) expect(learn(s, 'lian', id), id).toBe(true);
    const st = createBattle({ party: battleParty(s), enemies: ['mist_wolf'], seed: 1 }).state;
    expect(st.heroes[0]!.atk).toBeGreaterThan(plain.heroes[0]!.atk);
    expect(st.heroes[0]!.maxHp).toBe(plain.heroes[0]!.maxHp + totalBonus(s, 'lian').hp);
    expect(st.ember).toBe(START_EMBER + 1);
    expect(st.heroes[0]!.sp).toBeGreaterThanOrEqual(START_SP + 1);
  });
});

describe('技能樹主動技能', () => {
  const run = (hero: (typeof HEROES)[number], skill: string, enemies: string[], timing: 'perfect' | 'good' = 'good', setup?: (st: BattleState) => void) => {
    let st = createBattle({ party: [{ id: hero, level: 15, skills: [skill], perks: ['swift'] }], enemies, seed: 11 }).state;
    st.heroes[0]!.sp = 6;
    st.ember = 6;
    setup?.(st);
    expect(availableCommands(st).some((c) => c.skillId === skill && c.usable), skill).toBe(true);
    const r1 = chooseCommand(st, { type: 'skill', skillId: skill, target: 0 });
    const r2 = resolveTiming(r1.state, timing);
    return { before: st, after: r2.state, events: [...r1.events, ...r2.events] };
  };
  it('沒學就不出現在選單', () => {
    const st = createBattle({ party: [{ id: 'lian', level: 15 }], enemies: ['mist_wolf'], seed: 1 }).state;
    expect(availableCommands(st).some((c) => c.skillId === 'thousand_lamps')).toBe(false);
    const s = newGame();
    s.members.lian!.level = 40;
    expect(treeSkills(s, 'lian')).toEqual([]);
  });
  it('千燈共鳴：補滿燈印並引爆', () => {
    const { after, events } = run('lian', 'thousand_lamps', ['rock_beetle', 'rock_beetle']);
    expect(events.filter((e) => e.type === 'lampPlaced').length).toBe(5);
    const res = events.find((e) => e.type === 'resonance');
    expect(res && res.type === 'resonance' && res.totalLamps).toBe(5);
    expect(after.enemies.every((e) => e.lamps === 0)).toBe(true);
  });
  it('破曉一閃：無視防禦，比普攻痛很多', () => {
    const { before, after } = run('serin', 'dawn_flash', ['star_golem']);
    const dmg = before.enemies[0]!.hp - after.enemies[0]!.hp;
    expect(dmg).toBeGreaterThan(before.heroes[0]!.atk * 2);
  });
  it('梭哈：完美必贏（星燼 +2）', () => {
    const { before, after, events } = run('rourke', 'all_in', ['mist_wolf', 'mist_wolf'], 'perfect');
    expect(events.some((e) => e.type === 'statusApplied' && e.status === 'allInWin')).toBe(true);
    expect(after.heroes[0]!.hp).toBe(before.heroes[0]!.hp);
  });
  it('星之搖籃曲：復活倒地＋淨化', () => {
    let st = createBattle({ party: [{ id: 'io', level: 15, skills: ['star_lullaby'], perks: ['swift'] }, { id: 'lian', level: 15 }], enemies: ['mist_wolf'], seed: 2 }).state;
    st.heroes[0]!.sp = 6;
    st.heroes[1]!.hp = 0;
    st.heroes[1]!.downed = true;
    st.heroes[0]!.status.poison = 3;
    st = resolveTiming(chooseCommand(st, { type: 'skill', skillId: 'star_lullaby' }).state, 'good').state;
    expect(st.heroes[1]!.downed).toBe(false);
    expect(st.heroes[0]!.status.poison).toBe(0);
  });
  it('連鎖大爆破：打全體，燈印加傷', () => {
    const a = run('liora', 'chain_blast', ['rock_beetle', 'rock_beetle']);
    const b = run('liora', 'chain_blast', ['rock_beetle', 'rock_beetle'], 'good', (st) => (st.enemies[0]!.lamps = 3));
    const dA = a.before.enemies[0]!.hp - a.after.enemies[0]!.hp;
    const dB = b.before.enemies[0]!.hp - b.after.enemies[0]!.hp;
    expect(a.after.enemies.every((e, i) => e.hp < a.before.enemies[i]!.hp)).toBe(true);
    expect(dB).toBeGreaterThan(dA);
  });
});
