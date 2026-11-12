// 第 184 輪（D-383）：燼火祝福的「蓋著的牌」——三選一下面多一張翻開才知道的牌（Jacky 11/12：賭博的形式用在其他方式；D-382 的預設 ①）。
// 結果由 core 用祝福自己的種子決定：一次兩個祝福／一個祝福／一個祝福＋一道燼痕（這趟被敵人打到的傷害變高）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { BLESS_GAMBLE, BLESS_RULES, EFFECT_IDS, blessNeed, gambleCursePct } from '../src/core/battle/rt/effects';
import { createBattle, playerOf, stateHash, step } from '../src/core/battle/rt/engine';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import type { BattleState, Unit } from '../src/core/battle/rt/types';

const mk = (seed = 7): BattleState => createBattle({ stageId: 'mistwood', seed, bless: true });
const evs = <T extends BattleState['events'][number]['type']>(s: BattleState, type: T) => s.events.filter((e): e is Extract<BattleState['events'][number], { type: T }> => e.type === type);
function leaveCamp(s: BattleState): void {
  const p = playerOf(s);
  p.y -= 1500;
  p.x += 300;
}
function wolfAt(s: BattleState, dx: number, dy: number, hp = 1, frozen = true): Unit {
  const p = playerOf(s);
  const e = s.units.filter((u) => u.side === 'enemy' && !u.dead && u.tier === 'normal' && u.mode !== 'combat')[0]!;
  e.x = p.x + dx;
  e.y = p.y + dy;
  e.homeX = e.x;
  e.homeY = e.y;
  e.mode = 'combat';
  e.engagedTick = s.tick;
  e.hp = hp;
  if (frozen) e.hitstunUntil = 1e9;
  return e;
}
function kill(s: BattleState, n: number): void {
  for (let k = 0; k < n; k++) {
    const e = wolfAt(s, 110, 0);
    playerOf(s).targetId = e.id;
    for (let i = 0; i < 90 && !e.dead; i++) step(s, []);
    expect(e.dead).toBe(true);
  }
}
/** 打到跳出第 n 手（前面每一手都選第一張） */
function toOffer(s: BattleState, n: number): void {
  leaveCamp(s);
  for (let k = 0; k < n; k++) {
    if (k > 0) step(s, [{ type: 'bless', pick: 0 }]);
    for (let i = 0; i < 12 && !s.bless!.offer; i++) kill(s, 1);
    expect(s.bless!.offer, `第 ${k + 1} 手`).toBeTruthy();
  }
}

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
});
afterAll(() => {
  delete STAGES.mistwood;
});

describe('蓋著的牌：什麼時候出現', () => {
  it('第一手沒有（新玩家先看懂三選一），第二手起才有；事件帶 dark', () => {
    const s = mk();
    toOffer(s, 1);
    expect(s.bless!.dark).toBeUndefined();
    expect(evs(s, 'blessOffer').at(-1)!.dark).toBeUndefined();
    step(s, [{ type: 'bless', gamble: true }]); // 沒有蓋著的牌：這個指令無效
    expect(s.bless!.taken).toHaveLength(0);
    expect(s.bless!.offer).toBeTruthy();
    toOffer(s, 2);
    expect(s.bless!.dark).toBe(true);
    expect(evs(s, 'blessOffer').at(-1)!.dark).toBe(true);
  });

  it('換一批之後蓋著的牌還在；選了普通的牌，蓋著的牌跟著收掉', () => {
    const s = mk();
    toOffer(s, 2);
    step(s, [{ type: 'bless', reroll: true }]);
    expect(s.bless!.dark).toBe(true);
    step(s, [{ type: 'bless', pick: 1 }]);
    expect(s.bless!.dark).toBeUndefined();
    expect(s.bless!.taken).toHaveLength(2);
  });

  it('只剩一格時不出（「一次兩個」放不下，機率就不老實了）', () => {
    const s = mk();
    toOffer(s, 2);
    step(s, [{ type: 'bless', pick: 0 }]);
    const b = s.bless!;
    delete b.offer;
    delete b.dark;
    b.taken = EFFECT_IDS.slice(0, BLESS_RULES.max - 1);
    b.meter = 0;
    for (let i = 0; i < 12 && !b.offer; i++) kill(s, 1);
    expect(s.bless!.offer).toBeTruthy();
    expect(s.bless!.dark).toBeUndefined();
  });
});

