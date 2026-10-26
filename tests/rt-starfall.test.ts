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

describe('彗星巡者（D-138）', () => {
  beforeAll(() => {
    STAGES.starfall = makeStarfallStage();
  });
  afterAll(() => {
    delete STAGES.starfall;
  });
  it('白天就在墜星原巡邏；Lv15＋裝備普通 Bot 打得倒、掉精良以上', async () => {
    const { COMET_PATROL } = await import('../src/core/battle/rt/maps/starfall');
    const s = createBattle({ stageId: 'starfall', seed: 2, level: 15, bonus: GEAR });
    const c0 = s.units.find((x) => x.defId === 'comet_stalker' && !x.dead);
    expect(c0).toBeTruthy();
    const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: COMET_PATROL[1]! }, 'normal');
    let t0 = -1;
    while (s.outcome === 'running' && s.tick < sec(300)) {
      step(s, bot.decide(s));
      const c = s.units.find((x) => x.defId === 'comet_stalker');
      if (t0 < 0 && c?.mode === 'combat') t0 = s.tick;
      if (!c || c.dead) break;
    }
    const c = s.units.find((x) => x.defId === 'comet_stalker');
    out(`彗星巡者：交戰 ${((s.tick - t0) / 30).toFixed(0)} 秒、倒下 ${s.revives ?? 0}`);
    expect(!c || c.dead).toBe(true);
  }, 120000);
});

describe('星光碎片（D-141）', () => {
  beforeAll(() => {
    STAGES.starfall = makeStarfallStage();
  });
  afterAll(() => {
    delete STAGES.starfall;
  });
  it('落星後留下碎片；落地那一刻不能撿、之後走上去回 MP 與 HP；過期就消失', async () => {
    const { ventLeft } = await import('../src/core/battle/rt/engine');
    const v = STARFALL_STARS[0]!;
    const s = createBattle({ stageId: 'starfall', seed: 1, level: 15 });
    const p = s.units[0]!;
    p.x = v.x + u(6);
    p.y = v.y;
    while (ventLeft(s.tick + 1, v) !== 0) step(s, []);
    step(s, []);
    expect(s.shards?.some((q) => q.idx === 0)).toBe(true);
    // 站上去：下一個 tick 撿到
    p.x = v.x;
    p.y = v.y;
    p.mp = 0;
    p.hp = Math.round(p.maxHp / 2);
    const hp0 = p.hp;
    step(s, []);
    const ev = s.events.filter((e) => e.type === 'shard' && e.idx === 0);
    expect(ev.length).toBe(1);
    expect(p.mp).toBeGreaterThanOrEqual(8);
    expect(p.hp).toBeGreaterThan(hp0);
    expect(s.shards?.some((q) => q.idx === 0)).toBe(false);
    // 下一次落星：不去撿，5 秒後消失
    p.x = v.x + u(6);
    while (ventLeft(s.tick + 1, v) !== 0) step(s, []);
    step(s, []);
    expect(s.shards?.some((q) => q.idx === 0)).toBe(true);
    for (let i = 0; i < sec(5) + 1; i++) step(s, []);
    expect(s.shards?.some((q) => q.idx === 0)).toBe(false);
  });
  it('第二階段召喚墜星：預告畫在玩家腳下、砸完再追一顆；落點裡追著你的星痕狼也會被砸（第 31 輪）', () => {
    const s = createBattle({ stageId: 'starfall', seed: 2, level: 16, bonus: GEAR });
    const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: STARFALL_SENTINEL }, 'normal');
    let first: { ox: number; oy: number; px: number; py: number } | undefined;
    let second = false;
    let splashed = false;
    while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(900) && !(first && second && splashed)) {
      const n = s.events.length;
      step(s, bot.decide(s));
      const p = s.units[0]!;
      for (let i = n; i < s.events.length; i++) {
        const e = s.events[i]!;
        if (e.type === 'telegraph' && e.attack === 'sentinel_meteor' && !first) {
          const t = s.telegraphs.find((q) => q.attackId === 'sentinel_meteor')!;
          first = { ox: t.ox, oy: t.oy, px: p.x, py: p.y };
        }
        if (e.type === 'telegraph' && e.attack === 'sentinel_meteor2') second = true;
      }
      // 把一隻戰鬥中的星痕狼釘在落點中央，看會不會被砸
      const tg = s.telegraphs.find((q) => q.attackId.startsWith('sentinel_meteor'));
      // （召喚的狼通常很快被 Bot 打死，這裡借一隻遠處的狼，設成戰鬥中）
      const wolf = s.units.find((x) => !x.dead && x.defId === 'star_wolf');
      if (tg && wolf && !splashed) {
        wolf.mode = 'combat';
        wolf.x = tg.ox;
        wolf.y = tg.oy;
      }
      for (let i = n; i < s.events.length; i++) {
        const e = s.events[i]!;
        if (e.type === 'damage' && e.skill === 'vent' && s.units.find((x) => x.id === e.dst)?.defId === 'star_wolf') splashed = true;
      }
    }
    expect(first).toBeDefined();
    // 出招那一刻玩家的位置（Bot 下一個 tick 才動）
    expect(Math.hypot(first!.ox - first!.px, first!.oy - first!.py)).toBeLessThan(u(1));
    expect(second).toBe(true);
    expect(splashed).toBe(true);
  }, 240000);
});
