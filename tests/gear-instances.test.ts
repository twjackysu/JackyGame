// design/14 階段 1.2：裝備實例化＋存檔 v1→v2 migration
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, newGame, newGamePlus } from '../src/core/state/gameState';
import { addItem, bagCount, bagIds, createInstance, makeUlid } from '../src/core/state/gear';
import { buy, equip, gearBonus, sell, unequip, wornTemplate } from '../src/core/state/equip';
import { MemoryKV, SaveStore, AUTO_KEY, deserialize, preMigrationKey, serialize } from '../src/core/save/save';

/** 第 10 輪時的 v1 存檔樣子：裝備是 inventory 數量、身上是模板 id */
function v1Save(): Record<string, unknown> {
  const s = newGame(1_700_000_000_000, 77) as unknown as Record<string, unknown>;
  delete s.gear;
  delete s.rng;
  s.version = 1;
  s.inventory = { potion_s: 3, lantern_tin: 2, armor_leather: 1, gift_flower: 1 };
  s.members = {
    lian: { id: 'lian', level: 6, xp: 0, hp: 100, equipment: { weapon: 'lantern_brass', charm: 'ring_swift' } },
    io: { id: 'io', level: 6, xp: 0, hp: 80, equipment: { armor: 'armor_cloth' } },
  };
  s.party = ['lian', 'io'];
  return s;
}

describe('裝備實例', () => {
  it('ULID 格式：26 字元 Crockford Base32，時間在前可排序', () => {
    let n = 1;
    const r = () => (n = (n * 1103515245 + 12345) >>> 0);
    const a = makeUlid(1000, r);
    const b = makeUlid(2000, r);
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a < b).toBe(true);
  });

  it('買兩件同模板 → 兩個不同實例；賣一件剩一件', () => {
    const s = newGame(0, 1);
    s.gold = 1000;
    expect(buy(s, 'lantern_tin')).toBe(true);
    expect(buy(s, 'lantern_tin')).toBe(true);
    const ids = Object.keys(s.gear);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(Object.values(s.gear).every((g) => g.originMode === 'shop' && g.enhancement === 0)).toBe(true);
    expect(s.inventory.lantern_tin).toBeUndefined();
    expect(bagCount(s, 'lantern_tin')).toBe(2);
    expect(sell(s, 'lantern_tin')).toBe(true);
    expect(bagCount(s, 'lantern_tin')).toBe(1);
  });

  it('身上穿的不算在背包、不能被賣掉', () => {
    const s = newGame(0, 2);
    addItem(s, 'lantern_tin', 1);
    expect(equip(s, 'lian', 'lantern_tin')).toBe(true);
    expect(bagCount(s, 'lantern_tin')).toBe(0);
    expect(bagIds(s)).not.toContain('lantern_tin');
    expect(sell(s, 'lantern_tin')).toBe(false);
    expect(wornTemplate(s, 'lian', 'weapon')).toBe('lantern_tin');
    const instId = s.members.lian!.equipment.weapon!;
    expect(s.gear[instId]?.templateId).toBe('lantern_tin');
    expect(unequip(s, 'lian', 'weapon')).toBe(true);
    expect(bagCount(s, 'lantern_tin')).toBe(1);
  });

  it('可以指定 instanceId 裝備；別人身上的實例不能直接搶', () => {
    const s = newGame(0, 3);
    s.members.io = { id: 'io', level: 3, xp: 0, hp: 60, equipment: {} };
    const a = createInstance(s, 'ring_swift', 'drop');
    expect(equip(s, 'io', a.instanceId)).toBe(true);
    expect(equip(s, 'lian', a.instanceId)).toBe(false);
    expect(wornTemplate(s, 'lian', 'charm1')).toBeUndefined();
  });

  it('同種子同操作序列 → 同樣的 instanceId', () => {
    const run = () => {
      const s = newGame(5, 99);
      s.gold = 999;
      buy(s, 'lantern_tin');
      addItem(s, 'armor_leather', 2, 'drop');
      return Object.keys(s.gear).sort();
    };
    expect(run()).toEqual(run());
  });

  it('二週目：稀有以上的實例原樣帶過去（含強化等之後的欄位），普通的不帶', () => {
    const s = newGame(0, 4);
    const fang = createInstance(s, 'moon_fang', 'drop');
    fang.enhancement = 3;
    createInstance(s, 'lantern_tin', 'shop');
    equip(s, 'lian', createInstance(s, 'first_lamp', 'drop').instanceId);
    const n = newGamePlus(s);
    expect(n.gear[fang.instanceId]?.enhancement).toBe(3);
    expect(bagCount(n, 'first_lamp')).toBe(1); // 原本穿著 → 回到背包
    expect(bagCount(n, 'lantern_tin')).toBe(0);
    expect(n.members.lian!.equipment).toEqual({});
  });
});

