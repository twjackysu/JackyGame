// 依用途拆開的可重現亂數（design/14 階段 1.1）。
// 狀態只有「種子＋每個 stream 的計數器」，可直接存進存檔（純資料、可 JSON）。
// 第 n 次抽 stream S 的值 = hash(seed, S, n)，與其他 stream 抽了幾次無關：
// 例如多看了幾句閒聊（ui）不會改變下一場戰鬥（battle）或掉落（loot）的結果。
import { hashSeed, type Rng } from './rng';

export const RNG_STREAMS = ['battle', 'loot', 'enhance', 'abyss', 'story', 'ui'] as const;
export type RngStream = (typeof RNG_STREAMS)[number];

export interface RngState {
  seed: number;
  counters: Partial<Record<RngStream, number>>;
}

export function newRngState(seed: number): RngState {
  return { seed: seed >>> 0, counters: {} };
}

const STREAM_SALT: Record<RngStream, number> = Object.fromEntries(RNG_STREAMS.map((s) => [s, hashSeed(`stream:${s}`)])) as Record<RngStream, number>;

/** murmur3 fmix32：把任意 32 位元整數攪散 */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 抽一個 32 位元無號整數，並推進該 stream 的計數器 */
export function drawU32(st: RngState, stream: RngStream): number {
  const n = st.counters[stream] ?? 0;
  st.counters[stream] = n + 1;
  const a = fmix32((st.seed ^ STREAM_SALT[stream]) >>> 0);
  return fmix32((a + Math.imul(n + 1, 0x9e3779b9)) >>> 0);
}

/** [0, 1) 浮點數 */
export function drawFloat(st: RngState, stream: RngStream): number {
  return drawU32(st, stream) / 4294967296;
}

/** 給「需要自己的種子」的子系統（戰鬥引擎、燼牌 AI、掉落表）一個新種子 */
export function drawSeed(st: RngState, stream: RngStream): number {
  return drawU32(st, stream);
}

/** 包成 core/rng 的 Rng 函式（每呼叫一次推進一次計數器） */
export function streamRng(st: RngState, stream: RngStream): Rng {
  return () => drawFloat(st, stream);
}
