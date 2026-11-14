import { describe, expect, it } from 'vitest';
import { BTN_SKIN, btnRadius, isDarkBg, skinnable } from '../src/game/fx/btnSkinRules';

describe('文字按鈕的圓角底（第 203 輪）', () => {
  it('只處理不透明的 #rrggbb：字幕條與半透明襯底不碰', () => {
    expect(skinnable('#ffd27a')).toBe(true);
    expect(skinnable('#3A2A14')).toBe(true);
    expect(skinnable('#00000088')).toBe(false);
    expect(skinnable('rgba(8,6,10,0.62)')).toBe(false);
    expect(skinnable('transparent')).toBe(false);
    expect(skinnable(null)).toBe(false);
    expect(skinnable(undefined)).toBe(false);
  });
  it('圓角跟著高度走、有上限：小標籤不會變成膠囊，大按鈕不會變成橢圓', () => {
    expect(btnRadius(20)).toBeLessThan(6);
    expect(btnRadius(54)).toBe(BTN_SKIN.radiusMax);
    expect(btnRadius(200)).toBe(BTN_SKIN.radiusMax);
    expect(btnRadius(4)).toBeGreaterThanOrEqual(2);
  });
  it('深色的次要鈕用淡金邊（看得出是按鈕），亮色的主要鈕用暗邊', () => {
    expect(isDarkBg('#3a2a14')).toBe(true);
    expect(isDarkBg('#2a2218')).toBe(true);
    expect(isDarkBg('#ffd27a')).toBe(false);
    expect(isDarkBg('#7dffb0')).toBe(false);
  });
});
