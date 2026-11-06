// 面對面交易（託管，F3）的狀態機：改內容解除雙方鎖定、確認要帶目前版本（防最後一秒偷換）、雙方確認才完成。
import { describe, expect, it } from 'vitest';
import { TRADE_MAX_ITEMS, cancel, confirm, lock, newTrade, setOffer, validOffer, type TradeResult, type TradeState } from '../src/core/meta/trade';

const ok = (r: TradeResult): TradeState => {
  if (!r.ok) throw new Error(r.why);
  return r.state;
};
const why = (r: TradeResult): string => (r.ok ? 'ok' : r.why);

describe('託管交易狀態機', () => {
  it('正常流程：放東西 → 雙方鎖定 → 雙方確認 → done', () => {
    let t = ok(setOffer(newTrade(), 'a', { items: ['i1'], coin: 0 }));
    t = ok(setOffer(t, 'b', { items: [], coin: 500 }));
    expect(why(confirm(t, 'a', t.rev))).toBe('not locked');
    t = ok(lock(t, 'a'));
    t = ok(lock(t, 'b'));
    t = ok(confirm(t, 'a', t.rev));
    expect(t.status).toBe('open');
    t = ok(confirm(t, 'b', t.rev));
    expect(t.status).toBe('done');
    expect(why(setOffer(t, 'a', { items: [], coin: 1 }))).toBe('closed');
  });

  it('最後一秒偷換：一方確認後另一方改內容 → 鎖定與確認全部解除，舊版本的確認無效', () => {
    let t = ok(setOffer(newTrade(), 'a', { items: ['good'], coin: 0 }));
    t = ok(setOffer(t, 'b', { items: [], coin: 900 }));
    t = ok(lock(ok(lock(t, 'a')), 'b'));
    const seen = t.rev;
    t = ok(confirm(t, 'b', seen)); // b 看到「好東西換 900」確認了
    t = ok(setOffer(t, 'a', { items: ['junk'], coin: 0 })); // a 偷換
    expect(t.locked).toEqual({ a: false, b: false });
    expect(t.confirmed).toEqual({ a: false, b: false });
    t = ok(lock(ok(lock(t, 'a')), 'b'));
    expect(why(confirm(t, 'a', seen))).toBe('stale');
    t = ok(confirm(t, 'a', t.rev));
    expect(t.status).toBe('open'); // b 還要對新內容再確認一次
  });

  it('空交易不能完成；取消後不能再動', () => {
    let t = ok(lock(ok(lock(newTrade(), 'a')), 'b'));
    expect(why(confirm(t, 'a', t.rev))).toBe('empty');
    t = ok(cancel(t));
    expect(t.status).toBe('cancelled');
    expect(why(lock(t, 'a'))).toBe('closed');
    expect(why(cancel(t))).toBe('closed');
  });

  it('內容形狀檢查：件數、重複、金幣範圍、多餘欄位', () => {
    expect(validOffer({ items: [], coin: 0 })).toBe(true);
    expect(validOffer({ items: Array.from({ length: TRADE_MAX_ITEMS + 1 }, (_, i) => `i${i}`), coin: 0 })).toBe(false);
    expect(validOffer({ items: ['x', 'x'], coin: 0 })).toBe(false);
    expect(validOffer({ items: [], coin: -1 })).toBe(false);
    expect(validOffer({ items: [], coin: 1.5 })).toBe(false);
    expect(validOffer({ items: [3], coin: 0 })).toBe(false);
    expect(validOffer({ items: [], coin: 0, owner: 'b' })).toBe(false);
    expect(why(setOffer(newTrade(), 'a', { items: [], coin: 1e12 }))).toBe('bad offer');
  });
});
