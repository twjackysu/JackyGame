// PvP 天梯的段位分（Elo，24 §6.2、第 143 輪）。獎勵只有稱號與外觀（FOR_JACKY 預設：不給數值）。
import { hashSeed } from '../rng';

export const PVP_START_RATING = 1000;
export const PVP_K = 32;
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
