// 男女主角的動漫風高解析立繪（程式繪製，600×900）。Jacky 上傳手繪立繪時會被 public/art 的版本取代。
import { animeEye, curve, fill, glow, lgrad, line, lock, lockEdges, part, rgrad, rim, shade, sparkle, vgrad, within } from './animeKit';
import type { C, P } from './animeKit';

export const AW = 600;
export const AH = 900;

// ---------------------------------------------------------------- 共用：臉
interface FaceStyle {
  skin: string; skinShadow: string; skinDeep: string; ink: string; blush: string; rimColor: string;
  /** 陰影在畫面哪一側（-1 左、1 右） */
  shadowSide: 1 | -1;
  jaw: number; // 下巴寬度係數（男 1、女 0.9）
  neck?: number; // 脖子寬度係數
}

function facePath(cx: number, f: FaceStyle): Path2D {
  const j = f.jaw;
  return curve([
    [cx - 98, 200], [cx - 100, 270], [cx - 92 * j, 330], [cx - 70 * j, 382], [cx - 34 * j, 418],
    [cx, 432, 1],
    [cx + 34 * j, 418], [cx + 70 * j, 382], [cx + 92 * j, 330], [cx + 100, 270], [cx + 98, 200], [cx, 150],
  ]);
}

function drawNeckAndFace(c: C, cx: number, f: FaceStyle): Path2D {
  // 脖子
  const nw = f.neck ?? 1;
  const neck = curve([[cx - 40 * nw, 380], [cx - 42 * nw, 470], [cx - 54 * nw, 520], [cx + 54 * nw, 520], [cx + 42 * nw, 470], [cx + 40 * nw, 380]]);
  part(c, neck, {
    fill: f.skin,
    shadow: curve([[cx - 80, 370], [cx + 80, 370], [cx + 80, 450], [cx, 470], [cx - 80, 450]]),
    shadowColor: f.skinShadow,
    ink: f.ink, inkW: 2.5,
  });
  // 耳朵
  for (const s of [-1, 1] as const) {
    const ear = curve([[cx + s * 94, 280], [cx + s * 112, 268], [cx + s * 118, 296], [cx + s * 108, 334], [cx + s * 92, 344]]);
    part(c, ear, { fill: f.skin, shadow: curve([[cx + s * 100, 285], [cx + s * 110, 290], [cx + s * 104, 330], [cx + s * 96, 330]]), shadowColor: f.skinShadow, ink: f.ink, inkW: 2.2 });
  }
  const face = facePath(cx, f);
  part(c, face, {
    fill: vgrad(c, 150, 432, [[0, f.skin], [1, f.skin]]),
    shadow: curve(f.shadowSide < 0
      ? [[cx - 140, 150], [cx - 30, 150], [cx - 62, 260], [cx - 56, 340], [cx - 30, 400], [cx - 10, 440], [cx - 140, 440]]
      : [[cx + 140, 150], [cx + 30, 150], [cx + 62, 260], [cx + 56, 340], [cx + 30, 400], [cx + 10, 440], [cx + 140, 440]]),
    shadowColor: f.skinShadow,
    rim: [-f.shadowSide * -5, -2, f.rimColor, 0.9],
    ink: f.ink, inkW: 2.6,
  });
  // 臉頰紅暈
  for (const s of [-1, 1]) {
    within(c, face, () => {
      c.fillStyle = rgrad(c, cx + s * 58, 350, 0, 34, [[0, f.blush], [1, 'rgba(255,120,120,0)']]);
      c.fillRect(cx + s * 58 - 40, 310, 80, 80);
    });
  }
  return face;
}

