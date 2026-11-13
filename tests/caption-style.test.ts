import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/game/settings', () => ({ getSettings: () => ({ lowFx: false }), highFx: () => true }));

import { CAPTION_MAX_SIZE, CAPTION_POP, captionStyle, isCaption } from '../src/game/fx/feel';

// 第 190 輪（D-388）：30px 以下的「大字」其實是一整句說明／旁白，以前和公告共用標題字體 900＋10px 粗描邊＋光暈，
// 筆畫糊成一團、一長條蓋在怪身上。改成字幕條。這裡守分界與樣式；好不好讀靠截圖（docs/screenshots/caption-before-after.jpg）。
describe('說明句的字幕條', () => {
  it('照字級分：30 以下是說明句，喊出來的公告（32 以上）照舊', () => {
    expect(CAPTION_MAX_SIZE).toBe(30);
    for (const s of [26, 28, 30]) expect(isCaption(s)).toBe(true);
    for (const s of [32, 34, 40, 54, 72]) expect(isCaption(s)).toBe(false);
  });
  it('樣式：有半透明深色底、細描邊、不是 900 的標題字，顏色照呼叫端給的', () => {
    const st = captionStyle('#d8c8ff', 26);
    expect(st.color).toBe('#d8c8ff');
    expect(st.fontSize).toBe('26px');
    expect(st.fontStyle).toBe('700');
    expect(Number(st.strokeThickness)).toBeLessThanOrEqual(5);
    expect(String(st.backgroundColor)).toMatch(/rgba\(\d+,\d+,\d+,0\.\d+\)/);
    expect(st.align).toBe('center');
  });
  it('說明句不從兩倍大砸下來、沒有光暈層', () => {
    expect(CAPTION_POP).toBeLessThan(1.12);
    const src = readFileSync('src/game/fx/feel.ts', 'utf8');
    expect(src).toMatch(/const glow = caption \? null :/);
    expect(src).toMatch(/t\.setScale\(caption \? CAPTION_POP : popScale/);
  });
  it('地區說明也用同一種字幕條', () => {
    const rt = readFileSync('src/game/scenes/RtBattleScene.ts', 'utf8');
    expect(rt).toMatch(/captionStyle\(z\.danger \? '#ff8a7a' : '#d8e8ff', 26\)/);
  });
});
