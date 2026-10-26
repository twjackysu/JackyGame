import { describe, expect, it } from 'vitest';
import { BOSS_CHOICES, choiceOf, cleanChoices, epilogueLine, makeChoice, shopDiscountPct, withEpilogue, SPARE_DISCOUNT } from '../src/game/choices';
import { FINALE_LINES } from '../src/game/finaleStats';
import { WORLD_MAPS, FINALE_MAP } from '../src/game/worldMaps';
import { genGear } from '../src/core/battle/rt/gear';
import { buyGear, buyPrice, stockPrice } from '../src/game/rtShop';
import type { RtRecord } from '../src/game/rtRecord';

describe('討伐後的抉擇（D-157）', () => {
  it('三張主線地圖各一個抉擇、地圖存在、文字不重複', () => {
    const story = WORLD_MAPS.filter((m) => !m.postGame).map((m) => m.id);
    expect(BOSS_CHOICES.map((c) => c.map).sort()).toEqual([...story].sort());
    expect(story).toContain(FINALE_MAP);
    const labels = BOSS_CHOICES.flatMap((c) => [c.take.label, c.spare.label]);
    expect(new Set(labels).size).toBe(labels.length);
    for (const c of BOSS_CHOICES) {
      expect(c.take.crystal).toBeGreaterThan(0);
      expect(c.take.desc).toContain(String(c.take.crystal));
    }
    expect(choiceOf('starfall')).toBeUndefined();
  });

  it('壞資料丟掉；抉擇只有一次', () => {
    expect(cleanChoices(null)).toEqual({});
    expect(cleanChoices([1, 2])).toEqual({});
    expect(cleanChoices({ mistwood: 'spare', thornvale: 'eat', nowhere: 'take' })).toEqual({ mistwood: 'spare' });
    const a = makeChoice({}, 'mistwood', 'take')!;
    expect(a).toEqual({ mistwood: 'take' });
    expect(makeChoice(a, 'mistwood', 'spare')).toBeNull();
    expect(makeChoice(a, 'starfall', 'spare')).toBeNull();
  });

  it('還＝行商裝備便宜（每個 10%、和特價疊乘）', () => {
    expect(shopDiscountPct({})).toBe(0);
    expect(shopDiscountPct({ mistwood: 'spare', thornvale: 'take', emberrift: 'spare' })).toBe(2 * SPARE_DISCOUNT);
    const g = { ...genGear(12345, 3, 8, { region: 'mistwood' }), uid: 'sX9' };
    const rec: RtRecord = { coin: 100000 } as RtRecord;
    const full = stockPrice(rec, g);
    expect(full).toBe(buyPrice(g));
    expect(stockPrice(rec, g, 30)).toBe(Math.round((full * 70) / 100));
    const r = buyGear(rec, g, 30)!;
    expect(r.spent?.coin).toBe(Math.round((full * 70) / 100));
  });

  it('結語：沒選過不插入；都還／都取／混合各一句，插在最後一句之前', () => {
    expect(epilogueLine({})).toBeNull();
    expect(withEpilogue(FINALE_LINES, {})).toEqual([...FINALE_LINES]);
    const all = { mistwood: 'spare', thornvale: 'spare', emberrift: 'spare' } as const;
    const none = { mistwood: 'take', thornvale: 'take', emberrift: 'take' } as const;
    const mix = { mistwood: 'take', emberrift: 'spare' } as const;
    const lines = new Set([epilogueLine(all), epilogueLine(none), epilogueLine(mix)]);
    expect(lines.size).toBe(3);
    const w = withEpilogue(FINALE_LINES, mix);
    expect(w.length).toBe(FINALE_LINES.length + 1);
    expect(w[w.length - 1]).toBe(FINALE_LINES[FINALE_LINES.length - 1]);
    expect(w[w.length - 2]).toBe(epilogueLine(mix));
  });
});
