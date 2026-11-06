// 燼牌下注（第 142 輪 V2，D-289）：戰績格式、對手解鎖、整場重播與結算。伺服器 handler（src/server/handlers/cards.ts）
// 與畫面（src/game/ui/emberCardPanel.ts）用同一份規則。下注局的勝負由伺服器用自己的種子＋玩家的出牌紀錄重跑判定（做不了假）。
import { aiMove, applyMove, CARDS, deckWith, newCardGame, nextReward, OPPONENTS, type CardGame, type Move, type Opponent } from '../cards/emberCards';

/** 舊存檔 jg_cards 的形狀 */
export interface CardStats {
  played: number;
  won: number;
  /** 下注贏來的牌（各對手的都在這裡） */
  cards: string[];
  /** 各對手的戰績（D-129） */
  by: Record<string, { played: number; won: number }>;
  /** 留在箱子裡、不帶上場的牌（D-130，可重複 id） */
  off: string[];
}

/** 第 112 輪（D-260）：戰績欄位壞掉（不是非負整數）就當 0 */
const cnt = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** jg_cards 的字串 → 乾淨的戰績（壞掉就是空的） */
export function parseCardStats(raw: string | null | undefined): CardStats {
  try {
    const v = JSON.parse(raw ?? '{}') as Partial<CardStats> | null;
    const by: CardStats['by'] = {};
    for (const o of OPPONENTS) {
      const b = v?.by?.[o.id];
      by[o.id] = { played: cnt(b?.played), won: cnt(b?.won) };
    }
    const ids = (a: unknown): string[] => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string' && !!CARDS[x]) : []);
    return { played: cnt(v?.played), won: cnt(v?.won), cards: ids(v?.cards), by, off: ids(v?.off) };
  } catch {
    return { played: 0, won: 0, cards: [], by: {}, off: [] };
  }
}

/** 隱藏對手（D-132）：三家主線對手都贏過一次 */
export const secretOpen = (st: CardStats): boolean => OPPONENTS.filter((o) => !o.secret && !o.extra).every((o) => (st.by[o.id]?.won ?? 0) >= 1);

/** 能不能跟這位下注：存在、隱藏對手要先解鎖 */
export function canChallenge(st: CardStats, id: string): Opponent | null {
  const o = OPPONENTS.find((x) => x.id === id);
  if (!o) return null;
  if (o.secret && !secretOpen(st)) return null;
  return o;
}

/** 這副牌組＋種子開局（畫面與伺服器同一個函式，才會洗出一樣的牌） */
export const startMatch = (seed: number, deck: readonly string[], who: Opponent): CardGame => newCardGame(seed >>> 0, [deck, who.deck], who.short);

/** 玩家這邊的牌組（伺服器在開局時決定，存在對局裡） */
export const matchDeck = (st: CardStats): string[] => deckWith(st.cards, st.off);

export const MAX_MOVES = 80;

/** 出牌紀錄的形狀檢查（不合法回 null） */
export function cleanMoves(v: unknown): Move[] | null {
  if (!Array.isArray(v) || v.length > MAX_MOVES) return null;
  const out: Move[] = [];
  for (const m of v) {
    if (!m || typeof m !== 'object') return null;
    const t = (m as { type?: unknown }).type;
    if (t === 'pass') out.push({ type: 'pass' });
    else if (t === 'play') {
      const c = (m as { card?: unknown }).card;
      if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c > 40) return null;
      out.push({ type: 'play', card: c });
    } else return null;
  }
  return out;
}

/**
 * 整場重播：玩家（side 0）照紀錄出、對手（side 1）用 aiMove。
 * 回傳 null＝紀錄不合法（出了不能出的牌、打完了還有多的、紀錄用完了還沒打完）。
 */
export function replayMatch(seed: number, deck: readonly string[], who: Opponent, moves: readonly Move[]): CardGame | null {
  const g = startMatch(seed, deck, who);
  let i = 0;
  for (let guard = 0; !g.over && guard < 400; guard++) {
    if (g.turn === 1) {
      applyMove(g, 1, aiMove(g, 1, who));
      continue;
    }
    const m = moves[i++];
    if (!m || !applyMove(g, 0, m)) return null;
  }
  return g.over && i === moves.length ? g : null;
}

/** 賭注結算：贏了拿回 ×2、平手退回、輸了沒有 */
export const payout = (stake: number, winner: number | undefined): number => (winner === 0 ? stake * 2 : winner === -1 ? stake : 0);

/** 下注贏了拿到的牌（這位對手還有沒給過的） */
export const prizeOf = (st: CardStats, who: Opponent, winner: number | undefined): string | undefined => (winner === 0 ? nextReward(st.cards, who) : undefined);
