// 同伴的動漫風高解析立繪（瑟琳、莉歐拉、洛克；600×900），與 animePortraits.ts 同一套畫風。
import { AH, AW, drawNeckAndFace } from './animePortraits';
import type { FaceStyle } from './animePortraits';
import { animeEye, curve, fill, glow, lgrad, line, lock, lockEdges, part, rgrad, rim, shade, sparkle, vgrad, within } from './animeKit';
import type { C, P } from './animeKit';

const cx = 300;

function aura(c: C, x: number, y: number, inner: string, outer: string): void {
  c.fillStyle = rgrad(c, x, y, 20, 440, [[0, inner], [0.55, outer], [1, outer.replace(/[\d.]+\)$/, '0)')]]);
  c.fillRect(0, 0, AW, AH);
}

/** 一排瀏海：髮根在上、尖端在下；陰影與邊緣光從髮根漸入，避免髮根出現硬邊。 */
function bangRow(
  c: C, locks: [P, P, P, number][], fillStyle: string | CanvasGradient, ink: string, shadowRGB: string, rimRGB: string,
  rimDir: [number, number], belly = 0.42, puff = -0.06,
): void {
  for (const [a, b, t, bend] of locks) {
    const l = lock(a, b, t, bend, belly, puff);
    part(c, l, {
      fill: fillStyle,
      shadow: lock(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], t, bend, belly, puff),
      shadowColor: vgrad(c, a[1] + 10, a[1] + 80, [[0, `rgba(${shadowRGB},0)`], [1, `rgba(${shadowRGB},0.45)`]]),
      rim: [rimDir[0], rimDir[1], vgrad(c, a[1] + 10, a[1] + 90, [[0, `rgba(${rimRGB},0)`], [1, `rgba(${rimRGB},0.9)`]])],
    });
    line(c, lockEdges(a, b, t, bend, belly, puff), ink, 2.2);
  }
}

function gloss(c: C, segs: [number, number, number, number][], color: string): void {
  for (const [x0, y0, x1, y1] of segs) fill(c, lock([x0, y0 + 3], [x0, y0 - 3], [x1, y1, 1], 0, 0.5, 0.1), color);
}

function star(x: number, y: number, ro: number, ri: number): Path2D {
  const p = new Path2D();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) p.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else p.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  p.closePath();
  return p;
}

