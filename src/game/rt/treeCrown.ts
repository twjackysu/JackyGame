// 霧語森林成片的樹冠怎麼畫（第 196 輪）。純函式＋數值，`ground.ts` 照著畫（地面是分塊材質、只畫一次）。
// 以前每棵是「深綠大圓＋裡面一顆淺綠圓＋一顆高光點」三個同心圓：遠看是一排排綠色鈕扣／豌豆，不像樹。
// 這是每個新玩家第一眼看到的地圖。現在每棵是一團葉簇：外圈幾團讓輪廓有起伏、右下一團暗的、左上幾團亮的（光從左上來）、最上面兩小撮更亮的葉尖。
// 亮的葉簇刻意不對稱、不成對（成對的亮／暗點疊在圓上會像一張臉，第 195 輪荊棘叢踩過）。只改長相，牆的碰撞格沒動。

/** 0＝底色、1＝暗面（底色再暗一點）、2＝亮面、3＝葉尖高光 */
export type CrownTone = 0 | 1 | 2 | 3;
export interface CrownLobe { x: number; y: number; r: number; tone: CrownTone }

export const TREE_CROWN = {
  /** 外圈葉簇數、離中心多遠、多大（樹冠半徑的倍數）：最多凸出原本的大圓一成多 */
  rim: 6, rimDist: 0.58, rimR: 0.4, rimVar: 0.12,
  /** 暗面乘在底色上的亮度；葉尖高光的不透明度 */
  shadeTone: 0.78, tipA: 0.5,
} as const;

/** h(i)＝這一格第 i 個 0～1 雜湊。回傳的順序就是畫的順序（後面蓋前面） */
export function crownLobes(h: (i: number) => number): CrownLobe[] {
  const C = TREE_CROWN;
  const out: CrownLobe[] = [{ x: 0, y: 0, r: 0.8, tone: 0 }];
  const rot = h(0) * Math.PI * 2;
  for (let i = 0; i < C.rim; i++) {
    const a = rot + ((i + (h(1 + i) - 0.5) * 0.6) / C.rim) * Math.PI * 2;
    out.push({ x: Math.cos(a) * C.rimDist, y: Math.sin(a) * C.rimDist, r: C.rimR + h(10 + i) * C.rimVar, tone: 0 });
  }
  const j = (i: number, amp: number): number => (h(i) - 0.5) * amp;
  out.push({ x: 0.3 + j(20, 0.16), y: 0.36 + j(21, 0.12), r: 0.46 + h(22) * 0.08, tone: 1 });
  out.push({ x: -0.3 + j(23, 0.16), y: -0.26 + j(24, 0.14), r: 0.44 + h(25) * 0.08, tone: 2 });
  out.push({ x: 0.24 + j(26, 0.16), y: -0.4 + j(27, 0.12), r: 0.3 + h(28) * 0.08, tone: 2 });
  out.push({ x: -0.02 + j(29, 0.2), y: 0.08 + j(30, 0.12), r: 0.26 + h(31) * 0.08, tone: 2 });
  out.push({ x: -0.4 + j(32, 0.12), y: -0.4 + j(33, 0.12), r: 0.17 + h(34) * 0.05, tone: 3 });
  out.push({ x: 0.2 + j(35, 0.14), y: -0.5 + j(36, 0.1), r: 0.11 + h(37) * 0.04, tone: 3 });
  return out;
}
