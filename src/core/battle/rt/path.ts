// 格子尋路與視線（design/21 §3 第 2 步前置、D-071）：純函式、整數運算、固定處理順序（確定性）。
// 只在 Arena 有 solid 時使用；沒有障礙物的關卡完全不會走到這裡（五個試玩關卡結果不變）。
import type { Arena } from './types';

type Solid = NonNullable<Arena['solid']>;

export interface Grid {
  cell: number;
  w: number;
  h: number;
  /** 1＝可走 */
  walk: Uint8Array;
}

const gridCache = new WeakMap<Solid, Map<string, Grid>>();

/** 把 Arena（外牆＋'#' 障礙物）轉成可走格；同一份 solid 會快取 */
export function gridOf(arena: Arena): Grid | null {
  const solid = arena.solid;
  if (!solid) return null;
  const key = `${arena.w}x${arena.h}`;
  let m = gridCache.get(solid);
  if (!m) gridCache.set(solid, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit;
  const c = solid.cell;
  const w = Math.ceil(arena.w / c);
  const h = Math.ceil(arena.h / c);
  const walk = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) walk[y * w + x] = solid.rows[y]?.[x] === '#' ? 0 : 1;
  const g = { cell: c, w, h, walk };
  m.set(key, g);
  return g;
}

export const cellIndex = (g: Grid, px: number, py: number): number => {
  const cx = Math.min(g.w - 1, Math.max(0, Math.floor(px / g.cell)));
  const cy = Math.min(g.h - 1, Math.max(0, Math.floor(py / g.cell)));
  return cy * g.w + cx;
};
export const cellCenter = (g: Grid, i: number): [number, number] => [(i % g.w) * g.cell + (g.cell >> 1), Math.floor(i / g.w) * g.cell + (g.cell >> 1)];

function solidAt(g: Grid, px: number, py: number): boolean {
  const cx = Math.floor(px / g.cell);
  const cy = Math.floor(py / g.cell);
  if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h) return true;
  return g.walk[cy * g.w + cx] === 0;
}

/**
 * 寬度 2r 的直線能不能通過（中心線＋左右兩條邊線，每 1/4 格取樣）。
 * r＝0 就是一般視線（遠程攻擊用）。
 */
export function clearLine(g: Grid, ax: number, ay: number, bx: number, by: number, r = 0): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return !solidAt(g, ax, ay);
  const steps = Math.max(1, Math.ceil(len / (g.cell / 4)));
  const nx = r ? Math.round((-dy / len) * r) : 0;
  const ny = r ? Math.round((dx / len) * r) : 0;
  for (let i = 0; i <= steps; i++) {
    const px = ax + Math.round((dx * i) / steps);
    const py = ay + Math.round((dy * i) / steps);
    if (solidAt(g, px, py)) return false;
    if (r && (solidAt(g, px + nx, py + ny) || solidAt(g, px - nx, py - ny))) return false;
  }
  return true;
}

// 8 方向；斜走不能切角（兩側正交格都要可走）
const NB: readonly [number, number, number][] = [
  [0, -1, 10], [1, 0, 10], [0, 1, 10], [-1, 0, 10],
  [1, -1, 14], [1, 1, 14], [-1, 1, 14], [-1, -1, 14],
];

/**
 * A* 尋路，回傳格子索引（不含起點、含終點）；找不到回傳 null。
 * 堆積以 (f, h, 格子索引) 排序 → 同一張圖、同一組起終點永遠得到同一條路。
 * maxNodes 防止大地圖上找不到路時掃全圖。
 */
export function findPath(g: Grid, from: number, to: number, maxNodes = 4000): number[] | null {
  if (from === to) return [];
  if (!g.walk[to]) return null;
  const n = g.w * g.h;
  const gs = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const tx = to % g.w;
  const ty = Math.floor(to / g.w);
  const heur = (i: number): number => {
    const ax = Math.abs((i % g.w) - tx);
    const ay = Math.abs(Math.floor(i / g.w) - ty);
    return 10 * Math.max(ax, ay) + 4 * Math.min(ax, ay);
  };
  // 二元堆積：[f, h, i]
  const heap: number[][] = [];
  const less = (a: number[], b: number[]): boolean => a[0]! < b[0]! || (a[0] === b[0] && (a[1]! < b[1]! || (a[1] === b[1] && a[2]! < b[2]!)));
  const push = (v: number[]): void => {
    heap.push(v);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (!less(heap[k]!, heap[p]!)) break;
      [heap[k], heap[p]] = [heap[p]!, heap[k]!];
      k = p;
    }
  };
  const pop = (): number[] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
        if (m === k) break;
        [heap[k], heap[m]] = [heap[m]!, heap[k]!];
        k = m;
      }
    }
    return top;
  };
  gs[from] = 0;
  push([heur(from), heur(from), from]);
  let expanded = 0;
  while (heap.length) {
    const [, , cur] = pop() as [number, number, number];
    if (closed[cur]) continue;
    if (cur === to) {
      const out: number[] = [];
      for (let i = to; i !== from; i = prev[i]!) out.push(i);
      return out.reverse();
    }
    closed[cur] = 1;
    if (++expanded > maxNodes) return null;
    const cx = cur % g.w;
    const cy = Math.floor(cur / g.w);
    for (const [ox, oy, cost] of NB) {
      const x = cx + ox;
      const y = cy + oy;
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      const ni = y * g.w + x;
      if (!g.walk[ni] || closed[ni]) continue;
      if (ox && oy && (!g.walk[cy * g.w + x] || !g.walk[y * g.w + cx])) continue;
      const ng = gs[cur]! + cost;
      if (gs[ni] !== -1 && ng >= gs[ni]!) continue;
      gs[ni] = ng;
      prev[ni] = cur;
      const h = heur(ni);
      push([ng + h, h, ni]);
    }
  }
  return null;
}

/**
 * 從 (ax,ay) 走向 (bx,by) 時，下一個要走去的點。
 * 直線走得通就直接回傳目標；否則沿 A* 路徑，挑「直線走得到的最遠路徑點」（拉直路徑，最多往前看 8 格）。
 * 回傳 null＝沒有路（呼叫端退回直線移動＋沿邊滑動）。
 */
export function nextWaypoint(g: Grid, ax: number, ay: number, bx: number, by: number, r: number): [number, number] | null {
  if (clearLine(g, ax, ay, bx, by, r)) return [bx, by];
  const path = findPath(g, cellIndex(g, ax, ay), cellIndex(g, bx, by));
  if (!path || path.length === 0) return null;
  let best = cellCenter(g, path[0]!);
  const look = Math.min(path.length, 8);
  for (let k = 1; k < look; k++) {
    const c = cellCenter(g, path[k]!);
    if (!clearLine(g, ax, ay, c[0], c[1], r)) break;
    best = c;
  }
  return best;
}
