// 相遇的獎勵（第 147 輪）：畫面資料（game/encounters.ts 的台詞與數字）和伺服器規則（core/meta/encounters.ts）要一致。
import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../src/game/encounters';
import { ENCOUNTER_REWARDS } from '../src/core/meta/encounters';

const pick = (r: { coin?: number; crystal?: number }) => ({ coin: r.coin ?? 0, crystal: r.crystal ?? 0 });

describe('相遇獎勵兩邊一致', () => {
  it('id、地圖、取、回禮', () => {
    expect(Object.keys(ENCOUNTER_REWARDS).sort()).toEqual(ENCOUNTERS.map((e) => e.id).sort());
    for (const e of ENCOUNTERS) {
      const r = ENCOUNTER_REWARDS[e.id]!;
      expect(r.map, e.id).toBe(e.map);
      expect(pick(r.take), e.id).toEqual(pick(e.take));
      expect(pick(r.thanks), e.id).toEqual(pick(e.thanks));
    }
  });
});
