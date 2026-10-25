// 旅商莫托（D-116 行商的程式美術備援，第 24 輪）：兜帽斗篷＋大背包＋掛燈手杖。
// 營火旁（世界裡）和行商面板標題旁共用；之後有 AI 立繪（ART_REQUESTS R-015）再換成圖片。
import Phaser from 'phaser';

/**
 * 在 (x, y)（腳底中心）畫一個高 h 像素的旅商。now＝毫秒（燈火閃爍、眨眼、呼吸）。
 * 回傳燈的位置，呼叫端想加光暈可以用。
 */
export function drawMerchant(g: Phaser.GameObjects.Graphics, x: number, y: number, h: number, now: number): { lx: number; ly: number } {
  const s = h / 100;
  const breath = Math.sin(now / 700) * 1.2 * s;
  // 影子
  g.fillStyle(0x000000, 0.35).fillEllipse(x + 6 * s, y, 70 * s, 16 * s);
  // 背包（在身體後面、右上）＋捲起的睡袋
  g.fillStyle(0x5a3a1c, 1).fillRoundedRect(x + 2 * s, y - 78 * s + breath, 34 * s, 46 * s, 7 * s);
  g.fillStyle(0x7a5228, 1).fillRoundedRect(x + 6 * s, y - 70 * s + breath, 26 * s, 12 * s, 4 * s);
  g.fillStyle(0x3f6a5a, 1).fillRoundedRect(x - 2 * s, y - 88 * s + breath, 42 * s, 12 * s, 6 * s);
  g.lineStyle(1.5 * s, 0x2a1a0c, 0.9).strokeRoundedRect(x + 2 * s, y - 78 * s + breath, 34 * s, 46 * s, 7 * s);
  // 掛在背包上的鍋子和小袋子
  g.fillStyle(0x8a8a90, 1).fillCircle(x + 34 * s, y - 44 * s + breath, 6 * s);
  g.fillStyle(0xb08040, 1).fillCircle(x + 8 * s, y - 36 * s + breath, 5 * s);
  // 斗篷（梯形，下襬左右輕晃）
  const sway = Math.sin(now / 900) * 2 * s;
  g.fillStyle(0x2e3a4a, 1).fillPoints(
    [
      { x: x - 12 * s, y: y - 66 * s + breath },
      { x: x + 12 * s, y: y - 66 * s + breath },
      { x: x + 22 * s + sway, y: y - 2 * s },
      { x: x - 24 * s + sway, y: y - 2 * s },
    ],
    true,
  );
  // 斗篷上的布邊與腰帶
  g.fillStyle(0xc8a050, 1).fillRect(x - 15 * s, y - 40 * s + breath, 31 * s, 4 * s);
  g.fillStyle(0xffd27a, 1).fillCircle(x, y - 38 * s + breath, 2.6 * s);
  g.lineStyle(2 * s, 0x1c2430, 1).lineBetween(x - 24 * s + sway, y - 2 * s, x + 22 * s + sway, y - 2 * s);
  // 兜帽（圓＋尖）
  g.fillStyle(0x24303e, 1).fillCircle(x, y - 74 * s + breath, 14 * s);
  g.fillTriangle(x - 8 * s, y - 84 * s + breath, x + 4 * s, y - 86 * s + breath, x + 12 * s, y - 98 * s + breath);
  // 臉在陰影裡：兩點琥珀色眼睛（偶爾眨眼）
  g.fillStyle(0x0c0f14, 1).fillEllipse(x - 2 * s, y - 72 * s + breath, 18 * s, 14 * s);
  const blink = now % 4200 < 140;
  if (!blink) {
    g.fillStyle(0xffc860, 1).fillCircle(x - 6 * s, y - 73 * s + breath, 1.8 * s);
    g.fillCircle(x + 2 * s, y - 73 * s + breath, 1.8 * s);
  }
  // 手杖＋掛燈（左手邊，燈火閃爍）
  g.lineStyle(3 * s, 0x6a4a28, 1).lineBetween(x - 26 * s, y - 1 * s, x - 22 * s, y - 92 * s);
  g.lineStyle(1.5 * s, 0x3a2a18, 1).lineBetween(x - 22 * s, y - 90 * s, x - 34 * s, y - 86 * s);
  const lx = x - 34 * s + Math.sin(now / 600) * 1.5 * s;
  const ly = y - 76 * s;
  g.lineStyle(1 * s, 0x3a2a18, 1).lineBetween(x - 34 * s, y - 86 * s, lx, ly - 7 * s);
  const fl = 0.75 + 0.25 * Math.sin(now / 110) * Math.sin(now / 47);
  g.fillStyle(0xffc860, 0.18 * fl).fillCircle(lx, ly, 18 * s);
  g.fillStyle(0xffc860, 0.3 * fl).fillCircle(lx, ly, 10 * s);
  g.fillStyle(0x3a2a18, 1).fillRect(lx - 5 * s, ly - 8 * s, 10 * s, 3 * s);
  g.fillStyle(0xffe6a0, fl).fillRoundedRect(lx - 4 * s, ly - 5 * s, 8 * s, 11 * s, 2 * s);
  // 偶爾一閃的金幣光
  if (now % 3000 < 400) {
    const t = (now % 3000) / 400;
    g.fillStyle(0xfff0a0, 1 - t).fillCircle(x + 16 * s, y - 30 * s - t * 8 * s, 2.2 * s);
  }
  return { lx, ly };
}

