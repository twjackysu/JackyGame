import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, portraitHeight } from '../src/game/screen';
import { needsRotate } from '../src/game/orientation';

describe('橫向開機與提示（D-216）', () => {
  it('觸控裝置橫著開機也照直式算高度（390×844 → 1558）', () => {
    expect(portraitHeight(390, 844, true)).toBe(1558);
    expect(portraitHeight(844, 390, true)).toBe(1558);
  });
  it('桌機橫向視窗維持 1280；長度上限 1600', () => {
    expect(portraitHeight(1280, 720, false)).toBe(BASE_HEIGHT);
    expect(portraitHeight(300, 900, true)).toBe(1600);
  });
  it('只有觸控＋橫向才蓋提示', () => {
    expect(needsRotate(844, 390, true)).toBe(true);
    expect(needsRotate(390, 844, true)).toBe(false);
    expect(needsRotate(1280, 720, false)).toBe(false);
    expect(needsRotate(1024, 768, true)).toBe(false); // 平板橫放照常玩
  });
});
