// 戰鬥中我方的背影（動漫風，與立繪同配色）。座標為邏輯尺寸，呼叫端負責 2 倍縮放。
// 尺寸與發光點沿用舊剪影：連恩 130×200（燈 112,61）、洛克 160×220、伊歐 110×180（光 90,100）、
// 莉歐拉 120×190（燒瓶 17,104）、瑟琳 150×230。
import { curve, fill, glow, lgrad, line, lock, part, rgrad, sparkle, vgrad } from './animeKit';
import type { C, P } from './animeKit';

const INK = '#0a0a14';

function boots(c: C, xs: number[], y: number, color = '#1a1418'): void {
  for (const x of xs) {
    const b = curve([[x - 7, y - 10], [x + 7, y - 10], [x + 8, y + 2, 1], [x - 9, y + 2, 1]]);
    part(c, b, { fill: color, ink: INK, inkW: 1 });
  }
}

/** 由尖角與圓弧交錯組成的髮團外輪廓。 */
function spikyHair(cx: number, cy: number, r: number, spikes: number, len: number, from = 150, to = 390): Path2D {
  const pts: P[] = [];
  for (let i = 0; i <= spikes * 2; i++) {
    const th = ((from + ((to - from) * i) / (spikes * 2)) * Math.PI) / 180;
    const rr = i % 2 === 1 ? r + len : r;
    pts.push(i % 2 === 1 ? [cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, 1] : [cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
  }
  pts.push([cx + r * 0.7, cy + r * 0.9], [cx - r * 0.7, cy + r * 0.9]);
  return curve(pts);
}

// ---------------------------------------------------------------- 連恩
export function backLian(c: C): void {
  boots(c, [52, 78], 196);
  // 大衣
  const coat = curve([[42, 82], [86, 82], [98, 120], [106, 194], [66, 186], [22, 194], [32, 120]]);
  part(c, coat, {
    fill: vgrad(c, 80, 196, [[0, '#2c3a68'], [1, '#0e1430']]),
    shadow: curve([[20, 80], [60, 80], [56, 200], [10, 200]]), shadowColor: 'rgba(0,0,10,0.4)',
    rim: [-2, 1, 'rgba(255,196,120,0.95)'], ink: INK, inkW: 1.2,
    extra: () => {
      line(c, curve([[64, 90], [65, 140], [64, 188]], false), 'rgba(0,0,0,0.4)', 1.4);
      line(c, curve([[34, 140], [70, 136], [100, 140]], false), '#3a2418', 3);
      line(c, curve([[84, 120], [92, 160], [98, 190]], false), 'rgba(255,190,120,0.35)', 1);
    },
  });
  // 舉燈的右臂
  const arm = curve([[78, 88], [90, 84], [108, 66], [104, 60], [84, 76], [74, 92]]);
  part(c, arm, { fill: '#26335c', rim: [-1, 1.5, 'rgba(255,210,140,1)'], ink: INK, inkW: 1.1 });
  const hand = new Path2D(); hand.arc(106, 63, 4, 0, Math.PI * 2);
  part(c, hand, { fill: '#5a3a26', ink: INK, inkW: 1 });
  // 圍巾＋飄帶
  part(c, curve([[22, 96], [42, 80], [50, 88], [34, 104], [12, 128, 1], [16, 112]]), { fill: lgrad(c, 50, 80, 12, 128, [[0, '#c4433a'], [1, '#6a1820']]), rim: [1, 1, 'rgba(255,190,130,0.9)'], ink: '#2a0608', inkW: 1.1 });
  part(c, curve([[42, 76], [64, 72], [86, 76], [88, 88], [64, 92], [40, 88]]), { fill: vgrad(c, 72, 92, [[0, '#d04a40'], [1, '#7a1e24']]), rim: [-1.5, 1.5, 'rgba(255,200,140,0.95)'], ink: '#2a0608', inkW: 1.1 });
  // 後腦亂髮
  const hair = spikyHair(64, 46, 22, 7, 9);
  part(c, hair, {
    fill: vgrad(c, 14, 76, [[0, '#5a3a2a'], [1, '#1e1210']]),
    shadow: curve([[30, 50], [64, 60], [96, 50], [96, 90], [30, 90]]), shadowColor: 'rgba(0,0,0,0.35)',
    rim: [-2, 1.5, 'rgba(255,186,110,0.95)'], ink: INK, inkW: 1.2,
    extra: () => {
      for (const pts of [[[64, 26], [60, 46], [52, 68]], [[74, 28], [76, 50], [72, 70]], [[54, 30], [46, 48], [40, 64]]] as P[][]) line(c, curve(pts, false), 'rgba(0,0,0,0.5)', 1);
      fill(c, lock([50, 34], [52, 30], [78, 32, 1], 0, 0.5, 0.1), 'rgba(255,190,120,0.45)');
    },
  });
  // 提燈
  line(c, curve([[106, 60], [112, 52]], false), '#8a5a26', 1.6);
  part(c, curve([[105, 52, 1], [119, 52, 1], [116, 48], [108, 48]]), { fill: '#c08a3a', ink: '#2a1606', inkW: 0.9 });
  const glass = curve([[105, 53, 1], [119, 53, 1], [121, 62], [118, 71, 1], [106, 71, 1], [103, 62]]);
  fill(c, glass, rgrad(c, 112, 61, 1, 11, [[0, '#ffffff'], [0.3, '#fff0b8'], [1, '#ff9a3a']]));
  line(c, glass, '#4a2a0e', 1);
  part(c, curve([[104, 71, 1], [120, 71, 1], [117, 75, 1], [107, 75, 1]]), { fill: '#a8702e', ink: '#2a1606', inkW: 0.9 });
}

// ---------------------------------------------------------------- 洛克
export function backRourke(c: C): void {
  // 斧槍
  line(c, curve([[26, 216], [26, 10]], false), '#2a1c16', 5);
  line(c, curve([[24, 216], [24, 10]], false), 'rgba(255,200,170,0.6)', 1);
  part(c, curve([[26, 22, 1], [4, 12, 1], [2, 44], [26, 50, 1]]), { fill: lgrad(c, 0, 12, 26, 50, [[0, '#e8e4f0'], [1, '#4a4654']]), rim: [1, 1, 'rgba(255,255,255,1)'], ink: INK, inkW: 1.1 });
  part(c, curve([[26, 2, 1], [31, 18, 1], [21, 18, 1]]), { fill: '#9a96a8', ink: INK, inkW: 1 });
  boots(c, [68, 108], 216, '#1e1610');
  // 斗篷
  const cloak = curve([[44, 76], [118, 76], [146, 110], [140, 214], [88, 206], [36, 214], [30, 110]]);
  part(c, cloak, {
    fill: vgrad(c, 76, 214, [[0, '#4a3232'], [1, '#160c0c']]),
    shadow: curve([[90, 70], [160, 70], [160, 220], [96, 220]]), shadowColor: 'rgba(0,0,0,0.4)',
    rim: [1.5, 1.5, 'rgba(255,170,130,0.9)'], ink: INK, inkW: 1.3,
    extra: () => {
      for (const x of [62, 88, 114]) line(c, curve([[x, 110], [x + 2, 160], [x - 2, 210]], false), 'rgba(0,0,0,0.4)', 1.3);
      line(c, curve([[44, 200], [88, 196], [134, 200]], false), '#8a2a22', 2.5);
    },
  });
  // 肩甲
  for (const s of [-1, 1] as const) {
    const x0 = s < 0 ? 52 : 110;
    const pad = curve([[x0 - 22, 84], [x0, 72], [x0 + 22, 84], [x0 + 20, 102, 1], [x0 - 20, 102, 1]]);
    part(c, pad, { fill: vgrad(c, 72, 102, [[0, '#c8c0cc'], [1, '#3a3442']]), rim: [1, 1.5, 'rgba(255,230,210,1)'], ink: INK, inkW: 1.1 });
  }
  // 毛領
  part(c, curve([[52, 82], [62, 66], [80, 72], [98, 66], [110, 82], [96, 92], [66, 92]]), {
    fill: vgrad(c, 66, 92, [[0, '#9a8a80'], [1, '#4a3a34']]), rim: [1, 1.5, 'rgba(255,210,180,0.9)'], ink: INK, inkW: 1.1,
  });
  // 耳朵
  for (const x of [64, 98]) part(c, curve([[x - 3, 44], [x + 3, 44], [x + 3, 56], [x - 3, 56]]), { fill: '#c89a7a', ink: INK, inkW: 0.9 });
  // 後腦短髮（灰白挑染）
  const head = curve([[64, 52], [66, 32], [80, 22], [96, 32], [98, 52], [94, 68], [68, 68]]);
  part(c, head, {
    fill: vgrad(c, 22, 68, [[0, '#4a3c38'], [1, '#1e1614']]), rim: [1.2, 1.5, 'rgba(255,170,130,0.9)'], ink: INK, inkW: 1.2,
    extra: () => {
      line(c, curve([[70, 34], [80, 30], [92, 36]], false), 'rgba(210,206,210,0.8)', 1.4);
      line(c, curve([[68, 46], [80, 42], [94, 48]], false), 'rgba(210,206,210,0.6)', 1.2);
    },
  });
  // 頸後（膚色）
  part(c, curve([[72, 66], [90, 66], [88, 74], [74, 74]]), { fill: '#c89a7a', ink: INK, inkW: 0.9 });
}

// ---------------------------------------------------------------- 伊歐
export function backIo(c: C): void {
  // 洋裝
  const dress = curve([[28, 76], [55, 68], [82, 76], [86, 118], [96, 176], [55, 170], [14, 176], [24, 118]]);
  part(c, dress, {
    fill: vgrad(c, 72, 176, [[0, '#e8f0ff'], [0.6, '#b8cdf0'], [1, '#6f8cc4']]),
    shadow: curve([[60, 70], [100, 70], [100, 180], [62, 180]]), shadowColor: 'rgba(80,100,170,0.35)',
    rim: [1, 1.5, 'rgba(210,248,255,1)'], ink: '#4a5a8a', inkW: 1.1,
    extra: () => {
      line(c, curve([[30, 150], [55, 146], [86, 150]], false), '#7fa6e0', 2.5);
      for (const x of [40, 55, 70]) line(c, curve([[x, 120], [x + 1, 150], [x - 1, 172]], false), 'rgba(90,110,170,0.35)', 1);
    },
  });
  // 伸出的右手
  part(c, curve([[70, 82], [78, 80], [90, 98], [86, 102], [72, 92]]), { fill: '#dfe8f8', rim: [1, 1, 'rgba(220,250,255,1)'], ink: '#4a5a8a', inkW: 1 });
  // 長白髮（及腰，末端發光）
  const hair = curve([[34, 34], [36, 80], [40, 124], [40, 144, 1], [48, 132], [55, 150, 1], [62, 132], [70, 144, 1], [70, 124], [74, 80], [76, 34], [55, 14]]);
  part(c, hair, {
    fill: vgrad(c, 14, 156, [[0, '#ffffff'], [0.5, '#c8d6f0'], [0.85, '#9fb4dc'], [1, '#bff6ff']]),
    shadow: curve([[55, 30], [90, 30], [90, 160], [58, 160]]), shadowColor: 'rgba(100,120,180,0.3)',
    rim: [1, 1.5, 'rgba(230,252,255,1)'], ink: '#5a6c92', inkW: 1.1,
    extra: () => {
      for (const x of [40, 50, 60, 70]) line(c, curve([[55 + (x - 55) * 0.4, 30], [x, 90], [x + (x - 55) * 0.2, 146]], false), 'rgba(90,110,170,0.35)', 1);
      fill(c, lock([36, 40], [38, 34], [72, 34, 1], 0, 0.5, 0.1), 'rgba(255,255,255,0.9)');
    },
  });
  glow(c, 55, 144, 18, 'rgba(140,230,255,0.6)');
  // 星形髮飾
  sparkle(c, 34, 44, 5, 'rgba(140,230,255,1)');
  sparkle(c, 90, 100, 6, 'rgba(160,236,255,1)');
}

// ---------------------------------------------------------------- 莉歐拉
export function backLiora(c: C): void {
  boots(c, [46, 74], 186, '#3a1e12');
  // 外套
  const coat = curve([[42, 66], [78, 66], [90, 100], [96, 184], [60, 178], [24, 184], [32, 100]]);
  part(c, coat, {
    fill: vgrad(c, 66, 184, [[0, '#9a5a36'], [1, '#3a1e12']]),
    shadow: curve([[60, 60], [100, 60], [100, 190], [62, 190]]), shadowColor: 'rgba(20,6,2,0.35)',
    rim: [2, 1, 'rgba(255,190,130,0.95)'], ink: INK, inkW: 1.2,
    extra: () => line(c, curve([[60, 74], [61, 130], [60, 180]], false), 'rgba(0,0,0,0.35)', 1.2),
  });
  // 背帶與背包
  line(c, curve([[40, 70], [82, 130]], false), '#2a1208', 3.5);
  part(c, curve([[68, 116, 1], [98, 114, 1], [100, 148, 1], [70, 150, 1]]), {
    fill: vgrad(c, 114, 150, [[0, '#7a4a2e'], [1, '#3a1e12']]), rim: [1.5, 1, 'rgba(255,190,130,0.9)'], ink: INK, inkW: 1.1,
    extra: () => line(c, curve([[68, 126], [100, 124]], false), '#2a1208', 1.4),
  });
  // 拿燒瓶的左臂
  part(c, curve([[34, 74], [42, 80], [26, 100], [18, 98]]), { fill: '#f0dcc0', rim: [1.5, 1, 'rgba(255,210,160,1)'], ink: INK, inkW: 1 });
  // 蓬鬆短髮
  const puffs: P[] = [];
  for (let i = 0; i <= 14; i++) {
    const th = ((150 + (240 * i) / 14) * Math.PI) / 180;
    const r = i % 2 === 1 ? 27 : 23;
    puffs.push(i % 2 === 1 ? [60 + Math.cos(th) * r, 44 + Math.sin(th) * r] : [60 + Math.cos(th) * r, 44 + Math.sin(th) * r, 1]);
  }
  puffs.push([78, 72], [42, 72]);
  part(c, curve(puffs), {
    fill: vgrad(c, 16, 72, [[0, '#ff9a5a'], [1, '#8a2e18']]),
    shadow: curve([[60, 30], [96, 30], [96, 80], [62, 80]]), shadowColor: 'rgba(90,20,6,0.3)',
    rim: [2, 1, 'rgba(255,220,170,1)'], ink: '#3a120a', inkW: 1.2,
  });
  // 護目鏡帶（繞過後腦）
  line(c, curve([[34, 44], [60, 50], [86, 44]], false), '#3a2418', 5);
  line(c, curve([[34, 42], [60, 48], [86, 42]], false), 'rgba(255,170,110,0.7)', 1);
  const buckle = new Path2D(); buckle.arc(60, 49, 3.5, 0, Math.PI * 2);
  part(c, buckle, { fill: '#e0a24a', ink: '#2a1606', inkW: 0.9 });
  // 燒瓶
  part(c, curve([[14, 86, 1], [20, 86, 1], [20, 94, 1], [14, 94, 1]]), { fill: '#5a3a26', ink: INK, inkW: 0.9 });
  const flask = new Path2D(); flask.arc(17, 104, 9, 0, Math.PI * 2);
  part(c, flask, { fill: rgrad(c, 15, 102, 1, 10, [[0, '#ffffff'], [0.3, '#ffe0a0'], [1, '#ff6a2a']]), ink: '#4a1a0a', inkW: 1 });
}

// ---------------------------------------------------------------- 瑟琳
export function backSerin(c: C): void {
  boots(c, [56, 94], 226, '#1a1e34');
  // 短披風
  const cape = curve([[46, 86], [104, 86], [124, 120], [128, 200], [75, 194], [22, 200], [26, 120]]);
  part(c, cape, {
    fill: vgrad(c, 86, 200, [[0, '#3a56a8'], [1, '#141e48']]),
    shadow: curve([[76, 80], [140, 80], [140, 210], [80, 210]]), shadowColor: 'rgba(0,0,20,0.35)',
    rim: [1.5, 1.5, 'rgba(220,230,255,0.95)'], ink: INK, inkW: 1.2,
    extra: () => { for (const x of [50, 75, 100]) line(c, curve([[x, 120], [x + 2, 160], [x - 1, 196]], false), 'rgba(0,0,20,0.4)', 1.2); },
  });
  // 劍（右手斜握，劍尖朝右上）
  const blade = curve([[108, 138, 1], [139, 30, 1], [144, 24, 1], [145, 33, 1], [114, 141, 1]]);
  part(c, blade, { fill: lgrad(c, 108, 0, 146, 0, [[0, '#ffffff'], [0.5, '#c8d4ff'], [1, '#5a6890']]), ink: '#1a2040', inkW: 1 });
  glow(c, 128, 80, 28, 'rgba(200,212,255,0.35)');
  part(c, curve([[98, 132, 1], [122, 142, 1], [120, 146, 1], [96, 136, 1]]), { fill: '#d8b860', ink: '#2a1a06', inkW: 0.9 });
  part(c, curve([[96, 100], [108, 104], [114, 140], [104, 144], [94, 120]]), { fill: '#7a88b4', rim: [1, 1, 'rgba(255,255,255,1)'], ink: INK, inkW: 1 });
  // 肩甲
  for (const x0 of [44, 106]) {
    const pad = curve([[x0 - 18, 96], [x0, 84], [x0 + 18, 96], [x0 + 16, 114, 1], [x0 - 16, 114, 1]]);
    part(c, pad, { fill: vgrad(c, 84, 114, [[0, '#eef2ff'], [1, '#4a5684']]), rim: [1, 1.5, 'rgba(255,255,255,1)'], ink: INK, inkW: 1.1 });
    line(c, curve([[x0 - 14, 104], [x0, 98], [x0 + 14, 104]], false), '#d8b860', 1.4);
  }
  // 後腦＋高馬尾（馬尾畫在後腦上方，從髮帶垂下）
  const head = curve([[52, 58], [54, 38], [75, 26], [96, 38], [98, 58], [92, 80], [58, 80]]);
  part(c, head, {
    fill: vgrad(c, 26, 80, [[0, '#6a54a8'], [1, '#241a48']]), rim: [1.5, 1.5, 'rgba(232,220,255,0.95)'], ink: '#140c22', inkW: 1.2,
    extra: () => fill(c, lock([58, 44], [60, 40], [90, 42, 1], 0, 0.5, 0.1), 'rgba(220,200,255,0.5)'),
  });
  const tail = curve([[68, 40], [82, 40], [90, 80], [86, 130], [76, 156, 1], [70, 128], [66, 84]]);
  part(c, tail, {
    fill: vgrad(c, 40, 156, [[0, '#6a54a8'], [1, '#1c1438']]), rim: [1.5, 1, 'rgba(232,220,255,0.95)'], ink: '#140c22', inkW: 1.1,
    extra: () => line(c, curve([[75, 50], [80, 100], [76, 146]], false), 'rgba(10,6,24,0.5)', 1),
  });
  // 髮帶
  part(c, curve([[70, 40, 1], [80, 40, 1], [81, 45, 1], [69, 45, 1]]), { fill: '#dfe6ff', ink: '#1a2040', inkW: 0.8 });
}
