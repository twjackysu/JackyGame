// P3-a1（第 163 輪，D-354）：裝備上的獨特效果在 core 的結算——BattleSetup.effects 給的效果這場永久擁有，
// 和燼火祝福共用同一套觸發（effects.ts 的效果池），但休息／倒下不會清掉、不佔祝福名額、三選一不會重複出現。
// 物品怎麼帶這條效果、怎麼掉（伺服器端）是 P3-a2 之後的事；這裡只鎖戰鬥行為。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { BLESS_RULES } from '../src/core/battle/rt/effects';
import { createBattle, playerOf, skillDef, stateHash, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import type { BattleState, Unit } from '../src/core/battle/rt/types';

const evs = <T extends BattleState['events'][number]['type']>(s: BattleState, type: T) => s.events.filter((e): e is Extract<BattleState['events'][number], { type: T }> => e.type === type);
const mk = (effects: string[] | undefined, bless = false, seed = 7): BattleState => createBattle({ stageId: 'mistwood', seed, bless, ...(effects ? { effects } : {}) });
function wolfAt(s: BattleState, dx: number, hp = 1): Unit {
  const p = playerOf(s);
  const e = s.units.find((u) => u.side === 'enemy' && !u.dead && u.tier === 'normal' && u.mode !== 'combat')!;
  Object.assign(e, { x: p.x + dx, y: p.y, homeX: p.x + dx, homeY: p.y, mode: 'combat', engagedTick: s.tick, hp, hitstunUntil: 1e9 });
  if (hp > 1) e.maxHp = hp;
  return e;
}
const leaveCamp = (s: BattleState): void => {
  const p = playerOf(s);
  p.y -= 1500;
  p.x += 300;
};
function kill(s: BattleState, n: number): void {
  for (let k = 0; k < n; k++) {
    const e = wolfAt(s, 110);
    playerOf(s).targetId = e.id;
    for (let i = 0; i < 90 && !e.dead; i++) step(s);
    expect(e.dead).toBe(true);
  }
}

describe('裝備的獨特效果（P3-a1）', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });

  it('沒給＝和以前完全一樣（沒有 bless 物件、雜湊不變）；不認得的 id、重複的 id 會被丟掉', () => {
    const a = mk(undefined);
    const b = mk([]);
    const c = mk(['nope', 'try:heavy_slash:1', '__proto__']);
    for (let i = 0; i < 200; i++) for (const s of [a, b, c]) step(s);
    expect(b.bless).toBeUndefined();
    expect(c.bless).toBeUndefined();
    expect(stateHash(b)).toBe(stateHash(a));
    expect(stateHash(c)).toBe(stateHash(a));
    expect(mk(['ember_edge', 'ember_edge', 'nope']).bless!.perm).toEqual(['ember_edge']);
  });

  it('沒開祝福的場次也生效：普攻灼燒；不累積計量、不出三選一、沒有祝福事件', () => {
    const s = mk(['ember_edge']);
    expect(s.bless).toMatchObject({ off: true, perm: ['ember_edge'], taken: [] });
    leaveCamp(s);
    const e = wolfAt(s, 110, 99999);
    playerOf(s).targetId = e.id;
    for (let i = 0; i < 45; i++) step(s);
    expect(e.statuses.some((q) => q.id === 'burn')).toBe(true);
    e.dead = true;
    kill(s, 6);
    expect(s.bless!.meter).toBe(0);
    expect(s.bless!.offer).toBeUndefined();
    expect(evs(s, 'blessOffer').length).toBe(0);
    step(s, [{ type: 'bless', pick: 0 }]);
    expect(s.bless!.taken).toEqual([]);
  });

  it('休息與倒下都不會清掉（技能修正也還在）；身上的祝福照樣清', () => {
    const s = mk(['quick_hands'], true);
    const cd = (): number => {
      const p = playerOf(s);
      p.ready['heavy_slash'] = 0;
      p.action = null;
      delete p.casts;
      step(s, [{ type: 'skill', id: 'heavy_slash' }]);
      const left = p.ready['heavy_slash']! - s.tick;
      for (let i = 0; i < 40; i++) step(s);
      return left;
    };
    const base = skillDef(s, 'heavy_slash')!.cooldownTicks;
    expect(cd()).toBe(Math.round(base * 0.8));
    s.bless!.offer = ['ember_burst'];
    step(s, [{ type: 'bless', pick: 0 }]);
    const fire = STAGES.mistwood!.campfires![0]!;
    Object.assign(playerOf(s), { x: fire.x, y: fire.y + 80 });
    step(s, [{ type: 'rest' }]);
    expect(evs(s, 'blessClear')[0]).toMatchObject({ reason: 'rest', count: 1 });
    expect(s.bless).toMatchObject({ taken: [], perm: ['quick_hands'], rerolls: BLESS_RULES.rerolls });
    expect(cd()).toBe(Math.round(base * 0.8));
    const p = playerOf(s);
    s.bless!.meter = 2;
    p.hp = 0;
    p.dead = true;
    step(s);
    expect(p.dead).toBe(false);
    expect(s.bless!.perm).toEqual(['quick_hands']);
    expect(cd()).toBe(Math.round(base * 0.8));
  });

  it('開祝福時：三選一不會出現裝備已經有的效果；裝備的不佔一趟 8 個的名額', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const perm = ['storm_caller', 'ember_burst'];
      const s = mk(perm, true, seed);
      expect(s.bless!.off).toBeUndefined();
      leaveCamp(s);
      for (let n = 0; n < BLESS_RULES.max; n++) {
        s.bless!.meter = 99;
        kill(s, 1);
        const offer = s.bless!.offer!;
        expect(offer.length, `seed ${seed} 第 ${n + 1} 手`).toBe(3);
        for (const id of offer) expect(perm).not.toContain(id);
        s.bless!.meter = 0;
        step(s, [{ type: 'bless', pick: 0 }]);
      }
      expect(s.bless!.taken.length).toBe(BLESS_RULES.max);
    }
  });

  it('競技場不生效（D-354）；同種子＋同效果可重播，和沒有效果的結果不同', () => {
    expect(createBattle({ stageId: 'pvp_arena', seed: 3, effects: ['ember_edge'] }).bless).toBeUndefined();
    const run = (effects?: string[]): string => {
      const s = mk(effects, false, 21);
      leaveCamp(s);
      const e = wolfAt(s, 110, 99999);
      playerOf(s).targetId = e.id;
      for (let i = 0; i < 240; i++) step(s);
      return stateHash(s);
    };
    expect(run(['storm_caller'])).toBe(run(['storm_caller']));
    expect(run(['storm_caller'])).not.toBe(run());
  });
});
