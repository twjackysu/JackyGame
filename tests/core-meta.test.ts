// Q3（第 141 輪）：core/meta 的規則與畫面層一致
import { describe, expect, it } from 'vitest';
import { BOSS_CHOICES, shopDiscountPct } from '../src/game/choices';
import { CHOICE_MAPS, discountOf } from '../src/core/meta/shop';
import { enhanceRoll, replaceGear } from '../src/core/meta/bag';
import { ENH_MAX, enhanceCost, genGear } from '../src/core/battle/rt/gear';
import { mulberry32 } from '../src/core/rng';

describe('core/meta', () => {
  it('抉擇地圖清單和 BOSS_CHOICES 一樣、折扣算法一樣', () => {
    expect([...CHOICE_MAPS]).toEqual(BOSS_CHOICES.map((c) => c.map));
    const c = { mistwood: 'spare', thornvale: 'take', starfall: 'spare' } as const;
    expect(discountOf(c)).toBe(shopDiscountPct(c));
    expect(discountOf(null)).toBe(0);
    expect(discountOf({ mistwood: 'yes' })).toBe(0);
  });

  it('enhanceRoll：+5 以內必成、+10 不能強化、成功率接近 rate', () => {
    const g = genGear(3, 2, 5);
    expect(enhanceRoll({ ...g, enh: 4 }, () => 0.999)!.ok).toBe(true);
    expect(enhanceRoll({ ...g, enh: ENH_MAX }, Math.random)).toBeNull();
    const rng = mulberry32(42);
    let ok = 0;
    for (let i = 0; i < 4000; i++) if (enhanceRoll({ ...g, enh: 8 }, rng)!.ok) ok++;
    expect(Math.abs(ok / 4000 - enhanceCost(8).rate / 100)).toBeLessThan(0.03);
    const r = enhanceRoll({ ...g, enh: 2 }, rng)!;
    expect(r.gear.enh).toBe(3);
    expect(r.cost).toEqual(enhanceCost(2));
  });

  it('replaceGear 換掉身上與行囊的同一件', () => {
    const a = genGear(1, 2, 3);
    const b = genGear(2, 2, 3);
    const up = { ...a, enh: 1 };
    expect(replaceGear({ bag: [b, a], equip: {} }, up).bag[1]).toEqual(up);
    expect(replaceGear({ bag: [b], equip: { [a.slot]: a } }, up).equip[a.slot]).toEqual(up);
  });
});
