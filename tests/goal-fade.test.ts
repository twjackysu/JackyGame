import { describe, expect, it } from 'vitest';
import { GOAL_FADE, goalAlpha } from '../src/game/rt/goalFade';

describe('頂端目標字條的收起（第 194 輪）', () => {
  it('新玩家還沒打倒 Boss：一直留著', () => {
    expect(goalAlpha({ veteran: false, done: false, ageMs: 0 })).toBe(1);
    expect(goalAlpha({ veteran: false, done: false, ageMs: 10 * 60 * 1000 })).toBe(1);
  });
  it('老玩家：講完就淡掉，淡完是 0', () => {
    expect(goalAlpha({ veteran: true, done: false, ageMs: GOAL_FADE.vetMs })).toBe(1);
    const mid = goalAlpha({ veteran: true, done: false, ageMs: GOAL_FADE.vetMs + GOAL_FADE.fadeMs / 2 });
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(goalAlpha({ veteran: true, done: false, ageMs: GOAL_FADE.vetMs + GOAL_FADE.fadeMs })).toBe(0);
    expect(goalAlpha({ veteran: true, done: true, ageMs: GOAL_FADE.vetMs + GOAL_FADE.fadeMs + 1 })).toBe(0);
  });
  it('這一趟第一次打倒 Boss：下一個目標留得比老玩家久，最後也會收', () => {
    expect(GOAL_FADE.firstKillMs).toBeGreaterThan(GOAL_FADE.vetMs);
    expect(goalAlpha({ veteran: false, done: true, ageMs: GOAL_FADE.vetMs + GOAL_FADE.fadeMs })).toBe(1);
    expect(goalAlpha({ veteran: false, done: true, ageMs: GOAL_FADE.firstKillMs + GOAL_FADE.fadeMs })).toBe(0);
  });
});
