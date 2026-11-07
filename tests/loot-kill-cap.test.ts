// 數量上限（第 148 輪，26-security §3.1）不能擋到正常玩家：Bot 在四張大地圖（白天／深夜）實際打，
// 每打倒一隻會掉東西的怪就照 loot.claim 的規則檢查 killCap（用遊戲時間、不加寬限＝比伺服器更嚴），一隻都不能超過。
import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { hasLoot, killCap, killSource, type LootContext } from '../src/core/battle/rt/loot';
import { stageDef, WORLD_ORDER } from '../src/core/battle/rt/maps/world';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec, type Unit } from '../src/core/battle/rt/types';

const MIN = 8;

function run(stageId: string, night: boolean, seed: number, boss: boolean): { claims: number; worst: string; over: string[] } {
  const st = stageDef(stageId)!;
  const lv = st.progression?.maxLevel ?? 1;
  const bossAt = st.bossZone ? { x: st.bossZone.x, y: st.bossZone.y } : undefined;
  const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 50, campfireBelowPotions: 6, ...(boss && bossAt ? { advanceTo: bossAt } : {}) }, 'normal');
  const s = createBattle({ stageId, seed, level: lv, night, bonus: { hp: 4000, atk: 400, def: 60 } });
  const kills: Record<string, number> = {};
  let claims = 0;
  let hidden = 0;
  const over: string[] = [];
  let worst = '';
  let worstPct = 0;
  let ev = 0;
  const byId = new Map<number, Unit>();
  while (s.tick < sec(MIN * 60) && s.outcome === 'running') {
    for (const u of s.units) byId.set(u.id, u);
    step(s, bot.decide(s));
    for (; ev < s.events.length; ev++) {
      const e = s.events[ev]!;
      if (e.type !== 'death') continue;
      const u = byId.get(e.id) ?? s.units.find((x) => x.id === e.id);
      if (!u || u.side !== 'enemy' || u.summonedBy || !hasLoot(u.defId)) continue;
      const lc: LootContext = { stageId, defId: u.defId, night, fury: !!u.fury, affix: !!u.affix, firstKill: false };
      if (u.groupId) lc.groupId = u.groupId;
      if (u.fixedIdx !== undefined) lc.fixedIdx = u.fixedIdx;
      const src = killSource(lc);
      const cap = killCap(lc, e.tick, claims - hidden);
      const n = (kills[src] ?? 0) + 1;
      if (n > cap) over.push(`${src} 第 ${n} 隻 @${Math.round(e.tick / 30)}s 上限 ${cap}`);
      if (cap > 0 && n / cap > worstPct) {
        worstPct = n / cap;
        worst = `${src} ${n}/${cap}`;
      }
      kills[src] = n;
      claims++;
      if (src === 'hidden') hidden++;
    }
    if (s.events.length > 4000) {
      s.events.splice(0, ev);
      ev = 0;
    }
  }
  worst += ` 特殊 ${Object.keys(kills).filter((k) => !k.startsWith('g:')).map((k) => `${k}×${kills[k]}`).join(',')}`;
  return { claims, worst, over };
}

describe('數量上限不會擋到正常玩家（Bot 實打）', () => {
  for (const id of WORLD_ORDER)
    for (const night of [false, true]) {
      if (night && !stageDef(id)?.night) continue;
      it(`${id}${night ? '（深夜）' : ''}：刷怪與打 Boss 各 ${MIN} 分鐘`, () => {
        for (const boss of [false, true]) {
          const r = run(id, night, boss ? 11 : 5, boss);
          (globalThis as unknown as { process: { stdout: { write: (x: string) => void } } }).process.stdout.write(`[kill-cap] ${id}${night ? ' 深夜' : ''}${boss ? ' Boss' : ' 刷怪'}：${r.claims} 次申請，最接近上限 ${r.worst}\n`);
          expect(r.over).toEqual([]);
          expect(r.claims).toBeGreaterThan(5);
        }
      }, 240000);
    }

  it('會算進隱藏精英連殺的普通怪都會掉東西（客戶端只回報 hasLoot 的，伺服器的「其他擊殺」才不會少算）', () => {
    for (const id of WORLD_ORDER) {
      const st = stageDef(id)!;
      if (!st.hiddenElite) continue;
      for (const g of st.spawnGroups ?? []) expect(hasLoot(g.enemyId), `${id}/${g.id}`).toBe(true);
      if (st.riot) expect(hasLoot(st.riot.enemyId)).toBe(true);
    }
  });
});
