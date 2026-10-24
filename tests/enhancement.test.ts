// design/14 階段 2.4：強化（含 10 萬次 +5→+10 成本分布模擬）
import { describe, expect, it } from 'vitest';
import { preview, rollEnhance, type Enhanceable } from '../src/server/enhancement';
import { randomFromRng } from '../src/server/ports';
import { mulberry32 } from '../src/core/rng';
import { BLESSING_MAX, ENHANCE_STEPS, enhanceMultiplier } from '../src/data/enhancement';
import { LocalGameApi } from '../src/server/localGameApi';
import { KvEventJournal, fixedClock } from '../src/core/save/localPorts';
import { MemoryKV } from '../src/core/save/save';
import { newGame } from '../src/core/state/gameState';
import { createInstance } from '../src/core/state/gear';
import { equip, gearBonus } from '../src/core/state/equip';

const always = (v: number) => ({ nextFloat: () => v, nextInt: (a: number) => a });

describe('強化規則', () => {
  it('+0→+5 必成且不吃亂數', () => {
    let calls = 0;
    const rng = { nextFloat: () => (calls++, 0.999), nextInt: (a: number) => a };
    const g: Enhanceable = { enhancement: 0 };
    for (let i = 0; i < 5; i++) expect(rollEnhance(g, rng)!.success).toBe(true);
    expect(g.enhancement).toBe(5);
    expect(calls).toBe(0);
  });

  it('+6 失敗不降級；累積祝福 5 次後必成，成功後該階段祝福歸零', () => {
    const g: Enhanceable = { enhancement: 5 };
    for (let i = 0; i < 5; i++) {
      const r = rollEnhance(g, always(0.999))!;
      expect(r.success).toBe(false);
      expect(g.enhancement).toBe(5);
    }
    expect(preview(g)!.chance).toBe(1);
    const r = rollEnhance(g, always(0.999))!;
    expect(r).toMatchObject({ success: true, guaranteed: true, level: 6 });
    expect(g.blessings?.[6]).toBeUndefined();
  });

  it('+7／+8 失敗降 1 級、不低於 +5；+9／+10 失敗保持（D-058）；降級不清祝福', () => {
    const g: Enhanceable = { enhancement: 6 };
    rollEnhance(g, always(0.999));
    expect(g.enhancement).toBe(5);
    expect(g.blessings?.[7]).toBe(20);
    g.enhancement = 7;
    rollEnhance(g, always(0.999));
    expect(g.enhancement).toBe(6);
    g.enhancement = 9;
    rollEnhance(g, always(0.999));
    expect(g.enhancement).toBe(9);
    expect(g.blessings?.[10]).toBe(10);
    expect(g.blessings?.[7]).toBe(20);
  });

  it('+10 不能再強化', () => {
    expect(rollEnhance({ enhancement: 10 }, always(0))).toBeUndefined();
  });

  it('祝福值不超過上限', () => {
    const g: Enhanceable = { enhancement: 9 };
    for (let i = 0; i < 30; i++) {
      g.enhancement = 9;
      if (rollEnhance(g, always(0.999))!.success) g.blessings = { ...g.blessings, 10: 0 };
    }
    expect(Object.values(g.blessings ?? {}).every((v) => (v ?? 0) <= BLESSING_MAX)).toBe(true);
  });
});

describe('10 萬次 +5 → +10 成本分布', () => {
  it('P50／P90／P99、平均降級、最長連敗', () => {
    const N = 100_000;
    const rng = randomFromRng(mulberry32(20261024));
    const tries: number[] = [];
    const golds: number[] = [];
    let downs = 0;
    let longest = 0;
    for (let i = 0; i < N; i++) {
      const g: Enhanceable = { enhancement: 5 };
      let n = 0;
      let gold = 0;
      let streak = 0;
      while (g.enhancement < 10) {
        const before = g.enhancement;
        gold += ENHANCE_STEPS[before]!.cost.gold;
        const r = rollEnhance(g, rng)!;
        n++;
        if (r.success) streak = 0;
        else {
          streak++;
          longest = Math.max(longest, streak);
          if (g.enhancement < before) downs++;
        }
      }
      tries.push(n);
      golds.push(gold);
    }
    tries.sort((a, b) => a - b);
    golds.sort((a, b) => a - b);
    const p = (arr: number[], q: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * q))]!;
    const report = {
      tries: { p50: p(tries, 0.5), p90: p(tries, 0.9), p99: p(tries, 0.99), max: tries[tries.length - 1] },
      gold: { p50: p(golds, 0.5), p90: p(golds, 0.9), p99: p(golds, 0.99) },
      avgDowngrades: +(downs / N).toFixed(2),
      longestFailStreak: longest,
    };
    (globalThis as { process?: { stdout: { write(s: string): void } } }).process?.stdout.write(`\n[強化 +5→+10 ×${N}] ${JSON.stringify(report)}\n`);
    // 「P99 不得離譜」：P99 不超過 P50 的 2.5 倍，且 100 次以內一定到 +10（祝福保底的效果）
    expect(report.tries.p99).toBeLessThanOrEqual(report.tries.p50 * 2.5);
    expect(report.tries.max).toBeLessThanOrEqual(100);
    expect(report.tries.p50).toBeGreaterThanOrEqual(10); // 也不能太容易
  });
});

describe('GameApi.enhance 與數值', () => {
  function setup() {
    const s = newGame(0, 7);
    const api = new LocalGameApi(() => s, new KvEventJournal(new MemoryKV()), fixedClock());
    return { s, api };
  }

  it('扣金幣與材料、附規則版本；材料不夠／滿級回錯誤', () => {
    const { s, api } = setup();
    const g = createInstance(s, 'lantern_brass', 'drop');
    s.gold = 0;
    expect(api.enhance('e0', { instanceId: g.instanceId }).error).toBe('not_enough_materials');
    s.inventory.mat_dust = 100;
    expect(api.enhance('e1', { instanceId: g.instanceId }).error).toBe('not_enough_gold');
    s.gold = 10000;
    const r = api.enhance('e2', { instanceId: g.instanceId });
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject({ success: true, level: 1 });
    expect(s.gold).toBe(10000 - ENHANCE_STEPS[0]!.cost.gold);
    expect(s.inventory.mat_dust).toBe(100 - ENHANCE_STEPS[0]!.cost.mat_dust);
    expect(api.enhance('e2', { instanceId: g.instanceId }).duplicate).toBe(true);
    g.enhancement = 10;
    expect(api.enhance('e3', { instanceId: g.instanceId }).error).toBe('max_level');
    expect(api.enhance('e4', { instanceId: 'nope' }).error).toBe('not_owned');
  });

  it('強化放大裝備基礎數值（+10 ≈ ×1.4，不複利）', () => {
    const { s } = setup();
    const g = createInstance(s, 'lantern_brass', 'drop');
    equip(s, 'lian', g.instanceId);
    const base = gearBonus(s, 'lian').atk;
    g.enhancement = 10;
    expect(gearBonus(s, 'lian').atk).toBe(Math.round(base * 1.4));
    expect(enhanceMultiplier(5)).toBeCloseTo(1.15);
  });
});
