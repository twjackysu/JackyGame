/**
 * 鏡頭「看一眼」（第 85 輪，D-219）：光門在畫面外亮起時，鏡頭帶過去讓玩家看到它亮、再回到主角身上。
 * 純函式，場景每幀用它算鏡頭往目標偏多少（0＝跟主角、1＝完全偏到目標）。
 */
export const PEEK_IN = 650; // 帶過去
export const PEEK_HOLD = 1350; // 停著看
export const PEEK_OUT = 700; // 回來
export const PEEK_TOTAL = PEEK_IN + PEEK_HOLD + PEEK_OUT;

const smooth = (k: number): number => k * k * (3 - 2 * k);

/** 開始後 ms 毫秒的偏移權重 0～1（前後 smoothstep，超出範圍＝0） */
export function peekWeight(ms: number): number {
  if (ms <= 0 || ms >= PEEK_TOTAL) return 0;
  if (ms < PEEK_IN) return smooth(ms / PEEK_IN);
  if (ms < PEEK_IN + PEEK_HOLD) return 1;
  return smooth(1 - (ms - PEEK_IN - PEEK_HOLD) / PEEK_OUT);
}

/**
 * 鏡頭要對準的點：主角往目標偏 share（預設 0.7，主角多半還留在畫面下緣，玩家知道自己在哪），
 * 偏移最多 maxShift（世界單位；目標太遠就不帶，交給畫面外箭頭）。
 */
export function peekFocus(px: number, py: number, tx: number, ty: number, w: number, share = 0.7): { x: number; y: number } {
  return { x: px + (tx - px) * share * w, y: py + (ty - py) * share * w };
}

/** 主角附近（radius 世界單位內）有活著、正在交戰的敵人 → 這時不要把鏡頭帶走（第 86 輪，D-220） */
export function peekBlocked(enemies: readonly { x: number; y: number; dead?: boolean; mode?: string }[], px: number, py: number, radius: number): boolean {
  return enemies.some((e) => !e.dead && e.mode === 'combat' && Math.hypot(e.x - px, e.y - py) < radius);
}
