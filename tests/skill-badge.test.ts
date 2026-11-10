// 第 165 輪：底部一排小冷卻圖示的顏色——同一把武器的四欄要分得出來（以前五顆都是同一種棕色）。純畫面資料。
import { describe, expect, it } from 'vitest';
import { createBattle, setSkillVariants, skillDef } from '../src/core/battle/rt/engine';
import { skillBadge } from '../src/game/fx/hitTint';

const SLOTS = ['heavy_slash', 'whirlwind', 'charge', 'parry'];

describe('小冷卻圖示的顏色', () => {
  for (const weapon of ['sword', 'bow', 'staff'] as const)
    for (const v of [0, 1, 2])
    it(`${weapon} 打法 ${v}：四欄的外框顏色兩兩不同，底色比外框暗`, () => {
      const s = createBattle({ stageId: 'forest_entry', seed: 1, weapon: weapon === 'sword' ? undefined : weapon });
      if (v) setSkillVariants(s, SLOTS.map((id) => (v === 2 ? `${id}:b` : id)));
      const looks = SLOTS.map((id) => skillBadge(id, skillDef(s, id)));
      // 不只是數值不同：兩兩的 RGB 距離要夠遠（第一版三顆都是差不多的藍，截圖上分不出來）
      const dist = (a: number, b: number) => Math.hypot(((a >> 16) & 255) - ((b >> 16) & 255), ((a >> 8) & 255) - ((b >> 8) & 255), (a & 255) - (b & 255));
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(dist(looks[i]!.rim, looks[j]!.rim), `${SLOTS[i]} vs ${SLOTS[j]}`).toBeGreaterThan(90);
      for (const l of looks) {
        expect(l.fill).not.toBe(l.rim);
        expect((l.fill >> 16) & 255).toBeLessThan((l.rim >> 16) & 255);
      }
    });

  it('護盾招一律是銀白（就算它的「打一下」帶狀態）；沒給定義也不會壞', () => {
    for (const weapon of [undefined, 'bow', 'staff'] as const) {
      const s = createBattle({ stageId: 'forest_entry', seed: 1, weapon });
      expect(skillBadge('parry', skillDef(s, 'parry')).rim).toBe(0xdfe6f2);
    }
    expect(skillBadge('nope', undefined).rim).toBe(0xf0c050);
  });
});
