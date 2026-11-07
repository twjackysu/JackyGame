import { describe, expect, it } from 'vitest';
import { agoText, recentLook, streakLine } from '../src/game/pvpRecent';

describe('競技場戰績顯示（第 150 輪）', () => {
  it('勝敗和一個字', () => {
    expect(['victory', 'defeat', 'timeout'].map((o) => recentLook(o as never).ch).join('')).toBe('勝敗和');
  });
  it('多久以前', () => {
    expect(agoText(-5000)).toBe('剛剛');
    expect(agoText(59_000)).toBe('剛剛');
    expect(agoText(5 * 60_000)).toBe('5 分鐘前');
    expect(agoText(3 * 3600_000 + 1)).toBe('3 小時前');
    expect(agoText(50 * 3600_000)).toBe('2 天前');
  });
});

describe('streakLine（第 151 輪，D-324）', () => {
  it('只有贏的時候說；首勝、2 連勝起', () => {
    expect(streakLine({ outcome: 'victory', streak: 1, firstWin: false })).toBe('');
    expect(streakLine({ outcome: 'victory', streak: 1, firstWin: true })).toBe('今日首勝！');
    expect(streakLine({ outcome: 'victory', streak: 3, firstWin: false })).toBe('3 連勝');
    expect(streakLine({ outcome: 'victory', streak: 3, firstWin: true })).toBe('今日首勝！・3 連勝');
    expect(streakLine({ outcome: 'defeat', streak: 0, firstWin: false })).toBe('');
    expect(streakLine({ outcome: 'timeout', streak: 4, firstWin: false })).toBe('');
  });
});
