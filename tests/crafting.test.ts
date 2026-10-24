// design/14 階段 2.5（重鑄）、2.6（分解與材料）
import { describe, expect, it } from 'vitest';
import { LocalGameApi } from '../src/server/localGameApi';
import { KvEventJournal, fixedClock } from '../src/core/save/localPorts';
import { MemoryKV } from '../src/core/save/save';
import { newGame } from '../src/core/state/gameState';
import { createInstance } from '../src/core/state/gear';
import { equip, sell } from '../src/core/state/equip';
import { affixesLegal, rollAffixes } from '../src/server/loot';
import { randomFromRng } from '../src/server/ports';
import { mulberry32 } from '../src/core/rng';
import { tierOf } from '../src/server/crafting';
import { rerollCost } from '../src/data/enhancement';
import { MATERIAL_IDS } from '../src/data/materials';

function setup(seed = 1) {
  const s = newGame(0, seed);
  const api = new LocalGameApi(() => s, new KvEventJournal(new MemoryKV()), fixedClock());
  s.gold = 100000;
  for (const m of MATERIAL_IDS) s.inventory[m] = 100;
  return { s, api };
}
function epicBlade(s: ReturnType<typeof setup>['s']) {
  const g = createInstance(s, 'lantern_brass', 'drop');
  g.tier = 'epic';
  g.affixes = rollAffixes('weapon', 'epic', randomFromRng(mulberry32(5)));
  return g;
}

describe('重鑄', () => {
  it('鎖 1 條：保留該條、其他重抽；保留舊詞綴時裝備不倒退', () => {
    const { s, api } = setup();
    const g = epicBlade(s);
    const before = g.affixes.map((a) => ({ ...a }));
    const r = api.reroll('r1', { instanceId: g.instanceId, locks: [1] });
    expect(r.ok).toBe(true);
    expect(r.data!.candidate[0]).toEqual(before[1]);
    expect(affixesLegal('weapon', 'epic', r.data!.candidate)).toBe(true);
    expect(g.affixes).toEqual(before); // 還沒決定前不變
    expect(api.reroll('r2', { instanceId: g.instanceId, locks: [] }).error).toBe('pending');
    expect(api.settleReroll('k1', { instanceId: g.instanceId, accept: false }).ok).toBe(true);
    expect(g.affixes).toEqual(before);
    api.reroll('r3', { instanceId: g.instanceId, locks: [] });
    const cand = g.pendingAffixes!;
    api.settleReroll('k2', { instanceId: g.instanceId, accept: true });
    expect(g.affixes).toEqual(cand);
  });

  it('成本：鎖越多越貴、次數越多越貴（有上限）；扣款正確', () => {
    expect(rerollCost(0, 0)).toEqual({ gold: 100, mat_crystal: 1 });
    expect(rerollCost(0, 2)).toEqual({ gold: 100, mat_crystal: 3, mat_legend: 2 });
    expect(rerollCost(4, 0).gold).toBe(200);
    expect(rerollCost(99, 0).gold).toBe(rerollCost(8, 0).gold);
    const { s, api } = setup();
    const g = epicBlade(s);
    api.reroll('a', { instanceId: g.instanceId, locks: [0, 2] });
    expect(s.gold).toBe(100000 - 100);
    expect(s.inventory.mat_legend).toBe(98);
    expect(g.rerolls).toBe(1);
  });

  it('不合法的鎖定、沒有詞綴的裝備、材料不夠', () => {
    const { s, api } = setup();
    const g = epicBlade(s);
    expect(api.reroll('a', { instanceId: g.instanceId, locks: [0, 1, 2] }).error).toBe('bad_locks');
    expect(api.reroll('b', { instanceId: g.instanceId, locks: [0, 0] }).error).toBe('bad_locks');
    const plain = createInstance(s, 'lantern_tin', 'shop');
    expect(api.reroll('c', { instanceId: plain.instanceId, locks: [] }).error).toBe('no_affixes');
    s.inventory = {};
    expect(api.reroll('d', { instanceId: g.instanceId, locks: [] }).error).toBe('not_enough_materials');
  });
});

describe('分解與材料', () => {
  it('分解給材料（強化過多給粉塵）；身上穿的、上鎖的、劇情鑰匙不能分解', () => {
    const { s, api } = setup();
    s.inventory = {};
    const a = createInstance(s, 'lantern_tin', 'shop');
    a.enhancement = 3;
    const worn = createInstance(s, 'armor_leather', 'shop');
    equip(s, 'lian', worn.instanceId);
    const key = createInstance(s, 'old_lantern', 'story');
    const locked = createInstance(s, 'ring_swift', 'shop');
    api.setLock('l', { instanceId: locked.instanceId, locked: true });
    const r = api.salvage('s1', { instanceIds: [a.instanceId, worn.instanceId, key.instanceId, locked.instanceId] });
    expect(r.data).toEqual({ salvaged: 1, materials: { mat_dust: 1 + 3 } });
    expect(s.inventory.mat_dust).toBe(4);
    expect(s.gear[a.instanceId]).toBeUndefined();
    expect(s.gear[worn.instanceId] && s.gear[key.instanceId] && s.gear[locked.instanceId]).toBeTruthy();
    expect(sell(s, 'ring_swift')).toBe(false); // 上鎖的不能賣
  });

  it('一鍵分解不動傳說以上；明確指定才分解神級', () => {
    const { s, api } = setup();
    const god = createInstance(s, 'first_lamp', 'drop');
    expect(tierOf(god)).toBe('divine');
    const rare = createInstance(s, 'wolf_fang_charm', 'drop');
    const r = api.salvage('q', { instanceIds: [god.instanceId, rare.instanceId], quick: true });
    expect(r.data!.salvaged).toBe(1);
    expect(s.gear[god.instanceId]).toBeDefined();
    expect(api.salvage('x', { instanceIds: [god.instanceId] }).data!.materials.mat_legend).toBeGreaterThan(0);
  });
});
