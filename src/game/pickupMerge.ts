/**
 * 撿到金幣／粉塵／結晶／藥水的小字（第 172 輪）：以前每撿一份跳一個字，連撿幾份就疊成一團看不出數字。
 * 規則：同一種在很短時間內連撿，併成同一個字、數字累加；不同種各佔一列，不會互相蓋住。純函式，畫面層只照著畫。
 */
export const PICKUP_MERGE_MS = 900;

/** 由下往上的列：金幣最常出現放最靠近主角 */
export const PICKUP_ROWS = ['gold', 'dust', 'crystal', 'potion'] as const;

export interface PickupTally {
  total: number;
  /** 最後一次加進來的時間（ms） */
  at: number;
}

/** prev＝同一種還在畫面上的那個字（沒有就 undefined）；回傳新的累計與是不是併進舊的 */
export function mergePickup(prev: PickupTally | undefined, amount: number, now: number): { total: number; merged: boolean } {
  if (prev && now - prev.at >= 0 && now - prev.at < PICKUP_MERGE_MS) return { total: prev.total + amount, merged: true };
  return { total: amount, merged: false };
}

export function pickupRow(kind: string): number {
  const i = (PICKUP_ROWS as readonly string[]).indexOf(kind);
  return i < 0 ? PICKUP_ROWS.length : i;
}

/** 併了幾份就大一點（上限），讓「一口氣撿很多」看得出來 */
export function pickupSize(base: number, total: number, first: number): number {
  if (first <= 0 || total <= first) return base;
  return Math.min(base + 8, base + Math.floor((total / first - 1) * 2));
}
