import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state/gameState';
import { creditsLines, formatPlayTime } from '../src/game/credits';

describe('片尾字幕', () => {
  it('遊玩時間格式', () => {
    expect(formatPlayTime(0)).toBe('0 分鐘');
    expect(formatPlayTime(17.6 * 60000)).toBe('17 分鐘');
    expect(formatPlayTime(95 * 60000)).toBe('1 小時 35 分');
  });
  it('顯示結局與統計', () => {
    const s = newGame(0);
    s.flags.ending = 'light';
    s.flags.stat_perfect = 42;
    s.flags.stat_lamps = 77;
    const text = creditsLines(s).map((l) => l.text).join('\n');
    expect(text).toContain('結局「燈火長明」');
    expect(text).toContain('PERFECT　42 次');
    expect(text).toContain('點亮的燈印　77 盞');
  });
});
