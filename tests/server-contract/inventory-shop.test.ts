// 行囊／強化／行商 handler 的契約測試（第 141 輪 V2）：每種資料庫實作都跑同一組。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { ApiError } from '../../src/net/protocol';
import { LocalTransport } from '../../src/net/LocalTransport';
import type { CharacterView } from '../../src/net/views';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import type { Db } from '../../src/server/repos/types';
import { enhanceCost, salvageDust, type RtGear } from '../../src/core/battle/rt/gear';
import { weakestSlot } from '../../src/core/meta/bag';
import { SHOP_GOODS, SHOP_REROLL, sellPrice, shopIlvl, shopStock, stockPrice, withPick } from '../../src/core/meta/shop';
import { BACKENDS } from './backends';
import { LEGACY_SAMPLE } from './fixtures';

/** token 就是帳號 id（測兩個帳號互相碰不到） */
const auth = { resolve: async (t?: string) => t ?? 'anon' };

function stack(db: Db, roll: { v: number }) {
  const server = new GameServer({ db, auth, clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => roll.v });
  let rid = 0;
  const mk = (token: string) => new GameClient(new LocalTransport((j) => server.handle(j)), { token, timeoutMs: 15000, retries: 1, newRequestId: () => `${token}-${++rid}` });
  return { server, a: mk('accA'), b: mk('accB') };
}

const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : `throw:${String(e)}`;
  }
};

const uidAt = (c: CharacterView) => c.items.map((i) => `${i.location}:${String(i.gear.uid)}`);
const itemId = (c: CharacterView, uid: string) => c.items.find((i) => i.gear.uid === uid)!.id;

async function setup(db: Db, roll = { v: 0 }) {
  const s = stack(db, roll);
  const ra = await s.a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
  const rb = await s.b.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
  const ca = await s.a.call('character.get', { id: ra.characterId });
  const cb = await s.b.call('character.get', { id: rb.characterId });
  return { ...s, ca, cb, roll };
}

