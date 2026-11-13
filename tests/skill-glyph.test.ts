import { describe, expect, it } from 'vitest';
import { BOW_SKILLS, BOW_VARIANTS, BOW_VARIANTS_B, SKILLS, SKILL_VARIANTS, SKILL_VARIANTS_B, STAFF_SKILLS, STAFF_VARIANTS, STAFF_VARIANTS_B } from '../src/core/battle/rt/data';
import { COMPACT_ICON, compactLabel, glyphColor, glyphPips, skillGlyph } from '../src/game/fx/skillGlyph';
import { skillBadge } from '../src/game/fx/hitTint';

const SLOTS = ['heavy_slash', 'whirlwind', 'charge', 'parry', 'blade_storm'] as const;
const SETS = { sword: [SKILLS, SKILL_VARIANTS, SKILL_VARIANTS_B], bow: [BOW_SKILLS, BOW_VARIANTS, BOW_VARIANTS_B], staff: [STAFF_SKILLS, STAFF_VARIANTS, STAFF_VARIANTS_B] };

describe('底部自動技能小圖示的記號（第 195 輪）', () => {
  it('照招式資料分：護盾招＝盾、大招＝星、直線＝箭、扇形＝月牙、落在前方＝墜落、身邊一圈＝漩渦', () => {
    expect(skillGlyph(SKILLS.heavy_slash)).toBe('slash');
    expect(skillGlyph(SKILLS.whirlwind)).toBe('spin');
    expect(skillGlyph(BOW_SKILLS.heavy_slash)).toBe('bolt');
    expect(skillGlyph(STAFF_SKILLS.charge)).toBe('drop');
    expect(skillGlyph(undefined)).toBe('slash');
    for (const sets of Object.values(SETS)) for (const set of sets) {
      expect(skillGlyph(set.parry)).toBe('shield');
      expect(skillGlyph(set.blade_storm)).toBe('burst');
    }
  });
  it('換了變化打法記號會跟著換（重斬＝月牙、裂地斬＝直線）', () => {
    expect(skillGlyph(SKILL_VARIANTS.heavy_slash)).not.toBe(skillGlyph(SKILLS.heavy_slash));
  });
  it('同一排五顆不會長得一樣：記號＋顏色＋段數至少有一樣不同（三把武器 × 每欄三種打法的所有組合）', () => {
    for (const [w, sets] of Object.entries(SETS)) {
      const looks = SLOTS.map((slot) => sets.map((set) => `${skillGlyph(set[slot])}/${skillBadge(slot, set[slot]).rim}/${glyphPips(set[slot])}`));
      for (let a = 0; a < SLOTS.length; a++) for (let b = a + 1; b < SLOTS.length; b++) for (const la of looks[a]!) for (const lb of looks[b]!) expect(la, `${w} ${SLOTS[a]} vs ${SLOTS[b]}`).not.toBe(lb);
    }
  });
  it('短冷卻不寫秒數（看扇形），還要等很久才寫；轉好了不寫字', () => {
    expect(compactLabel(0, '')).toBe('');
    expect(compactLabel(120, '4')).toBe('');
    expect(compactLabel(COMPACT_ICON.longTicks + 1, '13')).toBe('13');
  });
  it('記號比外框亮、留著色相；冷卻中仍看得到（記號不比扇形暗）', () => {
    const c = glyphColor(0x40c890);
    expect((c >> 8) & 255).toBeGreaterThan((c >> 16) & 255);
    expect((c >> 16) & 255).toBeGreaterThan(0x40);
    expect(COMPACT_ICON.dimA).toBeGreaterThan(COMPACT_ICON.sweepA);
  });
});
