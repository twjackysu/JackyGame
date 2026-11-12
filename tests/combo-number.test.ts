import { describe, expect, it } from 'vitest';
import { COMBO_GAP_MS, COMBO_GROW_MAX, COMBO_MAX_MS, comboAdd, comboContinues, comboSize, comboText, type Combo } from '../src/game/fx/comboNumber';

const hit = (amount: number, crit = false, ult = false, size = 26) => ({ amount, crit, ult, size });

describe('連擊數字合併（第 189 輪）', () => {
  it('很短時間內連續打同一隻：加在一起、次數累計', () => {
    let c: Combo | undefined;
    c = comboAdd(c, 1000, hit(30));
    c = comboAdd(c, 1100, hit(31));
    c = comboAdd(c, 1200, hit(30));
    expect(c.sum).toBe(91);
    expect(c.hits).toBe(3);
    expect(comboText(c)).toBe('91');
  });
  it('隔太久就另起一個（普攻一下一下不會被加在一起）', () => {
    const a = comboAdd(undefined, 1000, hit(40));
    const b = comboAdd(a, 1000 + COMBO_GAP_MS + 1, hit(40));
    expect(b.sum).toBe(40);
    expect(b.hits).toBe(1);
  });
  it('一直被打也不會永遠累計：超過上限就收掉重來', () => {
    let c = comboAdd(undefined, 0, hit(10));
    let t = 0;
    while (t + 200 <= COMBO_MAX_MS) { t += 200; c = comboAdd(c, t, hit(10)); }
    expect(c.hits).toBeGreaterThan(3);
    const next = comboAdd(c, t + 200, hit(10));
    expect(next.hits).toBe(1);
  });
  it('裡面有一下暴擊／大招，整串就用那個樣子', () => {
    let c = comboAdd(undefined, 0, hit(30));
    c = comboAdd(c, 100, hit(46, true, false, 34));
    c = comboAdd(c, 200, hit(30));
    expect(c.crit).toBe(true);
    expect(comboText(c)).toBe('106!');
    expect(c.size).toBe(34);
    expect(comboAdd(c, 300, hit(5, false, true)).ult).toBe(true);
  });
  it('字會隨次數變大，但有上限', () => {
    expect(comboSize({ size: 26, hits: 1 })).toBe(26);
    expect(comboSize({ size: 26, hits: 3 })).toBeGreaterThan(26);
    expect(comboSize({ size: 26, hits: 99 })).toBe(26 + COMBO_GROW_MAX);
  });
  it('時鐘倒退（換場景）不接續', () => {
    expect(comboContinues({ first: 5000, last: 5000 }, 100)).toBe(false);
    expect(comboContinues(undefined, 100)).toBe(false);
  });
});
