// 第 202 輪：小怪也會蓋住主角（疊畫主角）、小怪的血條壓到主角頭／胸口時畫淡——規則是純函式
import { afterEach, describe, expect, it } from 'vitest';
import { BAR_OVER_HERO_ALPHA, HERO_GHOST_ALPHA, OCCLUDE, OCCLUDE_ALPHA, barOverHero, crowdCoversHero, crowdStep, ghostAlpha } from '../src/game/fx/occlude';

const hero = { x: 360, y: 720, w: 55, h: 80 };
const foe = (x: number, bottom: number, h: number) => ({ x, y: bottom, w: h, h });

describe('小怪蓋住主角', () => {
  afterEach(() => {
    OCCLUDE.crowd = true;
  });
  it('精英狼（主角的 1.3 倍高）站在主角正前方 → 算蓋住', () => {
    expect(crowdCoversHero(foe(362, 760, 106), hero, true)).toBe(true);
  });
  it('畫在主角後面的不算（主角本來就在前面）', () => {
    expect(crowdCoversHero(foe(362, 760, 106), hero, false)).toBe(false);
  });
  it('只蓋到腿的矮狼、站在旁邊的不算', () => {
    expect(crowdCoversHero(foe(362, 760, 60), hero, true)).toBe(false);
    expect(crowdCoversHero(foe(430, 760, 106), hero, true)).toBe(false);
  });
  it('大隻的（1.5 倍以上）交給原本的規則，不重複算', () => {
    expect(crowdCoversHero(foe(362, 800, 240), hero, true)).toBe(false);
  });
  it('開關關掉就完全不算', () => {
    OCCLUDE.crowd = false;
    expect(crowdCoversHero(foe(362, 760, 106), hero, true)).toBe(false);
  });
  it('慢慢進、慢慢出，停在 0～1', () => {
    let t = crowdStep(0, true, 16);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
    for (let i = 0; i < 20; i++) t = crowdStep(t, true, 16);
    expect(t).toBe(1);
    t = crowdStep(t, false, 16);
    expect(t).toBeLessThan(1);
    for (let i = 0; i < 20; i++) t = crowdStep(t, false, 16);
    expect(t).toBe(0);
  });
  it('疊畫的主角：小怪那份比大怪那份淡；兩種都有時取比較實的', () => {
    expect(ghostAlpha(1, 0)).toBe(0);
    expect(ghostAlpha(1, 1)).toBeCloseTo(OCCLUDE.crowdGhost);
    expect(OCCLUDE.crowdGhost).toBeLessThan(HERO_GHOST_ALPHA);
    expect(ghostAlpha(OCCLUDE_ALPHA, 1)).toBeCloseTo(HERO_GHOST_ALPHA);
  });
});

describe('小怪的血條壓到主角', () => {
  it('橫在主角臉／胸口上 → 要畫淡', () => {
    expect(barOverHero({ x: 330, y: 670, w: 68, h: 8 }, hero)).toBe(true);
    expect(BAR_OVER_HERO_ALPHA).toBeLessThan(0.5);
  });
  it('在主角頭頂上方、腳邊、或旁邊 → 照常', () => {
    expect(barOverHero({ x: 330, y: 630, w: 68, h: 8 }, hero)).toBe(false);
    expect(barOverHero({ x: 330, y: 705, w: 68, h: 8 }, hero)).toBe(false);
    expect(barOverHero({ x: 400, y: 670, w: 68, h: 8 }, hero)).toBe(false);
  });
});
