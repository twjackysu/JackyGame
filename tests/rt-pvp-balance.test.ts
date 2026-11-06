// PvP（Q6＋pvp.ts，24 §6）：競技場兩個玩家不同隊，Bot 互打。
// 驗收：一定分得出勝負或超時、HP ×3／傷害 ×0.5 生效、控制遞減；三武器互打的勝率報表（RT_REPORT=1 印出，寫進 PROGRESS）。
import { describe, expect, it } from 'vitest';
import { addPlayer, createBattle, playerOf, step } from '../src/core/battle/rt/engine';
import { WEAPONS } from '../src/core/battle/rt/data';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { pvpMaxHp } from '../src/core/battle/rt/pvp';

type W = 'sword' | 'bow' | 'staff';
function duel(a: W, b: W, seed: number) {
  const s = createBattle({ stageId: 'pvp_arena', seed, weapon: a === 'sword' ? undefined : a });
  const foe = addPlayer(s, { weapon: b, team: 1, dx: 0, dy: -9 * 120 });
  const bots = [new PlayerBot(BOT_PROFILES.normal!, 'a'), new PlayerBot(BOT_PROFILES.normal!, 'b', 1)];
  // 一開始先指定對方為目標（競技場沒有怪，兩邊都會互追）
  step(s, [{ type: 'target', id: foe.id }, { pid: 1, type: 'target', id: playerOf(s).id }]);
  while (s.outcome === 'running') step(s, bots.flatMap((x) => x.decide(s)));
  return { s, foe };
}

describe('PvP 競技場', () => {
  it('劍對劍：HP 是三倍、打得完、勝負分明或超時', () => {
    const { s, foe } = duel('sword', 'sword', 1);
    expect(s.pvp).toBe(true);
    expect(foe.maxHp).toBe(pvpMaxHp(WEAPONS.sword.player.hp));
    expect(['victory', 'defeat', 'timeout']).toContain(s.outcome);
    expect(s.tick).toBeGreaterThan(30 * 5); // 不會秒殺
  });

  it('三武器互打（各 20 場，左邊先手位置對調一半）', () => {
    const ws: W[] = ['sword', 'bow', 'staff'];
    const rows: string[] = [];
    for (const a of ws)
      for (const b of ws) {
        if (a >= b) continue;
        let wa = 0;
        let wb = 0;
        let to = 0;
        for (let seed = 1; seed <= 20; seed++) {
          const flip = seed % 2 === 0;
          const { s } = duel(flip ? b : a, flip ? a : b, seed);
          const firstWon = s.outcome === 'victory';
          if (s.outcome === 'timeout') to++;
          else if (firstWon !== flip) wa++;
          else wb++;
        }
        rows.push(`| ${a} vs ${b} | ${wa} | ${wb} | ${to} |`);
        expect(wa + wb + to).toBe(20);
      }
    if (process.env.RT_REPORT) console.log(['| 對戰 | 左勝 | 右勝 | 超時 |', '|---|---|---|---|', ...rows].join('\n'));
  }, 120_000);
});
