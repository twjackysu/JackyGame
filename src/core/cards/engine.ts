/**
 * 燼牌 v2 rules engine (docs/design/03-core-gameplay.md §6).
 * Reducer style: applyAction(state, action) -> { state, events }. Input state is never mutated.
 * Deterministic given the match seed (randomness via mulberry32, state kept in MatchState.rngState).
 */
import { mulberry32 } from '../rng';
import { getCard, type CardDef } from '../../data/cards';
import {
  HAND_CAP,
  HAND_DRAW_PER_NIGHT,
  HAND_START,
  MOON_POOL_P0,
  SLOTS,
  WINS_TO_WIN,
  type Action,
  type ApplyResult,
  type CardEvent,
  type CardInst,
  type MatchConfig,
  type MatchState,
  type MoonPhase,
  type NightPreview,
  type Side,
  type SideState,
} from './types';

export * from './types';

const other = (s: Side): Side => (s === 0 ? 1 : 0);
export const defOf = (c: CardInst): CardDef => getCard(c.id);

/** Draw a float in [0,1) and advance the stored rng state. */
function rand(state: MatchState): number {
  const r = mulberry32(state.rngState);
  const v = r();
  state.rngState = Math.floor(r() * 4294967296) >>> 0;
  return v;
}

function shuffle<T>(state: MatchState, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(state) * (i + 1));
    const t = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = t;
  }
}

function newInst(state: MatchState, id: string): CardInst {
  return { uid: state.nextUid++, id, base: getCard(id).power, buff: 0, persisted: false };
}

/** Return a card to its owner's hand as a fresh copy, or discard if the hand is full. */
function returnToHand(state: MatchState, side: Side, card: CardInst): 'hand' | 'discard' {
  const s = state.sides[side];
  const fresh: CardInst = { uid: card.uid, id: card.id, base: getCard(card.id).power, buff: 0, persisted: false };
  if (s.hand.length >= HAND_CAP) {
    s.discard.push(fresh);
    return 'discard';
  }
  s.hand.push(fresh);
  return 'hand';
}

function drawCards(state: MatchState, side: Side, n: number, reason: 'opening' | 'night' | 'bonus' | 'effect', events: CardEvent[]): void {
  const s = state.sides[side];
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (s.hand.length >= HAND_CAP || s.deck.length === 0) break;
    s.hand.push(s.deck.shift() as CardInst);
    count++;
  }
  if (count > 0) events.push({ type: 'draw', side, count, reason });
}

function flipMoon(state: MatchState, avoid?: MoonPhase): MoonPhase {
  const fixed = state.config.fixedMoons?.[state.night - 1];
  if (fixed && avoid === undefined) return fixed;
  let pool = state.config.moonPool ?? MOON_POOL_P0;
  if (avoid !== undefined && pool.length > 1) pool = pool.filter((m) => m !== avoid);
  return pool[Math.floor(rand(state) * pool.length)] as MoonPhase;
}

// ---------------------------------------------------------------------------
// Power computation
// ---------------------------------------------------------------------------

/**
 * Current (pre-settlement) power of the card in `slot` on `side`; 0 if empty.
 * Legends ignore every modifier. Others: base + buff + 連燈 + 孤燈 + 月相 (滿月/弦月), floor 0.
 * 血月 is applied at 對峙 (see previewNight).
 */
export function effectivePower(state: MatchState, side: Side, slot: number): number {
  const board = state.sides[side].board;
  const card = board[slot];
  if (!card) return 0;
  const def = defOf(card);
  if (def.legend) return card.base;
  let p = card.base + card.buff;
  const neighbors = (slot > 0 && board[slot - 1] ? 1 : 0) + (slot < SLOTS - 1 && board[slot + 1] ? 1 : 0);
  if (def.keywords.includes('chain')) p += neighbors;
  if (def.keywords.includes('lone') && neighbors === 0) p += 3;
  if (state.moon === 'full' && slot === 2) p += 3;
  if (state.moon === 'half' && slot % 2 === 0) p += 1; // slots 1,3,5 (1-based)
  return Math.max(0, p);
}

