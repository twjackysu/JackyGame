// 底部那排自動技能小圖示上的記號（第 195 輪）。以前五顆只是不同顏色的暗圓，轉好時寫招式名前兩個字（手機上約 7px、讀不到），
// 冷卻中只剩數字——看不出哪顆是哪一招、這一招是打前面還是打身邊。現在每顆畫一個照「這招怎麼打」決定的記號：
// 照資料分（不寫招式 id），所以換了變化打法（原招／A／B）記號會跟著變。純畫面。
import type Phaser from 'phaser';
import type { SkillDefinition } from '../../core/battle/rt/types';

/**
 * shield＝給護盾的招｜burst＝大招｜bolt＝往前一直線（箭、火球、劍氣）｜slash＝前方扇形（揮砍、散射）
 * drop＝落在前方一塊（落雷、隕石、箭雨）｜spin＝以自己為中心的一圈（旋風、冰爆）｜ring＝環形
 */
export type SkillGlyph = 'shield' | 'burst' | 'bolt' | 'slash' | 'drop' | 'spin' | 'ring';

export function skillGlyph(def: SkillDefinition | undefined): SkillGlyph {
  if (!def) return 'slash';
  if (def.guard || def.block) return 'shield';
  if (def.role === 'ult') return 'burst';
  const h = def.hits[0];
  if (!h) return 'slash';
  if (h.shape.type === 'line') return 'bolt';
  if (h.shape.type === 'sector') return 'slash';
  if (h.shape.type === 'ring') return 'ring';
  return h.ahead ? 'drop' : 'spin';
}

/** 這一招打幾下（1～3；記號旁邊的小點數）：多段招和單發招就算形狀一樣也分得出來 */
export function glyphPips(def: SkillDefinition | undefined): number {
  const n = def?.hits.length ?? 1;
  return n >= 5 ? 3 : n >= 2 ? 2 : 1;
}

/** 記號的顏色：外框色往白色拉六成（暗底上要夠亮，又留得住色相） */
export function glyphColor(rim: number): number {
  const mix = (c: number): number => Math.round(c + (255 - c) * 0.6);
  return (mix((rim >> 16) & 255) << 16) | (mix((rim >> 8) & 255) << 8) | mix(rim & 255);
}

/** 小圖示的數值：冷卻中記號的透明度、冷卻扇形的深度、正在放那一招時整顆亮起來的程度（都要留得住記號） */
export const COMPACT_ICON = { dimA: 0.85, sweepA: 0.55, castA: 0.22, longTicks: 360 } as const;

/**
 * 小圖示上的字。自動施放的招幾乎永遠在冷卻，以前五顆上面永遠蓋著「1.3」「7」「4」——把記號蓋掉、又沒有人在讀（不用自己按）。
 * 現在短冷卻只看扇形轉回來；還要等 12 秒以上（大招、剛放完的長招）才寫秒數。轉好了不寫字。
 */
export function compactLabel(leftTicks: number, text: string): string {
  return leftTicks > COMPACT_ICON.longTicks ? text : '';
}

type G = Phaser.GameObjects.Graphics;

/** 在 g 上畫記號（中心 x,y；r＝圖示半徑） */
export function drawSkillGlyph(g: G, x: number, y: number, r: number, kind: SkillGlyph, color: number, pips = 1): void {
  const k = r * 0.62;
  g.fillStyle(color, 1);
  g.lineStyle(Math.max(2, r * 0.17), color, 1);
  if (kind === 'shield') {
    g.fillRect(x - k * 0.72, y - k * 0.85, k * 1.44, k * 0.85);
    g.fillTriangle(x - k * 0.72, y - k * 0.02, x + k * 0.72, y - k * 0.02, x, y + k * 1.0);
  } else if (kind === 'burst') {
    // 四芒星＋斜的四個小尖
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? k * 1.15 : k * 0.36;
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
    }
    g.fillPoints(pts, true);
  } else if (kind === 'bolt') {
    // 往右上的箭：粗桿＋箭頭
    const ux = 0.7071; const uy = -0.7071;
    const tx = x + ux * k * 1.05; const ty = y + uy * k * 1.05;
    g.lineBetween(x - ux * k * 1.0, y - uy * k * 1.0, x + ux * k * 0.3, y + uy * k * 0.3);
    const bx = x + ux * k * 0.1; const by = y + uy * k * 0.1;
    g.fillTriangle(tx, ty, bx - uy * k * 0.62, by + ux * k * 0.62, bx + uy * k * 0.62, by - ux * k * 0.62);
  } else if (kind === 'slash') {
    // 月牙：外弧與內弧之間（兩頭尖）
    const pts: { x: number; y: number }[] = [];
    const cx = x - k * 0.35; const cy = y + k * 0.35;
    const a0 = -Math.PI * 0.82; const a1 = Math.PI * 0.32;
    const N = 12;
    for (let i = 0; i <= N; i++) { const a = a0 + ((a1 - a0) * i) / N; pts.push({ x: cx + Math.cos(a) * k * 1.3, y: cy + Math.sin(a) * k * 1.3 }); }
    for (let i = N; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / N; const t = Math.sin((Math.PI * i) / N); pts.push({ x: cx + Math.cos(a) * k * (1.3 - 0.55 * t), y: cy + Math.sin(a) * k * (1.3 - 0.55 * t) }); }
    g.fillPoints(pts, true);
  } else if (kind === 'drop') {
    // 從右上落下來的一顆＋兩道尾巴
    g.fillCircle(x - k * 0.3, y + k * 0.35, k * 0.55);
    g.lineBetween(x + k * 0.05, y - k * 0.2, x + k * 0.85, y - k * 1.0);
    g.lineStyle(Math.max(1.5, r * 0.1), color, 0.85);
    g.lineBetween(x + k * 0.45, y + k * 0.35, x + k * 1.05, y - k * 0.25);
    g.lineBetween(x - k * 0.35, y - k * 0.45, x + k * 0.2, y - k * 1.05);
  } else if (kind === 'spin') {
    // 兩道對稱的弧（漩渦）
    g.beginPath().arc(x, y, k * 0.95, -Math.PI * 0.95, -Math.PI * 0.15, false).strokePath();
    g.beginPath().arc(x, y, k * 0.95, Math.PI * 0.05, Math.PI * 0.85, false).strokePath();
    g.fillTriangle(x + k * 1.25, y - k * 0.5, x + k * 0.55, y - k * 0.5, x + k * 0.9, y + k * 0.12);
    g.fillTriangle(x - k * 1.25, y + k * 0.5, x - k * 0.55, y + k * 0.5, x - k * 0.9, y - k * 0.12);
  } else {
    g.strokeCircle(x, y, k * 0.9);
    g.fillCircle(x, y, k * 0.3);
  }
  // 多段：左下角 2～3 個小點
  if (pips > 1) {
    for (let i = 0; i < pips; i++) g.fillCircle(x - r * 0.62 + i * r * 0.3, y + r * 0.66, Math.max(1.5, r * 0.1));
  }
}

/** 烤成貼圖（同樣的記號／顏色／大小只畫一次） */
export function skillGlyphTexture(scene: Phaser.Scene, kind: SkillGlyph, r: number, color: number, pips: number): string {
  const key = `skill_glyph_${kind}_${r}_${color}_${pips}`;
  if (!scene.textures.exists(key)) {
    const size = 2 * Math.ceil(r + 2);
    const g = scene.make.graphics({}, false);
    drawSkillGlyph(g, size / 2, size / 2, r, kind, color, pips);
    g.generateTexture(key, size, size);
    g.destroy();
  }
  return key;
}
