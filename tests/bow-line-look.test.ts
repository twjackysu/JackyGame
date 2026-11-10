// 第 166 輪：長弓三支原招的直線箭（穿雲箭／縛足箭／風障射擊）以前長得一樣。照資料分長相，純畫面。
import { describe, expect, it } from 'vitest';
import { createBattle, setSkillVariants, skillDef } from '../src/core/battle/rt/engine';
import { bowLineLook } from '../src/game/fx/hitTint';

const SLOTS = ['heavy_slash', 'whirlwind', 'charge', 'parry', 'blade_storm'];
const look = (v: 0 | 1 | 2, id: string) => {
  const s = createBattle({ stageId: 'forest_entry', seed: 1, weapon: 'bow' });
  if (v) setSkillVariants(s, SLOTS.map((x) => (v === 2 ? `${x}:b` : x)));
  const d = skillDef(s, id)!;
  return bowLineLook(d, d.hits[0]!);
};

describe('長弓直線箭的長相', () => {
  it('原招三支直線箭各不相同', () => {
    expect(look(0, 'heavy_slash')).toBe('pierce');
    expect(look(0, 'charge')).toBe('snare');
    expect(look(0, 'parry')).toBe('guard');
  });
  it('不是直線的招、大招、帶其他元素的箭照原本的顏色', () => {
    expect(look(0, 'whirlwind')).toBeUndefined(); // 散射：扇形
    for (const v of [0, 1, 2] as const) expect(look(v, 'blade_storm')).toBeUndefined();
    expect(look(2, 'heavy_slash')).toBeUndefined(); // 燼火箭：火
    expect(look(2, 'charge')).toBeUndefined(); // 蝕毒箭：毒
    expect(look(1, 'charge')).toBeUndefined(); // 霜箭：扇形
  });
});
