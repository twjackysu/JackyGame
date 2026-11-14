import { describe, expect, it } from 'vitest';
import { CHEST_LOOT_COLOR, CHEST_POP, chestPopLayout } from '../src/game/fx/chestPop';

// 開寶箱的字排在寶箱旁邊（D-411）：不蓋主角、不出畫面、不頂到 HUD
describe('chestPopLayout', () => {
  const SW = 720;
  it('排在背對主角的那一側', () => {
    const r = chestPopLayout(360, 600, 300, 160, 3, SW);
    expect(r.originX).toBe(0);
    expect(r.dx).toBe(CHEST_POP.side);
    const l = chestPopLayout(360, 600, 420, 160, 3, SW);
    expect(l.originX).toBe(1);
    expect(l.dx).toBe(-CHEST_POP.side);
  });
  it('那一側放不下就換邊，整行留在畫面內', () => {
    // 寶箱貼右邊、主角在左邊 → 本來要排右邊，放不下改左邊
    const r = chestPopLayout(660, 600, 600, 160, 3, SW);
    expect(r.originX).toBe(1);
    expect(660 + r.dx - 160).toBeGreaterThanOrEqual(CHEST_POP.margin);
    const l = chestPopLayout(60, 600, 120, 160, 3, SW);
    expect(l.originX).toBe(0);
    expect(60 + l.dx + 160).toBeLessThanOrEqual(SW - CHEST_POP.margin);
  });
  it('標題在最上面，一行一行往下排，最後一行在寶箱旁', () => {
    const r = chestPopLayout(360, 600, 300, 160, 4, SW);
    expect(r.dys).toHaveLength(4);
    for (let i = 1; i < 4; i++) expect(r.dys[i]! - r.dys[i - 1]!).toBe(CHEST_POP.lineH);
    expect(r.dys[3]).toBe(-CHEST_POP.up);
  });
  it('寶箱在畫面很上面時整疊往下挪，不頂到 HUD', () => {
    const r = chestPopLayout(360, 170, 300, 160, 4, SW);
    expect(170 + r.dys[0]!).toBeGreaterThanOrEqual(CHEST_POP.top);
  });
  it('四種戰利品都有自己的顏色', () => {
    for (const k of ['gold', 'dust', 'crystal', 'potion']) expect(CHEST_LOOT_COLOR[k]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
