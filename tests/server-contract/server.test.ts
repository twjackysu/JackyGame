// 伺服器契約測試（D-277，design/24 §1）：同一組測試跑每一種資料庫實作。上線時加 SQL 版也跑這一組。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { ApiError, PROTOCOL_VERSION } from '../../src/net/protocol';
import { LocalTransport } from '../../src/net/LocalTransport';
import { LOCAL_TOKEN, LocalAuth, type Auth } from '../../src/server/auth';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import type { Db } from '../../src/server/repos/types';
import { BACKENDS } from './backends';
import { LEGACY_SAMPLE } from './fixtures';

// 逾時：掉包測試要短（200ms 就重送）；不掉包的用 5 秒——CI 的 SQL Server 容器偶爾一個 migrate.legacy 就超過 13×200ms（第 149 輪 CI 紅過一次）
function stack(db: Db, opts: { local?: boolean; auth?: Auth; drop?: number; seed?: number } = {}) {
  const clock = new FakeClock();
  const server = new GameServer({ db, auth: opts.auth ?? new LocalAuth(), clock, ids: new SeqIds(), local: opts.local ?? true });
  let s = opts.seed ?? 7;
  const random = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 2 ** 32);
  let rid = 0;
  const seen = { handled: 0 };
  const client = new GameClient(new LocalTransport((j) => (seen.handled++, server.handle(j)), { dropPct: opts.drop ?? 0, random }), { token: LOCAL_TOKEN, timeoutMs: opts.drop ? 200 : 5000, retries: 12, newRequestId: () => `r${++rid}` });
  return { server, client, clock, seen };
}

const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : `throw:${String(e)}`;
  }
};

