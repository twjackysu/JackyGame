// 效果圖示（P2／P3，D-343）：程式畫的小徽章——元素色的圓底＋一個看得出元素的記號。祝福三選一、HUD、之後的裝備與圖鑑共用。
import type Phaser from 'phaser';
import type { EffectElement } from '../../core/battle/rt/effects';

/** 元素視覺語言：主色／亮色（文字用 css） */
export const ELEMENT_LOOK: Record<EffectElement, { color: number; light: number; css: string; name: string }> = {
  fire: { color: 0xff7a2c, light: 0xffd08a, css: '#ffb070', name: '火' },
  ice: { color: 0x58b8f0, light: 0xd8f4ff, css: '#a8e0ff', name: '冰' },
  thunder: { color: 0x4a7aff, light: 0xe8f0ff, css: '#b8ccff', name: '雷' },
  poison: { color: 0x8a4adf, light: 0xb8ff7a, css: '#c8a0ff', name: '毒' },
  phys: { color: 0xa89878, light: 0xffffff, css: '#f0e8d8', name: '物理' },
  light: { color: 0xe0a830, light: 0xfff4c8, css: '#ffe08a', name: '光' },
  dark: { color: 0x5a2a9a, light: 0xd0a8ff, css: '#c8a0ff', name: '暗' },
};

/** 斬首的斧刃：半圓，直邊貼著柄（柄從左下往右上約 −51°），刃朝左上。角度是弧度。 */
export const EXEC_AXE = { from: (-231 * Math.PI) / 180, to: (-51 * Math.PI) / 180 } as const;

