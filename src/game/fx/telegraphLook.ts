/**
 * 敵人預告的長相（第 181 輪，D-377）。純函式，畫面層用；不影響命中判定。
 *
 * 以前：外框分「黃＝可格擋」「粗紅＝不可格擋」，附狀態的招填紫色。格擋在 D-345 換成不看時機的護盾後，
 * 黃框已經沒有意義（黃框／紅框都是「走出去或閃避」），而「暗紫填色＋黃框」的直線招在深色地面上
 * 像一條深藍色的介面橫條，看不出是危險、也看不出往哪邊打。
 *
 * 現在：外框就是危險色本身的亮色（紅＝一般、紫＝附狀態、藍＝墜星），重招框比較粗；
 * 最後兩成一律閃白；直線招多一排往前流動的箭頭；每種形狀都有一條亮的「填滿前緣」。
 * 省電畫質也照畫（這是玩法資訊，不是裝飾）。
 */
export type TeleKind = 'phys' | 'status' | 'meteor';

export interface TeleLook {
  /** 填色 */
  fill: number;
  /** 外框與箭頭的亮色 */
  edge: number;
  /** 外框粗細（px）：重招比較粗 */
  edgeW: number;
  /** 整塊範圍的底色透明度 */
  baseA: number;
  /** 由內往外填滿那一塊的透明度（越接近命中越實） */
  growA: number;
  /** 這一刻外框是不是閃成白色（最後兩成） */
  blink: boolean;
}

const PAL: Record<TeleKind, { fill: number; edge: number }> = {
  phys: { fill: 0xff3a3a, edge: 0xff9a84 },
  status: { fill: 0xd24cff, edge: 0xf0b4ff },
  meteor: { fill: 0x8aa8ff, edge: 0xc4d6ff },
};

/** 最後幾成開始閃白 */
export const TELE_BLINK_FROM = 0.8;

export function teleKind(meteor: boolean, hasStatus: boolean): TeleKind {
  return meteor ? 'meteor' : hasStatus ? 'status' : 'phys';
}

export function telegraphLook(kind: TeleKind, heavy: boolean, prog: number, nowMs: number): TeleLook {
  const p = Math.min(1, Math.max(0, prog));
  const c = PAL[kind];
  return {
    fill: c.fill,
    edge: c.edge,
    edgeW: heavy ? 5 : 3,
    baseA: 0.13,
    growA: 0.2 + p * 0.25,
    blink: p > TELE_BLINK_FROM && Math.floor(nowMs / 70) % 2 === 0,
  };
}

/** 幾個預告的起點在這個距離（世界單位）內就算「同一群怪一起出手」 */
export const TELE_CROWD_DIST = 360;
/**
 * 一群怪同時瞄準主角時，預告的底色會一塊疊一塊（三塊疊起來接近實心紅，把地面和主角腳下整片蓋掉）。
 * 同一群裡有 n 個預告時，每一塊的「填色」乘這個係數（1/√n）：重疊處仍然比單獨一塊深（√n 倍），但不會變成實心。
 * 只淡填色；外框、前緣、箭頭、最後的閃白都不動（那些才是「打到哪裡、什麼時候」的資訊）。
 */
export function crowdFill(n: number): number {
  return n <= 1 ? 1 : 1 / Math.sqrt(Math.min(n, 6));
}
/** 每個預告所在的那一群有幾個（含自己）。pts＝各預告的起點（世界座標） */
export function crowdCounts(pts: ReadonlyArray<{ x: number; y: number }>, dist = TELE_CROWD_DIST): number[] {
  return pts.map((a) => pts.reduce((n, b) => n + ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= dist * dist ? 1 : 0), 0));
}

/** 箭頭間距（px） */
export const CHEVRON_GAP = 44;
/** 箭頭往前流動的速度（px／秒） */
export const CHEVRON_SPEED = 110;

/**
 * 直線招上的箭頭位置（離起點幾 px）。往前流動；頭尾各留一點不畫（不會戳出框外）。
 * 太短的線（放不下一個箭頭）回傳空陣列。
 */
export function lineChevrons(lenPx: number, nowMs: number): number[] {
  const margin = 14;
  if (!(lenPx > margin * 2 + 4)) return [];
  const phase = ((nowMs / 1000) * CHEVRON_SPEED) % CHEVRON_GAP;
  const out: number[] = [];
  for (let d = phase < margin ? phase + CHEVRON_GAP : phase; d <= lenPx - margin; d += CHEVRON_GAP) {
    if (d >= margin) out.push(d);
  }
  return out;
}

/** 箭頭的透明度：已經填到的那一段比較亮，還沒填到的淡 */
export function chevronAlpha(dPx: number, lenPx: number, prog: number): number {
  return dPx <= lenPx * Math.min(1, Math.max(0, prog)) ? 0.9 : 0.4;
}
