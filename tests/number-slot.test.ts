import { describe, expect, it } from 'vitest';
import { numberSlot, type NumRect } from '../src/game/fx/numberSlot';

// 第 51 輪：並排兩隻怪同時吃到 105，數字不能黏成「105105」
describe('numberSlot', () => {
  it('同一刻並排的數字往上疊一層', () => {
    const list: NumRect[] = [];
    expect(numberSlot(list, 300, 500, 70, 32, 1000)).toBe(500);
    expect(numberSlot(list, 330, 500, 70, 32, 1000)).toBe(468);
    expect(numberSlot(list, 310, 500, 70, 32, 1010)).toBe(436);
  });
  it('離得夠遠或已經過了一段時間就不動', () => {
    const list: NumRect[] = [];
    numberSlot(list, 300, 500, 70, 32, 1000);
    expect(numberSlot(list, 400, 500, 70, 32, 1000)).toBe(500);
    expect(numberSlot(list, 300, 500, 70, 32, 1500)).toBe(500);
  });
  it('最多疊 3 層、場景重啟（時間倒退）會清掉', () => {
    const list: NumRect[] = [];
    for (let i = 0; i < 6; i++) numberSlot(list, 300, 500, 70, 32, 1000);
    expect(numberSlot(list, 300, 500, 70, 32, 1000)).toBeGreaterThanOrEqual(500 - 3 * 32);
    expect(numberSlot(list, 300, 500, 70, 32, 10)).toBe(500);
  });
});
