import { describe, expect, it } from 'vitest';
import { BOSS_CHOICES, choiceOf, cleanChoices, codaLine, epilogueLine, makeChoice, shopDiscountPct, withEpilogue, SPARE_DISCOUNT } from '../src/game/choices';
import { FINALE_LINES } from '../src/game/finaleStats';
import { WORLD_MAPS, FINALE_MAP } from '../src/game/worldMaps';
import { genGear } from '../src/core/battle/rt/gear';
import { buyGear, buyPrice, stockPrice } from '../src/game/rtShop';
import type { RtRecord } from '../src/game/rtRecord';

describe('討伐後的抉擇（D-157）', () => {
  it('四張大地圖各一個抉擇（通關後的地圖標 postGame）、地圖存在、文字不重複', () => {
    const story = WORLD_MAPS.filter((m) => !m.postGame).map((m) => m.id);
    expect(BOSS_CHOICES.map((c) => c.map).sort()).toEqual(WORLD_MAPS.map((m) => m.id).sort());
    for (const c of BOSS_CHOICES) expect(!!c.postGame).toBe(!story.includes(c.map));
    expect(story).toContain(FINALE_MAP);
    const labels = BOSS_CHOICES.flatMap((c) => [c.take.label, c.spare.label]);
    expect(new Set(labels).size).toBe(labels.length);
    for (const c of BOSS_CHOICES) {
      expect(c.take.crystal).toBeGreaterThan(0);
      expect(c.take.desc).toContain(String(c.take.crystal));
    }
    expect(choiceOf('starfall')?.postGame).toBe(true);
    expect(choiceOf('nowhere')).toBeUndefined();
  });

  it('壞資料丟掉；抉擇只有一次', () => {
    expect(cleanChoices(null)).toEqual({});
    expect(cleanChoices([1, 2])).toEqual({});
    expect(cleanChoices({ mistwood: 'spare', thornvale: 'eat', nowhere: 'take' })).toEqual({ mistwood: 'spare' });
    const a = makeChoice({}, 'mistwood', 'take')!;
    expect(a).toEqual({ mistwood: 'take' });
    expect(makeChoice(a, 'mistwood', 'spare')).toBeNull();
    expect(makeChoice(a, 'nowhere', 'spare')).toBeNull();
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

  it('星隕高原（D-158）：不影響三片土地那句；選過的話結語最後多一句尾聲；四個都還＝−40%', () => {
    const all = { mistwood: 'spare', thornvale: 'spare', emberrift: 'spare' } as const;
    expect(epilogueLine({ ...all, starfall: 'take' })).toBe(epilogueLine(all));
    expect(epilogueLine({ starfall: 'spare' })).toBeNull();
    expect(codaLine({})).toBeNull();
    expect(codaLine({ starfall: 'spare' })).not.toBe(codaLine({ starfall: 'take' }));
    const w = withEpilogue(FINALE_LINES, { ...all, starfall: 'spare' });
    expect(w.length).toBe(FINALE_LINES.length + 2);
    expect(w[w.length - 1]).toBe(codaLine({ starfall: 'spare' }));
    expect(w[w.length - 2]).toBe(FINALE_LINES[FINALE_LINES.length - 1]);
    expect(withEpilogue(FINALE_LINES, { starfall: 'take' })).toEqual([...FINALE_LINES, codaLine({ starfall: 'take' })]);
    expect(shopDiscountPct({ ...all, starfall: 'spare' })).toBe(4 * SPARE_DISCOUNT);
  });
});

describe('燼牌對手的回聲（D-157）', () => {
  it('看對手所在地圖的抉擇；沒選過或不認識的對手回 null', async () => {
    const { rivalEcho } = await import('../src/game/choices');
    expect(rivalEcho('vela', {})).toBeNull();
    expect(rivalEcho('ida', { mistwood: 'take' })).toBeNull();
    const a = rivalEcho('vela', { thornvale: 'spare' });
    const b = rivalEcho('vela', { thornvale: 'take' });
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
    expect(rivalEcho('goran', { thornvale: 'spare' })).toBeNull();
    expect(rivalEcho('sol', { starfall: 'spare' })).toBeTruthy();
  });
});

describe('結語跟著武器換字（第 57 輪）', () => {
  it('長劍不變、長弓／法杖不寫「劍下」', async () => {
    const { finaleLinesFor } = await import('../src/game/finaleStats');
    expect(finaleLinesFor('sword')).toEqual([...FINALE_LINES]);
    for (const w of ['bow', 'staff']) {
      const l = finaleLinesFor(w);
      expect(l.join('')).not.toContain('劍下');
      expect(l.length).toBe(FINALE_LINES.length);
    }
  });
  it('只選過一部分（舊存檔）時不點名三樣東西', () => {
    const one = epilogueLine({ emberrift: 'spare' })!;
    expect(one).not.toContain('小狼');
    expect(one).not.toContain('都還在');
    expect(epilogueLine({ emberrift: 'take' })!).not.toContain('霧角');
    expect(epilogueLine({ mistwood: 'take', emberrift: 'spare' })).toContain('有些');
  });
  it('結語每一行 ≤ 19 字（360×640 的結局頁一行約 19 字，多一個字就會剩「還在。」孤字一行，第 79 輪）', () => {
    const M = ['mistwood', 'thornvale', 'emberrift'];
    const combos: Record<string, 'take' | 'spare'>[] = [{}];
    for (const m of M) for (const c of [...combos]) for (const p of ['take', 'spare'] as const) combos.push({ ...c, [m]: p });
    const lines = new Set<string>();
    for (const c of combos) for (const sf of [undefined, 'take', 'spare'] as const) {
      const all = sf ? { ...c, starfall: sf } : c;
      for (const t of [epilogueLine(all), codaLine(all)]) if (t) t.split('\n').forEach((l) => lines.add(l));
    }
    for (const l of lines) expect([...l].length, l).toBeLessThanOrEqual(19);
  });
});
