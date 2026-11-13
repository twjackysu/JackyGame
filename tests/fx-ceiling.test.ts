import { describe, expect, it } from 'vitest';
import { ceilingRect, fxBlocked } from '../src/game/fx/fxCeiling';

describe('戰鬥粒子不飄進頂端標題列（第 195 輪）', () => {
  it('發射點在標題列裡不放；沒設天花板（競技場）照舊', () => {
    expect(fxBlocked(110, 60)).toBe(true);
    expect(fxBlocked(110, 110)).toBe(true);
    expect(fxBlocked(110, 111)).toBe(false);
    expect(fxBlocked(undefined, 10)).toBe(false);
  });
  it('消失範圍：整條標題列（含左右畫面外）在裡面，標題列以下一點都不碰', () => {
    const r = ceilingRect(110);
    const inside = (x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    for (const x of [-200, 0, 360, 720, 900]) {
      expect(inside(x, 0)).toBe(true);
      expect(inside(x, 109)).toBe(true);
      expect(inside(x, 111)).toBe(false);
    }
    expect(inside(360, -500)).toBe(true);
  });
});