/** 在 g 上畫一顆圖示（中心 x,y、半徑 r）；dim＝還沒拿到／不能選 */
export function drawEffectIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, el: EffectElement, dim = false, glyph = 0): void {
  const L = ELEMENT_LOOK[el];
  const a = dim ? 0.35 : 1;
  g.fillStyle(0x0c0806, 0.9 * a).fillCircle(x, y, r + 3);
  g.fillStyle(L.color, 0.9 * a).fillCircle(x, y, r);
  g.fillStyle(0x000000, 0.28 * a).fillCircle(x, y + r * 0.18, r * 0.82);
  g.lineStyle(Math.max(2, r * 0.1), L.light, 0.9 * a).strokeCircle(x, y, r);
  g.fillStyle(L.light, a);
  g.lineStyle(Math.max(2, r * 0.16), L.light, a);
  const k = r * 0.56;
  if (el === 'light' && glyph === 2) {
    // 綻光：八道往外的光芒
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI / 4) * i;
      g.lineBetween(x + Math.cos(ang) * k * 0.4, y + Math.sin(ang) * k * 0.4, x + Math.cos(ang) * k * 1.1, y + Math.sin(ang) * k * 1.1);
    }
    g.fillCircle(x, y, k * 0.26);
  } else if (el === 'dark' && glyph === 2) {
    // 殘影：前後兩個人影（後面那個是空心的）
    g.strokeEllipse(x - k * 0.45, y, k * 0.9, k * 1.7);
    g.fillEllipse(x + k * 0.4, y, k * 0.9, k * 1.7);
  } else if (el === 'phys' && glyph === 2) {
    // 斬首：一把斧（第 187 輪：以前是交叉的兩刀＝灰底白色 ✕，在 HUD 上就在可以點的火苗旁邊，看起來像「關閉」鈕）
    const hx = x + k * 0.12; const hy = y - k * 0.19; // 斧頭裝在柄的上段
    g.lineBetween(x - k * 0.8, y + k * 0.95, x + k * 0.82, y - k * 1.05);
    g.beginPath();
    g.slice(hx, hy, k * 0.7, EXEC_AXE.from, EXEC_AXE.to, false);
    g.closePath();
    g.fillPath();
  } else if (el === 'phys' && glyph) {
    // 震盾：盾形＋外面一圈
    g.fillTriangle(x - k * 0.7, y - k * 0.1, x + k * 0.7, y - k * 0.1, x, y + k * 0.95);
    g.fillRect(x - k * 0.7, y - k * 0.75, k * 1.4, k * 0.7);
    g.lineStyle(Math.max(1.5, r * 0.08), L.light, a).strokeCircle(x, y, k * 1.25);
  } else if (el === 'fire' && glyph) {
    // 爆炸：中心一顆＋六顆火星
    g.fillCircle(x, y, k * 0.45);
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i;
      g.fillCircle(x + Math.cos(ang) * k * 0.95, y + Math.sin(ang) * k * 0.95, k * 0.22);
    }
  } else if (el === 'light' && glyph) {
    // 回復：十字
    g.fillRect(x - k * 0.28, y - k * 0.95, k * 0.56, k * 1.9);
    g.fillRect(x - k * 0.95, y - k * 0.28, k * 1.9, k * 0.56);
  } else if (el === 'thunder' && glyph) {
    // 加速：兩個向右的箭頭
    g.fillTriangle(x - k * 0.95, y - k * 0.8, x - k * 0.95, y + k * 0.8, x - k * 0.05, y);
    g.fillTriangle(x + k * 0.05, y - k * 0.8, x + k * 0.05, y + k * 0.8, x + k * 0.95, y);
  } else if (el === 'dark' && glyph) {
    // 試招：菱形（換一種打法）
    g.fillTriangle(x, y - k * 1.05, x - k * 0.7, y, x + k * 0.7, y);
    g.fillTriangle(x, y + k * 1.05, x - k * 0.7, y, x + k * 0.7, y);
    g.fillStyle(L.color, a).fillCircle(x, y, k * 0.26);
  } else if (el === 'fire') {
    // 火苗：一大一小兩片
    g.fillTriangle(x, y - k * 1.15, x - k * 0.75, y + k * 0.6, x + k * 0.75, y + k * 0.6);
    g.fillCircle(x, y + k * 0.35, k * 0.75);
    g.fillStyle(L.color, a).fillCircle(x, y + k * 0.5, k * 0.36);
  } else if (el === 'ice') {
    // 冰晶：三條交叉的線
    for (let i = 0; i < 3; i++) {
      const ang = (Math.PI / 3) * i + Math.PI / 6;
      g.lineBetween(x - Math.cos(ang) * k, y - Math.sin(ang) * k, x + Math.cos(ang) * k, y + Math.sin(ang) * k);
    }
    g.fillCircle(x, y, k * 0.28);
  } else if (el === 'thunder') {
    // 閃電
    g.fillTriangle(x + k * 0.35, y - k * 1.1, x - k * 0.7, y + k * 0.15, x + k * 0.05, y + k * 0.15);
    g.fillTriangle(x - k * 0.35, y + k * 1.1, x + k * 0.7, y - k * 0.15, x - k * 0.05, y - k * 0.15);
  } else if (el === 'poison') {
    g.fillCircle(x - k * 0.4, y + k * 0.25, k * 0.5);
    g.fillCircle(x + k * 0.45, y - k * 0.1, k * 0.36);
    g.fillCircle(x - k * 0.05, y - k * 0.65, k * 0.24);
  } else if (el === 'phys') {
    // 劍氣：兩道斜線
    g.lineBetween(x - k * 0.9, y + k * 0.7, x + k * 0.5, y - k * 0.9);
    g.lineBetween(x - k * 0.4, y + k * 0.9, x + k * 0.95, y - k * 0.5);
  } else if (el === 'light') {
    // 光環：中心圓＋四道光
    g.fillCircle(x, y, k * 0.42);
    for (let i = 0; i < 4; i++) {
      const ang = (Math.PI / 2) * i;
      g.lineBetween(x + Math.cos(ang) * k * 0.65, y + Math.sin(ang) * k * 0.65, x + Math.cos(ang) * k * 1.1, y + Math.sin(ang) * k * 1.1);
    }
  } else {
    // 暗影：新月
    g.fillCircle(x, y, k * 0.95);
    g.fillStyle(L.color, a).fillCircle(x + k * 0.42, y - k * 0.2, k * 0.8);
    g.fillStyle(0x000000, 0.28 * a).fillCircle(x + k * 0.42, y - k * 0.2, k * 0.8);
  }
}
