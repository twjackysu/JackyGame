// 章節節點地圖背景（Canvas 程序繪製）。
// 不引用 config 常數，避免循環 import；尺寸由呼叫端傳入（720×1280）。

function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function radial(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  const g = c.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

/** 第二章：灰燈鎮邊緣（黃昏）→ 沉鐘礦坑剖面。 */
export function drawMapCh2(c: CanvasRenderingContext2D, W: number, H: number): void {
  const sy = H / 1280;
  const Y = (y: number): number => y * sy;
  const r = rng(29);

  // 底色：黃昏天空 → 地表 → 越來越暗的岩層 → 底部紫
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#160e1c');
  bg.addColorStop(0.16, '#2a1824');
  bg.addColorStop(0.27, '#1a1218');
  bg.addColorStop(0.3, '#16100c');
  bg.addColorStop(0.55, '#0e0a0a');
  bg.addColorStop(0.8, '#0a0610');
  bg.addColorStop(1, '#06030a');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  // 黃昏地平線的餘暉＋星點
  radial(c, W * 0.7, Y(300), 360, 'rgba(255,130,70,0.2)');
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`;
    c.fillRect(r() * W, r() * Y(180), 1.5, 1.5);
  }
  // 鎮子暖光
  radial(c, W * 0.5, Y(300), 300, 'rgba(255,165,74,0.18)');

  // 屋頂剪影（兩排）
  for (const [base, col, step, win] of [[Y(300), 'rgba(34,24,34,0.9)', 64, 0.45], [Y(340), 'rgba(24,16,22,0.96)', 78, 0.6]] as [number, string, number, number][]) {
    for (let x = -10; x < W; x += step) {
      const h = 24 + r() * 26;
      const y = base - h;
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x - 4, y + 22);
      c.lineTo(x + step * 0.42, y - 4);
      c.lineTo(x + step * 0.88, y + 22);
      c.fill();
      c.fillRect(x + 2, y + 22, step * 0.8, base - y + 20);
      if (r() < 0.25) c.fillRect(x + step * 0.6, y - 8, 7, 18); // 煙囪
      if (r() < 0.75) {
        c.fillStyle = `rgba(255,190,110,${win})`;
        c.fillRect(x + step * 0.36, y + 30, 8, 10);
      }
    }
  }
  // 地表線
  c.fillStyle = '#0c0808';
  c.fillRect(0, Y(372), W, 6);
  c.fillStyle = 'rgba(255,170,100,0.12)';
  c.fillRect(0, Y(372), W, 2);

  // 岩層（波浪分層，越往下越暗）
  const strata = 8;
  for (let i = 0; i < strata; i++) {
    const y0 = Y(380 + i * 95);
    const t = i / (strata - 1);
    const rr = Math.round(30 - t * 16);
    const gg = Math.round(22 - t * 12);
    const bb = Math.round(20 + t * 6);
    c.fillStyle = `rgba(${rr},${gg},${bb},0.55)`;
    c.beginPath();
    c.moveTo(0, y0);
    for (let x = 0; x <= W; x += 40) c.lineTo(x, y0 + Math.sin(x * 0.012 + i * 1.7) * 14 + r() * 6);
    c.lineTo(W, y0 + 48);
    for (let x = W; x >= 0; x -= 40) c.lineTo(x, y0 + 48 + Math.sin(x * 0.015 + i) * 10);
    c.closePath();
    c.fill();
    // 細層線
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 2;
    c.beginPath();
    for (let x = 0; x <= W; x += 40) {
      const yy = y0 + Math.sin(x * 0.012 + i * 1.7) * 14;
      if (x === 0) c.moveTo(x, yy);
      else c.lineTo(x, yy);
    }
    c.stroke();
  }
  // 碎石紋理
  for (let i = 0; i < 160; i++) {
    c.fillStyle = `rgba(${50 + r() * 30},${40 + r() * 20},${40 + r() * 20},${0.05 + r() * 0.08})`;
    c.beginPath();
    c.ellipse(r() * W, Y(390 + r() * 860), 6 + r() * 24, 3 + r() * 10, r() * 3, 0, Math.PI * 2);
    c.fill();
  }

  // 之字形豎井（坑道）
  const shaft: [number, number][] = [[360, 372], [360, 440], [200, 520], [520, 640], [220, 760], [500, 880], [300, 1000], [380, 1130]];
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(4,2,4,0.85)';
  c.lineWidth = 34;
  c.beginPath();
  shaft.forEach(([x, y], i) => (i === 0 ? c.moveTo(x * (W / 720), Y(y)) : c.lineTo(x * (W / 720), Y(y))));
  c.stroke();
  c.strokeStyle = 'rgba(255,170,90,0.08)';
  c.lineWidth = 2;
  c.stroke();

  // 坑道木支架（沿豎井的小方框）
  for (let k = 0; k < shaft.length - 1; k++) {
    const [x0, y0] = shaft[k] as [number, number];
    const [x1, y1] = shaft[k + 1] as [number, number];
    for (let t = 0.2; t < 1; t += 0.3) {
      const x = (x0 + (x1 - x0) * t) * (W / 720);
      const y = Y(y0 + (y1 - y0) * t);
      c.fillStyle = 'rgba(70,46,28,0.55)';
      c.fillRect(x - 18, y - 18, 5, 36);
      c.fillRect(x + 13, y - 18, 5, 36);
      c.fillRect(x - 21, y - 21, 42, 5);
    }
  }
  // 坑道吊燈（小暖點）
  for (const [x, y] of [[280, 480], [440, 590], [360, 700], [360, 820], [400, 940]] as [number, number][]) {
    radial(c, x * (W / 720), Y(y), 34, 'rgba(255,170,80,0.28)');
  }

  // 礦脈微光（藍）
  for (let i = 0; i < 46; i++) {
    const x = r() * W;
    const y = Y(420 + r() * 720);
    const a = 0.25 + r() * 0.35;
    radial(c, x, y, 6 + r() * 8, `rgba(120,190,255,${a * 0.5})`);
    c.fillStyle = `rgba(170,220,255,${a})`;
    c.fillRect(x - 1, y - 1, 2, 2);
  }

  // 巨鐘剪影（y≈780）
  const bx = W * 0.5;
  const bt = Y(690);
  const bw = 230;
  const bh = Y(190);
  radial(c, bx, bt + bh * 0.6, 220, 'rgba(150,90,230,0.14)');
  c.fillStyle = 'rgba(30,20,30,0.85)';
  c.beginPath();
  c.moveTo(bx - bw * 0.16, bt);
  c.quadraticCurveTo(bx - bw * 0.34, bt + bh * 0.05, bx - bw * 0.34, bt + bh * 0.4);
  c.quadraticCurveTo(bx - bw * 0.36, bt + bh * 0.82, bx - bw * 0.5, bt + bh);
  c.lineTo(bx + bw * 0.5, bt + bh);
  c.quadraticCurveTo(bx + bw * 0.36, bt + bh * 0.82, bx + bw * 0.34, bt + bh * 0.4);
  c.quadraticCurveTo(bx + bw * 0.34, bt + bh * 0.05, bx + bw * 0.16, bt);
  c.closePath();
  c.fill();
  c.fillRect(bx - 16, bt - 16, 32, 18);
  c.strokeStyle = 'rgba(200,150,255,0.22)';
  c.lineWidth = 2;
  c.stroke();
  // 裂痕
  c.strokeStyle = 'rgba(200,140,255,0.35)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(bx + 8, bt + 6);
  c.lineTo(bx - 4, bt + bh * 0.35);
  c.lineTo(bx + 14, bt + bh * 0.62);
  c.lineTo(bx + 2, bt + bh * 0.95);
  c.stroke();

  // 底部「蝕」的紫色腐化光（y 950–1130）
  radial(c, W * 0.5, Y(1060), 380, 'rgba(140,40,210,0.24)');
  radial(c, W * 0.32, Y(1110), 160, 'rgba(200,80,255,0.16)');
  radial(c, W * 0.7, Y(1000), 140, 'rgba(180,70,240,0.13)');
  c.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    c.strokeStyle = `rgba(190,90,255,${0.1 + r() * 0.15})`;
    let x = r() * W;
    let y = Y(1140);
    c.beginPath();
    c.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (r() - 0.5) * 70;
      y -= Y(25 + r() * 30);
      c.lineTo(x, y);
    }
    c.stroke();
  }
  // 最底部壓暗
  const fade = c.createLinearGradient(0, Y(1140), 0, H);
  fade.addColorStop(0, 'rgba(4,2,6,0)');
  fade.addColorStop(1, 'rgba(4,2,6,0.9)');
  c.fillStyle = fade;
  c.fillRect(0, Y(1140), W, H - Y(1140));
}

/** 第三章：王都星冠城（上方：城牆、城門、群塔與星冠塔的天際線；下方：入夜的城區）。 */
export function drawMapCh3(c: CanvasRenderingContext2D, W: number, H: number): void {
  const sy = H / 1280;
  const sx = W / 720;
  const Y = (y: number): number => y * sy;
  const X = (x: number): number => x * sx;
  const r = rng(37);

  // 底色：薄暮天空 → 城牆 → 夜色城區
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0a20');
  bg.addColorStop(0.12, '#1e1838');
  bg.addColorStop(0.24, '#4a2a40');
  bg.addColorStop(0.3, '#20141e');
  bg.addColorStop(0.42, '#100c18');
  bg.addColorStop(0.75, '#0a0814');
  bg.addColorStop(1, '#05040a');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    c.fillStyle = `rgba(230,236,255,${0.15 + r() * 0.45})`;
    c.fillRect(r() * W, r() * Y(240), 1.5, 1.5);
  }
  radial(c, X(360), Y(380), 380, 'rgba(255,140,80,0.2)');

  // 遠景群塔
  const spire = (x: number, base: number, w: number, h: number, col: string): void => {
    c.fillStyle = col;
    c.fillRect(x - w / 2, base - h * 0.6, w, h * 0.6);
    c.beginPath();
    c.moveTo(x - w * 0.62, base - h * 0.6);
    c.lineTo(x, base - h);
    c.lineTo(x + w * 0.62, base - h * 0.6);
    c.fill();
  };
  for (let i = 0; i < 22; i++) {
    const x = X(10 + i * 34 + r() * 14);
    if (Math.abs(x - X(360)) < X(60)) continue;
    spire(x, Y(400), 10 + r() * 10, Y(60 + r() * 120), 'rgba(52,30,54,0.85)');
  }
  // 星冠塔（右側，y≈190–400）
  const tx = X(560);
  const tb = Y(410);
  const th = Y(230);
  radial(c, tx, tb - th, 120, 'rgba(255,210,130,0.22)');
  c.fillStyle = '#1a1024';
  c.beginPath();
  c.moveTo(tx - 26, tb);
  c.lineTo(tx - 15, tb - th * 0.8);
  c.lineTo(tx + 15, tb - th * 0.8);
  c.lineTo(tx + 26, tb);
  c.fill();
  c.beginPath();
  c.moveTo(tx - 20, tb - th * 0.78);
  for (let i = 0; i <= 8; i++) {
    const px = tx - 24 + (48 * i) / 8;
    const py = tb - th * 0.8 - (i % 2 === 0 ? (i === 4 ? 30 : 20) : 6);
    c.lineTo(px, py);
  }
  c.lineTo(tx + 20, tb - th * 0.78);
  c.fill();
  for (let i = 0; i <= 8; i += 2) {
    const px = tx - 24 + (48 * i) / 8;
    const py = tb - th * 0.8 - (i === 4 ? 30 : 20);
    radial(c, px, py, 12, 'rgba(255,210,130,0.7)');
  }
  radial(c, tx, tb - th * 0.8 - 52, 30, 'rgba(255,230,170,0.75)');
  c.fillStyle = 'rgba(255,200,130,0.5)';
  for (let k = 1; k < 5; k++) c.fillRect(tx - 3, tb - th * 0.8 + (th * 0.8 * k) / 5, 6, 4);
  // 左側高塔
  spire(X(130), Y(410), 26, Y(200), '#1a1024');
  radial(c, X(130), Y(410) - Y(120), 30, 'rgba(255,190,120,0.35)');

  // 城牆＋城門（y≈350–420）
  c.fillStyle = '#140c16';
  c.fillRect(0, Y(360), W, Y(64));
  for (let x = 0; x < W; x += 26) c.fillRect(x, Y(348), 15, Y(14));
  c.fillStyle = 'rgba(255,170,100,0.3)';
  c.fillRect(0, Y(360), W, 2);
  for (const side of [-1, 1]) {
    const cx = X(360) + side * 70;
    c.fillStyle = '#120a14';
    c.fillRect(cx - 24, Y(320), 48, Y(104));
    c.beginPath();
    c.moveTo(cx - 30, Y(322));
    c.lineTo(cx, Y(278));
    c.lineTo(cx + 30, Y(322));
    c.fill();
    c.fillStyle = 'rgba(255,180,110,0.6)';
    c.fillRect(cx - 2, Y(340), 4, 10);
  }
  c.fillStyle = '#120a14';
  c.fillRect(X(316), Y(340), X(88), Y(84));
  c.fillStyle = 'rgba(255,170,100,0.55)';
  c.beginPath();
  c.moveTo(X(338), Y(424));
  c.lineTo(X(338), Y(386));
  c.quadraticCurveTo(X(360), Y(360), X(382), Y(386));
  c.lineTo(X(382), Y(424));
  c.fill();
  radial(c, X(360), Y(410), 60, 'rgba(255,170,90,0.3)');
  c.fillStyle = '#0c0810';
  c.fillRect(0, Y(424), W, 5);

  // 城區屋頂（避開節點周圍）
  const nodes: [number, number][] = [
    [360, 300], [360, 470], [150, 600], [570, 600], [160, 780], [560, 820], [300, 930], [470, 1040], [200, 1060],
  ];
  const nearNode = (x: number, y: number, d: number): boolean =>
    nodes.some(([nx, ny]) => Math.hypot(nx - x, ny - y) < d);
  for (let row = 0; row < 14; row++) {
    const base = 470 + row * 58;
    for (let x = -20 + (row % 2) * 30; x < 740; x += 46 + r() * 30) {
      if (nearNode(x, base - 20, 78)) continue;
      const w = 26 + r() * 22;
      const h = 14 + r() * 18;
      const shade = 18 + row * 0.6;
      c.fillStyle = `rgba(${shade + 6},${shade},${shade + 14},0.9)`;
      c.fillRect(X(x - w / 2), Y(base - h), X(w), Y(h));
      c.beginPath();
      c.moveTo(X(x - w / 2 - 3), Y(base - h));
      c.lineTo(X(x), Y(base - h - w * 0.4));
      c.lineTo(X(x + w / 2 + 3), Y(base - h));
      c.fill();
      if (r() < 0.55) {
        c.fillStyle = `rgba(255,190,110,${0.35 + r() * 0.35})`;
        c.fillRect(X(x - 3), Y(base - h * 0.6), 5, 6);
      }
    }
  }

  // 街道（星光連線般的燈路）
  const roads: [number, number][][] = [
    [[360, 424], [360, 470], [150, 600], [160, 780], [300, 930], [200, 1060]],
    [[360, 470], [570, 600], [560, 820], [470, 1040]],
    [[300, 930], [470, 1040]],
  ];
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const road of roads) {
    c.strokeStyle = 'rgba(6,4,10,0.85)';
    c.lineWidth = 26;
    c.beginPath();
    road.forEach(([x, y], i) => (i === 0 ? c.moveTo(X(x), Y(y)) : c.lineTo(X(x), Y(y))));
    c.stroke();
    c.strokeStyle = 'rgba(255,190,120,0.1)';
    c.lineWidth = 2;
    c.stroke();
  }
  for (const road of roads) {
    for (let k = 0; k < road.length - 1; k++) {
      const [x0, y0] = road[k] as [number, number];
      const [x1, y1] = road[k + 1] as [number, number];
      for (let t = 0.3; t < 0.8; t += 0.4) {
        radial(c, X(x0 + (x1 - x0) * t), Y(y0 + (y1 - y0) * t), 22, 'rgba(255,180,100,0.3)');
      }
    }
  }

  // 星冠廣場：星紋圓盤
  radial(c, X(360), Y(470), 150, 'rgba(255,200,120,0.14)');
  c.strokeStyle = 'rgba(255,210,140,0.2)';
  c.lineWidth = 2;
  for (const rr of [92, 70]) {
    c.beginPath();
    c.ellipse(X(360), Y(470), X(rr), Y(rr * 0.55), 0, 0, Math.PI * 2);
    c.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    c.beginPath();
    c.moveTo(X(360 + Math.cos(a) * 70), Y(470 + Math.sin(a) * 38));
    c.lineTo(X(360 + Math.cos(a) * 92), Y(470 + Math.sin(a) * 50));
    c.stroke();
  }

  // 夜市燈籠串（左側）
  for (const [y0, sag] of [[712, 18], [852, 14]] as [number, number][]) {
    c.strokeStyle = 'rgba(10,6,8,0.8)';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let x = 30; x <= 300; x += 10) {
      const t = (x - 165) / 135;
      const y = Y(y0 + sag * (1 - t * t));
      if (x === 30) c.moveTo(X(x), y);
      else c.lineTo(X(x), y);
    }
    c.stroke();
    for (let x = 42; x < 300; x += 26) {
      const t = (x - 165) / 135;
      const y = Y(y0 + sag * (1 - t * t) + 5);
      radial(c, X(x), y, 12, 'rgba(255,120,70,0.55)');
      c.fillStyle = r() < 0.5 ? '#ff9a5a' : '#ffc070';
      c.beginPath();
      c.ellipse(X(x), y, 3, 4, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  // 研究院穹頂（右側，偏離節點）
  const dx = X(676);
  const dy = Y(900);
  radial(c, dx, dy - 40, 170, 'rgba(110,180,255,0.2)');
  c.fillStyle = '#0e1426';
  c.fillRect(dx - 80, dy, 160, Y(60));
  c.beginPath();
  c.arc(dx, dy, 70, Math.PI, 0);
  c.fill();
  c.strokeStyle = 'rgba(150,210,255,0.45)';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(dx, dy, 70, Math.PI, Math.PI * 1.6);
  c.stroke();
  c.strokeStyle = 'rgba(150,210,255,0.18)';
  for (const k of [-0.5, 0, 0.5]) {
    c.beginPath();
    c.ellipse(dx, dy, 70 * Math.cos(k), 70, 0, Math.PI, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = '#0e1426';
  c.fillRect(dx - 3, dy - 96, 6, 28);
  radial(c, dx, dy - 98, 22, 'rgba(160,220,255,0.8)');
  c.fillStyle = 'rgba(150,210,255,0.5)';
  for (let k = 0; k < 5; k++) c.fillRect(dx - 70 + k * 32, dy + 16, 10, 22);

  // 鐘樓（右下）
  const bx = X(620);
  const bb = Y(1210);
  radial(c, bx, bb - Y(200), 120, 'rgba(200,215,255,0.12)');
  c.fillStyle = '#0c0a16';
  c.fillRect(bx - 30, bb - Y(210), 60, Y(210));
  c.beginPath();
  c.moveTo(bx - 40, bb - Y(208));
  c.lineTo(bx, bb - Y(290));
  c.lineTo(bx + 40, bb - Y(208));
  c.fill();
  c.fillStyle = 'rgba(255,200,130,0.4)';
  c.beginPath();
  c.moveTo(bx - 14, bb - Y(150));
  c.lineTo(bx - 14, bb - Y(180));
  c.arc(bx, bb - Y(180), 14, Math.PI, 0);
  c.lineTo(bx + 14, bb - Y(150));
  c.fill();
  c.fillStyle = '#0c0a16';
  c.beginPath();
  c.moveTo(bx - 9, bb - Y(152));
  c.quadraticCurveTo(bx - 8, bb - Y(180), bx, bb - Y(182));
  c.quadraticCurveTo(bx + 8, bb - Y(180), bx + 9, bb - Y(152));
  c.fill();
  c.strokeStyle = 'rgba(200,215,255,0.35)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(bx, bb - Y(290));
  c.lineTo(bx - 40, bb - Y(208));
  c.stroke();
  // 月亮（鐘樓上方，淡）
  radial(c, X(660), Y(110), 110, 'rgba(200,215,255,0.2)');
  c.fillStyle = 'rgba(235,238,250,0.85)';
  c.beginPath();
  c.arc(X(660), Y(110), 26, 0, Math.PI * 2);
  c.fill();

  // 黎明的微光（左下，crown_plaza_dawn）
  radial(c, X(140), Y(1200), 260, 'rgba(255,170,110,0.1)');

  // 節點下方壓暗，保持可讀
  for (const [nx, ny] of nodes) radial(c, X(nx), Y(ny), 70, 'rgba(6,4,12,0.55)');

  // 底部壓暗
  const fade = c.createLinearGradient(0, Y(1150), 0, H);
  fade.addColorStop(0, 'rgba(4,3,8,0)');
  fade.addColorStop(1, 'rgba(4,3,8,0.85)');
  c.fillStyle = fade;
  c.fillRect(0, Y(1150), W, H - Y(1150));
}

/** 第四章：王立星學院（夜）→ 地底層層剖面 → 最深處的星核爐。 */
export function drawMapCh4(c: CanvasRenderingContext2D, W: number, H: number): void {
  const sy = H / 1280;
  const sx = W / 720;
  const Y = (y: number): number => y * sy;
  const X = (x: number): number => x * sx;
  const r = rng(41);

  // 底色：夜空 → 岩層 → 熾熱深處
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070818');
  bg.addColorStop(0.3, '#14122a');
  bg.addColorStop(0.34, '#0c0a14');
  bg.addColorStop(0.6, '#0a0812');
  bg.addColorStop(0.82, '#1a0c18');
  bg.addColorStop(1, '#2a1010');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 80; i++) {
    c.fillStyle = `rgba(230,236,255,${0.15 + r() * 0.5})`;
    c.fillRect(r() * W, r() * Y(300), 1.5, 1.5);
  }
  // 月
  radial(c, X(600), Y(90), 100, 'rgba(200,215,255,0.2)');
  c.fillStyle = 'rgba(235,238,250,0.85)';
  c.beginPath(); c.arc(X(600), Y(90), 22, 0, Math.PI * 2); c.fill();

  // 學院建築剪影（y190–420）
  const ground = Y(420);
  c.fillStyle = '#16142a';
  c.fillRect(X(70), Y(300), X(580), ground - Y(300));
  for (const [x, w, h] of [[110, 50, 200], [200, 40, 150], [520, 40, 160], [610, 50, 210], [360, 120, 230]] as [number, number, number][]) {
    c.fillStyle = '#1a1830';
    c.fillRect(X(x - w / 2), ground - Y(h), X(w), Y(h));
    c.beginPath();
    c.moveTo(X(x - w / 2 - 6), ground - Y(h));
    c.lineTo(X(x), ground - Y(h + (x === 360 ? 40 : 60)));
    c.lineTo(X(x + w / 2 + 6), ground - Y(h));
    c.fill();
  }
  // 中央星穹頂與星徽
  c.fillStyle = '#201c3a';
  c.beginPath(); c.arc(X(360), Y(196), X(54), Math.PI, 0); c.fill();
  radial(c, X(360), Y(170), 60, 'rgba(180,160,255,0.45)');
  c.fillStyle = '#e8e0ff';
  c.beginPath(); c.arc(X(360), Y(166), 4, 0, Math.PI * 2); c.fill();
  // 窗光
  for (let i = 0; i < 40; i++) {
    const x = X(80 + r() * 560);
    const y = Y(310 + r() * 90);
    if (r() < 0.45) continue;
    c.fillStyle = `rgba(255,210,140,${0.35 + r() * 0.4})`;
    c.fillRect(x, y, 4, 7);
  }
  // 地表線
  c.fillStyle = '#0a0810';
  c.fillRect(0, ground, W, Y(14));
  c.fillStyle = 'rgba(160,150,220,0.35)';
  c.fillRect(0, ground, W, 1.5);

  // 地層分界（帶狀岩層，越深越暖）
  const bands: [number, number, string, string][] = [
    [434, 640, '#100e1a', 'rgba(120,190,255,0.25)'],
    [640, 820, '#120c1c', 'rgba(190,120,255,0.3)'],
    [820, 960, '#140c16', 'rgba(150,140,200,0.2)'],
    [960, 1280, '#1c0c12', 'rgba(255,150,80,0.3)'],
  ];
  for (const [t, b, col, edge] of bands) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, Y(t));
    for (let x = 0; x <= 720; x += 40) c.lineTo(X(x), Y(t + Math.sin(x * 0.03 + t) * 6));
    c.lineTo(W, Y(b));
    c.lineTo(0, Y(b));
    c.fill();
    c.strokeStyle = edge;
    c.lineWidth = 1.5;
    c.beginPath();
    for (let x = 0; x <= 720; x += 40) {
      const yy = Y(t + Math.sin(x * 0.03 + t) * 6);
      if (x === 0) c.moveTo(X(x), yy);
      else c.lineTo(X(x), yy);
    }
    c.stroke();
    for (let i = 0; i < 30; i++) {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(X(r() * 720), Y(t + r() * (b - t)), X(10 + r() * 30), 2);
    }
  }

  // 垂直豎井與階梯（連接各層）
  const shaft = (x: number, y0: number, y1: number): void => {
    c.fillStyle = 'rgba(4,3,8,0.7)';
    c.fillRect(X(x - 12), Y(y0), X(24), Y(y1 - y0));
    c.strokeStyle = 'rgba(200,180,140,0.35)';
    c.lineWidth = 1.2;
    for (let y = y0 + 8; y < y1; y += 14) {
      c.beginPath(); c.moveTo(X(x - 10), Y(y)); c.lineTo(X(x + 10), Y(y)); c.stroke();
    }
  };
  shaft(300, 420, 520);
  shaft(470, 420, 560);
  shaft(260, 560, 740);
  shaft(480, 600, 740);
  shaft(250, 760, 900);
  shaft(300, 920, 1060);

  // 管線（橫穿各層）
  c.lineCap = 'round';
  for (const [y, col] of [[470, 'rgba(140,170,210,0.35)'], [680, 'rgba(200,150,110,0.35)'], [860, 'rgba(140,170,210,0.3)']] as [number, string][]) {
    c.strokeStyle = '#1c1a24';
    c.lineWidth = 8;
    c.beginPath(); c.moveTo(0, Y(y)); c.lineTo(W, Y(y)); c.stroke();
    c.strokeStyle = col;
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, Y(y) - 3); c.lineTo(W, Y(y) - 3); c.stroke();
  }

  // 書庫（左）書架剪影
  for (let i = 0; i < 6; i++) {
    c.fillStyle = 'rgba(40,28,26,0.9)';
    c.fillRect(X(70 + i * 38), Y(480), X(26), Y(110));
    for (let k = 0; k < 4; k++) {
      c.fillStyle = 'rgba(255,200,140,0.12)';
      c.fillRect(X(70 + i * 38), Y(500 + k * 26), X(26), 1.5);
    }
  }
  radial(c, X(180), Y(520), 110, 'rgba(255,200,130,0.16)');
  // 牢房（右）鐵柵
  c.strokeStyle = 'rgba(150,170,200,0.4)';
  c.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    c.beginPath(); c.moveTo(X(470 + i * 12), Y(520)); c.lineTo(X(470 + i * 12), Y(610)); c.stroke();
  }
  radial(c, X(550), Y(560), 110, 'rgba(120,190,255,0.14)');
  // 實驗室培養槽（中）
  for (const [x, h] of [[280, 70], [360, 90], [440, 70]] as [number, number][]) {
    radial(c, X(x), Y(740), 60, 'rgba(180,90,255,0.3)');
    c.fillStyle = 'rgba(150,80,230,0.45)';
    c.fillRect(X(x - 16), Y(740 - h / 2), X(32), Y(h));
    c.fillStyle = 'rgba(30,22,20,0.9)';
    c.fillRect(X(x - 20), Y(740 - h / 2 - 8), X(40), Y(8));
    c.fillRect(X(x - 20), Y(740 + h / 2), X(40), Y(8));
  }
  // 隱匿營地（左下）營火
  radial(c, X(170), Y(900), 90, 'rgba(255,170,90,0.3)');
  c.fillStyle = '#2a1810';
  c.beginPath(); c.moveTo(X(110), Y(930)); c.lineTo(X(140), Y(870)); c.lineTo(X(170), Y(930)); c.fill();

  // 星核爐（底部）：巨大發光核心＋鎖鏈
  const fx = X(400);
  const fy = Y(1100);
  radial(c, fx, fy, 420, 'rgba(255,130,60,0.28)');
  radial(c, fx, fy, 240, 'rgba(190,100,255,0.3)');
  for (const [x, y] of [[40, 980], [700, 990], [140, 1270], [680, 1270]] as [number, number][]) {
    c.strokeStyle = 'rgba(30,18,16,0.95)';
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(X(x), Y(y)); c.quadraticCurveTo((X(x) + fx) / 2, (Y(y) + fy) / 2 + Y(30), fx, fy); c.stroke();
    c.strokeStyle = 'rgba(255,180,110,0.4)';
    c.lineWidth = 1.2;
    c.stroke();
  }
  radial(c, fx, fy, 130, 'rgba(255,230,180,0.85)');
  const core = c.createRadialGradient(fx - 10, fy - 12, 4, fx, fy, 56);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.5, '#ffd890');
  core.addColorStop(1, 'rgba(200,90,200,0.85)');
  c.fillStyle = core;
  c.beginPath(); c.arc(fx, fy, 56, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const d = 60 + r() * 300;
    c.fillStyle = r() < 0.3 ? `rgba(210,150,255,${0.3 + r() * 0.5})` : `rgba(255,200,120,${0.3 + r() * 0.5})`;
    c.fillRect(fx + Math.cos(a) * d, fy + Math.sin(a) * d * 0.7, 2, 2);
  }

  // 節點下方壓暗，保持可讀
  const nodes: [number, number][] = [[360, 320], [180, 520], [550, 560], [360, 740], [170, 900], [400, 1060]];
  for (const [nx, ny] of nodes) radial(c, X(nx), Y(ny), 70, 'rgba(6,4,12,0.55)');
}

/** 終章：墜星裂谷 — 撕裂天空下的崖緣 → 岩棚營火 → 發光的深淵核心。 */
export function drawMapCh5(c: CanvasRenderingContext2D, W: number, H: number): void {
  const sy = H / 1280;
  const sx = W / 720;
  const Y = (y: number): number => y * sy;
  const X = (x: number): number => x * sx;
  const r = rng(51);

  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#04030c');
  bg.addColorStop(0.25, '#140a2a');
  bg.addColorStop(0.45, '#0a0614');
  bg.addColorStop(0.7, '#120822');
  bg.addColorStop(1, '#3a1040');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) {
    c.fillStyle = `rgba(230,230,255,${0.15 + r() * 0.55})`;
    c.fillRect(r() * W, r() * Y(330), 1.5, 1.5);
  }

  // 撕裂的天空
  const tear: [number, number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    tear.push([X(30 + t * 660), Y(120 + t * 70 + (r() - 0.5) * 16), Y(18 * Math.sin(Math.PI * t) * (0.6 + r() * 0.5))]);
  }
  for (const [x, y] of tear) radial(c, x, y, 60, 'rgba(150,80,255,0.18)');
  c.beginPath();
  tear.forEach(([x, y, h], i) => (i === 0 ? c.moveTo(x, y - h) : c.lineTo(x, y - h)));
  for (let i = tear.length - 1; i >= 0; i--) c.lineTo(tear[i]![0], tear[i]![1] + tear[i]![2]);
  c.closePath();
  const tg = c.createLinearGradient(0, Y(100), 0, Y(210));
  tg.addColorStop(0, '#f0d8ff');
  tg.addColorStop(0.5, '#a050ff');
  tg.addColorStop(1, '#ff9a60');
  c.fillStyle = tg;
  c.fill();

  // 流星
  const meteor = (x: number, y: number, len: number, col: string): void => {
    const a = 1.1;
    const g = c.createLinearGradient(x, y, x - Math.cos(a) * len, y - Math.sin(a) * len);
    g.addColorStop(0, `rgba(${col},0.95)`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.strokeStyle = g;
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len); c.stroke();
    radial(c, x, y, 12, `rgba(${col},0.6)`);
  };
  for (let i = 0; i < 10; i++) meteor(X(60 + r() * 600), Y(60 + r() * 300), Y(50 + r() * 90), r() < 0.4 ? '255,170,110' : '210,180,255');

  // 峽谷兩壁一路向下收窄
  const wall = (side: 1 | -1, col: string, edge: string, reach: number): void => {
    const x0 = side === 1 ? 0 : W;
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x0, Y(400));
    const pts: [number, number][] = [];
    for (let y = 400; y <= 1280; y += 40) {
      const k = (y - 400) / 880;
      pts.push([x0 + side * X(reach + Math.sin(y * 0.02 + side) * 26 + k * 60 + (r() - 0.5) * 20), Y(y)]);
    }
    for (const [x, y] of pts) c.lineTo(x, y);
    c.lineTo(x0, H); c.closePath(); c.fill();
    c.strokeStyle = edge;
    c.lineWidth = 1.5;
    c.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
    c.stroke();
  };
  wall(1, '#0c0816', 'rgba(190,130,255,0.35)', 170);
  wall(-1, '#0c0816', 'rgba(190,130,255,0.35)', 170);

  // 崖緣（y190–420）：兩側崖壁向中央合抱，留出往下的裂口
  c.fillStyle = '#0c0816';
  c.beginPath();
  c.moveTo(0, Y(260));
  c.lineTo(X(120), Y(300)); c.lineTo(X(220), Y(330)); c.lineTo(X(290), Y(400)); c.lineTo(X(300), Y(420));
  c.lineTo(X(230), Y(470)); c.lineTo(0, Y(470)); c.closePath(); c.fill();
  c.beginPath();
  c.moveTo(X(420), Y(420)); c.lineTo(X(440), Y(390)); c.lineTo(X(520), Y(320)); c.lineTo(X(620), Y(290)); c.lineTo(W, Y(250));
  c.lineTo(W, Y(470)); c.lineTo(X(490), Y(470)); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(210,160,255,0.55)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(0, Y(260)); c.lineTo(X(120), Y(300)); c.lineTo(X(220), Y(330)); c.lineTo(X(290), Y(400));
  c.moveTo(X(440), Y(390)); c.lineTo(X(520), Y(320)); c.lineTo(X(620), Y(290)); c.lineTo(W, Y(250));
  c.stroke();

  // 深淵核心（底部）
  radial(c, X(360), Y(1080), 420, 'rgba(170,80,255,0.5)');
  radial(c, X(360), Y(1080), 200, 'rgba(255,170,120,0.4)');
  c.fillStyle = '#040208';
  c.beginPath(); c.arc(X(360), Y(1080), X(54), 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,220,170,0.9)';
  c.lineWidth = 2;
  c.beginPath(); c.arc(X(360), Y(1080), X(54), 0, Math.PI * 2); c.stroke();
  for (let k = 0; k < 4; k++) {
    c.strokeStyle = `rgba(${k % 2 ? '255,170,120' : '180,120,255'},${0.32 - k * 0.06})`;
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(X(360), Y(1090), X(110 + k * 50), Y(22 + k * 10), -0.1, 0, Math.PI * 2); c.stroke();
  }
  // 浮空岩
  for (const [x, y, w] of [[230, 980, 40], [500, 950, 34], [270, 1180, 30], [470, 1200, 44], [360, 900, 24]] as [number, number, number][]) {
    c.fillStyle = '#0a0612';
    c.beginPath();
    c.moveTo(X(x - w / 2), Y(y)); c.lineTo(X(x + w / 2), Y(y - 4)); c.lineTo(X(x + 4), Y(y + w * 0.6)); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,190,140,0.5)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(X(x - w / 2), Y(y)); c.lineTo(X(x + w / 2), Y(y - 4)); c.stroke();
  }

  // 中段岩棚＋小營火（y≈700）
  c.fillStyle = '#07050c';
  c.beginPath();
  c.moveTo(X(170), Y(690));
  c.quadraticCurveTo(X(300), Y(668), X(470), Y(686));
  c.lineTo(X(460), Y(720)); c.lineTo(X(380), Y(760)); c.lineTo(X(280), Y(752)); c.lineTo(X(190), Y(720));
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,170,110,0.5)';
  c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(X(170), Y(690)); c.quadraticCurveTo(X(300), Y(668), X(470), Y(686)); c.stroke();
  radial(c, X(420), Y(676), 110, 'rgba(255,150,70,0.35)');
  c.fillStyle = 'rgba(255,140,60,0.95)';
  c.beginPath(); c.moveTo(X(412), Y(682)); c.quadraticCurveTo(X(414), Y(670), X(420), Y(660)); c.quadraticCurveTo(X(426), Y(670), X(428), Y(682)); c.fill();
  c.fillStyle = 'rgba(255,240,200,1)';
  c.beginPath(); c.moveTo(X(417), Y(682)); c.quadraticCurveTo(X(418), Y(676), X(420), Y(670)); c.quadraticCurveTo(X(422), Y(676), X(423), Y(682)); c.fill();

  // 星燼往上飄
  for (let i = 0; i < 90; i++) {
    c.fillStyle = r() < 0.5 ? `rgba(210,160,255,${0.25 + r() * 0.5})` : `rgba(255,190,130,${0.25 + r() * 0.5})`;
    c.fillRect(X(160 + r() * 400), Y(420 + r() * 840), 1.6, 1.6);
  }

  // 節點下方壓暗，保持可讀
  const nodes: [number, number][] = [[360, 360], [360, 700], [360, 1040]];
  for (const [nx, ny] of nodes) radial(c, X(nx), Y(ny), 70, 'rgba(6,4,12,0.55)');
}
