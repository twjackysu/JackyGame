// 大地圖「刷一圈」耐久測試（design/21 §3 第 5 步的前置）：重生點、營火、沉睡、追擊上限、拉怪判斷一起跑。
// 地圖只存在測試裡（P2 霧語森林本體等 Jacky 試玩回覆，D-065）。
import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBattle, isSolidAt, playerOf, step } from '../src/core/battle/rt/engine';
import { BOT_PROFILES, PlayerBot, summarize, type BotSkill } from '../src/core/battle/rt/sim';
import { STAGES } from '../src/core/battle/rt/data';
import { sec, u } from '../src/core/battle/rt/types';

const W = 48;
const H = 96;
function rows(): string[] {
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const out: string[] = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      const nearCamp = Math.hypot(x - 24, y - 90) < 5 || Math.hypot(x - 24, y - 50) < 5;
      const wall = (y === 70 || y === 30) && x % 16 !== 8 && x % 16 !== 7; // 兩道林牆，各留三個缺口
      r += !nearCamp && (wall || rnd() < 0.05) ? '#' : '.';
    }
    out.push(r);
  }
  return out;
}

describe('大地圖刷怪耐久（重生點＋營火＋沉睡＋拉怪判斷）', () => {
  beforeAll(() => {
    STAGES.test_world = {
      id: 'test_world', name: '測試森林', timeLimitTicks: sec(600), player: { x: u(24), y: u(91) }, mapAi: true, enemies: [],
      reviveAtCampfire: true,
      arena: { w: u(W), h: u(H), solid: { cell: u(1), rows: rows() } },
      campfires: [{ id: 'south', x: u(24), y: u(90) }, { id: 'mid', x: u(24), y: u(50) }],
      spawnGroups: [
        { id: 'wolves_a', enemyId: 'wolf', cx: u(12), cy: u(80), spawnRadius: u(2), maxAlive: 3, respawnTicks: sec(30) },
        { id: 'wolves_b', enemyId: 'wolf', cx: u(36), cy: u(78), spawnRadius: u(2), maxAlive: 3, respawnTicks: sec(30) },
        { id: 'shooters', enemyId: 'thorn_shooter', cx: u(24), cy: u(62), spawnRadius: u(3), maxAlive: 2, respawnTicks: sec(45) },
        { id: 'pack', enemyId: 'wolf', cx: u(12), cy: u(44), spawnRadius: u(2.5), maxAlive: 4, respawnTicks: sec(30) },
        { id: 'alpha', enemyId: 'alpha_wolf', cx: u(38), cy: u(40), spawnRadius: u(1), maxAlive: 1, respawnTicks: sec(180), tier: 'elite' },
        { id: 'north', enemyId: 'wolf', cx: u(24), cy: u(16), spawnRadius: u(3), maxAlive: 4, respawnTicks: sec(30) },
      ],
    };
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
