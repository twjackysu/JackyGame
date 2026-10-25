// 關卡資料檢查（畫新地圖時用，例如之後的霧語森林 ASCII）：尺寸、出生點／營火／重生點不在石頭上、
// 從玩家起點走得到、重生點不在營火安全圈內、地區（zones）在場地內。回傳問題清單，空陣列＝沒問題。
import { ENEMIES } from '../data';
import { cellIndex, flowField, gridOf } from '../path';
import type { StageDefinition } from '../types';
import { CAMPFIRE_RULES, UNIT } from '../types';

export function validateStage(def: StageDefinition): string[] {
  const out: string[] = [];
  const a = def.arena;
  const inArena = (x: number, y: number): boolean => x >= 0 && y >= 0 && x <= a.w && y <= a.h;
  const sol = a.solid;
  if (sol) {
    const rows = Math.ceil(a.h / sol.cell);
    const cols = Math.ceil(a.w / sol.cell);
    if (sol.rows.length !== rows) out.push(`solid 列數 ${sol.rows.length}，應為 ${rows}`);
    sol.rows.forEach((r, i) => {
      if (r.length !== cols) out.push(`solid 第 ${i} 列長度 ${r.length}，應為 ${cols}`);
      if (/[^.#]/.test(r)) out.push(`solid 第 ${i} 列有 . # 以外的字元`);
    });
  }
  const grid = gridOf(a);
  const isSolid = (x: number, y: number): boolean => !!sol && sol.rows[Math.floor(y / sol.cell)]?.[Math.floor(x / sol.cell)] === '#';
  const field = grid ? flowField(grid, cellIndex(grid, def.player.x, def.player.y)) : null;
  const check = (what: string, x: number, y: number): void => {
    if (!inArena(x, y)) return void out.push(`${what} 在場地外 (${x}, ${y})`);
    if (isSolid(x, y)) return void out.push(`${what} 在石頭上 (${x}, ${y})`);
    if (grid && field && field[cellIndex(grid, x, y)]! < 0) out.push(`${what} 從玩家起點走不到 (${x}, ${y})`);
  };
  check('玩家起點', def.player.x, def.player.y);
  def.enemies.forEach((e, i) => {
    if (!ENEMIES[e.enemyId]) out.push(`敵人 #${i} 的 enemyId「${e.enemyId}」不存在`);
    check(`敵人 #${i}（${e.enemyId}）`, e.x, e.y);
  });
  const needMap = (what: string): void => {
    if (!def.mapAi) out.push(`${what} 需要 mapAi`);
  };
  if (def.campfires?.length) needMap('campfires');
  if (def.spawnGroups?.length) needMap('spawnGroups');
  if (def.bossZone) needMap('bossZone');
  if (def.reviveAtCampfire && !def.campfires?.length) out.push('reviveAtCampfire 但沒有營火');
  for (const c of def.campfires ?? []) check(`營火 ${c.id}`, c.x, c.y);
  if (def.riot) {
    needMap('riot');
    if (!ENEMIES[def.riot.enemyId]) out.push(`riot 的 enemyId「${def.riot.enemyId}」不存在`);
    if (def.riot.eliteId && !ENEMIES[def.riot.eliteId]) out.push(`riot 的 eliteId「${def.riot.eliteId}」不存在`);
  }
  if (def.hiddenElite) {
    needMap('hiddenElite');
    if (!ENEMIES[def.hiddenElite.enemyId]) out.push(`hiddenElite 的 enemyId「${def.hiddenElite.enemyId}」不存在`);
  }
  if (def.chests?.length && !def.loot) out.push('chests 需要 loot');
  const chestIds = new Set<string>();
  for (const c of def.chests ?? []) {
    if (chestIds.has(c.id)) out.push(`寶箱 id 重複：${c.id}`);
    chestIds.add(c.id);
    check(`寶箱 ${c.id}`, c.x, c.y);
  }
  const ids = new Set<string>();
  for (const g of def.spawnGroups ?? []) {
    if (ids.has(g.id)) out.push(`重生點 id 重複：${g.id}`);
    ids.add(g.id);
    if (!ENEMIES[g.enemyId]) out.push(`重生點 ${g.id} 的 enemyId「${g.enemyId}」不存在`);
    check(`重生點 ${g.id}`, g.cx, g.cy);
    (g.patrol ?? []).forEach((pt, i) => {
      check(`重生點 ${g.id} 巡邏點 #${i}`, pt.x, pt.y);
      for (const c of def.campfires ?? []) if (Math.hypot(pt.x - c.x, pt.y - c.y) < CAMPFIRE_RULES.safeUnits * UNIT + UNIT) out.push(`重生點 ${g.id} 巡邏點 #${i} 太靠近營火 ${c.id}`);
    });
    for (const c of def.campfires ?? []) {
      if (Math.hypot(g.cx - c.x, g.cy - c.y) < CAMPFIRE_RULES.safeUnits * UNIT + g.spawnRadius) out.push(`重生點 ${g.id} 和營火 ${c.id} 的安全圈重疊`);
    }
    if (sol && grid) {
      // 半徑內至少要有 maxAlive 格空地
      let free = 0;
      const c = sol.cell;
      for (let y = Math.floor((g.cy - g.spawnRadius) / c); y <= Math.floor((g.cy + g.spawnRadius) / c); y++) {
        for (let x = Math.floor((g.cx - g.spawnRadius) / c); x <= Math.floor((g.cx + g.spawnRadius) / c); x++) {
          if (x < 0 || y < 0 || x >= grid.w || y >= grid.h || grid.walk[y * grid.w + x] === 0) continue;
          if (Math.hypot(x * c + c / 2 - g.cx, y * c + c / 2 - g.cy) <= g.spawnRadius + c / 2) free++;
        }
      }
      if (free < g.maxAlive) out.push(`重生點 ${g.id} 半徑內只有 ${free} 格空地，少於 maxAlive ${g.maxAlive}`);
    }
  }
  if (def.zones?.length) {
    def.zones.forEach((z, i) => {
      if (z.x0 >= z.x1 || z.y0 >= z.y1) out.push(`地區 #${i}（${z.name}）範圍是空的`);
      if (!inArena(z.x0, z.y0) || !inArena(z.x1, z.y1)) out.push(`地區 #${i}（${z.name}）超出場地`);
    });
    const inZone = (x: number, y: number): boolean => def.zones!.some((z) => x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1);
    if (!inZone(def.player.x, def.player.y)) out.push('玩家起點不在任何地區內');
  }
  // 地形危害（D-114）：中心走得到、不蓋到營火休息圈與玩家起點
  (def.hazards ?? []).forEach((h, i) => {
    check(`危害 #${i}`, h.x, h.y);
    if (h.r <= 0 || h.pct <= 0 || (h.nightR !== undefined && h.nightR < h.r)) out.push(`危害 #${i} 的半徑或傷害不是正數（或深夜半徑比白天小）`);
    const r = Math.max(h.r, h.nightR ?? 0);
    for (const c of def.campfires ?? []) if (Math.hypot(c.x - h.x, c.y - h.y) < r + CAMPFIRE_RULES.safeUnits * UNIT) out.push(`危害 #${i} 太靠近營火 ${c.id}`);
    if (Math.hypot(def.player.x - h.x, def.player.y - h.y) < r + 2 * UNIT) out.push(`危害 #${i} 太靠近玩家起點`);
  });
  // 噴發口（D-125）：中心走得到、預告比週期短、不蓋到營火休息圈與玩家起點
  (def.vents ?? []).forEach((v, i) => {
    check(`噴發口 #${i}`, v.x, v.y);
    if (v.r <= 0 || v.pct <= 0 || v.warnTicks <= 0 || v.warnTicks >= Math.min(v.everyTicks, v.nightEveryTicks ?? v.everyTicks)) out.push(`噴發口 #${i} 的半徑／傷害／預告時間不合理`);
    for (const c of def.campfires ?? []) if (Math.hypot(c.x - v.x, c.y - v.y) < v.r + CAMPFIRE_RULES.safeUnits * UNIT) out.push(`噴發口 #${i} 太靠近營火 ${c.id}`);
    if (Math.hypot(def.player.x - v.x, def.player.y - v.y) < v.r + 2 * UNIT) out.push(`噴發口 #${i} 太靠近玩家起點`);
  });
  return out;
}
