// 伺服器的亂數（26-security：強化、掉落等擲骰只在伺服器）。正式用 crypto.getRandomValues，測試注入固定種子的 Rng。
import type { Rng } from '../core/rng';

export const secureRandom: Rng = () => {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
  return Math.random();
};
