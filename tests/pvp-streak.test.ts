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
    expect(prev).toEqual({ rarity: 1, ilvl: 1, slots: 2 });
    for (let r = 420; r <= 1800; r += 20) {
      const g = simGearPlan(r);
      expect(g.slots).toBeGreaterThanOrEqual(prev.slots);
      expect(g.rarity).toBeGreaterThanOrEqual(prev.rarity);
      expect(g.ilvl).toBeGreaterThanOrEqual(prev.ilvl);
      prev = g;
    }
    expect(simGearPlan(1000)).toEqual({ rarity: 2, ilvl: 7, slots: 6 });
    expect(prev).toEqual({ rarity: 3, ilvl: 12, slots: 6 });
  });
});