// ---------------------------------------------------------------- 連恩
export function drawLian(c: C): void {
  const cx = 300;
  const ink = '#2a1612';
  const navy = '#1d2746';
  const navyDark = '#0c1124';
  const warm = 'rgba(255,190,110,1)';

  // 背後光暈
  c.fillStyle = rgrad(c, 330, 420, 20, 420, [[0, 'rgba(255,170,90,0.28)'], [0.5, 'rgba(255,140,70,0.08)'], [1, 'rgba(255,140,70,0)']]);
  c.fillRect(0, 0, AW, AH);

  // 後髮（後腦）
  const backHair = curve([[cx - 120, 300], [cx - 132, 200], [cx - 96, 110], [cx, 76], [cx + 100, 106], [cx + 134, 196], [cx + 124, 300], [cx + 96, 370], [cx - 96, 370]]);
  fill(c, backHair, '#1e1412');

  // ---- 大衣（肩膀與胸口）
  const coat = curve([
    [-20, AH + 20], [10, 640], [40, 560], [110, 506], [210, 478], [cx, 484], [390, 478], [490, 506], [560, 560], [590, 640], [620, AH + 20],
  ]);
  part(c, coat, {
    fill: vgrad(c, 470, AH, [[0, '#2a3760'], [0.5, navy], [1, navyDark]]),
    shadow: curve([[-40, 560], [180, 500], [210, 620], [170, AH + 40], [-40, AH + 40]]),
    shadowColor: 'rgba(5,8,20,0.55)',
    rim: [-6, 4, 'rgba(255,196,120,0.95)'],
    ink: '#070a16', inkW: 3,
    extra: () => {
      // 布料皺褶
      for (const [pts, col, w] of [
        [[[150, 560], [170, 700], [160, 900]], 'rgba(0,0,0,0.35)', 5],
        [[[450, 560], [430, 700], [440, 900]], 'rgba(255,190,120,0.25)', 3],
        [[[90, 640], [110, 760], [96, 900]], 'rgba(0,0,0,0.3)', 4],
        [[[520, 640], [505, 780], [515, 900]], 'rgba(255,190,120,0.2)', 3],
      ] as [P[], string, number][]) line(c, curve(pts, false), col, w);
    },
  });
  // 內襯背心（深紅褐）與白襯衫領
  const vest = curve([[cx - 96, 520], [cx - 70, 900], [cx + 70, 900], [cx + 96, 520], [cx, 600]]);
  part(c, vest, {
    fill: vgrad(c, 520, AH, [[0, '#4a2a26'], [1, '#1c0f10']]),
    shadow: curve([[cx - 120, 500], [cx - 10, 560], [cx - 20, 900], [cx - 120, 900]]), shadowColor: 'rgba(0,0,0,0.35)',
    rim: [-4, 0, 'rgba(255,190,120,0.7)'], ink: '#0c0606', inkW: 2.5,
  });
  // 背心鈕扣
  for (const y of [660, 730, 800]) {
    const b = new Path2D(); b.arc(cx + 4, y, 6, 0, Math.PI * 2);
    part(c, b, { fill: rgrad(c, cx + 6, y - 2, 0, 7, [[0, '#fff2c0'], [0.5, '#e0a84a'], [1, '#7a4a1a']]), ink: '#2a1606', inkW: 1.5 });
  }
  // 大衣立領（左右兩片）
  for (const s of [-1, 1] as const) {
    const lapel = curve([[cx + s * 70, 480], [cx + s * 150, 470], [cx + s * 190, 520], [cx + s * 130, 640, 1], [cx + s * 96, 560]]);
    part(c, lapel, {
      fill: vgrad(c, 470, 640, [[0, '#34446f'], [1, '#141b34']]),
      shadow: s < 0 ? curve([[cx - 220, 460], [cx - 120, 470], [cx - 110, 660], [cx - 220, 660]]) : undefined,
      shadowColor: 'rgba(0,0,0,0.4)',
      rim: [s * 4, 3, 'rgba(255,200,130,0.9)'], ink: '#070a16', inkW: 2.5,
    });
    // 黃銅扣
    for (const y of [600, 690, 780]) {
      const bx = cx + s * 122 + (y - 600) * s * 0.05;
      const b = new Path2D(); b.arc(bx, y, 9, 0, Math.PI * 2);
      part(c, b, { fill: rgrad(c, bx + 3, y - 3, 0, 10, [[0, '#fff4c8'], [0.45, '#e2a64c'], [1, '#6a3a12']]), ink: '#2a1606', inkW: 1.8 });
      glow(c, bx + 3, y - 3, 14, 'rgba(255,200,120,0.5)');
    }
  }

  // ---- 臉與脖子
  const f: FaceStyle = { skin: '#f6d9c4', skinShadow: '#dca78e', skinDeep: '#b9806a', ink, blush: 'rgba(240,120,110,0.28)', rimColor: '#ffd7a0', shadowSide: -1, jaw: 0.94 };
  const face = drawNeckAndFace(c, cx, f);

  // ---- 紅圍巾（繞頸，垂尾在左）
  const scarf = curve([[cx - 120, 470], [cx - 60, 440], [cx, 452], [cx + 62, 440], [cx + 124, 468], [cx + 118, 520], [cx + 40, 540], [cx - 40, 540], [cx - 124, 520]]);
  const scarfFill = vgrad(c, 430, 560, [[0, '#c4433a'], [0.6, '#8a2228'], [1, '#4a1018']]);
  part(c, scarf, {
    fill: scarfFill,
    shadow: curve([[cx - 160, 500], [cx + 160, 500], [cx + 160, 560], [cx - 160, 560]]), shadowColor: 'rgba(60,0,10,0.35)',
    rim: [-4, 3, 'rgba(255,190,130,0.9)'], ink: '#2a0608', inkW: 2.6,
    extra: () => {
      line(c, curve([[cx - 100, 490], [cx - 20, 500], [cx + 60, 488], [cx + 110, 494]], false), 'rgba(40,0,6,0.45)', 3);
      line(c, curve([[cx - 80, 512], [cx, 522], [cx + 90, 510]], false), 'rgba(255,170,130,0.35)', 2);
    },
  });
  const tail = curve([[cx - 96, 512], [cx - 60, 520], [cx - 70, 620], [cx - 54, 720, 1], [cx - 90, 708], [cx - 108, 716, 1], [cx - 118, 620]]);
  part(c, tail, {
    fill: lgrad(c, 0, 512, 0, 720, [[0, '#a8323a'], [1, '#5a141c']]),
    shadow: curve([[cx - 140, 500], [cx - 92, 510], [cx - 96, 740], [cx - 140, 740]]), shadowColor: 'rgba(40,0,6,0.4)',
    rim: [-3, 2, 'rgba(255,190,130,0.8)'], ink: '#2a0608', inkW: 2.4,
  });
  // 流蘇
  for (let i = 0; i < 5; i++) line(c, curve([[cx - 104 + i * 10, 714], [cx - 106 + i * 10, 740]], false), '#7a1a20', 3);

  // ---- 五官
  const eye = { iris: ['#4a2206', '#d88a2a', '#ffd27a'] as [string, string, string], ink: '#1c0e0a', shine: 'rgba(255,220,140,0.9)', open: 0.56, lift: 6, lash: 7.5, look: 0.4 };
  animeEye(c, cx - 50, 302, 62, -1, eye);
  animeEye(c, cx + 50, 302, 62, 1, eye);
  // 眉（銳利、微挑）
  const browL = curve([[cx - 92, 266, 1], [cx - 66, 254], [cx - 30, 262], [cx - 22, 270, 1], [cx - 60, 264], [cx - 88, 272]]);
  const browR = curve([[cx + 96, 258, 1], [cx + 70, 250], [cx + 30, 262], [cx + 22, 270, 1], [cx + 64, 258], [cx + 92, 264]]);
  fill(c, browL, '#2a1612');
  fill(c, browR, '#2a1612');
  // 鼻
  line(c, curve([[cx + 6, 330], [cx + 10, 352], [cx + 2, 360]], false), f.skinDeep, 2.2);
  fill(c, curve([[cx - 8, 356], [cx + 4, 362], [cx - 6, 364]]), 'rgba(160,90,70,0.35)');
  // 自信的歪嘴笑
  line(c, curve([[cx - 22, 392], [cx + 2, 398], [cx + 24, 390], [cx + 30, 382]], false), '#5a2a22', 3);
  line(c, curve([[cx - 8, 404], [cx + 8, 404]], false), 'rgba(160,90,70,0.4)', 2);
  // 臉部投影（瀏海下）
  shade(c, face, curve([[cx - 120, 150], [cx + 120, 150], [cx + 120, 236], [cx + 60, 250], [cx, 236], [cx - 60, 256], [cx - 120, 240]]), 'rgba(170,100,80,0.35)');

  // ---- 前髮（亂翹短髮，深棕＋琥珀挑染）
  const hairFill = vgrad(c, 70, 340, [[0, '#4a3026'], [0.5, '#2e1c18'], [1, '#1a0f0e']]);
  const hairInk = '#0e0706';
  // 亂翹的整體輪廓（尖角向外散開）
  const hairTop = curve([
    [cx - 122, 306, 1], [cx - 128, 262], [cx - 156, 236, 1], [cx - 134, 210], [cx - 166, 168, 1], [cx - 132, 150], [cx - 150, 104, 1],
    [cx - 100, 104], [cx - 92, 56, 1], [cx - 46, 80], [cx - 14, 34, 1], [cx + 22, 70], [cx + 74, 40, 1], [cx + 84, 86],
    [cx + 142, 82, 1], [cx + 126, 128], [cx + 170, 150, 1], [cx + 138, 186], [cx + 164, 230, 1], [cx + 134, 244], [cx + 142, 300, 1],
    [cx + 112, 262], [cx + 100, 300, 1], [cx + 84, 236], [cx + 56, 268, 1], [cx + 34, 226], [cx + 12, 252, 1], [cx - 12, 224],
    [cx - 32, 262, 1], [cx - 56, 230], [cx - 76, 274, 1], [cx - 92, 240], [cx - 110, 296, 1],
  ]);
  part(c, hairTop, {
    fill: hairFill,
    shadow: curve([[cx - 200, 120], [cx - 40, 150], [cx - 60, 320], [cx - 200, 320]]), shadowColor: 'rgba(6,3,3,0.45)',
    rim: [-5, 3, 'rgba(255,186,110,0.9)'], ink: hairInk, inkW: 3,
  });
  // 髮流線
  for (const pts of [
    [[cx - 60, 90], [cx - 96, 150], [cx - 130, 200]], [[cx + 10, 70], [cx + 30, 120], [cx + 70, 150]], [[cx + 90, 90], [cx + 120, 150], [cx + 150, 196]],
    [[cx - 20, 80], [cx - 40, 130], [cx - 90, 170]],
  ] as P[][]) line(c, curve(pts, false), 'rgba(10,4,4,0.6)', 2.2);
  // 瀏海束（髮根在頭頂，尖端落在額前）
  const bangs: [P, P, P, number][] = [
    [[cx - 120, 160], [cx - 70, 130], [cx - 112, 300, 1], -10],
    [[cx - 96, 130], [cx - 36, 112], [cx - 74, 272, 1], -8],
    [[cx - 58, 112], [cx + 4, 104], [cx - 30, 262, 1], -6],
    [[cx - 20, 104], [cx + 40, 104], [cx + 12, 250, 1], 4],
    [[cx + 16, 104], [cx + 76, 116], [cx + 54, 268, 1], 8],
    [[cx + 56, 116], [cx + 108, 140], [cx + 94, 282, 1], 10],
    [[cx + 90, 140], [cx + 128, 180], [cx + 120, 320, 1], 8],
    [[cx - 128, 190], [cx - 100, 160], [cx - 124, 330, 1], -4],
  ];
  for (const [a, b, t, bend] of bangs) {
    const l = lock(a, b, t, bend, 0.4, -0.05);
    part(c, l, {
      fill: hairFill,
      shadow: lock(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], t, bend, 0.4, -0.05),
      shadowColor: vgrad(c, a[1] + 10, a[1] + 80, [[0, 'rgba(8,4,4,0)'], [1, 'rgba(8,4,4,0.5)']]),
      rim: [-4, -1, vgrad(c, a[1] + 10, a[1] + 90, [[0, 'rgba(255,186,110,0)'], [1, 'rgba(255,186,110,0.85)']])],
    });
    line(c, lockEdges(a, b, t, bend, 0.4, -0.05), hairInk, 2.4);
  }
  // 鬢角（收窄臉型）
  for (const s2 of [-1, 1] as const) {
    const a: P = [cx + s2 * 128, 230], b: P = [cx + s2 * 96, 236], t: P = [cx + s2 * 92, 372, 1];
    part(c, lock(a, b, t, -s2 * 4, 0.45, -0.04), { fill: hairFill, shadow: lock(a, b, t, -s2 * 4, 0.45, -0.04), shadowColor: 'rgba(8,4,4,0.35)', rim: [-4, 0, 'rgba(255,186,110,0.8)'] });
    line(c, lockEdges(a, b, t, -s2 * 4, 0.45, -0.04), hairInk, 2.4);
  }
  // 光澤（斷續的天使環）
  for (const [x0, y0, x1, y1] of [[cx - 118, 168, cx - 76, 140], [cx - 52, 128, cx - 8, 120], [cx + 14, 120, cx + 58, 124], [cx + 80, 136, cx + 116, 160]] as [number, number, number, number][]) {
    const hl = lock([x0, y0 + 3], [x0, y0 - 3], [x1, y1, 1], 0, 0.5, 0.1);
    fill(c, hl, 'rgba(255,196,130,0.3)');
  }
  for (const [x0, y0, x1, y1] of [[cx - 50, 130, cx - 66, 240], [cx + 40, 120, cx + 62, 230], [cx + 92, 160, cx + 110, 270]] as [number, number, number, number][]) {
    line(c, curve([[x0, y0], [(x0 + x1) / 2 + 4, (y0 + y1) / 2], [x1, y1]], false), 'rgba(230,150,70,0.55)', 3);
  }

  // ---- 提燈的手（右下）與黃銅提燈
  const lx = 470, ly = 690;
  glow(c, lx, ly, 260, 'rgba(255,160,70,0.45)');
  const arm = curve([[600, 900], [540, 900], [470, 760], [452, 646], [500, 630], [560, 720], [620, 800]]);
  part(c, arm, {
    fill: vgrad(c, 620, 900, [[0, '#2c3a66'], [1, navyDark]]),
    shadow: curve([[520, 640], [640, 640], [640, 900], [560, 900]]), shadowColor: 'rgba(0,0,0,0.4)',
    rim: [6, -4, 'rgba(255,210,140,1)'], ink: '#070a16', inkW: 3,
  });
  // 手套握把
  const glove = curve([[446, 604], [474, 588], [504, 598], [508, 634], [480, 652], [452, 642]]);
  part(c, glove, { fill: vgrad(c, 588, 652, [[0, '#6a4630'], [1, '#2a1a12']]), rim: [3, -3, 'rgba(255,220,160,1)'], ink: '#140a06', inkW: 2.5 });
  // 提環
  c.save(); c.strokeStyle = '#8a5a26'; c.lineWidth = 5; c.beginPath(); c.arc(lx, 610, 22, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.restore();
  // 燈頂
  const cap = curve([[lx - 40, 640, 1], [lx + 40, 640, 1], [lx + 24, 618], [lx, 610], [lx - 24, 618]]);
  part(c, cap, { fill: vgrad(c, 610, 640, [[0, '#ffd890'], [0.5, '#b8782e'], [1, '#5a3412']]), ink: '#2a1606', inkW: 2.2 });
  // 玻璃燈罩
  const glass = curve([[lx - 36, 644, 1], [lx + 36, 644, 1], [lx + 44, 700], [lx + 34, 752, 1], [lx - 34, 752, 1], [lx - 44, 700]]);
  fill(c, glass, rgrad(c, lx, 696, 4, 56, [[0, '#ffffff'], [0.25, '#fff0b8'], [0.6, '#ffb24a'], [1, '#d0601e']]));
  // 燈芯火焰
  const flame = curve([[lx, 668, 1], [lx + 12, 696], [lx + 8, 716], [lx - 8, 716], [lx - 12, 696]]);
  fill(c, flame, '#ffffff');
  // 骨架
  for (const x of [lx - 36, lx, lx + 36]) line(c, curve([[x, 644], [x + (x - lx) * 0.2, 700], [x, 752]], false), '#7a4a1a', 3);
  line(c, glass, '#4a2a0e', 2.5);
  const base = curve([[lx - 44, 752, 1], [lx + 44, 752, 1], [lx + 34, 772, 1], [lx - 34, 772, 1]]);
  part(c, base, { fill: vgrad(c, 752, 772, [[0, '#e0a24a'], [1, '#5a3412']]), ink: '#2a1606', inkW: 2.2 });
  glow(c, lx, 696, 120, 'rgba(255,220,150,0.85)');
  glow(c, lx, 696, 46, 'rgba(255,255,230,1)');

  // 臉右側被燈光照亮（暖色疊加）
  within(c, face, () => {
    c.save();
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = lgrad(c, cx + 120, 420, cx - 60, 220, [[0, 'rgba(255,170,80,0.9)'], [1, 'rgba(255,170,80,0)']]);
    c.fillRect(0, 0, AW, AH);
    c.restore();
  });
  rim(c, face, -4, -3, 'rgba(255,214,150,0.9)');

  // 星燼火花
  for (const [x, y, r] of [[420, 560, 7], [520, 590, 5], [556, 500, 8], [400, 470, 4], [500, 420, 5], [560, 640, 4], [440, 520, 3]] as [number, number, number][]) {
    sparkle(c, x, y, r * 1.6, warm.replace('1)', '0.9)'));
  }
}