/**
 * 燼牌的另外兩位對手（D-129，程式美術，和莫托同一套畫法：腳底在 (x, y)、高 h）。
 * - 薇菈（荊棘谷）：綠色短披肩、紅褐長髮、背著藥草籃，身邊一隻趴著的棘背獵犬。
 * - 葛倫（燼紅裂谷）：光頭大鬍子、皮圍裙、肩上扛鍛造錘，圍裙上的燼紋會發亮。
 * - 伊妲（隱藏對手）：深紫長袍、銀白長髮、發光的書、繞著星燼。
 */
export function drawCardRival(g: Phaser.GameObjects.Graphics, id: string, x: number, y: number, h: number, now: number): void {
  const s = h / 100;
  const breath = Math.sin(now / 700) * 1.2 * s;
  g.fillStyle(0x000000, 0.35).fillEllipse(x, y, 66 * s, 15 * s);
  if (id === 'vela') {
    // 趴著的獵犬（左腳邊）
    const tail = Math.sin(now / 260) * 4 * s;
    g.fillStyle(0x4a3226, 1).fillEllipse(x - 34 * s, y - 7 * s, 34 * s, 13 * s);
    g.fillCircle(x - 50 * s, y - 11 * s, 7 * s);
    g.fillStyle(0x7a2a3a, 1).fillTriangle(x - 40 * s, y - 13 * s, x - 34 * s, y - 22 * s, x - 30 * s, y - 13 * s);
    g.fillTriangle(x - 30 * s, y - 13 * s, x - 25 * s, y - 20 * s, x - 22 * s, y - 12 * s);
    g.lineStyle(2.5 * s, 0x4a3226, 1).lineBetween(x - 18 * s, y - 8 * s, x - 10 * s, y - 14 * s + tail);
    g.fillStyle(0xc8ff8a, 1).fillCircle(x - 52 * s, y - 12 * s, 1.4 * s);
    // 藥草籃（背後）
    g.fillStyle(0x8a6a3a, 1).fillRoundedRect(x + 4 * s, y - 72 * s + breath, 26 * s, 30 * s, 5 * s);
    g.fillStyle(0x6ac04a, 1).fillCircle(x + 10 * s, y - 74 * s + breath, 6 * s).fillCircle(x + 22 * s, y - 76 * s + breath, 7 * s);
    g.fillStyle(0xd85a7a, 1).fillCircle(x + 16 * s, y - 80 * s + breath, 3 * s);
    // 長裙＋披肩
    g.fillStyle(0x5a3a2a, 1).fillPoints([{ x: x - 10 * s, y: y - 58 * s + breath }, { x: x + 10 * s, y: y - 58 * s + breath }, { x: x + 18 * s, y: y - 2 * s }, { x: x - 18 * s, y: y - 2 * s }], true);
    g.fillStyle(0x3a6a3a, 1).fillPoints([{ x: x - 16 * s, y: y - 62 * s + breath }, { x: x + 16 * s, y: y - 62 * s + breath }, { x: x + 20 * s, y: y - 40 * s + breath }, { x: x - 20 * s, y: y - 40 * s + breath }], true);
    g.fillStyle(0xc8ff8a, 1).fillCircle(x, y - 58 * s + breath, 2.4 * s);
    // 頭：長髮＋臉＋眼睛
    g.fillStyle(0x8a3a24, 1).fillEllipse(x, y - 70 * s + breath, 28 * s, 30 * s);
    g.fillRect(x - 13 * s, y - 70 * s + breath, 26 * s, 18 * s);
    g.fillStyle(0xf0c8a0, 1).fillEllipse(x, y - 72 * s + breath, 18 * s, 20 * s);
    g.fillStyle(0x8a3a24, 1).fillEllipse(x - 3 * s, y - 81 * s + breath, 20 * s, 8 * s);
    if (now % 3800 >= 140) {
      g.fillStyle(0x2a4a2a, 1).fillCircle(x - 4 * s, y - 72 * s + breath, 1.7 * s);
      g.fillCircle(x + 4 * s, y - 72 * s + breath, 1.7 * s);
    }
    g.fillStyle(0xd8706a, 0.5).fillCircle(x - 6 * s, y - 68 * s + breath, 2 * s).fillCircle(x + 6 * s, y - 68 * s + breath, 2 * s);
  } else if (id === 'ida') {
    // 伊妲（D-132，隱藏對手）：深紫長袍、銀白長髮、手上攤開一本發光的書，身邊繞著幾點星燼
    const sway = Math.sin(now / 900) * 2 * s;
    g.fillStyle(0x2a1a44, 1).fillPoints([{ x: x - 11 * s, y: y - 62 * s + breath }, { x: x + 11 * s, y: y - 62 * s + breath }, { x: x + 24 * s + sway, y: y - 2 * s }, { x: x - 24 * s + sway, y: y - 2 * s }], true);
    g.lineStyle(2 * s, 0xc8a0ff, 0.7).lineBetween(x - 24 * s + sway, y - 3 * s, x + 24 * s + sway, y - 3 * s);
    g.fillStyle(0xe0d8f0, 1).fillEllipse(x, y - 72 * s + breath, 26 * s, 30 * s);
    g.fillRect(x - 13 * s, y - 72 * s + breath, 26 * s, 26 * s);
    g.fillStyle(0xf0dcc8, 1).fillEllipse(x, y - 73 * s + breath, 17 * s, 19 * s);
    if (now % 5200 >= 140) {
      g.fillStyle(0x6a4ac8, 1).fillCircle(x - 4 * s, y - 73 * s + breath, 1.7 * s);
      g.fillCircle(x + 4 * s, y - 73 * s + breath, 1.7 * s);
    }
    g.fillStyle(0xffd27a, 1).fillCircle(x, y - 86 * s + breath, 2.4 * s);
    // 書：兩頁、內頁發光
    const bl = 0.6 + 0.4 * Math.sin(now / 420);
    g.fillStyle(0xffe6a0, 0.25 * bl).fillCircle(x, y - 40 * s + breath, 22 * s);
    g.fillStyle(0x5a3a20, 1).fillRect(x - 17 * s, y - 46 * s + breath, 34 * s, 14 * s);
    g.fillStyle(0xfff4d8, 1).fillRect(x - 15 * s, y - 48 * s + breath, 14 * s, 12 * s).fillRect(x + 1 * s, y - 48 * s + breath, 14 * s, 12 * s);
    // 繞著她的星燼
    for (let k = 0; k < 4; k++) {
      const a = now / 1600 + (k * Math.PI) / 2;
      g.fillStyle(k % 2 ? 0xffd27a : 0xc8a0ff, 0.85).fillCircle(x + Math.cos(a) * 30 * s, y - 60 * s + Math.sin(a) * 12 * s + breath, 2 * s);
    }
  } else {
    // 葛倫：粗壯的身體＋皮圍裙
    g.fillStyle(0x6a4a3a, 1).fillRoundedRect(x - 22 * s, y - 62 * s + breath, 44 * s, 60 * s, 10 * s);
    g.fillStyle(0x3a2418, 1).fillRoundedRect(x - 16 * s, y - 52 * s + breath, 32 * s, 50 * s, 6 * s);
    const glow = 0.55 + 0.45 * Math.sin(now / 380);
    g.lineStyle(2 * s, 0xff8a3a, glow).lineBetween(x - 8 * s, y - 40 * s + breath, x + 2 * s, y - 30 * s + breath).lineBetween(x + 2 * s, y - 30 * s + breath, x - 4 * s, y - 18 * s + breath);
    // 手臂
    g.fillStyle(0xd8a080, 1).fillCircle(x - 24 * s, y - 40 * s + breath, 7 * s).fillCircle(x + 24 * s, y - 52 * s + breath, 7 * s);
    // 肩上的錘子
    g.lineStyle(4 * s, 0x5a3a20, 1).lineBetween(x + 24 * s, y - 50 * s + breath, x + 8 * s, y - 92 * s + breath);
    g.fillStyle(0x50505a, 1).fillRoundedRect(x - 4 * s, y - 104 * s + breath, 26 * s, 14 * s, 3 * s);
    g.fillStyle(0xff9a4a, 0.5 * glow).fillRect(x - 4 * s, y - 92 * s + breath, 26 * s, 2 * s);
    // 光頭＋大鬍子
    g.fillStyle(0xd8a080, 1).fillCircle(x, y - 74 * s + breath, 13 * s);
    g.fillStyle(0xffe0c0, 0.5).fillCircle(x - 4 * s, y - 82 * s + breath, 4 * s);
    g.fillStyle(0x8a4a2a, 1).fillPoints([{ x: x - 12 * s, y: y - 72 * s + breath }, { x: x + 12 * s, y: y - 72 * s + breath }, { x: x + 6 * s, y: y - 54 * s + breath }, { x: x - 6 * s, y: y - 54 * s + breath }], true);
    g.fillStyle(0x2a1a10, 1).fillRect(x - 8 * s, y - 78 * s + breath, 5 * s, 2 * s).fillRect(x + 3 * s, y - 78 * s + breath, 5 * s, 2 * s);
    if (now % 4600 >= 140) {
      g.fillStyle(0x1a1008, 1).fillCircle(x - 5 * s, y - 75 * s + breath, 1.6 * s);
      g.fillCircle(x + 5 * s, y - 75 * s + breath, 1.6 * s);
    }
    // 偶爾冒出的火星
    const t = (now % 1800) / 1800;
    g.fillStyle(0xffb060, 1 - t).fillCircle(x + 10 * s + Math.sin(now / 200) * 3 * s, y - 96 * s - t * 20 * s, 1.8 * s);
  }
}
