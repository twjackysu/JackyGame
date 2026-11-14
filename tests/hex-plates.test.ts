import { describe, expect, it } from 'vitest';
import { HEX_PLATES, hexPlates, hexPoints, plateClearance } from '../src/game/fx/hexPlates';

describe('法杖護盾的六片晶片（第 201 輪，D-402）', () => {
  it('六片、左右對稱，正上正下不放（那是主角的頭和腳）', () => {
    const ps = hexPlates();
    expect(ps).toHaveLength(6);
    for (const p of ps) expect(Math.abs(p.x)).toBeGreaterThan(HEX_PLATES.ring * 0.45);
    const sumX = ps.reduce((n, p) => n + p.x, 0);
    expect(Math.abs(sumX)).toBeLessThan(1e-6);
  });

  it('剛出現（最小比例）時，每一片都不進主角那一直條', () => {
    for (const p of hexPlates()) expect(plateClearance(p, HEX_PLATES.from)).toBeGreaterThanOrEqual(HEX_PLATES.bodyHalf);
  });

  it('相鄰兩片不重疊', () => {
    const ps = hexPlates();
    for (let i = 0; i < 6; i++) {
      const a = ps[i]!;
      const b = ps[(i + 1) % 6]!;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);
    }
  });

  it('晶片是尖端朝上的六角形', () => {
    const pts = hexPoints(10);
    expect(pts).toHaveLength(6);
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(-10, 5);
  });
});
