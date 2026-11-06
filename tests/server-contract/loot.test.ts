// PvE 掉落由伺服器擲（第 146 輪，D-307，26-security §3.1）的契約測試：每種資料庫都跑。
// 重點：掉落直接入帳（客戶端不送數量）；killSeq 遞增不重複；速度上限；這張圖沒有的怪／群組被拒；別人的角色、別場的 battleId 碰不到；
// Boss 第一次保底稀有、之後記在地圖進度；行囊滿了照單機規則自動分解。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { ApiError } from '../../src/net/protocol';
import { LocalTransport } from '../../src/net/LocalTransport';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import { KILL_BURST, KILLS_PER_MIN, PVE_BATTLE_TTL } from '../../src/server/handlers/loot';
import { BAG_MAX } from '../../src/core/meta/bag';
import { hasLoot, killXp } from '../../src/core/battle/rt/loot';
import { stageDef } from '../../src/core/battle/rt/maps/world';
import { BOUNTY_ALIAS, BOUNTY_POOL, cleanBounties } from '../../src/core/meta/bounty';
import { xpToNext } from '../../src/core/battle/rt/engine';
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

async function setup(be: (typeof BACKENDS)[number], rng = () => 0.3) {
  const { db } = await be.fresh(() => 0);
  const clock = new FakeClock();
  const server = new GameServer({ db, auth, clock, ids: new SeqIds(), local: true, rng });
  let n = 0;
  const mk = (tok: string) => new GameClient(new LocalTransport((j) => server.handle(j)), { token: tok, timeoutMs: 15000, retries: 1, newRequestId: () => `${tok}${++n}` });
  const a = mk('accA');
  const b = mk('accB');
  return { a, b, clock };
}

