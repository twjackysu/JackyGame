import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import {
  DECK_PLAYER_STARTER,
  DECK_ROURKE_OFFICIAL,
  DECK_ROURKE_OFFICIAL_NO_LEGEND,
  DECK_ROURKE_TUTORIAL,
  DECK_TUTORIAL_PLAYER,
  DECK_BERN,
  getCard,
  validateDeck,
} from '../src/data/cards';
import {
  applyAction,
  chooseAction,
  chooseTutorialAction,
  createMatch,
  effectivePower,
  legalActions,
  previewNight,
  type Action,
  type CardEvent,
  type CardInst,
  type MatchConfig,
  type MatchState,
  type MoonPhase,
  type Side,
} from '../src/core/cards';

let uid = 10000;
const mk = (id: string): CardInst => ({ uid: uid++, id, base: getCard(id).power, buff: 0, persisted: false });
const FILLER = Array.from({ length: 15 }, () => 'n_wanderer');

/** Build a controlled night-1 state: side 0 to move, given boards/hands, fixed moon. */
function setup(opts: {
  board0?: (string | null)[];
  board1?: (string | null)[];
  hand0?: string[];
  hand1?: string[];
  moon?: MoonPhase;
  deck0?: string[];
  deck1?: string[];
}): MatchState {
  const moon = opts.moon ?? 'new';
  const cfg: MatchConfig = { decks: [FILLER, FILLER], firstPlayer: 0, fixedMoons: [moon, moon, moon] };
  const { state } = createMatch(cfg, 1);
  const s = structuredClone(state);
  const fill = (b?: (string | null)[]) => Array.from({ length: 5 }, (_, i) => (b?.[i] ? mk(b[i] as string) : null));
  s.sides[0].board = fill(opts.board0);
  s.sides[1].board = fill(opts.board1);
  s.sides[0].hand = (opts.hand0 ?? ['n_wanderer']).map(mk);
  s.sides[1].hand = (opts.hand1 ?? ['n_wanderer']).map(mk);
  s.sides[0].deck = (opts.deck0 ?? FILLER).map(mk);
  s.sides[1].deck = (opts.deck1 ?? FILLER).map(mk);
  s.current = 0;
  s.firstThisNight = 0;
  s.moon = moon;
  return s;
}

function act(state: MatchState, a: Action): { state: MatchState; events: CardEvent[] } {
  return applyAction(state, a);
}

describe('card data', () => {
  it('deck sizes match the spec', () => {
    expect(DECK_PLAYER_STARTER).toHaveLength(17);
    expect(DECK_ROURKE_OFFICIAL).toHaveLength(20);
    expect(DECK_ROURKE_OFFICIAL_NO_LEGEND).toHaveLength(19);
    expect(DECK_BERN).toHaveLength(17);
    expect(DECK_TUTORIAL_PLAYER).toHaveLength(8);
    expect(DECK_ROURKE_TUTORIAL).toHaveLength(8);
    expect(validateDeck(DECK_PLAYER_STARTER)).toEqual([]);
    expect(validateDeck(DECK_ROURKE_OFFICIAL)).toEqual([]);
    expect(validateDeck(DECK_BERN)).toEqual([]);
  });
});

