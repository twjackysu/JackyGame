// 燼紅裂谷（D-125）：第三張大地圖。驗證、噴發口規則、三種 Bot 打倒燼心岩王、共用進度與開放順序。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, isSolidAt, step, ventLeft } from '../src/core/battle/rt/engine';
import { EMBERRIFT_COLOSSUS, EMBERRIFT_VENTS, makeEmberriftStage } from '../src/core/battle/rt/maps/emberrift';
import { validateStage } from '../src/core/battle/rt/maps/validate';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec, u } from '../src/core/battle/rt/types';
import { LINKED_MAPS, nextGoal } from '../src/game/rtRecord';
import { prevMap } from '../src/game/worldMaps';

const GEAR = { hp: 300, atk: 30, def: 15 };

describe('燼紅裂谷', () => {
  beforeAll(() => {
    STAGES.emberrift = makeEmberriftStage();
  });
  afterAll(() => {
    delete STAGES.emberrift;
  });

  it('validateStage 0 問題；岩王在 bossZone 內；荊棘谷打倒狼后後開放、進度掛在霧語森林', () => {
    const st = makeEmberriftStage();
    expect(validateStage(st)).toEqual([]);
    expect(Math.hypot(EMBERRIFT_COLOSSUS.x - st.bossZone!.x, EMBERRIFT_COLOSSUS.y - st.bossZone!.y)).toBeLessThan(st.bossZone!.r);
    expect(prevMap('emberrift')?.id).toBe('thornvale');
    expect(LINKED_MAPS.emberrift).toBe('mistwood');
    expect(nextGoal('thornvale', { bossKills: 1 }, 6, 0)).toBe('前往燼紅裂谷，打倒燼心岩王');
    expect(nextGoal('emberrift', {}, 10, 0)).toBe('穿過裂谷往北，打倒燼心岩王');
  });

  it('噴發口：時間只看 tick；噴發那一刻圈內玩家受傷、閃避無敵躲得掉；追你的怪會被燒、待機的與 Boss 不會', () => {
    const v = EMBERRIFT_VENTS[0]!;
    const s = createBattle({ stageId: 'emberrift', seed: 1 });
    const p = s.units[0]!;
    expect(ventLeft(1, v)).toBe(v.everyTicks - 1); // tick 0 不噴（開場）
    // 跑到噴發前一刻，玩家站上去
    while (ventLeft(s.tick + 1, v) !== 0) step(s, []);
    p.x = v.x;
    p.y = v.y;
    const hp0 = p.hp;
    step(s, []);
    expect(s.events.some((e) => e.type === 'vent')).toBe(true);
    expect(p.hp).toBeLessThan(hp0);
    expect(hp0 - p.hp).toBeGreaterThanOrEqual(Math.round((p.maxHp * v.pct) / 100) - 1);
    // 下一次：無敵中不受傷
    while (ventLeft(s.tick + 1, v) !== 0) step(s, []);
    p.x = v.x;
    p.y = v.y;
    p.hp = p.maxHp;
    p.invulnUntil = s.tick + 5;
    step(s, []);
    expect(p.hp).toBe(p.maxHp);
    // 怪：追擊中的被燒、待機的不會（分兩次噴發測，避免兩隻疊在一起被推開）
    const w = s.units.find((x) => x.side === 'enemy' && !x.dead && x.defId === 'ember_wolf')!;
    for (const mode of ['combat', 'idle'] as const) {
      while (ventLeft(s.tick + 1, v) !== 0) step(s, []);
      p.x = v.x + u(6);
      p.y = v.y;
      w.x = w.homeX = v.x;
      w.y = w.homeY = v.y;
      w.action = null;
      w.mode = mode;
      w.engagedTick = s.tick; // 剛交戰（不然離開太久會脫戰回家）
      w.hp = w.maxHp;
      step(s, []);
      if (mode === 'combat') expect(w.hp).toBeLessThan(w.maxHp);
      else expect(w.hp).toBe(w.maxHp);
    }
  });

  it('深夜噴得更頻繁', () => {
    const v = EMBERRIFT_VENTS[0]!;
    let day = 0;
    let night = 0;
    for (let t = 1; t <= sec(60); t++) {
      if (ventLeft(t, v, false) === 0) day++;
      if (ventLeft(t, v, true) === 0) night++;
    }
    expect(night).toBeGreaterThan(day);
  });

  for (const [name, seed, level, limitSec, bonus] of [['novice', 1, 12, 900, GEAR], ['normal', 1, 10, 600, undefined], ['expert', 2, 10, 480, undefined]] as const) {
    it(`${name} Bot（Lv${level}${bonus ? '＋裝備' : ''}）從裂谷營地出發，${limitSec / 60} 分鐘內打倒燼心岩王、沒有單位卡進岩壁`, () => {
      const s = createBattle({ stageId: 'emberrift', seed, level, bonus });
      const bot = new PlayerBot({ ...BOT_PROFILES[name], ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: EMBERRIFT_COLOSSUS }, name);
      let inSolid = 0;
      while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(limitSec)) {
        step(s, bot.decide(s));
        for (const x of s.units) if (!x.dead && isSolidAt(s.arena.solid!, x.x, x.y)) inSolid++;
      }
      (globalThis as any).process.stdout.write(`emberrift ${name} Lv${level}: 岩王 ${(s.tick / 30).toFixed(0)} 秒、營火醒來 ${s.revives ?? 0}、等級 ${s.prog?.level}\n`);
      expect(s.bossKills ?? []).toContain('ember_colossus');
      expect(inSolid).toBe(0);
    }, 180000);
  }
});
