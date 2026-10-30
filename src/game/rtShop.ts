// 營火行商（D-116）：用金幣自由買賣裝備與材料。純資料函式（有測試），畫面在 ui/rtShopPanel.ts。
// 金幣以前只是統計數字；現在 = 撿到的累計 − 花掉的（spent.coin，賣出記成負的花費），和粉塵／結晶同一套帳。
import { GEAR_SLOTS, genGear, type GearSlot, type Rarity, type RtGear } from '../core/battle/rt/gear';
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

/** 行商的物品等級＝等級＋1（1～11）。第 23 輪實測：Lv6 時狼王掉的已是物品等級 8～10，Lv−1 的貨完全沒人買；
 *  ＋1 讓貨架能補弱的格子、換技能特效，但普通狼王（8）與暴怒（11）掉的仍然一樣或更好 */
export function shopIlvl(level: number): number {
  return Math.max(1, Math.min(11, level + 1));
}

/** 行商的貨架狀態（存在紀錄裡；形狀不對就重來） */
export interface ShopState {
  /** 這批貨的編號（進地圖次數 × 100 ＋ 付費換貨次數；變了就是新的一批） */
  batch: number;
  /** 這批已經買走的 uid */
  sold: string[];
  /** 這批「為你挑選」的部位（第一次打開這批貨時看身上最弱的格子決定，之後同一批固定） */
  pick?: GearSlot;
}

export function cleanShop(x: unknown): ShopState {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<ShopState>;
  const out: ShopState = { batch: Number.isFinite(o.batch) ? Number(o.batch) : 0, sold: Array.isArray(o.sold) ? o.sold.filter((u): u is string => typeof u === 'string').slice(0, 8) : [] };
  if (typeof o.pick === 'string' && (GEAR_SLOTS as readonly string[]).includes(o.pick)) out.pick = o.pick;
  return out;
}

/** 每次進地圖自動換一批（runs 變了）；同一趟裡付費換貨才會變 */
export function shopBatch(rec: RtRecord): ShopState {
  const sh = cleanShop(rec.shop);
  const base = (rec.runs ?? 0) * 100;
  if (Math.floor(sh.batch / 100) * 100 !== base) return { batch: base, sold: [] };
  return sh;
}

/** 「為你挑選」的稀有（第 25 輪）：部位＝你身上最弱的那格、物品等級再 +1。
 *  第 25 輪實測：刷 30 分鐘後掉落已補滿，隨機部位的稀有常常比身上的差、整批沒東西可買 */
export const PICK_ILVL_PLUS = 1;
/** 這批貨還沒決定「為你挑選」的部位 → 記下 slot（同一批之後固定）；已經有就原樣回傳 */
export function withPick(rec: RtRecord, slot: GearSlot): RtRecord {
  const sh = shopBatch(rec);
  if (sh.pick) return rec;
  return { ...rec, shop: { ...sh, pick: slot } };
}

/** 這件是不是「為你挑選」的（uid 結尾 p，買下後照樣留在 uid 裡、沒有別的欄位） */
export function isPicked(g: RtGear): boolean {
  return g.uid.startsWith('s') && g.uid.endsWith('p');
}

/** 這批貨（固定種子：同一批重開面板看到的一樣）。這批有 pick（見 withPick）時稀有那件換成最弱部位；沒有就是舊的隨機部位 */
export function shopStock(rec: RtRecord, level: number, region: string): RtGear[] {
  const sh = shopBatch(rec);
  const pick = sh.pick;
  const il = shopIlvl(level);
  // 第 69 輪：四件不重複部位（種子相鄰，以前常常一批三條項鍊）。抽到重複的才改成還沒出現的部位，其他照舊
  const used = new Set<GearSlot>(pick ? [pick] : []);
  return STOCK_RARITY.map((r, i) => {
    const picked = !!pick && r === 3;
    const ilv = picked ? Math.min(12, il + PICK_ILVL_PLUS) : il;
    const seed = ((sh.batch + 1) * 2654435761 + i * 40503 + il * 97) >>> 0;
    let g = genGear(seed, r, ilv, picked ? { region, slot: pick } : { region });
    if (!picked && used.has(g.slot)) {
      const free = GEAR_SLOTS.filter((x) => !used.has(x));
      const slot = free[seed % free.length];
      if (slot) g = genGear(seed, r, ilv, { region, slot });
    }
    used.add(g.slot);
    return { ...g, uid: `s${g.uid}${i}${picked ? 'p' : ''}` };
  }).filter((g) => !sh.sold.includes(g.uid));
}

/** 今日特價（第 24 輪）：每批貨固定一件打 75 折（看批號決定是哪一格，同一批重開面板一樣） */
export const DEAL_PCT = 75;
export function dealIndex(rec: RtRecord): number {
  let x = Math.imul(shopBatch(rec).batch + 1, 2654435761) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0; // 低位元幾乎不變（批號是 100 的倍數），先把高位元混下來
  return x % 4;
}
/** 是不是這批的特價品（貨架 uid 結尾就是格子編號） */
export function isDeal(rec: RtRecord, g: RtGear): boolean {
  return g.uid.startsWith('s') && g.uid.endsWith(String(dealIndex(rec)));
}
/** 貨架上這件的實際售價（特價打折） */
export function stockPrice(rec: RtRecord, g: RtGear, offPct = 0): number {
  const p = buyPrice(g);
  const d = isDeal(rec, g) ? Math.round((p * DEAL_PCT) / 100) : p;
  // 討伐後的抉擇（D-157）：「還」的善意折扣，和特價疊乘
  return offPct > 0 ? Math.max(1, Math.round((d * (100 - offPct)) / 100)) : d;
}

/** 付費換一批 */
export function rerollShop(rec: RtRecord): RtRecord | null {
  const r = spendCoin(rec, SHOP_REROLL);
  if (!r) return null;
  const sh = shopBatch(rec);
  return { ...r, shop: { batch: sh.batch + 1, sold: [] } };
}

/** 買下貨架上的一件（標成已售出）；錢不夠回 null。行囊滿不滿由呼叫端先檢查 */
export function buyGear(rec: RtRecord, g: RtGear, offPct = 0): RtRecord | null {
  const r = spendCoin(rec, stockPrice(rec, g, offPct));
  if (!r) return null;
  const sh = shopBatch(rec);
  return { ...r, shop: { ...sh, sold: [...sh.sold, g.uid] } };
}
