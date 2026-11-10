// P1（第 158 輪，D-342）：技能自動施放開關。時機與目標由 core 決定（確定性、可重播），畫面層只切開關。
import { describe, expect, it } from 'vitest';
import { AUTO_SKILL_DEFAULT, autoPick, cleanAutoSkills } from '../src/core/battle/rt/auto';
import { STAGES } from '../src/core/battle/rt/data';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { createBattle, playerOf, setAutoSkills, skillDef, stateHash, step } from '../src/core/battle/rt/engine';
import { BOT_PROFILES, IdleController, PlayerBot, simulateBattle } from '../src/core/battle/rt/sim';
import type { BattleCommand, BattleState, Unit } from '../src/core/battle/rt/types';

type W = 'sword' | 'bow' | 'staff';
const ALL = ['heavy_slash', 'whirlwind', 'charge', 'blade_storm'];
const mk = (weapon: W, auto?: string[], stageId = 'forest_entry', seed = 42): BattleState => createBattle({ stageId, seed, weapon: weapon === 'sword' ? undefined : weapon, autoSkills: auto });
const casts = (s: BattleState) => s.events.filter((e) => e.type === 'cast');
const run = (s: BattleState, ticks: number, cmd?: (s: BattleState) => BattleCommand[]): BattleState => {
  for (let i = 0; i < ticks && s.outcome === 'running'; i++) step(s, cmd?.(s) ?? []);
  return s;
};
/** 把場上的怪換成指定位置的幾隻（不會動：只拿來問 autoPick） */
function arrange(s: BattleState, at: [number, number][]): Unit[] {
  const p = playerOf(s);
  const proto = s.units.find((u) => u.side === 'enemy')!;
  const es = at.map(([dx, dy], i) => ({ ...structuredClone(proto), id: 900 + i, x: p.x + dx, y: p.y + dy, dead: false }));
  s.units = [p, ...es];
  return es;
}

