// 星隕高原（D-138）：第四張大地圖＝通關後的挑戰地圖。驗證、開放順序（燼紅裂谷之後）、通關演出仍固定在裂谷、
// 墜星（vents）規則、三種 Bot 打倒星骸守望者、東路、暴怒、深夜耐久。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, isSolidAt, setBossFury, step } from '../src/core/battle/rt/engine';
import { STARFALL_SENTINEL, STARFALL_STARS, makeStarfallStage } from '../src/core/battle/rt/maps/starfall';
import { validateStage } from '../src/core/battle/rt/maps/validate';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec, u } from '../src/core/battle/rt/types';
import { LINKED_MAPS, nextGoal } from '../src/game/rtRecord';
import { FINALE_MAP, prevMap, worldMap } from '../src/game/worldMaps';
import { finaleStats } from '../src/game/finaleStats';

const GEAR = { hp: 600, atk: 55, def: 28 };
const out = (t: string) => (globalThis as any).process.stdout.write(t + '\n');

describe('星隕高原', () => {
  beforeAll(() => {
    STAGES.starfall = makeStarfallStage();
  });
  afterAll(() => {
    delete STAGES.starfall;
  });

  it('validateStage 0 問題；守望者在巢穴內；裂谷打倒岩王後開放；通關演出還是在裂谷；進度掛在霧語森林', () => {
    const st = makeStarfallStage();
    expect(validateStage(st)).toEqual([]);
    expect(Math.hypot(STARFALL_SENTINEL.x - st.bossZone!.x, STARFALL_SENTINEL.y - st.bossZone!.y)).toBeLessThan(st.bossZone!.r);
    expect(prevMap('starfall')?.id).toBe('emberrift');
    expect(worldMap('starfall')?.postGame).toBe(true);
    expect(FINALE_MAP).toBe('emberrift');
    expect(LINKED_MAPS.starfall).toBe('mistwood');
    expect(nextGoal('emberrift', { bossKills: 1 }, 12, 0)).toBe('前往星隕高原，打倒星骸守望者');
    expect(nextGoal('starfall', {}, 14, 0)).toBe('穿過墜星原往北，打倒星骸守望者');
    // 落點都在空地上
    for (const v of STARFALL_STARS) expect(isSolidAt(st.arena.solid!, v.x, v.y)).toBe(false);
  });

  it('通關旅程：還沒打倒守望者時不列出來，打倒過才列', () => {
    expect(finaleStats({}).bosses.map((b) => b.name)).not.toContain('星骸守望者');
    expect(finaleStats({ starfall: { bossKills: 1, bestBossSec: 200 } }).bosses.map((b) => b.name)).toContain('星骸守望者');
  });

  for (const [name, seed, level, limitSec] of [['novice', 1, 16, 900], ['normal', 1, 14, 900], ['expert', 2, 14, 600]] as const) {
    it(`${name} Bot（Lv${level}＋裝備）從高原營地出發打倒星骸守望者、沒有單位卡進晶簇`, () => {
      const s = createBattle({ stageId: 'starfall', seed, level, bonus: GEAR });
      const bot = new PlayerBot({ ...BOT_PROFILES[name], ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: STARFALL_SENTINEL }, name);
      let inSolid = 0;
      let stars = 0;
      while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(limitSec)) {
        const n = s.events.length;
        step(s, bot.decide(s));
        for (let i = n; i < s.events.length; i++) if (s.events[i]!.type === 'vent') stars++;
        for (const x of s.units) if (!x.dead && isSolidAt(s.arena.solid!, x.x, x.y)) inSolid++;
      }
      const blinks = s.events.filter((e) => e.type === 'telegraph' && e.attack === 'sentinel_blink').length;
      out(`starfall ${name} Lv${level}: 守望者 ${(s.tick / 30).toFixed(0)} 秒、營火醒來 ${s.revives ?? 0}、等級 ${s.prog?.level}、墜星 ${stars}、背刺 ${blinks}`);
      expect(s.bossKills ?? []).toContain('star_sentinel');
      expect(inSolid).toBe(0);
    }, 240000);
  }

  it('東路（碎星迴廊）也走得通', () => {
    const s = createBattle({ stageId: 'starfall', seed: 3, level: 15, bonus: GEAR });
    const hall = { x: u(37) + 50, y: u(45) + 50 };
    let bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: hall }, 'normal');
    let reached = -1;
    while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(900)) {
      step(s, bot.decide(s));
      const p = s.units[0]!;
      if (reached < 0 && Math.hypot(p.x - hall.x, p.y - hall.y) < u(3)) {
        reached = s.tick;
        bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: STARFALL_SENTINEL }, 'normal');
      }
    }
    out(`starfall 東路：到迴廊 ${(reached / 30).toFixed(0)} 秒、守望者 ${(s.tick / 30).toFixed(0)} 秒`);
    expect(reached).toBeGreaterThan(0);
    expect(s.bossKills ?? []).toContain('star_sentinel');
  }, 240000);

  it('暴怒守望者：Lv18＋好裝備的普通 Bot 打得倒，暴怒招有出現', () => {
    const s = createBattle({ stageId: 'starfall', seed: 1, level: 18, bonus: { hp: 1300, atk: 100, def: 50 } });
    expect(setBossFury(s, true)).toBe(true);
    const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: STARFALL_SENTINEL }, 'normal');
    while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(900)) step(s, bot.decide(s));
    const furyAtk = s.events.filter((e) => e.type === 'telegraph' && (e.attack === 'sentinel_lance2' || e.attack === 'sentinel_starfall')).length;
    out(`暴怒守望者：${Math.round(s.tick / 30)} 秒、倒下 ${s.revives ?? 0}、暴怒招 ${furyAtk}`);
    expect(s.bossKills ?? []).toContain('star_sentinel');
    expect(furyAtk).toBeGreaterThan(0);
  }, 240000);

  it('深夜的高原刷 6 分鐘：單位有上限、不卡晶簇、有怪可打', () => {
    const s = createBattle({ stageId: 'starfall', seed: 3, level: 16, bonus: GEAR, night: true });
    const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: STARFALL_SENTINEL, huntStationary: true }, 'normal');
    let maxUnits = 0;
    let inSolid = 0;
    let kills = 0;
    while (s.tick < sec(360) && s.outcome === 'running') {
      const n = s.events.length;
      step(s, bot.decide(s));
      for (let i = n; i < s.events.length; i++) {
        const e = s.events[i]!;
        if (e.type === 'death' && e.id !== s.units[0]!.id) kills++;
      }
      maxUnits = Math.max(maxUnits, s.units.filter((x) => !x.dead).length);
      for (const x of s.units) if (!x.dead && isSolidAt(s.arena.solid!, x.x, x.y)) inSolid++;
    }
    out(`starfall 深夜 6 分鐘：擊殺 ${kills}、單位上限 ${maxUnits}、營火醒來 ${s.revives ?? 0}`);
    expect(s.outcome).toBe('running');
    expect(inSolid).toBe(0);
    expect(maxUnits).toBeLessThanOrEqual(32);
    expect(kills).toBeGreaterThan(15);
  }, 240000);
});
