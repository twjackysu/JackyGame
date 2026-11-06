// game schema 的資料表型別（Kysely）。表名照 25 §2-3：PascalCase 單數，和舊原型的 8 張表（Battles／Pets／…／Players…）不重名。
import type { ColumnType, Generated } from 'kysely';

/** 時間一律存 UTC 毫秒（bigint；tedious 回字串，讀出時轉 Number） */
type Ms = ColumnType<number | string, number, number>;
type Big = ColumnType<number | string, number, number>;

export interface AccountTable {
  Id: string;
  DisplayName: string;
  CreatedAt: Ms;
  MigratedAt: Ms | null;
}
export interface CharacterTable {
  Id: string;
  AccountId: string;
  Slot: number;
  Name: string;
  Weapon: string;
  Level: number;
  Xp: number;
  /** stats、skills、variants、bounty、shop、maps、story（JSON） */
  Data: string;
  CreatedAt: Ms;
  Version: number;
}
export interface ItemTable {
  Id: string;
  OwnerId: string;
  Location: string;
  Pos: number;
  Bound: boolean;
  Data: string;
  CreatedAt: Ms;
  Version: number;
}
export interface WalletTable {
  CharacterId: string;
  Currency: string;
  Balance: Big;
  Version: number;
}
export interface LedgerEntryTable {
  Id: Generated<Big>;
  CharacterId: string;
  Currency: string;
  Delta: Big;
  BalanceAfter: Big;
  Reason: string;
  RefId: string | null;
  At: Ms;
}
export interface RequestLogTable {
  Id: string;
  Method: string;
  Response: string;
  At: Ms;
}
export interface AuditLogTable {
  Id: Generated<Big>;
  AccountId: string;
  Action: string;
  Detail: string;
  At: Ms;
}

export interface GameDb {
  Account: AccountTable;
  Character: CharacterTable;
  Item: ItemTable;
  Wallet: WalletTable;
  LedgerEntry: LedgerEntryTable;
  RequestLog: RequestLogTable;
  AuditLog: AuditLogTable;
}

/** 這個版本建立的表（遷移只准碰這些；舊原型表一律不碰） */
export const OWN_TABLES = ['AuditLog', 'RequestLog', 'LedgerEntry', 'Wallet', 'Item', 'Character', 'Account'] as const;