describe('settlement', () => {
  it('opposed burn: lower card scores 0, empty vs card scores, both empty nothing', () => {
    const s = setup({ board0: ['t_archer', 't_militia', null], board1: ['t_lamplighter', null, null] });
    const pv = previewNight(s);
    // slot0: 5 vs 2 -> 2 burned. slot1: militia 3 (+1 chain from archer) vs empty.
    expect(pv.burned[1][0]).toBe(true);
    expect(pv.powers[0][0]).toBe(5);
    expect(pv.powers[0][1]).toBe(4);
    expect(pv.totals).toEqual([9, 0]);
  });

  it('equal powers both keep', () => {
    const s = setup({ board0: ['t_archer'], board1: ['n_wanderer'] });
    expect(previewNight(s).totals).toEqual([5, 5]);
  });

  it('legends neither burn nor are burned and ignore buffs/moons', () => {
    const s = setup({ board0: ['t_watchman', 'c_bouncer'], board1: ['c_veteran', 't_watchman'], moon: 'half' });
    const pv = previewNight(s);
    expect(pv.burned).toEqual([[false, false, false, false, false], [false, false, false, false, false]]);
    expect(pv.powers[0][0]).toBe(9); // half-moon ignored for legend
    expect(pv.powers[1][0]).toBe(10);
    expect(pv.powers[0][1]).toBe(6); // bouncer not burned by legend 9
  });

  it('血月 gives +2 to the higher card in each opposed pair', () => {
    const s = setup({ board0: ['t_archer'], board1: ['t_militia'], moon: 'blood' });
    const pv = previewNight(s);
    expect(pv.powers[0][0]).toBe(7);
    expect(pv.totals).toEqual([7, 0]);
  });

  it('滿月 / 弦月 modify power', () => {
    const full = setup({ board0: [null, null, 't_archer'], moon: 'full' });
    expect(effectivePower(full, 0, 2)).toBe(8);
    const half = setup({ board0: ['t_archer', 'n_wanderer'], moon: 'half' });
    expect(effectivePower(half, 0, 0)).toBe(6);
    expect(effectivePower(half, 0, 1)).toBe(5);
  });

  it('tie night gives both a win', () => {
    let s = setup({ board0: ['t_archer'], board1: [null, 'n_wanderer'], hand0: ['n_oil'], hand1: ['n_oil'] });
    s = act(s, { type: 'pass' }).state;
    const r = act(s, { type: 'pass' });
    const end = r.events.find((e) => e.type === 'nightEnd');
    expect(end).toMatchObject({ winner: 'tie', wins: [1, 1] });
    // tie -> previous night's second player (side 1) goes first
    expect(r.state.firstThisNight).toBe(1);
  });
});

describe('keywords', () => {
  it('連燈 counts adjacent friendly cards dynamically', () => {
    const s = setup({ board0: ['n_wanderer', 't_militia', 'n_wanderer'] });
    expect(effectivePower(s, 0, 1)).toBe(5);
  });

  it('點燈 buffs adjacent friendly non-legends by +1 persistently', () => {
    const s = setup({ board0: ['n_wanderer', null, 't_watchman'], hand0: ['t_lamplighter'] });
    const r = act(s, { type: 'play', handIndex: 0, slot: 1 });
    expect(effectivePower(r.state, 0, 0)).toBe(6);
    expect(effectivePower(r.state, 0, 2)).toBe(9);
    expect(r.events.filter((e) => e.type === 'buff')).toHaveLength(1);
  });

  it('灼照 gives -3 to the opposite enemy, floor 0', () => {
    const s = setup({ board1: [null, 't_lamplighter', null], hand0: ['n_mage'] });
    const r = act(s, { type: 'play', handIndex: 0, slot: 1 });
    expect(effectivePower(r.state, 1, 1)).toBe(0);
    expect(r.events.some((e) => e.type === 'debuff' && e.amount === -3)).toBe(true);
  });

  it('守望 protects adjacent friendly from 灼照', () => {
    const s = setup({ board1: ['t_bellringer', 'n_wanderer'], hand0: ['n_mage'] });
    const r = act(s, { type: 'play', handIndex: 0, slot: 1 });
    expect(effectivePower(r.state, 1, 1)).toBe(5);
  });

  it('吹熄 returns the opposite enemy card to hand', () => {
    const s = setup({ board1: ['c_bouncer'], hand0: ['c_cardsharp'], hand1: ['n_wanderer'] });
    const r = act(s, { type: 'play', handIndex: 0, slot: 0 });
    expect(r.state.sides[1].board[0]).toBeNull();
    expect(r.state.sides[1].hand.map((c) => c.id)).toContain('c_bouncer');
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'blowout', to: 'hand' }));
  });

  it('吹熄 discards when the target hand is full (10)', () => {
    const s = setup({ board1: ['c_bouncer'], hand0: ['c_cardsharp'], hand1: Array.from({ length: 10 }, () => 'n_wanderer') });
    const r = act(s, { type: 'play', handIndex: 0, slot: 0 });
    expect(r.state.sides[1].hand).toHaveLength(10);
    expect(r.state.sides[1].discard.map((c) => c.id)).toContain('c_bouncer');
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'blowout', to: 'discard' }));
  });

  it('吹熄 cannot remove legends', () => {
    const s = setup({ board1: ['c_veteran'], hand0: ['c_cardsharp'] });
    const r = act(s, { type: 'play', handIndex: 0, slot: 0 });
    expect(r.state.sides[1].board[0]?.id).toBe('c_veteran');
  });

  it('餘燼 cards persist halved (min 1) into the next night', () => {
    const s = setup({ board0: ['t_child', 'n_wanderer'], board1: [null, null, 'c_bouncer'], hand0: ['n_oil'], hand1: ['n_oil'] });
    let st = act(s, { type: 'pass' }).state;
    st = act(st, { type: 'pass' }).state;
    expect(st.night).toBe(2);
    const child = st.sides[0].board[0];
    expect(child?.id).toBe('t_child');
    expect(child?.base).toBe(1);
    expect(child?.persisted).toBe(true);
    expect(st.sides[0].board[1]).toBeNull();
  });

  it('回響 returns a burned card to hand at night end', () => {
    const s = setup({ board0: ['c_juggler'], board1: ['c_bouncer'], hand0: ['n_oil'], hand1: ['n_oil'] });
    let st = act(s, { type: 'pass' }).state;
    const r = act(st, { type: 'pass' });
    st = r.state;
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'echo', cardId: 'c_juggler', to: 'hand' }));
    expect(st.sides[0].hand.map((c) => c.id)).toContain('c_juggler');
  });
});

