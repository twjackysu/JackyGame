// 伺服器用的大地圖順序（core maps/world.ts WORLD_ORDER）要和畫面層 worldMaps 的 next 鏈一樣（第 146 輪，D-307）。
import { describe, expect, it } from 'vitest';
import { WORLD_ORDER, WORLD_STAGE_MAKERS } from '../src/core/battle/rt/maps/world';
import { WORLD_MAPS } from '../src/game/worldMaps';

describe('大地圖順序', () => {
  it('WORLD_ORDER＝worldMaps 從第一張沿著 next 走', () => {
    const chain: string[] = [];
    for (let m = WORLD_MAPS[0]; m; m = WORLD_MAPS.find((x) => x.id === m!.next)) chain.push(m.id);
    expect(chain).toEqual([...WORLD_ORDER]);
    expect(Object.keys(WORLD_STAGE_MAKERS).sort()).toEqual([...WORLD_ORDER].sort());
  });
});
