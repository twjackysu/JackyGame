// 拍賣所最近成交的行情（第 153 輪，D-329）：只是給上架參考，價格還是賣家自己定。
import { describe, expect, it } from 'vitest';
import { priceStats } from '../src/core/meta/market';
describe('priceStats（拍賣所最近成交，D-329）', () => {
  it('中位數、最低最高；偶數筆取中間兩筆平均；壞值略過；沒有回 null', () => {
    expect(priceStats([])).toBeNull();
    expect(priceStats([300])).toEqual({ n: 1, median: 300, lo: 300, hi: 300 });
    expect(priceStats([500, 100, 300])).toEqual({ n: 3, median: 300, lo: 100, hi: 500 });
    expect(priceStats([100, 200, 301, 900])).toEqual({ n: 4, median: 251, lo: 100, hi: 900 });
    expect(priceStats([100, -5, 1.5, 200])).toEqual({ n: 2, median: 150, lo: 100, hi: 200 });
  });
});
