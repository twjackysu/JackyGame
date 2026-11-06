// 面對面交易（託管，F3，第 144 輪）的契約測試：每種資料庫都跑。
// 重點：放進去的東西由伺服器保管（拿不去賣、不會重複）；改內容解除雙方鎖定；確認要對目前版本；
// 完成時物品換主人、金幣到對方；取消／過期全部退回；綁定的不能放；別人的交易碰不到。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { ApiError } from '../../src/net/protocol';
import { LocalTransport } from '../../src/net/LocalTransport';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import { TRADE_TTL_MS } from '../../src/core/meta/trade';
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

async function setup(be: (typeof BACKENDS)[number]) {
  const { db } = await be.fresh(() => 0);
  const clock = new FakeClock();
  const server = new GameServer({ db, auth, clock, ids: new SeqIds(), local: true, rng: () => 0.3 });
  let n = 0;
  const mk = (token: string) => new GameClient(new LocalTransport((j) => server.handle(j)), { token, timeoutMs: 15000, retries: 1, newRequestId: () => `${token}${++n}` });
  const a = mk('accA');
  const b = mk('accB');
  const c = mk('accC');
  const A = (await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId;
  const B = (await b.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId;
  const C = (await c.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId;
  return { clock, a, b, c, A, B, C };
}

for (const be of BACKENDS)
  describe(`面對面交易（${be.name}）`, () => {
    it('A 放物品、B 放金幣 → 雙方鎖定 → 對目前版本確認 → 交換；託管中的物品不能拿去賣', async () => {
      const { a, b, c, A, B, C } = await setup(be);
      const meA = await a.call('character.get', { id: A });
      const item = meA.items.find((i) => i.location === 'bag')!;
      const coinA = meA.wallet.coin;
      const coinB = (await b.call('character.get', { id: B })).wallet.coin;
      const { trade } = await a.call('trade.open', { characterId: A, partnerCharacterId: B });
      expect(trade.partnerName).toBeTruthy();
      // 第三者看不到、動不了
      expect(await code(c.call('trade.get', { characterId: C, tradeId: trade.id }))).toBe('not_found');
      expect(await code(c.call('trade.get', { characterId: A, tradeId: trade.id }))).toBe('not_found');
      let r = await a.call('trade.offer', { characterId: A, tradeId: trade.id, items: [item.id], coin: 0 });
      expect(r.character.items.some((i) => i.id === item.id && i.location === 'bag')).toBe(false);
      expect(await code(a.call('market.list', { characterId: A, itemId: item.id, price: 100 }))).toBe('not_found');
      const rb = await b.call('trade.offer', { characterId: B, tradeId: trade.id, items: [], coin: 300 });
      expect(rb.character.wallet.coin).toBe(coinB - 300); // 託管：先扣
      expect(rb.trade.theirs.items.map((i) => i.id)).toEqual([item.id]);
      await a.call('trade.lock', { characterId: A, tradeId: trade.id });
      r = await b.call('trade.lock', { characterId: B, tradeId: trade.id });
      expect(r.trade.locked).toEqual({ me: true, them: true });
      expect(await code(a.call('trade.confirm', { characterId: A, tradeId: trade.id, rev: r.trade.rev - 1 }))).toBe('rejected');
      await a.call('trade.confirm', { characterId: A, tradeId: trade.id, rev: r.trade.rev });
      const fin = await b.call('trade.confirm', { characterId: B, tradeId: trade.id, rev: r.trade.rev });
      expect(fin.trade.status).toBe('done');
      expect(fin.character.items.some((i) => i.id === item.id && i.location === 'bag')).toBe(true);
      const afterA = await a.call('character.get', { id: A });
      expect(afterA.items.some((i) => i.id === item.id)).toBe(false);
      expect(afterA.wallet.coin).toBe(coinA + 300);
      // 結束的交易不能再動
      expect(await code(a.call('trade.offer', { characterId: A, tradeId: trade.id, items: [], coin: 1 }))).toBe('rejected');
    });

    it('改內容解除雙方鎖定；取消全部退回；錢不夠、綁定、亂填都被拒', async () => {
      const { a, b, A, B } = await setup(be);
      const meA = await a.call('character.get', { id: A });
      const [i1, i2] = meA.items.filter((i) => i.location === 'bag');
      const { trade } = await a.call('trade.open', { characterId: A, partnerCharacterId: B });
      await a.call('trade.offer', { characterId: A, tradeId: trade.id, items: [i1!.id], coin: 50 });
      await b.call('trade.lock', { characterId: B, tradeId: trade.id });
      await a.call('trade.lock', { characterId: A, tradeId: trade.id });
      const swap = await a.call('trade.offer', { characterId: A, tradeId: trade.id, items: [i2!.id], coin: 10 });
      expect(swap.trade.locked).toEqual({ me: false, them: false });
      expect(swap.character.items.find((i) => i.id === i1!.id)!.location).toBe('bag'); // 換下來的退回
      expect(swap.character.wallet.coin).toBe(meA.wallet.coin - 10);
      expect(await code(a.call('trade.offer', { characterId: A, tradeId: trade.id, items: [], coin: 999_999 }))).toBe('rejected');
      expect(await code(a.call('trade.offer', { characterId: A, tradeId: trade.id, items: [i2!.id, i2!.id], coin: 0 }))).toBe('bad_request');
      expect(await code(a.call('trade.offer', { characterId: A, tradeId: trade.id, items: ['nope'], coin: 0 }))).toBe('not_found');
      const eq = meA.items.find((i) => i.location.startsWith('equip:'))!;
      expect(await code(a.call('trade.offer', { characterId: A, tradeId: trade.id, items: [eq.id], coin: 0 }))).toBe('not_found'); // 穿著的要先脫
      const can = await b.call('trade.cancel', { characterId: B, tradeId: trade.id });
      expect(can.trade.status).toBe('cancelled');
      const back = await a.call('character.get', { id: A });
      expect(back.wallet.coin).toBe(meA.wallet.coin);
      expect(back.items.filter((i) => i.location === 'bag').length).toBe(meA.items.filter((i) => i.location === 'bag').length);
    });

    it('過期：任一方再看的時候全部退回', async () => {
      const { clock, a, b, A, B } = await setup(be);
      const meA = await a.call('character.get', { id: A });
      const item = meA.items.find((i) => i.location === 'bag')!;
      const { trade } = await a.call('trade.open', { characterId: A, partnerCharacterId: B });
      await a.call('trade.offer', { characterId: A, tradeId: trade.id, items: [item.id], coin: 20 });
      clock.advance(TRADE_TTL_MS + 1000);
      const r = await b.call('trade.get', { characterId: B, tradeId: trade.id });
      expect(r.trade.status).toBe('expired');
      const back = await a.call('character.get', { id: A });
      expect(back.wallet.coin).toBe(meA.wallet.coin);
      expect(back.items.find((i) => i.id === item.id)!.location).toBe('bag');
    });
  });
