// 多角色＋帳號共用倉庫（F1，第 145 輪，D-302）的契約測試：每種資料庫都跑。
// 重點：最多 3 個角色欄；名字伺服器檢查；不能刪目前角色、最後一個、拍賣中還有東西的；
// 倉庫 40 格、同帳號的角色都拿得到、別的帳號碰不到；migrate.sync 只寫目前角色；匯出入帶倉庫。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { ApiError } from '../../src/net/protocol';
import { LocalTransport } from '../../src/net/LocalTransport';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import { WAREHOUSE_MAX, cleanName, deleteBlocker, freeSlot } from '../../src/core/meta/roster';
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
  const server = new GameServer({ db, auth, clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => 0.3 });
  let n = 0;
  const mk = (token: string) => new GameClient(new LocalTransport((j) => server.handle(j)), { token, timeoutMs: 15000, retries: 1, newRequestId: () => `${token}${++n}` });
  const a = mk('accA');
  const b = mk('accB');
  const A = (await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId;
  return { a, b, A };
}

describe('roster 規則', () => {
  it('名字、空欄、刪除限制', () => {
    expect(cleanName('  阿洛 ')).toBe('阿洛');
    expect(cleanName('')).toBeNull();
    expect(cleanName('一二三四五六七八九')).toBeNull();
    expect(cleanName('<b>')).toBeNull();
    expect(cleanName('a\nb')).toBeNull();
    expect(cleanName(3)).toBeNull();
    expect(freeSlot([0, 2])).toBe(1);
    expect(freeSlot([0, 1, 2])).toBe(-1);
    expect(deleteBlocker({ isActive: false, count: 1, escrowItems: 0 })).toBe('last character');
    expect(deleteBlocker({ isActive: true, count: 2, escrowItems: 0 })).toBe('active character');
    expect(deleteBlocker({ isActive: false, count: 2, escrowItems: 1 })).toBeTruthy();
    expect(deleteBlocker({ isActive: false, count: 2, escrowItems: 0 })).toBeNull();
  });
});

