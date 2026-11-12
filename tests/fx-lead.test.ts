import { describe, expect, it } from 'vitest';
import { fxLead } from '../src/game/fx/hitTint';
import { BOW_SKILLS, BOW_VARIANTS, BOW_VARIANTS_B, SKILLS, SKILL_VARIANTS, SKILL_VARIANTS_B, STAFF_SKILLS, STAFF_VARIANTS, STAFF_VARIANTS_B } from '../src/core/battle/rt/data';
import type { SkillDefinition } from '../src/core/battle/rt/types';

// 第 179 輪：從天上落下來的招，特效提早出發，落地才會是扣血那一刻（純畫面；扣血的 tick 不變）
const leads = (weapon: string | undefined, sets: Record<string, SkillDefinition>[]): { id: string; at: number; lead: number }[] => {
  const out: { id: string; at: number; lead: number }[] = [];
  for (const set of sets) for (const [id, sk] of Object.entries(set)) for (const h of sk.hits) {
    const lead = fxLead(weapon, sk.role === 'ult', sk.hits.length, h.shape.type, h.status?.id);
    if (lead > 0) out.push({ id, at: h.atTick, lead });
  }
  return out;
};

describe('落下型特效的提前量', () => {
  it('法杖流星雨（大招、多段、圓）提早 5 tick；雷暴、隕星術、虛空奇點不提早', () => {
    expect(fxLead('staff', true, 6, 'circle', undefined)).toBe(5);
    expect(fxLead('staff', true, 6, 'circle', 'burn')).toBe(5);
    expect(fxLead('staff', false, 5, 'circle', 'slow')).toBe(0); // 雷暴：閃電一出現就是命中
    expect(fxLead('staff', true, 1, 'circle', undefined)).toBe(0); // 隕星術：單發，光柱一出現就落地
    expect(fxLead('staff', true, 6, 'circle', 'slow')).toBe(0); // 虛空奇點
  });
  it('長弓：流星箭雨提早 5、環形箭雨提早 4、直線箭不提早', () => {
    expect(fxLead('bow', true, 8, 'circle')).toBe(5);
    expect(fxLead('bow', false, 3, 'ring')).toBe(4);
    expect(fxLead('bow', true, 1, 'line')).toBe(0);
    expect(fxLead('bow', false, 1, 'sector')).toBe(0);
  });
  it('長劍（weapon 沒有值）一律不提早', () => {
    for (const t of ['circle', 'ring', 'sector', 'line'] as const) expect(fxLead(undefined, true, 5, t)).toBe(0);
    expect(leads(undefined, [SKILLS, SKILL_VARIANTS, SKILL_VARIANTS_B])).toEqual([]);
  });
  it('真的有招會提早，而且每一段都來得及（提前量不超過那一段的 atTick，否則第一波還是會晚）', () => {
    const staff = leads('staff', [STAFF_SKILLS, STAFF_VARIANTS, STAFF_VARIANTS_B]);
    const bow = leads('bow', [BOW_SKILLS, BOW_VARIANTS, BOW_VARIANTS_B]);
    expect(staff.length).toBeGreaterThan(0);
    expect(bow.length).toBeGreaterThan(0);
    for (const q of [...staff, ...bow]) expect(q.at, q.id).toBeGreaterThanOrEqual(q.lead);
  });
});
