// 伺服器回給客戶端的資料形狀（純 JSON，沒有方法、沒有 class）。
// 資料表的列（src/server/repos/types.ts）不直接外流，一律轉成 View：上線後改資料表不會連帶改客戶端。

export type WeaponView = 'sword' | 'bow' | 'staff';
export type CurrencyId = 'coin' | 'dust' | 'crystal';

export interface AccountView {
  id: string;
  displayName: string;
  createdAt: number;
  /** 舊存檔遷移過了沒（migrate.legacy） */
  migrated: boolean;
}

export interface ItemView {
  id: string;
  /** bag／equip:<slot>／warehouse／market:<id>／trade:<id> */
  location: string;
  /** 行囊裡的順序 */
  pos: number;
  bound: boolean;
  /** 裝備本體（和 core/battle/rt/gear 的 RtGear 同形狀；uid 是舊存檔的編號） */
  gear: Record<string, unknown>;
}

/** 每張地圖自己的進度（Boss、寶箱、暴怒、深夜、續行營火） */
export interface MapProgressView {
  bossKills?: number;
  firstAt?: number;
  bestBossSec?: number;
  chests?: string[];
  fury?: boolean;
  furyKills?: number;
  night?: boolean;
  fire?: string;
}

export interface CharacterView {
  id: string;
  slot: number;
  name: string;
  weapon: WeaponView;
  level: number;
  xp: number;
  wallet: Record<CurrencyId, number>;
  /** 累計數字（擊殺、撿到的材料、遊玩秒數…） */
  stats: Record<string, number>;
  /** 技能點與變化、懸賞、行商貨架（形狀由規則檢查，V2 搬進 core/meta） */
  skills: unknown;
  variants: unknown;
  bounty: unknown;
  shop: unknown;
  maps: Record<string, MapProgressView>;
  items: ItemView[];
}

/** 舊存檔：localStorage 裡 jg_ 開頭的 key 原樣送上來（只有本機版接受） */
export type LegacySnapshot = Record<string, string>;

export interface MigrateResult {
  /** 這次有沒有真的轉（已經轉過就是 false） */
  migrated: boolean;
  characterId: string;
  items: number;
  wallet: Record<CurrencyId, number>;
  /** 看不懂而略過的 key */
  skipped: string[];
}

/** 匯出存檔（設定裡的備份）：版本＋整個帳號的資料 */
export interface ExportBlob {
  format: 'jackygame-save';
  version: number;
  exportedAt: number;
  data: Record<string, unknown[]>;
}
