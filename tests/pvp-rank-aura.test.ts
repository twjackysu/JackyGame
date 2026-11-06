// 段位外觀（第 146 輪）：見習沒有光環；段位越高光圈不會變少；每個段位的顏色不同（一眼分得出來）。
import { describe, expect, it } from 'vitest';
import { rankAura, rankName } from '../src/core/meta/pvpRank';

describe('段位外觀 rankAura', () => {
  it('見習沒有；越高段光圈＋光點不減；不同段位不同色', () => {
    expect(rankAura(900)).toBeNull();
    const tiers = [950, 1100, 1250, 1400].map((r) => ({ name: rankName(r), a: rankAura(r)! }));
    expect(new Set(tiers.map((t) => t.name)).size).toBe(4);
    expect(new Set(tiers.map((t) => t.a.color)).size).toBe(4);
    for (let i = 1; i < tiers.length; i++) expect(tiers[i]!.a.rings + tiers[i]!.a.motes).toBeGreaterThanOrEqual(tiers[i - 1]!.a.rings + tiers[i - 1]!.a.motes);
  });
});
