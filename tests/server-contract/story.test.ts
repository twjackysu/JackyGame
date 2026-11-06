// 討伐後抉擇 handler 的契約測試（第 142 輪 V2，D-290）：每種資料庫實作都跑同一組。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { ApiError } from '../../src/net/protocol';
import { LocalTransport } from '../../src/net/LocalTransport';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import { CHOICE_CRYSTAL } from '../../src/core/meta/choices';
import { BOSS_CHOICES } from '../../src/game/choices';
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

it('畫面的抉擇文字和 core 的結晶數一致', () => {
  for (const c of BOSS_CHOICES) expect(c.take.crystal).toBe(CHOICE_CRYSTAL[c.map as keyof typeof CHOICE_CRYSTAL]);
  expect(BOSS_CHOICES.map((c) => c.map).sort()).toEqual(Object.keys(CHOICE_CRYSTAL).sort());
});

for (const be of BACKENDS)
  describe(`討伐後抉擇（${be.name}）`, () => {
    it('打倒過 Boss 才能選、只能選一次；「取」發結晶、「還」記進折扣；別人的角色碰不到', async () => {
      const { db } = await be.fresh(() => 0);
      const server = new GameServer({ db, auth, clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => 0 });
      let rid = 0;
      const mk = (token: string) => new GameClient(new LocalTransport((j) => server.handle(j)), { token, timeoutMs: 15000, retries: 1, newRequestId: () => `${token}-${++rid}` });
      const a = mk('accA');
      const b = mk('accB');
      // 樣本存檔：霧語森林打倒過 Boss（bossKills 3），燼紅裂谷沒有
      const ca = await a.call('character.get', { id: (await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId });
      expect(await code(b.call('story.choose', { characterId: ca.id, map: 'mistwood', pick: 'take' }))).toBe('not_found');
      expect(await code(a.call('story.choose', { characterId: ca.id, map: 'emberrift', pick: 'take' }))).toBe('rejected');
      expect(await code(a.call('story.choose', { characterId: ca.id, map: 'nowhere', pick: 'take' }))).toBe('bad_request');
      expect(await code(a.call('story.choose', { characterId: ca.id, map: 'mistwood', pick: 'keep' as 'take' }))).toBe('bad_request');
      const r = await a.call('story.choose', { characterId: ca.id, map: 'mistwood', pick: 'take' });
      expect(r.crystal).toBe(3);
      expect(r.character.wallet.crystal).toBe(ca.wallet.crystal + 3);
      expect(await code(a.call('story.choose', { characterId: ca.id, map: 'mistwood', pick: 'spare' }))).toBe('rejected');
      expect((await a.call('character.get', { id: ca.id })).wallet.crystal).toBe(ca.wallet.crystal + 3);
      await db.close();
    });


    it('路上的相遇（第 147 輪）：只能選一次、「取」伺服器發、「助」之後回禮只有一次；地圖還沒開放、亂填、別人的都拒絕', async () => {
      const { db } = await be.fresh(() => 0);
      const server = new GameServer({ db, auth, clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => 0 });
      let rid = 0;
      const mk = (token: string) => new GameClient(new LocalTransport((j) => server.handle(j)), { token, timeoutMs: 15000, retries: 1, newRequestId: () => `${token}-e${++rid}` });
      const a = mk('accA');
      const b = mk('accB');
      const ca = await a.call('character.get', { id: (await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId });
      const id = ca.id;
      expect(await code(a.call('story.meet', { characterId: id, encounterId: 'nope', pick: 'take' }))).toBe('bad_request');
      expect(await code(a.call('story.meet', { characterId: id, encounterId: 'mw_hunter', pick: 'grab' as 'take' }))).toBe('bad_request');
      expect(await code(b.call('story.meet', { characterId: id, encounterId: 'mw_hunter', pick: 'take' }))).toBe('not_found');
      // 星隕高原還沒開放（通關後）
      expect(await code(a.call('story.meet', { characterId: id, encounterId: 'sf_courier', pick: 'take' }))).toBe('rejected');
      const t = await a.call('story.meet', { characterId: id, encounterId: 'mw_hunter', pick: 'take' });
      expect(t).toMatchObject({ coin: 60, crystal: 0 });
      expect(t.character.wallet.coin).toBe(ca.wallet.coin + 60);
      expect(t.character.encounters).toEqual({ mw_hunter: 'take' });
      expect(await code(a.call('story.meet', { characterId: id, encounterId: 'mw_hunter', pick: 'spare' }))).toBe('rejected');
      // 取過的沒有回禮
      expect(await code(a.call('story.thanks', { characterId: id, encounterId: 'mw_hunter' }))).toBe('rejected');
      // 助：當下什麼都沒有，回禮一次
      const s0 = await a.call('story.meet', { characterId: id, encounterId: 'mw_herbs', pick: 'spare' });
      expect(s0).toMatchObject({ coin: 0, crystal: 0 });
      expect(s0.character.wallet.coin).toBe(ca.wallet.coin + 60);
      const th = await a.call('story.thanks', { characterId: id, encounterId: 'mw_herbs' });
      expect(th).toMatchObject({ coin: 50, crystal: 2 });
      expect(th.character.wallet.crystal).toBe(ca.wallet.crystal + 2);
      expect(await code(a.call('story.thanks', { characterId: id, encounterId: 'mw_herbs' }))).toBe('rejected');
      await db.close();
    });
  });
