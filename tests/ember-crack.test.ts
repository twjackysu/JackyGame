import { describe, expect, it } from 'vitest';
import { EMBER_CRACK_CHANCE, EMBER_CRACK_HALF, EMBER_HOT_CHANCE, emberCrack } from '../src/game/rt/emberCrack';

// 第 191 輪：燼紅裂谷的岩壁鋪滿畫面時不能是一片亮橘色亂線（比主角、怪、火系技能都搶眼）
describe('燼紅裂谷岩壁的熔岩裂紋', () => {
  it('大部分岩石沒有裂紋，有的也多半是暗的', () => {
    let dim = 0;
    let hot = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const k = emberCrack((i + 0.5) / n);
      if (k === 'dim') dim++;
      else if (k === 'hot') hot++;
    }
    expect((dim + hot) / n).toBeLessThanOrEqual(0.3);
    expect(hot / n).toBeLessThanOrEqual(0.06);
    expect(hot).toBeGreaterThan(0); // 還是要有幾顆亮的，才像燼紅裂谷
    expect(dim).toBeGreaterThan(hot * 2);
  });
  it('裂紋不橫貫整顆岩石', () => {
    expect(EMBER_CRACK_HALF.dim).toBeLessThanOrEqual(0.5);
    expect(EMBER_CRACK_HALF.hot).toBeLessThan(0.7);
    expect(EMBER_HOT_CHANCE).toBeLessThan(EMBER_CRACK_CHANCE);
  });
});
