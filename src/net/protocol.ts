// 客戶端 ↔ 伺服器的訊息格式（D-277，design/24 §1～2）。邊界上只有 JSON：這裡只放型別與純函式。
// 換成線上版時這份檔案兩邊共用，不用改。
import type { AccountView, BountyDoneView, CharacterView, ExportBlob, LegacySnapshot, ListingView, LootDropView, MigrateResult, PvpStartView, PvpLadderView, ShopView, TradeView, WarehouseView, WeaponView } from './views';

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
  // 多角色（F1，core/meta/roster.ts，D-302）：3 個角色欄；刪除不能刪目前角色、最後一個、拍賣／交易中還有東西的
  'character.create': { params: { name: string; weapon: WeaponView; slot?: number }; result: CharacterView; write: true };
  'character.delete': { params: { id: string }; result: AccountView; write: true };
  'character.select': { params: { id: string }; result: CharacterView; write: true };
  /** 改名（第 147 輪）：規則同建立（1～8 字、不准控制字元與 <>&"'\\） */
  'character.rename': { params: { id: string; name: string }; result: CharacterView; write: true };
  // 帳號共用倉庫（40 格）：只有行囊裡的能放
  'warehouse.get': { params: Record<string, never>; result: WarehouseView; write: false };
  'warehouse.put': { params: { characterId: string; itemId: string }; result: { warehouse: WarehouseView; character: CharacterView }; write: true };
  'warehouse.take': { params: { characterId: string; itemId: string }; result: { warehouse: WarehouseView; character: CharacterView }; write: true };
  'account.export': { params: Record<string, never>; result: ExportBlob; write: false };
  'account.import': { params: { blob: ExportBlob }; result: AccountView; write: true };
  'migrate.legacy': { params: { snapshot: LegacySnapshot }; result: MigrateResult; write: true };
  /** 過渡期（D-285，只有本機版）：把舊 key 的現況同步到目前角色，回傳同步後的角色 */
  'migrate.sync': { params: { snapshot: LegacySnapshot }; result: CharacterView; write: true };
  /** 過渡期（D-302，只有本機版）：目前角色 → 舊 key 快照（換角色時寫回 localStorage） */
  'migrate.pull': { params: Record<string, never>; result: { characterId: string; snapshot: LegacySnapshot }; write: false };
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
  // 討伐後的抉擇（core/meta/choices.ts，D-290）：要打倒過那張地圖的 Boss、只能選一次；「取」的結晶伺服器發
  /** 路上的相遇（第 147 輪）：選一次，「取」的獎勵伺服器發 */
  'story.meet': { params: { characterId: string; encounterId: string; pick: 'take' | 'spare' }; result: { coin: number; crystal: number; character: CharacterView }; write: true };
  /** 相遇的回禮：選過「助」才有、只有一次 */
  'story.thanks': { params: { characterId: string; encounterId: string }; result: { coin: number; crystal: number; character: CharacterView }; write: true };
  'story.choose': { params: { characterId: string; map: string; pick: 'take' | 'spare' }; result: { crystal: number; character: CharacterView }; write: true };
  // 拍賣所（core/meta/market.ts，24 §4.1）：上架收上架費、成交扣手續費、物品換主人都在同一個交易
  'market.list': { params: { characterId: string; itemId: string; price: number }; result: { listing: ListingView; character: CharacterView }; write: true };
  'market.cancel': { params: { characterId: string; listingId: string }; result: CharacterView; write: true };
  'market.buy': { params: { characterId: string; listingId: string }; result: CharacterView; write: true };
  /** 最近成交（第 153 輪，D-329）：同部位同稀有度最近 HISTORY_N 筆的價格（不帶買賣雙方），上架時參考定價 */
  'market.history': { params: { slot: string; rarity: number }; result: { sales: { price: number; ilvl: number; at: number }[] }; write: false };
  'market.browse': { params: { slot?: string; rarity?: number; page?: number; refs?: boolean }; result: { listings: ListingView[]; page: number; refs?: Record<string, number> }; write: false };
  /** 自己的掛單；過期的物品在這裡退回行囊（所以算寫入） */
  /** news＝上次看過之後才賣出的掛單（第 149 輪：「你不在的時候賣出了…」） */
  'market.mine': { params: { characterId: string }; result: { listings: ListingView[]; news: ListingView[]; character: CharacterView }; write: true };
  // 非同步 PvP 天梯（core/battle/rt/pvpMatch.ts，24 §6.2）：伺服器發種子與雙方配裝 → 客戶端打完送自己的指令紀錄 → 伺服器重跑判勝負、改段位分
  /** foeId＝天梯上指名挑戰的對手（第 149 輪；段位分差 PVP_CHALLENGE_RANGE 內）；沒有＝伺服器挑分數接近的 */
  'pvp.start': { params: { characterId: string; foeId?: string }; result: PvpStartView; write: true };
  'pvp.finish': { params: { characterId: string; matchId: string; inputs: unknown[] }; result: { outcome: 'victory' | 'defeat' | 'timeout'; rating: number; delta: number; /** 打完後的連勝（D-324，只給外觀） */ streak: number; /** 今天（台北）第一次贏 */ firstWin: boolean; /** 本季第一次到達這個段位（D-328，只給字與光） */ seasonTier?: boolean }; write: true };
  // 面對面交易（託管，core/meta/trade.ts，24 §4.2）：放進去的物品與金幣先由伺服器保管；雙方鎖定＋對目前版本確認才交換
  'trade.open': { params: { characterId: string; partnerCharacterId: string }; result: { trade: TradeView; character: CharacterView }; write: true };
  'trade.offer': { params: { characterId: string; tradeId: string; items: string[]; coin: number }; result: { trade: TradeView; character: CharacterView }; write: true };
  'trade.lock': { params: { characterId: string; tradeId: string }; result: { trade: TradeView; character: CharacterView }; write: true };
  'trade.confirm': { params: { characterId: string; tradeId: string; rev: number }; result: { trade: TradeView; character: CharacterView }; write: true };
  'trade.cancel': { params: { characterId: string; tradeId: string }; result: { trade: TradeView; character: CharacterView }; write: true };
  /** 可以交易的對象（本機版：已經出現過的模擬冒險者；線上版之後換成好友／附近的玩家） */
  'trade.partners': { params: { characterId: string }; result: { partners: { characterId: string; name: string; weapon: WeaponView; /** 只放金幣跟它買，最少要放多少（它什麼都沒得賣就沒有） */ cheapest?: number }[]; open: { id: string; partnerName: string }[] }; write: false };
  /** 看一筆交易；過期的在這裡退回（所以算寫入） */
  'trade.get': { params: { characterId: string; tradeId: string }; result: { trade: TradeView; character: CharacterView }; write: true };
  /** 天梯排行：前幾名＋自己的名次（只讀） */
  'pvp.ladder': { params: { characterId: string }; result: PvpLadderView; write: false };
  // PvE 掉落由伺服器擲（26-security §3.1，D-307）：開打拿 battleId → 每打倒一隻送「打倒了誰、在哪一群」→ 伺服器檢查後用自己的亂數擲掉落、直接入帳
  'battle.start': { params: { characterId: string; stageId: string; night?: boolean }; result: { battleId: string }; write: true };
  /** 寶箱（第 147 輪）：伺服器照地圖資料給固定內容；白天的每個角色一次、夜光的每場一次 */
  'loot.chest': { params: { characterId: string; battleId: string; chestId: string }; result: { coin: number; dust: number; crystal: number; character: CharacterView }; write: true };
  'loot.claim': { params: LootClaimParams; result: { drops: LootDropView[]; xp: number; /** 這一隻完成的懸賞（獎勵已入錢包） */ bounty: BountyDoneView[]; character: CharacterView }; write: true };
}
export interface LootClaimParams {
  characterId: string;
  battleId: string;
  /** 這場第幾隻（遞增、不重複） */
  killSeq: number;
  enemyId: string;
  groupId?: string;
  fixedIdx?: number;
  fury?: boolean;
  affix?: boolean;
}
export type Method = keyof Api;
export type ParamsOf<M extends Method> = Api[M]['params'];
export type ResultOf<M extends Method> = Api[M]['result'];

/** 寫入類方法（必須帶 requestId） */
export const WRITE_METHODS: ReadonlySet<Method> = new Set<Method>([
  'account.import',
  'character.create',
  'character.delete',
  'character.select',
  'character.rename',
  'warehouse.put',
  'warehouse.take',
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
  'story.choose',
  'story.meet',
  'story.thanks',
  'market.list',
  'market.cancel',
  'market.buy',
  'market.mine',
  'pvp.start',
  'pvp.finish',
  'trade.open',
  'trade.offer',
  'trade.lock',
  'trade.confirm',
  'trade.cancel',
  'trade.get',
  'battle.start',
  'loot.claim',
  'loot.chest',
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
