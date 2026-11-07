// 段位光環（F4 PvP 獎勵只給外觀，第 146 輪；第 149 輪搬出來給冒險地圖共用）：腳下往外擴散的光圈＋高段位的環繞光點。只是外觀，不影響戰鬥。
import type Phaser from 'phaser';
import { rankAura, type RankAura } from '../../core/meta/pvpRank';

/** 段位顏色（排行榜的段位字用光環顏色；見習灰） */
export const auraCss = (r: number): string => {
  const a = rankAura(r);
  return a ? `#${a.color.toString(16).padStart(6, '0')}` : '#9aa4b8';
};

/** (x, y) 是腳下陰影的中心，r 是單位半徑（畫面像素） */
export function drawRankAura(g: Phaser.GameObjects.Graphics, a: RankAura, x: number, y: number, r: number, now: number): void {
  const period = 1400;
  for (let i = 0; i < a.rings; i++) {
    const t = ((now + (i * period) / a.rings) % period) / period;
    g.lineStyle(5 - t * 3, a.color, 0.85 * (1 - t)).strokeEllipse(x, y, r * (2.7 + t * 2.2), r * (1.05 + t * 0.9));
  }
  for (let i = 0; i < a.motes; i++) {
    const ang = now / 700 + (i * Math.PI * 2) / a.motes;
    const mx = x + Math.cos(ang) * r * 1.5;
    const my = y - r * 0.9 + Math.sin(ang) * r * 0.55 - Math.sin(now / 300 + i) * r * 0.15;
    g.fillStyle(a.color, 0.4).fillCircle(mx, my, 9);
    g.fillStyle(0xffffff, 0.95).fillCircle(mx, my, 4);
  }
}
