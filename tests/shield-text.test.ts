import { describe, expect, it } from 'vitest';
import { SHIELD_TEXT_TIMES, showShieldText } from '../src/game/fx/shieldText';

describe('護盾 +N 只說前幾次（D-396）', () => {
  it('前幾次冒字，之後不冒', () => {
    for (let i = 0; i < SHIELD_TEXT_TIMES; i++) expect(showShieldText(i)).toBe(true);
    expect(showShieldText(SHIELD_TEXT_TIMES)).toBe(false);
    expect(showShieldText(99)).toBe(false);
  });
  it('次數給 Infinity＝每次都冒（退回舊樣子的開關）', () => {
    expect(showShieldText(500, Infinity)).toBe(true);
  });
});