for (const be of BACKENDS)
  describe(`多角色與倉庫（${be.name}）`, () => {
    it('建角色：最多 3 個、名字與武器檢查、新角色從 1 級空手開始；遷移的角色是目前角色', async () => {
      const { a, A } = await setup(be);
      expect((await a.call('account.get', {})).activeCharacterId).toBe(A);
      expect(await code(a.call('character.create', { name: '', weapon: 'bow' }))).toBe('bad_request');
      expect(await code(a.call('character.create', { name: '弓手', weapon: 'axe' as 'bow' }))).toBe('bad_request');
      const c2 = await a.call('character.create', { name: '弓手', weapon: 'bow' });
      expect(c2).toMatchObject({ slot: 1, level: 1, xp: 0, weapon: 'bow', wallet: { coin: 0, dust: 0, crystal: 0 } });
      expect(c2.items).toEqual([]);
      const c3 = await a.call('character.create', { name: '法師', weapon: 'staff' });
      expect(c3.slot).toBe(2);
      expect(await code(a.call('character.create', { name: '第四', weapon: 'sword' }))).toBe('rejected');
      expect((await a.call('character.list', {})).map((c) => c.slot).sort()).toEqual([0, 1, 2]);
      // 建角色不會換掉目前角色
      expect((await a.call('account.get', {})).activeCharacterId).toBe(A);
    });

    it('選角色、刪角色：不能刪目前角色和最後一個；拍賣中還有東西不能刪；別人的角色選不到也刪不到', async () => {
      const { a, b, A } = await setup(be);
      expect(await code(a.call('character.delete', { id: A }))).toBe('rejected'); // 最後一個
      const c2 = await a.call('character.create', { name: '弓手', weapon: 'bow' });
      expect(await code(a.call('character.delete', { id: A }))).toBe('rejected'); // 目前角色
      expect(await code(b.call('character.select', { id: c2.id }))).toBe('not_found');
      expect(await code(b.call('character.delete', { id: c2.id }))).toBe('not_found');
      await a.call('character.select', { id: c2.id });
      expect((await a.call('account.get', {})).activeCharacterId).toBe(c2.id);
      // A 有一件在拍賣所 → 不能刪；取消後可以
      const item = (await a.call('character.get', { id: A })).items.find((i) => i.location === 'bag')!;
      const { listing } = await a.call('market.list', { characterId: A, itemId: item.id, price: 500 });
      expect(await code(a.call('character.delete', { id: A }))).toBe('rejected');
      await a.call('market.cancel', { characterId: A, listingId: listing.id });
      const acc = await a.call('character.delete', { id: A });
      expect(acc.activeCharacterId).toBe(c2.id);
      expect((await a.call('character.list', {})).map((c) => c.id)).toEqual([c2.id]);
      expect(await code(a.call('character.get', { id: A }))).toBe('not_found');
      // 刪掉的欄可以再建
      expect((await a.call('character.create', { name: '新劍士', weapon: 'sword' })).slot).toBe(0);
    });

    it('migrate.sync 只寫目前角色', async () => {
      const { a, A } = await setup(be);
      const c2 = await a.call('character.create', { name: '弓手', weapon: 'bow' });
      await a.call('character.select', { id: c2.id });
      const synced = await a.call('migrate.sync', { snapshot: { jg_weapon: 'bow', jg_rt_mistwood: JSON.stringify({ level: 3, coin: 40 }) } });
      expect(synced.id).toBe(c2.id);
      expect(synced.level).toBe(3);
      expect(synced.wallet.coin).toBe(40);
      const first = await a.call('character.get', { id: A });
      expect(first.level).toBe(12);
      expect(first.items.length).toBeGreaterThan(0);
    });

    it('倉庫：放進去 → 另一個角色拿出來；穿著的不能放；別的帳號拿不到；滿了拒絕；匯出入帶倉庫', async () => {
      const { a, b, A } = await setup(be);
      const B = (await b.call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).characterId;
      const c2 = await a.call('character.create', { name: '弓手', weapon: 'bow' });
      const me = await a.call('character.get', { id: A });
      const bagItem = me.items.find((i) => i.location === 'bag')!;
      const worn = me.items.find((i) => i.location.startsWith('equip:'))!;
      expect(await code(a.call('warehouse.put', { characterId: A, itemId: worn.id }))).toBe('not_found');
      expect(await code(a.call('warehouse.put', { characterId: c2.id, itemId: bagItem.id }))).toBe('not_found'); // 不是 c2 的
      expect(await code(b.call('warehouse.put', { characterId: B, itemId: bagItem.id }))).toBe('not_found');
      const r = await a.call('warehouse.put', { characterId: A, itemId: bagItem.id });
      expect(r.warehouse.items.map((i) => i.id)).toEqual([bagItem.id]);
      expect(r.character.items.some((i) => i.id === bagItem.id)).toBe(false);
      expect((await b.call('warehouse.get', {})).items).toEqual([]);
      expect(await code(b.call('warehouse.take', { characterId: B, itemId: bagItem.id }))).toBe('not_found');
      // 倉庫裡的不能拿去拍賣
      expect(await code(a.call('market.list', { characterId: A, itemId: bagItem.id, price: 100 }))).toBe('not_found');
      // 匯出 → 匯入：倉庫還在
      const blob = await a.call('account.export', {});
      await a.call('account.import', { blob });
      expect((await a.call('warehouse.get', {})).items.map((i) => i.gear.uid)).toEqual([bagItem.gear.uid]);
      const chars = await a.call('character.list', {});
      const archer = chars.find((c) => c.name === '弓手')!;
      const whId = (await a.call('warehouse.get', {})).items[0]!.id;
      const t = await a.call('warehouse.take', { characterId: archer.id, itemId: whId });
      expect(t.warehouse.items).toEqual([]);
      expect(t.character.items.find((i) => i.id === whId)).toMatchObject({ location: 'bag', pos: 0 });
      // 拿出來之後重送同一個 requestId 不會再動（冪等由 GameServer 處理）；再拿一次是 not_found
      expect(await code(a.call('warehouse.take', { characterId: archer.id, itemId: whId }))).toBe('not_found');
      expect(WAREHOUSE_MAX).toBe(40);
    });

    it('倉庫滿 40 格就拒絕', async () => {
      const { a } = await setup(be);
      const many: Record<string, unknown>[] = Array.from({ length: 41 }, (_, i) => ({ uid: `w${i}`, slot: 'ring', rarity: 1, ilvl: 1, name: '銅戒', base: { atk: 1 }, affixes: [] }));
      await a.call('migrate.sync', { snapshot: { jg_rt_mistwood: JSON.stringify({ bag: many }) } });
      const me = await a.call('character.list', {});
      const items = me[0]!.items.filter((i) => i.location === 'bag');
      expect(items.length).toBe(41);
      for (const it of items.slice(0, 40)) await a.call('warehouse.put', { characterId: me[0]!.id, itemId: it.id });
      expect(await code(a.call('warehouse.put', { characterId: me[0]!.id, itemId: items[40]!.id }))).toBe('rejected');
      expect((await a.call('warehouse.get', {})).items.map((i) => i.pos)).toEqual(Array.from({ length: 40 }, (_, i) => i));
    }, 60_000);
  });

for (const be of BACKENDS)
  describe(`換角色的舊 key 快照（${be.name}）`, () => {
    it('migrate.pull：遷移的角色轉回舊 key → 再 sync 一次完全不變（來回不掉資料）；新角色是 1 級空手', async () => {
      const { a, A } = await setup(be);
      const before = await a.call('character.get', { id: A });
      const { characterId, snapshot } = await a.call('migrate.pull', {});
      expect(characterId).toBe(A);
      expect(snapshot.jg_weapon).toBe('bow');
      expect(snapshot.jg_memories).toBe(LEGACY_SAMPLE.jg_memories);
      expect(snapshot.jg_prologue_seen).toBeUndefined(); // 裝置 key 不跟角色走
      const after = await a.call('migrate.sync', { snapshot: { ...snapshot, jg_prologue_seen: '1' } });
      expect(after).toEqual(before);
      // 換到新角色
      const c2 = await a.call('character.create', { name: '弓手', weapon: 'staff' });
      await a.call('character.select', { id: c2.id });
      const p2 = await a.call('migrate.pull', {});
      expect(p2.characterId).toBe(c2.id);
      expect(p2.snapshot.jg_weapon).toBe('staff');
      expect(JSON.parse(p2.snapshot.jg_rt_mistwood!)).toMatchObject({ level: 1, xp: 0, bag: [], equip: {} });
      // 換回來，原本的角色資料還在
      await a.call('character.select', { id: A });
      expect((await a.call('migrate.pull', {})).snapshot).toEqual(snapshot);
    });
  });
