// 荊棘母樹（D-107）：霧語森林精英狼群區東側、不會動的世界精英。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { validateStage } from '../src/core/battle/rt/maps/validate';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { aggroUnitsOf, sec, UNIT } from '../src/core/battle/rt/types';

const out = (s: string) => (globalThis as unknown as { process: { stdout: { write: (x: string) => void } } }).process.stdout.write(s);

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
});
afterAll(() => {
  delete STAGES.mistwood;
});

describe('荊棘母樹（D-107）', () => {
  it('地圖仍然 0 問題；開場就在精英狼群區東側', () => {
    expect(validateStage(makeMistwoodStage())).toEqual([]);
    const s = createBattle({ stageId: 'mistwood', seed: 1 });
    step(s, []);
    const m = s.units.find((u) => u.defId === 'thorn_mother');
    expect(m).toBeDefined();
    expect(m!.x).toBeGreaterThan(3800);
    expect(m!.y).toBeGreaterThan(2400);
    expect(m!.y).toBeLessThan(4600);
  });

  for (const [prof, level, bonus, limit] of [
    ['normal', 4, { hp: 250, atk: 18, def: 12 }, 600],
    ['novice', 6, { hp: 400, atk: 30, def: 18 }, 900],
  ] as const) {
    it(`${prof} Bot（Lv${level}）走過去打得倒、母樹不會移動、掉兩件精良以上`, () => {
      const s = createBattle({ stageId: 'mistwood', seed: 4, level, bonus });
      const target = { x: 4150, y: 4250 };
      const bot = new PlayerBot({ ...BOT_PROFILES[prof], ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: target }, prof);
      let home: { x: number; y: number } | undefined;
      let moved = 0;
      let killedAt = -1;
      let engaged = -1;
      while (s.tick < sec(limit) && killedAt < 0) {
        const n = s.events.length;
        step(s, bot.decide(s));
        const m = s.units.find((u) => u.defId === 'thorn_mother' && !u.dead);
        if (m) {
          home ??= { x: m.x, y: m.y };
          if (m.x !== home.x || m.y !== home.y) moved++;
          if (engaged < 0 && m.mode === 'combat') engaged = s.tick;
        }
        for (let i = n; i < s.events.length; i++) {
          const e = s.events[i]!;
          if (e.type === 'death' && s.units.find((u) => u.id === e.id)?.defId === 'thorn_mother') killedAt = s.tick;
        }
      }
      const gear = (s.ground ?? []).filter((g) => g.kind === 'gear' && (g.rarity ?? 1) >= 2).length;
      out(`[母樹] ${prof} Lv${level}：交戰 ${engaged >= 0 ? Math.round((killedAt - engaged) / 30) : '-'} 秒、營火醒來 ${s.revives ?? 0}、精良以上 ${gear}\n`);
      expect(killedAt).toBeGreaterThan(0);
      expect(moved).toBe(0);
      expect(gear).toBeGreaterThanOrEqual(2);
    }, 120000);
  }

  it('仇恨半徑縮成 5 格（D-111）：站 6 格外不醒、4 格內會醒', () => {
    // 四個方向有的被樹擋住視線，看「至少一個方向會醒」與「6 格外都不醒」
    const woke = (d: number) => {
      let n = 0;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const s = createBattle({ stageId: 'mistwood', seed: 1 });
        step(s, []);
        const m = s.units.find((u) => u.defId === 'thorn_mother')!;
        expect(aggroUnitsOf(m)).toBe(5);
        const p = s.units[0]!;
        p.x = m.x + dx * d * UNIT;
        p.y = m.y + dy * d * UNIT;
        for (let i = 0; i < 12; i++) step(s, []);
        if (m.mode === 'combat') n++;
      }
      return n;
    };
    expect(woke(6)).toBe(0);
    expect(woke(4)).toBeGreaterThan(0);
  });

  it('往狼王推進的 Bot 預設繞過母樹；huntStationary 才會去打（D-111）', () => {
    for (const hunt of [false, true]) {
      const s = createBattle({ stageId: 'mistwood', seed: 2 });
      const bot = new PlayerBot({ ...BOT_PROFILES.expert, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING, huntStationary: hunt }, 'expert');
      let fought = false;
      while (s.tick < sec(150) && !fought) {
        step(s, bot.decide(s));
        fought = s.units.some((u) => u.defId === 'thorn_mother' && u.mode === 'combat');
      }
      expect(fought).toBe(hunt);
    }
  }, 120000);
});
