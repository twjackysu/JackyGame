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
}

let seq = 0;
const defaultRequestId = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
};

export class GameClient {
  private msgId = 0;
  constructor(
    private readonly transport: Transport,
    private readonly o: GameClientOptions = {},
  ) {}

  async call<M extends Method>(method: M, params: ParamsOf<M>, requestId?: string): Promise<ResultOf<M>> {
    const rid = WRITE_METHODS.has(method) ? (requestId ?? (this.o.newRequestId ?? defaultRequestId)()) : undefined;
    const tries = 1 + (this.o.retries ?? 3);
    for (let k = 0; ; k++) {
      const req: Request = { v: PROTOCOL_VERSION, id: ++this.msgId, method, params, token: this.o.token };
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
      if (!res.ok) throw new ApiError(res.error.code, res.error.message);
      return res.result as ResultOf<M>;
    }
  }
}
