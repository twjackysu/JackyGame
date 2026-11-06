// 引擎效能（V1 Q4）：霧語森林一直觸發狼群暴動（怪最多的情況），跑 9,000 tick 量每 tick 平均微秒。
// 只擋「比基準慢 2 倍以上」（CI 機器快慢不一）；基準與每次優化的結果記在 docs/PROGRESS.md。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, stateHash, step } from '../src/core/battle/rt/engine';
import { MISTWOOD_KING, makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';

/** 基準（μs/tick，第 139 輪本機沙盒實測 54）；本機上限＝2 倍、CI 再 ×2 給慢機器 */
export const PERF_BASELINE_US = 60;

export function perfRun(ticks = 9000): { us: number; units: number; hash: string } {
  const s = createBattle({ stageId: 'mistwood', seed: 42, level: 10 });
  const bot = new PlayerBot({ ...BOT_PROFILES.expert, ult: true, potionAtPct: 50, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'expert');
  let peak = 0;
  const t0 = performance.now();
  while (s.tick < ticks && s.outcome === 'running') {
    if (s.tick % 300 === 0) s.riotAt = s.tick + 1;
    step(s, bot.decide(s));
    if (s.tick % 100 === 0) peak = Math.max(peak, s.units.filter((u) => !u.dead).length);
  }
  return { us: ((performance.now() - t0) * 1000) / s.tick, units: peak, hash: stateHash(s) };
}

describe('引擎效能', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });
  it('暴動場景 9,000 tick 不比基準慢 2 倍', () => {
    perfRun(600); // 暖機（JIT）
    const r = perfRun();
    console.log(`[rt-perf] ${r.us.toFixed(1)} μs/tick，最多 ${r.units} 隻活著，hash ${r.hash}`);
    expect(r.us).toBeLessThan(PERF_BASELINE_US * 2 * (process.env.CI ? 2 : 1));
  }, 120_000);
});
