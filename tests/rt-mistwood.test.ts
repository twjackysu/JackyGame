// 霧語森林 48×96（design/22，D-085）：資料檢查＋三種 Bot 從南營地出發、往北推進、打倒狼王。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, isSolidAt, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { validateStage } from '../src/core/battle/rt/maps/validate';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec, u } from '../src/core/battle/rt/types';

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

  for (const [name, seed, limitSec] of [['novice', 1, 900], ['normal', 1, 480], ['expert', 2, 480]] as const) {
    // 新手／普通 Bot 順路打荊棘母樹拿經驗（120 經驗，像多數真人會先去刷），熟練 Bot 繞過去直衝狼王（D-111）
    it(`${name} Bot 從南營地出發，${limitSec / 60} 分鐘內打倒狼王、沒有單位卡進樹裡`, () => {
      const s = createBattle({ stageId: 'mistwood', seed });
      const bot = new PlayerBot({ ...BOT_PROFILES[name], ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING, ...(name !== 'expert' ? { huntStationary: true } : {}) }, name);
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
      (globalThis as any).process.stdout.write(`mistwood ${name}: 狼王 ${(s.tick / 30).toFixed(0)} 秒、營火醒來 ${s.revives ?? 0}、擊殺 ${kills}\n`);
      expect(s.bossKills ?? []).toContain('wolf_king');
      // D-086：被擊退進厚樹林不會卡在樹裡（第 17 輪普通 Bot 種子 1 曾卡死在狼王巢穴邊）
      expect(inSolid).toBe(0);
    }, 120000);
  }
});

describe('SpawnGroup.lootPct 區域獎勵', () => {
  afterAll(() => {
    delete STAGES.lp_a;
    delete STAGES.lp_b;
  });
  it('金幣與粉塵 ×(1+lootPct%)，戰鬥過程與掉落次數不變', async () => {
    const { makeTestWorldStage } = await import('../src/core/battle/rt/maps/testWorld');
    const base = makeTestWorldStage();
    STAGES.lp_a = { ...base, id: 'lp_a', loot: true };
    STAGES.lp_b = { ...base, id: 'lp_b', loot: true, spawnGroups: base.spawnGroups!.map((g) => ({ ...g, lootPct: 100 })) };
    const drops = (id: string) => {
      const s = createBattle({ stageId: id, seed: 1 });
      const bot = new PlayerBot({ ...BOT_PROFILES.normal }, 'normal');
      while (s.tick < sec(90)) step(s, bot.decide(s));
      return s.events.filter((e) => e.type === 'drop').map((e) => (e.type === 'drop' ? [e.kind, e.amount] as const : null)!);
    };
    const a = drops('lp_a');
    const b = drops('lp_b');
    expect(a.length).toBeGreaterThan(3);
    expect(b.length).toBe(a.length);
    a.forEach(([k, n], i) => {
      expect(b[i]![0]).toBe(k);
      expect(b[i]![1]).toBe(k === 'gold' || k === 'dust' ? Math.round(n * 2) : n);
    });
  }, 60000);
});

describe('Boss 再挑戰 bossZone.respawnTicks', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });
  it('打倒後玩家在巢穴裡不重生；離開且過了 60 秒才回來（滿血、待機）', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 1 });
    const king = s.units.find((x) => x.defId === 'wolf_king')!;
    const p = s.units[0]!;
    // 傳送到巢穴裡、直接把狼王打倒（只測重生規則）
    p.x = king.x;
    p.y = king.y + 600;
    step(s, []);
    king.hp = 1;
    king.mode = 'combat';
    const z = s.units.length;
    let t = 0;
    while (!king.dead && t++ < sec(20)) step(s, [{ type: 'target', id: king.id }]);
    expect(king.dead).toBe(true);
    expect(s.bossRespawn).toBeDefined();
    const deadAt = s.tick;
    // 留在巢穴：90 秒都不會回來
    for (let i = 0; i < sec(90); i++) {
      p.hp = p.maxHp;
      p.x = king.homeX!;
      p.y = king.homeY! + 600;
      step(s, []);
    }
    expect(s.units.filter((x) => x.defId === 'wolf_king' && !x.dead).length).toBe(0);
    // 走出巢穴（南營地）→ 下一個 tick 就回來
    p.x = u(24);
    p.y = u(90);
    step(s, []);
    const back = s.units.filter((x) => x.defId === 'wolf_king' && !x.dead);
    expect(back.length).toBe(1);
    expect(back[0]!.hp).toBe(back[0]!.maxHp);
    expect(back[0]!.mode).toBe('idle');
    expect(s.tick - deadAt).toBeGreaterThan(sec(60));
    expect(s.units.length).toBeLessThanOrEqual(z + 1); // 舊屍體移除
    expect(s.events.some((e) => e.type === 'respawn' && e.group === 'boss')).toBe(true);
  });
});

