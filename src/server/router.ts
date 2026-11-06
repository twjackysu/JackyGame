// handler 登記表：每個方法一個函式，拿到 ctx（帳號、資料存取、時間、id）與已經是 JSON 的 params。
import type { Method, ParamsOf, ResultOf } from '../net/protocol';
import type { Rng } from '../core/rng';
import type { Clock, IdGen } from './clock';
import type { Repos } from './repos/types';

export interface Ctx {
  accountId: string;
  r: Repos;
  clock: Clock;
  ids: IdGen;
  /** 伺服器的擲骰（強化成功率等）；客戶端永遠不送擲骰結果 */
  rng: Rng;
  /** 本機版才有的能力（例如接受舊存檔遷移） */
  local: boolean;
}

export type Handler<M extends Method> = (ctx: Ctx, params: ParamsOf<M>) => Promise<ResultOf<M>>;
export type HandlerTable = { [M in Method]: Handler<M> };