describe('turn flow', () => {
  it('熄燈獎勵: passing first draws +1 next night', () => {
    const s = setup({ board0: ['t_archer'], hand0: ['n_wanderer'], hand1: ['n_wanderer', 'n_wanderer'] });
    let r = act(s, { type: 'pass' });
    expect(r.events).toContainEqual({ type: 'pass', side: 0, auto: false, bonus: true });
    r = act(r.state, { type: 'play', handIndex: 0, slot: 0 }); // side1 plays wanderer vs archer (tie 5:5)
    r = act(r.state, { type: 'pass' }); // side1 passes, night ends
    const draws = r.events.filter((e) => e.type === 'draw');
    expect(draws).toContainEqual({ type: 'draw', side: 0, count: 2, reason: 'night' });
    expect(draws).toContainEqual({ type: 'draw', side: 0, count: 1, reason: 'bonus' });
    expect(draws.some((e) => e.type === 'draw' && e.side === 1 && e.reason === 'bonus')).toBe(false);
  });

  it('auto-pass when slots are full and no spells, or hand empty', () => {
    const s = setup({
      board0: ['n_wanderer', 'n_wanderer', 'n_wanderer', 'n_wanderer', null],
      hand0: ['t_archer'],
      hand1: [],
    });
    // side 1 has an empty hand; after side 0 fills the last slot, both auto-pass and the night resolves
    const r = act(s, { type: 'play', handIndex: 0, slot: 4 });
    const passes = r.events.filter((e) => e.type === 'pass');
    expect(passes.length).toBe(2);
    expect(passes.every((e) => e.type === 'pass' && e.auto)).toBe(true);
    expect(r.events.some((e) => e.type === 'nightEnd')).toBe(true);
  });

  it('loser of the previous night goes first next night', () => {
    const s = setup({ board0: ['t_archer'], hand0: ['n_oil'], hand1: ['n_oil'] });
    let st = act(s, { type: 'pass' }).state;
    st = act(st, { type: 'pass' }).state;
    expect(st.nightResults[0]?.winner).toBe(0);
    expect(st.firstThisNight).toBe(1);
  });

  it('rejects illegal actions and keeps input state untouched', () => {
    const s = setup({ board0: ['t_archer'] });
    const snap = JSON.stringify(s);
    expect(() => applyAction(s, { type: 'play', handIndex: 0, slot: 0 })).toThrow();
    act(s, { type: 'play', handIndex: 0, slot: 1 });
    expect(JSON.stringify(s)).toBe(snap);
  });

  it('createMatch is deterministic per seed and cheat puts 餘燼騎士 in hand', () => {
    const cfg: MatchConfig = { decks: [DECK_PLAYER_STARTER, DECK_ROURKE_OFFICIAL], guaranteeInHand: { 1: ['c_veteran'] } };
    for (let seed = 1; seed <= 30; seed++) {
      const a = createMatch(cfg, seed).state;
      const b = createMatch(cfg, seed).state;
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.sides[1].hand.map((c) => c.id)).toContain('c_veteran');
      expect(a.sides[0].hand).toHaveLength(7);
    }
  });
});

