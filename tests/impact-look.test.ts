import { describe, expect, it } from 'vitest';
import { flashAt, flashFalloff, impactFlash, impactTint, softFlashStops } from '../src/game/fx/impactLook';

// 第 183 輪：隕星術／墜星落地的閃光不能再是一整塊會飽和成純白的圓盤（以前：半徑 1.1R 內一律 +0.7）
describe('落地閃光的長相', () => {
  for (const tone of ['star', 'fire'] as const) {
    it(`${tone}：由外到內越來越小、越來越亮`, () => {
      const ls = impactFlash(100, tone);
      expect(ls.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < ls.length; i++) {
        expect(ls[i]!.r).toBeLessThan(ls[i - 1]!.r);
        expect(ls[i]!.alpha).toBeGreaterThanOrEqual(ls[i - 1]!.alpha);
      }
    });
    it(`${tone}：中心全亮，半徑六成處已經淡到看得見底下的怪和數字，邊緣沒有硬邊`, () => {
      const ls = impactFlash(100, tone);
      expect(flashAt(ls, 0)).toBeGreaterThanOrEqual(1);
      expect(flashAt(ls, 30)).toBeLessThan(0.7); // 以前整塊都是 0.7
      expect(flashAt(ls, 60)).toBeLessThan(0.25);
      expect(flashAt(ls, 100)).toBeLessThan(0.05);
      for (let d = 0; d < 130; d += 5) expect(flashAt(ls, d + 5)).toBeLessThanOrEqual(flashAt(ls, d)); // 單調變淡
      for (let d = 0; d < 130; d += 5) expect(flashAt(ls, d) - flashAt(ls, d + 5)).toBeLessThan(0.45); // 沒有一階一階的硬邊
    });
  }
  it('柔光貼圖的節點：中心 1、邊緣 0、一路變淡', () => {
    const st = softFlashStops();
    expect(st[0]).toEqual([0, 1]);
    expect(st[st.length - 1]).toEqual([1, 0]);
    for (let i = 1; i < st.length; i++) expect(st[i]![1]).toBeLessThan(st[i - 1]![1]);
    expect(flashFalloff(2)).toBe(0);
  });
  it('隕星術是火的橘紅、墜星是藍白', () => {
    const red = (c: number): number => c >> 16;
    const blue = (c: number): number => c & 255;
    expect(red(impactFlash(50, 'fire')[0]!.color)).toBeGreaterThan(blue(impactFlash(50, 'fire')[0]!.color));
    expect(blue(impactFlash(50, 'star')[0]!.color)).toBeGreaterThan(red(impactFlash(50, 'star')[0]!.color));
    expect(impactTint('fire').ring).not.toBe(impactTint('star').ring);
  });
});