/** Settlement preview: 對峙 (with 血月) then totals. Pure. */
export function previewNight(state: MatchState): NightPreview {
  const powers: [number[], number[]] = [[], []];
  const burned: [boolean[], boolean[]] = [[], []];
  for (let i = 0; i < SLOTS; i++) {
    const a = state.sides[0].board[i] ?? null;
    const b = state.sides[1].board[i] ?? null;
    let pa = effectivePower(state, 0, i);
    let pb = effectivePower(state, 1, i);
    let ba = false;
    let bb = false;
    if (a && b && pa !== pb) {
        const aLegend = defOf(a).legend;
        const bLegend = defOf(b).legend;
        const hi: Side = pa > pb ? 0 : 1;
        if (state.moon === 'blood') {
          if (hi === 0 && !aLegend) pa += 2;
          if (hi === 1 && !bLegend) pb += 2;
        }
        if (!aLegend && !bLegend) {
          if (hi === 0) { bb = true; pb = 0; } else { ba = true; pa = 0; }
        }
    }
    powers[0].push(pa);
    powers[1].push(pb);
    burned[0].push(ba);
    burned[1].push(bb);
  }
  const sum = (xs: number[]): number => xs.reduce((x, y) => x + y, 0);
  return { powers, burned, totals: [sum(powers[0]), sum(powers[1])] };
}

/** 守望: a card is protected if an adjacent friendly card has 守望. */
function isWarded(s: SideState, slot: number): boolean {
  for (const n of [slot - 1, slot + 1]) {
    const c = s.board[n];
    if (n >= 0 && n < SLOTS && c && defOf(c).keywords.includes('ward')) return true;
  }
  return false;
}

/** Can a hostile targeted effect (灼照/吹熄/夜風) hit this slot? */
function hostileTargetable(s: SideState, slot: number): boolean {
  const c = s.board[slot];
  return !!c && !defOf(c).legend && !isWarded(s, slot);
}

// ---------------------------------------------------------------------------
// Match creation & legal actions
// ---------------------------------------------------------------------------

function emptySide(): SideState {
  return { deck: [], hand: [], discard: [], board: Array.from({ length: SLOTS }, () => null), passed: false, bonusDraw: 0, nightWins: 0, totalScore: 0, starfallDraws: 0 };
}

/** Create a match. Returns the initial state (already at night 1, auto-passes resolved) and opening events. */
export function createMatch(config: MatchConfig, seed: number): ApplyResult {
  const state: MatchState = {
    config,
    rngState: seed >>> 0,
    nextUid: 1,
    night: 0,
    maxNights: config.nights ?? 3,
    moon: 'new',
    current: 0,
    firstThisNight: 0,
    sides: [emptySide(), emptySide()],
    phase: 'playing',
    winner: null,
    nightResults: [],
    actionCount: 0,
  };
  const events: CardEvent[] = [];
  for (const side of [0, 1] as Side[]) {
    const s = state.sides[side];
    s.deck = config.decks[side].map((id) => newInst(state, id));
    shuffle(state, s.deck);
    for (const gid of config.guaranteeInHand?.[side] ?? []) {
      const idx = s.deck.findIndex((c) => c.id === gid);
      if (idx >= HAND_START) {
        // swap into a random opening-hand position
        const j = Math.floor(rand(state) * HAND_START);
        const t = s.deck[j] as CardInst;
        s.deck[j] = s.deck[idx] as CardInst;
        s.deck[idx] = t;
      }
    }
    drawCards(state, side, HAND_START, 'opening', events);
  }
  const first: Side = config.firstPlayer ?? (rand(state) < 0.5 ? 0 : 1);
  startNight(state, first, events);
  normalize(state, events);
  return { state, events };
}

function startNight(state: MatchState, first: Side, events: CardEvent[]): void {
  state.night++;
  for (const side of [0, 1] as Side[]) {
    const s = state.sides[side];
    s.passed = false;
    s.starfallDraws = 0;
    if (state.night > 1) {
      drawCards(state, side, HAND_DRAW_PER_NIGHT, 'night', events);
      if (s.bonusDraw > 0) drawCards(state, side, s.bonusDraw, 'bonus', events);
    }
    s.bonusDraw = 0;
  }
  state.firstThisNight = first;
  state.current = first;
  events.push({ type: 'nightStart', night: state.night, first });
  state.moon = flipMoon(state);
  events.push({ type: 'moon', night: state.night, moon: state.moon });
}

/** All legal play actions for the current player (excluding pass). */
function legalPlays(state: MatchState, side: Side): Action[] {
  const me = state.sides[side];
  const opp = state.sides[other(side)];
  const out: Action[] = [];
  me.hand.forEach((card, handIndex) => {
    const def = defOf(card);
    if (def.kind === 'unit') {
      for (let slot = 0; slot < SLOTS; slot++) if (!me.board[slot]) out.push({ type: 'play', handIndex, slot });
    } else if (def.effect === 'gust') {
      for (let t = 0; t < SLOTS; t++) if (hostileTargetable(opp, t)) out.push({ type: 'play', handIndex, target: t });
    } else if (def.effect === 'oil') {
      for (let t = 0; t < SLOTS; t++) {
        const c = me.board[t];
        if (c && !defOf(c).legend) out.push({ type: 'play', handIndex, target: t });
      }
    } else if (def.effect === 'moonturn') {
      out.push({ type: 'play', handIndex });
    }
  });
  return out;
}