function playMatch(config: MatchConfig, seed: number, ai: [number, number], scriptedSide1 = false): { state: MatchState; actions: number } {
  let { state } = createMatch(config, seed);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  let actions = 0;
  while (state.phase !== 'ended') {
    const side: Side = state.current;
    const a =
      scriptedSide1 && side === 1 ? chooseTutorialAction(state, side) : chooseAction(state, side, { mistakeRate: ai[side], rng });
    expect(legalActions(state).length).toBeGreaterThan(0);
    state = applyAction(state, a).state;
    actions++;
    if (actions > 60) throw new Error(`match ${seed} did not terminate`);
  }
  return { state, actions };
}

describe('AI simulation', () => {
  it('playerStarter vs rourkeOfficial (no cheat, legend removed): 400 matches', () => {
    const cfg: MatchConfig = { decks: [DECK_PLAYER_STARTER, DECK_ROURKE_OFFICIAL_NO_LEGEND] };
    let wins = 0;
    let draws = 0;
    let totalActions = 0;
    let nights = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const { state, actions } = playMatch(cfg, seed, [0.15, 0.3]);
      expect(actions).toBeLessThanOrEqual(60);
      totalActions += actions;
      nights += state.night;
      if (state.winner === 0) wins++;
      else if (state.winner === 'draw') draws++;
    }
    const rate = wins / N;
    console.log(
      `[cards sim] player win rate ${(rate * 100).toFixed(1)}% (draws ${draws}), avg actions ${(totalActions / N).toFixed(1)}, avg nights ${(nights / N).toFixed(2)}`,
    );
    expect(rate).toBeGreaterThanOrEqual(0.3);
    expect(rate).toBeLessThanOrEqual(0.75);
  });

  it('cheat (餘燼騎士 guaranteed) and mirror-ish matchups terminate', () => {
    const cheat: MatchConfig = { decks: [DECK_PLAYER_STARTER, DECK_ROURKE_OFFICIAL], guaranteeInHand: { 1: ['c_veteran'] } };
    const mirror: MatchConfig = { decks: [DECK_PLAYER_STARTER, DECK_PLAYER_STARTER] };
    let cw = 0;
    let mw = 0;
    for (let seed = 1; seed <= 200; seed++) {
      if (playMatch(cheat, seed, [0.15, 0.3]).state.winner === 0) cw++;
      if (playMatch(mirror, seed, [0.15, 0.15]).state.winner === 0) mw++;
    }
    console.log(`[cards sim] vs cheating Rourke ${(cw / 2).toFixed(1)}%, mirror ${(mw / 2).toFixed(1)}%`);
  });

  it('tutorial (2 nights, scripted Rourke) is winnable by the AI player', () => {
    const cfg: MatchConfig = { decks: [DECK_TUTORIAL_PLAYER, DECK_ROURKE_TUTORIAL], nights: 2, moonPool: ['new'] };
    let wins = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const { state } = playMatch(cfg, seed, [0, 0], true);
      expect(state.night).toBeLessThanOrEqual(2);
      if (state.winner === 0) wins++;
    }
    console.log(`[cards sim] tutorial win rate ${(wins * 2).toFixed(0)}%`);
    expect(wins).toBeGreaterThanOrEqual(45);
  });
});
