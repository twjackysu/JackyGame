// 觸控手勢分類（純邏輯）。閾值見 docs/design/06-tech-architecture.md §3.7。
// 場景層把 pointerdown / pointermove / pointerup 餵進 GestureTracker，取得 tap / swipe / hold 事件。

export const SWIPE_MIN_PX = 40;
export const SWIPE_MAX_MS = 300;
export const HOLD_MIN_MS = 350;

export type Gesture =
  | { kind: 'tap'; at: number; x: number; y: number }
  | { kind: 'swipe'; at: number; x: number; y: number; dx: number; dy: number; dir: 'left' | 'right' | 'up' | 'down' }
  | { kind: 'holdStart'; at: number; x: number; y: number }
  | { kind: 'holdEnd'; at: number; startedAt: number; x: number; y: number };

/**
 * 時間戳 `at`：
 * - tap：按下時間（時機判定以按下瞬間為準，手感較好）
 * - swipe：開始時間（03 §3.3：以滑動開始判定）
 * - holdStart：按下時間（長按從按下就算開始）
 */
export class GestureTracker {
  private down: { t: number; x: number; y: number } | null = null;
  private holding = false;
  private swiped = false;

  pointerDown(t: number, x: number, y: number): Gesture[] {
    this.down = { t, x, y };
    this.holding = false;
    this.swiped = false;
    return [];
  }

  pointerMove(t: number, x: number, y: number): Gesture[] {
    const d = this.down;
    if (!d || this.swiped) return [];
    const out = this.checkHold(t);
    const dx = x - d.x;
    const dy = y - d.y;
    if (!this.holding && Math.hypot(dx, dy) >= SWIPE_MIN_PX && t - d.t <= SWIPE_MAX_MS) {
      this.swiped = true;
      out.push({ kind: 'swipe', at: d.t, x: d.x, y: d.y, dx, dy, dir: dirOf(dx, dy) });
    }
    return out;
  }

  /** 每幀呼叫，讓長按在手指不動時也能觸發。 */
  update(t: number): Gesture[] {
    return this.checkHold(t);
  }

  pointerUp(t: number, x: number, y: number): Gesture[] {
    const d = this.down;
    this.down = null;
    if (!d) return [];
    if (this.holding) return [{ kind: 'holdEnd', at: t, startedAt: d.t, x, y }];
    if (this.swiped) return [];
    const dx = x - d.x;
    const dy = y - d.y;
    if (Math.hypot(dx, dy) >= SWIPE_MIN_PX && t - d.t <= SWIPE_MAX_MS) {
      return [{ kind: 'swipe', at: d.t, x: d.x, y: d.y, dx, dy, dir: dirOf(dx, dy) }];
    }
    if (t - d.t >= HOLD_MIN_MS) {
      // 沒有透過 update 觸發（例如 update 沒被呼叫）：補發一組
      return [
        { kind: 'holdStart', at: d.t, x: d.x, y: d.y },
        { kind: 'holdEnd', at: t, startedAt: d.t, x, y },
      ];
    }
    return [{ kind: 'tap', at: d.t, x: d.x, y: d.y }];
  }

  get isHolding(): boolean {
    return this.holding;
  }

  private checkHold(t: number): Gesture[] {
    const d = this.down;
    if (!d || this.holding || this.swiped) return [];
    if (t - d.t >= HOLD_MIN_MS) {
      this.holding = true;
      return [{ kind: 'holdStart', at: d.t, x: d.x, y: d.y }];
    }
    return [];
  }
}

function dirOf(dx: number, dy: number): 'left' | 'right' | 'up' | 'down' {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}
