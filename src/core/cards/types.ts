/** 燼牌 v2 engine types. Pure TypeScript, no Phaser. */

export type Side = 0 | 1;
export const SLOTS = 5;
export const HAND_START = 7;
export const HAND_DRAW_PER_NIGHT = 2;
export const HAND_CAP = 10;
export const WINS_TO_WIN = 2;

export type MoonPhase = 'new' | 'full' | 'half' | 'blood' | 'fog' | 'starfall';
/** P0 pool: 新月 / 滿月 / 弦月 / 血月. */
export const MOON_POOL_P0: readonly MoonPhase[] = ['new', 'full', 'half', 'blood'];
export const MOON_POOL_ALL: readonly MoonPhase[] = ['new', 'full', 'half', 'blood', 'fog', 'starfall'];

export interface CardInst {
  uid: number;
  id: string;
  /** Base power (halved for persisted 餘燼 cards). */
  base: number;
  /** Persistent modifier for this night (點燈 / 添油 / 灼照 / 被逐的掌燈人). Never applied to legends. */
  buff: number;
  /** True when this card stayed on the board from a previous night via 餘燼. */
  persisted: boolean;
}

export interface SideState {
  deck: CardInst[];
  hand: CardInst[];
  discard: CardInst[];
  board: (CardInst | null)[];
  passed: boolean;
  /** Extra cards drawn at the start of the next night (熄燈獎勵). */
  bonusDraw: number;
  nightWins: number;
  /** Sum of night totals across nights (2:2 tiebreak). */
  totalScore: number;
  /** 星雨 draws used this night. */
  starfallDraws: number;
}

export interface MatchConfig {
  decks: [readonly string[], readonly string[]];
  /** Maximum nights (3 normally; 2 for the tutorial). */
  nights?: number;
  moonPool?: readonly MoonPhase[];
  /** Force the first player of night 1 (otherwise 擲星 = rng). */
  firstPlayer?: Side;
  /** Per-side: guarantee these card ids in the opening hand (洛克作弊：['c_veteran']). */
  guaranteeInHand?: Partial<Record<Side, readonly string[]>>;
  /** Force a specific moon each night (index = night-1), mainly for tests/tutorial. */
  fixedMoons?: readonly MoonPhase[];
}

export interface NightResult {
  night: number;
  moon: MoonPhase;
  scores: [number, number];
  winner: Side | 'tie';
}

export interface MatchState {
  config: MatchConfig;
  rngState: number;
  nextUid: number;
  night: number;
  maxNights: number;
  moon: MoonPhase;
  current: Side;
  firstThisNight: Side;
  sides: [SideState, SideState];
  phase: 'playing' | 'ended';
  winner: Side | 'draw' | null;
  nightResults: NightResult[];
  actionCount: number;
}

export type Action = { type: 'play'; handIndex: number; slot?: number; target?: number } | { type: 'pass' };

export type CardEvent =
  | { type: 'nightStart'; night: number; first: Side }
  | { type: 'moon'; night: number; moon: MoonPhase }
  | { type: 'draw'; side: Side; count: number; reason: 'opening' | 'night' | 'bonus' | 'effect' }
  | { type: 'play'; side: Side; uid: number; cardId: string; slot?: number; target?: number }
  | { type: 'buff'; side: Side; slot: number; uid: number; amount: number; source: string }
  | { type: 'debuff'; side: Side; slot: number; uid: number; amount: number; source: string }
  | { type: 'blowout'; side: Side; slot: number; uid: number; cardId: string; to: 'hand' | 'discard' }
  | { type: 'reveal'; side: Side; cardIds: string[] }
  | { type: 'pass'; side: Side; auto: boolean; bonus: boolean }
  | { type: 'burn'; side: Side; slot: number; uid: number }
  | { type: 'echo'; side: Side; uid: number; cardId: string; to: 'hand' | 'discard' }
  | { type: 'ember'; side: Side; slot: number; uid: number; power: number }
  | { type: 'nightEnd'; night: number; scores: [number, number]; winner: Side | 'tie'; wins: [number, number] }
  | { type: 'matchEnd'; winner: Side | 'draw'; wins: [number, number]; totals: [number, number] };

/** Per-slot preview of night settlement. */
export interface NightPreview {
  /** Final per-slot powers after 對峙 (burned = 0, 血月 included). */
  powers: [number[], number[]];
  burned: [boolean[], boolean[]];
  totals: [number, number];
}

export interface ApplyResult {
  state: MatchState;
  events: CardEvent[];
}
