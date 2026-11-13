import { describe, expect, it } from 'vitest';
import { THORN_BUSH, thornLobes } from '../src/game/rt/thornBush';
import { WORLD_MAPS } from '../src/game/worldMaps';

const lum = (c: number): number => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);

describe('荊棘谷的荊棘叢（第 195 輪）', () => {
  it('葉簇最多凸出叢的大圓一成多（輪廓有起伏，但牆看起來的邊界不會比實際擋路的地方大一截）', () => {
    for (const h of [0, 0.25, 0.5, 0.75, 0.999]) for (const g of [0, 0.5, 0.999]) for (const L of thornLobes(h, g, 1 - h)) {
      expect(Math.hypot(L.x, L.y) + L.r).toBeLessThanOrEqual(1.15);
    }
  });
  it('亮的葉簇在上半、暗的在下半（光從左上來），而且不是同一個位置疊三次', () => {
    const ls = thornLobes(0.5, 0.5, 0.5);
    expect(ls.filter((l) => l.hi).every((l) => l.y < 0)).toBe(true);
    expect(ls.filter((l) => !l.hi).every((l) => l.y > 0)).toBe(true);
    expect(new Set(ls.map((l) => `${l.x.toFixed(2)},${l.y.toFixed(2)}`)).size).toBe(3);
  });
  it('荊棘叢最亮的顏色不比森林樹冠的亮面亮太多（以前是發亮的紫紅色球）；漿果少而暗', () => {
    const thorn = WORLD_MAPS.find((m) => m.decor === 'thorn')!.palette;
    const forest = WORLD_MAPS.find((m) => m.decor === 'forest')!.palette;
    expect(lum(thorn.crownHi)).toBeLessThan(lum(forest.crownHi) + 5);
    expect(lum(thorn.crownHi)).toBeGreaterThan(lum(thorn.crownB));
    expect(THORN_BUSH.berryRate).toBeLessThanOrEqual(0.12);
    expect(lum(THORN_BUSH.berryColor)).toBeLessThan(90);
  });
});
