/**
 * 燼牌 v2 rule-based AI (docs 03 §6.5). One-step greedy evaluation:
 * night-win likelihood × stake + remaining hand value weighted by how many nights remain.
 */
import type { Rng } from '../rng';
import { defOf, legalActions, peekAction, previewNight } from './engine';
import { SLOTS, WINS_TO_WIN, type Action, type MatchState, type Side } from './types';

export interface AiOptions {
  /** Probability of choosing the second-best action (簡單/中 ≈ 0.3). */
  mistakeRate?: number;
  rng: Rng;
}

const other = (s: Side): Side => (s === 0 ? 1 : 0);
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
/** Assumed average value of an unseen opponent card. */
const OPP_CARD_EST = 4.5;

function handValue(state: MatchState, side: Side): number {
  let v = 0;
  for (const c of state.sides[side].hand) {
    const d = defOf(c);
    v += d.kind === 'spell' ? 3 : c.base;
  }
  return v;
}

function evaluate(before: MatchState, after: MatchState, side: Side, action: Action): number {
  const opp = other(side);
  const pv = previewNight(after);
  const margin = pv.totals[side] - pv.totals[opp];
  const oppS = after.sides[opp];
  const meS = after.sides[side];
  const lastNight = before.night >= before.maxNights;
  // Stake: a night is worth more when it decides the match.
  let stake = 10;
  if (meS.nightWins === WINS_TO_WIN - 1 || oppS.nightWins === WINS_TO_WIN - 1) stake = 16;
  const handW = lastNight ? 0.05 : before.night === 1 ? 0.75 : 0.6;

  let p: number;
  if (oppS.passed) {
    p = margin > 0 ? 1 : margin === 0 ? 0.5 : 0;
  } else {
    const oppEmpty = oppS.board.filter((c) => !c).length;
    const oppReach = Math.min(oppS.hand.length, oppEmpty) * OPP_CARD_EST;
    if (action.type === 'pass') {
      // Opponent gets free rein to overtake.
      p = sigmoid((margin - Math.min(oppReach, 12) * 0.8) / 2.5);
    } else {
      const myEmpty = meS.board.filter((c) => !c).length;
      const myReach = Math.min(meS.hand.length, myEmpty) * OPP_CARD_EST;
      p = sigmoid((margin + 0.3 * (myReach - oppReach)) / 5);
    }
  }
  let score = stake * p + handW * handValue(after, side);
  if (action.type === 'pass' && !oppS.passed && !lastNight) score += handW * OPP_CARD_EST; // 熄燈獎勵
  return score;
}

function actionKey(state: MatchState, a: Action): string {
  if (a.type === 'pass') return 'pass';
  const c = state.sides[state.current].hand[a.handIndex];
  return `${c?.id}:${a.slot ?? ''}:${a.target ?? ''}`;
}

/** Score every (deduplicated) legal action for `side`, best first. */
export function rankActions(state: MatchState, side: Side): { action: Action; score: number }[] {
  if (state.phase === 'ended' || state.current !== side) return [];
  const seen = new Set<string>();
  const out: { action: Action; score: number }[] = [];
  for (const a of legalActions(state)) {
    const k = actionKey(state, a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ action: a, score: evaluate(state, peekAction(state, a), side, a) });
  }
  out.sort((x, y) => y.score - x.score);
  return out;
}

/** Choose an action for `side` (must be the player to move). */
export function chooseAction(state: MatchState, side: Side, opts: AiOptions): Action {
  const ranked = rankActions(state, side);
  if (ranked.length === 0) return { type: 'pass' };
  const second = ranked[1];
  if (second && opts.rng() < (opts.mistakeRate ?? 0)) return second.action;
  return (ranked[0] as { action: Action }).action;
}

/**
 * 洛克教學局 scripted AI: night 1 plays its weakest cards (max 3) and passes once the opponent has passed;
 * night 2+ passes immediately to demonstrate 熄燈.
 */
export function chooseTutorialAction(state: MatchState, side: Side): Action {
  const me = state.sides[side];
  if (state.night >= 2 || state.sides[other(side)].passed) return { type: 'pass' };
  if (me.board.filter(Boolean).length >= 3) return { type: 'pass' };
  let best = -1;
  me.hand.forEach((c, i) => {
    if (defOf(c).kind === 'unit' && (best < 0 || c.base < (me.hand[best]?.base ?? 99))) best = i;
  });
  if (best < 0) return { type: 'pass' };
  // Put it opposite the opponent's strongest card so the player sees 對峙 burn it.
  const opp = state.sides[other(side)].board;
  let slot = -1;
  let bestP = -1;
  for (let i = 0; i < SLOTS; i++) {
    if (me.board[i]) continue;
    const p = opp[i]?.base ?? 0;
    if (p > bestP) { bestP = p; slot = i; }
  }
  return slot < 0 ? { type: 'pass' } : { type: 'play', handIndex: best, slot };
}
