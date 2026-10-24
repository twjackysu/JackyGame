import { describe, expect, it } from 'vitest';
import {
  DOOM_MARK_SELF,
  availableCommands,
  chooseCommand,
  createBattle,
  resolveDefense,
  type BattleState,
} from '../src/core/battle/engine';
import { simulateBattle } from '../src/core/battle/sim';
import { ENEMIES } from '../src/data/combatants';

/** 推到 Boss 出招，並把出招換成指定招式（階段 2） */
function bossSetup(boss: string, attackId: string, targets: number[]): BattleState {
  let s = createBattle({
    party: [{ id: 'lian', level: 16 }, { id: 'serin', level: 16 }, { id: 'liora', level: 16 }],
    enemies: [boss], seed: 7, flags: { guidingLight: true },
  }).state;
  for (let i = 0; i < 50 && s.phase !== 'enemyTelegraph'; i++) s = chooseCommand(s, { type: 'guard' }).state;
  expect(s.phase).toBe('enemyTelegraph');
  const atk = ENEMIES[boss]!.attacks.find((a) => a.id === attackId)!;
  s.enemies[0]!.bossPhase = 2;
  s.enemies[0]!.hp = Math.round(s.enemies[0]!.maxHp * 0.45);
  s.pendingEnemy = { enemy: 0, attack: atk, targets, hits: atk.hits ?? [0] };
  return s;
}

/** 一直防禦/防守成功，推進 n 個完整回合 */
function passRounds(s: BattleState, n: number): { s: BattleState; events: string[] } {
  const r0 = s.round;
  const events: string[] = [];
  for (let i = 0; i < 200 && s.round < r0 + n && s.phase !== 'defeat' && s.phase !== 'victory'; i++) {
    const r = s.phase === 'playerCommand' ? chooseCommand(s, { type: 'guard' }) : resolveDefense(s, s.pendingEnemy!.hits.map(() => 'perfect'));
    s = r.state;
    events.push(...r.events.map((e) => e.type));
  }
  return { s, events };
}

describe('反燈印（瓦爾德蘭階段 2）', () => {
  it('未完美閃避 → 被標記 3 回合；完美閃避 → 不標記', () => {
    const marked = resolveDefense(bossSetup('boss_valderan', 'inverse_mark', [1]), ['success']).state;
    expect(marked.heroes[1]!.status.doomMark).toBe(3);
    const clean = resolveDefense(bossSetup('boss_valderan', 'inverse_mark', [1]), ['perfect']).state;
    expect(clean.heroes[1]!.status.doomMark).toBe(0);
  });

  it('3 回合後引爆：被標記者 −50% 最大 HP，其他人 −15%', () => {
    let s = resolveDefense(bossSetup('boss_valderan', 'inverse_mark', [1]), ['success']).state;
    // 不讓 Boss 再出反燈印以外的招擾亂：把 Boss 攻擊力歸零
    s.enemies[0]!.atk = 0;
    const hp1 = s.heroes[1]!.hp;
    const { s: after, events } = passRounds(s, 3);
    expect(events).toContain('markDetonate');
    expect(after.heroes[1]!.status.doomMark).toBe(0);
    expect(hp1 - after.heroes[1]!.hp).toBeGreaterThanOrEqual(Math.round(after.heroes[1]!.maxHp * DOOM_MARK_SELF) - 1);
  });

  it('引路之光淨化標記', () => {
    let s = resolveDefense(bossSetup('boss_valderan', 'inverse_mark', [1]), ['success']).state;
    s.enemies[0]!.atk = 0;
    for (let i = 0; i < 50; i++) {
      if (s.phase === 'playerCommand' && s.heroes[s.actor!.index]!.id === 'lian') break;
      s = s.phase === 'playerCommand' ? chooseCommand(s, { type: 'guard' }).state : resolveDefense(s, s.pendingEnemy!.hits.map(() => 'perfect')).state;
    }
    s.heroes[0]!.sp = 6;
    const r = chooseCommand(s, { type: 'skill', skillId: 'guiding_light' });
    expect(r.events.some((e) => e.type === 'markCleansed')).toBe(true);
    expect(r.state.heroes[1]!.status.doomMark).toBe(0);
  });

  it('場上已有標記時不會再出反燈印', () => {
    let s = resolveDefense(bossSetup('boss_valderan', 'inverse_mark', [1]), ['success']).state;
    for (let i = 0; i < 40 && s.heroes[1]!.status.doomMark > 1; i++) {
      if (s.phase === 'enemyTelegraph') expect(s.pendingEnemy!.attack.id).not.toBe('inverse_mark');
      s = s.phase === 'playerCommand' ? chooseCommand(s, { type: 'guard' }).state : resolveDefense(s, s.pendingEnemy!.hits.map(() => 'perfect')).state;
    }
  });

  it('模擬：會淨化的玩家明顯比不淨化的好', () => {
    const party = [{ id: 'lian' as const, level: 16 }, { id: 'serin' as const, level: 16 }, { id: 'liora' as const, level: 16 }];
    const skill = { attack: { perfect: 0.3, good: 0.5 }, defense: 0.6 };
    let winC = 0, winN = 0, lostC = 0, lostN = 0;
    const N = 120;
    for (let i = 0; i < N; i++) {
      const a = simulateBattle(party, 'boss_valderan', skill, 1000 + i, { guidingLight: true, cleanse: true });
      const b = simulateBattle(party, 'boss_valderan', skill, 1000 + i, { guidingLight: true, cleanse: false });
      winC += +a.won; winN += +b.won; lostC += a.hpLostPct; lostN += b.hpLostPct;
    }
    // 新手（防守 60%）：會淨化約 58%（無此機制時 48%，再加不屈之燈補償）；不淨化約 20%
    expect(winC / N).toBeGreaterThan(0.45);
    expect(winC / N).toBeGreaterThan(winN / N + 0.2);
    expect(lostC / N).toBeLessThan(lostN / N);
  });
});

describe('吞噬記憶（蝕星者階段 2）', () => {
  it('防守失敗 → 封印一個技能 2 回合，期間不可用', () => {
    const r = resolveDefense(bossSetup('boss_starfall', 'devour_memory', [0, 1, 2]), ['fail']);
    const ev = r.events.find((e) => e.type === 'skillSealed');
    expect(ev).toBeTruthy();
    if (ev?.type !== 'skillSealed') return;
    const h = r.state.heroes[ev.hero]!;
    expect(h.status.sealed).toBe(ev.skill);
    let s = r.state;
    for (let i = 0; i < 50; i++) {
      if (s.phase === 'playerCommand' && s.actor!.index === ev.hero) break;
      s = s.phase === 'playerCommand' ? chooseCommand(s, { type: 'guard' }).state : resolveDefense(s, s.pendingEnemy!.hits.map(() => 'perfect')).state;
    }
    if (s.heroes[ev.hero]!.status.sealed) {
      const cmd = availableCommands(s).find((c) => c.skillId === ev.skill);
      expect(cmd?.usable).toBe(false);
    }
    const { s: later } = passRounds(s, 3);
    expect(later.heroes[ev.hero]!.status.sealed).toBeNull();
  });
  it('防守成功 → 不封印', () => {
    const r = resolveDefense(bossSetup('boss_starfall', 'devour_memory', [0, 1, 2]), ['success']);
    expect(r.events.some((e) => e.type === 'skillSealed')).toBe(false);
  });
});
