import { it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec, UNIT } from '../src/core/battle/rt/types';
const out = (s: string) => (globalThis as any).process.stdout.write(s);
it('diag', () => {
  STAGES.mistwood = makeMistwoodStage();
  for (const seed of [1, 2, 3]) for (const b of ['novice', 'normal', 'expert'] as const) {
    const bot = new PlayerBot({ ...BOT_PROFILES[b], ult: true, potionAtPct: 35, advanceTo: MISTWOOD_KING, campfireBelowPotions: 8 }, b);
    const s = createBattle({ stageId: 'mistwood', seed });
    let minD = 1e9, motherCombat = -1, kingAt = -1;
    while (s.tick < sec(900) && kingAt < 0) {
      step(s, bot.decide(s));
      const p = s.units.find((u) => u.side === 'player')!;
      const m = s.units.find((u) => u.defId === 'thorn_mother' && !u.dead);
      if (m) { minD = Math.min(minD, Math.hypot(m.x - p.x, m.y - p.y) / UNIT); if (motherCombat < 0 && m.mode === 'combat') motherCombat = s.tick; }
      const k = s.units.find((u) => u.defId === 'wolf_king');
      if (k && k.mode === 'combat') kingAt = s.tick;
    }
    out(`seed${seed} ${b}: minDist ${minD.toFixed(1)} motherCombat ${motherCombat < 0 ? '-' : Math.round(motherCombat / 30)} king ${Math.round(kingAt / 30)}s\n`);
  }
}, 600000);
