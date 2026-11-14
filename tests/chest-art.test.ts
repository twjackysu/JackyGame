import { describe, expect, it } from 'vitest';
import { CHEST_ART, chestCoins, chestPose } from '../src/game/fx/chestArt';

// 寶箱的開蓋演出（D-415）：蓋子掀開、金光收掉、金幣拋出來再落地
describe('chestPose', () => {
  it('還沒開＝蓋著、沒有光', () => {
    expect(chestPose(-1)).toEqual({ lid: 0, glow: 0, beam: 0 });
    expect(chestPose(Number.NaN)).toEqual({ lid: 0, glow: 0, beam: 0 });
  });
  it('蓋子從 0 掀到 1，途中會衝過頭一點再彈回來', () => {
    expect(chestPose(0).lid).toBeCloseTo(0, 5);
    let peak = 0;
    for (let t = 0; t <= CHEST_ART.lidMs; t += 10) peak = Math.max(peak, chestPose(t).lid);
    expect(peak).toBeGreaterThan(1.02);
    expect(peak).toBeLessThan(1.2);
    expect(chestPose(CHEST_ART.lidMs).lid).toBeCloseTo(1, 5);
    expect(chestPose(1e9).lid).toBe(1);
  });
  it('金光：一掀就亮、之後只會變淡、時間到全收掉（開過很久的箱子不發光）', () => {
    expect(chestPose(CHEST_ART.lidMs).glow).toBeGreaterThan(0.6);
    let prev = chestPose(CHEST_ART.lidMs).glow;
    for (let t = CHEST_ART.lidMs + 50; t <= CHEST_ART.glowMs; t += 50) {
      const g = chestPose(t).glow;
      expect(g).toBeLessThanOrEqual(prev);
      prev = g;
    }
    expect(chestPose(CHEST_ART.glowMs).glow).toBe(0);
    expect(chestPose(1e9)).toEqual({ lid: 1, glow: 0, beam: 0 });
    // 光柱比箱口的光早收
    expect(chestPose(CHEST_ART.glowMs * 0.7).beam).toBe(0);
    expect(chestPose(CHEST_ART.glowMs * 0.7).glow).toBeGreaterThan(0);
  });
});

describe('chestCoins', () => {
  it('同一個種子同一組軌跡；還沒開或飛完就沒有', () => {
    expect(chestCoins(7, 200)).toEqual(chestCoins(7, 200));
    expect(chestCoins(7, -1)).toEqual([]);
    expect(chestCoins(7, CHEST_ART.coinMs)).toEqual([]);
  });
  it('先往上拋（高過箱口）、最後落在箱子兩側、不會鑽到箱底下面', () => {
    const mid = chestCoins(7, CHEST_ART.coinMs * 0.45);
    expect(mid.length).toBeGreaterThanOrEqual(CHEST_ART.coins - 1);
    expect(mid.every((c) => c.y < 0)).toBe(true);
    const end = chestCoins(7, CHEST_ART.coinMs - 1);
    expect(end.some((c) => c.x < 0) && end.some((c) => c.x > 0)).toBe(true);
    for (let t = 0; t < CHEST_ART.coinMs; t += 20) for (const c of chestCoins(7, t)) {
      expect(c.y).toBeLessThanOrEqual(0.35);
      expect(c.a).toBeGreaterThanOrEqual(0);
      expect(c.a).toBeLessThanOrEqual(1);
    }
  });
  it('省電畫質少幾枚', () => {
    expect(chestCoins(7, 300, CHEST_ART.coinsLow).length).toBeLessThanOrEqual(CHEST_ART.coinsLow);
  });
});
