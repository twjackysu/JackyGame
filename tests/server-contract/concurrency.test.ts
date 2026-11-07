// 並發（第 148 輪，V4 驗收「SQL 版的交易鎖與並發測試」）：每種資料庫都跑（mssql 只在 CI 的 SQL Server 容器）。
// 同一時間送很多個互相衝突的請求（Promise.all，不等前一個回來）：
// 三個人同時買同一筆掛單只有一個成交；同一件同時上架＋賣給行商只有一個成功；雙方同時確認交易只交換一次。
// 不管誰贏，物品只有一個主人、金幣總和守恆（輸的那邊可以是 not_found／conflict／rejected，mssql 的死結重試失敗也可以是 internal）。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { ApiError } from '../../src/net/protocol';
import { LocalTransport } from '../../src/net/LocalTransport';
import type { CharacterView } from '../../src/net/views';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import { listFee, sellerGets } from '../../src/core/meta/market';
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
const LOSE = ['not_found', 'conflict', 'rejected', 'internal'];

async function setup(be: (typeof BACKENDS)[number], tokens: string[]) {
  const { db } = await be.fresh(() => 0);
  const server = new GameServer({ db, auth, clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => 0.5 });
  let rid = 0;
  const cs = tokens.map((t) => new GameClient(new LocalTransport((j) => server.handle(j)), { token: t, timeoutMs: 15000, retries: 0, newRequestId: () => `${t}-${++rid}` }));
  const ids: string[] = [];
  for (const c of cs) ids.push((await c.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId);
  return { cs, ids };
}

const owners = (views: CharacterView[], itemId: string) => views.filter((v) => v.items.some((i) => i.id === itemId)).length;

for (const be of BACKENDS)
  describe(`並發（${be.name}）`, () => {
    it('三個人同時買同一筆掛單：只有一個成交，物品一個主人、金幣守恆', async () => {
      const { cs, ids } = await setup(be, ['accS', 'accB1', 'accB2', 'accB3']);
      const [s, ...buyers] = cs;
      const me0 = await Promise.all(cs.map((c, i) => c.call('character.get', { id: ids[i]! })));
      const it = me0[0]!.items.find((i) => i.location === 'bag')!;
      const price = 300;
      const { listing } = await s!.call('market.list', { characterId: ids[0]!, itemId: it.id, price });
      const res = await Promise.all(buyers.map((b, k) => code(b.call('market.buy', { characterId: ids[k + 1]!, listingId: listing.id }))));
      expect(res.filter((r) => r === 'ok').length).toBe(1);
      for (const r of res) if (r !== 'ok') expect(LOSE).toContain(r);
      const after = await Promise.all(cs.map((c, i) => c.call('character.get', { id: ids[i]! })));
      expect(owners(after, it.id)).toBe(1);
      const sum = (vs: CharacterView[]) => vs.reduce((n, v) => n + v.wallet.coin, 0);
      expect(sum(after)).toBe(sum(me0) - listFee(price) - (price - sellerGets(price)));
    });

    it('同一件同時「上架」和「賣給行商」：只有一個成功，不會兩邊都拿到錢', async () => {
      const { cs, ids } = await setup(be, ['accX']);
      const [x] = cs;
      const me0 = await x!.call('character.get', { id: ids[0]! });
      const it = me0.items.find((i) => i.location === 'bag')!;
      const res = await Promise.all([code(x!.call('market.list', { characterId: ids[0]!, itemId: it.id, price: 100 })), code(x!.call('shop.sell', { characterId: ids[0]!, itemIds: [it.id] })), code(x!.call('market.list', { characterId: ids[0]!, itemId: it.id, price: 200 }))]);
      expect(res.filter((r) => r === 'ok').length).toBe(1);
      const me1 = await x!.call('character.get', { id: ids[0]! });
      const listed = (await x!.call('market.mine', { characterId: ids[0]! })).listings.filter((l) => l.status === 'open');
      const sold = !me1.items.some((i) => i.id === it.id);
      // 賣掉了就不在掛單；掛著就只有一筆
      if (sold) expect(listed.length).toBe(0);
      else expect(listed.length).toBe(1);
    });

    it('雙方同時按確認：只交換一次', async () => {
      const { cs, ids } = await setup(be, ['accT1', 'accT2']);
      const [a, b] = cs;
      const A = ids[0]!;
      const B = ids[1]!;
      const ma = await a!.call('character.get', { id: A });
      const mb = await b!.call('character.get', { id: B });
      const it = ma.items.find((i) => i.location === 'bag')!;
      const { trade } = await a!.call('trade.open', { characterId: A, partnerCharacterId: B });
      await a!.call('trade.offer', { characterId: A, tradeId: trade.id, items: [it.id], coin: 0 });
      await b!.call('trade.offer', { characterId: B, tradeId: trade.id, items: [], coin: 120 });
      await a!.call('trade.lock', { characterId: A, tradeId: trade.id });
      const l = await b!.call('trade.lock', { characterId: B, tradeId: trade.id });
      const rev = l.trade.rev;
      // 雙方各按兩次（連點）
      const res = await Promise.all([
        code(a!.call('trade.confirm', { characterId: A, tradeId: trade.id, rev })),
        code(b!.call('trade.confirm', { characterId: B, tradeId: trade.id, rev })),
        code(a!.call('trade.confirm', { characterId: A, tradeId: trade.id, rev })),
        code(b!.call('trade.confirm', { characterId: B, tradeId: trade.id, rev })),
      ]);
      for (const r of res) if (r !== 'ok') expect(LOSE).toContain(r);
      const fa = await a!.call('character.get', { id: A });
      const fb = await b!.call('character.get', { id: B });
      expect(owners([fa, fb], it.id)).toBe(1);
      const st = (await a!.call('trade.get', { characterId: A, tradeId: trade.id })).trade.status;
      if (st === 'done') {
        expect(fb.items.some((i) => i.id === it.id)).toBe(true);
        expect(fa.wallet.coin).toBe(ma.wallet.coin + 120);
        expect(fb.wallet.coin).toBe(mb.wallet.coin - 120);
      } else {
        // 還沒完成（例如兩個 confirm 都輸給對方的並發）：託管中，金幣總和不變
        expect(fa.wallet.coin + fb.wallet.coin + 120).toBe(ma.wallet.coin + mb.wallet.coin);
      }
      expect(fa.wallet.coin + fb.wallet.coin).toBe(ma.wallet.coin + mb.wallet.coin - (st === 'done' ? 0 : 120));
    });
  });
