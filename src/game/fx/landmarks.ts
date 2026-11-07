// 地圖上的兩種地標（第 151 輪 Q5 拆場景，從 RtBattleScene 原封不動搬出來，純畫面）：
// - 抉擇的痕跡（D-157）：討伐後選「取／留」在巢穴旁留下的東西（小狼、白花、燼心、星環，或石座、枯荊棘、黑岩、灰晶簇）
// - 光門（第 55 輪起）：往下一張圖／回上一張圖的出口；Boss 交戰中往前的門封住（D-218）變灰
// 走近痕跡時說的那句話、門上的字要不要寫／往哪裡讓，都是場景的事（留在場景）。
import type Phaser from 'phaser';
import type { ChoicePick } from '../../core/meta/choices';

/** 畫抉擇的痕跡：(cx, cy) 是螢幕座標的地面點，k 是縮放，t 是秒 */
export function drawChoiceMarkArt(g: Phaser.GameObjects.Graphics, cx: number, cy: number, k: number, map: string, pick: ChoicePick, t: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  g.fillStyle(0x000000, 0.3).fillEllipse(cx, cy + 4 * k, 70 * k, 18 * k);
  if (map === 'mistwood' && pick === 'spare') {
    // 霧裡的小狼：半透明、坐著、尾巴輕輕擺
    const a = 0.45 + 0.15 * pulse;
    g.fillStyle(0xcfe4ff, 0.18 * pulse).fillEllipse(cx, cy - 18 * k, 90 * k, 50 * k);
    g.fillStyle(0xd8e8ff, a).fillEllipse(cx, cy - 14 * k, 34 * k, 28 * k);
    g.fillCircle(cx + 6 * k, cy - 36 * k, 13 * k);
    g.fillTriangle(cx - 2 * k, cy - 44 * k, cx + 3 * k, cy - 58 * k, cx + 7 * k, cy - 46 * k);
    g.fillTriangle(cx + 8 * k, cy - 46 * k, cx + 14 * k, cy - 58 * k, cx + 17 * k, cy - 42 * k);
    const sw = Math.sin(t * 3) * 6 * k;
    g.lineStyle(6 * k, 0xd8e8ff, a).lineBetween(cx - 14 * k, cy - 6 * k, cx - 28 * k + sw, cy - 20 * k);
    g.fillStyle(0x6ab8ff, 0.9).fillCircle(cx + 10 * k, cy - 38 * k, 2 * k);
  } else if (map === 'mistwood') {
    // 斷掉的霧角留下的石座：灰石＋一截冷掉的角根
    g.fillStyle(0x4a4e58, 1).fillRoundedRect(cx - 22 * k, cy - 16 * k, 44 * k, 18 * k, 5 * k);
    g.fillStyle(0x8a8478, 1).fillTriangle(cx - 6 * k, cy - 16 * k, cx + 8 * k, cy - 16 * k, cx + 2 * k, cy - 34 * k);
    g.lineStyle(2 * k, 0x2a2c32, 1).lineBetween(cx - 2 * k, cy - 30 * k, cx + 4 * k, cy - 22 * k);
  } else if (map === 'thornvale' && pick === 'spare') {
    // 母樹的白花：三朵五瓣白花，花心淡金，微微發光
    for (let i = 0; i < 3; i++) {
      const fx = cx + (i - 1) * 20 * k;
      const fy = cy - (8 + (i % 2) * 10) * k;
      g.lineStyle(2 * k, 0x5a8a4a, 1).lineBetween(fx, fy, fx, cy);
      g.fillStyle(0xffffff, 0.12 + 0.12 * pulse).fillCircle(fx, fy, 16 * k);
      for (let q = 0; q < 5; q++) {
        const a = (q / 5) * Math.PI * 2 + t * 0.3;
        g.fillStyle(0xf8f4ff, 1).fillEllipse(fx + Math.cos(a) * 6 * k, fy + Math.sin(a) * 5 * k, 9 * k, 7 * k);
      }
      g.fillStyle(0xffe08a, 1).fillCircle(fx, fy, 3 * k);
    }
  } else if (map === 'thornvale') {
    // 根鬚斷掉的地方：枯掉的褐色荊棘
    g.lineStyle(3 * k, 0x6a4a2a, 1);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.45;
      g.lineBetween(cx, cy, cx + Math.cos(a) * 26 * k, cy + Math.sin(a) * 26 * k);
    }
    g.fillStyle(0x4a3220, 1).fillEllipse(cx, cy - 2 * k, 26 * k, 10 * k);
  } else if (map === 'emberrift' && pick === 'spare') {
    // 還在燒的燼心：熔岩裂縫裡跳動的橘色光
    const beat = Math.max(0, Math.sin(t * 4)) ** 4;
    g.fillStyle(0xff8a3a, 0.16 + 0.2 * beat).fillCircle(cx, cy - 16 * k, 34 * k);
    g.fillStyle(0x2a1a14, 1).fillRoundedRect(cx - 20 * k, cy - 30 * k, 40 * k, 32 * k, 8 * k);
    g.fillStyle(0xff6a1a, 0.9).fillCircle(cx, cy - 15 * k, (9 + 3 * beat) * k);
    g.fillStyle(0xffd04a, 1).fillCircle(cx, cy - 15 * k, (4 + 2 * beat) * k);
  } else if (map === 'starfall' && pick === 'spare') {
    // 星星回到夜空：地上一圈淡藍星環，上方一道細細的光柱一直通到畫面頂端（D-158）
    g.fillStyle(0x9fc8ff, 0.08 + 0.08 * pulse).fillRect(cx - 5 * k, cy - 260 * k, 10 * k, 260 * k);
    g.fillStyle(0xeaf4ff, 0.18 + 0.12 * pulse).fillRect(cx - 1.5 * k, cy - 260 * k, 3 * k, 260 * k);
    g.lineStyle(2 * k, 0x9fc8ff, 0.5 + 0.3 * pulse).strokeEllipse(cx, cy - 2 * k, 56 * k, 16 * k);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.5;
      g.fillStyle(0xeaf4ff, 0.6 + 0.4 * Math.sin(t * 3 + i)).fillCircle(cx + Math.cos(a) * 28 * k, cy - 2 * k + Math.sin(a) * 8 * k, 1.8 * k);
    }
  } else if (map === 'starfall') {
    // 被取走墜星核的地方：灰掉的晶簇，中間一個空的星形凹槽
    g.fillStyle(0x6a6e84, 1).fillTriangle(cx - 24 * k, cy, cx - 12 * k, cy - 34 * k, cx - 2 * k, cy);
    g.fillStyle(0x7a7e94, 1).fillTriangle(cx - 6 * k, cy, cx + 6 * k, cy - 44 * k, cx + 18 * k, cy);
    g.fillStyle(0x5e6276, 1).fillTriangle(cx + 12 * k, cy, cx + 22 * k, cy - 26 * k, cx + 30 * k, cy);
    g.lineStyle(1.5 * k, 0xa8acc0, 0.7).strokeTriangle(cx - 6 * k, cy, cx + 6 * k, cy - 44 * k, cx + 18 * k, cy);
    g.lineStyle(2 * k, 0x22242e, 1);
    for (let q = 0; q < 4; q++) {
      const an = -Math.PI / 2 + (q * Math.PI) / 2;
      g.lineBetween(cx + 6 * k, cy - 18 * k, cx + 6 * k + Math.cos(an) * 7 * k, cy - 18 * k + Math.sin(an) * 7 * k);
    }
  } else {
    // 冷掉的黑岩：沒有光的裂紋
    g.fillStyle(0x24201e, 1).fillRoundedRect(cx - 20 * k, cy - 30 * k, 40 * k, 32 * k, 8 * k);
    g.lineStyle(2 * k, 0x5a524c, 1).lineBetween(cx - 8 * k, cy - 24 * k, cx + 2 * k, cy - 12 * k).lineBetween(cx + 2 * k, cy - 12 * k, cx - 4 * k, cy - 2 * k);
  }
}

