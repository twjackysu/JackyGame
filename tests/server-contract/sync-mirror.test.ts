// 過渡期（D-285）：舊 key → migrate.sync → 伺服器規則 → legacyMirror 寫回舊 key，來回不掉東西
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { legacySnapshot } from '../../src/client/boot';
import { MIRROR_KEY, mirrorToLegacy } from '../../src/client/legacyMirror';
import { LocalTransport } from '../../src/net/LocalTransport';
import { ApiError } from '../../src/net/protocol';
import { LOCAL_TOKEN, LocalAuth } from '../../src/server/auth';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import { fromLegacy } from '../../src/server/legacy';
import { BACKENDS, MapStorage } from './backends';
import { LEGACY_SAMPLE } from './fixtures';

for (const be of BACKENDS)
  describe(`舊 key 同步與寫回（${be.name}）`, () => {
    it('戰鬥中撿到的東西 sync 上去；伺服器動作寫回舊 key 後兩邊一致；itemId 不變', async () => {
      const { db } = await be.fresh(() => 0);
      const server = new GameServer({ db, auth: new LocalAuth(), clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => 0 });
      let n = 0;
      const client = new GameClient(new LocalTransport((j) => server.handle(j)), { token: LOCAL_TOKEN, timeoutMs: 15000, newRequestId: () => `q${++n}` });
      const ls = new MapStorage();
      for (const [k, v] of Object.entries(LEGACY_SAMPLE)) ls.setItem(k, v);
      const { characterId } = await client.call('migrate.legacy', { snapshot: legacySnapshot(ls) });
      const before = await client.call('character.get', { id: characterId });
      // 戰鬥場景照舊寫舊 key：撿到 300 金、一件新裝
      const rec = JSON.parse(ls.getItem(MIRROR_KEY)!);
      rec.coin += 300;
      rec.bag.unshift({ uid: 'g9', slot: 'head', rarity: 1, ilvl: 4, name: '布帽', base: { hp: 12 }, affixes: [] });
      ls.setItem(MIRROR_KEY, JSON.stringify(rec));
      let v = await client.call('migrate.sync', { snapshot: legacySnapshot(ls) });
      expect(v.wallet.coin).toBe(1100);
      expect(v.items.map((i) => String(i.gear.uid))).toEqual(['g9', 'g2', 'g3', 'g1']);
      expect(v.items.find((i) => i.gear.uid === 'g2')!.id).toBe(before.items.find((i) => i.gear.uid === 'g2')!.id);
      // 面板動作：穿上布帽、分解皮甲、強化長劍
      v = await client.call('inventory.equip', { characterId, itemId: v.items.find((i) => i.gear.uid === 'g9')!.id });
      v = (await client.call('inventory.salvage', { characterId, itemId: v.items.find((i) => i.gear.uid === 'g2')!.id })).character;
      v = (await client.call('enhance.do', { characterId, itemId: v.items.find((i) => i.gear.uid === 'g1')!.id })).character;
      mirrorToLegacy(ls, v);
      const L = fromLegacy(legacySnapshot(ls));
      expect(L.wallet).toEqual(v.wallet);
      expect(L.bag.map((g) => g.uid)).toEqual(['g3']);
      expect(Object.fromEntries(Object.entries(L.equip).map(([s, g]) => [s, [g.uid, g.enh ?? 0]]))).toEqual({ weapon: ['g1', 8], head: ['g9', 0] });
      // 累計統計不動
      expect(JSON.parse(ls.getItem(MIRROR_KEY)!).coin).toBe(1800);
      // 寫回後再 sync 一次：沒有任何變化（行囊 pos 會重新編成 0,1,2…，順序一樣）
      const again = await client.call('migrate.sync', { snapshot: legacySnapshot(ls) });
      const shape = (x: typeof v) => x.items.map((i) => [i.id, i.location, i.gear]);
      expect(shape(again)).toEqual(shape(v));
      expect(again.wallet).toEqual(v.wallet);
    });

    it('線上版不接受 sync', async () => {
      const { db } = await be.fresh(() => 0);
      const server = new GameServer({ db, auth: new LocalAuth(), clock: new FakeClock(), ids: new SeqIds(), local: false });
      const client = new GameClient(new LocalTransport((j) => server.handle(j)), { token: LOCAL_TOKEN, timeoutMs: 15000, newRequestId: () => 'x1' });
      await expect(client.call('migrate.sync', { snapshot: {} })).rejects.toBeInstanceOf(ApiError);
    });
  });
