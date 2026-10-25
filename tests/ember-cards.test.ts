// 營火燼牌（D-127）：規則與 AI。
import { describe, expect, it } from 'vitest';
import { aiMove, applyMove, CARD_REWARDS, CARDS, cardPower, deckWith, legalMoves, MERCHANT_DECK, newCardGame, nextReward, PLAYER_DECK, rowScore, totalScore, type CardGame } from '../src/core/cards/emberCards';

function bare(): CardGame {
  const g = newCardGame(1);
  for (const S of g.sides) {
    S.hand = [];
    S.deck = [];
    S.rows = [[], []];
  }
  g.turn = 0;
  return g;
}

function playOut(seed: number, deck: readonly string[] = PLAYER_DECK): CardGame {
  const g = newCardGame(seed, [deck, MERCHANT_DECK]);
  let n = 0;
  while (!g.over && n++ < 200) {
    const s = g.turn;
    expect(applyMove(g, s, aiMove(g, s))).toBe(true);
  }
  return g;
}

describe('營火燼牌', () => {
  it('牌組都是存在的牌；開場各 10 張手牌', () => {
    for (const id of [...PLAYER_DECK, ...MERCHANT_DECK]) expect(CARDS[id]).toBeDefined();
    const g = newCardGame(3);
    expect(g.sides[0].hand.length).toBe(10);
    expect(g.sides[1].hand.length).toBe(10);
  });

  it('同袍、戰號、天候、傳奇的點數', () => {
    const g = bare();
    g.sides[0].rows[0] = ['militia', 'militia', 'militia', 'hero_blade'];
    expect(cardPower(g, 0, 0, 'militia')).toBe(6); // 2 × 3 張
    expect(rowScore(g, 0, 0)).toBe(18 + 10);
    g.sides[0].horn[0] = true;
    expect(rowScore(g, 0, 0)).toBe(36 + 10); // 傳奇不吃戰號
    g.weather[0] = true;
    expect(rowScore(g, 0, 0)).toBe(3 * 3 * 2 + 10); // 霜寒：民兵 1 × 3 張 × 戰號 2
  });

  it('斥候放到對手那邊、自己抽 2 張；手牌出完自動放棄；雙方放棄結算這一局', () => {
    const g = bare();
    g.sides[0].hand = ['scout', 'bear'];
    g.sides[0].deck = ['mage', 'archer', 'slinger'];
    g.sides[1].hand = ['slinger'];
    expect(applyMove(g, 0, { type: 'play', card: 0 })).toBe(true);
    expect(g.sides[1].rows[0]).toEqual(['scout']);
    expect(g.sides[0].hand).toEqual(['bear', 'mage', 'archer']);
    expect(g.turn).toBe(1);
    applyMove(g, 1, { type: 'play', card: 0 }); // 莫托出完最後一張 → 自動放棄
    expect(g.sides[1].passed).toBe(true);
    expect(g.turn).toBe(0);
    applyMove(g, 0, { type: 'play', card: 0 }); // 熊 8
    applyMove(g, 0, { type: 'pass' });
    expect(g.results).toEqual([0]); // 8 vs 3+2
    expect(g.round).toBe(2);
    expect(g.sides[0].rows[0]).toEqual([]);
  });

  it('不是你的回合、已放棄都不能出；戰號兩排都吹過就不能再出', () => {
    const g = bare();
    g.sides[0].hand = ['horn', 'bear'];
    g.sides[1].hand = ['slinger', 'mage'];
    expect(applyMove(g, 1, { type: 'pass' })).toBe(false);
    g.sides[0].horn = [true, true];
    expect(legalMoves(g, 0).some((m) => m.type === 'play' && m.card === 0)).toBe(false);
  });

  it('AI 對 AI 打 200 場：每場都在 3 局內結束、雙方都贏得到、沒有卡住', () => {
    let w0 = 0;
    let w1 = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = playOut(seed);
      expect(g.over).toBe(true);
      expect(g.results.length).toBeLessThanOrEqual(3);
      if (g.winner === 0) w0++;
      if (g.winner === 1) w1++;
    }
    (globalThis as any).process.stdout.write(`[燼牌] AI 對 AI 200 場：玩家牌組 ${w0} 勝、莫托牌組 ${w1} 勝\n`);
    expect(w0).toBeGreaterThan(40);
    expect(w1).toBeGreaterThan(40);
  });

  it('AI 不會在對手已放棄、自己已領先時繼續浪費牌', () => {
    const g = bare();
    g.sides[1].passed = true;
    g.sides[0].rows[0] = ['bear'];
    g.sides[1].rows[0] = ['slinger'];
    g.sides[0].hand = ['mage'];
    expect(aiMove(g, 0)).toEqual({ type: 'pass' });
    expect(totalScore(g, 0)).toBe(8);
  });

  it('下注贏來的牌：依序給、不重複、拿完就沒有；牌組會變強但不會無敵', () => {
    expect(nextReward([])).toBe(CARD_REWARDS[0]);
    expect(nextReward(['mage'])).toBe(CARD_REWARDS[1]);
    expect(nextReward([...CARD_REWARDS])).toBeUndefined();
    expect(deckWith(['mage', 'bogus']).length).toBe(PLAYER_DECK.length + 1);
    let base = 0;
    let full = 0;
    for (let seed = 1; seed <= 200; seed++) {
      if (playOut(seed).winner === 0) base++;
      if (playOut(seed, deckWith(CARD_REWARDS)).winner === 0) full++;
    }
    (globalThis as any).process.stdout.write(`[燼牌] 玩家牌組勝場：基本 ${base}／全部贏到 ${full}（200 場）\n`);
    expect(full).toBeGreaterThanOrEqual(base - 10);
    expect(full).toBeLessThan(190);
  });
});
