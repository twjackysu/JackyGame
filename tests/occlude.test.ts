// 第 174 輪：大隻的怪擋住主角時變半透明（規則是純函式，畫面層只照著設不透明度）
import { describe, expect, it } from 'vitest';
import { OCCLUDE_ALPHA, coversHero, occludeStep } from '../src/game/fx/occlude';

const hero = { x: 360, y: 700, w: 60, h: 100 };
const boss = (x: number, y: number, h = 300) => ({ x, y, w: h * 0.8, h });

describe('大隻的怪擋住主角', () => {
  it('Boss 站在主角南邊、主角落在牠身體裡 → 算擋住', () => {
    expect(coversHero(boss(370, 800), hero)).toBe(true);
  });
  it('Boss 在主角北邊（主角畫在前面）→ 不算', () => {
    expect(coversHero(boss(370, 650), hero)).toBe(false);
  });
  it('主角在 Boss 旁邊、頭頂上方、或離很遠 → 不算', () => {
    expect(coversHero(boss(520, 800), hero)).toBe(false);
    expect(coversHero(boss(370, 1000), hero)).toBe(false);
    expect(coversHero(boss(900, 1200), hero)).toBe(false);
  });
  it('和主角差不多大的小怪不處理（一群狼圍上來不會整群忽明忽暗）', () => {
    expect(coversHero(boss(365, 730, 120), hero)).toBe(false);
  });
  it('不透明度慢慢過去、慢慢回來，不會超過兩端', () => {
    let a = 1;
    a = occludeStep(a, true, 16);
    expect(a).toBeLessThan(1);
    expect(a).toBeGreaterThan(OCCLUDE_ALPHA);
    for (let i = 0; i < 20; i++) a = occludeStep(a, true, 16);
    expect(a).toBe(OCCLUDE_ALPHA);
    a = occludeStep(a, false, 16);
    expect(a).toBeGreaterThan(OCCLUDE_ALPHA);
    for (let i = 0; i < 20; i++) a = occludeStep(a, false, 16);
    expect(a).toBe(1);
    expect(occludeStep(1, true, 100000)).toBe(OCCLUDE_ALPHA);
  });
});
