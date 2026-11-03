import { describe, expect, it } from 'vitest';
import { sanitizeRecord } from '../src/game/rtRecord';

describe('sanitizeRecord（D-260）', () => {
  it('非物件一律當成空紀錄', () => {
    for (const v of [null, 42, 'x', [1, 2], undefined]) expect(sanitizeRecord(v)).toEqual({});
  });
  it('型別不對的欄位丟掉、其他保留', () => {
    const r = sanitizeRecord({ level: 'x', xp: NaN, coin: -3, dust: 12, bag: 5, fury: 'yes', night: true, fire: 9, chests: ['a', 3], spent: { dust: -4, coin: 'z' }, skills: { a: 1 } });
    expect(r.level).toBeUndefined();
    expect(r.xp).toBeUndefined();
    expect(r.coin).toBeUndefined();
    expect(r.dust).toBe(12);
    expect(r.fury).toBeUndefined();
    expect(r.night).toBe(true);
    expect(r.fire).toBeUndefined();
    expect(r.chests).toEqual(['a']);
    expect(r.spent).toEqual({ dust: -4 });
    expect(r.skills).toEqual({ a: 1 });
    expect(r.bag).toBe(5); // 行囊另由 cleanBag 檢查
  });
  it('等級至少 1、取整數', () => {
    expect(sanitizeRecord({ level: 0 }).level).toBe(1);
    expect(sanitizeRecord({ level: 7.6 }).level).toBe(7);
  });
  it('正常紀錄原封不動', () => {
    const ok = { bossKills: 2, level: 9, xp: 30, coin: 100, chests: ['c1'], fury: false, fire: 'f2', spent: { dust: 3, crystal: 1 } };
    expect(sanitizeRecord(ok)).toEqual(ok);
  });
});
