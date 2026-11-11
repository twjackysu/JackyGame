import { describe, expect, it } from 'vitest';
import { dangerAlpha } from '../src/game/fx/hitTint';

// 危險紅暈（第 170 輪）：全自動之後玩家的眼睛在主角身上，不看血條也要感覺得到「快死了」「剛被打」
describe('危險紅暈 dangerAlpha', () => {
  const calm = 99999; // 很久沒被打
  it('血量 40% 以上、沒被打：不畫', () => {
    expect(dangerAlpha(1, calm, false, 0)).toBe(0);
    expect(dangerAlpha(0.4, calm, false, 0)).toBe(0);
    // 一掉到 40% 以下就看得到（不是從 0 淡入）
    expect(dangerAlpha(0.39, calm, false, 0)).toBeGreaterThan(0.15);
  });
  it('血越少越濃，10% 以下最濃', () => {
    const a30 = dangerAlpha(0.3, calm, false, 0, true);
    const a20 = dangerAlpha(0.2, calm, false, 0, true);
    const a10 = dangerAlpha(0.1, calm, false, 0, true);
    expect(a30).toBeGreaterThan(0);
    expect(a20).toBeGreaterThan(a30);
    expect(a10).toBeGreaterThan(a20);
    expect(dangerAlpha(0.03, calm, false, 0, true)).toBeCloseTo(a10, 5);
  });
  it('20% 以下會一明一暗；省電畫質不閃但照樣畫', () => {
    const xs = [0, 80, 160, 240, 320, 400, 480].map((t) => dangerAlpha(0.15, calm, false, t));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.05);
    const low = [0, 240, 480].map((t) => dangerAlpha(0.15, calm, false, t, true));
    expect(new Set(low).size).toBe(1);
    expect(low[0]).toBeGreaterThan(0.3);
    // 20% 以上不閃
    expect(dangerAlpha(0.3, calm, false, 0)).toBe(dangerAlpha(0.3, calm, false, 240));
  });
  it('滿血被打也會閃一下，0.38 秒內淡掉；重擊更濃', () => {
    const light = dangerAlpha(1, 0, false, 0);
    const heavy = dangerAlpha(1, 0, true, 0);
    expect(light).toBeGreaterThan(0.2);
    expect(heavy).toBeGreaterThan(light);
    expect(dangerAlpha(1, 200, false, 0)).toBeLessThan(light);
    expect(dangerAlpha(1, 380, true, 0)).toBe(0);
  });
  it('不會濃到看不見場地（上限 0.85）；倒下不畫', () => {
    for (const hp of [0.01, 0.1, 0.2]) for (const t of [0, 100, 250, 400]) expect(dangerAlpha(hp, 0, true, t)).toBeLessThanOrEqual(0.85);
    expect(dangerAlpha(0, 0, true, 0)).toBe(0);
  });
});
