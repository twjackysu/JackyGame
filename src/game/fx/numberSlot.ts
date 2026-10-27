// 跳出數字的錯開（第 51 輪，純函式方便測試）：同一刻打中並排的兩隻怪，兩個「105」會黏成「105105」。
export interface NumRect { x: number; y: number; w: number; h: number; t: number }

/** 數字跳出後多久內算「還很新」（之後已經往上飄開，不用再閃） */
export const NUM_FRESH_MS = 350;

/** 回傳不會和剛跳出的數字重疊的 y（最多往上疊 3 層）；同時記下這個數字的位置 */
export function numberSlot(list: NumRect[], x: number, y: number, w: number, h: number, now: number): number {
  for (let i = list.length - 1; i >= 0; i--) if (now - list[i]!.t > NUM_FRESH_MS || list[i]!.t > now) list.splice(i, 1);
  let yy = y;
  for (let k = 0; k < 3; k++) {
    const hit = list.some((r) => Math.abs(r.x - x) < (r.w + w) / 2 && Math.abs(r.y - yy) < (r.h + h) / 2);
    if (!hit) break;
    yy -= h;
  }
  list.push({ x, y: yy, w, h, t: now });
  return yy;
}
