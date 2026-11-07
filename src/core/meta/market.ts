// 拍賣所規則（第 142 輪，V4 先行，24 §4.1／4.3）：上架費、成交手續費、價格範圍、掛單期限、每個角色同時能掛幾件。
// 伺服器 handler（src/server/handlers/market.ts）用這份；之後畫面顯示「實拿多少」也用這份。
/** 成交手續費 %（從賣家實拿裡扣，金幣回收） */
export const MARKET_FEE_PCT = 5;
/** 上架費 %（不退，至少 1 金；防止亂掛單） */
export const LIST_FEE_PCT = 1;
export const PRICE_MIN = 1;
export const PRICE_MAX = 9_999_999;
/** 掛單 48 小時後過期（24 §4.1） */
export const LISTING_MS = 48 * 3600 * 1000;
/** 同一個角色同時開著的掛單上限 */
export const MAX_OPEN_LISTINGS = 20;
/** 一頁幾筆 */
export const MARKET_PAGE = 20;

export const validPrice = (p: unknown): p is number => typeof p === 'number' && Number.isSafeInteger(p) && p >= PRICE_MIN && p <= PRICE_MAX;
export const listFee = (price: number): number => Math.max(1, Math.floor((price * LIST_FEE_PCT) / 100));
export const saleFee = (price: number): number => Math.floor((price * MARKET_FEE_PCT) / 100);
/** 賣家實拿 */
export const sellerGets = (price: number): number => price - saleFee(price);

/** 最近成交看幾筆（market.history，第 153 輪） */
export const HISTORY_N = 12;
/** 逛逛時一頁最多附幾組「部位×稀有度」的行情（第 154 輪，D-333；每組一次查詢，限制伺服器負擔） */
export const REF_COMBOS_MAX = 8;
/** 至少幾筆成交才算有行情（太少的中位數沒意義） */
export const REF_MIN_SALES = 3;
/** 開價低於行情這麼多 % 以上，逛逛時標「便宜」 */
export const BARGAIN_PCT = 10;

export const refKey = (slot: string, rarity: number): string => `${slot}:${rarity}`;

/** 開價比行情便宜幾 %（整數）；沒有行情或沒有便宜到 BARGAIN_PCT 回 0 */
export function bargainPct(price: number, median: number | undefined): number {
  if (!median || median <= 0 || !validPrice(price)) return 0;
  const pct = Math.floor(((median - price) * 100) / median);
  return pct >= BARGAIN_PCT ? pct : 0;
}

/**
 * 最近成交的行情（第 153 輪，D-329）：中位數＋最低／最高。給上架時參考定價（畫面只顯示，價格還是賣家自己定）。
 * 沒有成交回 null。中位數：偶數筆取中間兩筆的平均（四捨五入）。
 */
export function priceStats(prices: readonly number[]): { n: number; median: number; lo: number; hi: number } | null {
  const ps = prices.filter((p) => validPrice(p)).sort((a, b) => a - b);
  if (!ps.length) return null;
  const m = ps.length >> 1;
  const median = ps.length % 2 ? ps[m]! : Math.round((ps[m - 1]! + ps[m]!) / 2);
  return { n: ps.length, median, lo: ps[0]!, hi: ps[ps.length - 1]! };
}
