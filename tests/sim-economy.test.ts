// 拍賣所經濟模擬（24 §4.3「物價不無限上漲」）：30 個模擬玩家跑 14 天，每 30 分鐘補跑一次。
// `npm run sim:economy` 印每天的報表；平常跑只檢查：掛單數有上限、物價（每件掛單價／行商買價）沒有一路往上、金幣守恆。
import { describe, expect, it } from 'vitest';
import { FakeClock, SeqIds } from '../src/server/clock';
import { GameServer } from '../src/server/GameServer';
import { DocDb } from '../src/server/db/docDb';
import { MemoryStore } from '../src/server/db/memory/MemoryDb';
import { isGear, type RtGear } from '../src/core/battle/rt/gear';
import { buyPrice } from '../src/core/meta/shop';
import type { ListingRow } from '../src/server/repos/types';
import { SIM_MAX_LISTINGS } from '../src/server/sim/handlers';
import { simRoster } from '../src/server/sim/roster';
import { SIM_COIN_CAP } from '../src/server/sim/SimMarket';

const REPORT = !!process.env.SIM_REPORT;
const DAYS = 14;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

describe('拍賣所經濟模擬', () => {
  it(`30 人 × ${DAYS} 天：掛單數有上限、物價不往上飄、金幣只透過帳本異動`, async () => {
    const clock = new FakeClock();
    const db = await DocDb.open(new MemoryStore(), () => clock.now());
    const server = new GameServer({ db, auth: { resolve: async () => 'acc_local' }, clock, ids: new SeqIds(), local: true, sim: { throttleMs: 0, maxActions: 60 } });
    const roster = simRoster();
    const rows: string[] = [];
    const ratios: number[] = [];
    let lastCoin = 0;
    for (let day = 1; day <= DAYS; day++) {
      for (let k = 0; k < 48; k++) {
        clock.advance(30 * 60_000);
        await server.sim!.catchUp(true);
      }
      const snap = await db.tx(async (r) => {
        const open: ListingRow[] = await r.listings.listOpen({ aliveAt: clock.now(), offset: 0, limit: 10_000 });
        let coin = 0;
        let farmed = 0;
        let fees = 0;
        for (const sim of roster)
          for (const c of await r.characters.listByAccount(sim.accountId)) {
            coin += (await r.wallets.balances(c.id)).coin;
            for (const l of await r.wallets.ledger(c.id)) {
              if (l.currency !== 'coin') continue;
              if (l.reason === 'sim.farm' || l.reason === 'shop.sell') farmed += l.delta;
              if (l.reason === 'market.listFee') fees -= l.delta;
            }
          }
        return { open, coin, farmed, fees };
      });
      const ratio = median(snap.open.filter((l) => isGear(l.gear)).map((l) => l.price / buyPrice(l.gear as unknown as RtGear)));
      ratios.push(ratio);
      lastCoin = snap.coin;
      const s = server.sim!.stats;
      rows.push(`| ${day} | ${snap.open.length} | ${ratio.toFixed(2)} | ${s.listed} | ${s.bought} | ${s.soldToShop} | ${snap.coin} | ${snap.farmed} | ${snap.fees} |`);
      expect(snap.open.length).toBeLessThanOrEqual(roster.length * SIM_MAX_LISTINGS);
    }
    if (REPORT) console.log(['| 天 | 開著的掛單 | 價格／行商買價（中位數） | 累計上架 | 累計成交 | 累計賣行商 | 模擬玩家金幣總和 | 累計打怪＋賣行商收入 | 累計上架費 |', '|---|---|---|---|---|---|---|---|---|', ...rows].join('\n'));
    // 物價：後半段的中位數不比前半段高超過 30%（沒有一路上漲）
    const firstHalf = median(ratios.slice(0, DAYS / 2));
    const secondHalf = median(ratios.slice(DAYS / 2));
    expect(secondHalf).toBeLessThanOrEqual(firstHalf * 1.3);
    expect(server.sim!.stats.bought).toBeGreaterThan(0);
    // 模擬玩家的購買力有上限（錢多了會去行商買材料），不會一直漲
    expect(lastCoin).toBeLessThanOrEqual(roster.length * SIM_COIN_CAP * 1.3);
    // 金幣守恆：每個模擬玩家的餘額＝帳本加總
    await db.tx(async (r) => {
      for (const sim of roster)
        for (const c of await r.characters.listByAccount(sim.accountId)) {
          const sum = (await r.wallets.ledger(c.id)).filter((l) => l.currency === 'coin').reduce((t, l) => t + l.delta, 0);
          expect((await r.wallets.balances(c.id)).coin).toBe(sum);
        }
    });
  }, 120_000);
});
