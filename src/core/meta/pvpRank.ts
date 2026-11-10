// PvP 天梯的段位分（Elo，24 §6.2、第 143 輪）。獎勵只有稱號與外觀（FOR_JACKY 預設：不給數值）。
import { hashSeed } from '../rng';

export const PVP_START_RATING = 1000;
export const PVP_K = 32;
/** 指名挑戰（第 149 輪，D-319）：只能挑段位分差這麼多以內的對手（不能專挑低分刷；Elo 本來就給得少，但排行也不該被灌） */
export const PVP_CHALLENGE_RANGE = 200;
export const canChallenge = (me: number, foe: number): boolean => Math.abs(foe - me) <= PVP_CHALLENGE_RANGE;

/** 超時算和局 */
export function eloDelta(me: number, foe: number, outcome: 'victory' | 'defeat' | 'timeout'): number {
  const expect = 1 / (1 + 10 ** ((foe - me) / 400));
  const score = outcome === 'victory' ? 1 : outcome === 'defeat' ? 0 : 0.5;
  return Math.round(PVP_K * (score - expect));
}
/** 段位名稱（只是稱號） */
export function rankName(r: number): string {
  return r >= 1400 ? '星隕' : r >= 1250 ? '燼紅' : r >= 1100 ? '荊棘' : r >= 950 ? '霧語' : '見習';
}

/**
 * 段位外觀（F4 獎勵只給外觀，第 146 輪）：腳下光環的顏色與層數。見習沒有；越高段越多層、星隕再加環繞的星點。
 * 純資料（顏色是 0xRRGGBB），畫面層照這個畫。
 */