for (const be of BACKENDS)
  describe(`PvE 掉落（${be.name}）`, () => {
    it('打倒狼：伺服器擲、直接入錢包；同一隻不能領兩次；別人的、別場的碰不到', async () => {
      const { a, b, clock } = await setup(be);
      const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      const before = (await a.call('character.get', { id: characterId })).wallet;
      const { battleId } = await a.call('battle.start', { characterId, stageId: 'mistwood' });
      clock.advance(5000);
      const r = await a.call('loot.claim', { characterId, battleId, killSeq: 1, enemyId: 'wolf', groupId: 'entry' });
      const gold = r.drops.filter((d) => d.kind === 'gold').reduce((x, d) => x + d.amount, 0);
      expect(gold).toBeGreaterThan(0);
      expect(r.character.wallet.coin).toBe(before.coin + gold);
      // 經驗也是伺服器給的（同一份 killXp 規則）
      expect(r.xp).toBe(killXp({ stageId: 'mistwood', defId: 'wolf', groupId: 'entry' }));
      expect(r.xp).toBeGreaterThan(0);
      // 重送同一個 killSeq（或更小）＝衝突
      expect(await code(a.call('loot.claim', { characterId, battleId, killSeq: 1, enemyId: 'wolf', groupId: 'entry' }))).toBe('conflict');
      // 別人的角色／別場
      expect(await code(b.call('loot.claim', { characterId, battleId, killSeq: 2, enemyId: 'wolf', groupId: 'entry' }))).toBe('not_found');
      expect(await code(a.call('loot.claim', { characterId, battleId: 'pve_nope', killSeq: 2, enemyId: 'wolf', groupId: 'entry' }))).toBe('not_found');
      // 重開一場，舊的作廢
      const again = await a.call('battle.start', { characterId, stageId: 'mistwood' });
      expect(await code(a.call('loot.claim', { characterId, battleId, killSeq: 5, enemyId: 'wolf', groupId: 'entry' }))).toBe('not_found');
      expect(await code(a.call('loot.claim', { characterId, battleId: again.battleId, killSeq: 1, enemyId: 'wolf', groupId: 'entry' }))).toBe('ok');
      // 過期
      clock.advance(PVE_BATTLE_TTL + 1);
      expect(await code(a.call('loot.claim', { characterId, battleId: again.battleId, killSeq: 2, enemyId: 'wolf', groupId: 'entry' }))).toBe('not_found');
    });

    it('這張圖沒有的怪、群組不對、深夜限定群組、沒開深夜／沒暴怒的關卡都拒絕；參數型別不對是 bad_request', async () => {
      const { a } = await setup(be);
      const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      const { battleId } = await a.call('battle.start', { characterId, stageId: 'mistwood' });
      let k = 0;
      const claim = (x: Record<string, unknown>) => code(a.call('loot.claim', { characterId, battleId, killSeq: ++k, enemyId: 'wolf', ...x } as never));
      expect(await claim({ enemyId: 'thorn_queen' })).toBe('rejected'); // 別張圖的 Boss
      expect(await claim({ groupId: 'elite' })).toBe('rejected'); // elite 群是頭狼
      expect(await claim({ enemyId: 'shade_wolf', groupId: 'night_shade' })).toBe('rejected'); // 這場不是深夜
      expect(await claim({ fixedIdx: 0 })).toBe('rejected'); // 固定怪 0 是狼王
      expect(await claim({ groupId: 'entry', fury: true })).toBe('rejected'); // 小怪沒有暴怒
      expect(await claim({ enemyId: 'nope_enemy' })).toBe('rejected');
      expect(await claim({ killSeq: 0 })).toBe('bad_request');
      expect(await claim({ killSeq: 1.5 })).toBe('bad_request');
      expect(await claim({ fury: 'yes' })).toBe('bad_request');
      expect(await claim({ fixedIdx: -1 })).toBe('bad_request');
      expect(await claim({ groupId: 'x'.repeat(100) })).toBe('bad_request');
      expect(await code(a.call('battle.start', { characterId, stageId: 'pvp_arena' }))).toBe('rejected'); // 沒有掉落的場地
      expect(await code(a.call('battle.start', { characterId, stageId: 'nope' }))).toBe('rejected');
      // 深夜開的那場就可以領深夜群組
      const night = await a.call('battle.start', { characterId, stageId: 'mistwood', night: true });
      expect(await code(a.call('loot.claim', { characterId, battleId: night.battleId, killSeq: 1, enemyId: 'shade_wolf', groupId: 'night_shade' }))).toBe('ok');
    });

    it('經驗滿了就升級（一次可能連升，規則跟引擎一樣）', async () => {
      const { a } = await setup(be);
      const low = { ...LEGACY_SAMPLE, jg_rt_mistwood: JSON.stringify({ ...JSON.parse(LEGACY_SAMPLE.jg_rt_mistwood!), level: 1, xp: 39 }) };
      const { characterId } = await a.call('migrate.legacy', { snapshot: low });
      const { battleId } = await a.call('battle.start', { characterId, stageId: 'mistwood' });
      const r = await a.call('loot.claim', { characterId, battleId, killSeq: 1, enemyId: 'wolf', groupId: 'entry' });
      expect(r.character.level).toBe(2);
      expect(r.character.xp).toBe(39 + r.xp - xpToNext(1));
    });

    it('還沒開放的地圖、還沒解鎖的深夜不能開；暴怒 Boss 記暴怒討伐（解鎖深夜）', async () => {
      const { a } = await setup(be);
      const fresh = { ...LEGACY_SAMPLE, jg_rt_mistwood: JSON.stringify({ ...JSON.parse(LEGACY_SAMPLE.jg_rt_mistwood!), bossKills: 0, furyKills: 0 }), jg_rt_thornvale: '{}' };
      const { characterId } = await a.call('migrate.legacy', { snapshot: fresh });
      expect(await code(a.call('battle.start', { characterId, stageId: 'thornvale' }))).toBe('rejected');
      expect(await code(a.call('battle.start', { characterId, stageId: 'mistwood', night: true }))).toBe('rejected');
      const { battleId } = await a.call('battle.start', { characterId, stageId: 'mistwood' });
      // 還沒打倒過狼王：暴怒還沒解鎖
      expect(await code(a.call('loot.claim', { characterId, battleId, killSeq: 1, enemyId: 'wolf_king', fixedIdx: 0, fury: true }))).toBe('rejected');
      await a.call('loot.claim', { characterId, battleId, killSeq: 2, enemyId: 'wolf_king', fixedIdx: 0 });
      const r = await a.call('loot.claim', { characterId, battleId, killSeq: 3, enemyId: 'wolf_king', fixedIdx: 0, fury: true });
      expect(r.character.maps.mistwood).toMatchObject({ bossKills: 2, furyKills: 1 });
      expect(await code(a.call('battle.start', { characterId, stageId: 'thornvale' }))).toBe('ok');
      expect(await code(a.call('battle.start', { characterId, stageId: 'emberrift' }))).toBe('rejected');
      expect(await code(a.call('battle.start', { characterId, stageId: 'mistwood', night: true }))).toBe('ok');
    });

    it('懸賞（第 147 輪）：伺服器計數，完成時獎勵入錢包、補一張新的；其他怪不動懸賞', async () => {
      const { a, clock } = await setup(be);
      const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      const me = await a.call('character.get', { id: characterId });
      const st = cleanBounties(me.bounty);
      const wolf = st.list.find((x) => x.target === 'wolf');
      expect(wolf).toBeDefined();
      const left = wolf!.need - wolf!.got;
      const { battleId } = await a.call('battle.start', { characterId, stageId: 'mistwood' });
      let seq = 0;
      let last: Awaited<ReturnType<typeof a.call<'loot.claim'>>> | null = null;
      let dustLoot = 0;
      for (let i = 0; i < left; i++) {
        clock.advance(3000);
        last = await a.call('loot.claim', { characterId, battleId, killSeq: ++seq, enemyId: 'wolf', groupId: 'entry' });
        dustLoot += last.drops.filter((d) => d.kind === 'dust').reduce((x, d) => x + d.amount, 0) + last.drops.reduce((x, d) => x + (d.salvaged ?? 0), 0);
        if (i < left - 1) expect(last.bounty).toEqual([]);
      }
      expect(last!.bounty).toEqual([{ target: 'wolf', need: wolf!.need, reward: wolf!.reward }]);
      expect(last!.character.wallet.dust).toBe(me.wallet.dust + dustLoot + wolf!.reward.dust);
      const after = cleanBounties(last!.character.bounty);
      expect(after.done).toBe(st.done + 1);
      expect(after.list.length).toBe(3);
      expect(after.list.some((x) => x.n === wolf!.n)).toBe(false);
    });

    it('寶箱（第 147 輪）：內容照地圖資料、白天的每個角色一次、夜光的每場一次；沒有的寶箱、白天開夜光、別人的都拒絕', async () => {
      const { a, b } = await setup(be);
      const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      const me = await a.call('character.get', { id: characterId });
      const chests = stageDef('mistwood')!.chests!;
      const day = chests.find((c) => !c.nightOnly && !(me.maps.mistwood?.chests ?? []).includes(c.id) && c.loot.gold)!;
      const night = chests.find((c) => c.nightOnly)!;
      expect(day).toBeDefined();
      let { battleId } = await a.call('battle.start', { characterId, stageId: 'mistwood' });
      const r = await a.call('loot.chest', { characterId, battleId, chestId: day.id });
      expect(r).toMatchObject({ coin: day.loot.gold ?? 0, dust: day.loot.dust ?? 0, crystal: day.loot.crystal ?? 0 });
      expect(r.character.wallet.coin).toBe(me.wallet.coin + (day.loot.gold ?? 0));
      expect(r.character.maps.mistwood?.chests).toContain(day.id);
      expect(await code(a.call('loot.chest', { characterId, battleId, chestId: day.id }))).toBe('conflict');
      expect(await code(a.call('loot.chest', { characterId, battleId, chestId: 'nope' }))).toBe('rejected');
      expect(await code(a.call('loot.chest', { characterId, battleId, chestId: night.id }))).toBe('rejected');
      expect(await code(b.call('loot.chest', { characterId, battleId, chestId: night.id }))).toBe('not_found');
      // 重開一場：白天的還是開過了
      battleId = (await a.call('battle.start', { characterId, stageId: 'mistwood' })).battleId;
      expect(await code(a.call('loot.chest', { characterId, battleId, chestId: day.id }))).toBe('conflict');
      // 深夜：夜光寶箱每場一次，下一場又是滿的
      battleId = (await a.call('battle.start', { characterId, stageId: 'mistwood', night: true })).battleId;
      expect(await code(a.call('loot.chest', { characterId, battleId, chestId: night.id }))).toBe('ok');
      expect(await code(a.call('loot.chest', { characterId, battleId, chestId: night.id }))).toBe('conflict');
      battleId = (await a.call('battle.start', { characterId, stageId: 'mistwood', night: true })).battleId;
      expect(await code(a.call('loot.chest', { characterId, battleId, chestId: night.id }))).toBe('ok');
    });

    it('懸賞目標（含別名）都是會掉東西的怪：客戶端只回報 hasLoot 的，懸賞才數得到', () => {
      for (const id of [...BOUNTY_POOL.map((p) => p.target), ...Object.keys(BOUNTY_ALIAS)]) expect(hasLoot(id), id).toBe(true);
    });

    it('速度上限：開場 KILL_BURST 隻，之後每分鐘 KILLS_PER_MIN 隻', async () => {
      const { a, clock } = await setup(be);
      const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      const { battleId } = await a.call('battle.start', { characterId, stageId: 'mistwood' });
      let k = 0;
      const claim = () => code(a.call('loot.claim', { characterId, battleId, killSeq: ++k, enemyId: 'wolf', groupId: 'entry' }));
      for (let i = 0; i < KILL_BURST; i++) expect(await claim()).toBe('ok');
      expect(await claim()).toBe('rate_limited');
      clock.advance(60_000 / KILLS_PER_MIN);
      expect(await claim()).toBe('ok');
      expect(await claim()).toBe('rate_limited');
    });

    it('狼王：第一次保底一件稀有、記在地圖進度；之後照權重', async () => {
      const { a } = await setup(be, () => 0.99);
      const fresh = { ...LEGACY_SAMPLE, jg_rt_mistwood: JSON.stringify({ ...JSON.parse(LEGACY_SAMPLE.jg_rt_mistwood!), bossKills: 0, bag: [] }) };
      const { characterId } = await a.call('migrate.legacy', { snapshot: fresh });
      const { battleId } = await a.call('battle.start', { characterId, stageId: 'mistwood' });
      const r = await a.call('loot.claim', { characterId, battleId, killSeq: 1, enemyId: 'wolf_king', fixedIdx: 0 });
      const gear = r.drops.filter((d) => d.kind === 'gear');
      expect(gear.length).toBe(2);
      expect(gear[0]!.rarity).toBe(3);
      expect(r.character.maps.mistwood?.bossKills).toBe(1);
      for (const g of gear) expect(r.character.items.some((i) => i.id === g.itemId && i.location === 'bag')).toBe(true);
    });

    it('行囊滿了：照單機規則（分解最差的普通裝，或這件撿不起來），行囊不會超過上限', async () => {
      const { a } = await setup(be, () => 0.01);
      const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      // 塞滿行囊：亂數 0.01 → 狼每隻都掉一件普通裝（每場重開避開速度上限）
      let full = false;
      for (let i = 0; i < BAG_MAX + 2 && !full; i++) {
        const { battleId } = await a.call('battle.start', { characterId, stageId: 'mistwood' });
        const r = await a.call('loot.claim', { characterId, battleId, killSeq: 1, enemyId: 'wolf', groupId: 'entry' });
        expect(r.drops.some((d) => d.kind === 'gear' && d.rarity === 1)).toBe(true);
        // 比身上好的（▲）不分解：可能分解別件（salvaged），也可能這件撿不起來（full）
        full = r.drops.some((d) => d.salvaged !== undefined || d.full === true);
        const me = r.character;
        expect(me.items.filter((x) => x.location === 'bag').length).toBeLessThanOrEqual(BAG_MAX);
        if (full) {
          for (const d of r.drops) if (d.salvaged !== undefined) expect(d.salvaged).toBeGreaterThan(0);
          for (const d of r.drops) if (d.full) expect(d.itemId).toBeUndefined();
        }
      }
      expect(full).toBe(true);
    });
  });
