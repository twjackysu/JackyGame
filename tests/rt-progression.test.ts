// 經驗值與等級（P4，D-090）：霧語森林開啟；舊關卡不受影響（雜湊比對另做）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, playerOf, step, xpToNext } from '../src/core/battle/rt/engine';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec } from '../src/core/battle/rt/types';

const out = (s: string) => (globalThis as unknown as { process: { stdout: { write: (x: string) => void } } }).process.stdout.write(s);

describe('經驗值與等級', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });

  it('升級曲線：Lv2 要 60、Lv10 累計約 1 萬', () => {
    expect(xpToNext(1)).toBe(60);
    let sum = 0;
    for (let l = 1; l < 10; l++) sum += xpToNext(l);
    expect(sum).toBeGreaterThan(8000);
    expect(sum).toBeLessThan(12000);
  });

  it('帶入等級：HP 與攻擊照每級 +6%／+5% 計算，開場滿血', () => {
    const a = createBattle({ stageId: 'mistwood', seed: 1 });
    const b = createBattle({ stageId: 'mistwood', seed: 1, level: 5, xp: 30 });
    const pa = playerOf(a);
    const pb = playerOf(b);
    expect(a.prog).toMatchObject({ level: 1, xp: 0 });
    expect(b.prog).toMatchObject({ level: 5, xp: 30 });
    expect(pb.maxHp).toBe(Math.round((pa.maxHp * 124) / 100));
    expect(pb.atk).toBe(Math.round((pa.atk * 120) / 100));
    expect(pb.hp).toBe(pb.maxHp);
    expect(createBattle({ stageId: 'mistwood', seed: 1, level: 99 }).prog!.level).toBe(20);
  });

  it('打怪得經驗、升級立刻生效（levelUp 事件、HP 補上增加量）；其他關卡沒有 prog', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 1 });
    const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');
    const atk0 = playerOf(s).atk;
    while (s.tick < sec(240)) step(s, bot.decide(s));
    const ups = s.events.filter((e) => e.type === 'levelUp');
    expect(ups.length).toBeGreaterThan(0);
    expect(s.prog!.level).toBe(1 + ups.length);
    expect(playerOf(s).atk).toBeGreaterThan(atk0);
    expect(createBattle({ stageId: 'wolf_king', seed: 1 }).prog).toBeUndefined();
  });

  it('等級越高，同一隻狼王越快打倒（Jacky 10/25 的方向）', () => {
    const rows: string[] = [];
    const times: Record<number, number[]> = {};
    for (const lv of [1, 5, 10]) {
      for (const seed of [1, 2, 3]) {
        const s = createBattle({ stageId: 'mistwood', seed, level: lv });
        const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');
        while (!(s.bossKills ?? []).length && s.tick < sec(900)) step(s, bot.decide(s));
        (times[lv] ??= []).push(Math.round(s.tick / 30));
        rows.push(`Lv${lv} seed${seed}: ${Math.round(s.tick / 30)}s → Lv${s.prog!.level} 倒 ${s.revives ?? 0}`);
      }
    }
    out(`\n[progression] ${rows.join(' | ')}\n`);
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(avg(times[10]!)).toBeLessThan(avg(times[1]!));
  });
});
