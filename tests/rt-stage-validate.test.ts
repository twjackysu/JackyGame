import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/battle/rt/data';
import { makeTestWorldStage } from '../src/core/battle/rt/maps/testWorld';
import { validateStage } from '../src/core/battle/rt/maps/validate';
import { u } from '../src/core/battle/rt/types';

describe('關卡資料檢查 validateStage', () => {
  it('現有七關＋48×96 測試大地圖都沒有問題', () => {
    for (const def of [...Object.values(STAGES), makeTestWorldStage()]) expect(validateStage(def), def.id).toEqual([]);
  });

  it('抓得到常見錯誤：列長不對、營火在石頭上、重生點在營火圈內、走不到、enemyId 打錯', () => {
    const base = makeTestWorldStage();
    const rows = [...base.arena.solid!.rows];
    rows[3] = rows[3]!.slice(1); // 列長少一格
    // 用一圈石頭把 (40, 10) 圍起來 → 走不到
    for (let y = 8; y <= 12; y++) {
      const r = rows[y]!.split('');
      for (let x = 38; x <= 42; x++) if (y === 8 || y === 12 || x === 38 || x === 42) r[x] = '#';
      for (let x = 39; x <= 41; x++) if (y > 8 && y < 12) r[x] = '.';
      rows[y] = r.join('');
    }
    const bad = {
      ...base,
      arena: { ...base.arena, solid: { cell: u(1), rows } },
      campfires: [...base.campfires!, { id: 'rock', x: u(40) + 50, y: u(8) + 50 }],
      spawnGroups: [
        ...base.spawnGroups!,
        { id: 'too_close', enemyId: 'wolf', cx: u(24), cy: u(86), spawnRadius: u(1), maxAlive: 1, respawnTicks: 900 },
        { id: 'boxed', enemyId: 'wolf', cx: u(40) + 50, cy: u(10) + 50, spawnRadius: u(1), maxAlive: 1, respawnTicks: 900 },
        { id: 'typo', enemyId: 'wolff', cx: u(10), cy: u(60) + 50, spawnRadius: u(1), maxAlive: 1, respawnTicks: 900 },
      ],
    };
    const issues = validateStage(bad).join('\n');
    expect(issues).toMatch(/第 3 列長度/);
    expect(issues).toMatch(/營火 rock 在石頭上/);
    expect(issues).toMatch(/重生點 too_close 和營火 south 的安全圈重疊/);
    expect(issues).toMatch(/重生點 boxed 從玩家起點走不到/);
    expect(issues).toMatch(/wolff/);
  });
});
