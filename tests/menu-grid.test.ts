import { describe, expect, it } from 'vitest';
import { MENU_GRID, menuCol, menuPad } from '../src/game/ui/menuGrid';

describe('暫停選單排成兩欄（第 203 輪）', () => {
  it('兩欄加中間的縫＝整列的寬度，而且放得進 720 寬的畫面', () => {
    expect(MENU_GRID.colX * 2 + MENU_GRID.colW).toBe(MENU_GRID.fullW);
    expect(MENU_GRID.colX * 2 - MENU_GRID.colW).toBeGreaterThanOrEqual(16); // 兩欄不相碰
    expect(MENU_GRID.fullW).toBeLessThanOrEqual(720 - 60);
  });
  it('x 的正負決定欄位', () => {
    expect(menuCol(-140)).toBe(-1);
    expect(menuCol(235)).toBe(1);
    expect(menuCol(0)).toBe(0);
  });
  it('同一欄的按鈕撐成一樣寬；字太長時至少留一點邊', () => {
    for (const w of [56, 150, 236]) expect(w + menuPad(w, MENU_GRID.colW) * 2).toBe(MENU_GRID.colW);
    expect(menuPad(400, MENU_GRID.colW)).toBe(MENU_GRID.minPad);
  });
});
