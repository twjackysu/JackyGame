// src/server/ports.ts 的本機（離線）實作（design/14 階段 1.4）。
// 存檔的 Repository 實作是 save.ts 的 SaveStore；這裡是時鐘與事件紀錄。
// 儲存體一律透過注入的 KV（localStorage 相容），方便測試模擬寫入失敗。
import type { Clock, EventJournal, JournalEvent } from '../../server/ports';
import type { KV } from './save';

export const systemClock: Clock = { now: () => Date.now() };

/** 測試／模擬用：手動推進的時鐘 */
export function fixedClock(start = 0): Clock & { advance(ms: number): void } {
  let t = start;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

export const JOURNAL_KEY = 'jackygame.journal.v1';
export const JOURNAL_LIMIT = 300;

/**
 * 玩家資產變動紀錄：只保留最近 `limit` 筆（超過丟最舊的），用 operationId 去重。
 * 寫入失敗（空間不足）不影響遊戲：記憶體裡的紀錄仍在，下次成功寫入時一起存。
 */
export class KvEventJournal implements EventJournal {
  private events: JournalEvent[] = [];
  private ops = new Set<string>();

  constructor(
    private kv: KV,
    private key = JOURNAL_KEY,
    private limit = JOURNAL_LIMIT,
  ) {
    try {
      const raw = kv.getItem(key);
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(arr)) this.events = arr.filter((e): e is JournalEvent => !!e && typeof (e as JournalEvent).operationId === 'string').slice(-limit);
    } catch {
      this.events = [];
    }
    for (const e of this.events) this.ops.add(e.operationId);
  }

  has(operationId: string): boolean {
    return this.ops.has(operationId);
  }

  append(event: JournalEvent): void {
    if (this.ops.has(event.operationId)) return; // 重複送出：不重複記
    this.events.push(event);
    this.ops.add(event.operationId);
    while (this.events.length > this.limit) {
      const old = this.events.shift()!;
      this.ops.delete(old.operationId);
    }
    try {
      this.kv.setItem(this.key, JSON.stringify(this.events));
    } catch {
      /* 空間不足：保留在記憶體 */
    }
  }

  /** 最近的紀錄（新的在後面），除錯面板／經濟統計用 */
  recent(n = this.limit): JournalEvent[] {
    return this.events.slice(-n);
  }
}
