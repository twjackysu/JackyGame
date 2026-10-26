// 營火燼牌（D-127）：規則與 AI。
import { describe, expect, it } from 'vitest';
import { aiMove, applyMove, CARD_REWARDS, CARDS, cardPower, DECK_MAX, deckWith, legalMoves, MERCHANT_DECK, newCardGame, nextReward, OPPONENTS, opponentsAt, PLAYER_DECK, rowScore, echoTarget, scorchTargets, totalScore, type CardGame, type Opponent } from '../src/core/cards/emberCards';

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

function playOut(seed: number, deck: readonly string[] = PLAYER_DECK, who: Opponent = OPPONENTS[0]!): CardGame {
  const g = newCardGame(seed, [deck, who.deck], who.short);
  let n = 0;
  while (!g.over && n++ < 200) {
    const s = g.turn;
    expect(applyMove(g, s, aiMove(g, s, s === 1 ? who : OPPONENTS[0]))).toBe(true);
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

  it('戰號不能吹在空排（第 28 輪）；有牌就自動挑加最多的一排', () => {
    const g = bare();
    g.sides[0].hand = ['horn', 'bear'];
    expect(legalMoves(g, 0).some((m) => m.type === 'play' && m.card === 0)).toBe(false);
    expect(applyMove(g, 0, { type: 'play', card: 0 })).toBe(false);
    g.sides[0].rows[0] = ['hero_blade']; // 傳奇不吃戰號 → 還是不能吹
    expect(legalMoves(g, 0).some((m) => m.type === 'play' && m.card === 0)).toBe(false);
    g.sides[0].rows[1] = ['mage'];
    expect(applyMove(g, 0, { type: 'play', card: 0 })).toBe(true);
    expect(g.sides[0].horn).toEqual([false, true]);
  });

  it('燼爆：燒掉場上點數最高的非傳奇單位（雙方、同分一起）', () => {
    const g = bare();
    g.sides[0].rows[0] = ['bear', 'hero_colossus'];
    g.sides[1].rows[0] = ['golem'];
    g.sides[1].rows[1] = ['bear', 'mage'];
    g.sides[0].hand = ['scorch', 'slinger'];
    expect(scorchTargets(g).map((x) => x[2])).toEqual(['golem']);
    g.sides[0].horn[0] = true; // 熊 8×2＝16 變最高
    expect(scorchTargets(g)).toEqual([[0, 0, 'bear']]);
    g.sides[0].horn[0] = false;
    g.sides[1].rows[0] = [];
    expect(applyMove(g, 0, { type: 'play', card: 0 })).toBe(true);
    expect(g.sides[0].rows[0]).toEqual(['hero_colossus']);
    expect(g.sides[1].rows[1]).toEqual(['mage']);
    expect(g.lastBurn?.length).toBe(2);
  });

  it('三位對手：牌組都存在、獎勵牌不重複、各在自己的地圖；難度依序變高，贏來的牌讓你變強', () => {
    const seen = new Set<string>();
    for (const o of OPPONENTS) {
      for (const id of [...o.deck, ...o.rewards]) expect(CARDS[id]).toBeDefined();
      for (const id of new Set(o.rewards)) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
    expect(opponentsAt('mistwood').map((o) => o.id)).toEqual(['merchant']);
    expect(opponentsAt('thornvale').map((o) => o.id)).toEqual(['merchant', 'vela']);
    expect(opponentsAt('emberrift').map((o) => o.id)).toEqual(['merchant', 'goran']);
    expect(opponentsAt('emberrift', true).map((o) => o.id)).toEqual(['merchant', 'goran', 'ida']);
    expect(opponentsAt('starfall').map((o) => o.id)).toEqual(['merchant', 'sol']);
    const all = OPPONENTS.slice(0, 3).flatMap((o) => o.rewards);
    expect(deckWith(all).length).toBe(DECK_MAX);
    const rate = (deck: string[], who: Opponent): number => {
      let w = 0;
      for (let seed = 1; seed <= 150; seed++) if (playOut(seed, deck, who).winner === 0) w++;
      return w;
    };
    const [m, v, gr, ida] = OPPONENTS.map((o) => rate(deckWith([]), o)) as [number, number, number, number];
    const v5 = rate(deckWith(CARD_REWARDS), OPPONENTS[1]!);
    const gAll = rate(deckWith(all), OPPONENTS[2]!);
    (globalThis as any).process.stdout.write(`[燼牌] 基本牌組勝場（150 場）：莫托 ${m}、薇菈 ${v}、葛倫 ${gr}；拿齊莫托的牌打薇菈 ${v5}；全拿打葛倫 ${gAll}\n`);
    expect(m).toBeGreaterThan(v);
    expect(m).toBeGreaterThan(gr);
    expect(v).toBeGreaterThan(15);
    expect(gr).toBeGreaterThan(15);
    expect(v5).toBeGreaterThan(v + 20);
    expect(gAll).toBeGreaterThan(gr + 20);
    expect(gAll).toBeLessThan(145);
    // 隱藏對手伊妲（D-132）：基本牌組很難贏，拿齊三家的牌大約五五波
    const idaAll = rate(deckWith(OPPONENTS.slice(0, 3).flatMap((o) => o.rewards)), OPPONENTS[3]!);
    (globalThis as any).process.stdout.write(`[燼牌] 伊妲：基本 ${ida}、拿齊三家 ${idaAll}（150 場）\n`);
    expect(ida).toBeLessThan(gr);
    expect(idaAll).toBeGreaterThan(ida + 30);
  });

  it('觀星者索爾（D-139，星隕高原）：不算進「三位都贏過」；基本牌組很難贏，拿齊三家的牌有得打', () => {
    const sol = OPPONENTS.find((o) => o.id === 'sol')!;
    expect(sol.extra).toBe(true);
    expect(OPPONENTS.filter((o) => !o.secret && !o.extra).map((o) => o.id)).toEqual(['merchant', 'vela', 'goran']);
    const rate = (deck: string[]): number => {
      let w = 0;
      for (let seed = 1; seed <= 150; seed++) if (playOut(seed, deck, sol).winner === 0) w++;
      return w;
    };
    const base = rate(deckWith([]));
    const all = rate(deckWith(OPPONENTS.slice(0, 3).flatMap((o) => o.rewards)));
    (globalThis as any).process.stdout.write(`[燼牌] 索爾：基本 ${base}、拿齊三家 ${all}（150 場）\n`);
    expect(base).toBeLessThan(45);
    expect(all).toBeGreaterThan(base + 25);
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
    expect(nextReward([], OPPONENTS[1])).toBe('thornhound');
    expect(nextReward(['thornhound'], OPPONENTS[1])).toBe('thornhound');
    expect(nextReward(['thornhound', 'thornhound'], OPPONENTS[1])).toBe('briar_archer');
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

describe('燼牌自己組牌（D-130）', () => {
  it('留在箱子裡的牌不帶；少於 12 張忽略；超過 18 張自動拿掉最弱', async () => {
    const { ownedCards, DECK_MIN, OPPONENTS: O } = await import('../src/core/cards/emberCards');
    const won = O.flatMap((o) => o.rewards);
    expect(ownedCards(won).length).toBe(PLAYER_DECK.length + won.length);
    const d = deckWith([], ['militia', 'frost']);
    expect(d.length).toBe(PLAYER_DECK.length - 2);
    expect(d.filter((x) => x === 'militia').length).toBe(2);
    expect(d.includes('frost')).toBe(false);
    const tooFew = deckWith([], PLAYER_DECK.slice(0, 5));
    expect(tooFew.length).toBe(PLAYER_DECK.length);
    expect(DECK_MIN).toBe(12);
    // 全拿再拿掉 6 張單位：28 - 6 = 22 → 修到 18
    expect(deckWith(won, ['wolfhunter', 'shieldman']).length).toBe(DECK_MAX);
  });
});

describe('寶箱裡的燼牌（D-131）', () => {
  it('寶箱都在大地圖上、不是夜光寶箱；牌拿得進牌組', async () => {
    const { CHEST_CARDS, ownedCards } = await import('../src/core/cards/emberCards');
    const { makeMistwoodStage } = await import('../src/core/battle/rt/maps/mistwood');
    const { makeThornvaleStage } = await import('../src/core/battle/rt/maps/thornvale');
    const { makeEmberriftStage } = await import('../src/core/battle/rt/maps/emberrift');
    const { makeStarfallStage } = await import('../src/core/battle/rt/maps/starfall');
    const chests = [makeMistwoodStage(), makeThornvaleStage(), makeEmberriftStage(), makeStarfallStage()].flatMap((s) => s.chests ?? []);
    for (const [chest, id] of Object.entries(CHEST_CARDS)) {
      const c = chests.find((x) => x.id === chest);
      expect(c, chest).toBeDefined();
      expect(c!.nightOnly).toBeFalsy();
      expect(CARDS[id]).toBeDefined();
      expect(ownedCards([id])).toContain(id);
    }
  });
});

describe('回響（D-135，伊妲的招牌）', () => {
  it('複製自己場上加分最多的單位（同袍疊上去）、自己留在後排；傳奇不複製', () => {
    const g = bare();
    g.sides[0].rows = [['thornhound', 'thornhound', 'bear', 'hero_blade'], []];
    g.sides[0].hand = ['echo', 'militia'];
    expect(echoTarget(g, 0)).toEqual([0, 'thornhound']); // 獵犬 2→3 隻：8→18（+10）勝過岩甲熊 +8
    const before = totalScore(g, 0);
    expect(applyMove(g, 0, { type: 'play', card: 0 })).toBe(true);
    expect(g.sides[0].rows[0].filter((x) => x === 'thornhound').length).toBe(3);
    expect(g.sides[0].rows[1]).toEqual(['echo']);
    expect(totalScore(g, 0)).toBe(before + 10 + 1);
    expect(g.lastEcho).toEqual([0, 0, 'thornhound']);
  });
  it('場上只有傳奇或空的時候只放自己（1 點）', () => {
    const g = bare();
    g.sides[0].rows = [['hero_blade'], []];
    g.sides[0].hand = ['echo', 'militia'];
    expect(echoTarget(g, 0)).toBeNull();
    applyMove(g, 0, { type: 'play', card: 0 });
    expect(totalScore(g, 0)).toBe(11);
  });
  it('牌組超過上限時不會被當成最弱的牌拿掉', () => {
    expect(deckWith(OPPONENTS.flatMap((o) => o.rewards))).toContain('echo');
  });
});
