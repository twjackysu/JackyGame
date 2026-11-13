// 戰鬥粒子的「天花板」（第 195 輪；純函式）。
// 火花、命中火花、灼燒火星的 depth 是 800，頂端標題列（等級、血條、金幣）只有 48～50：
// 貼近畫面上緣的怪被打、熔岩口在上緣噴發時，粒子會整團飄到血條上。把 HUD 整組搬到粒子上面牽涉太多物件，
// 所以在來源擋：發射點在標題列裡的不放；其餘的粒子一飄進標題列就消失。

/** 發射點在天花板以上（標題列裡或畫面外）＝這一次不放 */
export function fxBlocked(ceil: number | undefined, y: number): boolean {
  return ceil !== undefined && y <= ceil;
}

/** 粒子一進去就消失的範圍：天花板以上的一大塊（左右各多留，斜著飛出畫面再飄回來的也算） */
export function ceilingRect(ceil: number): { x: number; y: number; w: number; h: number } {
  return { x: -4000, y: ceil - 4000, w: 8000 + 720, h: 4000 };
}
