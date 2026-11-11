import { describe, expect, it } from 'vitest';
import { PICKUP_MERGE_MS, mergePickup, pickupRow, pickupSize } from '../src/game/pickupMerge';

describe('撿到的小字合併（第 172 輪）', () => {
  it('短時間內連撿同一種：累加成一個數字', () => {
    const a = mergePickup(undefined, 10, 1000);
    expect(a).toEqual({ total: 10, merged: false });
    const b = mergePickup({ total: a.total, at: 1000 }, 11, 1200);
    expect(b).toEqual({ total: 21, merged: true });
    const c = mergePickup({ total: b.total, at: 1200 }, 10, 1200 + PICKUP_MERGE_MS - 1);
    expect(c).toEqual({ total: 31, merged: true });
  });
  it('隔太久就是新的一個字，不會把很久以前的加進來', () => {
    expect(mergePickup({ total: 50, at: 1000 }, 7, 1000 + PICKUP_MERGE_MS)).toEqual({ total: 7, merged: false });
    // 場景重開後時鐘歸零：舊紀錄的時間比現在晚，也不併
    expect(mergePickup({ total: 50, at: 9000 }, 7, 100)).toEqual({ total: 7, merged: false });
  });
  it('不同種各佔一列', () => {
    const rows = ['gold', 'dust', 'crystal', 'potion'].map(pickupRow);
    expect(new Set(rows).size).toBe(4);
    expect(pickupRow('gold')).toBe(0);
    expect(pickupRow('???')).toBe(4);
  });
  it('併得越多字越大，但有上限', () => {
    expect(pickupSize(22, 10, 10)).toBe(22);
    expect(pickupSize(22, 30, 10)).toBe(26);
    expect(pickupSize(22, 1000, 10)).toBe(30);
  });
});
