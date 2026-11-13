import { describe, expect, it } from 'vitest';
import { HUD_BAR, dangerPulse, fillW, hpColor, lagStep } from '../src/game/rt/hudBars';

describe('頂端 HUD 的血條（第 192 輪）', () => {
  it('排在標題列裡：不超出 110 高、不碰右上選單鍵以下的右邊字、三條不重疊', () => {
    expect(HUD_BAR.hpY + HUD_BAR.hpH).toBeLessThanOrEqual(HUD_BAR.mpY);
    expect(HUD_BAR.mpY + HUD_BAR.mpH).toBeLessThanOrEqual(HUD_BAR.xpY);
    expect(HUD_BAR.xpY + HUD_BAR.xpH).toBeLessThanOrEqual(108);
    expect(HUD_BAR.x + HUD_BAR.w).toBeLessThan(HUD_BAR.sideX - 200);
  });
  it('顏色跟著血量：綠 → 琥珀 → 紅', () => {
    expect(hpColor(1)).toBe(hpColor(0.51));
    expect(hpColor(0.5)).not.toBe(hpColor(0.51));
    expect(hpColor(0.25)).not.toBe(hpColor(0.26));
    expect(new Set([hpColor(0.9), hpColor(0.4), hpColor(0.1)]).size).toBe(3);
  });
  it('只有四分之一以下才閃；倒下不閃', () => {
    expect(dangerPulse(0.6, 150)).toBe(0);
    expect(dangerPulse(0.2, 150)).toBeGreaterThan(0);
    expect(dangerPulse(0.2, 300)).toBeCloseTo(1);
    expect(dangerPulse(0, 150)).toBe(0);
  });
  it('掉血殘影：先留著、慢慢縮到現在的血量；回血直接跟上', () => {
    let lag = 1000;
    lag = lagStep(lag, 600, 1000, 16);
    expect(lag).toBeLessThan(1000);
    expect(lag).toBeGreaterThan(900);
    for (let i = 0; i < 120; i++) lag = lagStep(lag, 600, 1000, 16);
    expect(lag).toBe(600);
    expect(lagStep(600, 800, 1000, 16)).toBe(800);
    expect(lagStep(NaN, 800, 1000, 16)).toBe(800);
  });
  it('有血就看得到一點、沒血是空的、不超出條', () => {
    expect(fillW(330, 1, 961)).toBe(2);
    expect(fillW(330, 0, 961)).toBe(0);
    expect(fillW(330, 2000, 961)).toBe(330);
    expect(fillW(330, 480.5, 961)).toBe(165);
  });
});
