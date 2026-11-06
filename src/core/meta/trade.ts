// 面對面交易（託管，F3，24 §4.2，第 144 輪先做規則）：純狀態機，伺服器 handler（之後的 src/server/handlers/trade.ts）照它走。
// 流程：雙方各放物品／金幣 → 各自「鎖定」→ 任一方再改內容就解除雙方的鎖定與確認 → 雙方都鎖定後才能「確認」→ 雙方都確認才交換。
// 防「最後一秒偷換」：確認只對「確認當下的內容版本」有效；內容一改，版本 +1、所有鎖定與確認歸零。
// 這裡只管狀態與形狀檢查；物品是不是你的、有沒有綁定、錢夠不夠、行囊放不放得下，由伺服器在同一個資料庫交易裡檢查。

/** 一次最多放幾件物品 */
export const TRADE_MAX_ITEMS = 6;
/** 一次最多放多少金幣 */
export const TRADE_MAX_COIN = 9_999_999;
/** 交易多久沒完成就作廢（物品退回） */
export const TRADE_TTL_MS = 30 * 60 * 1000;

export type TradeSide = 'a' | 'b';
export interface TradeOffer {
  /** 物品 id（伺服器發的） */
  items: string[];
  coin: number;
}
export type TradeStatus = 'open' | 'done' | 'cancelled' | 'expired';
export interface TradeState {
  status: TradeStatus;
  /** 內容版本：任一方改內容就 +1；確認時要帶上自己看到的版本 */
  rev: number;
  offer: Record<TradeSide, TradeOffer>;
  locked: Record<TradeSide, boolean>;
  confirmed: Record<TradeSide, boolean>;
}
export type TradeResult = { ok: true; state: TradeState } | { ok: false; why: string };

export const emptyOffer = (): TradeOffer => ({ items: [], coin: 0 });
export const newTrade = (): TradeState => ({ status: 'open', rev: 0, offer: { a: emptyOffer(), b: emptyOffer() }, locked: { a: false, b: false }, confirmed: { a: false, b: false } });

const other = (s: TradeSide): TradeSide => (s === 'a' ? 'b' : 'a');
const fail = (why: string): TradeResult => ({ ok: false, why });

/** 內容形狀檢查（不信任客戶端）：物品 id 是不重複的短字串、件數與金幣在範圍內 */
export function validOffer(o: unknown): o is TradeOffer {
  if (!o || typeof o !== 'object') return false;
  const x = o as Record<string, unknown>;
  if (Object.keys(x).some((k) => k !== 'items' && k !== 'coin')) return false;
  if (!Array.isArray(x.items) || x.items.length > TRADE_MAX_ITEMS) return false;
  if (!x.items.every((i) => typeof i === 'string' && i.length > 0 && i.length <= 64)) return false;
  if (new Set(x.items).size !== x.items.length) return false;
  return typeof x.coin === 'number' && Number.isSafeInteger(x.coin) && x.coin >= 0 && x.coin <= TRADE_MAX_COIN;
}

/** 改自己這邊的內容：版本 +1，雙方的鎖定與確認全部解除 */
export function setOffer(t: TradeState, side: TradeSide, offer: TradeOffer): TradeResult {
  if (t.status !== 'open') return fail('closed');
  if (!validOffer(offer)) return fail('bad offer');
  return { ok: true, state: { ...t, rev: t.rev + 1, offer: { ...t.offer, [side]: { items: [...offer.items], coin: offer.coin } }, locked: { a: false, b: false }, confirmed: { a: false, b: false } } };
}

/** 鎖定自己這邊（表示「我放好了」）；已鎖定再鎖一次沒有變化 */
export function lock(t: TradeState, side: TradeSide): TradeResult {
  if (t.status !== 'open') return fail('closed');
  return { ok: true, state: { ...t, locked: { ...t.locked, [side]: true } } };
}

/** 空的交易（雙方什麼都沒放）不能完成：避免刷交易紀錄 */
export const isEmptyTrade = (t: TradeState): boolean => !t.offer.a.items.length && !t.offer.a.coin && !t.offer.b.items.length && !t.offer.b.coin;

/** 確認：雙方都鎖定、而且看到的是目前的版本才算；雙方都確認 → 狀態 done（伺服器接著在同一個交易裡交換） */
export function confirm(t: TradeState, side: TradeSide, rev: number): TradeResult {
  if (t.status !== 'open') return fail('closed');
  if (!t.locked.a || !t.locked.b) return fail('not locked');
  if (rev !== t.rev) return fail('stale');
  if (isEmptyTrade(t)) return fail('empty');
  const confirmed = { ...t.confirmed, [side]: true };
  return { ok: true, state: { ...t, confirmed, status: confirmed[other(side)] ? 'done' : 'open' } };
}

export function cancel(t: TradeState): TradeResult {
  if (t.status !== 'open') return fail('closed');
  return { ok: true, state: { ...t, status: 'cancelled', locked: { a: false, b: false }, confirmed: { a: false, b: false } } };
}
