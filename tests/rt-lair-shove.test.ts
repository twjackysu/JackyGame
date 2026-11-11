// 第 175 輪：Boss 戰中，「不是玩家自己走的位移」不會把主角帶出巢穴的紅圈（出圈＝Boss 回家回滿血）。
// 以前三種情況都會：①狼后叫出來的六七隻荊棘狼從同一邊圍上來，把站著打的主角每秒擠半格，十幾秒擠出圈外；
// ②Boss 衝鋒衝到圈外，近戰主角自動追出去；③暴怒狼王霧中瞬移的落點貼著樹，被推到樹牆另一邊走不回來。
// 站著全自動打（不推搖桿）10 分鐘、30 種子 × 三武器 × 四張圖 × 一般／暴怒：以前 688／720 打得倒，現在 720／720（本輪量測）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LAIR_GRACE_TICKS, createBattle, playerOf, setBossFury, step } from '../src/core/battle/rt/engine';
import { ENEMIES, STAGES } from '../src/core/battle/rt/data';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { makeThornvaleStage } from '../src/core/battle/rt/maps/thornvale';
import { UNIT } from '../src/core/battle/rt/types';
import type { BattleCommand, BattleState, Unit } from '../src/core/battle/rt/types';

/** 長劍＝不指定（和遊戲裡一樣） */
type W = 'bow' | 'staff' | undefined;

/** 把主角（血量放大到不會死）擺到 Boss 正下方，之後每個 tick 送 cmds（預設不下指令＝全自動） */
function fight(stageId: string, level: number, weapon: W, seed: number, fury: boolean): { s: BattleState; p: Unit; e: Unit } {
  const s = createBattle({ stageId, seed, level, weapon });
  if (fury) setBossFury(s, true);
  const p = playerOf(s);
  const e = s.units.find((u) => ENEMIES[u.defId]?.boss)!;
  p.hp = p.maxHp = 100_000_000;
  p.x = e.x; p.y = e.y + 130;
  return { s, p, e };
}

/** 站著打到 Boss 倒下或 10 分鐘；回傳 Boss 有沒有脫戰過、主角離巢穴中心最遠幾格、Boss 離中心最遠幾格 */
function standAndFight(stageId: string, level: number, weapon: W, seed: number, fury: boolean): { killed: boolean; leashed: boolean; maxP: number; maxE: number } {
  const { s, p, e } = fight(stageId, level, weapon, seed, fury);
  const z = STAGES[stageId]!.bossZone!;
  let maxP = 0; let maxE = 0;
  while (s.tick < 30 * 600 && !(s.bossKills ?? []).length) {
    step(s, []);
    maxP = Math.max(maxP, Math.hypot(p.x - z.x, p.y - z.y) / UNIT);
    if (!e.dead) maxE = Math.max(maxE, Math.hypot(e.x - z.x, e.y - z.y) / UNIT);
  }
  return { killed: (s.bossKills ?? []).length > 0, leashed: s.events.some((x) => x.type === 'leash' && x.id === e.id), maxP, maxE };
}

