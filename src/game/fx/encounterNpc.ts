// 路上的相遇（D-159）的人物：程式美術，腳底在 (x, y)，s＝每個設計單位幾像素（人約 100 高）。
// happy=false：遇到麻煩的樣子；happy=true：回來道謝的樣子。
import type Phaser from 'phaser';

export function drawEncounterNpc(g: Phaser.GameObjects.Graphics, kind: 'hunter' | 'mule' | 'miner', x: number, y: number, s: number, now: number, happy: boolean): void {
  const breath = Math.sin(now / 700) * 1.2 * s;
  const blink = now % 3600 < 130;
  g.fillStyle(0x000000, 0.35).fillEllipse(x, y, 80 * s, 16 * s);
  if (kind === 'hunter') {
    if (happy) {
      // 灰色獵犬（右邊，尾巴搖）
      const wag = Math.sin(now / 90) * 6 * s;
      g.fillStyle(0x8a8e96, 1).fillEllipse(x + 34 * s, y - 16 * s, 38 * s, 18 * s);
      g.fillCircle(x + 52 * s, y - 28 * s, 9 * s);
      g.fillTriangle(x + 48 * s, y - 34 * s, x + 50 * s, y - 46 * s, x + 55 * s, y - 35 * s);
      g.lineStyle(4 * s, 0x8a8e96, 1).lineBetween(x + 16 * s, y - 18 * s, x + 6 * s, y - 30 * s + wag);
      g.lineStyle(4 * s, 0x6a6e76, 1).lineBetween(x + 24 * s, y - 8 * s, x + 24 * s, y).lineBetween(x + 44 * s, y - 8 * s, x + 44 * s, y);
      g.fillStyle(0x1a1a1a, 1).fillCircle(x + 61 * s, y - 27 * s, 2 * s);
    }
    const sit = happy ? 0 : 22 * s;
    // 弓（背後／放在地上）
    g.lineStyle(3 * s, 0x8a5a2a, 1);
    if (happy) g.beginPath().arc(x - 14 * s, y - 50 * s + breath, 24 * s, -1.2, 1.2).strokePath();
    else g.lineBetween(x - 40 * s, y - 2 * s, x - 10 * s, y - 6 * s);
    // 腿：坐著＝往前伸、站著＝兩條
    g.fillStyle(0x4a3a2a, 1);
    if (happy) g.fillRect(x - 9 * s, y - 26 * s, 7 * s, 26 * s).fillRect(x + 2 * s, y - 26 * s, 7 * s, 26 * s);
    else {
      g.fillRect(x - 4 * s, y - 10 * s, 30 * s, 8 * s);
      g.fillStyle(0xd88a7a, 1).fillCircle(x + 26 * s, y - 6 * s, 5 * s); // 腫起來的腳踝
    }
    // 綠色短上衣＋棕色兜帽
    g.fillStyle(0x3a6a3a, 1).fillRoundedRect(x - 14 * s, y - 56 * s + sit + breath, 28 * s, 32 * s, 6 * s);
    g.fillStyle(0x6a4a2a, 1).fillRect(x - 14 * s, y - 34 * s + sit + breath, 28 * s, 4 * s);
    g.fillStyle(0x7a5a3a, 1).fillEllipse(x, y - 68 * s + sit + breath, 28 * s, 26 * s);
    g.fillStyle(0xf0c8a0, 1).fillEllipse(x + 2 * s, y - 66 * s + sit + breath, 18 * s, 18 * s);
    if (!blink) g.fillStyle(0x2a1a0a, 1).fillCircle(x - 2 * s, y - 67 * s + sit + breath, 1.6 * s).fillCircle(x + 6 * s, y - 67 * s + sit + breath, 1.6 * s);
    // 表情：高興＝揮手；麻煩＝抱著腳
    if (happy) {
      const wave = Math.sin(now / 180) * 0.5;
      g.lineStyle(5 * s, 0x3a6a3a, 1).lineBetween(x + 12 * s, y - 50 * s + breath, x + 22 * s + wave * 8 * s, y - 72 * s + breath);
      g.fillStyle(0xf0c8a0, 1).fillCircle(x + 22 * s + wave * 8 * s, y - 74 * s + breath, 4 * s);
    } else {
      g.lineStyle(5 * s, 0x3a6a3a, 1).lineBetween(x + 10 * s, y - 26 * s + breath, x + 22 * s, y - 12 * s);
    }
    return;
  }
  if (kind === 'mule') {
    // 騾子：灰褐身體、長耳朵、背上兩個貨袋
    const head = happy ? Math.sin(now / 500) * 2 * s : 4 * s;
    g.fillStyle(0x6a5a4a, 1);
    for (const lx of [-24, -12, 14, 26]) g.fillRect(x + lx * s, y - 30 * s, 6 * s, 30 * s);
    g.fillEllipse(x, y - 40 * s + breath, 70 * s, 30 * s);
    g.fillStyle(0x5a4a3a, 1).fillEllipse(x + 40 * s, y - 52 * s + head, 22 * s, 30 * s);
    g.fillStyle(0x7a6a5a, 1).fillEllipse(x + 46 * s, y - 44 * s + head, 14 * s, 12 * s);
    g.fillStyle(0x5a4a3a, 1).fillTriangle(x + 32 * s, y - 64 * s + head, x + 30 * s, y - 86 * s + head, x + 38 * s, y - 66 * s + head);
    g.fillTriangle(x + 40 * s, y - 66 * s + head, x + 44 * s, y - 88 * s + head, x + 46 * s, y - 64 * s + head);
    if (!blink) g.fillStyle(0x1a1a1a, 1).fillCircle(x + 42 * s, y - 56 * s + head, 1.8 * s);
    g.lineStyle(3 * s, 0x5a4a3a, 1).lineBetween(x - 34 * s, y - 44 * s, x - 42 * s, y - 28 * s + Math.sin(now / 300) * 3 * s);
    // 貨袋（麻煩時破一角、露出金光）
    g.fillStyle(0xb89a6a, 1).fillRoundedRect(x - 22 * s, y - 62 * s + breath, 20 * s, 26 * s, 5 * s).fillRoundedRect(x + 2 * s, y - 62 * s + breath, 20 * s, 26 * s, 5 * s);
    if (!happy) {
      const tw = 0.6 + 0.4 * Math.sin(now / 200);
      g.fillStyle(0xffd27a, tw).fillCircle(x - 8 * s, y - 38 * s + breath, 3 * s).fillCircle(x - 4 * s, y - 40 * s + breath, 2.4 * s);
      // 纏在腿上的荊棘
      g.lineStyle(2.5 * s, 0x4a6a2a, 1);
      for (const lx of [-21, -9, 17, 29]) {
        g.lineBetween(x + (lx - 8) * s, y - 4 * s, x + (lx + 8) * s, y - 18 * s).lineBetween(x + (lx - 8) * s, y - 18 * s, x + (lx + 8) * s, y - 6 * s);
      }
      g.fillStyle(0x6a8a3a, 1).fillTriangle(x - 30 * s, y - 2 * s, x - 26 * s, y - 14 * s, x - 22 * s, y - 2 * s).fillTriangle(x + 32 * s, y - 2 * s, x + 36 * s, y - 16 * s, x + 40 * s, y - 2 * s);
    } else {
      // 商隊老闆：寬簷帽、紅背心，站在騾子左邊揮手
      const ox = x - 56 * s;
      g.fillStyle(0x3a2a1a, 1).fillRect(ox - 8 * s, y - 30 * s, 6 * s, 30 * s).fillRect(ox + 2 * s, y - 30 * s, 6 * s, 30 * s);
      g.fillStyle(0xa83a2a, 1).fillRoundedRect(ox - 14 * s, y - 62 * s + breath, 28 * s, 34 * s, 6 * s);
      g.fillStyle(0xf0c8a0, 1).fillCircle(ox, y - 72 * s + breath, 10 * s);
      g.fillStyle(0x6a4a2a, 1).fillEllipse(ox, y - 80 * s + breath, 36 * s, 8 * s).fillRoundedRect(ox - 10 * s, y - 94 * s + breath, 20 * s, 14 * s, 4 * s);
      g.fillStyle(0xe8e0d0, 1).fillEllipse(ox, y - 66 * s + breath, 14 * s, 6 * s);
      const wave = Math.sin(now / 180) * 8 * s;
      g.lineStyle(5 * s, 0xa83a2a, 1).lineBetween(ox - 12 * s, y - 56 * s + breath, ox - 22 * s + wave, y - 78 * s + breath);
    }
    return;
  }
  // 礦工：黃色頭盔＋頭燈、扛十字鎬。麻煩＝站在一塊黑岩上，四周是發亮的熔岩、雙手揮著求救
  if (!happy) {
    const glow = 0.5 + 0.5 * Math.sin(now / 260);
    g.fillStyle(0xff6a1a, 0.25 + 0.2 * glow).fillEllipse(x, y + 2 * s, 120 * s, 34 * s);
    g.fillStyle(0xff8a3a, 0.8).fillEllipse(x, y + 2 * s, 96 * s, 24 * s);
    g.fillStyle(0x2a2220, 1).fillEllipse(x, y, 60 * s, 18 * s);
  } else {
    // 一袋礦石（右腳邊，發著燼光）
    g.fillStyle(0x6a5a44, 1).fillRoundedRect(x + 16 * s, y - 26 * s, 26 * s, 26 * s, 8 * s);
    g.fillStyle(0xffb35a, 0.6 + 0.4 * Math.sin(now / 240)).fillCircle(x + 29 * s, y - 24 * s, 4 * s);
  }
  g.fillStyle(0x3a3430, 1).fillRect(x - 9 * s, y - 28 * s, 7 * s, 28 * s).fillRect(x + 2 * s, y - 28 * s, 7 * s, 28 * s);
  g.fillStyle(0x5a6a7a, 1).fillRoundedRect(x - 15 * s, y - 60 * s + breath, 30 * s, 34 * s, 6 * s);
  g.fillStyle(0x8a6a3a, 1).fillRect(x - 15 * s, y - 34 * s + breath, 30 * s, 4 * s);
  g.fillStyle(0xe8b890, 1).fillCircle(x, y - 70 * s + breath, 10 * s);
  g.fillStyle(0x2a2420, 0.7).fillEllipse(x, y - 62 * s + breath, 16 * s, 6 * s); // 煤灰鬍子
  g.fillStyle(0xe8c030, 1).fillEllipse(x, y - 78 * s + breath, 26 * s, 14 * s);
  g.fillStyle(0xfff4c0, 1).fillCircle(x + 2 * s, y - 80 * s + breath, 3 * s);
  g.fillStyle(0xfff4c0, 0.12).fillTriangle(x + 2 * s, y - 80 * s + breath, x + 40 * s, y - 100 * s, x + 40 * s, y - 70 * s);
  if (!blink) g.fillStyle(0x1a1a1a, 1).fillCircle(x - 4 * s, y - 71 * s + breath, 1.6 * s).fillCircle(x + 4 * s, y - 71 * s + breath, 1.6 * s);
  if (happy) {
    // 扛在肩上的十字鎬
    g.lineStyle(3 * s, 0x7a5a3a, 1).lineBetween(x - 16 * s, y - 40 * s + breath, x + 12 * s, y - 82 * s + breath);
    g.lineStyle(4 * s, 0x9aa0a8, 1).beginPath().arc(x + 12 * s, y - 82 * s + breath, 14 * s, 2.2, 5.2).strokePath();
  } else {
    const w = Math.sin(now / 150) * 6 * s;
    g.lineStyle(5 * s, 0x5a6a7a, 1).lineBetween(x - 12 * s, y - 54 * s + breath, x - 24 * s + w, y - 84 * s).lineBetween(x + 12 * s, y - 54 * s + breath, x + 24 * s - w, y - 84 * s);
    g.fillStyle(0xe8b890, 1).fillCircle(x - 24 * s + w, y - 86 * s, 4 * s).fillCircle(x + 24 * s - w, y - 86 * s, 4 * s);
  }
}
