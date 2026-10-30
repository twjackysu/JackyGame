// 營火行商（D-116）：金幣帳、價格、貨架固定種子、買賣與換貨
import { describe, expect, it } from 'vitest';
import { GEAR_SLOTS, genGear, type GearSlot, type RtGear } from '../src/core/battle/rt/gear';
import { weakestSlot } from '../src/game/rtBag';
import { spend } from '../src/game/rtRecord';
import { PICK_ILVL_PLUS, isPicked, withPick, buyGear, buyPrice, cleanShop, DEAL_PCT, dealIndex, isDeal, stockPrice, coinOf, rerollShop, sellPrice, shopIlvl, shopStock, spendCoin, SHOP_REROLL } from '../src/game/rtShop';

describe('營火行商', () => {
  it('金幣＝撿到 − 花掉；賣出記負的花費；不夠就買不了；和粉塵帳互不影響', () => {
    const rec = { coin: 500 };
    expect(coinOf(rec)).toBe(500);
    const a = spendCoin(rec, 120)!;
    expect(coinOf(a)).toBe(380);
    const b = spendCoin(a, -50)!;
    expect(coinOf(b)).toBe(430);
    expect(spendCoin(b, 431)).toBeNull();
    const c = spend({ ...b, dust: 20 }, 5, 0)!;
    expect(coinOf(c)).toBe(430);
    expect(c.spent?.dust).toBe(5);
  });
  it('價格：稀有 > 精良 > 普通；強化、物品等級、深夜越高越貴；買價 = 賣價 × 4', () => {
    const n = genGear(11, 1, 5);
    const p = genGear(11, 2, 5);
    const r = genGear(11, 3, 5);
    expect(sellPrice(r)).toBeGreaterThan(sellPrice(p));
    expect(sellPrice(p)).toBeGreaterThan(sellPrice(n));
    expect(sellPrice({ ...r, enh: 5 })).toBeGreaterThan(sellPrice(r));
    expect(sellPrice(genGear(11, 3, 9))).toBeGreaterThan(sellPrice(r));
    expect(sellPrice(genGear(11, 3, 5, { night: true }))).toBeGreaterThan(sellPrice(r));
    expect(buyPrice(r)).toBe(sellPrice(r) * 4);
  });
  it('今日特價：每批剛好一件打 75 折、買的時候照特價扣；換一批特價格子跟著變', () => {
    const seen = new Set<number>();
    for (let runs = 1; runs <= 12; runs++) {
      const rec = { coin: 5000, runs };
      const st = shopStock(rec, 6, 'mistwood');
      const deals = st.filter((g) => isDeal(rec, g));
      expect(deals.length).toBe(1);
      const d = deals[0]!;
      expect(stockPrice(rec, d)).toBe(Math.round((buyPrice(d) * DEAL_PCT) / 100));
      for (const g of st) if (g !== d) expect(stockPrice(rec, g)).toBe(buyPrice(g));
      expect(coinOf(buyGear(rec, d)!)).toBe(5000 - stockPrice(rec, d));
      seen.add(dealIndex(rec));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
  it('貨架：同一批固定、4 件（3 精良＋1 稀有）、物品等級跟著等級；買走就消失；進地圖換一批', () => {
    const rec = { coin: 5000, runs: 3 };
    const s1 = shopStock(rec, 8, 'mistwood');
    expect(s1.length).toBe(4);
    expect(s1.map((g) => g.rarity)).toEqual([2, 2, 2, 3]);
    expect(s1.every((g) => g.ilvl === shopIlvl(8))).toBe(true);
    expect(shopStock(rec, 8, 'mistwood').map((g) => g.uid)).toEqual(s1.map((g) => g.uid));
    const after = buyGear(rec, s1[3]!)!;
    expect(coinOf(after)).toBe(5000 - stockPrice(rec, s1[3]!));
    expect(shopStock(after, 8, 'mistwood').map((g) => g.uid)).toEqual(s1.slice(0, 3).map((g) => g.uid));
    const next = { ...after, runs: 4 };
    const s2 = shopStock(next, 8, 'mistwood');
    expect(s2.length).toBe(4);
    expect(s2[0]!.uid).not.toBe(s1[0]!.uid);
    expect(buyGear({ coin: 10, runs: 3 }, s1[0]!)).toBeNull();
  });
  it('付費換貨：扣金幣、整批換新、已售清空；錢不夠不能換', () => {
    const rec = { coin: 300, runs: 1 };
    const s1 = shopStock(rec, 5, 'thornvale');
    const bought = buyGear({ ...rec, coin: 9999 }, s1[0]!)!;
    const r = rerollShop(bought)!;
    expect(coinOf(r)).toBe(coinOf(bought) - SHOP_REROLL);
    const s2 = shopStock(r, 5, 'thornvale');
    expect(s2.length).toBe(4);
    expect(s2.some((g) => s1.some((x) => x.uid === g.uid))).toBe(false);
    expect(rerollShop({ coin: 10, runs: 1 })).toBeNull();
    expect(cleanShop('壞資料')).toEqual({ batch: 0, sold: [] });
  });
  it('為你挑選（第 25 輪）：稀有那件換成身上最弱的部位、物品等級 +1；同一批固定；沒挑選時和舊版一樣', () => {
    const rec = { runs: 4, coin: 5000 };
    const old = shopStock(rec, 6, 'mistwood');
    // 身上只缺護手 → 最弱的是護手
    const equip: Partial<Record<GearSlot, RtGear>> = {};
    for (const s of GEAR_SLOTS) if (s !== 'hands') equip[s] = genGear(100 + s.length, 2, 7, { slot: s });
    const weak = weakestSlot({ bag: [], equip }, shopIlvl(6));
    expect(weak).toBe('hands');
    const r1 = withPick(rec, weak);
    expect(withPick(r1, 'ring')).toBe(r1); // 同一批不會再變
    const st = shopStock(r1, 6, 'mistwood');
    const rare = st.find((g) => g.rarity === 3)!;
    expect(rare.slot).toBe('hands');
    expect(rare.ilvl).toBe(shopIlvl(6) + PICK_ILVL_PLUS);
    expect(isPicked(rare)).toBe(true);
    // 精良三件不變
    expect(st.filter((g) => g.rarity === 2).map((g) => g.uid)).toEqual(old.filter((g) => g.rarity === 2).map((g) => g.uid));
    // 買走後保留 pick；換貨後重新挑
    const b = buyGear(r1, rare)!;
    expect(cleanShop(b.shop).pick).toBe('hands');
    expect(shopStock(b, 6, 'mistwood').some((g) => g.rarity === 3)).toBe(false);
    expect(cleanShop(rerollShop(b)!.shop).pick).toBeUndefined();
    // 存檔壞掉的 pick 丟掉
    expect(cleanShop({ batch: 1, sold: [], pick: 'boots' }).pick).toBeUndefined();
  });
  it('一批貨四件部位都不一樣（第 69 輪：以前常常一批三條項鍊），有「為你挑選」時也一樣', () => {
    for (let runs = 0; runs < 120; runs++) {
      for (const lv of [1, 6, 12]) {
        const st = shopStock({ runs }, lv, 'mistwood');
        expect(new Set(st.map((g) => g.slot)).size).toBe(4);
        const pk = withPick({ runs }, 'hands');
        const st2 = shopStock(pk, lv, 'mistwood');
        expect(new Set(st2.map((g) => g.slot)).size).toBe(4);
        expect(st2.filter(isPicked)[0]?.slot).toBe('hands');
      }
    }
  });
});
