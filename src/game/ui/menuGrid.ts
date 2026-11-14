/**
 * 暫停選單的按鈕排成整齊的兩欄（第 203 輪）。以前每顆按鈕的寬度跟著字數走、各自置中在差不多的 x：
 * 「繼續｜音量」「行囊｜技能點」「操作設定｜前世的記憶」…左右邊緣一列一個樣，鋸齒狀，像隨手擺的。
 * 現在同一欄的按鈕一樣寬、左右對齊；單獨一列的（暴怒、深夜、落單的最後一顆）和兩欄加起來一樣寬。
 */
export const MENU_GRID = {
  /** false＝回到各自的寬度 */
  on: true,
  /** 一欄多寬、兩欄中心離畫面中線多遠（兩欄之間留 20） */
  colW: 300, colX: 160,
  /** 單獨一列的寬度＝兩欄＋中間的縫 */
  fullW: 620,
  /** 字的左右至少留多少；放不下就縮字 */
  minPad: 14, smallFont: 24,
} as const;

/** 這顆按鈕屬於哪一欄：x<0 左、x>0 右、0＝單獨一列 */
export function menuCol(x: number): -1 | 0 | 1 {
  return x < 0 ? -1 : x > 0 ? 1 : 0;
}

/** 字寬 textW 的按鈕要撐到 targetW：左右各墊多少（字比欄還寬就只留 minPad，由呼叫端先縮字） */
export function menuPad(textW: number, targetW: number): number {
  return Math.max(MENU_GRID.minPad, Math.round((targetW - textW) / 2));
}
