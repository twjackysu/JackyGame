import { describe, expect, it } from 'vitest';
import { stackY } from '../src/game/fx/bannerStack';

describe('置中大字不重疊（D-162）', () => {
  it('沒有其他大字就照原位', () => {
    expect(stackY(470, 100, [], 1000)).toBe(470);
  });
  it('重疊就往下排，連續疊三則也不互相蓋到', () => {
    const busy: [number, number][] = [];
    for (const [y, h] of [[470, 140], [560, 110], [700, 80], [600, 70]] as const) {
      const cy = stackY(y, h, busy, 1000)!;
      for (const [t, b] of busy) expect(cy + h / 2 <= t || cy - h / 2 >= b).toBe(true);
      busy.push([cy - h / 2, cy + h / 2]);
    }
  });
  it('沒重疊的不動', () => {
    expect(stackY(700, 60, [[400, 540]], 1000)).toBe(700);
  });
  it('下面放不下就排到上面', () => {
    const cy = stackY(700, 60, [[600, 760], [500, 600]], 780)!;
    expect(cy + 30).toBeLessThanOrEqual(500);
  });
  it('上下都沒位置（往上會超過 ceil）就回傳 null＝排隊（D-164）', () => {
    // 抉擇後：結語 560、兩則稀有裝備、撿裝備提示已經把 430～960 塞滿
    const busy: [number, number][] = [[480, 640], [646, 740], [746, 840], [846, 960]];
    expect(stackY(600, 90, busy, 966, 430)).toBeNull();
    // 前面的淡出一則後就有位置
    const cy = stackY(600, 90, busy.slice(1), 966, 430);
    expect(cy).not.toBeNull();
    expect(cy! - 45).toBeGreaterThanOrEqual(430);
  });
  it('往上排會蓋住主角（avoid）就排隊；原位不受影響（第 74 輪）', () => {
    // 360×640：提示在 735，主角在 601 附近
    const busy: [number, number][] = [[680, 790]];
    expect(stackY(735, 110, busy, 794, 430)).not.toBeNull();
    expect(stackY(735, 110, busy, 794, 430, [490, 630])).toBeNull();
    expect(stackY(735, 110, [], 794, 430, [490, 630])).toBe(735);
  });
});
