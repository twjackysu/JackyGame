// design/14 階段 1.4：本機埠（原子存檔、事件紀錄去重、時鐘）
import { describe, expect, it } from 'vitest';
import { AUTO_KEY, BAK_KEY, MemoryKV, SaveStore, TMP_KEY, type KV } from '../src/core/save/save';
import { KvEventJournal, fixedClock } from '../src/core/save/localPorts';
import { newGame } from '../src/core/state/gameState';
import type { JournalEvent } from '../src/server/ports';

/** 指定的鍵寫入時丟例外（模擬空間不足／寫到一半當掉） */
class FlakyKV implements KV {
  inner = new MemoryKV();
  failOn = new Set<string>();
  getItem(k: string) {
    return this.inner.getItem(k);
  }
  setItem(k: string, v: string) {
    if (this.failOn.has(k)) throw new Error('QuotaExceededError');
    this.inner.setItem(k, v);
  }
  removeItem(k: string) {
    this.inner.removeItem(k);
  }
}

describe('SaveStore 原子寫入', () => {
  const withGold = (g: number) => {
    const s = newGame(1, 1);
    s.gold = g;
    return s;
  };

  it('暫存鍵寫不進去 → 回報失敗，主檔與備份原封不動', () => {
    const kv = new FlakyKV();
    const store = new SaveStore(kv);
    store.save(withGold(100));
    store.save(withGold(200));
    const before = [kv.getItem(AUTO_KEY), kv.getItem(BAK_KEY)];
    kv.failOn.add(TMP_KEY);
    expect(store.save(withGold(300))).toBe(false);
    expect([kv.getItem(AUTO_KEY), kv.getItem(BAK_KEY)]).toEqual(before);
    expect(store.load()?.gold).toBe(200);
  });

  it('主檔寫到一半失敗 → 讀到上一份完整存檔（不會半份）', () => {
    const kv = new FlakyKV();
    const store = new SaveStore(kv);
    store.save(withGold(100));
    kv.failOn.add(AUTO_KEY);
    expect(store.save(withGold(300))).toBe(false);
    expect(store.load()?.gold).toBe(100);
  });

  it('備份寫入失敗 → 主檔不動', () => {
    const kv = new FlakyKV();
    const store = new SaveStore(kv);
    store.save(withGold(100));
    kv.failOn.add(BAK_KEY);
    expect(store.save(withGold(300))).toBe(false);
    expect(store.load()?.gold).toBe(100);
  });

  it('主檔與備份都壞了 → 用暫存鍵救回', () => {
    const kv = new FlakyKV();
    const store = new SaveStore(kv);
    store.save(withGold(100));
    kv.failOn.add(AUTO_KEY);
    store.save(withGold(300)); // 留下 tmp
    kv.inner.setItem(AUTO_KEY, '{broken');
    kv.inner.setItem(BAK_KEY, '{broken');
    expect(store.load()?.gold).toBe(300);
  });

  it('成功後不留暫存鍵', () => {
    const kv = new MemoryKV();
    new SaveStore(kv).save(withGold(1));
    expect(kv.getItem(TMP_KEY)).toBeNull();
  });
});

describe('KvEventJournal', () => {
  const ev = (op: string, t = 0): JournalEvent => ({ eventId: `e_${op}`, operationId: op, type: 'buy', timestamp: t, rulesVersion: 1, details: { item: 'potion_s' } });

  it('operationId 去重；重新開啟後仍記得', () => {
    const kv = new MemoryKV();
    const j = new KvEventJournal(kv);
    j.append(ev('op1'));
    j.append(ev('op1'));
    expect(j.recent()).toHaveLength(1);
    expect(j.has('op1')).toBe(true);
    const j2 = new KvEventJournal(kv);
    expect(j2.has('op1')).toBe(true);
    expect(j2.has('op2')).toBe(false);
  });

  it('只保留最近 N 筆', () => {
    const kv = new MemoryKV();
    const j = new KvEventJournal(kv, 'k', 5);
    for (let i = 0; i < 12; i++) j.append(ev(`op${i}`, i));
    expect(j.recent().map((e) => e.operationId)).toEqual(['op7', 'op8', 'op9', 'op10', 'op11']);
    expect(new KvEventJournal(kv, 'k', 5).recent()).toHaveLength(5);
  });

  it('寫入失敗不丟例外、記憶體仍保留；壞掉的紀錄當成空的', () => {
    const kv = new FlakyKV();
    kv.failOn.add('k');
    const j = new KvEventJournal(kv, 'k');
    expect(() => j.append(ev('a'))).not.toThrow();
    expect(j.has('a')).toBe(true);
    const kv2 = new MemoryKV();
    kv2.setItem('k', 'not json');
    expect(new KvEventJournal(kv2, 'k').recent()).toEqual([]);
  });
});

describe('Clock', () => {
  it('fixedClock 可手動推進', () => {
    const c = fixedClock(1000);
    c.advance(500);
    expect(c.now()).toBe(1500);
  });
});
