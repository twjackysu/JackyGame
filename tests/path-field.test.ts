// V1 Q4（D-282）：新的距離場（環狀桶）和舊版（分桶陣列）逐格相同。
import { describe, expect, it } from 'vitest';
import { computeField, type Grid } from '../src/core/battle/rt/path';

/** 第 138 輪以前的版本（原封不動，當對照組） */
function oldField(g: Grid, goal: number): Int32Array {
  const NB: [number, number, number][] = [[0, -1, 10], [1, 0, 10], [0, 1, 10], [-1, 0, 10], [1, -1, 14], [1, 1, 14], [-1, 1, 14], [-1, -1, 14]];
  const d = new Int32Array(g.w * g.h).fill(-1);
  if (!g.walk[goal]) return d;
  const buckets: number[][] = [];
  d[goal] = 0;
  buckets[0] = [goal];
  for (let cost = 0; cost < buckets.length; cost++) {
    const b = buckets[cost];
    if (!b) continue;
    for (let k = 0; k < b.length; k++) {
      const cur = b[k]!;
      if (d[cur] !== cost) continue;
      const cx = cur % g.w;
      const cy = (cur - cx) / g.w;
      for (const [ox, oy, c] of NB) {
        const x = cx + ox;
        const y = cy + oy;
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
        const ni = y * g.w + x;
        if (!g.walk[ni]) continue;
        if (ox && oy && (!g.walk[cy * g.w + x] || !g.walk[y * g.w + cx])) continue;
        const nd = cost + c;
        if (d[ni] !== -1 && d[ni]! <= nd) continue;
        d[ni] = nd;
        (buckets[nd] ??= []).push(ni);
      }
    }
  }
  return d;
}

describe('computeField', () => {
  it('隨機地圖（牆 0～45%）× 隨機目標：和舊版逐格相同', () => {
    let seed = 99;
    const r = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
    for (let t = 0; t < 60; t++) {
      const w = 5 + Math.floor(r() * 60);
      const h = 5 + Math.floor(r() * 80);
      const wall = r() * 0.45;
      const walk = new Uint8Array(w * h);
      for (let i = 0; i < walk.length; i++) walk[i] = r() < wall ? 0 : 1;
      const g: Grid = { cell: 50, w, h, walk };
      for (let k = 0; k < 4; k++) {
        const goal = Math.floor(r() * w * h);
        expect(Array.from(computeField(g, goal))).toEqual(Array.from(oldField(g, goal)));
      }
    }
  });
});
