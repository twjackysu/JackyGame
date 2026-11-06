// 權威伺服器（D-277，design/24）：收 JSON 字串、回 JSON 字串。本機版跑在遊戲裡（LocalTransport），
// 線上版原封不動放到 Node（server/main.ts＋WsTransport）。不 import Phaser、src/game、src/client。
import { ApiError, PROTOCOL_VERSION, WRITE_METHODS, parseRequest, type Method, type Response } from '../net/protocol';
import type { Auth } from './auth';
import { randomIds, systemClock, type Clock, type IdGen } from './clock';
import { HANDLERS } from './handlers';
import { REQUEST_TTL_MS, cached, remember, requestKey } from './idempotency';
import type { Db } from './repos/types';

export interface GameServerOptions {
  db: Db;
  auth: Auth;
  clock?: Clock;
  ids?: IdGen;
  /** 本機版（接受舊存檔遷移等只有單機才合理的請求） */
  local?: boolean;
}

export class GameServer {
  private readonly clock: Clock;
  private readonly ids: IdGen;
  /** 處理過的請求數（測試用：確認重送沒有重複執行） */
  executed = 0;

  constructor(private readonly o: GameServerOptions) {
    this.clock = o.clock ?? systemClock;
    this.ids = o.ids ?? randomIds;
  }

  /** 一則請求 → 一則回應（永遠回 JSON，不丟例外） */
  async handle(json: string): Promise<string> {
    let id = -1;
    try {
      const req = parseRequest(json);
      id = req.id;
      if (req.v !== PROTOCOL_VERSION) throw new ApiError('version', `protocol ${req.v} != ${PROTOCOL_VERSION}`);
      if (!Object.prototype.hasOwnProperty.call(HANDLERS, req.method)) throw new ApiError('unknown_method', req.method);
      const method = req.method as Method;
      const write = WRITE_METHODS.has(method);
      if (write && !req.requestId) throw new ApiError('bad_request', 'write needs requestId');
      const accountId = await this.o.auth.resolve(req.token);
      const result = await this.o.db.tx(async (r) => {
        const key = write ? requestKey(accountId, req.requestId!) : '';
        if (write) {
          const prev = await r.requests.get(key);
          if (prev) {
            if (prev.method !== method) throw new ApiError('conflict', 'requestId reused for another method');
            return { replay: (await cached(r, key, method))! };
          }
        }
        this.executed++;
        const handler = HANDLERS[method] as (ctx: never, p: unknown) => Promise<unknown>;
        const out = JSON.stringify(await handler({ accountId, r, clock: this.clock, ids: this.ids, local: !!this.o.local } as never, req.params));
        if (write) {
          const now = this.clock.now();
          await remember(r, key, method, out, now);
          await r.requests.prune(now - REQUEST_TTL_MS);
        }
        return { fresh: out };
      });
      const body = 'replay' in result ? result.replay : result.fresh;
      return `{"id":${id},"ok":true,"result":${body}}`;
    } catch (e) {
      const err = e instanceof ApiError ? { code: e.code, message: e.message } : { code: 'internal' as const, message: e instanceof Error ? e.message : String(e) };
      const res: Response = { id, ok: false, error: err };
      return JSON.stringify(res);
    }
  }
}
