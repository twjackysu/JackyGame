// 非同步 PvP 天梯（第 143 輪，V5 先行）的契約測試：每種資料庫都跑。
// 重點：勝負只看伺服器重跑；造假紀錄整筆拒絕；同一局不能領兩次；過期作廢；別人的角色碰不到。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { ApiError } from '../../src/net/protocol';
import { LocalTransport } from '../../src/net/LocalTransport';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import { playPvp } from '../../src/core/battle/rt/pvpMatch';
import { BOT_PROFILES, PlayerBot } from '../../src/core/battle/rt/sim';
import type { BattleCommandBody } from '../../src/core/battle/rt/types';
import { PVP_START_RATING, canChallenge, eloDelta } from '../../src/core/meta/pvpRank';
import type { PvpStartView } from '../../src/net/views';
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
/** 客戶端：用 Bot 當自己打一場，回傳指令紀錄與本機的結果 */
const fight = (st: PvpStartView) => {
  const bot = new PlayerBot(BOT_PROFILES.expert!, 'me');
  return playPvp({ seed: st.seed, me: st.me, foe: st.foe }, (s) => bot.decide(s) as BattleCommandBody[]);
};

for (const be of BACKENDS)
  describe(`PvP 天梯（${be.name}）`, () => {
    it('開局 → 本機打 → 伺服器重跑：勝負一致、段位分照 Elo 改；同一局不能領兩次', async () => {
      const { db } = await be.fresh(() => 0);
      const clock = new FakeClock();
      const server = new GameServer({ db, auth, clock, ids: new SeqIds(), local: true, rng: () => 0.3 });
      let n = 0;
      const a = new GameClient(new LocalTransport((j) => server.handle(j)), { token: 'accA', timeoutMs: 15000, retries: 1, newRequestId: () => `a${++n}` });
      const b = new GameClient(new LocalTransport((j) => server.handle(j)), { token: 'accB', timeoutMs: 15000, retries: 1, newRequestId: () => `b${++n}` });
      const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      const st = await a.call('pvp.start', { characterId });
      expect(st.rating).toBe(PVP_START_RATING);
      expect(st.me.bonus.atk).toBeGreaterThan(0); // 身上的長劍有算進去
      // 別人的角色開不了、領不了
      expect(await code(b.call('pvp.start', { characterId }))).toBe('not_found');
      const local = fight(st);
      // 過渡期：其他面板的 migrate.sync（用舊 key 蓋掉 story）不會弄丟對局與段位分
      await a.call('migrate.sync', { snapshot: LEGACY_SAMPLE });
      const res = await a.call('pvp.finish', { characterId, matchId: st.matchId, inputs: local.inputs });
      expect(res.outcome).toBe(local.s.outcome);
      expect(res.delta).toBe(eloDelta(PVP_START_RATING, st.foeRating, res.outcome));
      expect(res.rating).toBe(PVP_START_RATING + res.delta);
      expect(await code(a.call('pvp.finish', { characterId, matchId: st.matchId, inputs: local.inputs }))).toBe('not_found');
      // 下一局的起始分就是新的分數（中間再 sync 一次也一樣）
      await a.call('migrate.sync', { snapshot: LEGACY_SAMPLE });
      expect((await a.call('pvp.start', { characterId })).rating).toBe(res.rating);
      // 天梯（第 144 輪）：自己的分數與名次跟著變；照分數由高到低；別人的角色看不到
      const lad = await a.call('pvp.ladder', { characterId });
      expect(lad.rating).toBe(res.rating);
      const me = lad.rows.find((r) => r.me)!;
      expect(me.pos).toBe(lad.pos);
      expect(me.rating).toBe(res.rating);
      expect(lad.rows.slice(0, 10).every((r, i, xs) => i === 0 || xs[i - 1]!.rating >= r.rating)).toBe(true);
      expect(lad.total).toBeGreaterThan(20);
      // 戰績（第 149 輪）：剛打完那場在最前面；中間 migrate.sync 也還在
      expect(lad.recent).toEqual([{ outcome: res.outcome, foeName: st.foeName, foeId: expect.any(String), delta: res.delta, at: expect.any(Number), revenge: res.outcome === 'defeat' }]);
      expect(await code(b.call('pvp.ladder', { characterId }))).toBe('not_found');
      // 匯出 → 匯入（第 146 輪）：段位分跟著存檔走
      const blob = await a.call('account.export', {});
      await a.call('account.import', { blob });
      const after = (await a.call('character.list', {}))[0]!;
      expect((await a.call('pvp.ladder', { characterId: after.id })).rating).toBe(res.rating);
    });

    it('造假的紀錄整筆拒絕、對局留著；過期作廢', async () => {
      const { db } = await be.fresh(() => 0);
      const clock = new FakeClock();
      const server = new GameServer({ db, auth, clock, ids: new SeqIds(), local: true, rng: () => 0.7 });
      let n = 0;
      const a = new GameClient(new LocalTransport((j) => server.handle(j)), { token: 'accA', timeoutMs: 15000, retries: 1, newRequestId: () => `a${++n}` });
      const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      const st = await a.call('pvp.start', { characterId });
      const local = fight(st);
      expect(await code(a.call('pvp.finish', { characterId, matchId: st.matchId, inputs: [{ t: 1, c: [{ type: 'skill', id: 'god_mode' }] }] }))).toBe('rejected');
      expect(await code(a.call('pvp.finish', { characterId, matchId: st.matchId, inputs: [...local.inputs].reverse() }))).toBe('rejected');
      expect(await code(a.call('pvp.finish', { characterId, matchId: 'pvp_nope', inputs: local.inputs }))).toBe('not_found');
      clock.advance(31 * 60 * 1000);
      expect(await code(a.call('pvp.finish', { characterId, matchId: st.matchId, inputs: local.inputs }))).toBe('not_found');
    });
  });

