/**
 * 被冰住的怪的長相（第 199 輪，D-399）。純函式，畫面層用；冰凍多久、能不能動在引擎。
 *
 * 以前：怪身上罩一顆淡藍色的橢圓＋一條白色硬線圈，頭上再轉三顆黃色的暈眩星。
 * 法杖一次冰好幾隻時畫面上滿是圈（和護盾、鎖定弧、技能範圍的圈混在一起），看起來像泡泡而不是冰。
 *
 * 現在：怪本身染成冰藍色（看得出「這隻不會動」），腳邊長出一簇有稜角的冰晶（兩側高、正面矮，不擋住身體）；
 * 不畫圈、冰凍時不畫暈眩星。快解凍時冰晶閃爍（不靠顏色也看得出快醒了）。
 */
export const ICE_CASE = {
  /** 怪被染成的顏色（乘色） */
  tint: 0xa8dcff,
  /** 疊在怪身上的霜白剪影：顏色、透明度 */
  frost: 0xd8f4ff,
  frostA: 0.55,
  /** 冰晶：主體、亮面、暗面 */
  body: 0xbfeeff,
  lit: 0xffffff,
  shade: 0x6fb4e6,
  /** 剩這麼多 tick 以內開始閃（30 tick＝1 秒） */
  thawTicks: 18,
} as const;

export interface IceShard {
  /** 底邊中心（相對腳下，單位＝怪的半徑；y 往下為正） */
  x: number;
  y: number;
  /** 底寬的一半、高度（單位＝怪的半徑） */
  hw: number;
  h: number;
  /** 尖端往旁邊歪多少（單位＝怪的半徑） */
  lean: number;
}

/** 0～1 的假亂數：同一隻怪每一幀長得一樣 */
function hr(id: number, i: number): number {
  let v = (Math.imul(id + 1, 374761393) + Math.imul(i + 1, 668265263)) | 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

/**
 * 一簇冰晶：沿著腳下的半圈排開，由後往前排（先畫的在後面）。
 * 兩側的高（把怪「夾住」）、正前方的矮（不擋身體與血條）。
 */
export function iceShards(id: number): IceShard[] {
  const n = 5;
  const out: IceShard[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); // 0＝最左、1＝最右
    const side = Math.abs(t - 0.5) * 2; // 0＝正前、1＝兩側
    const j = hr(id, i);
    const j2 = hr(id, i + 20);
    out.push({
      x: (t - 0.5) * 2.7 + (j - 0.5) * 0.16,
      y: 0.42 - side * side * 0.42 + (j2 - 0.5) * 0.08,
      hw: 0.27 + 0.12 * j2,
      h: 0.4 + 0.85 * side + 0.25 * j,
      lean: (t - 0.5) * 0.5 + (j - 0.5) * 0.2,
    });
  }
  // 由後往前（y 小的先畫）
  return out.sort((a, b) => a.y - b.y);
}

/** 快解凍的閃爍係數（0.35～1）：left＝還剩幾 tick、now＝毫秒 */
export function thawBlink(left: number, now: number): number {
  if (left >= ICE_CASE.thawTicks) return 1;
  return Math.floor(now / 70) % 2 ? 1 : 0.35;
}