/** 畫光門（不含門上的字）：back＝回程門（小一點、暖色），sealed＝Boss 交戰中封住 */
export function drawGateArt(g: Phaser.GameObjects.Graphics, cx: number, cy: number, k: number, back: boolean, sealed: boolean, t: number): void {
  const pulse = (0.5 + 0.5 * Math.sin(t * 2.6)) * (sealed ? 0.25 : 1);
  // 地上的光圈＋往上的光柱＋兩根石柱：遠遠就看得出是「出口」；回程的門小一點、暖色
  const glow = back ? 0xffc88a : sealed ? 0x56607a : 0x7ad8ff;
  const rim = back ? 0xffe8c0 : sealed ? 0x8a94a8 : 0xbff0ff;
  const beam = back ? 0xffd8a8 : sealed ? 0x6a7488 : 0x9fe8ff;
  // 第 55 輪：地上多疊幾層光暈（假 bloom）＋旋轉的符文刻痕；光柱由寬到窄三層；兩根石柱上架一道門楣，門裡一層會流動的光幕
  for (let i = 3; i >= 1; i--) g.fillStyle(glow, (0.07 + 0.04 * pulse) * (4 - i) / 3).fillEllipse(cx, cy, (100 + i * 34) * k, (32 + i * 12) * k);
  g.lineStyle(3, rim, 0.55 + 0.35 * pulse).strokeEllipse(cx, cy, 96 * k, 30 * k);
  g.lineStyle(2, rim, 0.3 + 0.2 * pulse).strokeEllipse(cx, cy, 128 * k, 42 * k);
  for (let i = 0; i < 10; i++) {
    const a = t * 0.5 + (i / 10) * Math.PI * 2;
    const rx = Math.cos(a) * 56 * k;
    const ry = Math.sin(a) * 18 * k;
    g.fillStyle(rim, 0.45 + 0.4 * Math.sin(t * 3 + i)).fillRect(cx + rx - 3 * k, cy + ry - 1.2 * k, 6 * k, 2.4 * k);
  }
  g.fillStyle(beam, 0.06 + 0.04 * pulse).fillRect(cx - 44 * k, cy - 190 * k, 88 * k, 190 * k);
  g.fillStyle(beam, 0.1 + 0.06 * pulse).fillRect(cx - 28 * k, cy - 170 * k, 56 * k, 170 * k);
  g.fillStyle(0xfffbf0, 0.22 + 0.14 * pulse).fillRect(cx - 8 * k, cy - 170 * k, 16 * k, 170 * k);
  // 門裡的光幕：幾道往上流的亮帶
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.45 + i / 3) % 1;
    g.fillStyle(0xffffff, 0.16 * Math.sin(ph * Math.PI)).fillRect(cx - 34 * k, cy - 8 * k - ph * 66 * k, 68 * k, 7 * k);
  }
  for (const sx of [-1, 1]) {
    g.fillStyle(0x2a303c, 1).fillRect(cx + sx * 42 * k - 8 * k, cy - 74 * k, 16 * k, 76 * k);
    g.fillStyle(0x4a5262, 1).fillRect(cx + sx * 42 * k - 7 * k, cy - 74 * k, 6 * k, 76 * k);
    g.fillStyle(0x5a6474, 1).fillRect(cx + sx * 42 * k - 10 * k, cy - 80 * k, 20 * k, 8 * k);
    g.fillStyle(beam, 0.25 * pulse).fillCircle(cx + sx * 42 * k, cy - 50 * k, 9 * k);
    g.fillStyle(beam, 0.6 + 0.4 * pulse).fillCircle(cx + sx * 42 * k, cy - 50 * k, 3.5 * k);
    g.fillStyle(beam, 0.5 + 0.4 * pulse).fillCircle(cx + sx * 42 * k, cy - 26 * k, 2.5 * k);
  }
  // 門楣
  g.fillStyle(0x3a4250, 1).fillRect(cx - 56 * k, cy - 90 * k, 112 * k, 11 * k);
  g.fillStyle(0x5a6474, 1).fillRect(cx - 56 * k, cy - 90 * k, 112 * k, 3.5 * k);
  g.fillStyle(beam, 0.7 + 0.3 * pulse).fillPoints([{ x: cx, y: cy - 93 * k }, { x: cx + 6 * k, y: cy - 84.5 * k }, { x: cx, y: cy - 76 * k }, { x: cx - 6 * k, y: cy - 84.5 * k }], true);
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.6 + i / 4) % 1;
    g.fillStyle(0xfffbf0, 0.8 * (1 - ph)).fillCircle(cx + Math.sin(i * 2.1 + t) * 24 * k, cy - ph * 140 * k, 2.5 * k);
  }
}
