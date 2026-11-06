// 燼牌下注（第 142 輪 V2，D-289）：賭注、種子、牌組、勝負、獎金、獎勵牌全部伺服器決定（26-security §2）。
// 客戶端只送「跟誰下注」和「我出了哪些牌」；伺服器用自己的種子重跑整場（對手 AI 也在伺服器跑），出不了假。
// 獎勵牌在開局時照當時的收藏決定（打完時客戶端可能已經先把牌收進收藏）。
// 中途離開＝認輸（和第一期一樣，賭注不退）；重開一局就把沒打完的那局作廢。
import { canChallenge, cleanMoves, matchDeck, parseCardStats, payout, prizeOf, replayMatch } from '../../core/meta/cards';
import { opponent } from '../../core/cards/emberCards';
import { ApiError } from '../../net/protocol';
import type { HandlerTable } from '../router';
import { ownCharacter } from './common';
import { freshView, idParam } from './inv';

export const cardsHandlers: Pick<HandlerTable, 'cards.start' | 'cards.finish'> = {
  'cards.start': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const st = parseCardStats(c.story.jg_cards);
    const who = canChallenge(st, idParam(p?.opponentId, 'opponentId'));
    if (!who) throw new ApiError('rejected', 'opponent');
    const id = ctx.ids.next('cm');
    await ctx.r.wallets.apply(c.id, 'coin', -who.stake, 'cards.stake', id);
    const seed = Math.floor(ctx.rng() * 4294967296) >>> 0;
    const deck = matchDeck(st);
    await ctx.r.characters.save({ ...c, cardMatch: { id, opponentId: who.id, seed, deck, stake: who.stake, prize: prizeOf(st, who, 0), at: ctx.clock.now() } });
    return { matchId: id, seed, deck, character: await freshView(ctx, c.id) };
  },

  'cards.finish': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const mid = idParam(p?.matchId, 'matchId');
    const moves = cleanMoves(p?.moves);
    if (!moves) throw new ApiError('bad_request', 'moves');
    const m = c.cardMatch;
    if (!m || m.id !== mid) throw new ApiError('not_found', 'match');
    const who = opponent(m.opponentId);
    const g = replayMatch(m.seed, m.deck, who, moves);
    // 紀錄不合法（出了不能出的牌、沒打完）：整筆拒絕，對局留著（之後重開一局就作廢）
    if (!g) throw new ApiError('rejected', 'moves');
    const winner = g.winner ?? -1;
    const coin = payout(m.stake, winner);
    const prize = winner === 0 ? (m.prize ?? null) : null;
    const { cardMatch: _done, ...rest } = c;
    await ctx.r.characters.save(rest);
    if (coin) await ctx.r.wallets.apply(c.id, 'coin', coin, 'cards.payout', m.id);
    return { winner, payout: coin, prize, character: await freshView(ctx, c.id) };
  },
};
