import { describe, expect, it } from 'vitest';
import { EXEC_AXE } from '../src/game/fx/effectIcon';

// 第 187 輪：「斬首」的圖示以前是交叉的兩刀（灰底白色 ✕），在 HUD 上像關閉鈕 → 改成一把斧。
// 畫出來像不像靠截圖（docs/screenshots/execute-icon-before-after.jpg）；這裡只守住幾何：斧刃是半圓、直邊貼著柄。
describe('斬首圖示的斧刃', () => {
  it('是半圓（不是整個圓，也不是一小片）', () => {
    expect(EXEC_AXE.to - EXEC_AXE.from).toBeCloseTo(Math.PI, 6);
  });
  it('直邊和柄同方向（柄從左下 (-0.8, 0.95) 到右上 (0.82, -1.05)），刃朝左上', () => {
    const handle = Math.atan2(-1.05 - 0.95, 0.82 + 0.8);
    expect(Math.abs(EXEC_AXE.to - handle)).toBeLessThan(0.02);
    const mid = (EXEC_AXE.from + EXEC_AXE.to) / 2; // 刃的正中朝向
    expect(Math.cos(mid)).toBeLessThan(0);
    expect(Math.sin(mid)).toBeLessThan(0);
  });
});
