// 伺服器的時間與 id（鐵律 3：時間、id 都由伺服器給）。測試注入假時鐘與固定序號。
export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };

export class FakeClock implements Clock {
  constructor(public t = 1_700_000_000_000) {}
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

export interface IdGen {
  next(prefix: string): string;
}

/** 正式：隨機 UUID（瀏覽器與 Node 都有 crypto.randomUUID；沒有就用時間＋計數器） */
export const randomIds: IdGen = {
  next(prefix) {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return `${prefix}_${c.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
  },
};

/** 測試：固定序號 */
export class SeqIds implements IdGen {
  private n = 0;
  next(prefix: string): string {
    return `${prefix}_${++this.n}`;
  }
}
