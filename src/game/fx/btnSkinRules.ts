// 文字按鈕底板的規則（第 203 輪）：純數值與判斷，畫法在 btnSkin.ts。
export const BTN_SKIN = {
  /** false＝回到直角色塊 */
  on: true,
  /** 圓角：高度的幾成，最多幾 px */
  radiusK: 0.24, radiusMax: 10,
  /** 上半亮、下半暗的程度 */
  sheen: 0.2, shade: 0.2,
  edge: 'rgba(0,0,0,0.38)',
  /** 深色底（次要鈕、鎖住的列）的邊 */
  edgeOnDark: 'rgba(255,214,140,0.42)',
} as const;

/** 只處理不透明的 #rrggbb 底色：半透明的（字幕條 rgba(…)、#00000088）是襯底不是按鈕，不碰 */
export function skinnable(bg: unknown): bg is string {
  return typeof bg === 'string' && /^#[0-9a-f]{6}$/i.test(bg);
}

export function btnRadius(h: number): number {
  return Math.max(2, Math.min(BTN_SKIN.radiusMax, h * BTN_SKIN.radiusK));
}

export function isDarkBg(bg: string): boolean {
  const c = parseInt(bg.slice(1), 16);
  return 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255) < 90;
}