describe('存檔 v1 → v3', () => {
  it('目前版本是 3', () => expect(SAVE_VERSION).toBe(3));

  it('背包裡的裝備與身上的模板 id 都換成實例；消耗品與禮物不動；數值不變', () => {
    const s = deserialize(JSON.stringify(v1Save()))!;
    expect(s).not.toBeNull();
    expect(s.version).toBe(3);
    expect(s.inventory).toEqual({ potion_s: 3, gift_flower: 1 });
    expect(bagCount(s, 'lantern_tin')).toBe(2);
    expect(bagCount(s, 'armor_leather')).toBe(1);
    expect(wornTemplate(s, 'lian', 'weapon')).toBe('lantern_brass');
    expect(wornTemplate(s, 'lian', 'charm1')).toBe('ring_swift');
    expect(wornTemplate(s, 'io', 'armor')).toBe('armor_cloth');
    expect(Object.values(s.gear)).toHaveLength(6);
    expect(Object.values(s.gear).every((g) => g.originMode === 'migrated')).toBe(true);
    expect(gearBonus(s, 'lian').atk).toBeGreaterThan(0);
    // 升級後再存再讀：不會重複升級
    const again = deserialize(serialize(s))!;
    expect(Object.keys(again.gear).sort()).toEqual(Object.keys(s.gear).sort());
  });

  it('同一份 v1 存檔升級兩次結果相同（可重現）', () => {
    const a = deserialize(JSON.stringify(v1Save()))!;
    const b = deserialize(JSON.stringify(v1Save()))!;
    expect(Object.keys(a.gear).sort()).toEqual(Object.keys(b.gear).sort());
  });

  it('SaveStore 讀到舊版存檔時另存一份原文', () => {
    const kv = new MemoryKV();
    const text = JSON.stringify(v1Save());
    kv.setItem(AUTO_KEY, text);
    const store = new SaveStore(kv);
    const s = store.load();
    expect(s?.version).toBe(3);
    expect(kv.getItem(preMigrationKey(1))).toBe(text);
    store.save(s!);
    expect(kv.getItem(preMigrationKey(1))).toBe(text); // 存新檔不會覆蓋備份
  });

  it('欄位殘缺的 v1 存檔也能升級；讀檔本身不改主存檔', () => {
    const raw = v1Save();
    raw.members = { lian: { id: 'lian', level: 1, xp: 0, hp: 1, equipment: null } };
    raw.inventory = 'broken' as unknown as Record<string, number>;
    expect(deserialize(JSON.stringify(raw))).not.toBeNull();
    const kv = new MemoryKV();
    const text = JSON.stringify(v1Save());
    kv.setItem(AUTO_KEY, text);
    expect(new SaveStore(kv).load()).not.toBeNull();
    expect(kv.getItem(AUTO_KEY)).toBe(text);
  });

  it('沒有對應 migration 的版本回傳 null', () => {
    expect(deserialize(JSON.stringify({ ...v1Save(), version: 0 }))).toBeNull();
  });
});

describe('6 格裝備（design/14 階段 2.2）', () => {
  it('v2 存檔的 charm → charm1', () => {
    const v2 = newGame(0, 5) as unknown as Record<string, unknown>;
    const s0 = newGame(0, 5);
    const inst = createInstance(s0, 'ring_swift', 'shop');
    v2.version = 2;
    v2.gear = s0.gear;
    v2.members = { lian: { id: 'lian', level: 3, xp: 0, hp: 90, equipment: { charm: inst.instanceId } } };
    const s = deserialize(JSON.stringify(v2))!;
    expect(s.members.lian!.equipment).toEqual({ charm1: inst.instanceId });
    expect(wornTemplate(s, 'lian', 'charm1')).toBe('ring_swift');
  });

  it('飾品可以戴 2 個：先填空格，指定格子可以替換；數值兩個都算', () => {
    const s = newGame(0, 6);
    const a = createInstance(s, 'ring_swift', 'shop');
    const b = createInstance(s, 'charm_ember', 'shop');
    expect(equip(s, 'lian', a.instanceId)).toBe(true);
    expect(equip(s, 'lian', b.instanceId)).toBe(true);
    expect(s.members.lian!.equipment).toMatchObject({ charm1: a.instanceId, charm2: b.instanceId });
    const c = createInstance(s, 'ring_swift', 'shop');
    expect(equip(s, 'lian', c.instanceId, 'charm2')).toBe(true);
    expect(s.members.lian!.equipment.charm2).toBe(c.instanceId);
    expect(bagCount(s, 'charm_ember')).toBe(1);
    const spd = gearBonus(s, 'lian').spd;
    unequip(s, 'lian', 'charm1');
    expect(gearBonus(s, 'lian').spd).toBeLessThan(spd);
  });

  it('武器不能放進飾品格；頭飾、星燼核心目前沒有模板', () => {
    const s = newGame(0, 7);
    const w = createInstance(s, 'lantern_tin', 'shop');
    expect(equip(s, 'lian', w.instanceId, 'charm1')).toBe(true); // 指定不合法的格子 → 放回武器格
    expect(s.members.lian!.equipment).toEqual({ weapon: w.instanceId });
  });
});

describe('讀檔保險', () => {
  it('部位不符或找不到實例的欄位會被卸下（實例留在背包）', () => {
    const s0 = newGame(0, 8);
    const w = createInstance(s0, 'first_lamp', 'drop');
    s0.members.lian!.equipment = { charm1: w.instanceId, armor: 'ghost-id' };
    const s = deserialize(serialize(s0))!;
    expect(s.members.lian!.equipment).toEqual({});
    expect(bagCount(s, 'first_lamp')).toBe(1);
  });
});
