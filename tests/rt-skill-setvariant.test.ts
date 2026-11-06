import { describe, expect, it } from 'vitest';
import { setVariant } from '../src/core/meta/skills';

describe('技能樹直接選打法（setVariant，D-272）', () => {
  const r = { heavy_slash: 5, whirlwind: 3 };
  it('滿級可以直接選變化／變化二／原招', () => {
    expect(setVariant([], 'heavy_slash', 1, r)).toEqual(['heavy_slash']);
    expect(setVariant(['heavy_slash'], 'heavy_slash', 2, r)).toEqual(['heavy_slash:b']);
    expect(setVariant(['heavy_slash:b'], 'heavy_slash', 0, r)).toEqual([]);
  });
  it('沒滿級不能選', () => {
    expect(setVariant([], 'whirlwind', 1, r)).toBeNull();
  });
});
