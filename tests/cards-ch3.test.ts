import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { DECK_PLAYER_CH3, DECK_TOURNEY_DEALER, DECK_TOURNEY_KNIGHT, DECK_TOURNEY_MINER, getCard, validateDeck } from '../src/data/cards';
import { applyAction, chooseAction, createMatch, type MatchConfig } from '../src/core/cards';

function winRate(opp: readonly string[], oppMistake: number, N = 300): number {
  const cfg: MatchConfig = { decks: [DECK_PLAYER_CH3, opp] };
  let wins = 0;
  for (let seed = 1; seed <= N; seed++) {
    let { state } = createMatch(cfg, seed);
    const rng = mulberry32(seed ^ 0x51ed);
    for (let k = 0; state.phase !== 'ended' && k < 80; k++) {
      state = applyAction(state, chooseAction(state, state.current, { mistakeRate: state.current === 0 ? 0.15 : oppMistake, rng })).state;
    }
    expect(state.phase).toBe('ended');
    if (state.winner === 0) wins++;
  }
  return wins / N;
}

describe('第 3 章燼牌大賽', () => {
  it('牌組合法、星冠存在', () => {
    for (const d of [DECK_PLAYER_CH3, DECK_TOURNEY_KNIGHT, DECK_TOURNEY_MINER, DECK_TOURNEY_DEALER]) expect(validateDeck(d)).toEqual([]);
    expect(getCard('n_starcrown').legend).toBe(true);
  });
  it('三場玩家勝率都在 25%–85%', () => {
    const k = winRate(DECK_TOURNEY_KNIGHT, 0.15);
    const m = winRate(DECK_TOURNEY_MINER, 0.25);
    const d = winRate(DECK_TOURNEY_DEALER, 0.08);
    console.log(`[tourney sim] knight ${(k * 100).toFixed(1)}% miner ${(m * 100).toFixed(1)}% dealer ${(d * 100).toFixed(1)}%`);
    for (const r of [k, m, d]) {
      expect(r).toBeGreaterThanOrEqual(0.25);
      expect(r).toBeLessThanOrEqual(0.85);
    }
  });
});
