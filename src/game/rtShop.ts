// 營火行商（D-116）：用金幣自由買賣裝備與材料。純資料函式（有測試），畫面在 ui/rtShopPanel.ts。
// 金幣以前只是統計數字；現在 = 撿到的累計 − 花掉的（spent.coin，賣出記成負的花費），和粉塵／結晶同一套帳。
import { genGear, type Rarity, type RtGear } from '../core/battle/rt/gear';
import type { RtRecord } from './rtRecord';

/** 手上的金幣 */
export function coinOf(rec: RtRecord): number {
  return Math.max(0, (rec.coin ?? 0) - (rec.spent?.coin ?? 0));
}

/** 花金幣（負數＝賣東西得到）；不夠回 null */
export function spendCoin(rec: RtRecord, n: number): RtRecord | null {
  if (n > 0 && coinOf(rec) < n) return null;
  return { ...rec, spent: { ...rec.spent, coin: (rec.spent?.coin ?? 0) + Math.round(n) } };
}

const SELL_BASE: Record<Rarity, number> = { 1: 8, 2: 25, 3: 70 };

/** 賣給行商的價格（稀有度、物品等級、強化越高越貴；深夜裝備 +30%） */
export function sellPrice(g: RtGear): number {
  return Math.round(SELL_BASE[g.rarity] * (1 + g.ilvl * 0.2) * (1 + (g.enh ?? 0) * 0.2) * (g.night ? 1.3 : 1));
}

/** 跟行商買的價格＝賣價 × 4（刷 30 分鐘約 1500 金：大約買得起一件稀有＋兩件精良） */
export function buyPrice(g: RtGear): number {
  return sellPrice(g) * 4;
}

/** 材料（固定價、買不完） */
export const SHOP_GOODS = [
  { id: 'dust', name: '星塵粉末 ×10', desc: '強化用的粉塵', price: 80, dust: 10, crystal: 0 },
  { id: 'crystal', name: '星燼結晶 ×1', desc: '強化 +6 以上要用', price: 220, dust: 0, crystal: 1 },
] as const;

/** 換一批貨的價格 */
export const SHOP_REROLL = 40;
/** 貨架上的裝備稀有度（3 件精良＋1 件稀有） */
const STOCK_RARITY: Rarity[] = [2, 2, 2, 3];

/** 行商的物品等級：比等級低一點（最好的裝備還是要打 Boss），1～10 */
export function shopIlvl(level: number): number {
  return Math.max(1, Math.min(10, level - 1));
}

/** 行商的貨架狀態（存在紀錄裡；形狀不對就重來） */
export interface ShopState {
  /** 這批貨的編號（進地圖次數 × 100 ＋ 付費換貨次數；變了就是新的一批） */
  batch: number;
  /** 這批已經買走的 uid */
  sold: string[];
}

export function cleanShop(x: unknown): ShopState {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<ShopState>;
  return { batch: Number.isFinite(o.batch) ? Number(o.batch) : 0, sold: Array.isArray(o.sold) ? o.sold.filter((u): u is string => typeof u === 'string').slice(0, 8) : [] };
}

/** 每次進地圖自動換一批（runs 變了）；同一趟裡付費換貨才會變 */
export function shopBatch(rec: RtRecord): ShopState {
  const sh = cleanShop(rec.shop);
  const base = (rec.runs ?? 0) * 100;
  if (Math.floor(sh.batch / 100) * 100 !== base) return { batch: base, sold: [] };
  return sh;
}

/** 這批貨（固定種子：同一批重開面板看到的一樣） */
export function shopStock(rec: RtRecord, level: number, region: string): RtGear[] {
  const sh = shopBatch(rec);
  const il = shopIlvl(level);
  return STOCK_RARITY.map((r, i) => {
    const g = genGear(((sh.batch + 1) * 2654435761 + i * 40503 + il * 97) >>> 0, r, il, { region });
    return { ...g, uid: `s${g.uid}${i}` };
  }).filter((g) => !sh.sold.includes(g.uid));
}

/** 付費換一批 */
export function rerollShop(rec: RtRecord): RtRecord | null {
  const r = spendCoin(rec, SHOP_REROLL);
  if (!r) return null;
  const sh = shopBatch(rec);
  return { ...r, shop: { batch: sh.batch + 1, sold: [] } };
}

/** 買下貨架上的一件（標成已售出）；錢不夠回 null。行囊滿不滿由呼叫端先檢查 */
export function buyGear(rec: RtRecord, g: RtGear): RtRecord | null {
  const r = spendCoin(rec, buyPrice(g));
  if (!r) return null;
  const sh = shopBatch(rec);
  return { ...r, shop: { batch: sh.batch, sold: [...sh.sold, g.uid] } };
}