// ---------------------------------------------------------------- 瑟琳：銀藍騎士（光源＝左上銀光）
export function drawSerin(c: C): void {
  const ink = '#2a1a30';
  const hairInk = '#140c22';
  const hair = vgrad(c, 60, 760, [[0, '#6a54a8'], [0.4, '#40306e'], [1, '#1c1438']]);
  aura(c, 280, 380, 'rgba(200,212,255,0.26)', 'rgba(160,170,255,0.07)');

  // 馬尾（從後腦往右後方甩出）
  const tail = curve([[cx + 60, 120], [cx + 150, 90], [cx + 220, 140], [cx + 236, 260], [cx + 214, 400], [cx + 236, 540], [cx + 210, 680, 1], [cx + 180, 540], [cx + 160, 400], [cx + 150, 260], [cx + 110, 180]]);
  part(c, tail, {
    fill: hair,
    shadow: curve([[cx + 170, 120], [cx + 260, 120], [cx + 260, 700], [cx + 190, 700], [cx + 170, 400]]), shadowColor: 'rgba(10,6,24,0.45)',
    rim: [4, 3, 'rgba(232,220,255,0.9)'], ink: hairInk, inkW: 2.6,
    extra: () => {
      for (const dx of [0, 24, 48]) line(c, curve([[cx + 130 + dx * 0.5, 160], [cx + 170 + dx, 320], [cx + 190 + dx * 0.4, 520]], false), 'rgba(10,6,24,0.45)', 2);
    },
  });
  // 後髮
  fill(c, curve([[cx - 120, 300], [cx - 130, 190], [cx - 90, 100], [cx, 74], [cx + 96, 100], [cx + 130, 190], [cx + 120, 300], [cx + 90, 420], [cx - 90, 420]]), '#1c1438');

  // 短披風（肩後）
  const cape = curve([[0, AH + 20], [10, 640], [50, 540], [130, 490], [cx, 476], [470, 490], [550, 540], [590, 640], [600, AH + 20]]);
  part(c, cape, { fill: vgrad(c, 480, AH, [[0, '#3a56a8'], [1, '#141e48']]), rim: [4, 4, 'rgba(220,230,255,0.9)'], ink: '#0a0e22', inkW: 3 });
  // 鎧甲底衣
  const body = curve([[50, AH + 20], [70, 660], [110, 560], [190, 506], [cx, 494], [410, 506], [490, 560], [530, 660], [550, AH + 20]]);
  part(c, body, {
    fill: vgrad(c, 490, AH, [[0, '#2c3460'], [1, '#0e1228']]),
    shadow: curve([[600, 520], [380, 520], [400, AH + 40], [600, AH + 40]]), shadowColor: 'rgba(0,0,10,0.45)',
    ink: '#0a0e22', inkW: 2.6,
  });
  // 胸甲
  const plate = curve([[cx - 130, 560], [cx, 530], [cx + 130, 560], [cx + 140, 700], [cx + 100, 830], [cx, 870, 1], [cx - 100, 830], [cx - 140, 700]]);
  part(c, plate, {
    fill: lgrad(c, cx - 140, 540, cx + 140, 860, [[0, '#f2f5ff'], [0.35, '#a8b4d8'], [0.7, '#5a6898'], [1, '#2a3460']]),
    shadow: curve([[cx + 20, 520], [cx + 200, 520], [cx + 200, 900], [cx + 10, 900], [cx + 40, 700]]), shadowColor: 'rgba(20,24,60,0.4)',
    rim: [4, 4, 'rgba(255,255,255,1)'], ink: '#1a2040', inkW: 2.6,
    extra: () => {
      line(c, curve([[cx - 120, 600], [cx, 574], [cx + 120, 600]], false), 'rgba(255,255,255,0.6)', 3);
      line(c, curve([[cx, 580], [cx, 860]], false), 'rgba(20,24,60,0.35)', 2);
      // 金色鑲邊
      line(c, curve([[cx - 128, 566], [cx, 536], [cx + 128, 566]], false), '#d8b860', 4);
    },
  });
  // 星紋徽記
  glow(c, cx, 660, 80, 'rgba(200,212,255,0.8)');
  const crest = star(cx, 660, 34, 13);
  part(c, crest, { fill: rgrad(c, cx - 6, 650, 0, 34, [[0, '#ffffff'], [0.6, '#dfe6ff'], [1, '#8a9ad0']]), ink: '#3a4680', inkW: 2 });
  // 肩甲（雙層）
  for (const s of [-1, 1] as const) {
    const X = (x: number): number => cx + s * x;
    for (const [dy, sc] of [[30, 0.92], [0, 1]] as [number, number][]) {
      const pad = curve([[X(110 * sc), 500 + dy], [X(190 * sc), 486 + dy], [X(262 * sc), 530 + dy], [X(270 * sc), 600 + dy, 1], [X(200 * sc), 590 + dy], [X(120 * sc), 570 + dy]]);
      part(c, pad, {
        fill: vgrad(c, 486 + dy, 600 + dy, [[0, '#e8ecff'], [0.5, '#9aa6d0'], [1, '#3a4678']]),
        shadow: s > 0 ? curve([[X(100), 540 + dy], [X(300), 540 + dy], [X(300), 620 + dy], [X(100), 620 + dy]]) : undefined,
        shadowColor: 'rgba(20,24,60,0.4)',
        rim: [3, 4, 'rgba(255,255,255,1)'], ink: '#1a2040', inkW: 2.4,
      });
      line(c, curve([[X(130 * sc), 556 + dy], [X(200 * sc), 548 + dy], [X(250 * sc), 580 + dy]], false), '#d8b860', 3);
    }
  }

  // 臉
  const f: FaceStyle = { skin: '#f7dfd2', skinShadow: '#ddb2aa', skinDeep: '#c08a88', ink, blush: 'rgba(240,120,130,0.22)', rimColor: '#f0f2ff', shadowSide: 1, jaw: 0.88, neck: 0.8 };
  const face = drawNeckAndFace(c, cx, f);
  // 護頸
  const gorget = curve([[cx - 76, 470], [cx, 456], [cx + 76, 470], [cx + 90, 520], [cx, 536], [cx - 90, 520]]);
  part(c, gorget, { fill: vgrad(c, 456, 536, [[0, '#dfe5ff'], [1, '#56628e']]), rim: [3, 3, 'rgba(255,255,255,1)'], ink: '#1a2040', inkW: 2.4 });

  // 長劍（扛在右肩）
  const bx0 = 214, by0 = 720, bx1 = 70, by1 = 130;
  const ang = Math.atan2(by1 - by0, bx1 - bx0);
  const nx = Math.cos(ang + Math.PI / 2) * 13, ny = Math.sin(ang + Math.PI / 2) * 13;
  const blade = curve([[bx0 + nx, by0 + ny, 1], [bx1 + nx * 0.6, by1 + ny * 0.6, 1], [bx1 + (bx1 - bx0) * 0.06, by1 + (by1 - by0) * 0.06, 1], [bx1 - nx * 0.6, by1 - ny * 0.6, 1], [bx0 - nx, by0 - ny, 1]]);
  glow(c, 140, 420, 140, 'rgba(200,212,255,0.35)');
  part(c, blade, { fill: lgrad(c, bx0 - nx, by0 - ny, bx0 + nx, by0 + ny, [[0, '#ffffff'], [0.5, '#c8d4ff'], [1, '#5a6890']]), ink: '#1a2040', inkW: 2.2 });
  line(c, curve([[bx0, by0], [bx1, by1]], false), 'rgba(255,255,255,0.8)', 1.5);
  // 護手＋握柄＋手套
  const gx = bx0 + (bx1 - bx0) * -0.02, gy = by0 + (by1 - by0) * -0.02;
  const guard = curve([[gx - nx * 3.4, gy - ny * 3.4, 1], [gx + nx * 3.4, gy + ny * 3.4, 1], [gx + nx * 3.4 + 10, gy + ny * 3.4 + 16, 1], [gx - nx * 3.4 + 10, gy - ny * 3.4 + 16, 1]]);
  part(c, guard, { fill: vgrad(c, gy - 40, gy + 40, [[0, '#f8e6a8'], [1, '#8a6a2a']]), ink: '#2a1a06', inkW: 2 });
  const glove = curve([[gx - 6, gy + 14], [gx + 40, gy + 20], [gx + 54, gy + 70], [gx + 20, gy + 96], [gx - 22, gy + 70]]);
  part(c, glove, { fill: vgrad(c, gy, gy + 100, [[0, '#e0e6ff'], [1, '#4a5684']]), rim: [3, 3, 'rgba(255,255,255,1)'], ink: '#1a2040', inkW: 2.4 });

  // 五官（銳利、堅定）
  const eye = { iris: ['#2a1050', '#8a5ad8', '#e0c8ff'] as [string, string, string], ink: '#1a0c26', shine: 'rgba(220,190,255,1)', open: 0.66, lift: 8, lash: 7.5, flick: true, look: -0.2 };
  animeEye(c, cx - 50, 304, 62, -1, eye);
  animeEye(c, cx + 50, 304, 62, 1, eye);
  fill(c, curve([[cx - 90, 262, 1], [cx - 60, 252], [cx - 26, 262], [cx - 22, 268, 1], [cx - 60, 260], [cx - 88, 268]]), '#2a1e48');
  fill(c, curve([[cx + 90, 262, 1], [cx + 60, 252], [cx + 26, 262], [cx + 22, 268, 1], [cx + 60, 260], [cx + 88, 268]]), '#2a1e48');
  line(c, curve([[cx + 4, 334], [cx + 8, 354], [cx + 1, 360]], false), f.skinDeep, 2);
  line(c, curve([[cx - 16, 392], [cx + 4, 394], [cx + 18, 388]], false), '#8a3a48', 2.6);
  shade(c, face, curve([[cx - 120, 150], [cx + 120, 150], [cx + 120, 240], [cx + 50, 256], [cx, 236], [cx - 50, 250], [cx - 120, 236]]), 'rgba(170,110,120,0.32)');

  // 前髮：側分（往畫面右掃）
  const top = curve([[cx - 122, 300], [cx - 134, 196], [cx - 100, 112], [cx - 30, 76], [cx + 50, 78], [cx + 112, 116], [cx + 136, 200], [cx + 124, 300],
    [cx + 108, 250], [cx + 90, 210], [cx + 62, 246, 1], [cx + 40, 196], [cx + 10, 236, 1], [cx - 16, 186], [cx - 50, 226, 1], [cx - 80, 196], [cx - 106, 250]]);
  part(c, top, { fill: hair, rim: [3, 4, 'rgba(232,220,255,0.9)'], ink: hairInk, inkW: 2.8 });
  bangRow(c, [
    [[cx - 120, 170], [cx - 70, 120], [cx - 104, 300, 1], -2],
    [[cx - 90, 120], [cx - 30, 96], [cx - 40, 262, 1], 14],
    [[cx - 40, 96], [cx + 20, 92], [cx + 20, 250, 1], 16],
    [[cx + 10, 94], [cx + 70, 108], [cx + 74, 270, 1], 14],
    [[cx + 60, 110], [cx + 112, 140], [cx + 116, 300, 1], 8],
  ], hair, hairInk, '10,6,24', '232,220,255', [3, -1]);
  for (const s of [-1, 1] as const) {
    const a: P = [cx + s * 130, 210], b: P = [cx + s * 96, 230], t: P = [cx + s * 104, 470, 1];
    part(c, lock(a, b, t, s * 4, 0.45, -0.04), { fill: hair, rim: [3, 0, 'rgba(232,220,255,0.85)'] });
    line(c, lockEdges(a, b, t, s * 4, 0.45, -0.04), hairInk, 2.2);
  }
  gloss(c, [[cx - 118, 176, cx - 76, 140], [cx - 56, 126, cx - 8, 116], [cx + 14, 116, cx + 60, 124], [cx + 80, 138, cx + 118, 170]], 'rgba(220,200,255,0.55)');
  // 銀色髮帶
  line(c, curve([[cx - 120, 160], [cx - 40, 112], [cx + 50, 108], [cx + 126, 150]], false), '#dfe6ff', 5);
  sparkle(c, cx + 10, 106, 14, 'rgba(200,212,255,1)');

  // 銀光照臉（左上）
  within(c, face, () => {
    c.save();
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = lgrad(c, cx - 140, 160, cx + 60, 400, [[0, 'rgba(220,230,255,0.7)'], [1, 'rgba(220,230,255,0)']]);
    c.fillRect(0, 0, AW, AH);
    c.restore();
  });
  for (const [x, y, r] of [[480, 200, 8], [520, 420, 6], [90, 560, 6], [540, 640, 5], [440, 90, 5]] as [number, number, number][]) sparkle(c, x, y, r * 1.5, 'rgba(200,212,255,0.9)');
}

