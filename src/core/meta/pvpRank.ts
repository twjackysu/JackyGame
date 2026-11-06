// PvP 天梯的段位分（Elo，24 §6.2、第 143 輪）。獎勵只有稱號與外觀（FOR_JACKY 預設：不給數值）。
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
