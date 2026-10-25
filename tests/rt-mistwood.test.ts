// 霧語森林 48×96（design/22，D-085）：資料檢查＋三種 Bot 從南營地出發、往北推進、打倒狼王。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { validateStage } from '../src/core/battle/rt/maps/validate';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec } from '../src/core/battle/rt/types';

describe('霧語森林', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });

  it('validateStage 0 問題；48×96；六個地區；狼王在 bossZone 內', () => {
    const d = makeMistwoodStage();
    expect(validateStage(d)).toEqual([]);
    expect(d.arena.solid!.rows.length).toBe(96);
    expect(d.zones!.length).toBe(6);
    const z = d.bossZone!;
    expect(Math.hypot(MISTWOOD_KING.x - z.x, MISTWOOD_KING.y - z.y)).toBeLessThan(z.r);
  });

  for (const [name, seed, limitSec] of [['novice', 5, 900], ['normal', 1, 480], ['expert', 2, 480]] as const) {
    it(`${name} Bot 從南營地出發，${limitSec / 60} 分鐘內打倒狼王`, () => {
      const s = createBattle({ stageId: 'mistwood', seed });
      const bot = new PlayerBot({ ...BOT_PROFILES[name], ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, name);
      let kills = 0;
      while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(limitSec)) {
        const n = s.events.length;
        step(s, bot.decide(s));
        for (let i = n; i < s.events.length; i++) {
          const e = s.events[i]!;
          if (e.type === 'death' && e.id !== s.units[0]!.id) kills++;
        }
      }
      (globalThis as any).process.stdout.write(`mistwood ${name}: 狼王 ${(s.tick / 30).toFixed(0)} 秒、營火醒來 ${s.revives ?? 0}、擊殺 ${kills}\n`);
      expect(s.bossKills ?? []).toContain('wolf_king');
    }, 120000);
  }
});
