import { describe, expect, it } from 'vitest';
import { cdText } from '../src/game/hudText';
import { TICKS_PER_SEC } from '../src/core/battle/rt/types';

describe('按鈕冷卻秒數（第 83 輪）', () => {
  it('3 秒以上整數（無條件進位），最後 3 秒小數一位', () => {
    expect(cdText(TICKS_PER_SEC * 8)).toBe('8');
    expect(cdText(TICKS_PER_SEC * 7.2)).toBe('8');
    expect(cdText(TICKS_PER_SEC * 3)).toBe('3');
    expect(cdText(TICKS_PER_SEC * 2.9)).toBe('2.9');
    expect(cdText(1)).toBe('0.0');
  });
  it('每秒換字次數：10 秒冷卻從 100 次降到 ≤ 40 次', () => {
    const seen = new Set<string>();
    for (let t = TICKS_PER_SEC * 10; t > 0; t--) seen.add(cdText(t));
    expect(seen.size).toBeLessThanOrEqual(40);
  });
});
