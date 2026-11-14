import { describe, expect, it } from 'vitest';
import { CAMP_BTN, campPlateKey } from '../src/game/ui/campBtn';

const lum = (c: number): number => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
const hex = (s: string): number => parseInt(s.slice(1), 16);

describe('營火捷徑的底板（第 203 輪）', () => {
  it('深色底、亮色的字與框（以前是亮色底＋黑字，整個畫面最亮的兩塊）', () => {
    expect(lum(CAMP_BTN.fill)).toBeLessThan(40);
    for (const k of ['bag', 'shop'] as const) {
      expect(lum(hex(CAMP_BTN[k].text)) - lum(CAMP_BTN.fill)).toBeGreaterThan(140);
      expect(lum(CAMP_BTN[k].accent)).toBeGreaterThan(150);
    }
    expect(CAMP_BTN.bag.accent).not.toBe(CAMP_BTN.shop.accent); // 兩顆靠顏色也分得出來
  });
  it('位置、大小、顯示、有沒有 ▲ 變了才重畫', () => {
    const a = [{ x: 10, y: 20, w: 200, h: 54, visible: true }, { x: 250, y: 20, w: 120, h: 54, visible: true }];
    const k = campPlateKey(a, false);
    expect(campPlateKey(a.map((r) => ({ ...r, x: r.x + 0.2 })), false)).toBe(k);
    expect(campPlateKey(a, true)).not.toBe(k);
    expect(campPlateKey([{ ...a[0]!, visible: false }, a[1]!], false)).not.toBe(k);
    expect(campPlateKey([{ ...a[0]!, w: 236 }, a[1]!], false)).not.toBe(k);
  });
});
