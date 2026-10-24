// 自由探索（docs/design/11-open-world.md）的純邏輯：ASCII 地圖解析、碰撞、A* 尋路、實體查詢。
// 不依賴 Phaser，全部有 vitest（tests/explore.test.ts）。

/** 地塊字元 → 是否可通行。未列出的字元視為不可通行。 */
export const WALKABLE: Record<string, boolean> = {
  '.': true, // 草地
  ',': true, // 花草
  '=': true, // 石板路
  G: true, // 城門地面
  w: true, // 木地板
  T: false, // 樹
  '~': false, // 水
  L: false, // 路燈
  W: false, // 城牆
  o: false, // 井
  f: false, // 柵欄
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Grid {
  w: number;
  h: number;
  /** tiles[y][x] = 字元 */
  tiles: string[][];
  /** 額外的不可通行格（建築等），key = `${x},${y}` */
  solid: Set<string>;
}

export type Pt = { x: number; y: number };

const key = (x: number, y: number): string => `${x},${y}`;

/** 解析 ASCII 地圖；每列長度必須一致。rects（建築）內的格子一律不可通行。 */
export function parseGrid(rows: readonly string[], rects: readonly Rect[] = []): Grid {
  if (rows.length === 0) throw new Error('empty map');
  const w = rows[0]!.length;
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`row ${i} width ${r.length} != ${w}`);
  });
  const solid = new Set<string>();
  for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) solid.add(key(x, y));
  return { w, h: rows.length, tiles: rows.map((r) => [...r]), solid };
}

export function tileAt(g: Grid, x: number, y: number): string {
  return g.tiles[y]?.[x] ?? 'T';
}

/** 格子是否可通行；blockers = 動態障礙（NPC 所在格）。 */
export function walkable(g: Grid, x: number, y: number, blockers?: ReadonlySet<string>): boolean {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return false;
  if (g.solid.has(key(x, y))) return false;
  if (blockers?.has(key(x, y))) return false;
  return WALKABLE[tileAt(g, x, y)] === true;
}

const DIRS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/**
 * A* 尋路（8 方向，斜走時不能切牆角）。回傳不含起點、含終點的格子序列；找不到回 null。
 * 起點與終點相同 → []。
 */
export function findPath(g: Grid, from: Pt, to: Pt, blockers?: ReadonlySet<string>, maxNodes = 4000): Pt[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (!walkable(g, to.x, to.y, blockers)) return null;
  const h = (x: number, y: number): number => {
    const dx = Math.abs(x - to.x);
    const dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const gScore = new Map<string, number>([[key(from.x, from.y), 0]]);
  const came = new Map<string, string>();
  // 小地圖（<2000 格）用簡單陣列當 open set 就夠快
  const open: { x: number; y: number; f: number }[] = [{ x: from.x, y: from.y, f: h(from.x, from.y) }];
  const closed = new Set<string>();
  let visited = 0;
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bi]!.f) bi = i;
    const cur = open.splice(bi, 1)[0]!;
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.x === to.x && cur.y === to.y) {
      const path: Pt[] = [];
      let k: string | undefined = ck;
      while (k && k !== key(from.x, from.y)) {
        const [px, py] = k.split(',').map(Number) as [number, number];
        path.push({ x: px, y: py });
        k = came.get(k);
      }
      return path.reverse();
    }
    if (++visited > maxNodes) return null;
    const cg = gScore.get(ck) ?? 0;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!walkable(g, nx, ny, blockers)) continue;
      if (dx !== 0 && dy !== 0 && (!walkable(g, cur.x + dx, cur.y, blockers) || !walkable(g, cur.x, cur.y + dy, blockers))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = cg + cost;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        came.set(nk, ck);
        open.push({ x: nx, y: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}

/** 從 from 出發能走到的所有格子（BFS），用來檢查地圖連通。 */
export function reachable(g: Grid, from: Pt, blockers?: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>([key(from.x, from.y)]);
  const q: Pt[] = [from];
  while (q.length > 0) {
    const p = q.shift()!;
    for (const [dx, dy] of DIRS.slice(0, 4)) {
      const nx = p.x + dx!;
      const ny = p.y + dy!;
      const k = key(nx, ny);
      if (seen.has(k) || !walkable(g, nx, ny, blockers)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return seen;
}

/**
 * 要「走到旁邊」互動的目標（NPC、門、告示）：回傳可走到的鄰格中、路徑最短的一格與路徑。
 * 目標本身可通行（例：地上的寶箱觸發格）時，也可以直接站上去。
 */
export function pathToAdjacent(
  g: Grid, from: Pt, target: Pt, blockers?: ReadonlySet<string>,
): { stand: Pt; path: Pt[] } | null {
  let best: { stand: Pt; path: Pt[] } | null = null;
  const cands: Pt[] = [
    { x: target.x, y: target.y + 1 }, { x: target.x, y: target.y - 1 },
    { x: target.x - 1, y: target.y }, { x: target.x + 1, y: target.y },
  ];
  for (const c of cands) {
    if (from.x === c.x && from.y === c.y) return { stand: c, path: [] };
    const p = findPath(g, from, c, blockers);
    if (p && (!best || p.length < best.path.length)) best = { stand: c, path: p };
  }
  return best;
}

/** 點到不可走的格子時，找最近的可走格（曼哈頓距離由近到遠，最多搜尋半徑 r）。 */
export function nearestWalkable(g: Grid, p: Pt, blockers?: ReadonlySet<string>, r = 4): Pt | null {
  if (walkable(g, p.x, p.y, blockers)) return p;
  for (let d = 1; d <= r; d++) {
    for (let dy = -d; dy <= d; dy++) {
      const dx = d - Math.abs(dy);
      for (const sx of dx === 0 ? [0] : [dx, -dx]) {
        if (walkable(g, p.x + sx, p.y + dy, blockers)) return { x: p.x + sx, y: p.y + dy };
      }
    }
  }
  return null;
}

/**
 * 搖桿移動：從像素座標 (px,py) 往 (vx,vy) 走，碰撞以「圓形腳底」逐軸檢查（可沿牆滑動）。
 * tile = 格子像素大小；radius = 腳底半徑（像素）。回傳新座標。
 */
export function slideMove(
  g: Grid, px: number, py: number, vx: number, vy: number, tile: number, radius: number, blockers?: ReadonlySet<string>,
): { x: number; y: number } {
  const free = (x: number, y: number): boolean => {
    const pts: [number, number][] = [[x - radius, y - radius], [x + radius, y - radius], [x - radius, y + radius], [x + radius, y + radius]];
    return pts.every(([ax, ay]) => walkable(g, Math.floor(ax / tile), Math.floor(ay / tile), blockers));
  };
  let x = px;
  let y = py;
  if (vx !== 0 && free(x + vx, y)) x += vx;
  if (vy !== 0 && free(x, y + vy)) y += vy;
  return { x, y };
}

/** 曼哈頓距離 ≤ 1（含斜角 = 切比雪夫 ≤ 1）。 */
export function adjacent(a: Pt, b: Pt): boolean {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
}
