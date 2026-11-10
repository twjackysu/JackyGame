// 獨特效果裝備真的掉得出來（P3-a2，D-355）：機率由來源決定（core）、哪一條由 genGear 的種子決定；舊種子、舊存檔不變。
import { describe, expect, it } from 'vitest';
import { EFFECTS } from '../src/core/battle/rt/effects';
import { GEAR_SLOTS, UNIQUE_IDS, UNIQUE_TITLES, gearColor, gearEffects, gearLines, gearScore, gearTierName, genGear, isGear, RARITY_COLOR, type Rarity } from '../src/core/battle/rt/gear';
import { HIDDEN_GROUP, UNIQUE_DROP, rollEnemyLoot, uniqueDropPct, type LootContext } from '../src/core/battle/rt/loot';
import { stageDef } from '../src/core/battle/rt/maps/world';
import { cleanBag } from '../src/game/rtRecord';
import { effectsOf } from '../src/core/meta/bag';
import { createBattle, playerOf, step } from '../src/core/battle/rt/engine';
import { GameClient } from '../src/client/GameClient';
import { LocalTransport } from '../src/net/LocalTransport';
import { GameServer } from '../src/server/GameServer';
import { FakeClock, SeqIds } from '../src/server/clock';
import { openMemoryDb } from '../src/server/db/memory/MemoryDb';

const auth = { resolve: async (t?: string) => t ?? 'anon' };

const bossCtx = (stageId: string, o: Partial<LootContext> = {}): LootContext => {
  const st = stageDef(stageId)!;
  const boss = st.enemies.findIndex((e) => st.gearDrops?.[e.enemyId]?.firstRare);
  return { stageId, defId: st.enemies[boss]!.enemyId, fixedIdx: boss, night: false, fury: false, affix: false, firstKill: false, ...o };
};
function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

describe('獨特效果裝備：產生', () => {
  it('每一條獨特效果都在效果池裡，而且有專屬名字', () => {
    expect(UNIQUE_IDS.length).toBeGreaterThanOrEqual(8);
    for (const id of UNIQUE_IDS) {
      expect(EFFECTS[id], id).toBeTruthy();
      expect(UNIQUE_TITLES[id]!.length).toBeGreaterThan(0);
    }
  });

  it('沒給機率（舊的呼叫方式）結果和以前一模一樣；給了機率也不影響其他欄位', () => {
    for (let seed = 1; seed <= 300; seed++)
      for (const r of [1, 2, 3] as Rarity[]) {
        const a = genGear(seed * 7919, r, 9, { night: seed % 2 === 0, region: 'thornvale' });
        const b = genGear(seed * 7919, r, 9, { night: seed % 2 === 0, region: 'thornvale', uniquePct: 100 });
        expect(a.unique).toBeUndefined();
        expect(b.unique !== undefined).toBe(r === 3);
        expect({ ...b, name: a.name, unique: undefined }).toEqual({ ...a, unique: undefined });
      }
  });

  it('機率照給的數字（15% → 4000 件裡 11～19%）；十條都抽得到；名字帶專屬稱號', () => {
    const seen = new Set<string>();
    let n = 0;
    for (let seed = 1; seed <= 4000; seed++) {
      const g = genGear(seed * 2654435761, 3, 12, { uniquePct: 15 });
      if (!g.unique) continue;
      n++;
      seen.add(g.unique);
      expect(g.name.startsWith(`${UNIQUE_TITLES[g.unique]}之`)).toBe(true);
      expect(isGear(g)).toBe(true);
    }
    expect(n / 4000).toBeGreaterThan(0.11);
    expect(n / 4000).toBeLessThan(0.19);
    expect(seen.size).toBe(UNIQUE_IDS.length);
  });

  it('深夜的獨特：保留第三條詞綴與「夜燼」', () => {
    let hit = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const g = genGear(seed * 97, 3, 12, { night: true, uniquePct: 100 });
      expect(g.affixes.length).toBe(3);
      expect(g.name.startsWith('夜燼・')).toBe(true);
      hit++;
    }
    expect(hit).toBe(50);
  });

  it('顯示：獨特有自己的顏色與階級名、說明多兩行（招式名照武器換）；分數比同一件沒有效果的高', () => {
    const plain = genGear(12345, 3, 10);
    const u = { ...plain, unique: 'guard_pulse' };
    expect(gearColor(u)).not.toBe(RARITY_COLOR[3]);
    expect(gearColor(plain)).toBe(RARITY_COLOR[3]);
    expect(gearTierName(u)).toBe('獨特');
    const lines = gearLines(u, { parry: '測試盾' });
    expect(lines.length).toBe(gearLines(plain).length + 2);
    expect(lines.at(-2)).toContain('震盾');
    expect(lines.at(-1)).toContain('測試盾');
    expect(lines.at(-1)).not.toContain('{');
    expect(gearScore(u, 100, 10)).toBeGreaterThan(gearScore(plain, 100, 10));
  });
});

