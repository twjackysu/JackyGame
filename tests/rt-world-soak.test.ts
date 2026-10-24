// 大地圖「刷一圈」耐久測試（design/21 §3 第 5 步的前置）：重生點、營火、沉睡、追擊上限、拉怪判斷一起跑。
// 地圖只存在測試裡（P2 霧語森林本體等 Jacky 試玩回覆，D-065）。
import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBattle, isSolidAt, step } from '../src/core/battle/rt/engine';
import { BOT_PROFILES, PlayerBot, summarize, type BotSkill } from '../src/core/battle/rt/sim';
import { STAGES } from '../src/core/battle/rt/data';
import { makeTestWorldStage } from '../src/core/battle/rt/maps/testWorld';

describe('大地圖刷怪耐久（重生點＋營火＋沉睡＋拉怪判斷）', () => {
  beforeAll(() => {
    STAGES.test_world = makeTestWorldStage();
  });
  afterAll(() => {
    delete STAGES.test_world;
  });

  const farm = (prof: BotSkill, name: string, seed: number, potions?: number) => {
    const s = createBattle({ stageId: 'test_world', seed, potions });
    const bot = new PlayerBot(prof, name);
    let stuck = 0;
    const t0 = performance.now();
    while (s.outcome === 'running') {
      step(s, bot.decide(s));
      if (s.tick % 30 === 0) for (const x of s.units) if (!x.dead && isSolidAt(s.arena.solid!, x.x, x.y)) stuck++;
    }
    const ms = (performance.now() - t0) / s.tick;
    const r = summarize(s);
    return { kills: r.kills, revives: s.revives ?? 0, rests: s.events.filter((e) => e.type === 'rest').length, potions: r.potionsUsed, stuck, ms, units: s.units.length, outcome: s.outcome };
  };

  it('三種玩家 Bot 各刷 10 分鐘：持續有擊殺、會回營火補給、沒有單位卡進石頭、效能夠', () => {
    const withCamp = (p: BotSkill): BotSkill => ({ ...p, potionAtPct: 45, campfireBelowPotions: 8 });
    const rs = {
      novice: farm(withCamp(BOT_PROFILES.novice), 'novice', 1),
      normal: farm(withCamp(BOT_PROFILES.normal), 'normal', 2),
      expert: farm(withCamp(BOT_PROFILES.expert), 'expert', 3),
    };
    if (process.env.RT_SOAK_OUT) writeFileSync(process.env.RT_SOAK_OUT, JSON.stringify(rs, null, 1));
    for (const r of Object.values(rs)) {
      expect(r.outcome).toBe('timeout'); // 刷怪地圖不會「勝利」，倒下也會在營火復活
      expect(r.stuck).toBe(0);
      expect(r.kills).toBeGreaterThanOrEqual(30);
      expect(r.units).toBeLessThanOrEqual(1 + 17 + 1); // 陣列不會一直變大
      expect(r.ms).toBeLessThan(1);
    }
    expect(rs.expert.revives).toBe(0);
    expect(rs.expert.kills).toBeGreaterThan(rs.novice.kills);
  }, 120000);

  it('藥水不夠時 Bot 會走回營火休息補滿再出發', () => {
    const r = farm({ ...BOT_PROFILES.normal, potionAtPct: 45, campfireBelowPotions: 8 }, 'normal', 4, 2);
    expect(r.rests).toBeGreaterThanOrEqual(1);
    expect(r.kills).toBeGreaterThanOrEqual(30);
  }, 60000);
});
