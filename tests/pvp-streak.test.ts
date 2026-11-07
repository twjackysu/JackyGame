// 連勝與今日首勝（第 151 輪，D-324）：純函式，伺服器的 pvp.finish 用它
import { describe, expect, it } from 'vitest';
import { DAY_MS, PVP_STREAK_CAP, pvpStreakAfter, taipeiDay } from '../src/core/meta/pvpRank';

describe('pvpStreakAfter', () => {
  it('勝 +1、輸歸零、平手不變', () => {
    expect(pvpStreakAfter({}, 'victory', 5)).toEqual({ streak: 1, winDay: 5, firstWin: true });
    expect(pvpStreakAfter({ streak: 3, winDay: 5 }, 'victory', 5)).toEqual({ streak: 4, winDay: 5, firstWin: false });
    expect(pvpStreakAfter({ streak: 3, winDay: 5 }, 'defeat', 5)).toEqual({ streak: 0, winDay: 5, firstWin: false });
    expect(pvpStreakAfter({ streak: 3, winDay: 5 }, 'timeout', 6)).toEqual({ streak: 3, winDay: 5, firstWin: false });
  });
  it('隔天第一次贏又是首勝；壞資料當 0、有上限', () => {
    expect(pvpStreakAfter({ streak: 2, winDay: 5 }, 'victory', 6).firstWin).toBe(true);
    expect(pvpStreakAfter({ streak: -4 }, 'timeout', 1).streak).toBe(0);
    expect(pvpStreakAfter({ streak: 1.5 }, 'victory', 1).streak).toBe(1);
    expect(pvpStreakAfter({ streak: 1e9 }, 'victory', 1).streak).toBe(PVP_STREAK_CAP);
  });
  it('台北的一天從 UTC 16:00 開始', () => {
    const utcMidnight = 20000 * DAY_MS;
    expect(taipeiDay(utcMidnight + 15.99 * 3600_000)).toBe(20000);
    expect(taipeiDay(utcMidnight + 16 * 3600_000)).toBe(20001);
  });
});

describe('simGearPlan（D-325）', () => {
  it('分數越低裝備越差：件數、稀有度、物品等級都不會變好', async () => {
    const { simGearPlan } = await import('../src/core/meta/pvpRank');
    let prev = simGearPlan(400);
    expect(prev).toEqual({ rarity: 1, ilvl: 1, slots: 2, enh: 0 });
    for (let r = 420; r <= 1800; r += 20) {
      const g = simGearPlan(r);
      expect(g.slots).toBeGreaterThanOrEqual(prev.slots);
      expect(g.rarity).toBeGreaterThanOrEqual(prev.rarity);
      expect(g.ilvl).toBeGreaterThanOrEqual(prev.ilvl);
      expect(g.enh).toBeGreaterThanOrEqual(prev.enh);
      prev = g;
    }
    expect(simGearPlan(1000)).toEqual({ rarity: 2, ilvl: 7, slots: 6, enh: 0 });
    expect(simGearPlan(1249).enh).toBe(0);
    expect(simGearPlan(1400).enh).toBe(3);
    expect(prev).toEqual({ rarity: 3, ilvl: 12, slots: 6, enh: 8 });
  });
  it('simGearRating（D-326）：1250 以下照兩人較低的分數；以上把超出的那段加回對手', async () => {
    const { simGearRating } = await import('../src/core/meta/pvpRank');
    expect(simGearRating(700, 1000)).toBe(700);
    expect(simGearRating(1100, 950)).toBe(950);
    expect(simGearRating(1250, 1200)).toBe(1200);
    expect(simGearRating(1400, 1200)).toBe(1350);
    expect(simGearRating(1400, 1250)).toBe(1400);
    expect(simGearRating(1300, 1300)).toBe(1300);
    // 連續、單調：你的分數越高，同一個對手的配裝分不會變低
    for (let you = 1000; you < 1800; you += 10) expect(simGearRating(you + 10, 1150)).toBeGreaterThanOrEqual(simGearRating(you, 1150));
  });
});
