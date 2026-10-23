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