for (const be of BACKENDS)
  describe(`行囊與行商（${be.name}）`, () => {
    it('穿上、換下、脫下；行囊順序和第一期一樣（換下的放最前面）', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, ca } = await setup(db);
      expect(uidAt(ca)).toEqual(['bag:g2', 'bag:g3', 'equip:weapon:g1']);
      let c = await a.call('inventory.equip', { characterId: ca.id, itemId: itemId(ca, 'g3') });
      expect(uidAt(c)).toEqual(['bag:g2', 'equip:ring:g3', 'equip:weapon:g1']);
      c = await a.call('inventory.unequip', { characterId: ca.id, slot: 'weapon' });
      expect(uidAt(c)).toEqual(['bag:g1', 'bag:g2', 'equip:ring:g3']);
      c = await a.call('inventory.equip', { characterId: ca.id, itemId: itemId(c, 'g1') });
      expect(await code(a.call('inventory.unequip', { characterId: ca.id, slot: 'head' }))).toBe('not_found');
      expect(await code(a.call('inventory.unequip', { characterId: ca.id, slot: 'tail' }))).toBe('bad_request');
      expect(await code(a.call('inventory.equip', { characterId: ca.id, itemId: itemId(c, 'g1') }))).toBe('not_found'); // 已經穿著
    });

    it('別人的角色與物品一律 not_found', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, ca, cb } = await setup(db);
      expect(await code(a.call('inventory.equip', { characterId: cb.id, itemId: itemId(cb, 'g3') }))).toBe('not_found');
      expect(await code(a.call('inventory.equip', { characterId: ca.id, itemId: itemId(cb, 'g3') }))).toBe('not_found');
      expect(await code(a.call('shop.sell', { characterId: ca.id, itemIds: [itemId(cb, 'g2')] }))).toBe('not_found');
      expect(await code(a.call('enhance.do', { characterId: ca.id, itemId: itemId(cb, 'g1') }))).toBe('not_found');
    });

    it('分解：粉塵伺服器算、同一個 requestId 重送只分解一次', async () => {
      const { db } = await be.fresh(() => 0);
      const { server, ca } = await setup(db);
      const armor = ca.items.find((i) => i.gear.uid === 'g2')!;
      const req = JSON.stringify({ v: 1, id: 1, method: 'inventory.salvage', params: { characterId: ca.id, itemId: armor.id }, requestId: 'salv-1', token: 'accA' });
      const r1 = JSON.parse(await server.handle(req));
      const r2 = JSON.parse(await server.handle(req.replace('"id":1', '"id":2')));
      expect(r1.ok && r2.ok).toBe(true);
      expect(r1.result.dust).toBe(salvageDust(armor.gear as unknown as RtGear));
      expect(r2.result).toEqual(r1.result);
      expect(r1.result.character.wallet.dust).toBe(200 + r1.result.dust);
    });

    it('強化：伺服器擲骰；失敗只扣材料；材料不夠整筆不動', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, ca, roll } = await setup(db, { v: 0.999 });
      const sword = itemId(ca, 'g1');
      const cost = enhanceCost(7);
      expect(cost.rate).toBeLessThan(100);
      const fail = await a.call('enhance.do', { characterId: ca.id, itemId: sword });
      expect(fail).toMatchObject({ ok: false, enh: 7 });
      expect(fail.character.wallet).toEqual({ coin: 800, dust: 200 - cost.dust, crystal: 10 - cost.crystal });
      roll.v = 0;
      const ok = await a.call('enhance.do', { characterId: ca.id, itemId: sword });
      expect(ok).toMatchObject({ ok: true, enh: 8 });
      expect(ok.character.items.find((i) => i.id === sword)!.gear.enh).toBe(8);
      // 結晶剩 10−3−3=4，+8→+9 要 4 顆，+9→+10 要 5 顆 → 第二次不夠
      await a.call('enhance.do', { characterId: ca.id, itemId: sword });
      expect(await code(a.call('enhance.do', { characterId: ca.id, itemId: sword }))).toBe('rejected');
      const c = await a.call('character.get', { id: ca.id });
      expect(c.wallet.crystal).toBe(0);
      expect(c.items.find((i) => i.id === sword)!.gear.enh).toBe(9);
    });

    it('行商：貨架和第一期面板算的一樣；買、重複買、換貨、賣、材料、錢不夠回滾', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, ca } = await setup(db);
      const shop = await a.call('shop.open', { characterId: ca.id, region: 'thornvale' });
      // 第一期面板：withPick(rec, weakestSlot(bag, shopIlvl(level))) → shopStock(rec, level, region)
      const rec = withPick({ runs: 9, shop: ca.shop }, weakestSlot({ bag: [], equip: { weapon: ca.items.find((i) => i.gear.uid === 'g1')!.gear as unknown as RtGear } }, shopIlvl(12)));
      const legacy = shopStock(rec, 12, 'thornvale');
      expect(shop.stock.map((o) => o.gear.uid)).toEqual(legacy.map((g) => g.uid));
      expect(shop.stock.map((o) => o.price)).toEqual(legacy.map((g) => stockPrice(rec, g, 0)));
      expect(shop.stock.filter((o) => o.picked).length).toBe(1);
      // 再打開一次一樣
      expect(await a.call('shop.open', { characterId: ca.id, region: 'thornvale' })).toEqual(shop);
      const cheap = [...shop.stock].sort((x, y) => x.price - y.price)[0]!;
      expect(cheap.price).toBeLessThanOrEqual(800);
      const r = await a.call('shop.buy', { characterId: ca.id, region: 'thornvale', uid: String(cheap.gear.uid) });
      expect(r.character.wallet.coin).toBe(800 - cheap.price);
      const got = r.character.items.filter((i) => i.location === 'bag')[0]!.gear;
      expect({ ...got, uid: 0 }).toEqual({ ...cheap.gear, uid: 0 });
      expect(String(got.uid).startsWith(`${String(cheap.gear.uid)}b`)).toBe(true);
      expect(r.shop.stock.length).toBe(3);
      expect(await code(a.call('shop.buy', { characterId: ca.id, region: 'thornvale', uid: String(cheap.gear.uid) }))).toBe('not_found');
      expect(await code(a.call('shop.buy', { characterId: ca.id, region: 'nowhere', uid: 'x' }))).toBe('bad_request');
      // 錢不夠：整筆回滾（錢、貨架、行囊都不變）
      const pricey = [...r.shop.stock].sort((x, y) => y.price - x.price)[0]!;
      if (pricey.price > r.character.wallet.coin) {
        expect(await code(a.call('shop.buy', { characterId: ca.id, region: 'thornvale', uid: String(pricey.gear.uid) }))).toBe('rejected');
        const c = await a.call('character.get', { id: ca.id });
        expect(c.wallet.coin).toBe(r.character.wallet.coin);
        expect(c.items.length).toBe(r.character.items.length);
      }
      const rr = await a.call('shop.reroll', { characterId: ca.id, region: 'thornvale' });
      expect(rr.character.wallet.coin).toBe(r.character.wallet.coin - SHOP_REROLL);
      expect(rr.shop.batch).toBe(shop.batch + 1);
      expect(rr.shop.stock.length).toBe(4);
      const bag = rr.character.items.filter((i) => i.location === 'bag');
      const sold = await a.call('shop.sell', { characterId: ca.id, itemIds: bag.map((i) => i.id) });
      expect(sold.coin).toBe(bag.reduce((n, i) => n + sellPrice(i.gear as unknown as RtGear), 0));
      expect(sold.character.items.filter((i) => i.location === 'bag')).toEqual([]);
      expect(await code(a.call('shop.sell', { characterId: ca.id, itemIds: [ca.items[0]!.id, ca.items[0]!.id] }))).toBe('bad_request');
      const dust = SHOP_GOODS.find((g) => g.id === 'dust')!;
      const g = await a.call('shop.buyGoods', { characterId: ca.id, goodsId: 'dust' });
      expect(g.wallet).toMatchObject({ coin: sold.character.wallet.coin - dust.price, dust: 200 + dust.dust });
      expect(await code(a.call('shop.buyGoods', { characterId: ca.id, goodsId: 'gold' }))).toBe('bad_request');
    });

    it('抉擇「還」的折扣伺服器自己看劇情旗標算', async () => {
      const { db } = await be.fresh(() => 0);
      const s = stack(db, { v: 0 });
      const snap = { ...LEGACY_SAMPLE, jg_choices: JSON.stringify({ mistwood: 'spare', thornvale: 'spare' }) };
      const res = await s.a.call('migrate.legacy', { snapshot: snap });
      const shop = await s.a.call('shop.open', { characterId: res.characterId, region: 'mistwood' });
      expect(shop.discount).toBe(20);
      const c = await s.a.call('character.get', { id: res.characterId });
      const rec = { runs: 9, shop: c.shop };
      const base = shopStock(rec, 12, 'mistwood');
      expect(shop.stock.map((o) => o.price)).toEqual(base.map((g) => stockPrice(rec, g, 20)));
    });
  });

