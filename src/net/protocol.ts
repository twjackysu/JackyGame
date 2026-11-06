// 客戶端 ↔ 伺服器的訊息格式（D-277，design/24 §1～2）。邊界上只有 JSON：這裡只放型別與純函式。
// 換成線上版時這份檔案兩邊共用，不用改。
import type { AccountView, CharacterView, ExportBlob, LegacySnapshot, MigrateResult } from './views';

export const PROTOCOL_VERSION = 1;

export interface Request {
  v: number;
  /** 這則訊息的 id（同一個 requestId 重送時會換新的 id） */
  id: number;
  method: string;
  params: unknown;
  /** 寫入類方法一定要帶（冪等，鐵律 4）；讀取類可以不帶 */
  requestId?: string;
  /** 登入憑證（本機版是 LocalAuth 的固定字串；線上版換成真的 token） */
  token?: string;
}

export type ErrorCode = 'bad_request' | 'version' | 'unknown_method' | 'unauthorized' | 'not_found' | 'conflict' | 'rejected' | 'rate_limited' | 'internal';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
}

export type Response = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: ErrorBody };

/** 所有方法：params 與 result 的型別。新增方法就在這裡加一行，伺服器 handler 和 GameClient 自動吃到型別。 */
export interface Api {
  'account.get': { params: Record<string, never>; result: AccountView; write: false };
  'character.list': { params: Record<string, never>; result: CharacterView[]; write: false };
  'character.get': { params: { id: string }; result: CharacterView; write: false };
  'account.export': { params: Record<string, never>; result: ExportBlob; write: false };
  'account.import': { params: { blob: ExportBlob }; result: AccountView; write: true };
  'migrate.legacy': { params: { snapshot: LegacySnapshot }; result: MigrateResult; write: true };
}
export type Method = keyof Api;
export type ParamsOf<M extends Method> = Api[M]['params'];
export type ResultOf<M extends Method> = Api[M]['result'];

/** 寫入類方法（必須帶 requestId） */
export const WRITE_METHODS: ReadonlySet<Method> = new Set<Method>(['account.import', 'migrate.legacy']);

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** 解析一則請求；格式錯就丟 ApiError（伺服器會回 bad_request） */
export function parseRequest(json: string): Request {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ApiError('bad_request', 'not json');
  }
  if (!raw || typeof raw !== 'object') throw new ApiError('bad_request', 'not an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'number' || typeof r.method !== 'string' || typeof r.v !== 'number') throw new ApiError('bad_request', 'missing v/id/method');
  if (r.requestId !== undefined && (typeof r.requestId !== 'string' || r.requestId.length > 64)) throw new ApiError('bad_request', 'bad requestId');
  if (r.token !== undefined && typeof r.token !== 'string') throw new ApiError('bad_request', 'bad token');
  return { v: r.v, id: r.id, method: r.method, params: r.params ?? {}, requestId: r.requestId as string | undefined, token: r.token as string | undefined };
}
