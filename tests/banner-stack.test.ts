import { describe, expect, it } from 'vitest';
import { pinY, stackY } from '../src/game/fx/bannerStack';

describe('置中大字不重疊（D-162）', () => {
  it('沒有其他大字就照原位', () => {
    expect(stackY(470, 100, [], 1000)).toBe(470);
  });
  it('重疊就往下排，連續疊三則也不互相蓋到', () => {
    const busy: [number, number][] = [];
    for (const [y, h] of [[470, 140], [560, 110], [700, 80], [600, 70]] as const) {
      const cy = stackY(y, h, busy, 1000)!;
      for (const [t, b] of busy) expect(cy + h / 2 <= t || cy - h / 2 >= b).toBe(true);
      busy.push([cy - h / 2, cy + h / 2]);
    }
  });
  it('沒重疊的不動', () => {
    expect(stackY(700, 60, [[400, 540]], 1000)).toBe(700);
  });
  it('下面放不下就排到上面', () => {
    const cy = stackY(700, 60, [[600, 760], [500, 600]], 780)!;
    expect(cy + 30).toBeLessThanOrEqual(500);
  });
  it('上下都沒位置（往上會超過 ceil）就回傳 null＝排隊（D-164）', () => {
    // 抉擇後：結語 560、兩則稀有裝備、撿裝備提示已經把 430～960 塞滿
    const busy: [number, number][] = [[480, 640], [646, 740], [746, 840], [846, 960]];
    expect(stackY(600, 90, busy, 966, 430)).toBeNull();
    // 前面的淡出一則後就有位置
    const cy = stackY(600, 90, busy.slice(1), 966, 430);
    expect(cy).not.toBeNull();
    expect(cy! - 45).toBeGreaterThanOrEqual(430);
  });
  it('往上排會蓋住主角（avoid）就排隊；原位不受影響（第 74 輪）', () => {
    // 360×640：提示在 735，主角在 601 附近
    const busy: [number, number][] = [[680, 790]];
    expect(stackY(735, 110, busy, 794, 430)).not.toBeNull();
    expect(stackY(735, 110, busy, 794, 430, [490, 630])).toBeNull();
    expect(stackY(735, 110, [], 794, 430, [490, 630])).toBe(735);
  });
  it('原位就壓在主角身上：挪到主角下方；只擦到頭頂、或下面放不下就不動（第 75 輪）', () => {
    // 360×640：相遇結語 560（三行約 140 高），主角 490～630
    const cy = stackY(560, 140, [], 794, 430, [490, 630])!;
    expect(cy - 70).toBeGreaterThanOrEqual(630);
    expect(cy + 70).toBeLessThanOrEqual(794);
    expect(stackY(470, 100, [], 794, 430, [490, 630])).toBe(470); // 只重疊 30
    expect(stackY(560, 140, [], 700, 430, [490, 630])).toBe(560); // 下面放不下
    // 390×844：主角 630～770，560 不受影響
    expect(stackY(560, 140, [], 966, 430, [630, 770])).toBe(560);
    // 挪下去之後還是會避開其他大字
    const cy2 = stackY(560, 100, [[680, 760]], 960, 430, [490, 630])!;
    expect(cy2 - 50 >= 760 || cy2 + 50 <= 680).toBe(true);
    expect(Math.min(cy2 + 50, 630) - Math.max(cy2 - 50, 490)).toBeLessThanOrEqual(50);
    // 主角下方被提示佔滿：不因為讓位而排隊，照原位出（Boss 警告不能晚）
    expect(stackY(520, 56, [[691, 779]], 794, 430, [490, 630])).toBe(520);
  });

  it('固定位置的大字讓開正在顯示的大字（第 76 輪）', () => {
    // 360×640：升級標題 430、撿裝備教學 735（TIP_Y）、主角 470～610；數值小字原位 710 高 80
    const busy: [number, number][] = [[395, 465], [710, 760]];
    const cy = pinY(710, 80, busy, 794, 430, [470, 610]);
    expect(cy + 40 + 16).toBeLessThanOrEqual(710); // 排到教學上方
    expect(Math.min(cy + 40, 610) - Math.max(cy - 40, 470)).toBeLessThanOrEqual(50);
    expect(pinY(710, 80, [], 794, 430, [470, 610])).toBe(710); // 沒人就原位
    expect(pinY(710, 80, [[700, 760]], 900, 430)).toBe(760 + 16 + 40); // 下方放得下先往下
    expect(pinY(710, 80, [[460, 1000]], 900, 430, [470, 610])).toBe(710); // 都不行照原位
  });

  it('被別的大字往下推到主角身上時改排到主角下方（第 76 輪）', () => {
    // 荊棘谷 360×640：「毒沼！」原位 470（只擦到主角頭頂），前面有大字 → 以前被推到 546 整塊蓋住主角
    expect(stackY(470, 100, [[400, 480]], 794, 430, [470, 610])).toBe(610 + 16 + 50);
    // 主角下方放不下 → 照舊（不因此排隊）
    expect(stackY(470, 100, [[400, 480]], 700, 430, [470, 610])).toBe(546);
  });

  it('不急的說明（patient）主角下方被佔住就排隊，不照原位蓋主角（第 76 輪）', () => {
    // 360×640 打倒狼王：「首次討伐！…」原位 540、稀有大字在主角下方 647～745
    expect(stackY(540, 100, [[647, 745]], 794, 430, [491, 631])).toBe(540); // 一般大字照原位（警告不能晚）
    expect(stackY(540, 100, [[647, 745]], 794, 430, [491, 631], true)).toBeNull();
    expect(stackY(540, 100, [], 794, 430, [491, 631], true)).toBe(631 + 16 + 50); // 空了就排主角下方
  });

  it('抉擇結語：3 行 30px 放不下主角下方、2 行 26px 放得下（第 77 輪）', () => {
    // 360×640 荊棘谷選「還」：主角 492～632（鏡頭還在跟時會到 519～659）、limit 0.62×1280
    expect(stackY(560, 147, [], 1280 * 0.62, 430, [492, 632])).toBe(560); // 3 行：差 2px → 照原位蓋主角
    expect(stackY(560, 92, [], 1280 * 0.62, 430, [519, 659])).toBe(659 + 16 + 46);
  });
});
