// 頻率限制（26-security §頻率限制，第 145 輪，D-304）：每個帳號、每類方法一個權杖桶。超過回 rate_limited。
// 線上版（server/main.ts）一定開；本機版不開（只有自己一個人）。模擬玩家走 GameServer.run，不經過這裡。
// 每 IP 的限制在 server/main.ts（HTTP 層）另外做；這裡只看帳號。
import type { Method } from '../net/protocol';

export type LimitClass = 'general' | 'trade' | 'pvp';
export interface Bucket {
  /** 每秒補幾個 */
  perSec: number;
  /** 最多存幾個（瞬間連按） */
  burst: number;
}
export type RateLimits = Record<LimitClass, Bucket>;

/** 預設：一般 API 每秒 10 次；交易類每秒 2 次；PvP 開局／結算（伺服器要重跑一整場）每 3 秒 1 次 */
export const DEFAULT_LIMITS: RateLimits = {
  general: { perSec: 10, burst: 20 },
  trade: { perSec: 2, burst: 5 },
  pvp: { perSec: 1 / 3, burst: 2 },
};

const TRADE = /^(market\.(list|cancel|buy)|trade\.(open|offer|lock|confirm|cancel)|warehouse\.(put|take)|character\.(create|delete|rename))$/;

export function classOf(method: Method | string): LimitClass {
  if (method === 'pvp.start' || method === 'pvp.finish') return 'pvp';
  return TRADE.test(method) ? 'trade' : 'general';
}

/** 記憶體裡的權杖桶（單一容器夠用；要多副本時換成共用的儲存） */
export class RateLimiter {
  private readonly b = new Map<string, { tokens: number; at: number }>();
  constructor(
    private readonly limits: RateLimits = DEFAULT_LIMITS,
    private readonly maxKeys = 20_000,
  ) {}

  /** 允許就扣一個並回 true */
  take(accountId: string, method: string, now: number): boolean {
    const cls = classOf(method);
    const lim = this.limits[cls];
    const key = `${accountId}\u0000${cls}`;
    const cur = this.b.get(key);
    const tokens = cur ? Math.min(lim.burst, cur.tokens + ((Math.max(0, now - cur.at) / 1000) * lim.perSec)) : lim.burst;
    if (tokens < 1) {
      if (cur) this.b.set(key, { tokens, at: now });
      return false;
    }
    if (!cur && this.b.size >= this.maxKeys) this.prune(now);
    this.b.set(key, { tokens: tokens - 1, at: now });
    return true;
  }

  /** 丟掉已經補滿的桶（不影響結果：補滿＝沒有紀錄） */
  private prune(now: number): void {
    for (const [k, v] of this.b) {
      const lim = this.limits[k.slice(k.indexOf('\u0000') + 1) as LimitClass];
      if (v.tokens + ((now - v.at) / 1000) * lim.perSec >= lim.burst) this.b.delete(k);
    }
  }

  get size(): number {
    return this.b.size;
  }
}
