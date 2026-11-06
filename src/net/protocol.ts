// 客戶端 ↔ 伺服器的訊息格式（D-277，design/24 §1～2）。邊界上只有 JSON：這裡只放型別與純函式。
// 換成線上版時這份檔案兩邊共用，不用改。
import type { AccountView, CharacterView, ExportBlob, LegacySnapshot, MigrateResult, ShopView } from './views';

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
  // 行囊與強化（第 141 輪 V2；規則在 core/meta/bag.ts，擲骰在伺服器）
  'inventory.equip': { params: { characterId: string; itemId: string }; result: CharacterView; write: true };
  'inventory.unequip': { params: { characterId: string; slot: string }; result: CharacterView; write: true };
  'inventory.salvage': { params: { characterId: string; itemId: string }; result: { dust: number; character: CharacterView }; write: true };
  'enhance.do': { params: { characterId: string; itemId: string }; result: { ok: boolean; enh: number; character: CharacterView }; write: true };
  // 技能點（core/meta/skills.ts）：點數伺服器依等級算
  'skills.add': { params: { characterId: string; skill: string }; result: CharacterView; write: true };
  'skills.variant': { params: { characterId: string; skill: string; idx: 0 | 1 | 2 }; result: CharacterView; write: true };
  'skills.reset': { params: { characterId: string }; result: CharacterView; write: true };
  // 營火行商（core/meta/shop.ts）。shop.open 第一次打開這批貨會決定「為你挑選」的部位，所以算寫入
  'shop.open': { params: { characterId: string; region: string }; result: ShopView; write: true };
  'shop.buy': { params: { characterId: string; region: string; uid: string }; result: { character: CharacterView; shop: ShopView }; write: true };
  'shop.buyGoods': { params: { characterId: string; goodsId: string }; result: CharacterView; write: true };
  'shop.sell': { params: { characterId: string; itemIds: string[] }; result: { coin: number; character: CharacterView }; write: true };
  'shop.reroll': { params: { characterId: string; region: string }; result: { character: CharacterView; shop: ShopView }; write: true };
}
export type Method = keyof Api;
export type ParamsOf<M extends Method> = Api[M]['params'];
export type ResultOf<M extends Method> = Api[M]['result'];

/** 寫入類方法（必須帶 requestId） */
export const WRITE_METHODS: ReadonlySet<Method> = new Set<Method>([
  'account.import',
  'migrate.legacy',
  'inventory.equip',
  'inventory.unequip',
  'inventory.salvage',
  'enhance.do',
  'shop.open',
  'shop.buy',
  'shop.buyGoods',
  'shop.sell',
  'shop.reroll',
  'skills.add',
  'skills.variant',
  'skills.reset',
]);

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
