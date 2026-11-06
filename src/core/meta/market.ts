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
