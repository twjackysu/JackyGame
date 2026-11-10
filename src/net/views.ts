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
  /** 目前角色（F1，D-302） */
  activeCharacterId?: string;
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
  /** 路上的相遇選過哪些（第 147 輪；id → take／spare／thanked，沒選過任何一個就沒有這個欄位） */
  encounters?: Record<string, string>;
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

/** 行商貨架上的一件（價格已含特價與抉擇折扣；伺服器算好，客戶端只顯示） */
export interface ShopOfferView {
  gear: Record<string, unknown>;
  price: number;
  deal: boolean;
  picked: boolean;
}

export interface ShopView {
  batch: number;
  region: string;
  stock: ShopOfferView[];
  /** 材料（固定價） */
  goods: { id: string; name: string; desc: string; price: number }[];
  reroll: number;
  /** 抉擇「還」的折扣 % */
  discount: number;
}

/** 拍賣所的一筆掛單（不含賣家帳號 id） */
export interface ListingView {
  id: string;
  sellerName: string;
  /** 是不是我自己的 */
  mine: boolean;
  price: number;
  status: 'open' | 'sold' | 'cancelled' | 'expired';
  gear: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
}

/** PvP 一方的配裝（伺服器算好；和 core/battle/rt/pvpMatch.ts 的 PvpSide 同形狀） */
export interface PvpSideView {
  weapon: WeaponView;
  bonus: { hp: number; atk: number; def: number };
  /** 等級（已算進 bonus；畫面顯示用，第 156 輪） */
  level?: number;
  /** 選的技能打法、技能點＋裝備特效的技能修正（第 156 輪：以前競技場沒有帶） */
  skillVariants?: string[];
  skillMods?: Record<string, { cdPct?: number; dmgPct?: number; areaPct?: number; blockTicks?: number; distPct?: number }>;
}

/** 非同步 PvP 開局（pvp.start）：種子、雙方配裝、對手名字與段位分 */
export interface PvpStartView {
  matchId: string;
  seed: number;
  me: PvpSideView;
  foe: PvpSideView;
  /** 對手的帳號 id（輸了「再挑一次」用，第 150 輪） */
  foeId: string;
  foeName: string;
  foeRating: number;
  rating: number;
}

/** 天梯的一列 */
export interface PvpLadderRowView {
  /** 名次（1 起算） */
  pos: number;
  name: string;
  weapon: WeaponView;
  rating: number;
  me: boolean;
  /** 對手的 id（指名挑戰用，第 149 輪；自己沒有） */
  id?: string;
}
/** 最近一場 PvP（第 149 輪） */
export interface PvpRecentView {
  outcome: 'victory' | 'defeat' | 'timeout';
  foeName: string;
  delta: number;
  at: number;
  /** 對手的帳號 id（指名挑戰用；舊戰績沒有） */
  foeId?: string;
  /** 能不能「再挑一次」：輸掉、對手還在、分差在範圍內（伺服器算的） */
  revenge: boolean;
}
/** 天梯排行（pvp.ladder）：前幾名；自己不在前幾名時另外附在最後 */
export interface PvpLadderView {
  rows: PvpLadderRowView[];
  /** 最近幾場（新的在前；沒打過＝空） */
  recent: PvpRecentView[];
  rating: number;
  pos: number;
  total: number;
  /** 目前連勝（D-324；0＝沒有） */
  streak: number;
  /** 賽季（第 153 輪 D-328，一季＝台北一週）：還剩幾毫秒、這季最高分、上季最高分、歷來最好的一季 */
  season: { leftMs: number; peak: number; last?: number; best?: number };
}

/** 面對面交易一方放的東西（物品附快照給畫面顯示） */
export interface TradeOfferView {
  items: { id: string; gear: Record<string, unknown> }[];
  coin: number;
}
/** 面對面交易（託管，F3）：從「我」的角度看 */
export interface TradeView {
  id: string;
  partnerName: string;
  status: 'open' | 'done' | 'cancelled' | 'expired';
  /** 內容版本：確認時要帶回來（防最後一秒偷換） */
  rev: number;
  mine: TradeOfferView;
  theirs: TradeOfferView;
  locked: { me: boolean; them: boolean };
  confirmed: { me: boolean; them: boolean };
  expiresAt: number;
}

/** 帳號共用倉庫（F1，D-302） */
export interface WarehouseView {
  max: number;
  items: ItemView[];
}

/** loot.claim 的一筆掉落（D-307）：金幣／粉塵／結晶入錢包；裝備進行囊（itemId），行囊滿了自動分解成粉塵（salvaged） */
export interface LootDropView {
  kind: 'gold' | 'dust' | 'crystal' | 'potion' | 'gear';
  amount: number;
  rarity?: 1 | 2 | 3;
  itemId?: string;
  /** 行囊滿了自動分解最差的普通裝得到的粉塵（D-100，跟單機一樣） */
  salvaged?: number;
  /** 行囊滿了又沒有可分解的：這件沒撿到 */
  full?: boolean;
}

/** 完成的懸賞（loot.claim 回傳，第 147 輪） */
export interface BountyDoneView {
  target: string;
  need: number;
  reward: { dust: number; crystal: number };
}
