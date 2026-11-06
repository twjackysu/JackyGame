// Q6 驗收（23 §Q6）：兩個 Bot 一起打狼王會贏、而且比一個人快；單人的結果不受影響（golden hash 另外守）。
import { describe, expect, it } from 'vitest';
import { addPlayer, createBattle, playerDef, playerOf, skillDef, step } from '../src/core/battle/rt/engine';
import { WEAPONS } from '../src/core/battle/rt/data';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import type { BattleState } from '../src/core/battle/rt/types';

function run(s: BattleState, bots: PlayerBot[], maxTicks = 30 * 600): BattleState {
  for (let t = 0; t < maxTicks && s.outcome === 'running'; t++) step(s, bots.flatMap((b) => b.decide(s)));
  return s;
}

describe('多人協力（Q6）', () => {
  it('兩個 Bot 一起打狼王：會贏、比一個人快；兩個人都有出手', () => {
    let soloWins = 0;
    let duoWins = 0;
    let soloTicks = 0;
    let duoTicks = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const solo = run(createBattle({ stageId: 'wolf_king', seed }), [new PlayerBot(BOT_PROFILES.normal!, 'solo')]);
      if (solo.outcome === 'victory') {
        soloWins++;
        soloTicks += solo.tick;
      }
      const s = createBattle({ stageId: 'wolf_king', seed });
      const p1 = addPlayer(s);
      const dealt = new Map<number, number>();
      const bots = [new PlayerBot(BOT_PROFILES.normal!, 'a'), new PlayerBot(BOT_PROFILES.normal!, 'b', 1)];
      for (let t = 0; t < 30 * 600 && s.outcome === 'running'; t++) {
        step(s, bots.flatMap((b) => b.decide(s)));
        for (const ev of s.events) if (ev.type === 'damage') dealt.set(ev.src, (dealt.get(ev.src) ?? 0) + ev.amount);
        s.events.length = 0;
      }
      if (s.outcome === 'victory') {
        duoWins++;
        duoTicks += s.tick;
      }
      expect(dealt.get(playerOf(s).id) ?? 0).toBeGreaterThan(0);
      expect(dealt.get(p1.id) ?? 0).toBeGreaterThan(0);
    }
    if (process.env.RT_REPORT) console.log({ soloWins, duoWins, solo: soloTicks / Math.max(1, soloWins) / 30, duo: duoTicks / Math.max(1, duoWins) / 30 });
    expect(duoWins).toBeGreaterThanOrEqual(soloWins);
    expect(duoWins).toBeGreaterThan(0);
    expect(duoTicks / duoWins).toBeLessThan(soloTicks / Math.max(1, soloWins));
  }, 60_000);

  it('每個玩家可以帶不同武器：長弓的第二個玩家用弓的技能與數值', () => {
    const s = createBattle({ stageId: 'wolf_king', seed: 3 });
    const bow = addPlayer(s, { weapon: 'bow' });
    expect(skillDef(s, 'charge', bow)?.dash?.distance ?? 0).toBeLessThan(0); // 弓的後躍
    expect(skillDef(s, 'charge')?.dash?.distance ?? 0).toBeGreaterThan(0); // 主角還是劍
    expect(playerDef(s, bow)).toBe(WEAPONS.bow.player);
    expect(bow.maxHp).toBe(WEAPONS.bow.player.hp);
    const bots = [new PlayerBot(BOT_PROFILES.normal!, 'a'), new PlayerBot(BOT_PROFILES.normal!, 'b', 1)];
    run(s, bots);
    expect(s.outcome).toBe('victory');
  }, 60_000);
});
