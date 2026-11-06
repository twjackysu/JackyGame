// 確定性回歸（V1 Q1，23-v2-roadmap §2）：固定種子 × 三武器 × 四張大地圖，用 PlayerBot 跑 3,000 tick 記 stateHash。
// 純重構（效能、拆檔）不該改變任何一個 hash；改平衡或改規則會變是正常的——
// 那時用 `npx vitest run tests/rt-golden-hash.test.ts -u` 更新快照，並在 commit 寫「hash 快照更新：原因」。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, stateHash, step } from '../src/core/battle/rt/engine';
import { EMBERRIFT_COLOSSUS, makeEmberriftStage } from '../src/core/battle/rt/maps/emberrift';
import { MISTWOOD_KING, makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { STARFALL_SENTINEL, makeStarfallStage } from '../src/core/battle/rt/maps/starfall';
import { THORNVALE_QUEEN, makeThornvaleStage } from '../src/core/battle/rt/maps/thornvale';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';

const MAPS = [
  { id: 'mistwood', make: makeMistwoodStage, at: MISTWOOD_KING, level: 1 },
  { id: 'thornvale', make: makeThornvaleStage, at: THORNVALE_QUEEN, level: 7 },
  { id: 'emberrift', make: makeEmberriftStage, at: EMBERRIFT_COLOSSUS, level: 12 },
  { id: 'starfall', make: makeStarfallStage, at: STARFALL_SENTINEL, level: 18 },
] as const;
const WEAPONS = [undefined, 'bow', 'staff'] as const;
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);
const TICKS = 3000;

/** 跑一場並回傳 hash（每 1,000 tick 記一次，出錯時比較容易看出從哪裡開始分岔） */
export function goldenRun(stageId: string, seed: number, weapon: (typeof WEAPONS)[number], level: number, at: { x: number; y: number }): string {
  const s = createBattle({ stageId, seed, weapon, level, night: seed % 3 === 0 });
  const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: at }, 'normal');
  const marks: string[] = [];
  while (s.tick < TICKS && s.outcome === 'running') {
    step(s, bot.decide(s));
    if (s.tick % 1000 === 0) marks.push(stateHash(s));
  }
  marks.push(`${s.tick}:${stateHash(s)}`);
  return marks.join(' ');
}

describe('golden stateHash（確定性回歸）', () => {
  beforeAll(() => {
    for (const m of MAPS) STAGES[m.id] = m.make();
  });
  afterAll(() => {
    for (const m of MAPS) delete STAGES[m.id];
  });

  for (const m of MAPS)
    it(`${m.id}：10 種子 × 3 武器`, async () => {
      const out: Record<string, string> = {};
      for (const w of WEAPONS) for (const seed of SEEDS) out[`${w ?? 'sword'}#${seed}`] = goldenRun(m.id, seed, w, m.level, m.at);
      await expect(JSON.stringify(out, null, 1) + '\n').toMatchFileSnapshot(`__snapshots__/golden-${m.id}.json`);
    }, 120_000);
});
