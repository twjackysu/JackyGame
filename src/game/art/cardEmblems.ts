// 燼牌插圖：每張牌一個剪影紋章（深色剪影壓在發光圓盤上），全部用 Graphics 基本圖形畫。
import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
type Draw = (g: G, r: number) => void;

const P = (g: G, pts: [number, number][], r: number): void => {
  g.beginPath();
  g.moveTo(pts[0]![0] * r, pts[0]![1] * r);
  for (const [x, y] of pts.slice(1)) g.lineTo(x * r, y * r);
  g.closePath();
  g.fillPath();
};
const lantern: Draw = (g, r) => {
  g.fillRect(-0.3 * r, -0.35 * r, 0.6 * r, 0.75 * r);
  P(g, [[-0.4, -0.35], [0.4, -0.35], [0.2, -0.55], [-0.2, -0.55]], r);
  g.fillRect(-0.05 * r, -0.8 * r, 0.1 * r, 0.3 * r);
  g.fillRect(-0.4 * r, 0.4 * r, 0.8 * r, 0.12 * r);
};
const sword: Draw = (g, r) => {
  P(g, [[0, -0.95], [0.1, -0.75], [0.1, 0.35], [-0.1, 0.35], [-0.1, -0.75]], r);
  g.fillRect(-0.4 * r, 0.32 * r, 0.8 * r, 0.12 * r);
  g.fillRect(-0.07 * r, 0.44 * r, 0.14 * r, 0.35 * r);
  g.fillCircle(0, 0.86 * r, 0.11 * r);
};
const star = (g: G, r: number, k = 0.42, n = 5, rot = -Math.PI / 2): void => {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (Math.PI * i) / n;
    const rr = i % 2 ? k : 0.9;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  P(g, pts, r);
};

