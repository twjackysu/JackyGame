// 模擬冒險者的天梯（D-303）：確定性、每天會變、程度高的平均分比較高、總分守恆（Elo 零和）。
import { describe, expect, it } from 'vitest';
import { simBaseRating, simLeague } from '../src/core/meta/pvpRank';
import { simRoster } from '../src/server/sim/roster';

const ps = simRoster().map((s) => ({ id: s.accountId, tier: s.tier }));

describe('simLeague', () => {
  it('同一天同結果；隔天不一樣', () => {
    const a = simLeague(ps, 20400);
    expect([...simLeague(ps, 20400)]).toEqual([...a]);
    expect([...simLeague(ps, 20401)]).not.toEqual([...a]);
  });
  it('分數有在動、總分守恆、程度高的平均比較高、不會飄太遠', () => {
    const r = simLeague(ps, 20400);
    const base = ps.reduce((t, p) => t + simBaseRating(p.tier), 0);
    expect([...r.values()].reduce((t, v) => t + v, 0)).toBe(base);
    expect(ps.filter((p) => r.get(p.id) !== simBaseRating(p.tier)).length).toBeGreaterThan(ps.length / 2);
    const avg = (f: (t: number) => boolean) => { const xs = ps.filter((p) => f(p.tier)).map((p) => r.get(p.id)!); return xs.reduce((t, v) => t + v, 0) / xs.length; };
    const tiers = ps.map((p) => p.tier).sort((x, y) => x - y);
    const mid = tiers[Math.floor(tiers.length / 2)]!;
    expect(avg((t) => t > mid)).toBeGreaterThan(avg((t) => t < mid));
    for (const v of r.values()) expect(Math.abs(v - 1000)).toBeLessThan(500);
  });
});
