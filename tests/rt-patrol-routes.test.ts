// 第 26 輪：所有大地圖的每條巡邏路線都要真的走得完一圈（validateStage 只檢查巡邏點本身；
// 路線中間卡在窄縫只有實際走一次才抓得到——第 25 輪迷霧巡守第一版就是這樣）。
// 做法：只留玩家和那隻巡邏怪，玩家每 tick 站在牠仇恨範圍外 2 格（不會醒來、也不會睡著），看每個巡邏點都到過。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { makeThornvaleStage } from '../src/core/battle/rt/maps/thornvale';
import { makeEmberriftStage } from '../src/core/battle/rt/maps/emberrift';
import { aggroUnitsOf, sec, UNIT, type StageDefinition } from '../src/core/battle/rt/types';

const MAPS: Record<string, () => StageDefinition> = { mistwood: makeMistwoodStage, thornvale: makeThornvaleStage, emberrift: makeEmberriftStage };

describe('巡邏路線走得完', () => {
  beforeAll(() => {
    for (const [id, mk] of Object.entries(MAPS)) STAGES[id] = mk();
  });
  afterAll(() => {
    for (const id of Object.keys(MAPS)) delete STAGES[id];
  });

  const cases: [string, string, boolean][] = [];
  for (const [id, mk] of Object.entries(MAPS)) for (const g of mk().spawnGroups ?? []) if (g.patrol?.length) cases.push([id, g.id, !!g.nightOnly]);

  it('至少有四條巡邏路線（巡獵者、霧影狼、巡守、熔核巡者）', () => expect(cases.length).toBeGreaterThanOrEqual(4));

  it.each(cases)('%s／%s', (stageId, gid, night) => {
    const s = createBattle({ stageId, seed: 1, night });
    const e = s.units.find((x) => x.groupId === gid && !x.dead)!;
    expect(e).toBeTruthy();
    const path = e.patrol!;
    const p = s.units[0]!;
    const off = (aggroUnitsOf(e) + 2) * UNIT;
    const seen = new Set<number>();
    // 一圈長度 ÷（速度 × 0.5）再給 3 倍餘裕
    let len = 0;
    for (let i = 0; i < path.length; i++) len += Math.hypot(path[(i + 1) % path.length]!.x - path[i]!.x, path[(i + 1) % path.length]!.y - path[i]!.y);
    const limit = sec(Math.max(60, (len / UNIT / 1.5) * 3));
    while (s.tick < limit && seen.size < path.length) {
      s.units = s.units.filter((x) => x === p || x === e);
      p.x = e.x;
      p.y = e.y - off;
      p.hp = p.maxHp;
      step(s, []);
      expect(e.mode).not.toBe('combat');
      path.forEach((pt, i) => {
        if (Math.hypot(e.x - pt.x, e.y - pt.y) <= 0.5 * UNIT) seen.add(i);
      });
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(path.map((_, i) => i));
  });
});
