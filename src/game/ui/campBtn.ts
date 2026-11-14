/**
 * 營火旁那排捷徑（行囊・強化／行商）的長相（第 203 輪）。
 * 以前是兩塊沒有邊框的亮色長方形（亮黃底、亮綠底＋黑字）：整個畫面最亮、最平的兩塊東西，像還沒做完的佔位按鈕，
 * 每次回營火都看得到。現在和祝福卡、抉擇面板同一種長相：深色圓角底板＋有顏色的框與字，左邊一顆小圖示（袋子／錢幣）。
 * 只改長相：按鈕還是原本那兩個 Text（點擊範圍、位置、避讓規則都沒動），底板是墊在下面的一張 Graphics。
 */
import type Phaser from 'phaser';

export const CAMP_BTN = {
  /** false＝回到舊的亮色長方形 */
  on: true,
  fill: 0x1c130b, fillA: 0.92, radius: 12,
  borderW: 2, borderA: 0.95,
  /** 上緣一道淡亮線（有一點厚度感） */
  sheenA: 0.12,
  /** 圖示佔的寬度（加在字的左邊的內距） */
  iconW: 34,
  bag: { accent: 0xffd27a, text: '#ffe2a0', old: '#ffd27a' },
  shop: { accent: 0x8fdc92, text: '#b8f0b8', old: '#9fe8a0' },
  /** 有更好的裝備（▲）時框變亮綠、外面多一圈淡光 */
  hot: 0x7dffb0, hotGlowA: 0.22,
} as const;

export type CampBtnKind = 'bag' | 'shop';
export interface PlateRect { x: number; y: number; w: number; h: number; visible: boolean }

/** 底板要不要重畫：位置、大小、看不看得到、亮不亮有變才畫（每幀比一次字串，不每幀重畫） */
export function campPlateKey(rs: readonly PlateRect[], hot: boolean): string {
  return rs.map((r) => (r.visible ? `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}` : '-')).join('|') + (hot ? '!' : '');
}

/** 畫一顆底板（r＝按鈕的外框，左上角座標） */
export function drawCampPlate(g: Phaser.GameObjects.Graphics, r: PlateRect, kind: CampBtnKind, hot: boolean): void {
  if (!r.visible) return;
  const C = CAMP_BTN;
  const accent = hot ? C.hot : C[kind].accent;
  if (hot) g.fillStyle(C.hot, C.hotGlowA).fillRoundedRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, C.radius + 4);
  g.fillStyle(0x000000, 0.35).fillRoundedRect(r.x + 1, r.y + 3, r.w, r.h, C.radius);
  g.fillStyle(C.fill, C.fillA).fillRoundedRect(r.x, r.y, r.w, r.h, C.radius);
  g.fillStyle(0xffffff, C.sheenA).fillRoundedRect(r.x + 6, r.y + 3, r.w - 12, 3, 1.5);
  g.lineStyle(C.borderW, accent, C.borderA).strokeRoundedRect(r.x, r.y, r.w, r.h, C.radius);
  // 圖示
  const ix = r.x + 14 + C.iconW / 2;
  const iy = r.y + r.h / 2;
  const a = C[kind].accent;
  if (kind === 'bag') {
    // 束口袋：袋身＋袋口＋一條繩
    g.fillStyle(a, 1).fillRoundedRect(ix - 11, iy - 5, 22, 17, 7);
    g.fillStyle(a, 1).fillTriangle(ix - 7, iy - 4, ix + 7, iy - 4, ix, iy - 13);
    g.fillStyle(a, 1).fillRoundedRect(ix - 6, iy - 15, 12, 5, 2);
    g.lineStyle(2, C.fill, 0.9).lineBetween(ix - 7, iy - 6, ix + 7, iy - 6);
  } else {
    // 兩枚疊著的錢幣
    g.fillStyle(a, 0.55).fillCircle(ix + 5, iy + 3, 10);
    g.lineStyle(2, C.fill, 0.9).strokeCircle(ix - 3, iy - 2, 11);
    g.fillStyle(a, 1).fillCircle(ix - 3, iy - 2, 10);
    g.fillStyle(C.fill, 0.75).fillRect(ix - 5, iy - 6, 4, 8);
  }
}