// ---------------------------------------------------------------- 伊歐
export function drawIo(c: C): void {
  const cx = 300;
  const ink = '#3a2a3a';
  const hairInk = '#5a6c92';
  const cyan = 'rgba(140,225,255,1)';

  c.fillStyle = rgrad(c, 300, 360, 20, 440, [[0, 'rgba(140,220,255,0.3)'], [0.55, 'rgba(120,180,255,0.08)'], [1, 'rgba(120,180,255,0)']]);
  c.fillRect(0, 0, AW, AH);

  // ---- 後髮（長，及腰，末端發光）
  const hairGrad = vgrad(c, 80, AH, [[0, '#e6eeff'], [0.35, '#aebee0'], [0.75, '#7488bc'], [1, '#9fe6ff']]);
  const back = curve([
    [cx - 110, 200], [cx - 140, 320], [cx - 170, 480], [cx - 210, 640], [cx - 250, 800], [cx - 240, AH + 20], [cx + 240, AH + 20], [cx + 250, 800],
    [cx + 210, 640], [cx + 170, 480], [cx + 140, 320], [cx + 110, 200], [cx, 70],
  ]);
  part(c, back, {
    fill: hairGrad,
    shadow: curve([[cx - 120, 380], [cx + 120, 380], [cx + 150, AH], [cx - 150, AH]]), shadowColor: 'rgba(70,90,150,0.35)',
    ink: hairInk, inkW: 2.5,
    extra: () => {
      for (let i = 0; i < 14; i++) {
        const x = cx - 220 + i * 34;
        line(c, curve([[x * 0.6 + cx * 0.4, 300], [x + 6, 600], [x + (x - cx) * 0.1, 900]], false), 'rgba(90,110,170,0.28)', 2);
      }
      // 末端發光
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = vgrad(c, 700, AH, [[0, 'rgba(140,230,255,0)'], [1, 'rgba(140,230,255,0.6)']]);
      c.fillRect(0, 700, AW, 200);
      c.restore();
    },
  });

  // ---- 洋裝（白與淡藍，層次領）
  const body = curve([[30, AH + 20], [50, 690], [80, 590], [150, 526], [230, 500], [cx, 506], [370, 500], [450, 526], [520, 590], [550, 690], [570, AH + 20]]);
  part(c, body, {
    fill: vgrad(c, 500, AH, [[0, '#f4f7ff'], [0.6, '#d6e2f6'], [1, '#9fb2d8']]),
    shadow: curve([[0, 560], [170, 520], [220, 640], [200, AH + 40], [0, AH + 40]]), shadowColor: 'rgba(110,130,190,0.4)',
    rim: [4, 4, 'rgba(200,245,255,1)'], ink: '#6a7aa6', inkW: 2.6,
    extra: () => {
      for (const [pts, col, w] of [
        [[[200, 620], [212, 760], [200, 900]], 'rgba(100,120,180,0.35)', 3],
        [[[400, 620], [392, 760], [402, 900]], 'rgba(100,120,180,0.3)', 3],
        [[[300, 660], [304, 780], [298, 900]], 'rgba(100,120,180,0.2)', 2],
      ] as [P[], string, number][]) line(c, curve(pts, false), col, w);
    },
  });
  // 淡藍胸前布片＋金線
  const bodice = curve([[cx - 84, 548], [cx, 596], [cx + 84, 548], [cx + 70, 720], [cx, 744, 1], [cx - 70, 720]]);
  part(c, bodice, {
    fill: vgrad(c, 540, 790, [[0, '#7fa6e0'], [1, '#2e4c8c']]),
    shadow: curve([[cx - 140, 520], [cx - 20, 580], [cx - 30, 800], [cx - 140, 800]]), shadowColor: 'rgba(60,80,140,0.35)',
    rim: [4, 3, 'rgba(220,250,255,1)'], ink: '#4a5a8a', inkW: 2.2,
  });
  line(c, curve([[cx - 80, 554], [cx, 602], [cx + 80, 554]], false), '#e8c87a', 3);
  for (const y of [684, 706]) line(c, curve([[cx - 22, y], [cx, y + 10], [cx + 22, y]], false), 'rgba(232,200,122,0.8)', 2);
  // 胸前星石
  glow(c, cx, 640, 60, 'rgba(140,230,255,0.9)');
  const gem = curve([[cx, 616, 1], [cx + 16, 640, 1], [cx, 666, 1], [cx - 16, 640, 1]]);
  part(c, gem, { fill: lgrad(c, cx - 16, 616, cx + 16, 666, [[0, '#ffffff'], [0.5, '#8ce4ff'], [1, '#3a7ac0']]), ink: '#2a4a7a', inkW: 2 });
  sparkle(c, cx - 4, 630, 10, cyan);

  // ---- 臉與脖子
  const f: FaceStyle = { skin: '#fbe9e1', skinShadow: '#e4c3c8', skinDeep: '#c99aa4', ink, blush: 'rgba(255,140,160,0.35)', rimColor: '#d8f6ff', shadowSide: 1, jaw: 0.88, neck: 0.78 };
  const face = drawNeckAndFace(c, cx, f);
  // 頸飾（細緞帶）
  line(c, curve([[cx - 44, 470], [cx, 482], [cx + 44, 470]], false), '#7fb4e8', 5);

  // 半透明披肩（蓋在肩上）
  for (const s of [-1, 1] as const) {
    const shawl = curve([[cx + s * 60, 500], [cx + s * 170, 512], [cx + s * 250, 580], [cx + s * 270, 720], [cx + s * 230, 860, 1], [cx + s * 190, 700], [cx + s * 120, 600]]);
    c.save();
    fill(c, shawl, vgrad(c, 500, 860, [[0, 'rgba(200,236,255,0.45)'], [1, 'rgba(160,210,255,0.2)']]));
    rim(c, shawl, s * 4, 4, 'rgba(230,252,255,0.8)');
    line(c, shawl, 'rgba(140,190,240,0.6)', 2);
    c.restore();
  }

  // ---- 五官（大眼、溫柔）
  const eye = { iris: ['#1a3a6a', '#4aa8e0', '#c8f4ff'] as [string, string, string], ink: '#2a2238', shine: 'rgba(170,240,255,1)', open: 0.86, lift: 2, lash: 7.5, flick: true, look: 0 };
  animeEye(c, cx - 50, 306, 66, -1, eye);
  animeEye(c, cx + 50, 306, 66, 1, eye);
  // 細眉（微微八字，溫柔）
  line(c, curve([[cx - 84, 252], [cx - 60, 244], [cx - 32, 250]], false), '#8a92b0', 3);
  line(c, curve([[cx + 32, 250], [cx + 60, 244], [cx + 84, 252]], false), '#8a92b0', 3);
  // 鼻、嘴
  line(c, curve([[cx - 2, 348], [cx + 3, 360]], false), f.skinDeep, 2);
  line(c, curve([[cx - 16, 390], [cx, 397], [cx + 16, 390]], false), '#a85a6a', 2.6);
  fill(c, curve([[cx - 8, 396], [cx + 8, 396], [cx, 402]]), 'rgba(220,120,140,0.5)');
  shade(c, face, curve([[cx - 120, 150], [cx + 120, 150], [cx + 120, 240], [cx + 50, 254], [cx, 240], [cx - 50, 254], [cx - 120, 240]]), 'rgba(170,140,170,0.35)');

  // ---- 前髮（細碎瀏海 + 兩側長髮垂到胸前）
  const hairFront = vgrad(c, 60, 300, [[0, '#ffffff'], [0.6, '#dfe8f8'], [1, '#aabbe0']]);
  const top = curve([[cx - 120, 300], [cx - 132, 200], [cx - 104, 120], [cx - 40, 80], [cx + 40, 80], [cx + 104, 120], [cx + 132, 200], [cx + 120, 300], [cx + 104, 250], [cx + 88, 196], [cx + 60, 230, 1], [cx + 36, 180], [cx + 8, 200, 1], [cx - 8, 200, 1], [cx - 36, 180], [cx - 60, 230, 1], [cx - 88, 196], [cx - 104, 250]]);
  part(c, top, { fill: hairFront, ink: hairInk, inkW: 2.6 });
  // 中分、長短交錯、尖端收細的瀏海
  const bangs: [P, P, P, number][] = [
    [[cx - 124, 170], [cx - 84, 124], [cx - 112, 316, 1], -4],
    [[cx - 96, 128], [cx - 50, 102], [cx - 78, 262, 1], -6],
    [[cx - 64, 106], [cx - 16, 90], [cx - 54, 290, 1], -8],
    [[cx - 34, 94], [cx - 2, 86], [cx - 20, 234, 1], -3],
    [[cx + 2, 86], [cx + 36, 94], [cx + 24, 240, 1], 3],
    [[cx + 18, 90], [cx + 66, 106], [cx + 56, 292, 1], 8],
    [[cx + 52, 102], [cx + 98, 128], [cx + 82, 258, 1], 6],
    [[cx + 84, 124], [cx + 124, 170], [cx + 114, 318, 1], 4],
  ];
  for (const [a, b, t, bend] of bangs) {
    const l = lock(a, b, t, bend, 0.42, -0.08);
    part(c, l, {
      fill: hairFront,
      shadow: lock([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, t, bend, 0.42, -0.08),
      shadowColor: vgrad(c, a[1] + 10, a[1] + 80, [[0, 'rgba(120,140,200,0)'], [1, 'rgba(120,140,200,0.4)']]),
      rim: [3, -1, vgrad(c, a[1] + 10, a[1] + 90, [[0, 'rgba(200,245,255,0)'], [1, 'rgba(200,245,255,0.9)']])],
    });
    line(c, lockEdges(a, b, t, bend, 0.42, -0.08), hairInk, 2);
  }
  // 細髮絲（翹起的呆毛＋散落的細毛）
  line(c, curve([[cx + 6, 84], [cx + 30, 40], [cx + 60, 46]], false), hairInk, 2.4);
  line(c, curve([[cx + 8, 84], [cx + 30, 44], [cx + 58, 48]], false), '#ffffff', 1.4);
  // 兩側長髮（框住臉、垂到胸前）
  for (const s of [-1, 1] as const) {
    const side = curve([[cx + s * 96, 170], [cx + s * 132, 260], [cx + s * 128, 400], [cx + s * 142, 560], [cx + s * 126, 720, 1], [cx + s * 104, 600], [cx + s * 96, 440], [cx + s * 86, 300]]);
    part(c, side, {
      fill: vgrad(c, 170, 720, [[0, '#f4f8ff'], [0.7, '#b8c8e8'], [1, '#c8f6ff']]),
      shadow: curve([[cx + s * 80, 300], [cx + s * 112, 300], [cx + s * 110, 720], [cx + s * 80, 720]]), shadowColor: 'rgba(110,130,190,0.35)',
      rim: [-s * 3, 3, 'rgba(210,248,255,0.9)'], ink: hairInk, inkW: 2.2,
    });
    line(c, curve([[cx + s * 112, 320], [cx + s * 116, 500], [cx + s * 120, 640]], false), 'rgba(110,130,190,0.4)', 2);
  }
  // 天使光環般的髮光帶
  for (const [x0, y0, x1, y1] of [[cx - 116, 176, cx - 72, 140], [cx - 54, 130, cx - 10, 122], [cx + 12, 122, cx + 56, 130], [cx + 74, 142, cx + 116, 176]] as [number, number, number, number][]) {
    fill(c, lock([x0, y0 + 3], [x0, y0 - 3], [x1, y1, 1], 0, 0.5, 0.1), 'rgba(255,255,255,0.8)');
  }
  // 星形髮飾（左側）
  const sx = cx - 104, sy = 178;
  glow(c, sx, sy, 50, 'rgba(140,230,255,0.9)');
  const star = new Path2D();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 20 : 8;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) star.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); else star.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
  }
  star.closePath();
  part(c, star, { fill: rgrad(c, sx, sy, 0, 20, [[0, '#ffffff'], [0.6, '#bff0ff'], [1, '#5aa8e0']]), ink: '#3a6aa0', inkW: 1.6 });

  // 月光：上方冷光
  within(c, face, () => {
    c.save();
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = vgrad(c, 140, 440, [[0, 'rgba(180,230,255,0.6)'], [1, 'rgba(180,230,255,0)']]);
    c.fillRect(0, 0, AW, AH);
    c.restore();
  });

  // 光點
  for (const [x, y, r] of [[90, 220, 9], [520, 180, 11], [480, 380, 6], [110, 420, 6], [540, 560, 8], [60, 600, 5], [440, 90, 6], [150, 90, 5], [500, 760, 6], [80, 780, 7]] as [number, number, number][]) {
    sparkle(c, x, y, r * 1.5, cyan.replace('1)', '0.95)'));
  }
}
