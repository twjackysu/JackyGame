// 前世的記憶（D-137）：每個記憶點都在走得到的地面上、不在 Boss 巢穴裡、離營火有點距離；想起來的獎勵。
import { describe, expect, it } from 'vitest';
import { MEMORIES, MEMORY_REWARD, memoriesOf, recall } from '../src/game/memories';
import { WORLD_MAPS } from '../src/game/worldMaps';

describe('前世的記憶', () => {
  it('每張大地圖三個；都在空地上、從起點走得到、不在 Boss 巢穴裡', () => {
    for (const m of WORLD_MAPS) {
      const list = memoriesOf(m.id);
      expect(list.length).toBe(3);
      const st = m.make();
      const rows = st.arena.solid!.rows;
      const cell = st.arena.solid!.cell;
      // 從玩家起點 BFS
      const seen = new Set<string>();
      const q: [number, number][] = [[Math.floor(st.player.x / cell), Math.floor(st.player.y / cell)]];
      seen.add(q[0]!.join(','));
      while (q.length) {
        const [x, y] = q.shift()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          const k = `${nx},${ny}`;
          if (seen.has(k) || rows[ny]?.[nx] !== '.') continue;
          seen.add(k);
          q.push([nx, ny]);
        }
      }
      for (const mem of list) {
        expect(rows[mem.ty]?.[mem.tx], mem.id).toBe('.');
        expect(seen.has(`${mem.tx},${mem.ty}`), `${mem.id} 走得到`).toBe(true);
        const bz = st.bossZone!;
        expect(Math.hypot(mem.tx * cell + 50 - bz.x, mem.ty * cell + 50 - bz.y), `${mem.id} 不在巢穴`).toBeGreaterThan(bz.r);
        for (const f of st.campfires ?? []) expect(Math.hypot(mem.tx * cell + 50 - f.x, mem.ty * cell + 50 - f.y) / cell, `${mem.id} 離營火`).toBeGreaterThan(5);
      }
    }
    expect(new Set(MEMORIES.map((m) => m.id)).size).toBe(MEMORIES.length);
    for (const m of MEMORIES) for (const ln of m.lines.split('\n')) expect(ln.length, ln).toBeLessThanOrEqual(19);
  });
  it('想起來：每個 1 顆結晶、最後一個多 5 顆、重複不給', () => {
    let have: string[] = [];
    let total = 0;
    for (const m of MEMORIES) {
      const r = recall(have, m.id)!;
      expect(r).toBeTruthy();
      have = r.ids;
      total += r.crystal;
      expect(r.all).toBe(have.length === MEMORIES.length);
    }
    expect(total).toBe(MEMORIES.length * MEMORY_REWARD.each + MEMORY_REWARD.all);
    expect(recall(have, MEMORIES[0]!.id)).toBeNull();
    expect(recall([], 'nope')).toBeNull();
  });
});
