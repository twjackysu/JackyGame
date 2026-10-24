import { describe, expect, it } from 'vitest';
import { autoLearn, autoOutfit } from '../src/core/state/autoBuild';
import { shopStock } from '../src/core/state/equip';
import { newGame } from '../src/core/state/gameState';
import { pointsLeft } from '../src/core/state/skillTree';

describe('自動配裝／點技能（機器人用）', () => {
  it('買得起就買更好的，留下保底金；點數用完', () => {
    const s = newGame();
    s.members.lian!.level = 6;
    s.gold = 300;
    const n = autoOutfit(s, shopStock('ch1_general'));
    expect(n).toBeGreaterThan(0);
    expect(s.gold).toBeGreaterThanOrEqual(60);
    expect(s.members.lian!.equipment.weapon).toBeDefined();
    expect(autoLearn(s)).toBe(5);
    expect(pointsLeft(s, 'lian')).toBe(0);
    expect(autoOutfit(s, shopStock('ch1_general'))).toBe(0);
  });
});
