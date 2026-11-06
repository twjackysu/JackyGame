// core/meta/cards.ts（D-289）：戰績解析、隱藏對手、整場重播和畫面一樣
import { describe, expect, it } from 'vitest';
import { aiMove, applyMove, OPPONENTS, type Move } from '../src/core/cards/emberCards';
import { canChallenge, cleanMoves, matchDeck, parseCardStats, payout, prizeOf, replayMatch, secretOpen, startMatch } from '../src/core/meta/cards';

describe('core/meta/cards', () => {
  it('壞掉的 jg_cards 當成空的；未知的牌丟掉、負數當 0', () => {
    expect(parseCardStats('{oops').played).toBe(0);
    const st = parseCardStats(JSON.stringify({ played: -3, won: 2.7, cards: ['mage', 'nope', 3], off: ['militia'], by: { merchant: { played: 4, won: 'x' } } }));
    expect(st).toMatchObject({ played: 0, won: 2, cards: ['mage'], off: ['militia'] });
    expect(st.by.merchant).toEqual({ played: 4, won: 0 });
  });

  it('隱藏對手要三家主線都贏過', () => {
    const st = parseCardStats(null);
    expect(canChallenge(st, 'ida')).toBeNull();
    expect(canChallenge(st, 'merchant')?.id).toBe('merchant');
    for (const o of OPPONENTS) if (!o.secret && !o.extra) st.by[o.id] = { played: 1, won: 1 };
    expect(secretOpen(st)).toBe(true);
    expect(canChallenge(st, 'ida')?.id).toBe('ida');
  });

  it('同一個種子：畫面一步一步打和伺服器整場重播結果一樣（每位對手 30 局）', () => {
    const deck = matchDeck(parseCardStats(JSON.stringify({ cards: ['mage', 'owl', 'ballista'] })));
    for (const who of OPPONENTS)
      for (let s = 1; s <= 30; s++) {
        const seed = (s * 2654435761) >>> 0;
        const g = startMatch(seed, deck, who);
        const moves: Move[] = [];
        while (!g.over) {
          if (g.turn === 1) applyMove(g, 1, aiMove(g, 1, who));
          else {
            const m = aiMove(g, 0, who);
            applyMove(g, 0, m);
            moves.push(m);
          }
        }
        const r = replayMatch(seed, deck, who, moves);
        expect(r?.winner).toBe(g.winner);
        expect(r?.results).toEqual(g.results);
        expect(replayMatch(seed, deck, who, moves.slice(0, -1))).toBeNull();
      }
  });

  it('出牌紀錄形狀檢查、結算', () => {
    expect(cleanMoves([{ type: 'play', card: 2 }, { type: 'pass' }])).toEqual([{ type: 'play', card: 2 }, { type: 'pass' }]);
    for (const bad of [null, 'x', [{ type: 'play' }], [{ type: 'play', card: 1.5 }], [{ type: 'win' }], new Array(81).fill({ type: 'pass' })]) expect(cleanMoves(bad)).toBeNull();
    expect([payout(40, 0), payout(40, -1), payout(40, 1)]).toEqual([80, 40, 0]);
    expect(prizeOf(parseCardStats(null), OPPONENTS[0]!, 0)).toBe(OPPONENTS[0]!.rewards[0]);
    expect(prizeOf(parseCardStats(null), OPPONENTS[0]!, 1)).toBeUndefined();
  });
});