// ---------------------------------------------------------------- 莉歐拉：發明家（光源＝左下星燼炸彈，焰橙色）
export function drawLiora(c: C): void {
  const ink = '#3a1a14';
  const hairInk = '#3a120a';
  const hair = vgrad(c, 60, 420, [[0, '#ff9a5a'], [0.5, '#d8602e'], [1, '#8a2e18']]);
  aura(c, 250, 420, 'rgba(255,140,90,0.28)', 'rgba(255,120,80,0.07)');

  // 後髮（蓬鬆短髮）
  const back = curve([[cx - 132, 330], [cx - 150, 250], [cx - 140, 150], [cx - 80, 86], [cx, 70], [cx + 84, 86], [cx + 144, 150], [cx + 152, 250], [cx + 134, 330], [cx + 100, 400], [cx - 100, 400]]);
  fill(c, back, '#6a2414');

  // 身體：奶油色襯衫（捲袖）＋棕色皮背心
  const shirt = curve([[40, AH + 20], [60, 660], [100, 560], [190, 508], [cx, 498], [410, 508], [500, 560], [540, 660], [560, AH + 20]]);
  part(c, shirt, {
    fill: vgrad(c, 500, AH, [[0, '#fff2dc'], [1, '#c8a888']]),
    shadow: curve([[600, 520], [420, 520], [430, AH + 40], [600, AH + 40]]), shadowColor: 'rgba(120,70,40,0.35)',
    rim: [4, -4, 'rgba(255,190,130,1)'], ink: '#5a3a26', inkW: 2.6,
    extra: () => {
      for (const [pts, col] of [[[[150, 600], [160, 740], [150, 900]], 'rgba(120,70,40,0.35)'], [[[450, 600], [440, 740], [450, 900]], 'rgba(120,70,40,0.3)']] as [P[], string][]) line(c, curve(pts, false), col, 3);
    },
  });
  for (const s of [-1, 1] as const) {
    const vest = curve([[cx + s * 50, 520], [cx + s * 150, 520], [cx + s * 200, 600], [cx + s * 190, AH + 20], [cx + s * 40, AH + 20], [cx + s * 30, 700]]);
    part(c, vest, {
      fill: vgrad(c, 520, AH, [[0, '#8a5232'], [1, '#3a1e12']]),
      shadow: s > 0 ? curve([[cx + 100, 500], [cx + 260, 500], [cx + 260, AH + 40], [cx + 120, AH + 40]]) : undefined, shadowColor: 'rgba(20,6,2,0.4)',
      rim: [4, -3, 'rgba(255,180,120,0.9)'], ink: '#2a1208', inkW: 2.6,
      extra: () => line(c, curve([[cx + s * 50, 540], [cx + s * 46, 900]], false), 'rgba(255,200,150,0.5)', 2),
    });
    // 小口袋
    for (const y of [700, 790]) {
      const px = cx + s * 120;
      const pouch = curve([[px - 34, y, 1], [px + 34, y, 1], [px + 30, y + 54], [px - 30, y + 54]]);
      part(c, pouch, { fill: vgrad(c, y, y + 54, [[0, '#a8683e'], [1, '#5a2e18']]), rim: [3, -3, 'rgba(255,190,130,0.8)'], ink: '#2a1208', inkW: 2 });
      line(c, curve([[px - 34, y + 16], [px, y + 22], [px + 34, y + 16]], false), '#2a1208', 2);
      const btn = new Path2D(); btn.arc(px, y + 20, 5, 0, Math.PI * 2);
      part(c, btn, { fill: '#f0c060', ink: '#5a3a10', inkW: 1.2 });
    }
  }
  // 斜背帶
  line(c, curve([[cx + 160, 520], [cx - 60, 760], [cx - 170, 900]], false), '#2a1208', 14);
  line(c, curve([[cx + 158, 516], [cx - 62, 756], [cx - 172, 896]], false), 'rgba(255,180,120,0.5)', 2.5);

  // 臉
  const f: FaceStyle = { skin: '#fbe2d0', skinShadow: '#e8b49c', skinDeep: '#c98a74', ink, blush: 'rgba(255,120,110,0.38)', rimColor: '#ffd2b0', shadowSide: 1, jaw: 0.88, neck: 0.8 };
  const face = drawNeckAndFace(c, cx, f);
  // 短圍巾
  const scarf = curve([[cx - 92, 480], [cx, 470], [cx + 92, 480], [cx + 100, 520], [cx, 534], [cx - 100, 520]]);
  part(c, scarf, { fill: vgrad(c, 470, 534, [[0, '#3aa890'], [1, '#1a5a4a']]), rim: [4, -3, 'rgba(255,200,150,0.9)'], ink: '#0a2a22', inkW: 2.4 });

  // 五官：大綠眼、笑開
  const eye = { iris: ['#0a3a1a', '#2ab060', '#c8ffb0'] as [string, string, string], ink: '#2a120a', shine: 'rgba(200,255,170,1)', open: 0.84, lift: 1, lash: 7, flick: true, look: 0.1 };
  animeEye(c, cx - 50, 304, 64, -1, eye);
  animeEye(c, cx + 50, 304, 64, 1, eye);
  line(c, curve([[cx - 86, 254], [cx - 60, 240], [cx - 32, 248]], false), '#8a3a1e', 3.4);
  line(c, curve([[cx + 32, 248], [cx + 60, 240], [cx + 86, 254]], false), '#8a3a1e', 3.4);
  line(c, curve([[cx + 2, 340], [cx + 6, 356]], false), f.skinDeep, 2);
  // 雀斑
  for (const [x, y] of [[-70, 350], [-60, 358], [-52, 348], [52, 348], [60, 358], [70, 350]] as [number, number][]) {
    const d = new Path2D(); d.arc(cx + x, y, 2.2, 0, Math.PI * 2); fill(c, d, 'rgba(200,110,80,0.6)');
  }
  // 張嘴大笑
  const mouth = curve([[cx - 26, 382, 1], [cx + 26, 382, 1], [cx + 14, 404], [cx, 410], [cx - 14, 404]]);
  part(c, mouth, {
    fill: '#8a2a2a',
    extra: () => {
      fill(c, curve([[cx - 12, 404], [cx + 12, 404], [cx + 6, 420], [cx - 6, 420]]), '#ff8a8a');
      fill(c, curve([[cx - 26, 380, 1], [cx + 26, 380, 1], [cx + 22, 388], [cx - 22, 388]]), '#ffffff');
    },
    ink: '#4a1410', inkW: 2.2,
  });
  shade(c, face, curve([[cx - 120, 150], [cx + 120, 150], [cx + 120, 236], [cx + 50, 252], [cx, 234], [cx - 50, 252], [cx - 120, 236]]), 'rgba(190,110,90,0.3)');

  // 前髮：蓬鬆捲翹的短鮑伯
  // 蓬鬆捲髮：外輪廓是一圈圓弧小捲（谷點尖、峰點圓）
  const puffs: P[] = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const th = ((145 + (250 * i) / N) * Math.PI) / 180;
    const r = i % 2 === 1 ? 166 : 150;
    puffs.push(i % 2 === 1 ? [cx + Math.cos(th) * r, 214 + Math.sin(th) * r * 0.98] : [cx + Math.cos(th) * r, 214 + Math.sin(th) * r * 0.98, 1]);
  }
  const top = curve([
    ...puffs,
    [cx + 120, 290], [cx + 108, 236], [cx + 80, 250, 1], [cx + 64, 200], [cx + 36, 236, 1], [cx + 14, 196], [cx - 12, 232, 1], [cx - 36, 194], [cx - 64, 236, 1], [cx - 84, 204], [cx - 108, 246], [cx - 120, 296],
  ]);
  part(c, top, {
    fill: hair,
    shadow: curve([[cx + 30, 40], [cx + 200, 40], [cx + 200, 340], [cx + 100, 340], [cx + 60, 200]]), shadowColor: 'rgba(90,20,6,0.35)',
    rim: [3, -4, 'rgba(255,220,170,0.95)'], ink: hairInk, inkW: 2.8,
    extra: () => {
      for (const pts of [[[cx - 80, 90], [cx - 110, 160], [cx - 130, 240]], [[cx + 20, 66], [cx + 50, 140], [cx + 60, 200]], [[cx + 100, 96], [cx + 130, 170], [cx + 130, 250]]] as P[][]) {
        line(c, curve(pts, false), 'rgba(90,20,6,0.5)', 2);
      }
    },
  });
  // 外翹的髮尾
  for (const s of [-1, 1] as const) {
    const flip = curve([[cx + s * 136, 300], [cx + s * 176, 330], [cx + s * 190, 310, 1], [cx + s * 168, 352], [cx + s * 130, 340]]);
    part(c, flip, { fill: '#c0502a', rim: [3, -2, 'rgba(255,220,170,0.9)'], ink: hairInk, inkW: 2.4 });
  }
  gloss(c, [[cx - 120, 176, cx - 84, 140], [cx - 66, 124, cx - 20, 112], [cx + 6, 110, cx + 50, 116], [cx + 74, 128, cx + 116, 156]], 'rgba(255,230,190,0.6)');

  // 額上的黃銅護目鏡
  line(c, curve([[cx - 150, 196], [cx - 60, 156], [cx + 60, 152], [cx + 152, 190]], false), '#3a2418', 14);
  for (const s of [-1, 1] as const) {
    const gx = cx + s * 46, gy = 160;
    const rimRing = new Path2D(); rimRing.arc(gx, gy, 40, 0, Math.PI * 2);
    part(c, rimRing, { fill: lgrad(c, gx - 40, gy - 40, gx + 40, gy + 40, [[0, '#fff0b0'], [0.4, '#d89a3a'], [1, '#6a3a10']]), ink: '#2a1606', inkW: 2.4 });
    const lens = new Path2D(); lens.arc(gx, gy, 29, 0, Math.PI * 2);
    fill(c, lens, rgrad(c, gx - 8, gy - 8, 2, 32, [[0, '#ffffff'], [0.3, '#bfe8ff'], [0.8, '#3a7aa0'], [1, '#1a3a5a']]));
    line(c, lens, '#2a1606', 2);
    fill(c, lock([gx - 18, gy - 4], [gx - 14, gy - 12], [gx + 8, gy - 22, 1], 0, 0.5, 0.1), 'rgba(255,255,255,0.85)');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = new Path2D(); r.arc(gx + Math.cos(a) * 35, gy + Math.sin(a) * 35, 2.4, 0, Math.PI * 2); fill(c, r, '#5a3410');
    }
  }

  // 左手＋發光炸彈
  const bx = 120, by = 700;
  glow(c, bx, by, 240, 'rgba(255,140,70,0.5)');
  const arm = curve([[40, 900], [40, 790], [80, 760], [140, 766], [164, 806], [150, 900]]);
  part(c, arm, { fill: vgrad(c, 720, 900, [[0, '#fff2dc'], [1, '#c8a888']]), rim: [-4, -5, 'rgba(255,200,140,1)'], ink: '#5a3a26', inkW: 2.6 });
  // 捲起的袖口
  const cuff = curve([[50, 762], [110, 748], [160, 766], [164, 798], [110, 788], [52, 800]]);
  part(c, cuff, { fill: '#e8d0b0', rim: [-3, -4, 'rgba(255,220,170,1)'], ink: '#5a3a26', inkW: 2.2 });
  const bomb = new Path2D(); bomb.arc(bx, by, 50, 0, Math.PI * 2);
  part(c, bomb, {
    fill: rgrad(c, bx - 14, by - 16, 4, 56, [[0, '#ffffff'], [0.2, '#ffe0a0'], [0.55, '#ff7a3a'], [1, '#8a2a1a']]),
    ink: '#4a1a0a', inkW: 2.4,
  });
  line(c, curve([[bx - 46, by + 4], [bx, by + 16], [bx + 46, by + 4]], false), 'rgba(90,30,10,0.6)', 4);
  const neck = curve([[bx - 16, by - 64, 1], [bx + 16, by - 64, 1], [bx + 14, by - 46, 1], [bx - 14, by - 46, 1]]);
  part(c, neck, { fill: '#5a3a26', ink: '#2a1206', inkW: 2 });
  line(c, curve([[bx, by - 64], [bx + 10, by - 84], [bx + 26, by - 92]], false), '#3a2418', 3);
  glow(c, bx + 26, by - 92, 40, 'rgba(255,230,160,1)');
  sparkle(c, bx + 26, by - 92, 20, 'rgba(255,200,120,1)');
  glow(c, bx, by, 80, 'rgba(255,200,140,0.7)');
  // 手套握住炸彈下緣
  const glove = curve([[bx - 50, by + 20], [bx + 30, by + 26], [bx + 50, by + 60], [bx, by + 86], [bx - 50, by + 70]]);
  part(c, glove, { fill: vgrad(c, by, by + 90, [[0, '#7a4a2e'], [1, '#3a1e12']]), rim: [-3, -4, 'rgba(255,200,140,1)'], ink: '#2a1208', inkW: 2.4 });

  // 暖光照臉（左下）
  within(c, face, () => {
    c.save();
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = lgrad(c, cx - 140, 440, cx + 60, 240, [[0, 'rgba(255,160,90,0.8)'], [1, 'rgba(255,160,90,0)']]);
    c.fillRect(0, 0, AW, AH);
    c.restore();
  });
  rim(c, face, 4, -3, 'rgba(255,200,150,0.8)');
  for (const [x, y, r] of [[200, 600, 6], [60, 560, 5], [220, 520, 4], [40, 640, 4], [500, 160, 5], [530, 360, 4]] as [number, number, number][]) sparkle(c, x, y, r * 1.6, 'rgba(255,170,100,0.9)');
}

