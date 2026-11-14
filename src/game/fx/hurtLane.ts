// 主角被打的紅字走「身邊」不走「身上」（D-403，第 201 輪）。
// 以前紅字從胸口冒出來、往上穿過臉；被兩三隻怪圍著時主角臉上一直有字，加上打怪的白字與護盾字疊成一團。
// 現在往「打過來的反方向」那一側跳（像被打飛出去的），持續傷害（沒有來源）固定走左邊。純資料。
export const HURT_LANE = {
  /** 離主角中線多遠（px；floatNumber 自己還會左右抖 ±18，所以要大於 18＋半個數字寬＋半個身體） */
  side: 56,
  /** 比腳下高多少（約肩膀的高度） */
  up: 52,
};

/** srcDx＝攻擊者的 x 減主角的 x（世界座標或畫面座標都可以，只看正負）；沒有來源給 0 */
export function hurtNumberPos(px: number, py: number, srcDx: number): { x: number; y: number } {
  const dir = srcDx > 0 ? -1 : srcDx < 0 ? 1 : -1;
  return { x: px + dir * HURT_LANE.side, y: py - HURT_LANE.up };
}