/** Legal actions for the player to move. Empty when the match has ended. */
export function legalActions(state: MatchState): Action[] {
  if (state.phase === 'ended') return [];
  const plays = legalPlays(state, state.current);
  return [...plays, { type: 'pass' }];
}

const cloneCard = (c: CardInst): CardInst => ({ ...c });
const cloneSide = (s: SideState): SideState => ({
  ...s,
  deck: s.deck.map(cloneCard),
  hand: s.hand.map(cloneCard),
  discard: s.discard.map(cloneCard),
  board: s.board.map((c) => (c ? cloneCard(c) : null)),
});

/** Deep-copies mutable match state (config is treated as immutable and shared). */
export function cloneState(s: MatchState): MatchState {
  return {
    ...s,
    sides: [cloneSide(s.sides[0]), cloneSide(s.sides[1])],
    nightResults: s.nightResults.map((r) => ({ ...r, scores: [r.scores[0], r.scores[1]] })),
  };
}

// ---------------------------------------------------------------------------
// Applying actions
// ---------------------------------------------------------------------------

function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'pass') return true;
  const bb = b as Extract<Action, { type: 'play' }>;
  return a.handIndex === bb.handIndex && (a.slot ?? -1) === (bb.slot ?? -1) && (a.target ?? -1) === (bb.target ?? -1);
}

export function applyAction(input: MatchState, action: Action): ApplyResult {
  if (input.phase === 'ended') throw new Error('Match has ended');
  const legal = legalActions(input);
  if (!legal.some((a) => sameAction(a, action))) throw new Error(`Illegal action ${JSON.stringify(action)}`);
  const state = cloneState(input);
  const events: CardEvent[] = [];
  const side = state.current;
  state.actionCount++;
  if (action.type === 'pass') {
    doPass(state, side, false, events);
  } else {
    doPlay(state, side, action, events);
  }
  state.current = other(side);
  normalize(state, events);
  return { state, events };
}

function doPass(state: MatchState, side: Side, auto: boolean, events: CardEvent[]): void {
  const s = state.sides[side];
  const bonus = !auto && !state.sides[other(side)].passed;
  s.passed = true;
  if (bonus) s.bonusDraw = 1;
  events.push({ type: 'pass', side, auto, bonus });
}

function addBuff(state: MatchState, side: Side, slot: number, amount: number, source: string, events: CardEvent[]): void {
  const c = state.sides[side].board[slot];
  if (!c || defOf(c).legend) return;
  c.buff += amount;
  events.push({ type: amount >= 0 ? 'buff' : 'debuff', side, slot, uid: c.uid, amount, source });
}

function blowOut(state: MatchState, side: Side, slot: number, events: CardEvent[]): void {
  const s = state.sides[side];
  const c = s.board[slot];
  if (!c) return;
  s.board[slot] = null;
  const to = returnToHand(state, side, c);
  events.push({ type: 'blowout', side, slot, uid: c.uid, cardId: c.id, to });
}

function doPlay(state: MatchState, side: Side, action: Extract<Action, { type: 'play' }>, events: CardEvent[]): void {
  const me = state.sides[side];
  const oppSide = other(side);
  const opp = state.sides[oppSide];
  const [card] = me.hand.splice(action.handIndex, 1) as [CardInst];
  const def = defOf(card);
  events.push({ type: 'play', side, uid: card.uid, cardId: card.id, slot: action.slot, target: action.target });

  if (def.kind === 'spell') {
    const t = action.target ?? -1;
    if (def.effect === 'gust') blowOut(state, oppSide, t, events);
    else if (def.effect === 'oil') addBuff(state, side, t, 2, 'n_oil', events);
    else if (def.effect === 'moonturn') {
      state.moon = flipMoon(state, state.moon);
      events.push({ type: 'moon', night: state.night, moon: state.moon });
    }
    me.discard.push(card);
  } else {
    const slot = action.slot as number;
    me.board[slot] = card;
    const kw = def.keywords;
    if (kw.includes('light')) for (const n of [slot - 1, slot + 1]) if (n >= 0 && n < SLOTS) addBuff(state, side, n, 1, card.id, events);
    if (kw.includes('scorch') && hostileTargetable(opp, slot)) addBuff(state, oppSide, slot, -3, card.id, events);
    if (kw.includes('snuff') && hostileTargetable(opp, slot)) blowOut(state, oppSide, slot, events);
    if (kw.includes('ignite') && me.board.filter(Boolean).length >= 3) drawCards(state, side, 1, 'effect', events);
    if (def.effect === 'io_draw') drawCards(state, side, 1, 'effect', events);
    if (def.effect === 'lian_rally') {
      for (let i = 0; i < SLOTS; i++) {
        const c = me.board[i];
        if (c && defOf(c).keywords.includes('light')) addBuff(state, side, i, 2, card.id, events);
      }
    }
    if (def.effect === 'fortune') {
      const pool = opp.hand.map((c) => c.id);
      shuffle(state, pool);
      events.push({ type: 'reveal', side, cardIds: pool.slice(0, 3) });
    }
  }
  if (state.moon === 'starfall' && me.starfallDraws < 2) {
    me.starfallDraws++;
    drawCards(state, side, 1, 'effect', events);
  }
}

