// design/14 階段 2.3：詞綴生成與保底（含 10 萬件合法率）
import { describe, expect, it } from 'vitest';
import { affixesLegal, bossWeights, rollAffixes, rollBossTier, rollTier, type PityState } from '../src/server/loot';
import { randomFromRng } from '../src/server/ports';
import { mulberry32 } from '../src/core/rng';
import { AFFIX_COUNT, GEAR_SLOTS, TIERS, type Tier } from '../src/data/rules';
import { AFFIX_BY_ID } from '../src/data/affixes';
import { LOOT_TABLES, PITY } from '../src/data/lootTables';

const rng = (seed: number) => randomFromRng(mulberry32(seed));

describe('詞綴生成', () => {
  it('10 萬件：合法率 100%、條數正確、無重複互斥群組', () => {
    const r = rng(1);
    let n = 0;
    for (let i = 0; i < 100_000; i++) {
      const slot = GEAR_SLOTS[i % GEAR_SLOTS.length]!;
      const tier = TIERS[Math.floor(i / GEAR_SLOTS.length) % TIERS.length]!;
      const a = rollAffixes(slot, tier, r);
      expect(a.length).toBe(AFFIX_COUNT[tier]);
      if (!affixesLegal(slot, tier, a)) throw new Error(`illegal ${slot} ${tier} ${JSON.stringify(a)}`);
      const groups = a.map((x) => AFFIX_BY_ID[x.id]!.group);
      expect(new Set(groups).size).toBe(groups.length);
      n++;
    }
    expect(n).toBe(100_000);
  });

  it('同種子 → 同結果', () => {
    expect(rollAffixes('weapon', 'epic', rng(9))).toEqual(rollAffixes('weapon', 'epic', rng(9)));
  });

  it('重鑄鎖定：保留的詞綴原樣留下，新抽的不和它同群組', () => {
    const keep = [{ id: 'atk_flat', value: 6 }];
    for (let i = 0; i < 2000; i++) {
      const a = rollAffixes('weapon', 'epic', rng(i), 3, keep);
      expect(a[0]).toEqual(keep[0]);
      expect(a.slice(1).every((x) => AFFIX_BY_ID[x.id]!.group !== 'atk')).toBe(true);
      expect(affixesLegal('weapon', 'epic', a)).toBe(true);
    }
  });

  it('非法組合會被檢查出來', () => {
    expect(affixesLegal('weapon', 'rare', [{ id: 'atk_flat', value: 5 }, { id: 'atk_pct', value: 6 }])).toBe(false); // 同群組
    expect(affixesLegal('armor', 'rare', [{ id: 'atk_flat', value: 5 }])).toBe(false); // 部位不符
    expect(affixesLegal('weapon', 'magic', [{ id: 'atk_flat', value: 999 }])).toBe(false); // 超出範圍
    expect(affixesLegal('weapon', 'magic', [{ id: 'boss_dmg', value: 5 }])).toBe(false); // 稀有度不夠
  });
});

describe('稀有度與保底', () => {
  it('Boss 權重表的出貨比例接近設計值（10 萬次）', () => {
    const r = rng(3);
    const count: Partial<Record<Tier, number>> = {};
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const t = rollTier(LOOT_TABLES.abyss_boss!.tiers, r);
      count[t] = (count[t] ?? 0) + 1;
    }
    expect((count.rare ?? 0) / N).toBeCloseTo(0.45, 1);
    expect((count.divine ?? 0) / N).toBeGreaterThan(0.015);
    expect((count.divine ?? 0) / N).toBeLessThan(0.025);
  });

  it('硬保底：10 萬場 Boss 中，兩件神級之間最多隔 40 場', () => {
    const r = rng(4);
    const pity: PityState = { sinceLegend: 0, sinceDivine: 0 };
    let gap = 0;
    let worst = 0;
    let divines = 0;
    for (let i = 0; i < 100_000; i++) {
      const t = rollBossTier(pity, r);
      gap++;
      if (t === 'divine') {
        worst = Math.max(worst, gap);
        gap = 0;
        divines++;
      }
    }
    expect(worst).toBeLessThanOrEqual(PITY.hardAt);
    (globalThis as { process?: { stdout: { write(s: string): void } } }).process?.stdout.write(`\n[保底] 神級 ${divines}/100000（含保底），最長間隔 ${worst}\n`);
  });

  it('軟保底：連續沒出傳說時傳說權重逐步提高', () => {
    expect(bossWeights({ sinceLegend: 0, sinceDivine: 0 }).legend).toBe(18);
    expect(bossWeights({ sinceLegend: PITY.softAfter, sinceDivine: 0 }).legend).toBe(18 + PITY.softStep * 1);
    expect(bossWeights({ sinceLegend: PITY.softAfter + 4, sinceDivine: 0 }).legend).toBe(18 + PITY.softStep * 5);
    expect(bossWeights({ sinceLegend: 0, sinceDivine: PITY.hardAt - 1 })).toEqual({ divine: 1 });
  });
});
