// 燼紅裂谷成片的岩壁怎麼畫（第 196 輪）。純函式＋數值，`ground.ts` 照著畫（地面是分塊材質、只畫一次）。
// 以前和森林的樹冠同一招：一顆大圓＋左上亮面＋高光點，配上灰色就成了一堆發亮的鐵球／氣球；
// 燼紅裂谷的岩壁佔畫面一半以上，整張圖看起來像球池，不像火山裂谷。
// 現在每一塊是有稜角的玄武岩：不規則多邊形的外緣＋偏左上的頂面，側面照受光方向分明暗（光從左上來），沒有圓形高光。
// 只改長相；牆的碰撞格（core 的 solid）完全沒動。

export const EMBER_ROCK = {
  /** 外緣頂點離中心的距離（岩石半徑的倍數）：和以前的圓差不多大，牆看起來的邊界幾乎不變 */
  outerMin: 0.86, outerVar: 0.3,
  /** 頂面的大小與往左上偏多少 */
  topMin: 0.34, topVar: 0.26, topDx: -0.1, topDy: -0.16, topJit: 0.14,
  /** 側面明暗：背光面乘 sideLo、受光面乘 sideHi（對比刻意壓低：岩壁是背景，不能比主角和怪搶眼） */
  sideLo: 0.62, sideHi: 1.12,
  /** 頂面受光那幾條邊的細亮線 */
  rimA: 0.28, rimW: 1.5,
} as const;

export interface RockFace {
  /** x0,y0,x1,y1…（岩石半徑的倍數，原點在岩石中心） */
  pts: number[];
  /** 乘在底色上的亮度 */
  tone: number;
}
export interface EmberRock {
  /** 側面（由外緣一條邊和頂面對應的邊圍成的四邊形），照順時針排 */
  sides: RockFace[];
  /** 頂面 */
  top: RockFace;
  /** 頂面朝左上的邊（畫細亮線用）：x0,y0,x1,y1 一組 */
  rims: number[][];
}

/** 光的方向（指向光源，左上） */
const LX = -0.6;
const LY = -0.8;

/** h(i)＝這一格第 i 個 0～1 雜湊 */
export function emberRock(h: (i: number) => number): EmberRock {
  const E = EMBER_ROCK;
  const n = h(0) < 0.3 ? 5 : h(0) < 0.75 ? 6 : 7;
  const tdx = E.topDx + (h(31) - 0.5) * E.topJit;
  const tdy = E.topDy + (h(32) - 0.5) * E.topJit;
  const rot = h(1) * Math.PI * 2;
  const ox: number[] = [];
  const oy: number[] = [];
  const ix: number[] = [];
  const iy: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + ((i + (h(2 + i) - 0.5) * 0.8) / n) * Math.PI * 2;
    const ro = E.outerMin + h(10 + i) * E.outerVar;
    const ri = E.topMin + h(20 + i) * E.topVar;
    ox.push(Math.cos(a) * ro);
    oy.push(Math.sin(a) * ro);
    ix.push(Math.cos(a) * ri + tdx);
    iy.push(Math.sin(a) * ri + tdy);
  }
  const sides: RockFace[] = [];
  const rims: number[][] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // 這一面朝外的方向＝外緣那條邊中點的方向
    const mx = (ox[i]! + ox[j]!) / 2;
    const my = (oy[i]! + oy[j]!) / 2;
    const ml = Math.hypot(mx, my) || 1;
    const dot = (mx / ml) * LX + (my / ml) * LY; // -1（背光）～1（受光）
    const tone = E.sideLo + ((dot + 1) / 2) * (E.sideHi - E.sideLo);
    sides.push({ pts: [ox[i]!, oy[i]!, ox[j]!, oy[j]!, ix[j]!, iy[j]!, ix[i]!, iy[i]!], tone });
    if (dot > 0.35) rims.push([ix[i]!, iy[i]!, ix[j]!, iy[j]!]);
  }
  const top: number[] = [];
  for (let i = 0; i < n; i++) top.push(ix[i]!, iy[i]!);
  return { sides, top: { pts: top, tone: 0.8 + h(30) * 0.22 }, rims };
}
