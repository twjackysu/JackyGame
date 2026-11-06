// 模擬玩家（第 143 輪，24 §5）的契約測試：每種資料庫都跑。
// 重點：只透過公開 handler 交易（金幣與物品守恆）、客戶端叫不到內部方法、補跑有上限、真人的好價掛單會被買走。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { LocalTransport } from '../../src/net/LocalTransport';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import type { Db } from '../../src/server/repos/types';
import { isGear, type RtGear } from '../../src/core/battle/rt/gear';
import { buyPrice } from '../../src/core/meta/shop';
import { listFee, sellerGets } from '../../src/core/meta/market';
import { SIM_BACKLOG, SIM_MAX_LISTINGS } from '../../src/server/sim/handlers';
import { simRoster } from '../../src/server/sim/roster';
import { BACKENDS } from './backends';
import { LEGACY_SAMPLE } from './fixtures';

const auth = { resolve: async (t?: string) => t ?? 'anon' };
const HOUR = 3600_000;

async function setup(db: Db, players = 12) {
  const clock = new FakeClock();
  const server = new GameServer({ db, auth, clock, ids: new SeqIds(), local: true, rng: () => 0, sim: { players, throttleMs: 0, maxActions: 40 } });
  let rid = 0;
  const a = new GameClient(new LocalTransport((j) => server.handle(j)), { token: 'accA', timeoutMs: 15000, retries: 1, newRequestId: () => `a-${++rid}` });
  const ca = await a.call('character.get', { id: (await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId });
  return { server, clock, a, ca };
}

/** 每個角色：錢包餘額＝帳本加總（金幣只能透過帳本異動） */
async function ledgerOk(db: Db): Promise<boolean> {
  return db.tx(async (r) => {
    const ids = new Set<string>();
    for (const sim of simRoster(40)) for (const c of await r.characters.listByAccount(sim.accountId)) ids.add(c.id);
    for (const id of ids) {
      const sum = (await r.wallets.ledger(id)).filter((l) => l.currency === 'coin').reduce((s, l) => s + l.delta, 0);
      if (sum !== (await r.wallets.balances(id)).coin) return false;
    }
    return true;
  });
}

for (const be of BACKENDS)
  describe(`模擬玩家（${be.name}）`, () => {
    it('客戶端叫不到模擬玩家的內部方法', async () => {
      const { db } = await be.fresh(() => 0);
      const { server } = await setup(db, 3);
      for (const method of ['sim.step', 'sim.state', 'sim.farm']) {
        const res = JSON.parse(await server.handle(JSON.stringify({ v: 1, id: 1, method, params: {}, requestId: 'x', token: 'accA' })));
        expect(res.error.code).toBe('unknown_method');
      }
    });

    it('第一次打開拍賣所就有模擬玩家的貨；每人最多補跑幾次、掛單不超過上限；同一時間再開不會重做', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, server } = await setup(db, 12);
      const first = await a.call('market.browse', {});
      expect(first.listings.length).toBeGreaterThan(0);
      const names = new Set(simRoster(12).map((s) => s.name));
      for (const l of first.listings) {
        expect(names.has(l.sellerName)).toBe(true);
        expect(isGear(l.gear)).toBe(true);
        expect(l.mine).toBe(false);
      }
      const acts = server.sim!.stats.actions;
      expect(acts).toBeLessThanOrEqual(12 * SIM_BACKLOG);
      await a.call('market.browse', {});
      expect(server.sim!.stats.actions).toBe(acts);
      // 每個模擬玩家開著的掛單 ≤ 上限
      const per = new Map<string, number>();
      for (let page = 0; page < 10; page++) for (const l of (await a.call('market.browse', { page })).listings) per.set(l.sellerName, (per.get(l.sellerName) ?? 0) + 1);
      for (const n of per.values()) expect(n).toBeLessThanOrEqual(SIM_MAX_LISTINGS);
      expect(await ledgerOk(db)).toBe(true);
    });

    it('真人用好價錢上架，一段時間內會被模擬玩家買走；賣家拿到扣手續費後的錢', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, ca, clock, server } = await setup(db, 20);
      const it = ca.items.find((i) => i.location === 'bag' && isGear(i.gear))!;
      const price = Math.max(1, Math.floor(buyPrice(it.gear as unknown as RtGear) * 0.25));
      const r = await a.call('market.list', { characterId: ca.id, itemId: it.id, price });
      let sold = false;
      for (let h = 0; h < 48 && !sold; h++) {
        clock.advance(HOUR);
        await a.call('market.browse', {});
        const mine = await a.call('market.mine', { characterId: ca.id });
        sold = mine.listings.find((l) => l.id === r.listing.id)!.status === 'sold';
        if (sold) expect(mine.character.wallet.coin).toBe(ca.wallet.coin - listFee(price) + sellerGets(price));
      }
      expect(sold).toBe(true);
      expect(server.sim!.stats.boughtFromPlayers).toBe(1);
      expect(await ledgerOk(db)).toBe(true);
    });

    it('離開一週再打開：只補最近幾次（不會爆出幾百筆）', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, clock, server } = await setup(db, 8);
      await a.call('market.browse', {});
      const before = server.sim!.stats.actions;
      clock.advance(7 * 24 * HOUR);
      await a.call('market.browse', {});
      expect(server.sim!.stats.actions - before).toBeLessThanOrEqual(8 * SIM_BACKLOG);
    });
  });