for (const be of BACKENDS)
  describe(`伺服器契約（${be.name}）`, () => {
    it('account.get 第一次會建立帳號；還沒有角色', async () => {
      const { db } = await be.fresh(() => 0);
      const { client } = stack(db);
      const a = await client.call('account.get', {});
      expect(a).toMatchObject({ displayName: '旅人', migrated: false });
      expect(await client.call('character.list', {})).toEqual([]);
    });

    it('migrate.legacy：舊存檔 → 角色、物品、錢包、地圖進度、劇情旗標', async () => {
      const { db } = await be.fresh(() => 0);
      const { client } = stack(db);
      const res = await client.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      expect(res).toMatchObject({ migrated: true, items: 3, wallet: { coin: 800, dust: 200, crystal: 10 }, skipped: ['jg_rt_emberrift'] });
      const c = await client.call('character.get', { id: res.characterId });
      expect(c).toMatchObject({ weapon: 'bow', level: 12, xp: 345, wallet: { coin: 800, dust: 200, crystal: 10 }, skills: { heavy_slash: 3, whirlwind: 5 }, variants: ['whirlwind'] });
      expect(c.stats).toEqual({ kills: 820, runs: 9, playSec: 7300, coin: 1500, dust: 260, crystal: 14 });
      expect(c.maps).toEqual({
        mistwood: { bossKills: 3, firstAt: 1761000000000, bestBossSec: 412, furyKills: 1, fury: true, night: false, fire: 'mid', chests: ['c1', 'c3'] },
        thornvale: { bossKills: 1, chests: ['t2'], fire: 'east' },
      });
      expect(c.items.map((i) => `${i.location}#${i.pos}:${String(i.gear.uid)}`)).toEqual(['bag#0:g2', 'bag#1:g3', 'equip:weapon#0:g1']);
      expect(new Set(c.items.map((i) => i.id)).size).toBe(3);
      const acc = await client.call('account.get', {});
      expect(acc.migrated).toBe(true);
      // 再轉一次不會重複建角色
      const again = await client.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      expect(again).toMatchObject({ migrated: false, characterId: res.characterId, items: 3 });
      expect(await client.call('character.list', {})).toHaveLength(1);
    });

    it('同一個 requestId 重送：只執行一次、回同一個結果', async () => {
      const { db } = await be.fresh(() => 0);
      const { client, server } = stack(db);
      const a = await client.call('migrate.legacy', { snapshot: LEGACY_SAMPLE }, 'same');
      const n = server.executed;
      const b = await client.call('migrate.legacy', { snapshot: {} }, 'same');
      expect(b).toEqual(a);
      expect(server.executed).toBe(n);
      expect(await code(client.call('account.import', { blob: {} as never }, 'same'))).toBe('conflict');
    });

    it('LocalTransport 掉包 35%：GameClient 重送，寫入只發生一次', async () => {
      const { db } = await be.fresh(() => 0);
      const { client, server, seen } = stack(db, { drop: 35, seed: 3 });
      const res = await client.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      expect(res.migrated).toBe(true);
      expect(server.executed).toBe(1);
      expect(seen.handled).toBeGreaterThan(1); // 真的有回應掉包、重送到伺服器
      const list = await client.call('character.list', {});
      expect(list).toHaveLength(1);
      expect(list[0]!.wallet.coin).toBe(800);
    });

    it('匯出 → 匯入到另一個空資料庫：內容一樣（id 重新發）', async () => {
      const { db } = await be.fresh(() => 0);
      const { client } = stack(db);
      await client.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      const blob = await client.call('account.export', {});
      const plain = JSON.parse(JSON.stringify(blob)) as typeof blob;
      const other = await be.fresh(() => 0);
      const c2 = stack(other.db).client;
      await c2.call('account.import', { blob: plain });
      const strip = (cs: Awaited<ReturnType<typeof client.call<'character.list'>>>) => cs.map((c) => ({ ...c, id: '', items: c.items.map((i) => ({ ...i, id: '' })) }));
      expect(strip(await c2.call('character.list', {}))).toEqual(strip(await client.call('character.list', {})));
      // 匯入會蓋掉原本的角色（不會變兩個）
      await c2.call('account.import', { blob: plain });
      expect(await c2.call('character.list', {})).toHaveLength(1);
      expect(await code(c2.call('account.import', { blob: { ...plain, format: 'x' as never } }))).toBe('bad_request');
    });

    it('線上模式（local=false）不接受舊存檔遷移與匯入', async () => {
      const { db } = await be.fresh(() => 0);
      const { client } = stack(db, { local: false });
      expect(await code(client.call('migrate.legacy', { snapshot: LEGACY_SAMPLE }))).toBe('rejected');
      expect(await client.call('character.list', {})).toEqual([]);
    });

    it('錯誤：未知方法、版本不合、寫入沒帶 requestId、token 錯、別人的角色', async () => {
      const { db } = await be.fresh(() => 0);
      const { server, client } = stack(db);
      const raw = async (o: object) => JSON.parse(await server.handle(JSON.stringify(o))) as { ok: boolean; error?: { code: string } };
      expect((await raw({ v: PROTOCOL_VERSION, id: 1, method: 'nope', params: {} })).error?.code).toBe('unknown_method');
      expect((await raw({ v: 99, id: 1, method: 'account.get', params: {} })).error?.code).toBe('version');
      expect((await raw({ v: PROTOCOL_VERSION, id: 1, method: 'account.import', params: {} })).error?.code).toBe('bad_request');
      expect((await raw({ v: PROTOCOL_VERSION, id: 1, method: 'account.get', params: {}, token: 'evil' })).error?.code).toBe('unauthorized');
      expect(JSON.parse(await server.handle('{oops'))).toMatchObject({ ok: false, error: { code: 'bad_request' } });
      expect(await code(client.call('character.get', { id: 'chr_404' }))).toBe('not_found');
      expect(await code(client.call('character.get', { id: 5 as never }))).toBe('bad_request');
    });

    it('交易回滾：handler 中途失敗，什麼都不寫；錢包不能變負；樂觀鎖擋舊版本', async () => {
      const { db } = await be.fresh(() => 1);
      await db.tx(async (r) => {
        await r.characters.save({ id: 'c1', accountId: 'a', slot: 0, name: 'x', weapon: 'sword', level: 1, xp: 0, stats: {}, skills: null, variants: null, bounty: null, shop: null, maps: {}, story: {}, createdAt: 0, version: 0 });
        await r.wallets.apply('c1', 'coin', 100, 'test');
      });
      await expect(
        db.tx(async (r) => {
          await r.wallets.apply('c1', 'coin', -30, 'buy');
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await db.tx((r) => r.wallets.balances('c1'))).toEqual({ coin: 100, dust: 0, crystal: 0 });
      await expect(db.tx((r) => r.wallets.apply('c1', 'coin', -101, 'buy'))).rejects.toMatchObject({ code: 'rejected' });
      await expect(db.tx((r) => r.wallets.apply('c1', 'coin', 1.5, 'x'))).rejects.toMatchObject({ code: 'bad_request' });
      const led = await db.tx((r) => r.wallets.ledger('c1'));
      expect(led.map((l) => [l.delta, l.balanceAfter, l.reason])).toEqual([[100, 100, 'test']]);
      const c = (await db.tx((r) => r.characters.get('c1')))!;
      expect(c.version).toBe(0);
      const c2 = await db.tx((r) => r.characters.save({ ...c, level: 2 }));
      expect(c2.version).toBe(1);
      await expect(db.tx((r) => r.characters.save({ ...c, level: 3 }))).rejects.toMatchObject({ code: 'conflict' });
      // 讀出來的東西改了不會影響資料庫
      const got = (await db.tx((r) => r.characters.get('c1')))!;
      got.level = 50;
      expect((await db.tx((r) => r.characters.get('c1')))!.level).toBe(2);
    });

    if (be.name !== 'memory')
      it('關掉再開：資料還在', async () => {
        const { db, reopen } = await be.fresh(() => 0);
        const { client } = stack(db);
        const res = await client.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
        await db.close();
        const db2 = await reopen!();
        const c = await stack(db2).client.call('character.get', { id: res.characterId });
        expect(c.wallet).toEqual({ coin: 800, dust: 200, crystal: 10 });
        expect(c.items).toHaveLength(3);
      });
  });