export interface RankAura {
  color: number;
  /** 往外擴散的光圈層數 */
  rings: number;
  /** 環繞的光點數（0＝沒有） */
  motes: number;
}
export function rankAura(r: number): RankAura | null {
  if (r >= 1400) return { color: 0xe6d2ff, rings: 3, motes: 6 };
  if (r >= 1250) return { color: 0xff8a3d, rings: 3, motes: 3 };
  if (r >= 1100) return { color: 0x7dffb0, rings: 2, motes: 0 };
  if (r >= 950) return { color: 0x9fd8ff, rings: 1, motes: 0 };
  return null;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
/** 模擬冒險者的天梯只算最近幾天（每天重算；舊的不累積，分數不會一路飄走） */
export const SIM_LEAGUE_DAYS = 14;
/** 每人每天打幾場 */
export const SIM_LEAGUE_GAMES = 2;

/** 模擬冒險者的起始分：照程度 */
export const simBaseRating = (tier: number): number => PVP_START_RATING - 100 + tier * 30;

/**
 * 模擬冒險者彼此打的天梯（第 145 輪，D-303）：確定性，同一天同結果（伺服器、測試、重開都一樣），不用存資料庫。
 * 從 today−SIM_LEAGUE_DAYS 天開始，每人用起始分；每天每人找一個對手（hashSeed 決定），勝率照程度差（每差一級 ±6%，夾在 10～90%），Elo 更新雙方。
 */
export function simLeague(players: readonly { id: string; tier: number }[], today: number): Map<string, number> {
  const r = new Map(players.map((p) => [p.id, simBaseRating(p.tier)]));
  const n = players.length;
  if (n < 2) return r;
  for (let d = today - SIM_LEAGUE_DAYS; d < today; d++)
    for (let g = 0; g < SIM_LEAGUE_GAMES; g++)
      for (let i = 0; i < n; i++) {
        const a = players[i]!;
        const j = (i + 1 + (hashSeed(`${a.id}:${d}:${g}:foe`) % (n - 1))) % n;
        const b = players[j]!;
        const pWin = Math.min(0.9, Math.max(0.1, 0.5 + (a.tier - b.tier) * 0.06));
        const win = (hashSeed(`${a.id}:${d}:${g}:roll`) % 1000) / 1000 < pWin;
        const ra = r.get(a.id)!;
        const rb = r.get(b.id)!;
        const da = eloDelta(ra, rb, win ? 'victory' : 'defeat');
        r.set(a.id, Math.max(1, ra + da));
        r.set(b.id, Math.max(1, rb - da));
      }
  return r;
}

/** 台北時間（UTC+8，沒有日光節約）的第幾天：每日首勝用（core 不用 Date，時間由伺服器給） */
export const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
export const taipeiDay = (ms: number): number => Math.floor((ms + TAIPEI_OFFSET_MS) / DAY_MS);

/** 連勝顯示的上限（存的數字不會無限長） */
export const PVP_STREAK_CAP = 99;

/**
 * 打完一場後的連勝與「今日首勝」（第 151 輪，D-324）：只給外觀（結果畫面的字與光、天梯名字旁的「N 連勝」），不給段位分或數值。
 * 勝：連勝 +1；輸：歸零；平手（時間到）：不變。今天（台北）第一次贏 → firstWin。
 */
export function pvpStreakAfter(
  prev: { streak?: number; winDay?: number },
  outcome: 'victory' | 'defeat' | 'timeout',
  day: number,
): { streak: number; winDay?: number; firstWin: boolean } {
  const s0 = Number.isSafeInteger(prev.streak) && prev.streak! > 0 ? Math.min(prev.streak!, PVP_STREAK_CAP) : 0;
  const wd = Number.isSafeInteger(prev.winDay) ? prev.winDay : undefined;
  if (outcome === 'victory') return { streak: Math.min(s0 + 1, PVP_STREAK_CAP), winDay: day, firstWin: wd !== day };
  return { streak: outcome === 'defeat' ? 0 : s0, ...(wd !== undefined ? { winDay: wd } : {}), firstWin: false };
}

/**
 * 模擬冒險者在競技場穿什麼（第 151 輪，D-325）：照「它今天的段位分」，不是照它的程度。
 * 以前一律全身精良（物品等級照程度）→ 裝備差的玩家一路輸到 600 多分還是一場都贏不了（Elo 找不到平衡點）；
 * 分數低的對手裝備也差，輸的人掉分後就會遇到打得贏的對手，贏的人往上遇到更硬的。
 * 低於 850 分：只穿 4 件、普通；低於 760 分：只剩武器和頭盔（GEAR_SLOTS 前兩件）。
 */
export function simGearPlan(rating: number): { rarity: 1 | 2 | 3; ilvl: number; slots: number; enh: number } {
  const ilvl = Math.max(1, Math.min(12, Math.round(3 + (rating - 850) / 40)));
  const rarity = rating < 900 ? 1 : rating < 1250 ? 2 : 3;
  const slots = rating < 760 ? 2 : rating < 850 ? 4 : 6;
  // 第 152 輪（D-326）：1250 以上每 50 分強化 +1（最多 +8），冠軍區不再沒人打得過
  const enh = rating < SIM_GEAR_TOP ? 0 : Math.min(8, Math.floor((rating - SIM_GEAR_TOP) / 50));
  return { rarity, ilvl, slots, enh };
}

/**
 * 模擬冒險者的等級（第 156 輪，D-338：競技場開始算等級，對手也要有）：850 分 1 級、1000 分 6 級、1250 分 14 級、1420 分以上 20 級。
 * 分數和配裝用同一個（simGearRating），所以掉分的人遇到的對手等級也會跟著降。
 */
export function simLevel(rating: number): number {
  return Math.max(1, Math.min(20, Math.round(1 + (rating - 850) / 30)));
}

/** 模擬冒險者的技能點：等級−1 點，照種子決定先點哪幾招，一招點滿 5 級再點下一招（同種子同等級同結果） */
export function simSkillRanks(seed: number, level: number, skillIds: readonly string[]): Record<string, number> {
  const order = skillIds.map((id, i) => ({ id, k: hashSeed(`${seed}:rank:${id}`), i })).sort((a, b) => a.k - b.k || a.i - b.i);
  const out: Record<string, number> = {};
  let left = Math.max(0, Math.floor(level) - 1);
  for (const o of order) {
    if (left <= 0) break;
    const n = Math.min(5, left);
    out[o.id] = n;
    left -= n;
  }
  return out;
}

/** 模擬冒險者段位分的大約上限（它們彼此打，擠在 900～1250） */
export const SIM_GEAR_TOP = 1250;

/**
 * 配裝要照哪個分數（D-325／D-326）：平常是「對手和你比較低的那個」；
 * 你已經爬到模擬冒險者頂端（1250）以上時，超出的那段加回對手身上——
 * 不然你 1400 分遇到的永遠是 1250 分的配裝，最強的人 100% 勝、停在冠軍區。
 */
export function simGearRating(you: number, foe: number): number {
  const lo = Math.min(you, foe);
  return you > SIM_GEAR_TOP ? Math.min(you, foe + (you - SIM_GEAR_TOP)) : lo;
}

/**
 * 競技場賽季（第 153 輪，D-328；F4「賽季外觀獎勵」）：一季＝台北時間的一週（週一 00:00 起）。
 * 只記「這季最高分」「上一季最高分」「歷來最好的一季」，換季**不重置段位分**（不會讓分數一週一歸零），只給稱號：
 * 天梯顯示「本季最高／上季」，打出本季新段位時結果畫面報「本季首次到達 X」。
 * 1970-01-01 是週四 → 加 3 天讓週一變成一週的第一天。
 */
export const WEEK_MS = 7 * DAY_MS;
const WEEK_SHIFT_MS = TAIPEI_OFFSET_MS + 3 * DAY_MS;
export const taipeiWeek = (ms: number): number => Math.floor((ms + WEEK_SHIFT_MS) / WEEK_MS);
/** 這季還剩多少毫秒 */
export const seasonLeftMs = (ms: number): number => (taipeiWeek(ms) + 1) * WEEK_MS - (ms + WEEK_SHIFT_MS);

export interface PvpSeason {
  /** 這季是第幾週（taipeiWeek） */
  week: number;
  /** 這季最高段位分（換季時從當時的分數起算） */
  peak: number;
  /** 上一季（有打過的最近一季）的最高分 */
  last?: { week: number; peak: number };
  /** 歷來最好的一季最高分（不含這季） */
  best?: number;
}

const okRating = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0 && (n as number) < 100000;

/** 讀存著的賽季（壞資料當沒有）並換到 `week` 這季；rating＝目前段位分（新的一季從它起算） */
export function pvpSeasonNow(stored: string | undefined, rating: number, week: number): PvpSeason {
  let p: Partial<PvpSeason> | null = null;
  try {
    p = JSON.parse(stored ?? 'null') as Partial<PvpSeason> | null;
  } catch {
    p = null;
  }
  if (!p || typeof p !== 'object' || !Number.isSafeInteger(p.week) || !okRating(p.peak)) return { week, peak: rating };
  const best = okRating(p.best) ? p.best : undefined;
  const last = p.last && Number.isSafeInteger(p.last.week) && okRating(p.last.peak) ? { week: p.last.week, peak: p.last.peak } : undefined;
  // 同一季（或時鐘倒退）：照舊
  if (p.week! >= week) return { week: p.week!, peak: Math.max(p.peak!, rating), ...(last ? { last } : {}), ...(best !== undefined ? { best } : {}) };
  // 換季：存著的那季變成「上季」
  const nb = Math.max(best ?? 0, p.peak!);
  return { week, peak: rating, last: { week: p.week!, peak: p.peak! }, best: nb };
}

/** 打完一場後的賽季：最高分往上推；newTier＝這場讓本季第一次到達更高的段位（只給字與光） */
export function pvpSeasonAfter(stored: string | undefined, before: number, after: number, week: number): { season: PvpSeason; newTier: boolean } {
  const s = pvpSeasonNow(stored, before, week);
  const peak = Math.max(s.peak, after);
  return { season: { ...s, peak }, newTier: after > s.peak && rankName(after) !== rankName(s.peak) };
}
