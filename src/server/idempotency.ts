// 冪等（鐵律 4）：寫入請求帶 requestId，伺服器記住「這個帳號的這個 requestId → 上次的回應」。
// 重送（網路掉包、使用者連點）時直接回上次的結果，不會買兩次。紀錄存在資料庫（重開也記得），保留 24 小時。
import type { Repos } from './repos/types';

export const REQUEST_TTL_MS = 24 * 3600 * 1000;

export const requestKey = (accountId: string, requestId: string): string => `${accountId}:${requestId}`;

export async function cached(r: Repos, key: string, method: string): Promise<string | undefined> {
  const row = await r.requests.get(key);
  return row && row.method === method ? row.response : undefined;
}

export async function remember(r: Repos, key: string, method: string, response: string, now: number): Promise<void> {
  await r.requests.put({ id: key, method, response, at: now });
}
