import { describe, expect, it } from 'vitest';
import { ELITE_ARROW_M, belowBlessHud, blessHudRect, inViewForArrow, showOffscreenArrow } from '../src/game/arrowRules';

describe('畫面外箭頭（D-176）', () => {
  const base = { mini: true, elite: true, boss: false, combat: false, distM: 10 };
  it('Boss 與追過來的怪一律畫', () => {
    expect(showOffscreenArrow({ ...base, boss: true, distM: 90 })).toBe(true);
    expect(showOffscreenArrow({ ...base, elite: false, combat: true, distM: 90 })).toBe(true);
  });
  it('待機精英只在附近才畫、待機一般怪不畫', () => {
    expect(showOffscreenArrow({ ...base, distM: ELITE_ARROW_M })).toBe(true);
    expect(showOffscreenArrow({ ...base, distM: ELITE_ARROW_M + 1 })).toBe(false);
    expect(showOffscreenArrow({ ...base, elite: false })).toBe(false);
  });
  it('沒有小地圖的小關卡照舊全部畫', () => {
    expect(showOffscreenArrow({ ...base, mini: false, elite: false, distM: 99 })).toBe(true);
  });
});

describe('箭頭不壓右上角的祝福火苗與圖示（第 171 輪）', () => {
  const W = 780;
  it('範圍跟著祝福數變寬；有獨特效果多一排；沒開祝福也沒有獨特效果＝沒有範圍', () => {
    const r0 = blessHudRect(W, { taken: 0, perm: 0, off: false })!;
    const r3 = blessHudRect(W, { taken: 3, perm: 0, off: false })!;
    expect(r0.left).toBe(W - 82);
    expect(r3.left).toBe(W - 46 - 66 - 2 * 50 - 24);
    expect(blessHudRect(W, { taken: 0, perm: 1, off: false })!.bottom).toBeGreaterThan(r0.bottom);
    expect(blessHudRect(W, { taken: 0, perm: 0, off: true })).toBeNull();
    expect(blessHudRect(W, { taken: 0, perm: 2, off: true })!.left).toBe(W - 46 - 44 - 26);
  });
  it('落在那一組上的箭頭挪到下面；旁邊與下面的不動', () => {
    const r = blessHudRect(W, { taken: 2, perm: 0, off: false })!;
    expect(belowBlessHud(W - 30, 130, r, 34)).toBe(r.bottom + 34); // 上緣、火苗正上方
    expect(belowBlessHud(W - 150, 200, r, 34)).toBe(r.bottom + 34); // 壓在祝福圖示上
    expect(belowBlessHud(W - 30, 240, r, 22)).toBe(r.bottom + 22); // 右緣、計量字旁
    expect(belowBlessHud(300, 130, r, 34)).toBe(130); // 畫面中間上緣
    expect(belowBlessHud(W - 30, 400, r, 34)).toBe(400); // 右緣下面
    expect(belowBlessHud(W - 30, 130, null, 34)).toBe(130);
  });
});

describe('看得到的怪不畫箭頭：下緣照按鈕實際位置算（第 173 輪）', () => {
  // 360×640：畫面高 1280；技能全自動＝底部一排小圓圈（y 1236）＋右下閃避鍵
  const o = { W: 720, top: 150, legacyBottom: 960, rowTop: 1170, buttons: [{ x: 610, y: 1150, r: 62 }, { x: 440, y: 1236, r: 25 }, { x: 640, y: 930, r: 40 }] };
  it('以前的下緣以上照舊算看得到；畫面外照舊不算', () => {
    expect(inViewForArrow(300, 600, o)).toBe(true);
    expect(inViewForArrow(-5, 600, o)).toBe(false);
    expect(inViewForArrow(300, 140, o)).toBe(false);
    expect(inViewForArrow(300, 1300, o)).toBe(false);
  });
  it('以前下緣到底部那一排之間：空的地方算看得到（不再把箭頭蓋在怪身上）', () => {
    expect(inViewForArrow(290, 965, o)).toBe(true);
    expect(inViewForArrow(300, 1100, o)).toBe(true);
  });
  it('被閃避鍵蓋住、或低到底部那一排：還是要箭頭', () => {
    expect(inViewForArrow(600, 1140, o)).toBe(false);
    expect(inViewForArrow(540, 1150, o)).toBe(false); // 貼著鍵的邊緣（pad 內）
    expect(inViewForArrow(300, 1200, o)).toBe(false);
  });
});
