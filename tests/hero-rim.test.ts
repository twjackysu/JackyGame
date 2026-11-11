import { describe, expect, it } from 'vitest';
import { rimLayout, RIM_ALPHA, RIM_SCREEN_PX } from '../src/game/fx/heroRim';

// 主角的亮邊（第 176 輪，D-371）：墊在立繪後面的淡色剪影。這裡驗的是「縮小後還剩幾 px」和「腳底點不能跑掉」。
describe('主角亮邊的版面', () => {
  it('立繪縮得越小，原圖上的邊要長得越寬——縮下來才看得到', () => {
    const small = rimLayout(409, 597, 0.16, 0.5, 0.92);
    const big = rimLayout(409, 597, 0.5, 0.5, 0.92);
    expect(small.grow).toBeGreaterThan(big.grow);
    // 縮下來的寬度落在目標附近（四捨五入誤差內）
    expect(small.grow * 0.16).toBeGreaterThan(RIM_SCREEN_PX - 0.2);
    expect(small.grow * 0.16).toBeLessThan(RIM_SCREEN_PX + 0.2);
  });

  it('墊邊之後腳底點還是同一個點（亮邊不會和人錯開）', () => {
    for (const [w, h, sc] of [[409, 597, 0.16], [519, 608, 0.15], [497, 597, 0.2]] as const) {
      const L = rimLayout(w, h, sc, 0.5, 0.92);
      expect(L.originX * L.w).toBeCloseTo(L.pad + w * 0.5, 6);
      expect(L.originY * L.h).toBeCloseTo(L.pad + h * 0.92, 6);
      // 墊的邊夠放得下長出去的輪廓＋柔化
      expect(L.pad).toBeGreaterThanOrEqual(L.grow * 1.5);
    }
  });

  it('縮放是 0 或極小也不會做出巨大的畫布', () => {
    const L = rimLayout(409, 597, 0, 0.5, 0.92);
    expect(L.grow).toBeLessThanOrEqual(40);
    expect(L.w).toBeLessThan(409 + 200);
  });

  it('亮邊是半透明的襯底，不是實心白框', () => {
    expect(RIM_ALPHA).toBeGreaterThan(0.5);
    expect(RIM_ALPHA).toBeLessThan(1);
  });
});