describe('獨特效果裝備：來源', () => {
  it('只有 Boss 與隱藏精英有機率；暴怒、深夜更高；小怪與一般群組是 0', () => {
    for (const id of ['mistwood', 'thornvale', 'emberrift', 'starfall']) {
      const st = stageDef(id)!;
      const b = bossCtx(id);
      expect(uniqueDropPct(b), id).toBe(UNIQUE_DROP.boss);
      expect(uniqueDropPct({ ...b, fury: true })).toBe(UNIQUE_DROP.fury);
      expect(uniqueDropPct({ ...b, fury: true, night: true })).toBe(UNIQUE_DROP.fury + UNIQUE_DROP.nightPlus);
      const g = st.spawnGroups![0]!;
      expect(uniqueDropPct({ stageId: id, defId: g.enemyId, groupId: g.id, night: true, fury: false })).toBe(0);
      if (st.hiddenElite) expect(uniqueDropPct({ stageId: id, defId: st.hiddenElite.enemyId, groupId: HIDDEN_GROUP, night: false, fury: false })).toBe(UNIQUE_DROP.hidden);
    }
  });

  it('掉落擲骰：Boss 的稀有裝備帶機率、精良與普通不帶；小怪的裝備都不帶', () => {
    const b = bossCtx('mistwood', { fury: true });
    let rare = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let calls = 0;
      const R = rng(seed);
      rollEnemyLoot(b, () => (calls++, R()), (kind, _a, rarity, uq) => {
        if (kind !== 'gear') return;
        if (rarity === 3) {
          rare++;
          expect(uq).toBe(UNIQUE_DROP.fury);
        } else expect(uq).toBeUndefined();
      });
      expect(calls).toBeGreaterThan(0);
    }
    expect(rare).toBeGreaterThan(50);
    const st = stageDef('mistwood')!;
    const g = st.spawnGroups!.find((x) => st.gearDrops?.[x.enemyId])!;
    for (let seed = 1; seed <= 300; seed++) rollEnemyLoot({ stageId: 'mistwood', defId: g.enemyId, groupId: g.id, night: true, fury: false, affix: true, firstKill: false }, rng(seed), (_k, _a, _r, uq) => expect(uq).toBeUndefined());
  });
});

describe('獨特效果裝備：存檔', () => {
  it('舊存檔（沒有 unique 欄位）照樣讀得進來、沒有任何效果', () => {
    const old = { bag: [genGear(1, 3, 5), genGear(2, 1, 3)], equip: { weapon: genGear(3, 3, 8, { slot: 'weapon' }) } };
    const st = cleanBag(JSON.parse(JSON.stringify(old)));
    expect(st.bag.length).toBe(2);
    expect(st.equip.weapon?.uid).toBe(old.equip.weapon.uid);
    expect(effectsOf(st)).toEqual([]);
  });

  it('帶獨特效果的存檔：存了再讀效果還在；被改成不存在的效果 id → 這件當成壞掉的不讀', () => {
    const w = { ...genGear(3, 3, 8, { slot: 'weapon' }), unique: 'storm_caller' };
    const h = { ...genGear(4, 3, 8, { slot: 'head' }), unique: 'storm_caller' };
    const r = { ...genGear(5, 3, 8, { slot: 'ring' }), unique: 'crit_bloom' };
    const st = cleanBag(JSON.parse(JSON.stringify({ bag: [], equip: { weapon: w, head: h, ring: r } })));
    expect(effectsOf(st)).toEqual(['storm_caller', 'crit_bloom']);
    expect(gearEffects(GEAR_SLOTS.map((s) => st.equip[s]))).toEqual(['storm_caller', 'crit_bloom']);
    const bad = cleanBag(JSON.parse(JSON.stringify({ bag: [{ ...w, unique: 'try:heavy_slash:1' }], equip: { ring: { ...r, unique: 'god_mode' } } })));
    expect(bad.bag.length).toBe(0);
    expect(bad.equip.ring).toBeUndefined();
  });
});

