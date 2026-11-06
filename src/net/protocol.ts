// 客戶端 ↔ 伺服器的訊息格式（D-277，design/24 §1～2）。邊界上只有 JSON：這裡只放型別與純函式。
// 換成線上版時這份檔案兩邊共用，不用改。
import type { AccountView, CharacterView, ExportBlob, LegacySnapshot, ListingView, MigrateResult, PvpStartView, PvpLadderView, ShopView } from './views';

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
  /** 過渡期（D-285，只有本機版）：把舊 key 的現況同步到角色 1，回傳同步後的角色 */
  'migrate.sync': { params: { snapshot: LegacySnapshot }; result: CharacterView; write: true };
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
  // 燼牌下注（core/meta/cards.ts，D-289）：開局時伺服器扣賭注、發種子與牌組；打完送出牌紀錄，伺服器重播判勝負並結算
  'cards.start': { params: { characterId: string; opponentId: string }; result: { matchId: string; seed: number; deck: string[]; character: CharacterView }; write: true };
  'cards.finish': { params: { characterId: string; matchId: string; moves: CardMoveView[] }; result: { winner: number; payout: number; prize: string | null; character: CharacterView }; write: true };
  // 討伐後的抉擇（core/meta/choices.ts，D-290）：要打倒過那張地圖的 Boss、只能選一次；「取」的結晶伺服器發
  'story.choose': { params: { characterId: string; map: string; pick: 'take' | 'spare' }; result: { crystal: number; character: CharacterView }; write: true };
  // 拍賣所（core/meta/market.ts，24 §4.1）：上架收上架費、成交扣手續費、物品換主人都在同一個交易
  'market.list': { params: { characterId: string; itemId: string; price: number }; result: { listing: ListingView; character: CharacterView }; write: true };
  'market.cancel': { params: { characterId: string; listingId: string }; result: CharacterView; write: true };
  'market.buy': { params: { characterId: string; listingId: string }; result: CharacterView; write: true };
  'market.browse': { params: { slot?: string; rarity?: number; page?: number }; result: { listings: ListingView[]; page: number }; write: false };
  /** 自己的掛單；過期的物品在這裡退回行囊（所以算寫入） */
  'market.mine': { params: { characterId: string }; result: { listings: ListingView[]; character: CharacterView }; write: true };
  // 非同步 PvP 天梯（core/battle/rt/pvpMatch.ts，24 §6.2）：伺服器發種子與雙方配裝 → 客戶端打完送自己的指令紀錄 → 伺服器重跑判勝負、改段位分
  'pvp.start': { params: { characterId: string }; result: PvpStartView; write: true };
  'pvp.finish': { params: { characterId: string; matchId: string; inputs: unknown[] }; result: { outcome: 'victory' | 'defeat' | 'timeout'; rating: number; delta: number }; write: true };
  /** 天梯排行：前幾名＋自己的名次（只讀） */
  'pvp.ladder': { params: { characterId: string }; result: PvpLadderView; write: false };
}
/** 燼牌的一手（和 core/cards 的 Move 同形狀） */
export type CardMoveView = { type: 'play'; card: number } | { type: 'pass' };
export type Method = keyof Api;
export type ParamsOf<M extends Method> = Api[M]['params'];
export type ResultOf<M extends Method> = Api[M]['result'];

/** 寫入類方法（必須帶 requestId） */
export const WRITE_METHODS: ReadonlySet<Method> = new Set<Method>([
  'account.import',
  'migrate.legacy',
  'migrate.sync',
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
  'cards.start',
  'cards.finish',
  'story.choose',
  'market.list',
  'market.cancel',
  'market.buy',
  'market.mine',
  'pvp.start',
  'pvp.finish',
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
