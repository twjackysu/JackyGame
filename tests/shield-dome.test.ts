import { describe, expect, it } from 'vitest';
import { DOME_SIZE, domeLook } from '../src/game/fx/shieldDome';

describe('護盾罩的長相（第 198 輪）', () => {
  it('邊緣由外往內暈開：最外一圈最細最實，往內越寬越淡，而且一層接一層沒有縫', () => {
    const d = domeLook(1, 1);
    expect(d.rim.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < d.rim.length; i++) {
      const a = d.rim[i - 1]!;
      const b = d.rim[i]!;
      expect(b.w).toBeGreaterThan(a.w);
      expect(b.a).toBeLessThan(a.a);
      // 上一層的內緣＝這一層的外緣（有縫會看成好幾個圈）
      expect(b.inset - b.w / 2).toBeCloseTo(a.inset + a.w / 2);
    }
  });

  it('護盾剩得越少越淡，但只要還有護盾就看得到一圈；快消失時跟著閃爍係數變淡', () => {
    const full = domeLook(1, 1);
    const low = domeLook(0.1, 1);
    expect(low.rim[0]!.a).toBeLessThan(full.rim[0]!.a);
    expect(low.rim[0]!.a).toBeGreaterThan(0.4);
    expect(low.fillA).toBeLessThan(full.fillA);
    expect(domeLook(1, 0.5).rim[0]!.a).toBeCloseTo(full.rim[0]!.a * 0.5);
    expect(domeLook(1, 0).shine.a).toBe(0);
  });

  it('罩子把頭也罩進去：頂端比單位半徑的三倍還高', () => {
    expect(DOME_SIZE.r + DOME_SIZE.up).toBeGreaterThan(3);
  });
});

describe('護盾罩的畫法（冒險地圖與競技場共用，第 199 輪）', () => {
  it('罩子的圓心在腳的上方、半徑照 DOME_SIZE；剩不到一秒才閃', async () => {
    const { drawDome, domeBlink } = await import('../src/game/fx/shieldDome');
    const circles: number[][] = [];
    const pen = {
      fillStyle() { return this; }, lineStyle() { return this; }, beginPath() { return this; }, arc() { return this; }, strokePath() { return this; },
      fillCircle(x: number, y: number, r: number) { circles.push([x, y, r]); return this; },
      strokeCircle(x: number, y: number, r: number) { circles.push([x, y, r]); return this; },
    };
    drawDome(pen, 100, 300, 20, 0xffffff, 1, 1);
    expect(circles[0]).toEqual([100, 300 - 20 * DOME_SIZE.up, 20 * DOME_SIZE.r]);
    expect(domeBlink(30, 123)).toBe(1);
    expect(domeBlink(90, 5)).toBe(1);
    const v = [0, 45, 90, 135, 180].map((t) => domeBlink(10, t));
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0);
    expect(new Set(v.map((q) => q.toFixed(2))).size).toBeGreaterThan(1);
  });
});
