import { describe, expect, it } from 'vitest';
import { drawBreak, drawBurn, drawPoison, drawSlow, drawWeak, slowChevrons, STATUS_MARK } from '../src/game/fx/statusMarks';

/** 記下畫了什麼的假畫筆 */
function pen() {
  const calls: { op: string; a: number[]; color: number; alpha: number }[] = [];
  let color = 0;
  let alpha = 1;
  const p = {
    calls,
    fillStyle(c: number, al = 1) { color = c; alpha = al; return p; },
    lineStyle(_w: number, c: number, al = 1) { color = c; alpha = al; return p; },
    fillEllipse(...a: number[]) { calls.push({ op: 'ellipse', a, color, alpha }); return p; },
    fillCircle(...a: number[]) { calls.push({ op: 'circle', a, color, alpha }); return p; },
    fillTriangle(...a: number[]) { calls.push({ op: 'tri', a, color, alpha }); return p; },
    fillRect(...a: number[]) { calls.push({ op: 'rect', a, color, alpha }); return p; },
    lineBetween(...a: number[]) { calls.push({ op: 'line', a, color, alpha }); return p; },
  };
  return p;
}

describe('身上的狀態記號（第 200 輪）', () => {
  it('緩速：腳兩側都有箭頭，只在腳邊（不擋身體與血條），任何時刻都至少有一支看得清楚', () => {
    for (const id of [0, 1, 7, 42]) {
      for (let now = 0; now < 3000; now += 37) {
        const ch = slowChevrons(id, now);
        expect(ch.length).toBe(STATUS_MARK.slowN * 2);
        expect(ch.some((c) => c.x < -1)).toBe(true);
        expect(ch.some((c) => c.x > 1)).toBe(true);
        for (const c of ch) {
          expect(c.y).toBeGreaterThanOrEqual(-0.5);
          expect(c.y).toBeLessThanOrEqual(0.1);
          expect(c.a).toBeGreaterThanOrEqual(0);
          expect(c.a).toBeLessThanOrEqual(1);
        }
        expect(Math.max(...ch.map((c) => c.a))).toBeGreaterThan(0.45);
      }
    }
  });

  it('緩速的箭頭往下沉（和火苗、泡泡的「往上」分得開）', () => {
    const a = slowChevrons(3, 1000)[0]!;
    const b = slowChevrons(3, 1100)[0]!;
    expect(b.y).toBeGreaterThan(a.y);
    const g = pen();
    drawSlow(g, 3, 100, 200, 20, 1000);
    // 每個三角形的尖端（第三個點）都在底邊下面
    for (const c of g.calls) expect(c.a[5]!).toBeGreaterThan(c.a[1]!);
  });

  it('灼燒的火苗尖端朝上、中毒的泡泡往上冒', () => {
    const g = pen();
    drawBurn(g, 5, 100, 200, 60, 500);
    const flames = g.calls.filter((c) => c.op === 'tri');
    expect(flames.length).toBe(10);
    for (const c of flames) expect(c.a[5]!).toBeLessThan(c.a[1]!);
    const y = (now: number): number => { const p = pen(); drawPoison(p, 5, 100, 200, 20, 60, now); return p.calls[0]!.a[1]!; };
    expect(y(100)).toBeLessThan(y(0));
  });

  it('記號太小的單位也畫得出看得見的箭頭；破甲在頭的左邊、虛弱在右邊', () => {
    const g = pen();
    drawSlow(g, 1, 0, 0, 4, 0);
    const lit = g.calls.find((c) => c.color === STATUS_MARK.slow)!;
    expect(lit.a[2]! - lit.a[0]!).toBeGreaterThanOrEqual(12);
    const b = pen();
    drawBreak(b, 100, 20, 50);
    expect(b.calls[0]!.a[0]!).toBeLessThan(100 - 20);
    const w = pen();
    drawWeak(w, 100, 20, 50);
    expect(w.calls[0]!.a[0]!).toBeGreaterThan(100 + 20 - 10);
  });
});
