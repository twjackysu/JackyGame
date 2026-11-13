/**
 * 頂端 HUD 的血條／MP／經驗條（第 192 輪）：以前 HP 只有一行 18px 的灰字「HP 510/961」，
 * 玩家最常看的數字是畫面上最不起眼的東西。這裡只放排版與顏色的純函式，場景照著畫。
 * 座標是遊戲座標（寬 720；手機上約一半）。
 */
export const HUD_BAR = {
  /** 等級字的中心 */
  lvX: 50,
  lvY: 80,
  x: 98,
  w: 390,
  hpY: 62,
  hpH: 24,
  mpY: 90,
  mpH: 8,
  xpY: 101,
  xpH: 4,
  /** 右邊金幣／粉塵／時間那兩行的右緣 */
  sideX: 706,
  sideY: 83,
} as const;

/** 血量低於這個比例就變色並閃（和藥水鍵的提醒同一條線 40% 分開：這裡是「真的危險」） */
export const HP_WARN = 0.5;
export const HP_DANGER = 0.25;

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 血條顏色：一半以上綠、以下琥珀、四分之一以下紅——不靠讀數字也知道該不該退 */
export function hpColor(frac: number): number {
  return frac > HP_WARN ? 0x4fcf6c : frac > HP_DANGER ? 0xf2b23e : 0xff4f48;
}

/** 危險時血條的亮度脈動（0～1；不危險＝0）。nowMs 用場景時間 */
export function dangerPulse(frac: number, nowMs: number): number {
  if (frac > HP_DANGER || frac <= 0) return 0;
  const ph = (nowMs % 600) / 600;
  return ph < 0.5 ? ph * 2 : 2 - ph * 2;
}

/**
 * 掉血殘影：被打的那一段先留成白色、再縮過去，一眼看得出「這一下掉了多少」。
 * 回血時殘影直接跟上（不留）。回傳新的殘影血量。
 */
export function lagStep(lag: number, hp: number, maxHp: number, dtMs: number): number {
  if (!(lag > hp)) return hp;
  const dt = Math.max(0, Math.min(dtMs, 100));
  const step = Math.max((maxHp * 0.25 * dt) / 1000, ((lag - hp) * dt) / 260);
  return Math.max(hp, Math.min(lag, maxHp) - step);
}

/** 條裡面填多寬（整數像素；有血就至少 2px，免得 1 滴血看起來像空的） */
export function fillW(w: number, v: number, max: number): number {
  if (!(max > 0) || !(v > 0)) return 0;
  return Math.max(2, Math.round(w * clamp01(v / max)));
}
