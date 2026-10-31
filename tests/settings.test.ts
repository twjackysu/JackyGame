import { describe, expect, it } from 'vitest';
import { getSettings, textCharMs, updateSettings } from '../src/game/settings';

describe('settings', () => {
  it('沒有 localStorage 時使用預設值並可在本次更新', () => {
    expect(getSettings().autoTiming).toBe(false);
    expect(textCharMs()).toBe(32);
    updateSettings({ autoTiming: true, textSpeed: 'fast' });
    expect(getSettings().autoTiming).toBe(true);
    expect(textCharMs()).toBe(14);
  });

  it('音量預設 100%，可以調整（舊存檔沒有這個欄位也補預設）', () => {
    expect(getSettings().volume).toBe(1);
    updateSettings({ volume: 0.5 });
    expect(getSettings().volume).toBe(0.5);
  });
});