describe('獨特效果裝備：引擎與伺服器', () => {
  it('引擎：打倒 Boss 掉的稀有裝備，地上的物品與撿起事件都帶著機率；雜湊快照沒動（另一個測試鎖住）', () => {
    const st = stageDef('mistwood')!;
    const bi = st.enemies.findIndex((e) => e.enemyId === 'wolf_king');
    const s = createBattle({ stageId: 'mistwood', seed: 5, level: 20, bonus: { hp: 99999, atk: 99999, def: 999 } });
    const boss = s.units.find((u) => u.defId === 'wolf_king')!;
    expect(boss.fixedIdx).toBe(bi);
    const p = playerOf(s);
    p.x = boss.x - 60;
    p.y = boss.y;
    let drop: { rarity?: number; uq?: number } | undefined;
    let pick: { rarity?: number; uq?: number } | undefined;
    for (let i = 0; i < 900 && !pick; i++) {
      const from = s.events.length;
      step(s, []);
      for (const e of s.events.slice(from)) {
        if (e.type === 'drop' && e.kind === 'gear' && e.rarity === 3) drop = e;
        if (e.type === 'pickup' && e.kind === 'gear' && e.rarity === 3) pick = e;
      }
    }
    expect(drop?.uq).toBe(UNIQUE_DROP.boss);
    expect(pick?.uq).toBe(UNIQUE_DROP.boss);
  });

  it('伺服器 loot.claim：獨特效果由伺服器的亂數擲出、存進行囊、回給客戶端；小怪掉的不會有', async () => {
    let uniq = 0;
    let rares = 0;
    for (let k = 0; k < 40; k++) {
      const db = await openMemoryDb(() => 0);
      let q = 7 + k * 131;
      const server = new GameServer({ db, auth, clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => ((q = (q * 16807) % 2147483647) / 2147483647) });
      let n = 0;
      const a = new GameClient(new LocalTransport((j) => server.handle(j)), { token: `uq${k}`, timeoutMs: 15000, retries: 1, newRequestId: () => `x${++n}` });
      const A = await a.call('character.create', { name: `測試${k}`, weapon: 'sword' });
      const b = await a.call('battle.start', { characterId: A.id, stageId: 'mistwood' });
      const g = stageDef('mistwood')!.spawnGroups!.find((x) => x.enemyId === 'wolf' && !x.nightOnly)!;
      const w = await a.call('loot.claim', { characterId: A.id, battleId: b.battleId, killSeq: 1, enemyId: 'wolf', groupId: g.id });
      for (const d of w.drops) expect(d.unique).toBeUndefined();
      const r = await a.call('loot.claim', { characterId: A.id, battleId: b.battleId, killSeq: 2, enemyId: 'wolf_king', fixedIdx: stageDef('mistwood')!.enemies.findIndex((e) => e.enemyId === 'wolf_king') });
      for (const d of r.drops) {
        if (d.kind !== 'gear') continue;
        if (d.rarity === 3) rares++;
        const it = r.character.items.find((x) => x.id === d.itemId);
        const gear = it?.gear as { unique?: string; rarity: number } | undefined;
        expect(gear?.unique).toBe(d.unique);
        if (d.unique) {
          uniq++;
          expect(d.rarity).toBe(3);
          expect(UNIQUE_IDS).toContain(d.unique);
        }
      }
    }
    expect(rares).toBeGreaterThanOrEqual(40); // 第一次打倒保底稀有
    expect(uniq).toBeGreaterThan(0);
    expect(uniq).toBeLessThan(rares / 2);
  });
});
