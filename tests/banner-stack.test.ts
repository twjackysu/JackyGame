import { describe, expect, it } from 'vitest';
import { pinY, stackY, fightKeep } from '../src/game/fx/bannerStack';

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
    // 主角下方被提示佔滿：不因為讓位而排隊（Boss 警告不能晚）；第 95 輪起頭上貼著放得下就放頭上，不行才照原位
    expect(stackY(520, 56, [[691, 779]], 794, 430, [490, 630])).toBe(458);
    expect(stackY(520, 56, [[691, 779]], 794, 450, [490, 630])).toBe(520);
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
  it('主角下方放不下就排到主角頭上（第 89 輪，D-228）', () => {
    // 360×640 剛進荊棘谷：鏡頭夾在地圖南緣，主角腳 757 → avoid [647, 787]；開場兩行大字原位 760 高 98
    const cy = stackY(760, 98, [], 1280 * 0.62, 430, [647, 787])!;
    expect(cy + 49 + 16).toBeLessThanOrEqual(647);
    expect(cy - 49).toBeGreaterThanOrEqual(430);
    // 頭上被別的大字佔住 → 不硬塞到頭上（照以前的規則：原位超過 limit 就排隊）
    expect(stackY(760, 98, [[540, 600]], 1280 * 0.62, 430, [647, 787])).toBeNull();
  });
  it('交戰中的 Boss 在主角上方：不排到頭上（第 90 輪，D-231）', () => {
    // 360×640 打狼王：主角腳 800 → avoid [690, 830]；Boss 在 560 → keep [330, 690]；攻略提示原位 735 高 70
    expect(stackY(735, 70, [], 1280 * 0.62, 430, [690, 830], false, [330, 690])).toBe(735); // 照原位（以前的規則）
    expect(stackY(735, 70, [], 1280 * 0.62, 430, [690, 830], true, [330, 690])).toBeNull(); // 不急的排隊
    expect(stackY(735, 70, [], 1280 * 0.62, 430, [690, 830])).toBeLessThan(690); // 沒有 Boss：照 D-228 排到頭上
  });
  it('固定位置的升級數值：往上讓會蓋到交戰中的 Boss 就照原位（第 90 輪，D-231）', () => {
    // 360×640 狼王第二階段同一下升級：數值 760 高 80，被「等級提升」（560～630）和教學小字（720～790）擋住；主角 549～689、Boss 帶 [330, 549]
    expect(pinY(760, 80, [[560, 630], [720, 790]], 1280 * 0.62, 430, [549, 689])).toBeLessThan(549);
    expect(pinY(760, 80, [[560, 630], [720, 790]], 1280 * 0.62, 430, [549, 689], [330, 549])).toBe(760);
  });
  it('交戰中的 Boss 在主角下方、原位壓在 Boss 身上：排到 Boss 腳下；放不下就照原位（第 91 輪）', () => {
    // 360×640 守望者瞬移到背後：主角腳 566 → avoid [456, 596]；Boss 腳 644 → keep [596, 684]；格擋提示原位 650 高 86
    expect(stackY(650, 86, [], 1280 * 0.62, 430, [456, 596], false, [596, 684])).toBe(684 + 16 + 43);
    // Boss 腳下被別的大字佔住 → 照原本的規則（原位）
    expect(stackY(650, 86, [[720, 780]], 1280 * 0.62, 430, [456, 596], false, [596, 684])).toBe(650);
    // Boss 離太遠、腳下放不下 → 原位
    expect(stackY(650, 86, [], 1280 * 0.62, 430, [456, 596], false, [596, 740])).toBe(650);
    // 原位壓主角、主角下方就是 Boss → 挪到 Boss 腳下（不是挪到 Boss 身上）
    expect(stackY(560, 60, [], 1280 * 0.62, 430, [456, 596], false, [596, 700])).toBe(700 + 16 + 30);
    // 第 95 輪：Boss 在下方、腳下放不下，頭上只差間距 → 貼著主角頭頂放（主角腳 601 → avoid [491, 631]，Boss 腳 750）
    const c = stackY(520, 56, [], 1280 * 0.62, 430, [491, 631], false, [631, 790])!;
    expect(c - 28).toBeGreaterThanOrEqual(430);
    expect(c + 28).toBeLessThanOrEqual(491);
    // 頭上連貼著放都不夠（兩行 76 高）→ 照原位
    expect(stackY(520, 76, [], 1280 * 0.62, 430, [491, 631], false, [631, 790])).toBe(520);
    // 原位沒壓到主角也沒壓到 Boss → 不動
    expect(stackY(400 + 30, 60, [], 1280 * 0.62, 300, [456, 596], false, [596, 700])).toBe(430);
  });
});

describe('fightKeep（D-235）', () => {
  it('Boss 在上方留 230、精英留 160', () => {
    expect(fightKeep(700, 400, 110, 1280, true)).toEqual([170, 590]);
    expect(fightKeep(700, 400, 110, 1280, false)).toEqual([240, 590]);
  });
  it('對手在下方 → 主角腳下到對手腳下', () => {
    expect(fightKeep(700, 900, 110, 1280, false)).toEqual([730, 940]);
  });
  it('沒有對手、或同一高度、或遠在畫面外 → null', () => {
    expect(fightKeep(700, null, 110, 1280)).toBeNull();
    expect(fightKeep(700, 705, 110, 1280)).toBeNull();
    expect(fightKeep(700, -200, 110, 1280)).toBeNull();
  });
});

describe('原位壓在主角上方的對手 → 挪到主角下方（D-235）', () => {
  const avoid: [number, number] = [491, 631];
  const keep: [number, number] = [356, 491];
  it('狼群暴動兩行都排到主角下方', () => {
    const a = stackY(420, 74, [], 793, 430, avoid, false, keep)!;
    expect(a - 37).toBeGreaterThanOrEqual(631);
    const b = stackY(490, 46, [[a - 37, a + 37]], 793, 430, avoid, false, keep)!;
    expect(b - 23).toBeGreaterThanOrEqual(a + 37);
    expect(b + 23).toBeLessThanOrEqual(793);
  });
  it('主角下方放不下 → 照原位', () => {
    expect(stackY(420, 74, [], 700, 430, avoid, false, keep)).toBe(420);
  });
  it('沒碰到對手就不動', () => {
    expect(stackY(300, 40, [], 793, 120, avoid, false, keep)).toBe(300);
  });
});
