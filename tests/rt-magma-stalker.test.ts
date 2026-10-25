// 熔核巡者（燼紅裂谷深夜限定的巡邏精英，第 26 輪）：數值檢查。Lv12＋裝備的普通 Bot 迎面遇上打得倒、交戰時間合理、會掉好裝。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { MAGMA_PATROL, makeEmberriftStage } from '../src/core/battle/rt/maps/emberrift';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec, u, type BattleState, type Unit } from '../src/core/battle/rt/types';

const out = (x: string) => (globalThis as unknown as { process: { stdout: { write: (y: string) => void } } }).process.stdout.write(x);
const stalker = (s: BattleState): Unit | undefined => s.units.find((x) => x.defId === 'magma_stalker' && !x.dead);
const GEAR = { hp: 300, atk: 30, def: 15 };

describe('熔核巡者', () => {
  beforeAll(() => {
    STAGES.emberrift = makeEmberriftStage();
  });
  afterAll(() => {
    delete STAGES.emberrift;
  });

  it('只在深夜出現、開場站在路線第一個點、是精英', () => {
    expect(stalker(createBattle({ stageId: 'emberrift', seed: 1, level: 12 }))).toBeUndefined();
    const s = createBattle({ stageId: 'emberrift', seed: 1, level: 12, night: true });
    const e = stalker(s)!;
    expect(e.tier).toBe('elite');
    expect(Math.hypot(e.x - MAGMA_PATROL[0]!.x, e.y - MAGMA_PATROL[0]!.y)).toBeLessThan(u(0.5));
  });

  it('Lv12＋裝備的普通 Bot 在熔渣坡迎面遇上：打得倒、交戰 15～150 秒、掉精良以上', () => {
    const rows: string[] = [];
    const secs: number[] = [];
    for (const seed of [1, 2, 3]) {
      const s = createBattle({ stageId: 'emberrift', seed, level: 12, bonus: GEAR, night: true });
      const e = stalker(s)!;
      const id = e.id;
      // 玩家站到巡者前方 4 格（坡道上段，路線第一個點的右邊）
      const p = s.units[0]!;
      p.x = e.x + u(4);
      p.y = e.y;
      const target = { x: e.x, y: e.y };
      const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: target, huntStationary: true }, 'normal');
      let engaged = -1;
      let killed = -1;
      while (s.tick < sec(300) && killed < 0) {
        const n = s.events.length;
        const cur = stalker(s);
        if (cur) {
          target.x = cur.x;
          target.y = cur.y;
          if (engaged < 0 && cur.mode === 'combat') engaged = s.tick;
        }
        step(s, bot.decide(s));
        for (let i = n; i < s.events.length; i++) {
          const ev = s.events[i]!;
          if (ev.type === 'death' && ev.id === id) killed = s.tick;
        }
      }
      const gear = (s.ground ?? []).filter((g) => g.kind === 'gear' && (g.rarity ?? 1) >= 2).length;
      const t = engaged >= 0 && killed > 0 ? Math.round((killed - engaged) / 30) : -1;
      secs.push(t);
      rows.push(`seed ${seed}: 交戰 ${t} 秒、營火醒來 ${s.revives ?? 0}、精良以上 ${gear}`);
      expect(killed).toBeGreaterThan(0);
      expect(gear).toBeGreaterThanOrEqual(1);
    }
    out(`[熔核巡者] Lv12＋裝備 普通 Bot ${rows.join('；')}\n`);
    for (const t of secs) {
      expect(t).toBeGreaterThanOrEqual(15);
      expect(t).toBeLessThanOrEqual(150);
    }
  }, 180000);
});