/** Resolve auto-passes, night settlement, next nights and match end until a real decision is needed. */
function normalize(state: MatchState, events: CardEvent[]): void {
  for (let guard = 0; guard < 100 && state.phase === 'playing'; guard++) {
    const [a, b] = state.sides;
    if (a.passed && b.passed) {
      endNight(state, events);
      continue;
    }
    if (state.sides[state.current].passed) {
      state.current = other(state.current);
      continue;
    }
    if (legalPlays(state, state.current).length === 0) {
      doPass(state, state.current, true, events);
      state.current = other(state.current);
      continue;
    }
    return;
  }
}

function endNight(state: MatchState, events: CardEvent[]): void {
  const pv = previewNight(state);
  for (const side of [0, 1] as Side[]) {
    pv.burned[side].forEach((b, slot) => {
      const c = state.sides[side].board[slot];
      if (b && c) events.push({ type: 'burn', side, slot, uid: c.uid });
    });
  }
  const [t0, t1] = pv.totals;
  const winner: Side | 'tie' = t0 > t1 ? 0 : t1 > t0 ? 1 : 'tie';
  if (winner === 'tie') {
    state.sides[0].nightWins++;
    state.sides[1].nightWins++;
  } else state.sides[winner].nightWins++;
  state.sides[0].totalScore += t0;
  state.sides[1].totalScore += t1;
  state.nightResults.push({ night: state.night, moon: state.moon, scores: [t0, t1], winner });
  const wins: [number, number] = [state.sides[0].nightWins, state.sides[1].nightWins];
  events.push({ type: 'nightEnd', night: state.night, scores: [t0, t1], winner, wins });

  const w0 = wins[0];
  const w1 = wins[1];
  const over = w0 >= WINS_TO_WIN || w1 >= WINS_TO_WIN || state.night >= state.maxNights;
  // Board cleanup: 回響 back to hand, 餘燼 stays (halved), others discarded. Everything clears when the match ends.
  for (const side of [0, 1] as Side[]) {
    const s = state.sides[side];
    for (let slot = 0; slot < SLOTS; slot++) {
      const c = s.board[slot];
      if (!c) continue;
      const def = defOf(c);
      const burned = pv.burned[side][slot] === true;
      if (!over && burned && def.keywords.includes('echo')) {
        s.board[slot] = null;
        const to = returnToHand(state, side, c);
        events.push({ type: 'echo', side, uid: c.uid, cardId: c.id, to });
      } else if (!over && def.keywords.includes('ember')) {
        c.base = Math.max(1, Math.floor(c.base / 2));
        c.buff = 0;
        c.persisted = true;
        events.push({ type: 'ember', side, slot, uid: c.uid, power: c.base });
      } else {
        s.board[slot] = null;
        s.discard.push({ ...c, buff: 0 });
      }
    }
  }

  if (over) {
    let result: Side | 'draw';
    const t = [state.sides[0].totalScore, state.sides[1].totalScore];
    if (w0 === w1) result = t[0]! > t[1]! ? 0 : t[1]! > t[0]! ? 1 : 'draw';
    else result = w0 > w1 ? 0 : 1;
    state.phase = 'ended';
    state.winner = result;
    events.push({ type: 'matchEnd', winner: result, wins, totals: [t[0]!, t[1]!] });
    return;
  }
  const first: Side = winner === 'tie' ? other(state.firstThisNight) : other(winner);
  startNight(state, first, events);
}

/**
 * Apply an action's immediate effects without turn switching, auto-pass or night settlement.
 * Used by the AI for one-step look-ahead (and by UIs for placement previews). Pure.
 */
export function peekAction(input: MatchState, action: Action): MatchState {
  const state = cloneState(input);
  const side = state.current;
  if (action.type === 'pass') doPass(state, side, false, []);
  else doPlay(state, side, action, []);
  return state;
}