for (const be of BACKENDS)
  describe(`技能點（${be.name}）`, () => {
    it('加點到沒點數、選打法、沒滿級不能選、重置', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, ca } = await setup(db);
      expect(ca.skills).toEqual({ heavy_slash: 3, whirlwind: 5 });
      let c = ca;
      for (let i = 0; i < 2; i++) c = await a.call('skills.add', { characterId: ca.id, skill: 'heavy_slash' });
      expect(await code(a.call('skills.add', { characterId: ca.id, skill: 'heavy_slash' }))).toBe('rejected'); // 滿 5 級
      c = await a.call('skills.add', { characterId: ca.id, skill: 'charge' }); // Lv12＝11 點用完
      expect(c.skills).toEqual({ heavy_slash: 5, whirlwind: 5, charge: 1 });
      expect(await code(a.call('skills.add', { characterId: ca.id, skill: 'charge' }))).toBe('rejected');
      expect(await code(a.call('skills.add', { characterId: ca.id, skill: 'nope' }))).toBe('rejected');
      c = await a.call('skills.variant', { characterId: ca.id, skill: 'whirlwind', idx: 0 });
      expect(c.variants).toEqual([]);
      c = await a.call('skills.variant', { characterId: ca.id, skill: 'heavy_slash', idx: 1 });
      expect(c.variants).toEqual(['heavy_slash']);
      expect(await code(a.call('skills.variant', { characterId: ca.id, skill: 'heavy_slash', idx: 3 as 1 }))).toBe('bad_request');
      c = await a.call('skills.reset', { characterId: ca.id });
      expect([c.skills, c.variants]).toEqual([{}, []]);
      expect(await code(a.call('skills.variant', { characterId: ca.id, skill: 'heavy_slash', idx: 1 }))).toBe('rejected');
    });
  });
