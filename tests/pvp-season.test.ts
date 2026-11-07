// 競技場賽季（第 153 輪，D-328）：一季＝台北一週；換季不重置段位分，只記最高分。
import { describe, expect, it } from 'vitest';
import { DAY_MS, WEEK_MS, pvpSeasonAfter, pvpSeasonNow, seasonLeftMs, taipeiWeek } from '../src/core/meta/pvpRank';
import { seasonLeftText, seasonLines } from '../src/game/pvpRecent';
import { rankName } from '../src/core/meta/pvpRank';

// 2026-11-09（週一）00:00 台北 ＝ 2026-11-08 16:00 UTC
const MON = Date.UTC(2026, 10, 8, 16, 0, 0);

describe('taipeiWeek／seasonLeftMs', () => {
  it('台北週一 00:00 換週；週日 23:59 還是上一週', () => {
    expect(taipeiWeek(MON)).toBe(taipeiWeek(MON - 60_000) + 1);
    expect(taipeiWeek(MON + WEEK_MS - 1)).toBe(taipeiWeek(MON));
    expect(seasonLeftMs(MON)).toBe(WEEK_MS);
    expect(seasonLeftMs(MON - 60_000)).toBe(60_000);
    expect(seasonLeftMs(MON + 2 * DAY_MS)).toBe(5 * DAY_MS);
  });
});

describe('pvpSeasonNow／pvpSeasonAfter', () => {
  const w = taipeiWeek(MON);
  it('沒有或壞資料：從目前分數起算', () => {
    expect(pvpSeasonNow(undefined, 1000, w)).toEqual({ week: w, peak: 1000 });
    expect(pvpSeasonNow('{bad', 1100, w)).toEqual({ week: w, peak: 1100 });
    expect(pvpSeasonNow(JSON.stringify({ week: 'x', peak: 5 }), 1000, w)).toEqual({ week: w, peak: 1000 });
    expect(pvpSeasonNow(JSON.stringify({ week: w, peak: -3 }), 1000, w)).toEqual({ week: w, peak: 1000 });
  });
  it('同一季最高分只往上；換季時這季變上季、歷來最好取大', () => {
    const s1 = pvpSeasonAfter(undefined, 1000, 1120, w);
    expect(s1.season).toEqual({ week: w, peak: 1120 });
    expect(s1.newTier).toBe(true); // 霧語 → 荊棘
    const s2 = pvpSeasonAfter(JSON.stringify(s1.season), 1120, 1090, w);
    expect(s2.season.peak).toBe(1120);
    expect(s2.newTier).toBe(false);
    // 掉下來又爬回同一段：不是「首次」
    expect(pvpSeasonAfter(JSON.stringify(s2.season), 1090, 1130, w).newTier).toBe(false);
    const next = pvpSeasonNow(JSON.stringify({ ...s2.season, best: 1300 }), 1090, w + 1);
    expect(next).toEqual({ week: w + 1, peak: 1090, last: { week: w, peak: 1120 }, best: 1300 });
    const later = pvpSeasonNow(JSON.stringify(next), 1050, w + 3);
    expect(later).toEqual({ week: w + 3, peak: 1050, last: { week: w + 1, peak: 1090 }, best: 1300 });
  });
  it('時鐘倒退不會換季', () => {
    const s = pvpSeasonNow(JSON.stringify({ week: w, peak: 1200 }), 1100, w - 1);
    expect(s).toEqual({ week: w, peak: 1200 });
  });
});

describe('賽季小字', () => {
  it('剩幾天／幾小時／即將換季', () => {
    expect(seasonLeftText(3 * DAY_MS + 5)).toBe('剩 3 天');
    expect(seasonLeftText(5 * 3600000)).toBe('剩 5 小時');
    expect(seasonLeftText(59 * 60000)).toBe('即將換季');
    expect(seasonLeftText(-5)).toBe('即將換季');
    expect(seasonLines({ leftMs: DAY_MS, peak: 1260 }, rankName)).toBe('本季 剩 1 天\n最高 燼紅 1260');
    expect(seasonLines({ leftMs: DAY_MS, peak: 1000, last: 1120 }, rankName)).toBe('本季 剩 1 天\n最高 霧語 1000\n上季 荊棘 1120');
  });
});
