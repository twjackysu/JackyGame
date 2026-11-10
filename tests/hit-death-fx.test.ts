// 第三期 Q1／Q2（D-335）：命中火花顏色與倒下種類是純資料，這裡確認每一招、每隻怪都對得到。
import { describe, expect, it } from 'vitest';
import { ENEMIES, WEAPONS } from '../src/core/battle/rt/data';
import { deathKind } from '../src/game/fx/deathFx';
import { CRIT_LOOK, hitLook, skillElement } from '../src/game/fx/hitTint';

describe('命中火花顏色（hitTint）', () => {
  it('暴擊一律金色', () => {
    expect(hitLook('staff', WEAPONS.staff.skills.heavy_slash, true)).toBe(CRIT_LOOK);
  });
  it('沒有元素的招式看武器：三把武器顏色都不同', () => {
    const c = (['sword', 'bow', 'staff'] as const).map((w) => hitLook(w, undefined, false).color);
    expect(new Set(c).size).toBe(3);
  });
  it('帶狀態的招式用元素色，而且每一招（含兩種變化）都拿得到顏色', () => {
    const seen = new Set<string>();
    for (const w of Object.values(WEAPONS)) {
      for (const table of [w.skills, w.variants, w.variantsB]) {
        for (const def of Object.values(table)) {
          const el = skillElement(def);
          const look = hitLook(w.id, def, false);
          expect(look.color).toBeGreaterThan(0);
          if (el) { seen.add(el); expect(look.color).not.toBe(hitLook(w.id, undefined, false).color); }
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
  it('衝鋒帶減速 → 不是劍的預設白金', () => {
    expect(skillElement(WEAPONS.sword.skills.charge)).toBe('slow');
  });
});

describe('倒下種類（deathFx）', () => {
  it('每隻怪都有種類；菇是植物、史萊姆爆開、魔像碎裂、狼倒地', () => {
    for (const id of Object.keys(ENEMIES)) expect(['beast', 'plant', 'slime', 'stone']).toContain(deathKind(id));
    expect(deathKind('thorn_shooter')).toBe('plant');
    expect(deathKind('slag_slime')).toBe('slime');
    expect(deathKind('crystal_golem')).toBe('stone');
    expect(deathKind('ember_colossus')).toBe('stone');
    expect(deathKind('wolf')).toBe('beast');
    expect(deathKind('wolf_king')).toBe('beast');
  });
  it('表裡列的怪都真的存在（改名時會抓到）', () => {
    for (const id of ['thorn_shooter', 'thorn_mother', 'ember_shroom', 'star_shroom', 'slag_slime', 'crystal_golem', 'ember_colossus', 'star_sentinel']) expect(ENEMIES[id]).toBeTruthy();
  });
});
