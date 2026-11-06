// 權威伺服器（D-277，design/24）：收 JSON 字串、回 JSON 字串。本機版跑在遊戲裡（LocalTransport），
// 線上版原封不動放到 Node（server/main.ts＋WsTransport）。不 import Phaser、src/game、src/client。
import { ApiError, PROTOCOL_VERSION, WRITE_METHODS, parseRequest, type Method, type Response } from '../net/protocol';
import type { Auth } from './auth';
import { randomIds, systemClock, type Clock, type IdGen } from './clock';
import { HANDLERS } from './handlers';
import { REQUEST_TTL_MS, cached, remember, requestKey } from './idempotency';
import type { Db } from './repos/types';
import type { Rng } from '../core/rng';
import { secureRandom } from './random';
import type { Ctx } from './router';
import { SimMarket, type SimOptions } from './sim/SimMarket';

export interface GameServerOptions {
  db: Db;
  auth: Auth;
  clock?: Clock;
  ids?: IdGen;
  /** 擲骰（預設 crypto）；測試注入固定種子 */
  rng?: Rng;
  /** 本機版（接受舊存檔遷移等只有單機才合理的請求） */
  local?: boolean;
  /** 開模擬玩家（本機版預設開；線上版關掉或保留當填充）。true＝預設設定 */
  sim?: boolean | SimOptions;
}

/** 開這些畫面時先讓模擬玩家補跑（不用常駐計時器） */
const SIM_TRIGGER: ReadonlySet<string> = new Set(['market.browse', 'market.mine']);

export type AnyHandler = (ctx: Ctx, p: unknown) => Promise<unknown>;

export class GameServer {
  private readonly clock: Clock;
  private readonly ids: IdGen;
  /** 模擬玩家（本機版才開，24 §5）；看拍賣所時依經過時間補跑 */
  readonly sim?: SimMarket;
  /** 處理過的請求數（測試用：確認重送沒有重複執行） */
  executed = 0;

  constructor(private readonly o: GameServerOptions) {
    this.clock = o.clock ?? systemClock;
    this.ids = o.ids ?? randomIds;
    if (o.sim) this.sim = new SimMarket(this, this.clock, o.sim === true ? {} : o.sim);
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
      if (this.sim && SIM_TRIGGER.has(method)) await this.sim.catchUp();
      const result = await this.run(accountId, method, req.params, write ? req.requestId! : undefined, HANDLERS[method] as AnyHandler);
      return `{"id":${id},"ok":true,"result":${result}}`;
    } catch (e) {
      const err = e instanceof ApiError ? { code: e.code, message: e.message } : { code: 'internal' as const, message: e instanceof Error ? e.message : String(e) };
      const res: Response = { id, ok: false, error: err };
      return JSON.stringify(res);
    }
  }

  /**
   * 執行一個 handler（一個資料庫交易；寫入帶 requestId 時冪等）。
   * handle() 用它處理客戶端的請求；模擬玩家（src/server/sim）也用它，所以模擬玩家和真人走同一份規則。
   * 這個方法不經過傳輸層：客戶端只能呼叫 handle()，碰不到 accountId 參數。
   */
  async run(accountId: string, method: string, params: unknown, requestId: string | undefined, handler: AnyHandler): Promise<string> {
    const r = await this.o.db.tx(async (r) => {
      const key = requestId ? requestKey(accountId, requestId) : '';
      if (requestId) {
        const prev = await r.requests.get(key);
        if (prev) {
          if (prev.method !== method) throw new ApiError('conflict', 'requestId reused for another method');
          return (await cached(r, key, method as Method))!;
        }
      }
      this.executed++;
      const out = JSON.stringify(await handler({ accountId, r, clock: this.clock, ids: this.ids, rng: this.o.rng ?? secureRandom, local: !!this.o.local }, params));
      if (requestId) {
        const now = this.clock.now();
        await remember(r, key, method as Method, out, now);
        await r.requests.prune(now - REQUEST_TTL_MS);
      }
      return out;
    });
    return r;
  }
}
