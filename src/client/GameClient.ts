// 客戶端呼叫伺服器的唯一入口（D-277，鐵律 1）：畫面層只用 client.call('方法', 參數)，用回傳結果更新畫面。
// 寫入類方法自動帶 requestId；逾時就用「同一個 requestId」重送（伺服器冪等，不會買兩次）。
import { ApiError, PROTOCOL_VERSION, WRITE_METHODS, type Method, type ParamsOf, type Request, type Response, type ResultOf } from '../net/protocol';
import { TransportTimeout, type Transport } from '../net/Transport';

export interface GameClientOptions {
  token?: string;
  timeoutMs?: number;
  /** 逾時重送幾次 */
  retries?: number;
  /** requestId 產生器（測試用固定的） */
  newRequestId?: () => string;
  /** 伺服器回 unauthorized（線上版登入過期，第 148 輪）：每個 client 只叫一次，讓畫面請玩家重新登入 */
  onUnauthorized?: () => void;
  /**
   * 伺服器回 unauthorized 時先試著不轉頁續期（第 149 輪，refresh token）：回新 token 就換上、用同一個 requestId 重送一次；
   * 回 undefined 才走 onUnauthorized。同時好幾個請求被拒只會續期一次。
   */
  refreshToken?: () => Promise<string | undefined>;
}

let seq = 0;
const defaultRequestId = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
};

export class GameClient {
  private msgId = 0;
  private unauthorizedSeen = false;
  private token: string | undefined;
  private refreshing: Promise<string | undefined> | null = null;
  constructor(
    private readonly transport: Transport,
    private readonly o: GameClientOptions = {},
  ) {
    this.token = o.token;
  }

  /** 續期（同時被拒的請求共用同一次） */
  private renew(): Promise<string | undefined> {
    const f = this.o.refreshToken;
    if (!f) return Promise.resolve(undefined);
    return (this.refreshing ??= f()
      .catch(() => undefined)
      .then((t) => {
        if (t) this.token = t;
        return t;
      })
      .finally(() => {
        this.refreshing = null;
      }));
  }

  async call<M extends Method>(method: M, params: ParamsOf<M>, requestId?: string): Promise<ResultOf<M>> {
    const rid = WRITE_METHODS.has(method) ? (requestId ?? (this.o.newRequestId ?? defaultRequestId)()) : undefined;
    const tries = 1 + (this.o.retries ?? 3);
    let renewed = false;
    for (let k = 0; ; k++) {
      const sent = this.token;
      const req: Request = { v: PROTOCOL_VERSION, id: ++this.msgId, method, params, token: sent };
      if (rid) req.requestId = rid;
      let text: string;
      try {
        text = await this.transport.send(JSON.stringify(req), this.o.timeoutMs ?? 8000);
      } catch (e) {
        if (e instanceof TransportTimeout && k + 1 < tries) continue;
        throw e;
      }
      const res = JSON.parse(text) as Response;
      if (res.id !== req.id) continue; // 晚到的舊回應：丟掉
      if (!res.ok) {
        if (res.error.code === 'unauthorized' && !renewed) {
          renewed = true;
          // 別的請求已經換到新 token 了就直接用；不然自己續期
          const t = this.token !== sent ? this.token : await this.renew();
          if (t && t !== sent) {
            k--; // 不算逾時重送的次數
            continue;
          }
        }
        if (res.error.code === 'unauthorized' && this.o.onUnauthorized && !this.unauthorizedSeen) {
          this.unauthorizedSeen = true;
          this.o.onUnauthorized();
        }
        throw new ApiError(res.error.code, res.error.message);
      }
      return res.result as ResultOf<M>;
    }
  }
}
