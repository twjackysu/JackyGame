// 連擊數字合併（第 189 輪）：多段招（星河貫射、流星雨、旋風斬…）以前每一段各跳一個數字，
// 同一隻怪頭上疊五六個「30」互相蓋住，看不出總共打了多少。改成：同一隻怪在很短時間內連續被打，
// 就把數字加到同一個上面、原地再彈一次（數字一路往上跳），最後一下之後才飄走。
// 只是畫面上的呈現：每一下的傷害事件、結算都沒動。這裡是純函式，方便測試。

/** 距離上一下多久以內算同一串（毫秒，遊戲時間） */
export const COMBO_GAP_MS = 420;
/** 一串最長累計多久就收掉、另起一個（一直被打的 Boss 不會頂著一個永遠不飄走的數字） */
export const COMBO_MAX_MS = 1600;
/** 每多一下字大一點，最多大幾 px */
export const COMBO_GROW_PX = 2;
export const COMBO_GROW_MAX = 6;

export interface Combo { first: number; last: number; sum: number; hits: number; crit: boolean; ult: boolean; size: number }

/** 這一下要不要接在上一串後面 */
export function comboContinues(c: Pick<Combo, 'first' | 'last'> | undefined, now: number): boolean {
  if (!c) return false;
  if (now < c.last) return false; // 時鐘倒退（換場景）
  return now - c.last <= COMBO_GAP_MS && now - c.first <= COMBO_MAX_MS;
}

/** 把這一下併進去（沒有上一串就開新的）。回傳新的累計 */
export function comboAdd(c: Combo | undefined, now: number, hit: { amount: number; crit: boolean; ult: boolean; size: number }): Combo {
  if (!c || !comboContinues(c, now)) return { first: now, last: now, sum: hit.amount, hits: 1, crit: hit.crit, ult: hit.ult, size: hit.size };
  return { first: c.first, last: now, sum: c.sum + hit.amount, hits: c.hits + 1, crit: c.crit || hit.crit, ult: c.ult || hit.ult, size: Math.max(c.size, hit.size) };
}

/** 這一串現在要用多大的字 */
export function comboSize(c: Pick<Combo, 'size' | 'hits'>): number {
  return c.size + Math.min(COMBO_GROW_MAX, (c.hits - 1) * COMBO_GROW_PX);
}

/** 顯示的字：累計值；裡面有暴擊就帶驚嘆號 */
export function comboText(c: Pick<Combo, 'sum' | 'crit'>): string {
  return `${c.sum}${c.crit ? '!' : ''}`;
}
