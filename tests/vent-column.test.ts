import { describe, expect, it } from 'vitest';
import { VENT_COLUMN_DEPTH, ventLayers } from '../src/game/fx/ventColumn';

describe('熔岩口噴發的火柱（第 195 輪）', () => {
  it('一般位置：三層，外暈最寬最淡、芯最細最高；柱高 3.2r', () => {
    const ls = ventLayers(80, 700, 110, false);
    expect(ls).toHaveLength(3);
    expect(ls[0]!.w).toBeGreaterThan(ls[1]!.w);
    expect(ls[1]!.w).toBeGreaterThan(ls[2]!.w);
    expect(ls[0]!.alpha).toBeLessThan(ls[2]!.alpha);
    expect(ls[2]!.h).toBeCloseTo(256);
  });
  it('柱頂不伸進標題列：噴發口貼著上緣時柱子變矮，太貼就不畫', () => {
    for (const y of [130, 180, 260, 400]) for (const l of ventLayers(80, y, 110, false)) expect(y - l.h).toBeGreaterThanOrEqual(110);
    expect(ventLayers(80, 300, 110, false)[2]!.h).toBeCloseTo(190);
    expect(ventLayers(80, 125, 110, false)).toHaveLength(0);
  });
  it('省電畫質少外暈那一層；畫在 HUD（48 以上）底下', () => {
    expect(ventLayers(80, 700, 110, true)).toHaveLength(2);
    expect(VENT_COLUMN_DEPTH).toBeLessThan(48);
  });
});
