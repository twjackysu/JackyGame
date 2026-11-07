// 拍賣所 handler 的契約測試（第 142 輪，V4 先行，24 §4.1）：每種資料庫實作都跑同一組。
// 重點：不會複製物品、不會多扣錢、重送不重複、別人碰不到、綁定不能賣、過期退回。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { ApiError } from '../../src/net/protocol';
import { LocalTransport } from '../../src/net/LocalTransport';
import type { CharacterView } from '../../src/net/views';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import type { Db } from '../../src/server/repos/types';
import { LISTING_MS, MAX_OPEN_LISTINGS, bargainPct, listFee, refKey, sellerGets } from '../../src/core/meta/market';
import { BACKENDS } from './backends';
import { LEGACY_SAMPLE } from './fixtures';

const auth = { resolve: async (t?: string) => t ?? 'anon' };
const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : `throw:${String(e)}`;
  }
};
const bagOf = (c: CharacterView) => c.items.filter((i) => i.location === 'bag');

async function setup(db: Db) {
  const clock = new FakeClock();
  const server = new GameServer({ db, auth, clock, ids: new SeqIds(), local: true, rng: () => 0 });
  let rid = 0;
  const mk = (token: string) => new GameClient(new LocalTransport((j) => server.handle(j)), { token, timeoutMs: 15000, retries: 1, newRequestId: () => `${token}-${++rid}` });
  const a = mk('accA');
  const b = mk('accB');
  const ca = await a.call('character.get', { id: (await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId });
  const cb = await b.call('character.get', { id: (await b.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId });
  return { server, clock, a, b, ca, cb };
}

/** 兩個角色的金幣總和＋所有物品 id（檢查守恆：成交只會少掉手續費＋上架費） */
const coins = (...cs: CharacterView[]) => cs.reduce((s, c) => s + c.wallet.coin, 0);

for (const be of BACKENDS)
  describe(`拍賣所（${be.name}）`, () => {
    it('上架 → 別人買：物品換主人、賣家實拿扣 5%、上架費不退；同一筆不能買兩次', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, b, ca, cb } = await setup(db);
      const it = bagOf(ca)[0]!;
      const price = 500;
      const r = await a.call('market.list', { characterId: ca.id, itemId: it.id, price });
      expect(r.character.wallet.coin).toBe(ca.wallet.coin - listFee(price));
      expect(r.character.items.find((i) => i.id === it.id)!.location).toBe(`market:${r.listing.id}`);
      // 上架中的物品不能穿、不能賣給行商、不能再上架
      expect(await code(a.call('inventory.equip', { characterId: ca.id, itemId: it.id }))).toBe('not_found');
      expect(await code(a.call('shop.sell', { characterId: ca.id, itemIds: [it.id] }))).toBe('not_found');
      expect(await code(a.call('market.list', { characterId: ca.id, itemId: it.id, price: 10 }))).toBe('not_found');
      // 搜尋：b 看得到、a 自己的標 mine
      const seen = await b.call('market.browse', {});
      expect(seen.listings.map((l) => [l.id, l.mine])).toEqual([[r.listing.id, false]]);
      expect((await a.call('market.browse', {})).listings[0]!.mine).toBe(true);
      // 自己不能買自己的
      expect(await code(a.call('market.buy', { characterId: ca.id, listingId: r.listing.id }))).toBe('rejected');
      const bought = await b.call('market.buy', { characterId: cb.id, listingId: r.listing.id });
      expect(bought.wallet.coin).toBe(cb.wallet.coin - price);
      expect(bought.items.find((i) => i.id === it.id)!.location).toBe('bag');
      const sellerNow = await a.call('character.get', { id: ca.id });
      expect(sellerNow.wallet.coin).toBe(ca.wallet.coin - listFee(price) + sellerGets(price));
      expect(sellerNow.items.some((i) => i.id === it.id)).toBe(false);
      expect(coins(sellerNow, bought)).toBe(coins(ca, cb) - listFee(price) - (price - sellerGets(price)));
      expect(await code(b.call('market.buy', { characterId: cb.id, listingId: r.listing.id }))).toBe('not_found');
      expect((await b.call('market.browse', {})).listings).toEqual([]);
      const mine = await a.call('market.mine', { characterId: ca.id });
      expect(mine.listings.map((l) => l.status)).toEqual(['sold']);
      await db.close();
    });

    it('錢不夠／行囊滿整筆回滾；取消退回行囊；別人取消不了', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, b, ca, cb } = await setup(db);
      const it = bagOf(ca)[0]!;
      const r = await a.call('market.list', { characterId: ca.id, itemId: it.id, price: cb.wallet.coin + 1 });
      expect(await code(b.call('market.buy', { characterId: cb.id, listingId: r.listing.id }))).toBe('rejected');
      const b2 = await b.call('character.get', { id: cb.id });
      expect(b2.wallet.coin).toBe(cb.wallet.coin);
      expect((await a.call('character.get', { id: ca.id })).items.find((i) => i.id === it.id)!.location).toBe(`market:${r.listing.id}`);
      expect(await code(b.call('market.cancel', { characterId: cb.id, listingId: r.listing.id }))).toBe('not_found');
      expect(await code(b.call('market.cancel', { characterId: ca.id, listingId: r.listing.id }))).toBe('not_found');
      const back = await a.call('market.cancel', { characterId: ca.id, listingId: r.listing.id });
      expect(bagOf(back)[0]!.id).toBe(it.id);
      expect(await code(a.call('market.cancel', { characterId: ca.id, listingId: r.listing.id }))).toBe('not_found');
      expect(await code(b.call('market.buy', { characterId: cb.id, listingId: r.listing.id }))).toBe('not_found');
      await db.close();
    });

    it('過期買不到，賣家看「我的掛單」時退回行囊；綁定不能賣；價格與上限檢查', async () => {
      const { db } = await be.fresh(() => 0);
      const { clock, a, b, ca, cb } = await setup(db);
      const [i1, i2] = bagOf(ca);
      const r = await a.call('market.list', { characterId: ca.id, itemId: i1!.id, price: 100 });
      clock.advance(LISTING_MS + 1);
      expect((await b.call('market.browse', {})).listings).toEqual([]);
      expect(await code(b.call('market.buy', { characterId: cb.id, listingId: r.listing.id }))).toBe('not_found');
      const mine = await a.call('market.mine', { characterId: ca.id });
      expect(mine.listings.map((l) => l.status)).toEqual(['expired']);
      expect(mine.character.items.find((i) => i.id === i1!.id)!.location).toBe('bag');
      for (const bad of [0, -5, 1.5, 1e12, '100', null]) expect(await code(a.call('market.list', { characterId: ca.id, itemId: i2!.id, price: bad as number }))).toBe('bad_request');
      // 綁定
      await db.tx(async (rp) => {
        const row = (await rp.items.get(i2!.id))!;
        await rp.items.save({ ...row, bound: true });
      });
      expect(await code(a.call('market.list', { characterId: ca.id, itemId: i2!.id, price: 100 }))).toBe('rejected');
      expect(await code(b.call('market.list', { characterId: ca.id, itemId: i1!.id, price: 100 }))).toBe('not_found');
      expect(MAX_OPEN_LISTINGS).toBeGreaterThan(1);
      await db.close();
    });

    it('重送同一個 requestId 只成交一次', async () => {
      const { db } = await be.fresh(() => 0);
      const { server, a, b, ca, cb } = await setup(db);
      const r = await a.call('market.list', { characterId: ca.id, itemId: bagOf(ca)[0]!.id, price: 300 });
      const req = JSON.stringify({ v: 1, id: 1, method: 'market.buy', params: { characterId: cb.id, listingId: r.listing.id }, requestId: 'dup-1', token: 'accB' });
      const x = JSON.parse(await server.handle(req));
      const y = JSON.parse(await server.handle(req));
      expect(x.ok).toBe(true);
      expect(y).toEqual(x);
      expect((await b.call('character.get', { id: cb.id })).wallet.coin).toBe(cb.wallet.coin - 300);
      await db.close();
    });
  });

