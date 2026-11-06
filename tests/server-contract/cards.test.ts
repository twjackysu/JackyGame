// 燼牌下注 handler 的契約測試（第 142 輪 V2，D-289）：每種資料庫實作都跑同一組。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../../src/client/GameClient';
import { ApiError } from '../../src/net/protocol';
import { LocalTransport } from '../../src/net/LocalTransport';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import type { Db } from '../../src/server/repos/types';
import { aiMove, applyMove, opponent, type Move } from '../../src/core/cards/emberCards';
import { matchDeck, parseCardStats, payout, replayMatch, startMatch } from '../../src/core/meta/cards';
import { BACKENDS } from './backends';
import { LEGACY_SAMPLE } from './fixtures';

const auth = { resolve: async (t?: string) => t ?? 'anon' };

function stack(db: Db, roll: { v: number }) {
  const server = new GameServer({ db, auth, clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => roll.v });
  let rid = 0;
  const mk = (token: string) => new GameClient(new LocalTransport((j) => server.handle(j)), { token, timeoutMs: 15000, retries: 1, newRequestId: () => `${token}-${++rid}` });
  return { a: mk('accA'), b: mk('accB') };
}

const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : `throw:${String(e)}`;
  }
};

/** 用電腦的出法幫玩家打完一整場，回傳出牌紀錄與結果 */
function botPlay(seed: number, deck: readonly string[], oppId: string): { moves: Move[]; winner: number } {
  const who = opponent(oppId);
  const g = startMatch(seed, deck, who);
  const moves: Move[] = [];
  while (!g.over) {
    if (g.turn === 1) applyMove(g, 1, aiMove(g, 1, who));
    else {
      const m = aiMove(g, 0, who);
      expect(applyMove(g, 0, m)).toBe(true);
      moves.push(m);
    }
  }
  return { moves, winner: g.winner ?? -1 };
}

/** 找一個讓電腦玩家贏／輸的擲骰值（種子＝v × 2^32） */
function rollFor(want: 0 | 1, deck: readonly string[]): number {
  for (let k = 1; k < 200; k++) {
    const v = k / 211;
    if (botPlay(Math.floor(v * 4294967296) >>> 0, deck, 'merchant').winner === want) return v;
  }
  throw new Error('no seed');
}

async function setup(db: Db, roll = { v: 0.5 }) {
  const s = stack(db, roll);
  const ra = await s.a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
  const rb = await s.b.call('migrate.legacy', { snapshot: LEGACY_SAMPLE });
  return { ...s, ca: await s.a.call('character.get', { id: ra.characterId }), cb: await s.b.call('character.get', { id: rb.characterId }), roll };
}

const DECK = matchDeck(parseCardStats(LEGACY_SAMPLE.jg_cards));

for (const be of BACKENDS)
  describe(`燼牌下注（${be.name}）`, () => {
    it('開局扣賭注、牌組照收藏；伺服器重播判勝負、贏了拿回兩倍＋獎勵牌', async () => {
      const { db } = await be.fresh(() => 0);
      const roll = { v: rollFor(0, DECK) };
      const { a, ca } = await setup(db, roll);
      const coin0 = ca.wallet.coin;
      const st = await a.call('cards.start', { characterId: ca.id, opponentId: 'merchant' });
      expect(st.character.wallet.coin).toBe(coin0 - opponent('merchant').stake);
      expect(st.deck).toEqual(DECK);
      expect(st.seed).toBe(Math.floor(roll.v * 4294967296) >>> 0);
      const bot = botPlay(st.seed, st.deck, 'merchant');
      expect(bot.winner).toBe(0);
      const fin = await a.call('cards.finish', { characterId: ca.id, matchId: st.matchId, moves: bot.moves });
      expect(fin.winner).toBe(0);
      expect(fin.payout).toBe(payout(40, 0));
      expect(fin.prize).toBe(opponent('merchant').rewards.find((r) => !parseCardStats(LEGACY_SAMPLE.jg_cards).cards.includes(r)) ?? null);
      expect(fin.character.wallet.coin).toBe(coin0 + 40);
      // 同一局不能領兩次
      expect(await code(a.call('cards.finish', { characterId: ca.id, matchId: st.matchId, moves: bot.moves }))).toBe('not_found');
      await db.close();
    });

    it('輸了不退；造假的紀錄（少出、亂出、多出）整筆拒絕', async () => {
      const { db } = await be.fresh(() => 0);
      const roll = { v: rollFor(1, DECK) };
      const { a, ca } = await setup(db, roll);
      const st = await a.call('cards.start', { characterId: ca.id, opponentId: 'merchant' });
      const bot = botPlay(st.seed, st.deck, 'merchant');
      expect(replayMatch(st.seed, st.deck, opponent('merchant'), bot.moves)?.winner).toBe(1);
      const coin1 = st.character.wallet.coin;
      expect(await code(a.call('cards.finish', { characterId: ca.id, matchId: st.matchId, moves: bot.moves.slice(0, 3) }))).toBe('rejected');
      expect(await code(a.call('cards.finish', { characterId: ca.id, matchId: st.matchId, moves: [...bot.moves, { type: 'pass' }] }))).toBe('rejected');
      expect(await code(a.call('cards.finish', { characterId: ca.id, matchId: st.matchId, moves: [{ type: 'play', card: 39 }] }))).toBe('rejected');
      expect((await a.call('character.get', { id: ca.id })).wallet.coin).toBe(coin1);
      const fin = await a.call('cards.finish', { characterId: ca.id, matchId: st.matchId, moves: bot.moves });
      expect(fin).toMatchObject({ winner: 1, payout: 0, prize: null });
      expect(fin.character.wallet.coin).toBe(coin1);
      await db.close();
    });

    it('重開一局：上一局作廢（賭注不退）；別人的角色、隱藏對手、不認識的對手、錢不夠都拒絕', async () => {
      const { db } = await be.fresh(() => 0);
      const { a, b, ca, cb } = await setup(db);
      const s1 = await a.call('cards.start', { characterId: ca.id, opponentId: 'merchant' });
      const s2 = await a.call('cards.start', { characterId: ca.id, opponentId: 'merchant' });
      expect(s2.character.wallet.coin).toBe(ca.wallet.coin - 80);
      const bot = botPlay(s1.seed, s1.deck, 'merchant');
      expect(await code(a.call('cards.finish', { characterId: ca.id, matchId: s1.matchId, moves: bot.moves }))).toBe('not_found');
      expect(await code(b.call('cards.start', { characterId: ca.id, opponentId: 'merchant' }))).toBe('not_found');
      expect(await code(b.call('cards.finish', { characterId: ca.id, matchId: s2.matchId, moves: [] }))).toBe('not_found');
      expect(await code(a.call('cards.start', { characterId: ca.id, opponentId: 'ida' }))).toBe('rejected');
      expect(await code(a.call('cards.start', { characterId: ca.id, opponentId: 'nobody' }))).toBe('rejected');
      // 錢不夠：b 一直下注到付不起
      let left = cb.wallet.coin;
      while (left >= 40) left = (await b.call('cards.start', { characterId: cb.id, opponentId: 'merchant' })).character.wallet.coin;
      expect(await code(b.call('cards.start', { characterId: cb.id, opponentId: 'merchant' }))).toBe('rejected');
      expect((await b.call('character.get', { id: cb.id })).wallet.coin).toBe(left);
      await db.close();
    });
  });
