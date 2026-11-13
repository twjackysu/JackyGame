import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CHEVRON_GAP, TELE_BLINK_FROM, chevronAlpha, lineChevrons, teleKind, telegraphLook } from '../src/game/fx/telegraphLook';

describe('敵人預告的長相（第 181 輪，D-377）', () => {
  it('三種危險各有自己的顏色，外框是同色系的亮色、不是黃框', () => {
    const kinds = ['phys', 'status', 'meteor'] as const;
    const looks = kinds.map((k) => telegraphLook(k, false, 0.5, 0));
    expect(new Set(looks.map((l) => l.fill)).size).toBe(3);
    expect(new Set(looks.map((l) => l.edge)).size).toBe(3);
    for (const l of looks) expect(l.edge).not.toBe(0xffd27a);
    expect(teleKind(true, true)).toBe('meteor');
    expect(teleKind(false, true)).toBe('status');
    expect(teleKind(false, false)).toBe('phys');
  });

  it('重招的框比較粗；越接近命中填色越實', () => {
    expect(telegraphLook('phys', true, 0.5, 0).edgeW).toBeGreaterThan(telegraphLook('phys', false, 0.5, 0).edgeW);
    expect(telegraphLook('phys', false, 1, 0).growA).toBeGreaterThan(telegraphLook('phys', false, 0, 0).growA);
    expect(telegraphLook('phys', false, 0, 0).growA).toBeGreaterThan(telegraphLook('phys', false, 0, 0).baseA);
  });

  it('最後兩成不分輕重都會閃白，之前不閃', () => {
    const late = [0, 70, 140, 210].map((ms) => telegraphLook('status', false, 0.9, ms).blink);
    expect(late).toContain(true);
    expect(late).toContain(false);
    for (const ms of [0, 70, 140, 210]) expect(telegraphLook('phys', true, TELE_BLINK_FROM - 0.01, ms).blink).toBe(false);
  });

  it('直線上的箭頭：都在線內、間距固定、會往前流動；太短的線不畫', () => {
    const L = 300;
    for (const ms of [0, 130, 277, 1000, 54321]) {
      const ds = lineChevrons(L, ms);
      expect(ds.length).toBeGreaterThanOrEqual(5);
      for (const d of ds) { expect(d).toBeGreaterThanOrEqual(14); expect(d).toBeLessThanOrEqual(L - 14); }
      for (let i = 1; i < ds.length; i++) expect(ds[i]! - ds[i - 1]!).toBeCloseTo(CHEVRON_GAP, 5);
    }
    expect(lineChevrons(L, 100)[0]).not.toBeCloseTo(lineChevrons(L, 0)[0]!, 3);
    expect(lineChevrons(20, 0)).toEqual([]);
    expect(chevronAlpha(50, L, 0.5)).toBeGreaterThan(chevronAlpha(250, L, 0.5));
  });

  it('戰鬥場景用這份長相畫預告，不再依可不可格擋換成黃框', () => {
    const src = readFileSync('src/game/scenes/RtBattleScene.ts', 'utf8');
    expect(src).toContain('telegraphLook(teleKind(');
    expect(src).not.toMatch(/t\.blockable \? 0xffd27a/);
  });
});

// 第 196 輪：一群怪同時出手時底色不疊成實心
import { TELE_CROWD_DIST, crowdCounts, crowdFill } from '../src/game/fx/telegraphLook';

describe('一群怪同時出手：預告的底色不疊成實心', () => {
  it('單獨一個預告不變；越多個每塊越淡，但重疊處仍然比單獨一塊深、而且不超過兩倍半', () => {
    expect(crowdFill(1)).toBe(1);
    expect(crowdFill(0)).toBe(1);
    let prev = 1;
    for (let n = 2; n <= 8; n++) {
      const f = crowdFill(n);
      expect(f).toBeLessThanOrEqual(prev);
      expect(f * n).toBeGreaterThan(1); // n 塊全疊在一起還是比一塊深
      expect(f * Math.min(n, 6)).toBeLessThanOrEqual(2.5);
      expect(f).toBeGreaterThanOrEqual(0.4); // 沒疊到的地方不能淡到看不見
      prev = f;
    }
  });

  it('只算起點靠在一起的：遠處另一隻怪的預告不受影響', () => {
    const d = TELE_CROWD_DIST;
    expect(crowdCounts([{ x: 0, y: 0 }, { x: d * 0.9, y: 0 }, { x: -d * 0.9, y: 0 }, { x: d * 5, y: 0 }])).toEqual([3, 2, 2, 1]);
    expect(crowdCounts([])).toEqual([]);
  });
});
