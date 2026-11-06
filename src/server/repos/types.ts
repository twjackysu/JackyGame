// 資料表的列（design/24 §3）。線上版這些就是 `game` schema 的資料表（25 §3）；本機版存在 IndexedDB。
// 規則：一件物品同一時間只在一個 location；金錢只能透過 Wallet＋LedgerEntry 異動（複式記帳）。
import type { CurrencyId, MapProgressView, WeaponView } from '../../net/views';

export interface AccountRow {
  id: string;
  displayName: string;
  createdAt: number;
  /** 本機版：舊存檔遷移的時間 */
  migratedAt?: number;
}

export interface CharacterRow {
  id: string;
  accountId: string;
  slot: number;
  name: string;
  weapon: WeaponView;
  level: number;
  xp: number;
  stats: Record<string, number>;
  skills: unknown;
  variants: unknown;
  bounty: unknown;
  shop: unknown;
  maps: Record<string, MapProgressView>;
  /** 劇情與教學旗標（舊存檔原樣保留；V2 決定哪些屬於角色、哪些是裝置偏好） */
  story: Record<string, string>;
  /** 進行中的燼牌下注局（D-289）：伺服器的種子與牌組；打完或重開一局就換掉 */
  cardMatch?: CardMatchRow;
  createdAt: number;
  version: number;
}

export interface CardMatchRow {
  id: string;
  opponentId: string;
  seed: number;
  deck: string[];
  stake: number;
  /** 下注贏了拿到哪張牌（開局時照當時的收藏決定） */
  prize?: string;
  at: number;
}

export interface ItemRow {
  id: string;
  ownerId: string;
  location: string;
  pos: number;
  bound: boolean;
  gear: Record<string, unknown>;
  createdAt: number;
  version: number;
}

export interface WalletRow {
  /** characterId:currency */
  id: string;
  characterId: string;
  currency: CurrencyId;
  balance: number;
  version: number;
}

export interface LedgerRow {
  id: string;
  characterId: string;
  currency: CurrencyId;
  delta: number;
  balanceAfter: number;
  reason: string;
  refId?: string;
  at: number;
}

/** 拍賣所的掛單（24 §4.1、25 §3 game.MarketListing）。物品本體還在 items（location＝market:<id>），這裡多存一份給搜尋用 */
export interface ListingRow {
  id: string;
  sellerAccountId: string;
  sellerCharacterId: string;
  sellerName: string;
  itemId: string;
  price: number;
  status: 'open' | 'sold' | 'cancelled' | 'expired';
  slot: string;
  rarity: number;
  ilvl: number;
  gear: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
  closedAt?: number;
  buyerCharacterId?: string;
  version: number;
}

export interface ListingQuery {
  slot?: string;
  rarity?: number;
  /** 不列這個帳號自己的掛單 */
  excludeAccountId?: string;
  /** 只列這個時間之後才過期的 */
  aliveAt: number;
  offset: number;
  limit: number;
}

export interface RequestLogRow {
  /** accountId:requestId */
  id: string;
  method: string;
  /** 上次的回應（JSON 字串） */
  response: string;
  at: number;
}

export interface AuditRow {
  id: string;
  accountId: string;
  action: string;
  detail: string;
  at: number;
}

/** 所有資料表（本機版的 store 名稱＝線上版的資料表名稱） */
export interface Tables {
  accounts: AccountRow;
  characters: CharacterRow;
  items: ItemRow;
  wallets: WalletRow;
  ledger: LedgerRow;
  requests: RequestLogRow;
  audit: AuditRow;
  listings: ListingRow;
}
export type TableName = keyof Tables;
export const TABLES: readonly TableName[] = ['accounts', 'characters', 'items', 'wallets', 'ledger', 'requests', 'audit', 'listings'];

/** 交易內可用的資料存取（handler 只看得到這個介面；SQL 版用 Kysely 實作同一份介面） */
export interface Repos {
  accounts: {
    get(id: string): Promise<AccountRow | undefined>;
    put(row: AccountRow): Promise<void>;
  };
  characters: {
    get(id: string): Promise<CharacterRow | undefined>;
    listByAccount(accountId: string): Promise<CharacterRow[]>;
    /** 新增或更新；更新時 row.version 必須等於資料庫裡的版本（樂觀鎖），存進去後 +1 */
    save(row: CharacterRow): Promise<CharacterRow>;
    delete(id: string): Promise<void>;
  };
  items: {
    get(id: string): Promise<ItemRow | undefined>;
    listByOwner(ownerId: string): Promise<ItemRow[]>;
    save(row: ItemRow): Promise<ItemRow>;
    delete(id: string): Promise<void>;
  };
  wallets: {
    balances(characterId: string): Promise<Record<CurrencyId, number>>;
    /** 異動餘額並寫一行帳；餘額會變負就丟 rejected */
    apply(characterId: string, currency: CurrencyId, delta: number, reason: string, refId?: string): Promise<number>;
    ledger(characterId: string): Promise<LedgerRow[]>;
    deleteCharacter(characterId: string): Promise<void>;
  };
  requests: {
    get(id: string): Promise<RequestLogRow | undefined>;
    put(row: RequestLogRow): Promise<void>;
    /** 刪掉 at 早於 before 的紀錄 */
    prune(before: number): Promise<void>;
  };
  audit: {
    add(row: Omit<AuditRow, 'id'>): Promise<void>;
  };
  listings: {
    get(id: string): Promise<ListingRow | undefined>;
    /** 新增或更新（樂觀鎖同 items） */
    save(row: ListingRow): Promise<ListingRow>;
    /** 還開著的掛單：價格低的在前，同價先上架的在前 */
    listOpen(q: ListingQuery): Promise<ListingRow[]>;
    /** 這個角色上架過的（新的在前，最多 limit 筆） */
    listBySeller(characterId: string, limit: number): Promise<ListingRow[]>;
  };
}

/** 資料庫：所有寫入都在 tx 裡；fn 丟錯就整個回滾 */
export interface Db {
  tx<T>(fn: (r: Repos) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const CURRENCIES: readonly CurrencyId[] = ['coin', 'dust', 'crystal'];
