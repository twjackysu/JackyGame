// 路上的相遇（D-159）的規則與獎勵（第 147 輪搬進 core：線上版由伺服器 story.meet／story.thanks 發獎勵）。
// 台詞、位置、畫哪種人在 src/game/encounters.ts（畫面資料）；這裡只有伺服器要知道的：哪張圖、取多少、回禮多少。
// 兩邊的數字由 tests/encounter-rewards.test.ts 對照，改一邊忘了改另一邊會擋。
import type { ChoicePick } from './choices';

export interface EncounterReward {
  coin?: number;
  crystal?: number;
}

export const ENCOUNTER_REWARDS: Readonly<Record<string, { map: string; take: EncounterReward; thanks: EncounterReward }>> = {
  mw_hunter: { map: 'mistwood', take: { coin: 60 }, thanks: { coin: 40, crystal: 3 } },
  tv_mule: { map: 'thornvale', take: { coin: 100 }, thanks: { coin: 120, crystal: 2 } },
  er_miner: { map: 'emberrift', take: { crystal: 3 }, thanks: { crystal: 6 } },
  mw_herbs: { map: 'mistwood', take: { coin: 80 }, thanks: { coin: 50, crystal: 2 } },
  tv_thief: { map: 'thornvale', take: { coin: 120 }, thanks: { coin: 90, crystal: 2 } },
  er_pilgrim: { map: 'emberrift', take: { crystal: 4 }, thanks: { coin: 60, crystal: 5 } },
  sf_courier: { map: 'starfall', take: { coin: 150 }, thanks: { crystal: 6 } },
};

/** 存檔：take／spare＝選了（spare 還沒拿回禮）；thanked＝選了助、也拿過回禮 */
export type EncounterState = ChoicePick | 'thanked';

export function cleanEncounters(raw: unknown): Record<string, EncounterState> {
  const out: Record<string, EncounterState> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const id of Object.keys(ENCOUNTER_REWARDS)) {
    const v = (raw as Record<string, unknown>)[id];
    if (v === 'take' || v === 'spare' || v === 'thanked') out[id] = v;
  }
  return out;
}

/** 做出選擇（只有一次）；未知 id 或已經選過回 null */
export function meet(cur: Record<string, EncounterState>, id: string, pick: ChoicePick): Record<string, EncounterState> | null {
  if (!Object.hasOwn(ENCOUNTER_REWARDS, id) || cur[id]) return null;
  return { ...cur, [id]: pick };
}

/** 拿回禮：標成 thanked；回傳新狀態（不是待回禮的回 null） */
export function claimThanks(cur: Record<string, EncounterState>, id: string): Record<string, EncounterState> | null {
  if (cur[id] !== 'spare') return null;
  return { ...cur, [id]: 'thanked' };
}
