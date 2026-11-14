import { describe, expect, it } from 'vitest';
import { BRANCH_CELL, branchFont, branchLook, branchState } from '../src/game/ui/branchCell';
import { WEAPONS } from '../src/core/battle/rt/data';

describe('技能樹的打法格（第 204 輪）', () => {
  it('三種狀態分得開：沒解鎖有鎖、圖示變淡；使用中打勾、粗框；能選的沒有記號', () => {
    expect(branchState(false, false)).toBe('locked');
    expect(branchState(false, true)).toBe('locked');
    expect(branchState(true, false)).toBe('open');
    expect(branchState(true, true)).toBe('on');
    const l = branchLook('locked'); const o = branchLook('open'); const n = branchLook('on');
    expect(l.mark).toBe('lock');
    expect(o.mark).toBeNull();
    expect(n.mark).toBe('check');
    expect(l.iconA).toBeLessThan(0.5);
    expect(o.iconA).toBe(1);
    expect(n.strokeW).toBeGreaterThan(o.strokeW);
    expect(new Set([l.stroke, o.stroke, n.stroke]).size).toBe(3);
  });
  it('圖示和字都在格子裡、互不重疊', () => {
    const c = BRANCH_CELL;
    expect(c.iconDx - c.iconR).toBeGreaterThanOrEqual(-c.w / 2 + 4);
    expect(c.textDx - c.textW / 2).toBeGreaterThanOrEqual(c.iconDx + c.iconR + 2);
    expect(c.textDx + c.textW / 2).toBeLessThanOrEqual(c.w / 2);
  });
  it('三把武器所有打法的名字都放得進字的那一段，而且不小於 19px', () => {
    for (const w of Object.values(WEAPONS)) {
      for (const tbl of [w.variants, w.variantsB]) {
        for (const d of Object.values(tbl)) {
          const f = branchFont(d.variantName);
          expect(f * [...d.variantName].length, d.variantName).toBeLessThanOrEqual(BRANCH_CELL.textW);
          expect(f, d.variantName).toBeGreaterThanOrEqual(19);
        }
      }
    }
    expect(branchFont('原招')).toBe(22);
  });
});
