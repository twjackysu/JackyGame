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
import { PVP_START_RATING, eloDelta } from '../../src/core/meta/pvpRank';
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
