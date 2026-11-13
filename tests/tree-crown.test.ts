import { describe, expect, it } from 'vitest';
import { TREE_CROWN, crownLobes } from '../src/game/rt/treeCrown';

// 霧語森林樹冠的長相（第 196 輪）：只鎖純函式的形狀規則，好不好看要看截圖。
const hash = (seed: number) => (i: number): number => {
  let h = (seed * 374761393 + i * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

describe('crownLobes', () => {
  it('同一格每次畫出同一棵（地面分塊重畫要一致）', () => {
    expect(crownLobes(hash(3))).toEqual(crownLobes(hash(3)));
  });

  it('先畫底色的葉簇、再暗面、再亮面、最後葉尖（後面蓋前面）', () => {
    for (let s = 0; s < 100; s++) {
      const order = crownLobes(hash(s)).map((l) => (l.tone === 0 ? 0 : l.tone));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(order.filter((t) => t === 0).length).toBe(1 + TREE_CROWN.rim);
    }
  });

  it('輪廓最多凸出原本的大圓兩成；亮面和葉尖都留在大圓裡', () => {
    for (let s = 0; s < 200; s++) {
      for (const l of crownLobes(hash(s))) {
        const reach = Math.hypot(l.x, l.y) + l.r;
        if (l.tone >= 2) expect(reach).toBeLessThanOrEqual(1);
        else expect(reach).toBeLessThanOrEqual(1.2);
      }
    }
  });

  it('光從左上來：葉尖都在上半、暗面在右下', () => {
    for (let s = 0; s < 200; s++) {
      for (const l of crownLobes(hash(s))) {
        if (l.tone === 3) expect(l.y).toBeLessThan(0);
        if (l.tone === 1) { expect(l.x).toBeGreaterThan(0); expect(l.y).toBeGreaterThan(0); }
      }
    }
  });
});
