// 路上的相遇（D-159）的人物：程式美術，腳底在 (x, y)，s＝每個設計單位幾像素（人約 100 高）。
// happy=false：遇到麻煩的樣子；happy=true：回來道謝的樣子。
import type Phaser from 'phaser';
import type { EncounterNpc } from '../encounters';

export function drawEncounterNpc(g: Phaser.GameObjects.Graphics, kind: EncounterNpc, x: number, y: number, s: number, now: number, happy: boolean): void {
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
  if (kind === 'herbalist') {
    // 採藥婆婆：駝背、紫灰頭巾、拐杖。麻煩＝藥籃翻倒、草藥散一地＋一株銀霧蘭在發光；高興＝提著陶罐
    if (!happy) {
      g.fillStyle(0x8a6a3a, 1).fillEllipse(x + 34 * s, y - 6 * s, 30 * s, 14 * s); // 翻倒的籃子
      g.lineStyle(2 * s, 0x6a4a2a, 1).strokeEllipse(x + 34 * s, y - 6 * s, 30 * s, 14 * s);
      g.fillStyle(0x5a8a3a, 1);
      for (const [hx, hy] of [[18, 2], [48, 4], [54, -2], [-30, 4], [-20, 6], [8, 6]] as const) g.fillEllipse(x + hx * s, y + hy * s, 9 * s, 4 * s);
      const tw = 0.6 + 0.4 * Math.sin(now / 220);
      g.fillStyle(0xd0e8ff, 0.25 * tw).fillCircle(x - 40 * s, y - 4 * s, 12 * s);
      g.fillStyle(0xe8f4ff, tw).fillCircle(x - 40 * s, y - 6 * s, 4 * s).fillCircle(x - 44 * s, y - 4 * s, 3 * s).fillCircle(x - 36 * s, y - 4 * s, 3 * s);
    } else {
      g.fillStyle(0x9a5a3a, 1).fillRoundedRect(x + 16 * s, y - 40 * s + breath, 16 * s, 18 * s, 5 * s); // 陶罐
      g.fillStyle(0xc8a06a, 1).fillRect(x + 19 * s, y - 44 * s + breath, 10 * s, 4 * s);
    }
    const bend = happy ? 0 : 6 * s;
    g.lineStyle(3 * s, 0x6a4a2a, 1).lineBetween(x - 22 * s, y, x - 18 * s, y - 56 * s); // 拐杖
    g.fillStyle(0x3a3040, 1).fillRect(x - 8 * s, y - 22 * s, 6 * s, 22 * s).fillRect(x + 2 * s, y - 22 * s, 6 * s, 22 * s);
    g.fillStyle(0x6a5a7a, 1).fillRoundedRect(x - 16 * s + bend, y - 54 * s + breath, 32 * s, 36 * s, 10 * s); // 長袍
    g.fillStyle(0x8a7a9a, 1).fillEllipse(x + bend + 4 * s, y - 62 * s + breath, 30 * s, 24 * s); // 頭巾
    g.fillStyle(0xe8c0a0, 1).fillEllipse(x + bend + 8 * s, y - 60 * s + breath, 16 * s, 16 * s);
    g.fillStyle(0xf0f0f0, 1).fillEllipse(x + bend + 8 * s, y - 52 * s + breath, 10 * s, 4 * s);
    if (!blink) g.fillStyle(0x2a1a0a, 1).fillCircle(x + bend + 5 * s, y - 61 * s + breath, 1.4 * s).fillCircle(x + bend + 11 * s, y - 61 * s + breath, 1.4 * s);
    g.lineStyle(4 * s, 0x6a5a7a, 1).lineBetween(x - 10 * s + bend, y - 44 * s + breath, x - 18 * s, y - 40 * s);
    if (happy) g.lineBetween(x + 12 * s, y - 44 * s + breath, x + 22 * s, y - 40 * s + breath);
    return;
  }
  if (kind === 'thief') {
    // 盜賊：深色兜帽、面巾。麻煩＝半躺在地上抱著繡徽記的錢袋、腿上紅色傷口；高興＝站著，面巾拉下、舉手打招呼
    if (!happy) {
      g.fillStyle(0x2a2a30, 1).fillRect(x - 6 * s, y - 10 * s, 34 * s, 8 * s); // 伸直的腿
      g.fillStyle(0xc83a3a, 1).fillRect(x + 12 * s, y - 11 * s, 7 * s, 10 * s); // 傷口
      g.fillStyle(0x3a3a44, 1).fillRoundedRect(x - 18 * s, y - 40 * s + breath, 26 * s, 32 * s, 8 * s);
      g.fillStyle(0x2a2a30, 1).fillEllipse(x - 8 * s, y - 50 * s + breath, 26 * s, 24 * s);
      g.fillStyle(0xd8b090, 1).fillEllipse(x - 4 * s, y - 50 * s + breath, 14 * s, 8 * s);
      g.fillStyle(0x5a2a2a, 1).fillRect(x - 11 * s, y - 47 * s + breath, 15 * s, 6 * s); // 面巾
      if (!blink) g.fillStyle(0x1a1a1a, 1).fillCircle(x - 7 * s, y - 51 * s + breath, 1.5 * s).fillCircle(x - 1 * s, y - 51 * s + breath, 1.5 * s);
      g.fillStyle(0xb8945a, 1).fillCircle(x + 2 * s, y - 26 * s + breath, 9 * s); // 錢袋
      g.fillStyle(0x3a6aa8, 1).fillCircle(x + 2 * s, y - 25 * s + breath, 3 * s); // 村子的徽記
      g.lineStyle(4 * s, 0x3a3a44, 1).lineBetween(x - 12 * s, y - 32 * s + breath, x - 2 * s, y - 24 * s + breath);
      g.lineStyle(2 * s, 0x4a6a2a, 1).lineBetween(x - 34 * s, y, x - 24 * s, y - 16 * s).lineBetween(x - 30 * s, y - 14 * s, x - 20 * s, y - 2 * s);
      return;
    }
    g.fillStyle(0x2a2a30, 1).fillRect(x - 9 * s, y - 28 * s, 7 * s, 28 * s).fillRect(x + 2 * s, y - 28 * s, 7 * s, 28 * s);
    g.fillStyle(0xe8e0d0, 1).fillRect(x + 2 * s, y - 18 * s, 7 * s, 5 * s); // 包紮
    g.fillStyle(0x3a3a44, 1).fillRoundedRect(x - 15 * s, y - 60 * s + breath, 30 * s, 34 * s, 8 * s);
    g.fillStyle(0x2a2a30, 1).fillEllipse(x, y - 72 * s + breath, 28 * s, 26 * s);
    g.fillStyle(0xd8b090, 1).fillEllipse(x + 2 * s, y - 70 * s + breath, 16 * s, 16 * s);
    g.fillStyle(0x5a2a2a, 1).fillRect(x - 7 * s, y - 60 * s + breath, 18 * s, 4 * s); // 拉下的面巾
    if (!blink) g.fillStyle(0x1a1a1a, 1).fillCircle(x - 1 * s, y - 72 * s + breath, 1.5 * s).fillCircle(x + 6 * s, y - 72 * s + breath, 1.5 * s);
    const wave = Math.sin(now / 200) * 6 * s;
    g.lineStyle(5 * s, 0x3a3a44, 1).lineBetween(x + 12 * s, y - 54 * s + breath, x + 22 * s + wave, y - 78 * s + breath);
    g.fillStyle(0xb8945a, 1).fillCircle(x - 22 * s, y - 34 * s, 7 * s); // 自己的小錢袋
    return;
  }
  if (kind === 'pilgrim') {
    // 朝聖者：灰袍、兜帽、胸前一顆燼石（發橘光）。麻煩＝跪著、空水壺倒在地上；高興＝站著，燼石更亮
    const glow = 0.6 + 0.4 * Math.sin(now / 260);
    if (!happy) {
      g.fillStyle(0x7a6a50, 1).fillEllipse(x + 30 * s, y - 4 * s, 20 * s, 10 * s); // 倒下的水壺
      g.fillStyle(0x5a4a38, 1).fillCircle(x + 40 * s, y - 4 * s, 3 * s);
    }
    const kneel = happy ? 0 : 20 * s;
    if (happy) g.fillStyle(0x6a6460, 1).fillRect(x - 9 * s, y - 28 * s, 7 * s, 28 * s).fillRect(x + 2 * s, y - 28 * s, 7 * s, 28 * s);
    g.fillStyle(0x8a8478, 1).fillTriangle(x - 20 * s, y - (happy ? 22 : 2) * s, x + 20 * s, y - (happy ? 22 : 2) * s, x, y - 66 * s + kneel + breath);
    g.fillRoundedRect(x - 15 * s, y - 62 * s + kneel + breath, 30 * s, 34 * s, 10 * s);
    g.fillStyle(0x6a6458, 1).fillEllipse(x, y - 72 * s + kneel + breath, 28 * s, 28 * s);
    g.fillStyle(0xd8b090, 1).fillEllipse(x + 2 * s, y - 70 * s + kneel + breath, 14 * s, 16 * s);
    if (!blink) g.fillStyle(0x1a1a1a, 1).fillCircle(x - 1 * s, y - 71 * s + kneel + breath, 1.4 * s).fillCircle(x + 5 * s, y - 71 * s + kneel + breath, 1.4 * s);
    const gy = y - 50 * s + kneel + breath;
    g.fillStyle(0xff8a3a, (happy ? 0.35 : 0.15) * glow).fillCircle(x, gy, (happy ? 16 : 9) * s);
    g.fillStyle(happy ? 0xffd08a : 0xff8a3a, 1).fillCircle(x, gy, 4 * s);
    if (happy) {
      g.lineStyle(3 * s, 0x6a4a2a, 1).lineBetween(x - 20 * s, y, x - 20 * s, y - 80 * s + breath); // 朝聖杖
      g.fillStyle(0xffb35a, 0.5 + 0.5 * glow).fillCircle(x - 20 * s, y - 82 * s + breath, 4 * s);
    } else {
      g.lineStyle(4 * s, 0x8a8478, 1).lineBetween(x - 10 * s, y - 50 * s + kneel + breath, x - 4 * s, gy).lineBetween(x + 10 * s, y - 50 * s + kneel + breath, x + 4 * s, gy);
    }
    return;
  }
  if (kind === 'courier') {
    // 信差：藍色短外套、紅色郵袋、帽子。麻煩＝坐在地上，腳被冒藍煙的墜星碎石壓住，郵袋和信掉在一旁；高興＝站著舉起空郵袋
    if (!happy) {
      g.fillStyle(0x2a3a5a, 1).fillRect(x - 2 * s, y - 10 * s, 28 * s, 8 * s);
      const pulse = 0.5 + 0.5 * Math.sin(now / 240);
      g.fillStyle(0x7ab8ff, 0.18 + 0.12 * pulse).fillCircle(x + 26 * s, y - 12 * s, 20 * s);
      g.fillStyle(0x3a4050, 1).fillCircle(x + 26 * s, y - 12 * s, 13 * s); // 墜星碎石
      g.fillStyle(0x9ad0ff, 0.7 + 0.3 * pulse).fillCircle(x + 22 * s, y - 16 * s, 3 * s).fillCircle(x + 30 * s, y - 8 * s, 2.4 * s);
      const sm = (now / 20) % 30;
      g.fillStyle(0x9ad0ff, 0.25 * (1 - sm / 30)).fillCircle(x + 28 * s, y - 28 * s - sm * s, (4 + sm / 5) * s);
      g.fillStyle(0xa83a3a, 1).fillRoundedRect(x - 44 * s, y - 14 * s, 22 * s, 14 * s, 4 * s); // 郵袋
      g.fillStyle(0xf0e8d0, 1).fillRect(x - 40 * s, y - 20 * s, 14 * s, 9 * s); // 信
      g.fillStyle(0xc83a3a, 1).fillCircle(x - 33 * s, y - 16 * s, 2 * s);
    } else {
      g.fillStyle(0x2a3a5a, 1).fillRect(x - 9 * s, y - 28 * s, 7 * s, 28 * s).fillRect(x + 2 * s, y - 28 * s, 7 * s, 28 * s);
    }
    const sit = happy ? 0 : 22 * s;
    g.fillStyle(0x3a5a9a, 1).fillRoundedRect(x - 15 * s, y - 60 * s + sit + breath, 30 * s, 34 * s, 6 * s);
    g.fillStyle(0xe8c040, 1).fillCircle(x - 6 * s, y - 50 * s + sit + breath, 2 * s).fillCircle(x - 6 * s, y - 40 * s + sit + breath, 2 * s);
    g.fillStyle(0xf0c8a0, 1).fillCircle(x, y - 70 * s + sit + breath, 10 * s);
    g.fillStyle(0x2a3a6a, 1).fillRoundedRect(x - 11 * s, y - 84 * s + sit + breath, 22 * s, 9 * s, 3 * s).fillRect(x - 2 * s, y - 77 * s + sit + breath, 16 * s, 3 * s);
    if (!blink) g.fillStyle(0x1a1a1a, 1).fillCircle(x - 3 * s, y - 70 * s + sit + breath, 1.5 * s).fillCircle(x + 4 * s, y - 70 * s + sit + breath, 1.5 * s);
    if (happy) {
      const wave = Math.sin(now / 200) * 6 * s;
      g.lineStyle(5 * s, 0x3a5a9a, 1).lineBetween(x + 12 * s, y - 54 * s + breath, x + 20 * s + wave, y - 78 * s + breath);
      g.fillStyle(0xa83a3a, 1).fillRoundedRect(x + 12 * s + wave, y - 94 * s + breath, 20 * s, 14 * s, 4 * s);
      g.lineStyle(2 * s, 0x6a2a2a, 1).lineBetween(x - 12 * s, y - 58 * s + breath, x + 12 * s, y - 32 * s + breath); // 背帶
    } else {
      g.lineStyle(5 * s, 0x3a5a9a, 1).lineBetween(x + 10 * s, y - 34 * s + breath, x + 18 * s, y - 20 * s);
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
