import { describe, expect, it } from 'vitest';
import { chapterLabel } from '../src/game/chapters';
import { WORLD_MAPS } from '../src/game/worldMaps';

describe('幕名卡（D-187）', () => {
  it('故事地圖依序是第一～三幕，通關後的挑戰地圖叫番外', () => {
    expect(chapterLabel('mistwood')?.kicker).toBe('第一幕');
    expect(chapterLabel('thornvale')?.kicker).toBe('第二幕');
    expect(chapterLabel('emberrift')?.kicker).toBe('第三幕');
    expect(chapterLabel('starfall')?.kicker).toBe('番　外');
  });
  it('每張大地圖都有名字和一句話；不是大地圖回傳 null', () => {
    for (const m of WORLD_MAPS) {
      const l = chapterLabel(m.id);
      expect(l?.title).toBe(m.name);
      expect(l?.line.length).toBeGreaterThan(4);
    }
    expect(chapterLabel('forest_entry')).toBeNull();
  });
});
