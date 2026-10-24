import { describe, expect, it } from 'vitest';
import { DECK_MAX, DECK_PLAYER_CH3, DECK_PLAYER_STARTER, validateDeck, withCollection } from '../src/data/cards';
import { createMatch } from '../src/core/cards/engine';

describe('燼牌收藏加入牌組 withCollection', () => {
  it('收藏的傳說牌各加入一份，牌組仍合法', () => {
    const r = withCollection(DECK_PLAYER_CH3, { c_veteran: 1, n_starcrown: 1 });
    expect(r.added).toEqual(['c_veteran', 'n_starcrown']);
    expect(r.deck.length).toBe(DECK_PLAYER_CH3.length + 2);
    expect(validateDeck(r.deck)).toEqual([]);
  });
  it('空收藏、未知 id、已在牌組中的牌不加入', () => {
    expect(withCollection(DECK_PLAYER_STARTER, {}).added).toEqual([]);
    expect(withCollection(DECK_PLAYER_STARTER, { nope: 1, n_oil: 2 }).added).toEqual([]);
  });
  it('不超過牌組上限', () => {
    const big = Array.from({ length: DECK_MAX }, () => 't_militia');
    expect(withCollection(big, { c_veteran: 1 }).added).toEqual([]);
  });
  it('加入後可以正常開局', () => {
    const r = withCollection(DECK_PLAYER_STARTER, { c_veteran: 1 });
    const m = createMatch({ decks: [r.deck, DECK_PLAYER_STARTER] }, 7).state;
    expect(m.sides[0].deck.length + m.sides[0].hand.length).toBe(r.deck.length);
  });
});