const EMBLEMS: Record<string, Draw> = {
  t_lamplighter: (g, r) => {
    lantern(g, r * 0.8);
    g.fillRect(0.45 * r, -0.9 * r, 0.08 * r, 1.7 * r); // 長桿
  },
  t_militia: (g, r) => {
    P(g, [[0, -0.95], [0.12, -0.6], [-0.12, -0.6]], r); // 矛頭
    g.fillRect(-0.05 * r, -0.6 * r, 0.1 * r, 1.5 * r);
    P(g, [[-0.55, -0.2], [0.55, -0.2], [0.45, 0.35], [0, 0.7], [-0.45, 0.35]], r * 0.7); // 盾
  },
  t_bellringer: (g, r) => {
    P(g, [[-0.15, -0.7], [0.15, -0.7], [0.3, -0.4], [0.4, 0.2], [0.6, 0.45], [-0.6, 0.45], [-0.4, 0.2], [-0.3, -0.4]], r);
    g.fillCircle(0, 0.6 * r, 0.14 * r);
    g.fillRect(-0.06 * r, -0.92 * r, 0.12 * r, 0.25 * r);
  },
  t_archer: (g, r) => {
    g.lineStyle(0.12 * r, 0x120e16, 1);
    g.beginPath();
    g.arc(-0.35 * r, 0, 0.8 * r, -1.1, 1.1);
    g.strokePath();
    g.lineStyle(0.04 * r, 0x120e16, 1).lineBetween(0.0 * r, -0.72 * r, 0.0 * r, 0.72 * r);
    g.fillRect(-0.5 * r, -0.04 * r, 1.25 * r, 0.08 * r);
    P(g, [[0.9, 0], [0.65, -0.15], [0.65, 0.15]], r);
  },
  t_child: (g, r) => {
    g.fillCircle(-0.15 * r, -0.45 * r, 0.22 * r);
    P(g, [[-0.42, 0.75], [-0.35, -0.2], [0.05, -0.2], [0.12, 0.75]], r);
    g.fillRect(0.12 * r, -0.05 * r, 0.3 * r, 0.06 * r);
    lantern2(g, r, 0.5, 0.15, 0.35);
  },
  t_matron: (g, r) => {
    P(g, [[-0.75, 0.75], [-0.75, -0.05], [0, -0.7], [0.75, -0.05], [0.75, 0.75]], r);
  },
  t_hunter: (g, r) => {
    P(g, [[-0.15, -0.9], [0.15, -0.9], [0.55, 0.8], [-0.55, 0.8]], r * 0.95); // 孤樹
    g.fillRect(-0.06 * r, 0.6 * r, 0.12 * r, 0.3 * r);
  },
  t_blacksmith: (g, r) => {
    P(g, [[-0.8, -0.15], [0.55, -0.15], [0.8, -0.35], [0.8, 0.05], [0.4, 0.15], [0.3, 0.3], [-0.3, 0.3], [-0.45, 0.1]], r); // 鐵砧
    g.fillRect(-0.25 * r, 0.3 * r, 0.5 * r, 0.25 * r);
    g.fillRect(-0.45 * r, 0.55 * r, 0.9 * r, 0.15 * r);
    g.fillRect(-0.1 * r, -0.85 * r, 0.5 * r, 0.25 * r); // 鎚頭
    g.fillRect(0.1 * r, -0.62 * r, 0.08 * r, 0.4 * r);
  },
  t_watchman: (g, r) => {
    P(g, [[-0.55, -0.6], [0.55, -0.6], [0.5, 0.2], [0, 0.85], [-0.5, 0.2]], r);
    P(g, [[-0.5, -0.65], [-0.3, -0.95], [-0.15, -0.72], [0, -0.98], [0.15, -0.72], [0.3, -0.95], [0.5, -0.65]], r);
  },
  c_dealer: (g, r) => {
    g.fillRoundedRect(-0.6 * r, -0.6 * r, 0.75 * r, 1.05 * r, 0.12 * r);
    g.fillRoundedRect(-0.1 * r, -0.4 * r, 0.75 * r, 1.05 * r, 0.12 * r);
  },
  c_cardsharp: (g, r) => {
    g.fillRoundedRect(-0.35 * r, -0.7 * r, 0.7 * r, 1.0 * r, 0.1 * r);
    P(g, [[-0.85, 0.3], [0.85, 0.3], [0.7, 0.8], [-0.7, 0.8]], r); // 袖口
  },
  c_bouncer: (g, r) => {
    g.fillRoundedRect(-0.6 * r, -0.4 * r, 1.2 * r, 0.75 * r, 0.25 * r); // 拳
    g.fillRect(-0.35 * r, 0.3 * r, 0.7 * r, 0.5 * r);
  },
  c_juggler: (g, r) => {
    g.fillCircle(-0.5 * r, 0.2 * r, 0.24 * r);
    g.fillCircle(0, -0.5 * r, 0.24 * r);
    g.fillCircle(0.5 * r, 0.2 * r, 0.24 * r);
  },
  c_fortune: (g, r) => {
    g.fillCircle(0, -0.15 * r, 0.6 * r);
    P(g, [[-0.5, 0.45], [0.5, 0.45], [0.65, 0.8], [-0.65, 0.8]], r);
  },
  c_smuggler: (g, r) => {
    g.fillRect(-0.7 * r, -0.4 * r, 1.4 * r, 1.0 * r);
    P(g, [[-0.8, -0.4], [0.8, -0.4], [0.6, -0.7], [-0.6, -0.7]], r);
  },
  c_fire_eater: (g, r) => {
    P(g, [[0, -0.95], [0.35, -0.35], [0.6, 0.05], [0.5, 0.55], [0, 0.85], [-0.5, 0.55], [-0.6, 0.05], [-0.25, -0.2], [-0.1, -0.5]], r);
  },
  c_veteran: (g, r) => {
    P(g, [[-0.55, -0.4], [0, -0.85], [0.55, -0.4], [0.55, 0.5], [0, 0.85], [-0.55, 0.5]], r); // 頭盔
    g.fillRect(-0.05 * r, -1.0 * r, 0.1 * r, 0.25 * r);
  },
  n_wanderer: sword,
  n_mage: (g, r) => {
    g.fillRect(-0.05 * r, -0.4 * r, 0.1 * r, 1.25 * r);
    star(g, r * 0.5);
  },
  n_lone_star: (g, r) => star(g, r),
  n_gust: (g, r) => {
    g.lineStyle(0.14 * r, 0x120e16, 1);
    for (const [y, l] of [[-0.4, 0.9], [0, 1.2], [0.4, 0.7]] as const) {
      g.beginPath();
      g.arc((l / 2 - 0.5) * r, (y - 0.15) * r, 0.15 * r, Math.PI * 0.5, Math.PI * 2.2);
      g.strokePath();
      g.lineBetween(-0.6 * r, y * r, (l - 0.6) * r, y * r);
    }
  },
  n_oil: (g, r) => {
    g.fillCircle(0, 0.25 * r, 0.5 * r);
    P(g, [[0, -0.9], [0.45, 0.1], [-0.45, 0.1]], r);
  },
  n_moonturn: (g, r) => {
    g.fillCircle(0, 0, 0.75 * r);
  },
  n_io: (g, r) => {
    g.fillCircle(0, -0.45 * r, 0.25 * r); // 歌姬：頭＋長髮＋音符
    P(g, [[-0.3, -0.5], [0.3, -0.5], [0.5, 0.85], [-0.5, 0.85]], r);
  },
  n_lian: (g, r) => lantern(g, r),
  n_starcrown: (g, r) => {
    P(g, [[-0.75, 0.5], [-0.8, -0.35], [-0.4, 0.0], [0, -0.75], [0.4, 0.0], [0.8, -0.35], [0.75, 0.5]], r);
    g.fillRect(-0.75 * r, 0.55 * r, 1.5 * r, 0.18 * r);
  },
};

function lantern2(g: G, r: number, x: number, y: number, k: number): void {
  g.fillRect((x - 0.3 * k) * r, (y - 0.35 * k) * r, 0.6 * k * r, 0.75 * k * r);
  g.fillRect((x - 0.05 * k) * r, (y - 0.6 * k) * r, 0.1 * k * r, 0.3 * k * r);
}

/** 紋章 id 是否有專屬圖案（測試用） */
export const hasEmblem = (id: string): boolean => id in EMBLEMS;

/**
 * 在 (cx, cy) 畫紋章：發光圓盤（color）＋深色剪影。沒有專屬圖案時退回通用燈火三角。
 * 月相牌（轉月）額外在圓盤上挖出新月。
 */
export function drawEmblem(g: G, id: string, cx: number, cy: number, r: number, color: number): void {
  g.fillStyle(color, 0.55).fillCircle(cx, cy, r);
  g.fillStyle(color, 0.25).fillCircle(cx, cy, r * 1.25);
  g.fillStyle(0x120e16, 1);
  const draw = EMBLEMS[id];
  g.save();
  g.translateCanvas(cx, cy);
  if (draw) draw(g, r * 0.95);
  else P(g, [[-0.8, 0.6], [0.8, 0.6], [0, -0.7]], r);
  if (id === 'n_moonturn') g.fillStyle(color, 0.9).fillCircle(0.3 * r, -0.2 * r, 0.62 * r);
  g.restore();
}
