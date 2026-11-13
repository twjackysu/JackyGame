import { describe, expect, it } from 'vitest';
import { EMBER_ROCK, emberRock } from '../src/game/rt/emberRock';

// 燼紅裂谷岩壁的長相（第 196 輪）：只鎖純函式的形狀規則，畫出來好不好看要看截圖。
const hash = (seed: number) => (i: number): number => {
  let h = (seed * 374761393 + i * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

describe('emberRock', () => {
  it('同一格每次畫出同一塊（地面分塊重畫要一致）', () => {
    expect(emberRock(hash(7))).toEqual(emberRock(hash(7)));
  });

  it('5～7 個側面；外緣和以前的圓差不多大（牆的邊界看起來不變）', () => {
    for (let s = 0; s < 200; s++) {
      const r = emberRock(hash(s));
      expect(r.sides.length).toBeGreaterThanOrEqual(5);
      expect(r.sides.length).toBeLessThanOrEqual(7);
      expect(r.top.pts.length).toBe(r.sides.length * 2);
      for (const f of r.sides) {
        const d = Math.hypot(f.pts[0]!, f.pts[1]!);
        expect(d).toBeGreaterThanOrEqual(EMBER_ROCK.outerMin - 1e-9);
        expect(d).toBeLessThanOrEqual(EMBER_ROCK.outerMin + EMBER_ROCK.outerVar + 1e-9);
      }
    }
  });

  it('頂面整個落在外緣最小半徑裡（不會戳出岩塊）', () => {
    for (let s = 0; s < 200; s++) {
      const t = emberRock(hash(s)).top.pts;
      for (let i = 0; i < t.length; i += 2) expect(Math.hypot(t[i]!, t[i + 1]!)).toBeLessThan(EMBER_ROCK.outerMin);
    }
  });

  it('光從左上來：朝左上的側面比朝右下的亮，亮度不超出設定的範圍', () => {
    for (let s = 0; s < 200; s++) {
      const r = emberRock(hash(s));
      let lit = -1;
      let dark = 9;
      for (const f of r.sides) {
        expect(f.tone).toBeGreaterThanOrEqual(EMBER_ROCK.sideLo - 1e-9);
        expect(f.tone).toBeLessThanOrEqual(EMBER_ROCK.sideHi + 1e-9);
        const mx = (f.pts[0]! + f.pts[2]!) / 2;
        const my = (f.pts[1]! + f.pts[3]!) / 2;
        const d = (mx * -0.6 + my * -0.8) / Math.hypot(mx, my);
        if (d > 0.6) lit = Math.max(lit, f.tone);
        if (d < -0.6) dark = Math.min(dark, f.tone);
      }
      if (lit >= 0 && dark < 9) expect(lit).toBeGreaterThan(dark);
    }
  });
});
