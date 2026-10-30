import { describe, expect, it } from 'vitest';
import { nightIntro, returnIntro } from '../src/game/rtRecord';
import { WORLD_MAPS } from '../src/game/worldMaps';

describe('老玩家的開場大字（第 44 輪）', () => {
  it('還沒打倒 Boss → null（照舊播地圖的教學 intro）', () => {
    for (const m of WORLD_MAPS) expect(returnIntro(m.id, {}, 1, 0)).toBeNull();
  });

  it('不是大地圖 → null', () => {
    expect(returnIntro('wolf_king', { bossKills: 3 }, 10, 0)).toBeNull();
  });

  it('各種進度：第一行歡迎回來、第二行起是目標，每行不超過 22 字', () => {
    const recs = [
      { bossKills: 1 },
      { bossKills: 1, level: 3 },
      { bossKills: 5, level: 15 },
      { bossKills: 5, level: 15, furyKills: 2 },
    ];
    for (const m of WORLD_MAPS) {
      for (const r of recs) {
        for (const other of [0, 1]) {
          const t = returnIntro(m.id, r, r.level ?? 1, other)!;
          const lines = t.split('\n');
          expect(lines[0]).toBe(`歡迎回到${m.name}！`);
          expect(lines[1]!.startsWith('▶ ')).toBe(true);
          expect(lines.length).toBeLessThanOrEqual(4);
          for (const l of lines) expect([...l].length, l).toBeLessThanOrEqual(22);
          expect(lines.some((l) => /[、，]$/.test(l))).toBe(false);
        }
      }
    }
  });

  it('切到深夜重新進入（第 59 輪）：第一行換成深夜，目標照舊，每行不超過 22 字', () => {
    for (const m of WORLD_MAPS) {
      const back = returnIntro(m.id, { bossKills: 1, furyKills: 1, night: true }, 12, 0)!;
      const n = nightIntro(back, m.name).split('\n');
      expect(n[0]).toBe(`深夜的${m.name}・怪更兇、掉得更好`);
      expect(n.slice(1)).toEqual(back.split('\n').slice(1));
      for (const l of n) expect([...l].length).toBeLessThanOrEqual(22);
    }
  });
});
