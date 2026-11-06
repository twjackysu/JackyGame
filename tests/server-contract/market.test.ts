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
import { LISTING_MS, MAX_OPEN_LISTINGS, listFee, sellerGets } from '../../src/core/meta/market';
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