// ---------------------------------------------------------------- 洛克：老傭兵（光源＝右側營火紅光）
export function drawRourke(c: C): void {
  const ink = '#2a1610';
  const hairInk = '#0e0806';
  const hair = vgrad(c, 60, 300, [[0, '#4a3a36'], [1, '#1e1614']]);
  aura(c, 320, 400, 'rgba(230,120,90,0.24)', 'rgba(220,100,80,0.06)');

  // 斧槍（斜跨背後）
  line(c, curve([[60, 900], [520, 60]], false), '#2a1c16', 14);
  line(c, curve([[54, 896], [514, 56]], false), 'rgba(255,170,130,0.55)', 3);
  const head = curve([[500, 40, 1], [580, 10, 1], [576, 120], [540, 140, 1], [520, 96]]);
  part(c, head, { fill: lgrad(c, 500, 10, 580, 140, [[0, '#e8e4f0'], [0.5, '#8a8698'], [1, '#3a3644']]), rim: [-3, 3, 'rgba(255,220,200,1)'], ink: '#14121a', inkW: 2.6 });
  const spike = curve([[520, 56, 1], [552, -20, 1], [534, 70, 1]]);
  part(c, spike, { fill: '#9a96a8', ink: '#14121a', inkW: 2.2 });

  // 厚重斗篷＋肩甲
  const cloak = curve([[-30, AH + 20], [-10, 640], [30, 540], [120, 490], [cx, 480], [480, 490], [570, 540], [610, 640], [630, AH + 20]]);
  part(c, cloak, {
    fill: vgrad(c, 480, AH, [[0, '#3e2a2a'], [1, '#120a0a']]),
    shadow: curve([[-40, 520], [200, 500], [220, AH + 40], [-40, AH + 40]]), shadowColor: 'rgba(0,0,0,0.45)',
    rim: [-5, 3, 'rgba(255,160,120,0.9)'], ink: '#0a0606', inkW: 3,
  });
  // 胸甲（磨損的板甲）
  const plate = curve([[cx - 120, 540], [cx, 520], [cx + 120, 540], [cx + 130, 700], [cx + 90, 860], [cx - 90, 860], [cx - 130, 700]]);
  part(c, plate, {
    fill: lgrad(c, cx + 140, 520, cx - 140, 860, [[0, '#c8c0c8'], [0.4, '#7a7280'], [1, '#2a262e']]),
    shadow: curve([[cx - 200, 520], [cx - 20, 520], [cx - 40, 900], [cx - 200, 900]]), shadowColor: 'rgba(10,6,10,0.45)',
    rim: [-4, 3, 'rgba(255,200,170,1)'], ink: '#14121a', inkW: 2.6,
    extra: () => {
      for (const pts of [[[cx + 40, 600], [cx + 70, 640]], [[cx - 60, 700], [cx - 30, 690], [cx - 10, 720]], [[cx + 20, 780], [cx + 60, 770]]] as P[][]) line(c, curve(pts, false), 'rgba(20,16,20,0.6)', 2);
      line(c, curve([[cx - 110, 600], [cx, 584], [cx + 110, 600]], false), 'rgba(20,16,20,0.4)', 3);
    },
  });
  // 皮帶＋骰子扣
  line(c, curve([[cx - 140, 560], [cx + 40, 760], [cx + 150, 900]], false), '#3a2216', 18);
  const die = curve([[cx + 18, 726, 1], [cx + 56, 726, 1], [cx + 56, 764, 1], [cx + 18, 764, 1]]);
  part(c, die, { fill: '#f2e8dc', rim: [-2, 2, '#ffffff'], ink: '#3a2216', inkW: 2 });
  for (const [x, y] of [[28, 736], [46, 754], [37, 745]] as [number, number][]) { const d = new Path2D(); d.arc(cx + x, y, 3, 0, Math.PI * 2); fill(c, d, '#3a2216'); }
  // 毛領
  const fur = curve([[cx - 200, 520], [cx - 170, 474], [cx - 130, 490], [cx - 100, 456], [cx - 60, 480], [cx, 460], [cx + 60, 480], [cx + 100, 456], [cx + 130, 490], [cx + 170, 474], [cx + 200, 520], [cx + 140, 560], [cx, 540], [cx - 140, 560]]);
  part(c, fur, {
    fill: vgrad(c, 456, 560, [[0, '#8a7a70'], [1, '#3a2e2a']]), rim: [-4, 3, 'rgba(255,190,160,0.9)'], ink: '#1a120e', inkW: 2.4,
    extra: () => { for (let i = 0; i < 16; i++) line(c, curve([[cx - 180 + i * 24, 490 + (i % 2) * 10], [cx - 172 + i * 24, 530]], false), 'rgba(30,20,16,0.4)', 2); },
  });
  // 肩甲
  for (const s of [-1, 1] as const) {
    const pad = curve([[cx + s * 150, 500], [cx + s * 230, 500], [cx + s * 290, 560], [cx + s * 290, 640, 1], [cx + s * 220, 620], [cx + s * 160, 580]]);
    part(c, pad, {
      fill: vgrad(c, 500, 640, [[0, '#b8b0bc'], [1, '#3a3440']]),
      shadow: s < 0 ? curve([[cx - 320, 480], [cx - 140, 480], [cx - 140, 660], [cx - 320, 660]]) : undefined, shadowColor: 'rgba(10,6,10,0.45)',
      rim: [-3, 3, 'rgba(255,200,170,1)'], ink: '#14121a', inkW: 2.4,
    });
    for (const t of [0.3, 0.7]) { const r = new Path2D(); r.arc(cx + s * (170 + 90 * t), 540 + 40 * t, 4, 0, Math.PI * 2); fill(c, r, '#e8d0b0'); }
  }

  // 臉（較寬的下顎、曬黑膚色）
  const f: FaceStyle = { skin: '#ecc3a4', skinShadow: '#c08e70', skinDeep: '#9a6a50', ink, blush: 'rgba(200,100,80,0.12)', rimColor: '#ffc8a8', shadowSide: -1, jaw: 1.08, neck: 1.0 };
  const face = drawNeckAndFace(c, cx, f);
  // 鬍渣
  within(c, face, () => {
    c.fillStyle = 'rgba(60,40,36,0.22)';
    c.beginPath(); c.ellipse(cx, 410, 96, 52, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(40,26,22,0.55)';
    for (let i = 0; i < 160; i++) {
      const x = cx - 80 + ((i * 37) % 160);
      const y = 372 + ((i * 53) % 64);
      if (Math.abs(x - cx) < 22 && y < 400) continue;
      c.fillRect(x, y, 1.6, 1.6);
    }
  });
  // 五官：疲憊但溫暖的眼
  const eye = { iris: ['#3a1a0a', '#a86a3a', '#f0c890'] as [string, string, string], ink: '#1a0c08', shine: 'rgba(255,200,150,0.8)', open: 0.46, lift: -2, lash: 6.5, look: 0.2 };
  animeEye(c, cx - 50, 306, 60, -1, eye);
  animeEye(c, cx + 50, 306, 60, 1, eye);
  // 眼下細紋
  for (const s of [-1, 1]) line(c, curve([[cx + s * 30, 330], [cx + s * 50, 336], [cx + s * 70, 330]], false), 'rgba(120,70,50,0.45)', 1.6);
  fill(c, curve([[cx - 96, 274, 1], [cx - 66, 262], [cx - 24, 270], [cx - 20, 280, 1], [cx - 60, 276], [cx - 94, 282]]), '#2a1c18');
  fill(c, curve([[cx + 96, 268, 1], [cx + 66, 258], [cx + 24, 270], [cx + 20, 280, 1], [cx + 60, 272], [cx + 94, 276]]), '#2a1c18');
  // 眉上的疤
  line(c, curve([[cx + 46, 238], [cx + 56, 272], [cx + 64, 296]], false), 'rgba(200,110,90,0.85)', 3);
  line(c, curve([[cx + 47, 238], [cx + 57, 272], [cx + 65, 296]], false), 'rgba(255,200,180,0.6)', 1);
  line(c, curve([[cx + 6, 330], [cx + 12, 356], [cx + 2, 364]], false), f.skinDeep, 2.4);
  // 半邊笑
  line(c, curve([[cx - 24, 394], [cx, 398], [cx + 22, 392], [cx + 30, 384]], false), '#5a2a1e', 3);
  shade(c, face, curve([[cx - 130, 150], [cx + 130, 150], [cx + 130, 226], [cx - 130, 236]]), 'rgba(140,80,60,0.35)');

  // 短髮（往後梳、灰白挑染）
  const top = curve([[cx - 116, 290], [cx - 124, 230], [cx - 132, 170], [cx - 110, 112], [cx - 60, 76], [cx + 10, 64], [cx + 80, 74], [cx + 124, 110], [cx + 138, 170], [cx + 128, 230], [cx + 118, 290],
    [cx + 104, 240], [cx + 96, 200], [cx + 60, 214, 1], [cx + 20, 196], [cx - 10, 214, 1], [cx - 40, 198], [cx - 80, 216, 1], [cx - 100, 206], [cx - 106, 250]]);
  part(c, top, {
    fill: hair,
    shadow: curve([[cx - 200, 100], [cx - 30, 120], [cx - 60, 300], [cx - 200, 300]]), shadowColor: 'rgba(6,3,3,0.45)',
    rim: [-4, 3, 'rgba(255,170,130,0.9)'], ink: hairInk, inkW: 2.8,
    extra: () => {
      for (const pts of [[[cx - 90, 120], [cx - 40, 96], [cx + 20, 90]], [[cx - 100, 160], [cx - 30, 130], [cx + 60, 120]], [[cx + 40, 100], [cx + 100, 120], [cx + 126, 170]], [[cx - 110, 200], [cx - 60, 170], [cx + 10, 160]]] as P[][]) {
        line(c, curve(pts, false), 'rgba(10,6,6,0.6)', 2.2);
      }
      for (const pts of [[[cx - 116, 220], [cx - 112, 170], [cx - 90, 130]], [[cx + 122, 220], [cx + 120, 170], [cx + 100, 130]], [[cx - 40, 100], [cx + 10, 84], [cx + 60, 92]]] as P[][]) {
        line(c, curve(pts, false), 'rgba(200,196,200,0.6)', 3);
      }
    },
  });
  // 耳環
  glow(c, cx + 112, 344, 18, 'rgba(255,170,120,0.9)');
  const ring = new Path2D(); ring.arc(cx + 112, 346, 6, 0, Math.PI * 2);
  line(c, ring, '#f0c080', 2.4);

  // 營火照臉（右側）
  within(c, face, () => {
    c.save();
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = lgrad(c, cx + 140, 340, cx - 60, 300, [[0, 'rgba(255,140,90,0.85)'], [1, 'rgba(255,140,90,0)']]);
    c.fillRect(0, 0, AW, AH);
    c.restore();
  });
  rim(c, face, -4, 0, 'rgba(255,190,150,0.85)');
  for (const [x, y, r] of [[520, 420, 6], [560, 300, 4], [480, 600, 5], [80, 300, 3]] as [number, number, number][]) sparkle(c, x, y, r * 1.6, 'rgba(255,150,100,0.9)');
}
