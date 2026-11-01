import { describe, expect, it } from 'vitest';
import { hiddenEliteBannerY } from '../src/game/fx/bannerStack';

describe('隱藏首領現身的大字位置（D-223）', () => {
  it('首領在主角上方 → 字排到主角下方，不蓋衝刺路線', () => {
    const y = hiddenEliteBannerY(330, 580, 1280);
    expect(y).toBeGreaterThan(580 + 30);
    expect(y + 60).toBeLessThanOrEqual(1280 * 0.62);
  });
  it('首領在下方或位置不明 → 原位 420', () => {
    expect(hiddenEliteBannerY(700, 580, 1280)).toBe(420);
    expect(hiddenEliteBannerY(null, 580, 1280)).toBe(420);
  });
  it('主角太靠下放不下 → 原位', () => {
    expect(hiddenEliteBannerY(300, 760, 1280)).toBe(420);
  });
  it('390×844（GAME_HEIGHT 1558）主角約 700 也放得下', () => {
    expect(hiddenEliteBannerY(400, 700, 1558)).toBe(810);
  });
});
