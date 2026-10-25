// 荊棘谷（D-114）：資料檢查＋Bot（帶著霧語森林刷出來的等級）從谷口出發打倒棘冠狼后。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, isSolidAt, setBossFury, step } from '../src/core/battle/rt/engine';
import { makeThornvaleStage, THORNVALE_QUEEN } from '../src/core/battle/rt/maps/thornvale';
import { validateStage } from '../src/core/battle/rt/maps/validate';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec } from '../src/core/battle/rt/types';

describe('荊棘谷', () => {
  beforeAll(() => {
    STAGES.thornvale = makeThornvaleStage();
  });
  afterAll(() => {
    delete STAGES.thornvale;
  });

  it('validateStage 0 問題；48×80；狼后在 bossZone 內', () => {
    const d = makeThornvaleStage();
    expect(validateStage(d)).toEqual([]);
    expect(d.arena.solid!.rows.length).toBe(80);
    const z = d.bossZone!;
    expect(Math.hypot(THORNVALE_QUEEN.x - z.x, THORNVALE_QUEEN.y - z.y)).toBeLessThan(z.r);
  });

  // 新手 Bot 帶著霧語森林刷約 30 分鐘的裝備（加成約 HP +450／攻擊 +35／防禦 +20）；普通、熟練只有等級、沒有裝備
  const GEAR = { hp: 450, atk: 35, def: 20 };
  for (const [name, seed, level, limitSec, bonus] of [['novice', 1, 8, 900, GEAR], ['normal', 1, 6, 600, undefined], ['expert', 2, 6, 480, undefined]] as const) {
    it(`${name} Bot（Lv${level}${bonus ? '＋裝備' : ''}）從谷口出發，${limitSec / 60} 分鐘內打倒棘冠狼后、沒有單位卡進荊棘`, () => {
      const s = createBattle({ stageId: 'thornvale', seed, level, bonus });
      const bot = new PlayerBot({ ...BOT_PROFILES[name], ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: THORNVALE_QUEEN }, name);
      let kills = 0;
      let inSolid = 0;
      while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(limitSec)) {
        const n = s.events.length;
        step(s, bot.decide(s));
        for (let i = n; i < s.events.length; i++) {
          const e = s.events[i]!;
          if (e.type === 'death' && e.id !== s.units[0]!.id) kills++;
        }
        for (const x of s.units) if (!x.dead && isSolidAt(s.arena.solid!, x.x, x.y)) inSolid++;
      }
      (globalThis as any).process.stdout.write(`thornvale ${name} Lv${level}: 狼后 ${(s.tick / 30).toFixed(0)} 秒、營火醒來 ${s.revives ?? 0}、擊殺 ${kills}、等級 ${s.prog?.level}\n`);
      expect(s.bossKills ?? []).toContain('thorn_queen');
      expect(inSolid).toBe(0);
    }, 180000);
  }
});

describe('荊棘谷和霧語森林共用進度（rtRecord LINKED_MAPS）', () => {
  it('讀：等級／行囊／材料來自霧語森林，Boss 討伐與寶箱是自己的；寫：共用欄位回霧語森林、霧語森林的 Boss 紀錄不動', async () => {
    const { joinRecord, splitRecord, LINKED_MAPS } = await import('../src/game/rtRecord');
    expect(LINKED_MAPS.thornvale).toBe('mistwood');
    const mist = { level: 7, xp: 30, dust: 50, bossKills: 4, chests: ['entry_nook'], fury: true, furyKills: 1, night: true, kills: 300 };
    const own = { bossKills: 1, chests: ['tv_camp_nook'] };
    const j = joinRecord(mist, own);
    expect(j).toEqual({ level: 7, xp: 30, dust: 50, kills: 300, bossKills: 1, chests: ['tv_camp_nook'] });
    const after = { ...j, level: 8, dust: 70, kills: 320, bossKills: 2, chests: ['tv_camp_nook', 'tv_marsh_edge'] };
    const sp = splitRecord(mist, after);
    expect(sp.home).toEqual({ level: 8, xp: 30, dust: 70, kills: 320, bossKills: 4, chests: ['entry_nook'], fury: true, furyKills: 1, night: true });
    expect(sp.own).toEqual({ bossKills: 2, chests: ['tv_camp_nook', 'tv_marsh_edge'] });
  });
});

describe('荊棘谷裝備名稱（D-114）', () => {
  it('同種子數值完全相同，只有稀有的「霧語」換成「荊冠」', async () => {
    const { genGear } = await import('../src/core/battle/rt/gear');
    for (let seed = 1; seed < 40; seed++) {
      const a = genGear(seed, 3, 7);
      const b = genGear(seed, 3, 7, { region: 'thornvale' });
      expect({ ...b, name: '' }).toEqual({ ...a, name: '' });
      expect(a.name.endsWith('・霧語')).toBe(true);
      expect(b.name.endsWith('・荊冠')).toBe(true);
    }
  });
});

describe('毒沼 hazards（D-114）', () => {
  beforeAll(() => {
    STAGES.thornvale = makeThornvaleStage();
  });
  afterAll(() => {
    delete STAGES.thornvale;
  });
  it('站在毒沼裡每秒疊一層中毒（最多 5 層）並扣血；離開就不再疊；怪物不受影響', () => {
    const s = createBattle({ stageId: 'thornvale', seed: 1, level: 6 });
    const h = STAGES.thornvale!.hazards![0]!;
    const p = s.units[0]!;
    p.x = h.x;
    p.y = h.y;
    const hp0 = p.hp;
    for (let i = 0; i < sec(6); i++) {
      p.x = h.x;
      p.y = h.y;
      step(s, []);
    }
    const st = p.statuses.find((q) => q.id === 'poison');
    expect(st?.stacks).toBe(5);
    expect(p.hp).toBeLessThan(hp0);
    expect(s.events.filter((e) => e.type === 'hazard').length).toBe(6);
    p.x = STAGES.thornvale!.player.x;
    p.y = STAGES.thornvale!.player.y;
    const n = s.events.filter((e) => e.type === 'hazard').length;
    for (let i = 0; i < sec(5); i++) step(s, []);
    expect(s.events.filter((e) => e.type === 'hazard').length).toBe(n);
    expect(p.statuses.find((q) => q.id === 'poison')).toBeUndefined();
  });
});

describe('暴怒狼后（D-114）', () => {
  beforeAll(() => {
    STAGES.thornvale = makeThornvaleStage();
  });
  afterAll(() => {
    delete STAGES.thornvale;
  });
  it('Lv10＋荊棘谷裝備的普通 Bot 打得倒暴怒狼后，暴怒招（毒刺連射、背後突襲）有出現', () => {
    const rows: string[] = [];
    for (const seed of [1, 2]) {
      const s = createBattle({ stageId: 'thornvale', seed, level: 10, bonus: { hp: 750, atk: 55, def: 30 } });
      expect(setBossFury(s, true)).toBe(true);
      const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: THORNVALE_QUEEN }, 'normal');
      while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(900)) step(s, bot.decide(s));
      const furyAtk = s.events.filter((e) => e.type === 'telegraph' && (e.attack === 'queen_lance2' || e.attack === 'queen_ambush')).length;
      rows.push(`seed ${seed}: ${Math.round(s.tick / 30)} 秒、倒下 ${s.revives ?? 0}、暴怒招 ${furyAtk}`);
      expect(s.bossKills ?? []).toContain('thorn_queen');
      expect(furyAtk).toBeGreaterThan(0);
    }
    (globalThis as any).process.stdout.write(`暴怒狼后 ${rows.join('；')}\n`);
  }, 180000);
});