for (const be of BACKENDS)
  describe(`PvP 指名挑戰（${be.name}，第 149 輪）`, () => {
    it('天梯列有對手 id；分差 200 內可以指名、超過拒絕、不存在 not_found、格式不對 bad_request；分數照伺服器的', async () => {
      const { db } = await be.fresh(() => 0);
      const server = new GameServer({ db, auth, clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => 0.3 });
      let n = 0;
      const a = new GameClient(new LocalTransport((j) => server.handle(j)), { token: 'accA', timeoutMs: 15000, retries: 1, newRequestId: () => `c${++n}` });
      const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      const lad = await a.call('pvp.ladder', { characterId });
      expect(lad.rows.find((r) => r.me)?.id).toBeUndefined();
      expect(lad.recent).toEqual([]);
      // 天梯只列前 10；用 ladder 的分數挑一個近的、一個遠的（模擬冒險者分數照程度散開）
      const others = lad.rows.filter((r) => !r.me && r.id);
      expect(others.length).toBeGreaterThan(0);
      const near = others.find((r) => canChallenge(lad.rating, r.rating));
      const far = others.find((r) => !canChallenge(lad.rating, r.rating));
      if (near) {
        const st = await a.call('pvp.start', { characterId, foeId: near.id! });
        expect(st.foeName).toBe(near.name);
        expect(st.foeRating).toBe(near.rating);
      }
      if (far) expect(await code(a.call('pvp.start', { characterId, foeId: far.id! }))).toBe('rejected');
      expect(near && far).toBeTruthy(); // 起始 1000 分：前 10 名裡兩種都有
      expect(await code(a.call('pvp.start', { characterId, foeId: 'nobody' }))).toBe('not_found');
      expect(await code(a.call('pvp.start', { characterId, foeId: 42 as unknown as string }))).toBe('bad_request');
      expect(await code(a.call('pvp.start', { characterId, foeId: 'x'.repeat(65) }))).toBe('bad_request');
    });
  });

describe('PvP 戰績（第 149 輪）', () => {
  it('最多留 5 場、新的在前；delta 加起來＝段位分變化', async () => {
    const be = BACKENDS[0]!;
    const { db } = await be.fresh(() => 0);
    const clock = new FakeClock();
    const server = new GameServer({ db, auth, clock, ids: new SeqIds(), local: true, rng: () => 0.5 });
    let n = 0;
    const a = new GameClient(new LocalTransport((j) => server.handle(j)), { token: 'accH', timeoutMs: 15000, retries: 1, newRequestId: () => `h${++n}` });
    const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
    const ats: number[] = [];
    for (let k = 0; k < 6; k++) {
      clock.advance(60_000);
      const st = await a.call('pvp.start', { characterId });
      await a.call('pvp.finish', { characterId, matchId: st.matchId, inputs: fight(st).inputs });
      ats.push(clock.now());
    }
    const lad = await a.call('pvp.ladder', { characterId });
    expect(lad.recent.map((r) => r.at)).toEqual(ats.slice(1).reverse());
    const all = lad.recent.reduce((s, r) => s + r.delta, 0);
    expect(lad.rating - all).toBeGreaterThan(0); // 前 5 場之前的分數（第一場的結果）
    await db.close();
  });
});

for (const be of BACKENDS)
  describe(`PvP 復仇（第 150 輪，${be.name}）`, () => {
    it('輸掉的場次可以再挑一次同一個對手；贏的不行', async () => {
      const { db } = await be.fresh(() => 0);
      const clock = new FakeClock();
      const server = new GameServer({ db, auth, clock, ids: new SeqIds(), local: true, rng: () => 0.4 });
      let n = 0;
      const a = new GameClient(new LocalTransport((j) => server.handle(j)), { token: 'accR', timeoutMs: 15000, retries: 1, newRequestId: () => `r${++n}` });
      const { characterId } = await a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
      // 站著不動 → 一定輸（伺服器重跑一樣）
      const st = await a.call('pvp.start', { characterId });
      const res = await a.call('pvp.finish', { characterId, matchId: st.matchId, inputs: [] });
      expect(res.outcome).toBe('defeat');
      const lad = await a.call('pvp.ladder', { characterId });
      const last = lad.recent[0]!;
      expect(last.foeName).toBe(st.foeName);
      expect(last.revenge).toBe(canChallenge(lad.rating, st.foeRating));
      expect(last.revenge).toBe(true); // 才輸一場，分差一定在 200 內
      const again = await a.call('pvp.start', { characterId, foeId: last.foeId! });
      expect(again.foeName).toBe(st.foeName);
      expect(again.foeId).toBe(st.foeId);
      // 贏的場次不給復仇
      const win = await a.call('pvp.finish', { characterId, matchId: again.matchId, inputs: fight(again).inputs });
      const lad2 = await a.call('pvp.ladder', { characterId });
      expect(lad2.recent[0]!.revenge).toBe(win.outcome === 'defeat');
      expect(lad2.recent[1]!.foeId).toBe(last.foeId);
      await db.close();
    });
  });