for (const be of BACKENDS)
  describe(`拍賣所賣出通知（${be.name}，第 149 輪）`, () => {
    it('market.mine 的 news：第一次看只記時間；之後不在時賣掉的列一次，看過就不再列；取消／過期不算', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, b, ca, cb, clock } = await setup(db);
      const [i1, i2] = bagOf(ca);
      const l1 = (await a.call('market.list', { characterId: ca.id, itemId: i1!.id, price: 300 })).listing;
      clock.advance(1000);
      // 還沒看過拍賣所就賣掉的：第一次看不通知（舊存檔不會一打開就跳一堆舊消息）
      await b.call('market.buy', { characterId: cb.id, listingId: l1.id });
      clock.advance(1000);
      expect((await a.call('market.mine', { characterId: ca.id })).news).toEqual([]);
      const l3 = (await a.call('market.list', { characterId: ca.id, itemId: i2!.id, price: 500 })).listing;
      clock.advance(1000);
      await a.call('market.cancel', { characterId: ca.id, listingId: l3.id });
      const l2 = (await a.call('market.list', { characterId: ca.id, itemId: i2!.id, price: 400 })).listing;
      clock.advance(1000);
      await b.call('market.buy', { characterId: cb.id, listingId: l2.id });
      clock.advance(1000);
      const m = await a.call('market.mine', { characterId: ca.id });
      expect(m.news.map((l) => [l.id, l.status, l.price])).toEqual([[l2.id, 'sold', 400]]);
      // 看過了：再看一次沒有
      expect((await a.call('market.mine', { characterId: ca.id })).news).toEqual([]);
      // 存回去的時間點不受 migrate.sync 影響
      await a.call('migrate.sync', { snapshot: LEGACY_SAMPLE });
      expect((await a.call('market.mine', { characterId: ca.id })).news).toEqual([]);
      await db.close();
    });
  });

