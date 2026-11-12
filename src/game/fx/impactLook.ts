// 落地閃光的長相（第 183 輪）。純函式：只回傳「疊幾層柔光、多大、多亮、什麼顏色」，畫面層照著畫（ADD 混色）。
// 以前是一整塊 0.7 的淡藍圓（ADD）：在燼紅裂谷／荊棘谷這種不算暗的地面上會直接飽和成一顆純白的大圓盤，
// 隕星術落地的頭三幀怪、傷害數字、破甲字全被蓋住。改成幾層「中心亮、往邊緣淡到 0」的柔光疊起來：
// 只有正中間一小塊是白的，往外很快變成有顏色的光再消失，沒有硬邊。
export interface FlashLayer { r: number; alpha: number; color: number }

export type ImpactTone = 'star' | 'fire';

const TONE: Record<ImpactTone, { rim: number; mid: number; core: number }> = {
  star: { rim: 0x6a86ff, mid: 0xa8c0ff, core: 0xe0e8ff }, // 墜星（守望者、深夜、流星雨）：藍白
  fire: { rim: 0xff5a1e, mid: 0xff9a3a, core: 0xffe6b0 }, // 隕星術：火＝橘紅（元素視覺語言）
};

/** 每一層柔光從中心到邊緣的亮度（t＝離中心的距離÷那一層的半徑）；貼圖 `softFlashStops` 照這條曲線做 */
export function flashFalloff(t: number): number {
  return t >= 1 ? 0 : (1 - t) * (1 - t);
}
/** 做柔光貼圖用的漸層節點（offset、alpha） */
export function softFlashStops(n = 8): Array<[number, number]> {
  return Array.from({ length: n + 1 }, (_, i) => [i / n, flashFalloff(i / n)] as [number, number]);
}

/** r＝命中範圍在畫面上的半徑。由外到內，疊起來中心最亮。 */
export function impactFlash(r: number, tone: ImpactTone): FlashLayer[] {
  const t = TONE[tone];
  return [
    { r: r * 1.25, alpha: 0.5, color: t.rim },
    { r: r * 0.8, alpha: 0.6, color: t.mid },
    { r: r * 0.4, alpha: 0.9, color: t.core },
  ];
}

/** 離中心 d 的地方，幾層疊起來加了多少亮度（1＝加到全亮）。測試用它擋「又變回一整塊白」。 */
export function flashAt(layers: FlashLayer[], d: number): number {
  return layers.reduce((a, l) => a + l.alpha * flashFalloff(d / l.r), 0);
}

/** 衝擊環、碎屑的顏色（跟閃光同一個調子） */
export function impactTint(tone: ImpactTone): { ring: number; spark: number; ember: number } {
  return tone === 'star' ? { ring: 0x8aa8ff, spark: 0xc8d8ff, ember: 0x8aa8ff } : { ring: 0xff8a3a, spark: 0xffd0a0, ember: 0xff8a3a };
}
