// design/14 階段 1.3：長尾資料表 schema 測試
import { describe, expect, it } from 'vitest';
import { AFFIX_COUNT, EQUIP_SLOTS, GEAR_SLOTS, RULES_VERSION, TIERS, slotType, tierRank, type Tier } from '../src/data/rules';
import { AFFIXES, AFFIX_BY_ID } from '../src/data/affixes';
import { BLESSING_MAX, ENHANCE_STEPS, MAX_ENHANCE, SAFE_FLOOR, failText } from '../src/data/enhancement';
import { LOOT_TABLES, PITY, QUICK_SALVAGE_TIERS, SALVAGE } from '../src/data/lootTables';
import { MATERIALS, MATERIAL_IDS, MAX_MATERIAL_KINDS } from '../src/data/materials';
import { ITEM_DEFS } from '../src/data/equipment';

describe('規則版本', () => {
  it('RULES_VERSION 是正整數', () => {
    expect(Number.isInteger(RULES_VERSION)).toBe(true);
    expect(RULES_VERSION).toBeGreaterThan(0);
  });
  it('6 格裝備、5 種部位類型', () => {
    expect(EQUIP_SLOTS).toHaveLength(6);
    for (const s of EQUIP_SLOTS) expect(GEAR_SLOTS).toContain(slotType(s));
  });
});

describe('材料', () => {
  it('種類 ≤ 7、id 唯一、不和物品模板撞名', () => {
    expect(MATERIALS.length).toBeLessThanOrEqual(MAX_MATERIAL_KINDS);
    expect(new Set(MATERIAL_IDS).size).toBe(MATERIAL_IDS.length);
    for (const id of MATERIAL_IDS) expect(ITEM_DEFS[id]).toBeUndefined();
  });
});

describe('詞綴', () => {
  it('id 唯一、欄位完整', () => {
    expect(Object.keys(AFFIX_BY_ID)).toHaveLength(AFFIXES.length);
    expect(AFFIXES.length).toBeGreaterThanOrEqual(20);
    for (const a of AFFIXES) {
      expect(a.text, a.id).toContain('{v}');
      expect(a.group, a.id).toBeTruthy();
      expect(a.slots.length, a.id).toBeGreaterThan(0);
      for (const s of a.slots) expect(GEAR_SLOTS, a.id).toContain(s);
      expect(a.weight, a.id).toBeGreaterThan(0);
      expect(TIERS, a.id).toContain(a.minTier);
    }
  });
  it('範圍：minTier 以上每階都有、lo ≤ hi、整數、隨稀有度不下降', () => {
    for (const a of AFFIXES) {
      let prev: readonly [number, number] | undefined;
      for (const t of TIERS) {
        const r = a.range[t];
        if (tierRank(t) < tierRank(a.minTier)) {
          expect(r, `${a.id} ${t}`).toBeUndefined();
          continue;
        }
        expect(r, `${a.id} ${t}`).toBeDefined();
        const [lo, hi] = r!;
        expect(Number.isInteger(lo) && Number.isInteger(hi), a.id).toBe(true);
        expect(lo, a.id).toBeGreaterThan(0);
        expect(lo, a.id).toBeLessThanOrEqual(hi);
        if (prev) {
          expect(lo, `${a.id} ${t}`).toBeGreaterThanOrEqual(prev[0]);
          expect(hi, `${a.id} ${t}`).toBeGreaterThanOrEqual(prev[1]);
        }
        prev = r;
      }
    }
  });
  it('互斥群組合法：每個部位×稀有度可用的群組數 ≥ 該稀有度的詞綴條數（才抽得滿且不重複群組）', () => {
    for (const slot of GEAR_SLOTS) {
      for (const t of TIERS) {
        const groups = new Set(AFFIXES.filter((a) => a.slots.includes(slot) && tierRank(t) >= tierRank(a.minTier)).map((a) => a.group));
        expect(groups.size, `${slot} ${t}`).toBeGreaterThanOrEqual(AFFIX_COUNT[t]);
      }
    }
  });
});

