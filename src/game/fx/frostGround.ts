// 冰霜新星／霜旋在地上留下的那圈結霜（D-412，第 206 輪）。
// 以前是一片平平的淡藍橢圓＋一圈白色硬線：在深色地面上讀起來像一塊灰色的盤子，蓋掉地面的紋理 1.5 秒，法杖每八秒一次。
// 現在：中間幾乎透明、越往外越白（霜是往外爬的；一張放射漸層的貼圖），邊緣是一段一段的碎冰線，地上有從中心裂出去的霜紋。純資料＋純函式（裂紋用種子，不會每幀亂跳）。
export const FROST_GROUND = {
  /** false＝舊的平圓盤 */
  on: true,
  color: 0x9fe6ff,
  rim: 0xeafcff,
  /** 由中心到邊緣的濃淡：[位置 0～1, 透明度]——中間幾乎透明、快到邊緣最濃、最外面一小段淡出（柔邊）。畫成一張放射漸層的小貼圖 */
  stops: [[0, 0.02], [0.45, 0.06], [0.8, 0.17], [0.93, 0.3], [1, 0]] as readonly (readonly [number, number])[],
  /** 邊緣碎冰線分成幾段、每段佔多少（其餘是缺口） */
  rimSegs: 9,
  rimFill: 0.62,
  rimA: 0.7,
  /** 霜紋幾條、每條幾節、透明度 */
  cracks: 7,
  crackSteps: 4,
  crackA: 0.4,
  /** 橢圓壓扁的比例（和以前一樣，像躺在地上） */
  squash: 0.7,
};

/** 小亂數（mulberry32）：同一個種子畫出同一組裂紋 */
function rng(seed: number): () => number {
  let a = (seed | 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FrostPt = { x: number; y: number };

/** 霜紋：從中心附近往外的幾條折線，座標是「半徑＝1 的圓」裡的比例（畫的時候 x 乘 R、y 乘 R×squash） */
export function frostCracks(seed: number, n = FROST_GROUND.cracks, steps = FROST_GROUND.crackSteps): FrostPt[][] {
  const r = rng(seed);
  const out: FrostPt[][] = [];
  for (let i = 0; i < n; i++) {
    let a = ((i + r() * 0.7) / n) * Math.PI * 2;
    const reach = 0.6 + r() * 0.32;
    const line: FrostPt[] = [];
    for (let s = 0; s <= steps; s++) {
      const d = 0.12 + (reach - 0.12) * (s / steps);
      line.push({ x: Math.cos(a) * d, y: Math.sin(a) * d });
      a += (r() - 0.5) * 0.5;
    }
    out.push(line);
  }
  return out;
}

/** 邊緣的碎冰線：每段的起訖角度（弧度）；缺口的位置跟著種子 */
export function frostRimArcs(seed: number, segs = FROST_GROUND.rimSegs, fill = FROST_GROUND.rimFill): [number, number][] {
  const r = rng(seed ^ 0x5bd1e995);
  const step = (Math.PI * 2) / segs;
  const out: [number, number][] = [];
  for (let i = 0; i < segs; i++) {
    const len = step * fill * (0.7 + r() * 0.6);
    const a0 = i * step + r() * (step - Math.min(len, step * 0.95));
    out.push([a0, a0 + Math.min(len, step * 0.95)]);
  }
  return out;
}
