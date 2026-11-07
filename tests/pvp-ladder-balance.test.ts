// 競技場能不能找到平衡點（第 151 輪，D-325）：裝備差的人輸到某個分數後要贏得了、裝備好的人往上爬。
// 用真的伺服器（記憶體 DB）連打 30 場：Bot 當玩家，看最後 15 場的勝率。
import { describe, expect, it } from 'vitest';
import { GameClient } from '../src/client/GameClient';
import { LocalTransport } from '../src/net/LocalTransport';
import { FakeClock, SeqIds } from '../src/server/clock';
import { GameServer } from '../src/server/GameServer';
import { playPvp } from '../src/core/battle/rt/pvpMatch';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { GEAR_SLOTS, genGear } from '../src/core/battle/rt/gear';
import { hashSeed } from '../src/core/rng';
import { openMemoryDb } from '../src/server/db/memory/MemoryDb';
import { LEGACY_SAMPLE } from './server-contract/fixtures';
const auth = { resolve: async (t?: string) => t ?? 'anon' };
const snap = (kind: string, w: string) => {
  const rec = JSON.parse(LEGACY_SAMPLE.jg_rt_mistwood!) as Record<string, unknown>;
  const [r, il, slots] = kind === 'weapon' ? [2, 5, ['weapon']] : kind === 'r1i3' ? [1, 3, GEAR_SLOTS] : kind === 'r2i6' ? [2, 6, GEAR_SLOTS] : [3, 10, GEAR_SLOTS];
  rec.equip = Object.fromEntries((slots as string[]).map((slot) => [slot, { ...genGear(hashSeed(`${kind}:${slot}`), r as 1, il as number, { slot: slot as 'weapon' }), uid: `u-${slot}` }]));
  rec.bag = [];
  return { ...LEGACY_SAMPLE, jg_rt_mistwood: JSON.stringify(rec), jg_weapon: w };
};
describe('競技場天梯平衡點（D-325）', () => {
it('只有一把武器的人掉分後贏得了；中等裝備在 1000 附近有輸有贏；好裝往上爬', async () => {
  const got: Record<string, { rating: number; win: number }> = {};
  for (const kind of ['weapon', 'r2i6', 'r3i10'])
    for (const w of ['sword']) {
      const db = await openMemoryDb(() => 0);
      const clock = new FakeClock();
      let q = 1;
      const server = new GameServer({ db, auth, clock, ids: new SeqIds(), local: true, rng: () => ((q = (q * 16807) % 2147483647) / 2147483647) });
      let n = 0;
      const a = new GameClient(new LocalTransport((j) => server.handle(j)), { token: `acc${kind}${w}`, timeoutMs: 15000, retries: 1, newRequestId: () => `x${++n}` });
      const { characterId } = await a.call('migrate.legacy', { snapshot: snap(kind, w) });
      const outs: string[] = [];
      let rating = 0;
      for (let k = 0; k < 30; k++) {
        clock.advance(60_000);
        const st = await a.call('pvp.start', { characterId });
        const bot = new PlayerBot(BOT_PROFILES.expert!, 'me');
        const loc = playPvp({ seed: st.seed, me: st.me, foe: st.foe }, (s) => bot.decide(s) as never);
        const res = await a.call('pvp.finish', { characterId, matchId: st.matchId, inputs: loc.inputs });
        outs.push(res.outcome[0]!);
        rating = res.rating;
      }
      const last = outs.slice(-15);
      got[kind] = { rating, win: last.filter((o) => o === 'v').length / 15 };
    }
  expect(got.weapon!.win).toBeGreaterThan(0.1);
  expect(got.weapon!.rating).toBeGreaterThan(650);
  expect(got.r2i6!.win).toBeGreaterThan(0.25);
  expect(got.r2i6!.win).toBeLessThan(0.75);
  expect(got.r3i10!.rating).toBeGreaterThan(got.r2i6!.rating + 150);
  expect(got.r2i6!.rating).toBeGreaterThan(got.weapon!.rating + 150);
}, 120000);
});