describe('強化表', () => {
  it('+1～+10 連續、+5 以下必成、+6 起機率遞減', () => {
    expect(ENHANCE_STEPS.map((s) => s.to)).toEqual(Array.from({ length: MAX_ENHANCE }, (_, i) => i + 1));
    for (const s of ENHANCE_STEPS) {
      expect(s.chance).toBeGreaterThan(0);
      expect(s.chance).toBeLessThanOrEqual(1);
      if (s.to <= SAFE_FLOOR) expect(s.chance).toBe(1);
    }
    for (let i = SAFE_FLOOR + 1; i < ENHANCE_STEPS.length; i++) expect(ENHANCE_STEPS[i]!.chance).toBeLessThan(ENHANCE_STEPS[i - 1]!.chance);
  });
  it('失敗最多降 1 級、不低於 +5；+6 失敗不降級', () => {
    for (const s of ENHANCE_STEPS) {
      expect(s.failTo).toBeGreaterThanOrEqual(Math.min(SAFE_FLOOR, s.to - 1));
      expect(s.failTo).toBeLessThanOrEqual(s.to - 1);
      expect(s.failTo).toBeGreaterThanOrEqual(s.to - 2);
    }
    expect(ENHANCE_STEPS[5]!.failTo).toBe(5);
    expect(failText(ENHANCE_STEPS[5]!)).toContain('不變');
    expect(failText(ENHANCE_STEPS[9]!)).toContain('+8');
  });
  it('祝福保底：+6～+8 最多 5 次失敗、+9／+10 最多 10 次失敗就必成', () => {
    for (const s of ENHANCE_STEPS.filter((x) => x.chance < 1)) {
      const fails = Math.ceil(BLESSING_MAX / s.blessingOnFail);
      expect(fails, `+${s.to}`).toBeLessThanOrEqual(s.to <= 8 ? 5 : 10);
    }
  });
  it('數值加成不複利：單調遞增、+10 不超過 40%', () => {
    for (let i = 1; i < ENHANCE_STEPS.length; i++) expect(ENHANCE_STEPS[i]!.statPct).toBeGreaterThan(ENHANCE_STEPS[i - 1]!.statPct);
    expect(ENHANCE_STEPS[9]!.statPct).toBeLessThanOrEqual(40);
  });
  it('成本只用已定義的材料、遞增', () => {
    for (const s of ENHANCE_STEPS) for (const k of Object.keys(s.cost)) if (k !== 'gold') expect(MATERIAL_IDS).toContain(k);
    for (let i = 1; i < ENHANCE_STEPS.length; i++) {
      expect(ENHANCE_STEPS[i]!.cost.gold).toBeGreaterThan(ENHANCE_STEPS[i - 1]!.cost.gold);
      expect(ENHANCE_STEPS[i]!.cost.mat_dust).toBeGreaterThanOrEqual(ENHANCE_STEPS[i - 1]!.cost.mat_dust);
    }
  });
});

describe('掉落表與保底', () => {
  const sum = (w: Partial<Record<Tier, number>>) => Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
  it('權重加總 > 0、機率在 0–1、材料範圍合法', () => {
    for (const t of Object.values(LOOT_TABLES)) {
      expect(sum(t.tiers), t.id).toBeGreaterThan(0);
      for (const [tier, w] of Object.entries(t.tiers)) {
        expect(TIERS, t.id).toContain(tier);
        expect(w, t.id).toBeGreaterThan(0);
      }
      expect(t.chance).toBeGreaterThan(0);
      expect(t.chance).toBeLessThanOrEqual(1);
      expect(t.rolls).toBeGreaterThanOrEqual(1);
      for (const [m, r] of Object.entries(t.materials ?? {})) {
        expect(MATERIAL_IDS).toContain(m);
        expect(r![0]).toBeLessThanOrEqual(r![1]);
      }
    }
  });
  it('Boss 必掉、比例符合設計（稀有 45／史詩 35／傳說 18／神級 2）', () => {
    const b = LOOT_TABLES.abyss_boss!;
    expect(b.chance).toBe(1);
    const total = sum(b.tiers);
    expect(b.tiers.rare! / total).toBeCloseTo(0.45);
    expect(b.tiers.divine! / total).toBeCloseTo(0.02);
  });
  it('保底參數合理', () => {
    expect(PITY.softAfter).toBeLessThan(PITY.hardAt);
    expect(PITY.softStep).toBeGreaterThan(0);
    expect(PITY.craftDivineCost % PITY.dupDivineShards).toBe(0);
  });
  it('分解：每階都有、隨稀有度不下降；一鍵分解不含傳說以上', () => {
    let prev = 0;
    for (const t of TIERS) {
      const d = SALVAGE[t].mat_dust ?? 0;
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    for (const t of QUICK_SALVAGE_TIERS) expect(tierRank(t)).toBeLessThan(tierRank('legend'));
  });
});
