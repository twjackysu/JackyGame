// 大地圖登記表（D-124）：每張圖都通過 validateStage、開放順序串成一條線、共用進度都掛在第一張圖、文字沒有漏填。
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/core/battle/rt/data';
import { validateStage } from '../src/core/battle/rt/maps/validate';
import { LINKED_MAPS, nextGoal } from '../src/game/rtRecord';
import { prevMap, WORLD_MAPS, worldMap } from '../src/game/worldMaps';

describe('大地圖登記表', () => {
  it('每張圖：地圖 id 對得上、驗證沒問題、Boss 巢穴有 Boss、文字欄位都有填', () => {
    for (const m of WORLD_MAPS) {
      const st = m.make();
      expect(st.id).toBe(m.id);
      expect(validateStage(st)).toEqual([]);
      expect(st.bossZone).toBeTruthy();
      const bossIds = [...st.enemies.map((e) => e.enemyId), ...(st.spawnGroups ?? []).map((g) => g.enemyId)].filter((id) => ENEMIES[id]?.boss);
      expect(bossIds.map((id) => ENEMIES[id]!.name)).toContain(m.boss);
      for (const k of ['name', 'bw', 'mw', 'lord', 'firstKill', 'firstGoal'] as const) expect(m[k].length).toBeGreaterThan(0);
    }
  });

  it('開放順序是一條線：第一張沒有前一張、其他每張剛好被一張開放；共用進度掛在第一張', () => {
    expect(prevMap(WORLD_MAPS[0]!.id)).toBeUndefined();
    for (const m of WORLD_MAPS.slice(1)) {
      expect(WORLD_MAPS.filter((x) => x.next === m.id)).toHaveLength(1);
      expect(LINKED_MAPS[m.id]).toBe(WORLD_MAPS[0]!.id);
    }
    for (const m of WORLD_MAPS) if (m.next) expect(worldMap(m.next)).toBeTruthy();
  });

  it('下一個目標的文字跟第 22 輪一樣（換成登記表沒有變；第 26 輪荊棘谷多了「前往燼紅裂谷」）', () => {
    expect(nextGoal('mistwood', {}, 1, 0)).toBe('往北穿過森林，打倒霧角狼王');
    expect(nextGoal('mistwood', { bossKills: 1 }, 1, 0)).toBe('前往荊棘谷，打倒棘冠狼后');
    expect(nextGoal('thornvale', {}, 1, 0)).toBe('沿著山谷往北，打倒棘冠狼后');
    expect(nextGoal('thornvale', { bossKills: 1 }, 1, 0)).toBe('前往燼紅裂谷，打倒燼心岩王');
    expect(nextGoal('thornvale', { bossKills: 1 }, 1, 1)).toContain('開啟狼后暴怒');
    expect(nextGoal('thornvale', { bossKills: 9, furyKills: 1, fury: true }, 20, 1)).toBe('刷深夜的山谷、把裝備強化到 +10、挑戰最快討伐');
  });
});