for (const be of BACKENDS)
  describe(`拍賣所最近成交（第 153 輪，D-329，${be.name}）`, () => {
    it('只列同部位同稀有度的成交、新的在前、不帶賣家買家；取消與還開著的不算；格式不對 bad_request', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, b, ca, cb, clock } = await setup(db);
      const items = bagOf(ca);
      const g0 = items[0]!.gear as { slot: string; rarity: number; ilvl: number };
      const same = items.filter((i) => (i.gear as { slot: string }).slot === g0.slot && (i.gear as { rarity: number }).rarity === g0.rarity);
      expect(await code(a.call('market.history', { slot: 'nope', rarity: 1 }))).toBe('bad_request');
      expect(await code(a.call('market.history', { slot: g0.slot, rarity: 9 }))).toBe('bad_request');
      expect((await a.call('market.history', { slot: g0.slot, rarity: g0.rarity })).sales).toEqual([]);
      // 第一件賣出、（有的話）第二件賣出、再掛一件不賣、一件取消
      const prices = [300, 420];
      const soldAt: number[] = [];
      for (let k = 0; k < Math.min(2, same.length); k++) {
        clock.advance(60_000);
        const r = await a.call('market.list', { characterId: ca.id, itemId: same[k]!.id, price: prices[k]! });
        await b.call('market.buy', { characterId: cb.id, listingId: r.listing.id });
        soldAt.unshift(clock.now());
      }
      const left = bagOf(await a.call('character.get', { id: ca.id })).filter((i) => (i.gear as { slot: string }).slot === g0.slot && (i.gear as { rarity: number }).rarity === g0.rarity);
      if (left[0]) await a.call('market.list', { characterId: ca.id, itemId: left[0].id, price: 9999 });
      const h = await b.call('market.history', { slot: g0.slot, rarity: g0.rarity });
      expect(h.sales.map((s) => s.price)).toEqual(prices.slice(0, soldAt.length).reverse());
      expect(h.sales.map((s) => s.at)).toEqual(soldAt);
      for (const s of h.sales) expect(Object.keys(s).sort()).toEqual(['at', 'ilvl', 'price']);
      // 別的稀有度看不到這幾筆
      expect((await b.call('market.history', { slot: g0.slot, rarity: g0.rarity === 1 ? 2 : 1 })).sales).toEqual([]);
      await db.close();
    });

    it('逛逛帶行情（refs）：同部位同稀有度成交 3 筆以上才給中位數；不要就不給；refs 型別錯擋掉', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, b, ca, cb, clock } = await setup(db);
      const it = bagOf(ca)[0]!;
      const g = it.gear as { slot: string; rarity: number };
      const key = refKey(g.slot, g.rarity);
      // 同一件在 A、B 之間轉手：A 賣 300 → B 賣 500 → A 賣 400（成交 3 筆，中位數 400）
      const hops: [GameClient, CharacterView, GameClient, CharacterView, number][] = [[a, ca, b, cb, 300], [b, cb, a, ca, 500], [a, ca, b, cb, 400]];
      for (const [k, [seller, sc, buyer, bc, price]] of hops.entries()) {
        clock.advance(60_000);
        const r = await seller.call('market.list', { characterId: sc.id, itemId: it.id, price });
        if (k === 1) expect((await a.call('market.browse', { refs: true })).refs?.[key]).toBeUndefined(); // 只有 1 筆成交：不給
        await buyer.call('market.buy', { characterId: bc.id, listingId: r.listing.id });
      }
      // 現在在 B 手上：掛 300（比行情 400 便宜 25%）
      await b.call('market.list', { characterId: cb.id, itemId: it.id, price: 300 });
      const br = await a.call('market.browse', { refs: true });
      expect(br.refs).toEqual({ [key]: 400 });
      expect(bargainPct(br.listings[0]!.price, br.refs![key])).toBe(25);
      expect((await a.call('market.browse', {})).refs).toBeUndefined();
      expect(await code(a.call('market.browse', { refs: 'yes' as unknown as boolean }))).toBe('bad_request');
      await db.close();
    });
  });
