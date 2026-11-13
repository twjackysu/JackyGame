/**
 * 護盾罩的長相（第 198 輪，D-398）。純函式，畫面層用；護盾量與時間在引擎。
 *
 * 以前：一顆平平的填色圓＋一條 3～5px 的硬線圈＋三段繞圈轉的白弧。全自動後護盾幾乎一直開著，
 * 那條硬線圈和鎖定弧、腳下的藍圈、技能範圍的圈疊在一起，看起來像「選取圈」而不是罩子。
 *
 * 現在：邊緣往內暈開的幾層（外實內淡，像玻璃罩的邊）＋左上一道高光；罩子大一點，把頭也罩進去。
 * 規則照舊：有罩子＝有護盾、剩得越少越淡、快消失時閃爍（不靠顏色）。
 */
/** 罩子的大小（單位半徑的倍數）：半徑、圓心比腳高多少 */
export const DOME_SIZE = { r: 2.2, up: 0.95 } as const;

export interface DomeLook {
  /** 罩子裡的底色透明度 */
  fillA: number;
  /** 邊緣由外往內的幾層：線寬、往內縮幾 px、透明度 */
  rim: { w: number; inset: number; a: number }[];
  /** 左上高光（白）：起訖角度、半徑倍數、線寬、透明度 */
  shine: { a0: number; a1: number; k: number; w: number; a: number };
}

/** full＝護盾剩幾成（0～1）；blink＝快消失時的閃爍係數（0～1） */
export function domeLook(full: number, blink: number): DomeLook {
  const f = Math.min(1, Math.max(0, full));
  const b = Math.min(1, Math.max(0, blink));
  const s = (0.55 + 0.45 * f) * b;
  return {
    fillA: (0.04 + 0.06 * f) * b,
    rim: [
      { w: 2, inset: 0, a: 0.8 * s },
      { w: 5, inset: 3.5, a: 0.24 * s },
      { w: 9, inset: 10.5, a: 0.1 * s },
    ],
    shine: { a0: -2.55, a1: -1.85, k: 0.78, w: 5, a: 0.9 * s },
  };
}
