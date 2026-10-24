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

// ---------------------------------------------------------------- 大司星 瓦爾德蘭（反派；光源＝下方冷紫星光）
export function drawValderan(c: C): void {
  const ink = '#2a2034';
  const hairInk = '#5a5a78';
  const silver = vgrad(c, 60, AH, [[0, '#f4f4fa'], [0.5, '#c4c4d8'], [1, '#8a8aa8']]);
  aura(c, 300, 380, 'rgba(170,130,255,0.26)', 'rgba(140,100,255,0.07)');

  // 星座軌道環（背後）
  c.save();
  c.strokeStyle = 'rgba(232,200,120,0.55)';
  c.lineWidth = 2;
  for (const [rx, ry, rot] of [[250, 70, -0.25], [230, 60, 0.3]] as [number, number, number][]) {
    c.beginPath(); c.ellipse(cx, 240, rx, ry, rot, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
  for (const [x, y] of [[70, 290], [530, 190], [110, 170], [500, 320]] as [number, number][]) sparkle(c, x, y, 12, 'rgba(232,210,150,1)');

  // 後髮（長直，披到身後）
  const back = curve([[cx - 110, 200], [cx - 140, 340], [cx - 168, 560], [cx - 176, 760, 1], [cx + 176, 760, 1], [cx + 168, 560], [cx + 140, 340], [cx + 110, 200], [cx, 70]]);
  part(c, back, {
    fill: silver, ink: hairInk, inkW: 2.4,
    extra: () => { for (let i = 0; i < 10; i++) line(c, curve([[cx - 120 + i * 26, 260], [cx - 150 + i * 33, 520], [cx - 168 + i * 37, 760]], false), 'rgba(90,90,130,0.3)', 2); },
  });

  // 法袍（白金）
  const robe = curve([[20, AH + 20], [40, 660], [80, 560], [170, 506], [cx, 496], [430, 506], [520, 560], [560, 660], [580, AH + 20]]);
  part(c, robe, {
    fill: vgrad(c, 496, AH, [[0, '#fbfaff'], [0.6, '#d8d4ea'], [1, '#8a84a8']]),
    shadow: curve([[600, 520], [400, 520], [420, AH + 40], [600, AH + 40]]), shadowColor: 'rgba(80,70,130,0.35)',
    rim: [3, -4, 'rgba(210,180,255,1)'], ink: '#4a4268', inkW: 2.6,
    extra: () => {
      // 金色長帶（垂在胸前）
      for (const s of [-1, 1]) {
        const band = curve([[cx + s * 40, 520], [cx + s * 90, 520], [cx + s * 76, AH + 20], [cx + s * 30, AH + 20]]);
        fill(c, band, vgrad(c, 520, AH, [[0, '#f4d890'], [1, '#a8823a']]));
        line(c, band, '#6a4a1a', 2);
        for (const y of [620, 720, 820]) {
          const st = star(cx + s * 60, y, 14, 6);
          fill(c, st, '#fffaf0');
          line(c, st, '#6a4a1a', 1.4);
        }
      }
    },
  });
  // 高領
  for (const s of [-1, 1] as const) {
    const collar = curve([[cx + s * 30, 440], [cx + s * 110, 420], [cx + s * 150, 520, 1], [cx + s * 60, 540]]);
    part(c, collar, { fill: vgrad(c, 420, 540, [[0, '#ffffff'], [1, '#b8b0d4']]), rim: [s * 2, -3, 'rgba(210,180,255,1)'], ink: '#4a4268', inkW: 2.4,
      extra: () => line(c, curve([[cx + s * 36, 446], [cx + s * 110, 428], [cx + s * 144, 516]], false), '#e0c070', 3) });
  }

  // 臉
  const f: FaceStyle = { skin: '#f4e2dc', skinShadow: '#cbb0b8', skinDeep: '#a08088', ink, blush: 'rgba(200,120,140,0.08)', rimColor: '#e0d0ff', shadowSide: 1, jaw: 0.94, neck: 0.8 };
  const face = drawNeckAndFace(c, cx, f);
  // 冷淡細長的眼
  const eye = { iris: ['#2a1a50', '#a07ae0', '#efe0ff'] as [string, string, string], ink: '#1a1024', shine: 'rgba(220,200,255,0.8)', open: 0.42, lift: 7, lash: 6.5, look: 0 };
  animeEye(c, cx - 50, 306, 60, -1, eye);
  animeEye(c, cx + 50, 306, 60, 1, eye);
  fill(c, curve([[cx - 94, 264, 1], [cx - 64, 258], [cx - 26, 276], [cx - 24, 282, 1], [cx - 62, 266], [cx - 92, 270]]), '#8a8aa8');
  fill(c, curve([[cx + 94, 264, 1], [cx + 64, 258], [cx + 26, 276], [cx + 24, 282, 1], [cx + 62, 266], [cx + 92, 270]]), '#8a8aa8');
  line(c, curve([[cx + 4, 330], [cx + 10, 356], [cx + 2, 362]], false), f.skinDeep, 2.2);
  // 法令紋與冷笑
  for (const s of [-1, 1]) line(c, curve([[cx + s * 30, 364], [cx + s * 38, 384]], false), 'rgba(140,100,110,0.4)', 1.6);
  line(c, curve([[cx - 22, 392], [cx, 396], [cx + 20, 390], [cx + 28, 384]], false), '#6a3a4a', 2.4);
  shade(c, face, curve([[cx - 120, 150], [cx + 120, 150], [cx + 120, 230], [cx, 214], [cx - 120, 230]]), 'rgba(150,120,150,0.3)');

  // 中分長瀏海＋兩側垂髮
  const top = curve([[cx - 118, 300], [cx - 130, 196], [cx - 100, 112], [cx - 30, 78], [cx + 30, 78], [cx + 100, 112], [cx + 130, 196], [cx + 118, 300],
    [cx + 100, 236], [cx + 64, 196], [cx + 8, 186, 1], [cx - 8, 186, 1], [cx - 64, 196], [cx - 100, 236]]);
  part(c, top, { fill: silver, rim: [2, 4, 'rgba(230,220,255,0.9)'], ink: hairInk, inkW: 2.6 });
  for (const s of [-1, 1] as const) {
    const side = curve([[cx + s * 14, 180], [cx + s * 96, 210], [cx + s * 124, 320], [cx + s * 132, 480], [cx + s * 120, 620, 1], [cx + s * 104, 480], [cx + s * 96, 330], [cx + s * 70, 210]]);
    part(c, side, { fill: silver, rim: [-s * 3, 3, 'rgba(230,220,255,0.9)'], ink: hairInk, inkW: 2.2 });
    line(c, curve([[cx + s * 60, 190], [cx + s * 104, 320], [cx + s * 116, 520]], false), 'rgba(90,90,130,0.35)', 2);
  }
  gloss(c, [[cx - 112, 170, cx - 70, 134], [cx + 70, 134, cx + 112, 170]], 'rgba(255,255,255,0.9)');
  // 星冠
  glow(c, cx, 104, 120, 'rgba(232,200,120,0.45)');
  line(c, curve([[cx - 112, 150], [cx - 50, 104], [cx + 50, 104], [cx + 112, 150]], false), '#e8c870', 6);
  for (const [x, y, r] of [[cx, 72, 30], [cx - 56, 92, 18], [cx + 56, 92, 18], [cx - 98, 126, 12], [cx + 98, 126, 12]] as [number, number, number][]) {
    const st = star(x, y, r, r * 0.4);
    part(c, st, { fill: rgrad(c, x, y, 0, r, [[0, '#ffffff'], [0.6, '#f4d890'], [1, '#b8862e']]), ink: '#6a4a1a', inkW: 1.6 });
  }
  // 下方冷光
  within(c, face, () => {
    c.save();
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = vgrad(c, 200, 440, [[0, 'rgba(170,130,255,0)'], [1, 'rgba(170,130,255,0.8)']]);
    c.fillRect(0, 0, AW, AH);
    c.restore();
  });
}

// ---------------------------------------------------------------- 配角共用：短髮男性的頭髮
function shortHair(c: C, fillStyle: string | CanvasGradient, ink: string, rimRGB: string, slick: boolean): void {
  const top = slick
    ? curve([[cx - 112, 280], [cx - 126, 200], [cx - 110, 120], [cx - 50, 76], [cx + 30, 68], [cx + 100, 96], [cx + 132, 170], [cx + 120, 280], [cx + 106, 220], [cx + 70, 180], [cx, 168], [cx - 70, 184], [cx - 104, 224]])
    : curve([[cx - 116, 290], [cx - 132, 200], [cx - 110, 118], [cx - 46, 80], [cx + 34, 74], [cx + 104, 102], [cx + 134, 190], [cx + 120, 290],
      [cx + 104, 240], [cx + 76, 214, 1], [cx + 50, 236], [cx + 24, 206, 1], [cx - 4, 232], [cx - 30, 204, 1], [cx - 58, 236], [cx - 84, 212, 1], [cx - 104, 246]]);
  part(c, top, {
    fill: fillStyle, rim: [-4, 3, `rgba(${rimRGB},0.9)`], ink, inkW: 2.8,
    extra: () => {
      for (const pts of slick
        ? [[[cx - 90, 180], [cx - 40, 120], [cx + 40, 96]], [[cx - 40, 172], [cx + 20, 120], [cx + 100, 120]], [[cx + 20, 168], [cx + 80, 140], [cx + 120, 180]]]
        : [[[cx - 60, 90], [cx - 90, 150], [cx - 110, 210]], [[cx + 20, 80], [cx + 40, 140], [cx + 60, 200]], [[cx + 90, 100], [cx + 116, 160], [cx + 124, 230]]]) {
        line(c, curve(pts as P[], false), 'rgba(0,0,0,0.4)', 2);
      }
    },
  });
  gloss(c, [[cx - 104, 150, cx - 60, 116], [cx - 40, 106, cx + 6, 96], [cx + 26, 96, cx + 70, 104]], `rgba(${rimRGB},0.45)`);
}

// ---------------------------------------------------------------- 隊長葛文（序章開除連恩的騎士隊長；紅金鎧甲、嚴厲）
export function drawGwen(c: C): void {
  aura(c, 300, 380, 'rgba(255,190,120,0.2)', 'rgba(255,140,90,0.05)');
  // 紅披風
  const cape = curve([[-10, AH + 20], [0, 640], [40, 540], [130, 490], [cx, 476], [470, 490], [560, 540], [600, 640], [610, AH + 20]]);
  part(c, cape, { fill: vgrad(c, 480, AH, [[0, '#a8322e'], [1, '#3a0e10']]), rim: [3, 4, 'rgba(255,210,150,0.9)'], ink: '#1a0606', inkW: 3 });
  // 胸甲
  const plate = curve([[cx - 150, 560], [cx, 520], [cx + 150, 560], [cx + 160, 720], [cx + 110, 880], [cx - 110, 880], [cx - 160, 720]]);
  part(c, plate, {
    fill: lgrad(c, cx - 160, 520, cx + 160, 880, [[0, '#f0e6d8'], [0.4, '#a89a8a'], [1, '#3a3430']]),
    shadow: curve([[cx + 20, 520], [cx + 220, 520], [cx + 220, 900], [cx + 20, 900]]), shadowColor: 'rgba(20,10,10,0.4)',
    rim: [4, 4, 'rgba(255,240,210,1)'], ink: '#1a1410', inkW: 2.6,
    extra: () => {
      line(c, curve([[cx - 146, 570], [cx, 532], [cx + 146, 570]], false), '#e0b050', 5);
      line(c, curve([[cx, 540], [cx, 870]], false), 'rgba(20,10,10,0.3)', 2);
    },
  });
  // 金獅紋章
  glow(c, cx, 680, 70, 'rgba(255,200,110,0.5)');
  const crest = curve([[cx, 630, 1], [cx + 40, 650], [cx + 34, 710], [cx, 740, 1], [cx - 34, 710], [cx - 40, 650]]);
  part(c, crest, { fill: vgrad(c, 630, 740, [[0, '#ffe8a0'], [1, '#b07a2a']]), ink: '#4a2a06', inkW: 2, extra: () => fill(c, star(cx, 684, 20, 8), '#8a2a22') });
  for (const s of [-1, 1] as const) {
    const pad = curve([[cx + s * 120, 500], [cx + s * 210, 488], [cx + s * 280, 540], [cx + s * 290, 620, 1], [cx + s * 210, 610], [cx + s * 130, 580]]);
    part(c, pad, { fill: vgrad(c, 488, 620, [[0, '#f4ecdc'], [1, '#5a4e44']]), rim: [3, 4, 'rgba(255,240,210,1)'], ink: '#1a1410', inkW: 2.4,
      extra: () => line(c, curve([[cx + s * 140, 560], [cx + s * 210, 548], [cx + s * 266, 590]], false), '#e0b050', 4) });
  }
  const f: FaceStyle = { skin: '#f0d0ba', skinShadow: '#c89c86', skinDeep: '#a07060', ink: '#2a1610', blush: 'rgba(200,100,90,0.1)', rimColor: '#ffe0b0', shadowSide: 1, jaw: 1.02, neck: 1.0 };
  const face = drawNeckAndFace(c, cx, f);
  const gorget = curve([[cx - 80, 466], [cx, 452], [cx + 80, 466], [cx + 96, 524], [cx, 540], [cx - 96, 524]]);
  part(c, gorget, { fill: vgrad(c, 452, 540, [[0, '#f0e6d8'], [1, '#5a4e44']]), rim: [3, 3, 'rgba(255,240,210,1)'], ink: '#1a1410', inkW: 2.4 });
  // 銳利冷峻的眼
  const eye = { iris: ['#1a2a3a', '#4a7a9a', '#bfe0f0'] as [string, string, string], ink: '#140a08', shine: 'rgba(190,230,255,0.7)', open: 0.42, lift: 9, lash: 7, look: -0.3 };
  animeEye(c, cx - 50, 308, 60, -1, eye);
  animeEye(c, cx + 50, 308, 60, 1, eye);
  fill(c, curve([[cx - 96, 260, 1], [cx - 60, 262], [cx - 22, 282], [cx - 22, 290, 1], [cx - 62, 274], [cx - 94, 270]]), '#6a4a1e');
  fill(c, curve([[cx + 96, 260, 1], [cx + 60, 262], [cx + 22, 282], [cx + 22, 290, 1], [cx + 62, 274], [cx + 94, 270]]), '#6a4a1e');
  line(c, curve([[cx + 6, 330], [cx + 12, 356], [cx + 2, 364]], false), f.skinDeep, 2.4);
  line(c, curve([[cx - 22, 396], [cx, 393], [cx + 22, 396]], false), '#5a2a1e', 3);
  // 頰上的舊傷
  line(c, curve([[cx - 76, 340], [cx - 60, 372]], false), 'rgba(190,100,90,0.7)', 2.5);
  shade(c, face, curve([[cx - 130, 150], [cx + 130, 150], [cx + 130, 222], [cx - 130, 232]]), 'rgba(160,100,80,0.3)');
  shortHair(c, vgrad(c, 60, 300, [[0, '#f4d07a'], [1, '#a8762e']]), '#3a2408', '255,240,200', true);
}

// ---------------------------------------------------------------- 伯恩：魁梧的老鐵匠／獵人小屋長老（灰白大鬍子、皮圍裙、鍛鎚）
export function drawBern(c: C): void {
  aura(c, 300, 400, 'rgba(255,150,80,0.22)', 'rgba(255,120,60,0.05)');
  // 鍛鎚（肩後）
  line(c, curve([[80, 900], [470, 120]], false), '#3a2418', 16);
  part(c, curve([[420, 60, 1], [540, 120, 1], [512, 176, 1], [392, 116, 1]]), { fill: lgrad(c, 400, 60, 540, 176, [[0, '#d8d4dc'], [1, '#3a3640']]), rim: [-3, 3, 'rgba(255,220,180,1)'], ink: '#14121a', inkW: 2.6 });
  // 寬厚身體（亞麻衫＋皮圍裙）
  const body = curve([[-30, AH + 20], [-10, 640], [30, 540], [130, 486], [cx, 476], [470, 486], [570, 540], [610, 640], [630, AH + 20]]);
  part(c, body, {
    fill: vgrad(c, 476, AH, [[0, '#c8b49a'], [1, '#6a5a48']]),
    shadow: curve([[-40, 520], [180, 500], [200, AH + 40], [-40, AH + 40]]), shadowColor: 'rgba(40,20,10,0.4)',
    rim: [-4, 3, 'rgba(255,190,130,0.9)'], ink: '#2a1a10', inkW: 3,
  });
  const apron = curve([[cx - 140, 600], [cx + 140, 600], [cx + 160, AH + 20], [cx - 160, AH + 20]]);
  part(c, apron, {
    fill: vgrad(c, 600, AH, [[0, '#7a4a2a'], [1, '#3a2010']]), rim: [-3, 3, 'rgba(255,190,130,0.8)'], ink: '#1a0e06', inkW: 2.6,
    extra: () => { for (const [x, y] of [[cx - 80, 700], [cx + 60, 760], [cx - 20, 820]] as [number, number][]) fill(c, curve([[x, y], [x + 20, y + 6], [x + 6, y + 14]]), 'rgba(20,10,4,0.4)'); },
  });
  for (const s of [-1, 1]) line(c, curve([[cx + s * 120, 604], [cx + s * 90, 520], [cx + s * 60, 470]], false), '#3a2010', 10);
  const f: FaceStyle = { skin: '#e8b898', skinShadow: '#b88468', skinDeep: '#8a5a44', ink: '#2a1610', blush: 'rgba(220,110,90,0.25)', rimColor: '#ffd0a8', shadowSide: -1, jaw: 1.1, neck: 1.2 };
  const face = drawNeckAndFace(c, cx, f);
  // 大鬍子
  const beard = curve([[cx - 104, 300], [cx - 96, 380], [cx - 70, 470], [cx - 30, 540], [cx, 560, 1], [cx + 30, 540], [cx + 70, 470], [cx + 96, 380], [cx + 104, 300], [cx + 70, 352], [cx + 30, 372], [cx, 366], [cx - 30, 372], [cx - 70, 352]]);
  part(c, beard, {
    fill: vgrad(c, 300, 560, [[0, '#e8e4e0'], [1, '#a8a4a0']]), rim: [-3, 3, 'rgba(255,210,170,0.9)'], ink: '#4a4440', inkW: 2.4,
    extra: () => { for (let i = 0; i < 9; i++) line(c, curve([[cx - 80 + i * 20, 380], [cx - 70 + i * 17, 460], [cx - 40 + i * 10, 530]], false), 'rgba(90,84,80,0.4)', 1.8); },
  });
  // 八字鬍與嘴
  part(c, curve([[cx - 60, 376], [cx - 20, 360], [cx, 368], [cx + 20, 360], [cx + 60, 376], [cx + 30, 386], [cx, 380], [cx - 30, 386]]), { fill: '#d8d4d0', ink: '#4a4440', inkW: 2 });
  // 慈祥但嚴格的眼
  const eye = { iris: ['#2a1a0a', '#7a5a3a', '#e0c8a0'] as [string, string, string], ink: '#1a0c08', shine: 'rgba(255,220,180,0.7)', open: 0.38, lift: -3, lash: 6, look: 0 };
  animeEye(c, cx - 50, 302, 58, -1, eye);
  animeEye(c, cx + 50, 302, 58, 1, eye);
  fill(c, curve([[cx - 96, 262, 1], [cx - 60, 248], [cx - 22, 262], [cx - 22, 274, 1], [cx - 62, 262], [cx - 94, 274]]), '#d8d4d0');
  fill(c, curve([[cx + 96, 262, 1], [cx + 60, 248], [cx + 22, 262], [cx + 22, 274, 1], [cx + 62, 262], [cx + 94, 274]]), '#d8d4d0');
  line(c, curve([[cx + 4, 322], [cx + 14, 350], [cx + 2, 358]], false), f.skinDeep, 2.6);
  shade(c, face, curve([[cx - 130, 150], [cx + 130, 150], [cx + 130, 210], [cx - 130, 220]]), 'rgba(140,90,70,0.3)');
  // 稀疏的灰白頭髮（往後梳）＋頭巾
  shortHair(c, vgrad(c, 60, 300, [[0, '#e0dcd8'], [1, '#8a8682']]), '#4a4440', '255,220,190', true);
  line(c, curve([[cx - 122, 200], [cx - 40, 160], [cx + 50, 158], [cx + 128, 196]], false), '#8a2a22', 16);
  line(c, curve([[cx - 122, 194], [cx - 40, 154], [cx + 50, 152], [cx + 128, 190]], false), 'rgba(255,170,120,0.6)', 2.5);
  // 爐火照臉
  within(c, face, () => {
    c.save();
    c.globalCompositeOperation = 'soft-light';
    c.fillStyle = lgrad(c, cx + 140, 400, cx - 60, 240, [[0, 'rgba(255,140,70,0.8)'], [1, 'rgba(255,140,70,0)']]);
    c.fillRect(0, 0, AW, AH);
    c.restore();
  });
  rim(c, face, -4, 0, 'rgba(255,180,120,0.8)');
}

// ---------------------------------------------------------------- 緹雅：被收容的小女孩（長辮垂在肩前、素色連身裙、暖光）
export function drawTia(c: C): void {
  const hairInk = '#3a2410';
  const hair = vgrad(c, 60, 760, [[0, '#c88a4a'], [0.5, '#9a5e2a'], [1, '#6a3a18']]);
  aura(c, 300, 400, 'rgba(255,210,150,0.26)', 'rgba(255,190,130,0.06)');
  fill(c, curve([[cx - 116, 300], [cx - 128, 190], [cx - 90, 100], [cx, 76], [cx + 92, 100], [cx + 128, 190], [cx + 116, 300], [cx + 90, 400], [cx - 90, 400]]), '#6a3a18');
  // 素色連身裙＋白圓領
  const dress = curve([[60, AH + 20], [76, 680], [110, 580], [190, 520], [cx, 510], [410, 520], [490, 580], [524, 680], [540, AH + 20]]);
  part(c, dress, {
    fill: vgrad(c, 510, AH, [[0, '#8aa0b8'], [1, '#3a4a60']]),
    shadow: curve([[600, 540], [400, 540], [420, AH + 40], [600, AH + 40]]), shadowColor: 'rgba(20,30,50,0.35)',
    rim: [-3, 4, 'rgba(255,220,170,0.9)'], ink: '#1a2230', inkW: 2.6,
  });
  for (const s of [-1, 1] as const) {
    const collar = curve([[cx, 500], [cx + s * 96, 504], [cx + s * 110, 560], [cx + s * 40, 580, 1]]);
    part(c, collar, { fill: '#f8f4ec', rim: [-2, 3, 'rgba(255,230,190,1)'], ink: '#5a5448', inkW: 2 });
  }
  const f: FaceStyle = { skin: '#fbe6d8', skinShadow: '#e8b8a4', skinDeep: '#c99484', ink: '#3a2418', blush: 'rgba(255,120,120,0.4)', rimColor: '#ffe0c0', shadowSide: 1, jaw: 0.82, neck: 0.7 };
  const face = drawNeckAndFace(c, cx, f);
  const eye = { iris: ['#3a2010', '#b07a3a', '#ffe0a8'] as [string, string, string], ink: '#2a1408', shine: 'rgba(255,230,180,1)', open: 0.95, lift: 0, lash: 7, flick: true, look: 0 };
  animeEye(c, cx - 50, 312, 66, -1, eye);
  animeEye(c, cx + 50, 312, 66, 1, eye);
  line(c, curve([[cx - 84, 256], [cx - 60, 248], [cx - 34, 254]], false), '#8a5a2a', 3);
  line(c, curve([[cx + 34, 254], [cx + 60, 248], [cx + 84, 256]], false), '#8a5a2a', 3);
  line(c, curve([[cx - 2, 352], [cx + 2, 362]], false), f.skinDeep, 2);
  line(c, curve([[cx - 12, 392], [cx, 398], [cx + 12, 392]], false), '#a85a5a', 2.6);
  shade(c, face, curve([[cx - 120, 150], [cx + 120, 150], [cx + 120, 236], [cx + 40, 252], [cx, 236], [cx - 40, 252], [cx - 120, 236]]), 'rgba(190,120,100,0.3)');
  // 前髮（齊瀏海）
  const top = curve([[cx - 120, 300], [cx - 132, 196], [cx - 104, 116], [cx - 30, 80], [cx + 40, 80], [cx + 106, 118], [cx + 132, 196], [cx + 120, 300],
    [cx + 104, 244], [cx + 84, 230, 1], [cx + 62, 248], [cx + 40, 226, 1], [cx + 16, 246], [cx - 8, 226, 1], [cx - 32, 246], [cx - 56, 226, 1], [cx - 80, 248], [cx - 100, 236, 1], [cx - 106, 260]]);
  part(c, top, { fill: hair, rim: [-3, 4, 'rgba(255,220,170,0.9)'], ink: hairInk, inkW: 2.6,
    extra: () => { for (const pts of [[[cx - 50, 90], [cx - 70, 160], [cx - 80, 230]], [[cx + 30, 86], [cx + 40, 160], [cx + 44, 226]]] as P[][]) line(c, curve(pts, false), 'rgba(60,30,10,0.4)', 2); } });
  gloss(c, [[cx - 110, 170, cx - 66, 136], [cx - 46, 124, cx + 2, 116], [cx + 20, 116, cx + 66, 126]], 'rgba(255,230,190,0.6)');
  // 長辮（垂在右肩前）
  for (let i = 0; i < 6; i++) {
    const y = 330 + i * 62;
    const x = cx + 116 - i * 6;
    const seg = curve([[x - 26, y], [x, y - 10], [x + 26, y], [x + 22, y + 44], [x, y + 66, 1], [x - 22, y + 44]]);
    part(c, seg, { fill: hair, rim: [-2, 3, 'rgba(255,220,170,0.85)'], ink: hairInk, inkW: 2.2 });
  }
  const tie = curve([[cx + 66, 706], [cx + 106, 700], [cx + 100, 726], [cx + 68, 730]]);
  part(c, tie, { fill: '#c84a4a', ink: '#4a1010', inkW: 2 });
  sparkle(c, 120, 260, 14, 'rgba(255,220,160,0.9)');
  sparkle(c, 480, 200, 10, 'rgba(255,220,160,0.9)');
}

/** 配角男性的共用身體：外套＋內衫。 */
function workBody(c: C, coat: [string, string], shirt: string, rimRGB: string): void {
  const body = curve([[-20, AH + 20], [0, 640], [40, 550], [130, 494], [cx, 484], [470, 494], [560, 550], [600, 640], [620, AH + 20]]);
  part(c, body, {
    fill: vgrad(c, 484, AH, [[0, coat[0]], [1, coat[1]]]),
    shadow: curve([[-40, 520], [180, 500], [200, AH + 40], [-40, AH + 40]]), shadowColor: 'rgba(0,0,0,0.4)',
    rim: [-4, 3, `rgba(${rimRGB},0.9)`], ink: '#0e0a08', inkW: 3,
  });
  const inner = curve([[cx - 80, 500], [cx, 560], [cx + 80, 500], [cx + 70, AH + 20], [cx - 70, AH + 20]]);
  part(c, inner, { fill: vgrad(c, 500, AH, [[0, shirt], [1, '#2a2420']]), rim: [-3, 2, `rgba(${rimRGB},0.7)`], ink: '#0e0a08', inkW: 2.4 });
  for (const s of [-1, 1]) {
    const lapel = curve([[cx + s * 80, 496], [cx + s * 150, 500], [cx + s * 110, 640, 1], [cx + s * 70, 560]]);
    part(c, lapel, { fill: vgrad(c, 496, 640, [[0, coat[0]], [1, coat[1]]]), rim: [-3, 3, `rgba(${rimRGB},0.8)`], ink: '#0e0a08', inkW: 2.4 });
  }
}

// ---------------------------------------------------------------- 多恩：礦工公會工頭（安全帽＋頭燈、十字鎬、八字鬍）
export function drawDorn(c: C): void {
  aura(c, 300, 400, 'rgba(255,190,100,0.22)', 'rgba(255,160,80,0.05)');
  // 十字鎬
  line(c, curve([[90, 900], [460, 200]], false), '#4a3020', 14);
  part(c, curve([[360, 170, 1], [470, 190], [580, 270, 1], [470, 216], [366, 196, 1]]), { fill: lgrad(c, 360, 170, 580, 270, [[0, '#d8d4dc'], [1, '#4a4654']]), rim: [-2, 3, 'rgba(255,220,170,1)'], ink: '#14121a', inkW: 2.4 });
  workBody(c, ['#6a6050', '#2a2620'], '#8a7a60', '255,200,120');
  // 吊帶
  for (const s of [-1, 1]) line(c, curve([[cx + s * 70, 500], [cx + s * 60, 700], [cx + s * 56, 900]], false), '#3a2a1a', 12);
  const f: FaceStyle = { skin: '#e8bc9c', skinShadow: '#bc8a6c', skinDeep: '#8a5a44', ink: '#2a1610', blush: 'rgba(220,110,90,0.2)', rimColor: '#ffd8a0', shadowSide: -1, jaw: 1.08, neck: 1.15 };
  const face = drawNeckAndFace(c, cx, f);
  // 煤灰
  within(c, face, () => { for (const [x, y, r] of [[cx - 70, 360, 14], [cx + 60, 380, 10]] as [number, number, number][]) { const d = new Path2D(); d.arc(x, y, r, 0, Math.PI * 2); fill(c, d, 'rgba(60,40,30,0.25)'); } });
  const eye = { iris: ['#2a1a0a', '#8a6a3a', '#f0d0a0'] as [string, string, string], ink: '#1a0c08', shine: 'rgba(255,220,160,0.8)', open: 0.44, lift: -1, lash: 6.5, look: 0 };
  animeEye(c, cx - 50, 304, 60, -1, eye);
  animeEye(c, cx + 50, 304, 60, 1, eye);
  fill(c, curve([[cx - 98, 266, 1], [cx - 60, 252], [cx - 22, 264], [cx - 22, 278, 1], [cx - 62, 266], [cx - 96, 278]]), '#3a2418');
  fill(c, curve([[cx + 98, 266, 1], [cx + 60, 252], [cx + 22, 264], [cx + 22, 278, 1], [cx + 62, 266], [cx + 96, 278]]), '#3a2418');
  line(c, curve([[cx + 4, 324], [cx + 14, 352], [cx + 2, 360]], false), f.skinDeep, 2.6);
  // 濃密八字鬍＋笑
  part(c, curve([[cx - 76, 392, 1], [cx - 40, 364], [cx, 374], [cx + 40, 364], [cx + 76, 392, 1], [cx + 36, 384], [cx, 390], [cx - 36, 384]]), { fill: '#4a2e1e', rim: [-2, 2, 'rgba(255,200,140,0.7)'], ink: '#1a0e08', inkW: 2 });
  line(c, curve([[cx - 18, 404], [cx, 410], [cx + 18, 404]], false), '#5a2a1e', 2.6);
  shade(c, face, curve([[cx - 130, 150], [cx + 130, 150], [cx + 130, 222], [cx - 130, 232]]), 'rgba(120,70,50,0.4)');
  // 安全帽＋頭燈
  const helmet = curve([[cx - 140, 236, 1], [cx - 128, 150], [cx - 70, 92], [cx, 80], [cx + 70, 92], [cx + 128, 150], [cx + 140, 236, 1]]);
  part(c, helmet, {
    fill: vgrad(c, 80, 236, [[0, '#f0c050'], [1, '#a0701a']]), rim: [-4, 3, 'rgba(255,240,190,1)'], ink: '#3a2408', inkW: 2.8,
    extra: () => line(c, curve([[cx, 82], [cx, 230]], false), 'rgba(90,60,10,0.4)', 6),
  });
  part(c, curve([[cx - 160, 236, 1], [cx + 160, 236, 1], [cx + 150, 256, 1], [cx - 150, 256, 1]]), { fill: '#c08a2a', ink: '#3a2408', inkW: 2.4 });
  const lamp = new Path2D(); lamp.arc(cx, 176, 26, 0, Math.PI * 2);
  part(c, lamp, { fill: rgrad(c, cx - 4, 170, 2, 26, [[0, '#ffffff'], [0.4, '#fff0b0'], [1, '#c87a1a']]), ink: '#3a2408', inkW: 2.4 });
  glow(c, cx, 176, 90, 'rgba(255,230,160,0.9)');
}

// ---------------------------------------------------------------- 法羅：商隊領隊（寬簷帽、長外套、斜背皮包）
export function drawFarrow(c: C): void {
  aura(c, 300, 400, 'rgba(255,200,130,0.2)', 'rgba(255,170,100,0.05)');
  workBody(c, ['#6a4a2e', '#2a1a10'], '#d8c8a8', '255,210,150');
  line(c, curve([[cx + 160, 510], [cx - 40, 760], [cx - 140, 900]], false), '#3a2010', 14);
  part(c, curve([[cx - 160, 800, 1], [cx - 60, 790, 1], [cx - 56, 880, 1], [cx - 166, 890, 1]]), { fill: vgrad(c, 790, 890, [[0, '#9a6a3e'], [1, '#4a2e18']]), rim: [-2, 3, 'rgba(255,210,150,0.8)'], ink: '#1a0e06', inkW: 2.2 });
  const f: FaceStyle = { skin: '#eec4a6', skinShadow: '#c49478', skinDeep: '#946450', ink: '#2a1610', blush: 'rgba(220,110,90,0.2)', rimColor: '#ffe0b0', shadowSide: -1, jaw: 1.0, neck: 1.0 };
  const face = drawNeckAndFace(c, cx, f);
  // 短絡腮鬍
  within(c, face, () => {
    c.fillStyle = 'rgba(80,50,30,0.5)';
    c.beginPath(); c.moveTo(cx - 96, 330); c.quadraticCurveTo(cx - 80, 420, cx, 440); c.quadraticCurveTo(cx + 80, 420, cx + 96, 330);
    c.quadraticCurveTo(cx + 60, 400, cx, 404); c.quadraticCurveTo(cx - 60, 400, cx - 96, 330); c.fill();
  });
  const eye = { iris: ['#1a2a1a', '#4a8a5a', '#c8f0c0'] as [string, string, string], ink: '#1a0c08', shine: 'rgba(210,255,200,0.8)', open: 0.5, lift: 2, lash: 6.5, look: 0.2 };
  animeEye(c, cx - 50, 304, 60, -1, eye);
  animeEye(c, cx + 50, 304, 60, 1, eye);
  fill(c, curve([[cx - 92, 262, 1], [cx - 60, 252], [cx - 24, 262], [cx - 22, 272, 1], [cx - 60, 262], [cx - 90, 270]]), '#4a2e1e');
  fill(c, curve([[cx + 92, 262, 1], [cx + 60, 252], [cx + 24, 262], [cx + 22, 272, 1], [cx + 60, 262], [cx + 90, 270]]), '#4a2e1e');
  line(c, curve([[cx + 4, 328], [cx + 12, 354], [cx + 2, 362]], false), f.skinDeep, 2.4);
  line(c, curve([[cx - 24, 386], [cx, 396], [cx + 24, 386]], false), '#5a2a1e', 3);
  shortHair(c, vgrad(c, 60, 300, [[0, '#6a4a2e'], [1, '#2a1a10']]), '#140a04', '255,210,150', false);
  // 寬簷帽
  const brim = curve([[cx - 210, 210, 1], [cx - 120, 180], [cx, 172], [cx + 120, 180], [cx + 210, 210, 1], [cx + 120, 214], [cx, 208], [cx - 120, 214]]);
  const crown = curve([[cx - 110, 196], [cx - 100, 110], [cx - 40, 76], [cx + 40, 76], [cx + 100, 110], [cx + 110, 196]]);
  part(c, crown, { fill: vgrad(c, 76, 196, [[0, '#8a6a46'], [1, '#4a3420']]), rim: [-4, 3, 'rgba(255,220,160,0.9)'], ink: '#1a0e06', inkW: 2.6,
    extra: () => line(c, curve([[cx - 110, 170], [cx, 160], [cx + 110, 170]], false), '#2a1a0e', 14) });
  part(c, brim, { fill: vgrad(c, 172, 214, [[0, '#7a5a3a'], [1, '#3a2614']]), rim: [-3, 2, 'rgba(255,220,160,0.9)'], ink: '#1a0e06', inkW: 2.6 });
  shade(c, face, curve([[cx - 140, 150], [cx + 140, 150], [cx + 140, 250], [cx - 140, 260]]), 'rgba(120,70,50,0.35)');
}
