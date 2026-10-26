// 通關機器人（第 28 輪，取代舊的 scripts/playthrough.mjs，D-097）：
// 從新存檔（Lv1、沒有裝備）出發，普通 Bot 依序打倒三張大地圖的 Boss（霧角狼王 → 棘冠狼后 → 燼心岩王）。
// 等級與經驗跨地圖帶著走（和遊戲一樣共用）；打不贏就「再出發一次」（帶著這趟升的等級），像真人重來。
// 不帶裝備（裝備是加分，不是必需），所以這是「最低保證」：主線三張圖不靠刷寶也打得完。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { makeEmberriftStage, EMBERRIFT_COLOSSUS } from '../src/core/battle/rt/maps/emberrift';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { makeThornvaleStage, THORNVALE_QUEEN } from '../src/core/battle/rt/maps/thornvale';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec } from '../src/core/battle/rt/types';

const ROUTE = [
  { id: 'mistwood', boss: 'wolf_king', at: MISTWOOD_KING },
  { id: 'thornvale', boss: 'thorn_queen', at: THORNVALE_QUEEN },
  { id: 'emberrift', boss: 'ember_colossus', at: EMBERRIFT_COLOSSUS },
] as const;

describe('通關機器人：新存檔一路打到第三張地圖的 Boss', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
    STAGES.thornvale = makeThornvaleStage();
    STAGES.emberrift = makeEmberriftStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
    delete STAGES.thornvale;
    delete STAGES.emberrift;
  });

  for (const weapon of [undefined, 'bow', 'staff'] as const)
  it(`普通 Bot、沒有裝備${weapon === 'bow' ? '、長弓（D-147）' : weapon === 'staff' ? '、法杖（D-152）' : ''}：每張地圖最多出發 4 次（每次 15 分鐘）就打倒 Boss`, () => {
    let level = 1;
    let xp = 0;
    let seed = 1;
    const log: string[] = [];
    let total = 0;
    for (const m of ROUTE) {
      let done = false;
      for (let run = 1; run <= 4 && !done; run++) {
        const s = createBattle({ stageId: m.id, seed: seed++, level, xp, weapon });
        const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: m.at }, 'normal');
        while (s.outcome === 'running' && !(s.bossKills ?? []).includes(m.boss) && s.tick < sec(900)) step(s, bot.decide(s));
        done = (s.bossKills ?? []).includes(m.boss);
        level = s.prog?.level ?? level;
        xp = s.prog?.xp ?? xp;
        total += s.tick / 30;
        log.push(`${m.id} 第 ${run} 趟 ${done ? '打倒' : '沒打倒'} ${(s.tick / 30).toFixed(0)} 秒 → Lv${level}（營火醒來 ${s.revives ?? 0}）`);
      }
      expect(done, log.join('\n')).toBe(true);
    }
    (globalThis as any).process.stdout.write(`[通關機器人${weapon === 'bow' ? '・長弓' : weapon === 'staff' ? '・法杖' : ''}] 共 ${(total / 60).toFixed(1)} 分鐘\n${log.join('\n')}\n`);
    expect(level).toBeGreaterThanOrEqual(4);
  }, 600000);
});
