// 光門（D-186）：有下一張地圖的大地圖，巢穴中心往北 55% 半徑那一點要是空地（場景 setupGate 用這個位置）
import { describe, expect, it } from 'vitest';
import { isSolidAt } from '../src/core/battle/rt/engine';
import { WORLD_MAPS } from '../src/game/worldMaps';

describe('往下一張地圖的光門位置', () => {
  for (const m of WORLD_MAPS.filter((w) => w.next)) {
    it(`${m.name} → ${m.next}`, () => {
      const st = m.make();
      const bz = st.bossZone!;
      const sol = st.arena.solid!;
      const y = bz.y - bz.r * 0.55;
      expect(isSolidAt(sol, bz.x, y)).toBe(false);
      expect(WORLD_MAPS.some((w) => w.id === m.next)).toBe(true);
    });
  }
});
