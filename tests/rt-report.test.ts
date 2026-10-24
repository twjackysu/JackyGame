// 即時戰鬥指標報表（D-063 P2）：`npm run sim:rt`（RUNS=次數，預設 200）。平常的 npm test 會跳過。
import { describe, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { BOT_PROFILES, PlayerBot, batch } from '../src/core/battle/rt/sim';

const env = (globalThis as { process?: { env: Record<string, string | undefined>; stdout: { write(s: string): void } } }).process;
describe.skipIf(!env?.env.RT_REPORT)('即時戰鬥報表', () => {
  it('各關 × 各操作模型', () => {
    const runs = Number(env!.env.RUNS ?? 200);
    const out: string[] = ['| 關卡 | 操作 | 勝率 | 時間 P50／P90（秒） | DPS | 剩餘 HP | 閃避 | 格擋 | 普攻／技能／反擊 % |', '|---|---|--:|--:|--:|--:|--:|--:|--:|'];
    for (const st of Object.values(STAGES)) {
      if (st.spawnGroups?.length) continue; // 刷怪關（營火空地）沒有勝負，另見 rt-world-soak
      for (const k of ['auto', 'novice', 'normal', 'expert'] as const) {
        const r = batch(st.id, () => new PlayerBot(BOT_PROFILES[k], k), runs);
        out.push(`| ${st.name} | ${k} | ${r.winRate}% | ${r.durationSec.p50}／${r.durationSec.p90} | ${r.avgDps} | ${r.avgHpLeftPct}% | ${r.avgDodges} | ${r.avgBlocks} | ${r.damageShare.normal}／${r.damageShare.skill}／${r.damageShare.counter} |`);
      }
      // 藥水（HP < 45% 就喝，攜帶 20）：新手／普通 Bot 參考（D-069）
      for (const k of ['novice', 'normal'] as const) {
        const r = batch(st.id, () => new PlayerBot({ ...BOT_PROFILES[k], potionAtPct: 45 }, `${k}+pot`), runs);
        out.push(`| ${st.name} | ${k}+藥水 | ${r.winRate}% | ${r.durationSec.p50}／${r.durationSec.p90} | ${r.avgDps} | ${r.avgHpLeftPct}% | ${r.avgDodges} | ${r.avgBlocks} | ${r.damageShare.normal}／${r.damageShare.skill}／${r.damageShare.counter}（藥 ${r.avgPotions}） |`);
      }
      // 大招（劍刃風暴）還沒放進試玩鍵位：另列「會放大招」的普通／熟練 Bot 給數值參考（D-068）
      for (const k of ['normal', 'expert'] as const) {
        const r = batch(st.id, () => new PlayerBot({ ...BOT_PROFILES[k], ult: true }, `${k}+ult`), runs);
        out.push(`| ${st.name} | ${k}+大招 | ${r.winRate}% | ${r.durationSec.p50}／${r.durationSec.p90} | ${r.avgDps} | ${r.avgHpLeftPct}% | ${r.avgDodges} | ${r.avgBlocks} | ${r.damageShare.normal}／${r.damageShare.skill}／${r.damageShare.counter} |`);
      }
    }
    env!.stdout.write(`\n${out.join('\n')}\n`);
  }, 600000);
});