describe('技能自動施放（P1）', () => {
  it('設定檢查：舊存檔沒有這一欄＝預設（兩個輸出技＋大招＋第 4 欄，D-345）；閃避永遠不能自動', () => {
    expect(cleanAutoSkills(undefined).sort()).toEqual([...AUTO_SKILL_DEFAULT].sort());
    expect(cleanAutoSkills(undefined).sort()).toEqual(['blade_storm', 'heavy_slash', 'parry', 'whirlwind']);
    expect(cleanAutoSkills([])).toEqual([]);
    expect(cleanAutoSkills(['parry', 'dodge', 'heavy_slash', 'x', 7]).sort()).toEqual(['heavy_slash', 'parry']);
    const s = mk('sword');
    setAutoSkills(s, ['dodge']);
    expect(s.autoSkills).toBeUndefined();
  });

  it('沒開自動＝和以前一樣：什麼都不按就不會放技能', () => {
    const s = run(mk('sword'), 600);
    expect(casts(s).length).toBe(0);
  });

  it('三把武器：開了自動、玩家什麼都不按，技能會自己放，而且每一招都有打到東西（不對空放）', () => {
    for (const w of ['sword', 'bow', 'staff'] as W[]) {
      const s = run(mk(w, ['heavy_slash', 'whirlwind']), 900);
      const cs = casts(s);
      expect(cs.length, `${w} 有自動放招`).toBeGreaterThanOrEqual(3);
      const pid = playerOf(s).id;
      for (const c of cs) {
        if (c.type !== 'cast') continue;
        expect(c.auto, `${w} 的施放標成自動`).toBe(true);
        expect(['heavy_slash', 'whirlwind']).toContain(c.skill);
        const hit = s.events.some((e) => e.type === 'damage' && e.src === pid && e.skill === c.skill && e.tick >= c.tick && e.tick <= c.tick + 60);
        // 戰鬥在這一招放完前就結束的不算
        if (c.tick + 60 < s.tick) expect(hit, `${w} ${c.skill}@${c.tick} 有命中`).toBe(true);
      }
    }
  });

  it('可重播：同種子、同指令、同設定 → 每個 tick 的結果完全一樣；和沒開自動的結果不同', () => {
    const a = run(mk('bow', ALL), 700);
    const b = run(mk('bow', ALL), 700);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(a.events).toEqual(b.events);
    expect(stateHash(run(mk('bow'), 700))).not.toBe(stateHash(a));
  });

  it('第 4 欄沒開就不會自己放（D-345 之後它也可以開，見 tests/rt-guard.test.ts）', () => {
    for (const w of ['sword', 'bow', 'staff'] as W[]) {
      const s = run(mk(w, ALL), 900);
      expect(casts(s).some((c) => c.type === 'cast' && c.skill === 'parry')).toBe(false);
    }
  });

  it('玩家自己按的優先：同一個 tick 按了別招，就放玩家按的', () => {
    const s2 = mk('sword', ['heavy_slash', 'whirlwind']);
    arrange(s2, [[120, 0]]);
    expect(autoPick(s2, playerOf(s2))).not.toBeNull();
    const before = casts(s2).length;
    step(s2, [{ type: 'skill', id: 'parry' }]);
    const c = casts(s2)[before]!;
    expect(c.type === 'cast' && c.skill).toBe('parry');
    expect(c.type === 'cast' && c.auto).toBeFalsy();
    expect(casts(s2).length).toBe(before + 1);
  });

  it('玩家正在走位：不放會把人定住的招（重斬），可以邊走邊放的（旋風斬）照放', () => {
    const s = mk('sword', ['heavy_slash']);
    arrange(s, [[120, 0]]);
    expect(autoPick(s, playerOf(s))?.id).toBe('heavy_slash');
    s.manualMove = { dx: 1, dy: 0 };
    expect(autoPick(s, playerOf(s))).toBeNull();
    setAutoSkills(s, ['heavy_slash', 'whirlwind']);
    arrange(s, [[120, 0], [0, 130]]);
    expect(skillDef(s, 'whirlwind')!.moveFactor).toBeGreaterThan(0);
    expect(autoPick(s, playerOf(s))?.id).toBe('whirlwind');
  });

  it('站在快落下的預告裡：不放會定住的招（讓玩家走／閃）', () => {
    const s = mk('sword', ['heavy_slash']);
    const [e] = arrange(s, [[120, 0]]);
    const p = playerOf(s);
    expect(autoPick(s, p)?.id).toBe('heavy_slash');
    s.telegraphs.push({ ownerId: e!.id, attackId: 'x', shape: { type: 'circle', r: 200 }, ox: p.x, oy: p.y, dirX: 1000, dirY: 0, hitTick: s.tick + 8, startTick: s.tick, blockable: false });
    expect(autoPick(s, p)).toBeNull();
  });

  it('普攻出手前不搶（不吃掉那一下普攻）', () => {
    const s = mk('sword', ['heavy_slash']);
    arrange(s, [[120, 0]]);
    const p = playerOf(s);
    p.action = { kind: 'attack', id: 'attack', start: s.tick, end: s.tick + 20, dirX: 1000, dirY: 0, ox: p.x, oy: p.y, targetId: 900 };
    expect(autoPick(s, p)).toBeNull();
    p.action.start = s.tick - 12;
    expect(autoPick(s, p)?.id).toBe('heavy_slash');
  });

  it('直線技對準：長弓穿雲箭挑打得到最多隻的方向，不是只看目前目標', () => {
    const s = mk('bow', ['heavy_slash']);
    // 目前目標在左邊一隻；右邊三隻排成一直線
    const es = arrange(s, [[-300, 0], [250, 0], [380, 0], [510, 0]]);
    const p = playerOf(s);
    p.targetId = es[0]!.id;
    const pick = autoPick(s, p)!;
    expect(pick.id).toBe('heavy_slash');
    expect(pick.aim!.x).toBeGreaterThan(p.x);
    // 兩邊一樣多：照目前目標
    arrange(s, [[-300, 0], [300, 0]]);
    p.targetId = 900;
    expect(autoPick(s, p)!.aim!.id).toBe(900);
  });

  it('範圍技要兩隻以上才放（附近只剩一隻就直接放）；大招要三隻以上或打得到精英／Boss', () => {
    const s = mk('sword', ['whirlwind']);
    // 身邊一隻、不遠處還有一隻沒貼上來：等牠
    arrange(s, [[120, 0], [520, 0]]);
    expect(autoPick(s, playerOf(s))).toBeNull();
    arrange(s, [[120, 0], [0, 130]]);
    expect(autoPick(s, playerOf(s))?.id).toBe('whirlwind');
    arrange(s, [[120, 0]]);
    expect(autoPick(s, playerOf(s))?.id).toBe('whirlwind');
    // 大招
    setAutoSkills(s, ['blade_storm']);
    playerOf(s).mp = 100;
    arrange(s, [[120, 0], [0, 130]]);
    expect(autoPick(s, playerOf(s))).toBeNull();
    arrange(s, [[120, 0], [0, 130], [-120, 0]]);
    expect(autoPick(s, playerOf(s))?.id).toBe('blade_storm');
    const [boss] = arrange(s, [[120, 0]]);
    boss!.tier = 'boss';
    expect(autoPick(s, playerOf(s))?.id).toBe('blade_storm');
    playerOf(s).mp = 0;
    expect(autoPick(s, playerOf(s))).toBeNull();
  });

  it('位移技：衝鋒等目標在 2.5 格外、衝得到才放；長弓後躍等敵人貼近才放', () => {
    const s = mk('sword', ['charge']);
    arrange(s, [[120, 0]]);
    expect(autoPick(s, playerOf(s))).toBeNull();
    arrange(s, [[400, 0]]);
    expect(autoPick(s, playerOf(s))?.id).toBe('charge');
    arrange(s, [[900, 0]]);
    expect(autoPick(s, playerOf(s))).toBeNull();
    const b = mk('bow', ['charge']);
    arrange(b, [[600, 0]]);
    expect(autoPick(b, playerOf(b))).toBeNull();
    arrange(b, [[150, 0]]);
    expect(autoPick(b, playerOf(b))?.id).toBe('charge');
  });

  it('大地圖：不會自己把睡著的怪打醒（沒有交戰中的敵人就不放）', () => {
    STAGES.mistwood = makeMistwoodStage();
    try {
      const s = run(mk('sword', ALL, 'mistwood'), 600);
      expect(casts(s).length).toBe(0);
      // 點了一隻狼開打之後就會放
      const p = playerOf(s);
      const wolf = s.units.filter((u) => u.side === 'enemy' && !u.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]!;
      step(s, [{ type: 'target', id: wolf.id }]);
      run(s, 900);
      expect(casts(s).length).toBeGreaterThan(0);
    } finally {
      delete STAGES.mistwood;
    }
  });

  it('強度：只開自動（什麼都不按）比完全不放技能快很多、和 Bot 差不多快，但不閃不擋所以挨的打比 Bot 多', () => {
    const t = (auto: string[] | undefined, bot: boolean) => {
      let ticks = 0;
      let hurt = 0;
      let wins = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const r = simulateBattle({ stageId: 'forest_entry', seed, autoSkills: auto }, bot ? new PlayerBot(BOT_PROFILES.normal, 'normal') : new IdleController());
        ticks += r.durationTicks;
        hurt += r.damageTaken;
        wins += r.victory ? 1 : 0;
      }
      return { ticks, hurt, wins };
    };
    const idle = t(undefined, false);
    const auto = t(['heavy_slash', 'whirlwind'], false);
    const bot = t(undefined, true);
    expect(auto.wins).toBe(6);
    expect(auto.ticks * 10).toBeLessThan(idle.ticks * 6); // 本次量測：約 9 秒對 22 秒
    expect(auto.ticks * 10).toBeGreaterThan(bot.ticks * 8); // 和 Bot 差不多快（不會強到手動沒意義）
    expect(bot.hurt).toBeLessThan(auto.hurt);
  });
});
