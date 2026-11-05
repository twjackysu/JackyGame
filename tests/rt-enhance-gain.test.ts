import { describe, expect, it } from 'vitest';
import { enhanceGain, type RtGear } from '../src/core/battle/rt/gear';

const g = (enh: number, special?: RtGear['special']): RtGear => ({ uid: 'x', slot: 'body', rarity: 3, ilvl: 6, name: '甲', base: { hp: 80, def: 4 }, affixes: [{ stat: 'atk', value: 3 }], enh, ...(special ? { special } : {}) });

describe('強化預覽（enhanceGain）', () => {
  it('列出底數值變化，詞綴不列', () => {
    expect(enhanceGain(g(0))).toEqual(['HP 80→88（+8）', '防禦 4→4']);
  });
  it('+6→+7 特效變強也寫出來', () => {
    const out = enhanceGain(g(6, { skill: 'heavy_slash', kind: 'cd', value: 10 }));
    expect(out.at(-1)).toBe('★ 重斬冷卻 −13%（原 −10%）');
  });
  it('滿級沒有預覽', () => {
    expect(enhanceGain(g(10))).toEqual([]);
  });
});
