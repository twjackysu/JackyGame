// 地圖版 Bot「往目標推進」（advanceTo）：清路往前走，而不是只在出生點附近刷。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { makeTestWorldStage } from '../src/core/battle/rt/maps/testWorld';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec, u } from '../src/core/battle/rt/types';

describe('Bot advanceTo', () => {
  beforeAll(() => {
    STAGES.test_world = makeTestWorldStage();
  });
  afterAll(() => {
    delete STAGES.test_world;
  });

  const run = (advance: boolean) => {
    const s = createBattle({ stageId: 'test_world', seed: 2 });
    const bot = new PlayerBot({ ...BOT_PROFILES.expert, potionAtPct: 45, campfireBelowPotions: 8, ...(advance ? { advanceTo: { x: u(24), y: u(10) } } : {}) }, 'expert');
    let minY = s.units[0]!.y;
    let reachedAt = Infinity;
    const northDead = new Set<number>();
    while (s.outcome === 'running' && s.tick < sec(300)) {
      step(s, bot.decide(s));
      minY = Math.min(minY, s.units[0]!.y);
      if (reachedAt === Infinity && s.units[0]!.y < u(31)) reachedAt = s.tick;
      for (const x of s.units) if (x.dead && x.groupId === 'north') northDead.add(x.id);
    }
    return { minY, reachedAt, northKills: northDead.size };
  };

  it('5 分鐘內推進到北林、打倒北邊的狼；比不推進的 Bot 早到', () => {
    const a = run(true);
    const b = run(false);
    expect(a.minY).toBeLessThan(u(31));
    expect(a.northKills).toBeGreaterThan(0);
    expect(a.reachedAt).toBeLessThan(b.reachedAt); // 比只挑最近的怪更早到北林
    (globalThis as any).process.stdout.write(`advance: 北林 ${(a.reachedAt / 30).toFixed(0)} 秒、北邊擊殺 ${a.northKills}；不推進：${b.reachedAt === Infinity ? '沒到' : (b.reachedAt / 30).toFixed(0) + ' 秒'}、${b.northKills}\n`);
  }, 60000);
});

describe('SpawnGroup 區域難度 hpPct／atkPct', () => {
  beforeAll(() => {
    STAGES.test_world = makeTestWorldStage();
  });
  afterAll(() => {
    delete STAGES.test_pct;
    delete STAGES.test_world;
  });
  it('開場與重生的怪都套用加成；沒設的組不變', () => {
    const base = makeTestWorldStage();
    STAGES.test_pct = { ...base, id: 'test_pct', spawnGroups: base.spawnGroups!.map((g) => (g.id === 'north' ? { ...g, hpPct: 50, atkPct: 20 } : g)) };
    const s = createBattle({ stageId: 'test_pct', seed: 1 });
    const plain = createBattle({ stageId: 'test_world', seed: 1 });
    const n = s.units.find((x) => x.groupId === 'north')!;
    const n0 = plain.units.find((x) => x.groupId === 'north')!;
    expect(n.maxHp).toBe(Math.round(n0.maxHp * 1.5));
    expect(n.atk).toBe(Math.round(n0.atk * 1.2));
    const w = s.units.find((x) => x.groupId === 'wolves_a')!;
    const w0 = plain.units.find((x) => x.groupId === 'wolves_a')!;
    expect([w.maxHp, w.atk]).toEqual([w0.maxHp, w0.atk]);
  });
});