describe('Boss 戰中不會被擠出／自動追出巢穴', () => {
  beforeAll(() => { STAGES.mistwood = makeMistwoodStage(); STAGES.thornvale = makeThornvaleStage(); });
  afterAll(() => { delete STAGES.mistwood; delete STAGES.thornvale; });

  // 這四組在舊引擎上都是 Boss 打到剩一兩成時脫戰回滿（122／131／83／247 秒）
  for (const [seed, fury] of [[2, false], [6, false], [11, true], [9, true]] as const) {
    it(`荊棘谷拿劍站著打狼后${fury ? '（暴怒）' : ''} seed ${seed}：一群荊棘狼圍上來也不會被擠出紅圈，打得倒`, () => {
      const r = standAndFight('thornvale', 14, undefined, seed, fury);
      expect(r.leashed).toBe(false);
      expect(r.killed).toBe(true);
      expect(r.maxP).toBeLessThanOrEqual(STAGES.thornvale!.bossZone!.r / UNIT + 0.01);
      expect(r.maxE).toBeLessThan(STAGES.thornvale!.bossZone!.r / UNIT + 1); // 狼后的衝鋒不衝出自己的巢穴（以前會到圈外 3 格）
    });
  }

  it('暴怒狼王霧中瞬移：落點貼著樹時不會被推到樹牆另一邊（以前 seed 2 拿法杖在 421 秒被推到離家 22 格、走不回來）', () => {
    const r = standAndFight('mistwood', 8, 'staff', 2, true);
    expect(r.leashed).toBe(false);
    expect(r.killed).toBe(true);
    expect(r.maxE).toBeLessThan(STAGES.mistwood!.bossZone!.r / UNIT + 3);
  });

  it('玩家自己推搖桿走出紅圈：有 3 秒可以走回來——馬上回去不脫戰，一直待在外面才脫戰', () => {
    const { s, p, e } = fight('thornvale', 14, undefined, 2, false);
    const z = STAGES.thornvale!.bossZone!;
    const leashed = (): boolean => s.events.some((x) => x.type === 'leash' && x.id === e.id);
    const outside = (): boolean => Math.hypot(p.x - z.x, p.y - z.y) > z.r;
    for (let i = 0; i < 60; i++) step(s, []);
    expect(e.mode).toBe('combat');
    const down: BattleCommand[] = [{ type: 'move', dx: 0, dy: 1 }];
    const up: BattleCommand[] = [{ type: 'move', dx: 0, dy: -1 }];
    // ① 走出去 → 核心發 lairWarn（until＝踏出去的 tick＋寬限）、Boss 記下 lairOutTick
    let n = 0;
    while (!outside() && n++ < 30 * 30) step(s, down);
    expect(outside()).toBe(true);
    const warn = s.events.find((x) => x.type === 'lairWarn' && x.id === e.id);
    expect(warn && warn.type === 'lairWarn' && warn.until - warn.tick).toBe(LAIR_GRACE_TICKS);
    expect(e.lairOutTick).toBe(warn!.tick);
    // ② 在外面多待 1 秒再走回圈內：沒有脫戰、倒數清掉（舊引擎：踏出去那一刻 Boss 沒在出招就直接回家回滿）
    for (let i = 0; i < 30; i++) step(s, down);
    while (outside() && n++ < 30 * 60) step(s, up);
    for (let i = 0; i < 5; i++) step(s, up);
    expect(leashed()).toBe(false);
    expect(e.lairOutTick).toBeUndefined();
    expect(e.mode).toBe('combat');
    // ③ 再走出去、一直待在外面：寬限內不脫戰，過了才脫戰
    while (!outside() && n++ < 30 * 90) step(s, down);
    const t0 = s.tick;
    while (s.tick < t0 + LAIR_GRACE_TICKS - 2) step(s, down);
    expect(leashed()).toBe(false);
    while (!leashed() && s.tick < t0 + LAIR_GRACE_TICKS + 30 * 10) step(s, down); // Boss 正在出招的話等牠收招
    expect(leashed()).toBe(true);
    expect(e.lairOutTick).toBeUndefined();
  });

  it('Boss 不在交戰中（已經倒下）：推擠與自動追擊不受巢穴圈限制', () => {
    const { s, p, e } = fight('thornvale', 14, undefined, 2, false);
    const z = STAGES.thornvale!.bossZone!;
    e.dead = true; e.hp = 0;
    const w = s.units.find((u) => u.side === 'enemy' && !u.dead && !ENEMIES[u.defId]?.boss)!;
    s.units = [p, e, w];
    // 主角站在圈內緣，一隻怪在圈外交戰中 → 自動追擊會走出圈外去打牠
    p.x = z.x; p.y = z.y + z.r - 20;
    w.x = z.x; w.y = z.y + z.r + 6 * UNIT; w.mode = 'combat'; w.hp = w.maxHp = 100_000_000; w.homeX = w.x; w.homeY = w.y;
    for (let i = 0; i < 90; i++) step(s, []);
    expect(Math.hypot(p.x - z.x, p.y - z.y)).toBeGreaterThan(z.r);
  });
});