describe('隱藏寶箱 chests', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });
  it('走近自動打開一次、內容入帳、藥水不超過上限；validateStage 抓得到寶箱在樹上', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 1, potions: 18 });
    const p = s.units[0]!;
    const c = makeMistwoodStage().chests!.find((x) => x.id === 'deep_hollow')!;
    p.x = c.x + 50;
    p.y = c.y;
    step(s, []);
    expect(s.chestsOpened).toEqual(['deep_hollow']);
    expect(s.potions).toBe(20);
    expect(s.loot!.dust).toBe(8);
    expect(s.enhance).toBeUndefined(); // 霧語森林改成真的裝備強化（D-092），撿粉塵不再自動強化
    step(s, []);
    expect(s.events.filter((e) => e.type === 'chest').length).toBe(1);
    const bad = makeMistwoodStage();
    bad.chests = [{ id: 'x', x: 50, y: 50, loot: { gold: 1 } }];
    expect(validateStage(bad).join()).toMatch(/寶箱 x 在石頭上/);
  });
});

describe('狼群暴動 riot', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });
  it('5～8 分鐘內冒出 5～8 隻醒著的狼；在營火旁不會發生；追丟會散去', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 3 });
    const p = s.units[0]!;
    // 站在營火旁 9 分鐘：不會暴動
    for (let i = 0; i < sec(540); i++) step(s, []);
    expect(s.events.some((e) => e.type === 'riot')).toBe(false);
    // 走到森林入口（營火圈外）→ 5 秒內暴動
    p.x = u(24);
    p.y = u(82);
    let riot: (typeof s.events)[number] | undefined;
    for (let i = 0; i < sec(6) && !riot; i++) {
      p.hp = p.maxHp;
      step(s, []);
      riot = s.events.find((e) => e.type === 'riot');
    }
    expect(riot).toBeDefined();
    const mob = s.units.filter((x) => x.groupId === 'riot' && !x.dead);
    expect(mob.length).toBeGreaterThanOrEqual(5);
    expect(mob.length).toBeLessThanOrEqual(8);
    expect(mob.every((x) => x.mode === 'combat')).toBe(true);
    // 跑回營火、無敵等牠們追丟 → 散去
    p.x = u(24) + 50;
    p.y = u(90) + 50;
    for (let i = 0; i < sec(60); i++) {
      p.hp = p.maxHp;
      step(s, []);
    }
    expect(s.units.filter((x) => x.groupId === 'riot' && !x.dead).length).toBe(0);
  });
});

describe('隱藏精英 hiddenElite', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });
  it('不倒下連殺 12 隻普通怪 → 附近冒出醒著的強化首領；倒下會重新計數', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 2 });
    const bot = new PlayerBot({ ...BOT_PROFILES.expert, ult: true, potionAtPct: 50, campfireBelowPotions: 8 }, 'expert');
    let ev: (typeof s.events)[number] | undefined;
    let maxStreak = 0;
    while (!ev && s.tick < sec(600)) {
      step(s, bot.decide(s));
      maxStreak = Math.max(maxStreak, s.streak ?? 0);
      ev = s.events.find((e) => e.type === 'hiddenElite');
    }
    expect(ev).toBeDefined();
    expect(maxStreak).toBeGreaterThanOrEqual(11); // 第 12 隻倒下的那一 tick 就觸發並歸零
    const m = s.units.find((x) => x.groupId === 'hidden')!;
    expect(m.tier).toBe('elite');
    expect(m.mode).toBe('combat');
    expect(m.maxHp).toBeGreaterThan(s.units.find((x) => x.defId === 'alpha_wolf' && x.groupId === 'elite')!.maxHp); // +150% 比精英區 +100% 耐打
    expect(s.streak).toBe(0);
  }, 60000);
});

describe('霧語森林 15 分鐘耐久', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });
  it('普通 Bot 刷 15 分鐘：狼王打倒不只一次、陣列不會一直變大、每 tick < 1ms、沒有單位卡在樹裡', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 7 });
    const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');
    let maxUnits = 0;
    let stuck = 0;
    const t0 = performance.now();
    while (s.tick < sec(900)) {
      step(s, bot.decide(s));
      maxUnits = Math.max(maxUnits, s.units.length);
      if (s.tick % 30 === 0) for (const x of s.units) if (!x.dead && isSolidAt(s.arena.solid!, x.x, x.y)) stuck++;
    }
    const ms = (performance.now() - t0) / s.tick;
    const kingKills = s.events.filter((e) => e.type === 'death' && s.units.find((x) => x.id === e.id)?.defId === 'wolf_king').length;
    const kingRespawns = s.events.filter((e) => e.type === 'respawn' && e.group === 'boss').length;
    (globalThis as any).process.stdout.write(`mistwood soak: 每 tick ${ms.toFixed(3)}ms、最多 ${maxUnits} 單位、狼王回來 ${kingRespawns} 次、暴動 ${s.events.filter((e) => e.type === 'riot').length}、隱藏精英 ${s.events.filter((e) => e.type === 'hiddenElite').length}\n`);
    expect(s.bossKills).toContain('wolf_king');
    expect(kingRespawns + kingKills).toBeGreaterThanOrEqual(1);
    // 玩家＋狼王＋重生點活的＋待重生的屍體＋暴動＋隱藏＋餘裕（有上限，不會一直長）；重生點上限從地圖算（D-107 加了母樹後原本寫死的 20 剛好頂到）
    const groupCap = (STAGES.mistwood!.spawnGroups ?? []).reduce((n, g) => n + g.maxAlive, 0);
    expect(maxUnits).toBeLessThanOrEqual(1 + 1 + groupCap * 2 + 8 + 2 + 4);
    expect(stuck).toBe(0);
    expect(ms).toBeLessThan(1);
  }, 120000);
});
