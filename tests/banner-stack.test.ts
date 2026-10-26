import { describe, expect, it } from 'vitest';
import { stackY } from '../src/game/fx/bannerStack';

describe('置中大字不重疊（D-162）', () => {
  it('沒有其他大字就照原位', () => {
    expect(stackY(470, 100, [], 1000)).toBe(470);
  });
  it('重疊就往下排，連續疊三則也不互相蓋到', () => {
    const busy: [number, number][] = [];
    for (const [y, h] of [[470, 140], [560, 110], [700, 80], [600, 70]] as const) {
      const cy = stackY(y, h, busy, 1000);
      for (const [t, b] of busy) expect(cy + h / 2 <= t || cy - h / 2 >= b).toBe(true);
      busy.push([cy - h / 2, cy + h / 2]);
    }
  });
  it('沒重疊的不動', () => {
    expect(stackY(700, 60, [[400, 540]], 1000)).toBe(700);
  });
  it('下面放不下就排到上面', () => {
    const cy = stackY(700, 60, [[600, 760], [500, 600]], 780);
    expect(cy + 30).toBeLessThanOrEqual(500);
  });
});