describe('蓋著的牌：翻開', () => {
  const flip = (seed: number) => {
    const s = mk(seed);
    toOffer(s, 2);
    const before = { taken: [...s.bless!.taken], offer: [...s.bless!.offer!], meter: s.bless!.meter };
    step(s, [{ type: 'bless', gamble: true }]);
    return { s, before, ev: evs(s, 'blessGamble').at(-1)! };
  };

  it('同一個種子翻出來的一樣（可重播）', () => {
    const a = flip(11);
    const b = flip(11);
    expect(a.ev).toEqual(b.ev);
    expect(stateHash(a.s)).toBe(stateHash(b.s));
  });

  it('三種結果都會出現，機率大致照設定；拿到的不是檯面上那三張、也不是已經有的', () => {
    const count = { double: 0, single: 0, cursed: 0 };
    const N = 240;
    for (let seed = 1; seed <= N; seed++) {
      const { s, before, ev } = flip(seed);
      count[ev.result]++;
      const b = s.bless!;
      expect(b.offer?.length ?? 0, '翻開後這一手結束（計量夠才會接下一手）').toBeGreaterThanOrEqual(0);
      expect(ev.ids).toHaveLength(ev.result === 'double' ? 2 : 1);
      expect(new Set(ev.ids).size).toBe(ev.ids.length);
      for (const id of ev.ids) {
        expect(EFFECT_IDS).toContain(id); // 不出「試招」
        expect(before.offer).not.toContain(id);
        expect(before.taken).not.toContain(id);
      }
      expect(b.taken).toEqual([...before.taken, ...ev.ids]);
      expect(b.curse ?? 0).toBe(ev.result === 'cursed' ? 1 : 0);
      expect(ev.curse).toBe(b.curse ?? 0);
      // 每個祝福各有一個 blessPick（畫面、音效、圖示照它）
      expect(evs(s, 'blessPick').slice(-ev.ids.length).map((e) => e.id)).toEqual(ev.ids);
      // 計量只扣一次（照翻牌前的門檻）
      expect(b.meter).toBe(Math.max(0, before.meter - blessNeed(before.taken.length)));
    }
    const pct = (n: number): number => (n * 100) / N;
    expect(Math.abs(pct(count.double) - BLESS_GAMBLE.doublePct)).toBeLessThan(10);
    expect(Math.abs(pct(count.cursed) - BLESS_GAMBLE.cursedPct)).toBeLessThan(10);
    expect(count.single).toBeGreaterThan(0);
  });
});

describe('燼痕（代價）', () => {
  /** 一隻狼咬主角：回傳第一下打到主角的傷害 */
  const firstBite = (curse: number): number => {
    const s = mk(5);
    leaveCamp(s);
    s.bless!.taken = ['vital_ember'];
    if (curse) s.bless!.curse = curse;
    const p = playerOf(s);
    wolfAt(s, 60, 0, 9999, false);
    for (let i = 0; i < 300; i++) {
      step(s, []);
      const d = evs(s, 'damage').find((e) => e.dst === p.id && e.origin === 'enemy');
      if (d) return d.amount + (d.absorbed ?? 0);
    }
    throw new Error('狼沒有咬到主角');
  };

  it('被敵人打到的傷害照層數變高；最多疊到上限', () => {
    const base = firstBite(0);
    expect(base).toBeGreaterThan(0);
    expect(firstBite(1)).toBe(Math.round((base * (100 + BLESS_GAMBLE.cursePct)) / 100));
    expect(firstBite(2)).toBe(Math.round((base * (100 + 2 * BLESS_GAMBLE.cursePct)) / 100));
    expect(gambleCursePct(BLESS_GAMBLE.curseMax + 5)).toBe(BLESS_GAMBLE.curseMax * BLESS_GAMBLE.cursePct);
  });

  it('疊滿之後不會再翻出燼痕（那一格變成普通的一個祝福）', () => {
    let seen = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = mk(seed);
      toOffer(s, 2);
      s.bless!.curse = BLESS_GAMBLE.curseMax;
      step(s, [{ type: 'bless', gamble: true }]);
      const ev = evs(s, 'blessGamble').at(-1)!;
      expect(ev.result).not.toBe('cursed');
      expect(s.bless!.curse).toBe(BLESS_GAMBLE.curseMax);
      seen++;
    }
    expect(seen).toBe(60);
  });

  it('回營火休息：燼痕和祝福一起消散；雜湊看得到燼痕', () => {
    const a = mk(3);
    const b = mk(3);
    for (const s of [a, b]) {
      leaveCamp(s);
      s.bless!.taken = ['vital_ember'];
    }
    b.bless!.curse = 1;
    expect(stateHash(a)).not.toBe(stateHash(b));
    const p = playerOf(b);
    const fire = STAGES.mistwood!.campfires![0]!;
    p.x = fire.x;
    p.y = fire.y + 80;
    step(b, [{ type: 'rest' }]);
    expect(b.bless!.taken).toHaveLength(0);
    expect(b.bless!.curse).toBeUndefined();
  });
});

describe('不影響既有行為', () => {
  it('機器人從不翻蓋著的牌（通關、hash 快照照舊）', () => {
    const s = mk(9);
    const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 35 }, 'normal');
    for (let i = 0; i < 30 * 240 && s.outcome === 'running'; i++) step(s, bot.decide(s));
    expect(evs(s, 'blessOffer').some((e) => e.dark), '這段時間裡有出過蓋著的牌').toBe(true);
    expect(evs(s, 'blessGamble')).toHaveLength(0);
    expect(s.bless!.curse).toBeUndefined();
  });
});
