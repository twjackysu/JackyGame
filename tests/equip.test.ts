import { describe, expect, it } from 'vitest';
import { createBattle } from '../src/core/battle/engine';
import { ITEMS } from '../src/core/battle/skills';
import { battleParty, buy, buyPrice, canEquip, equip, gearBonus, gearDelta, owns, sell, sellPrice, sellable, shopStock, unequip } from '../src/core/state/equip';
import { applyEffect, check, newGame } from '../src/core/state/gameState';
import { ITEM_DEFS, SHOPS } from '../src/data/equipment';
import { AREAS } from '../src/data/areas';
import { SCRIPTS } from '../src/game/session';

describe('裝備資料', () => {
  it('每件裝備都有欄位與數值，商店貨架都存在', () => {
    for (const d of Object.values(ITEM_DEFS)) {
      if (d.kind === 'gear') {
        expect(d.slot, d.id).toBeDefined();
        expect(Object.keys(d.bonus ?? {}).length, d.id).toBeGreaterThan(0);
      }
    }
    for (const [id, shop] of Object.entries(SHOPS)) for (const it of shop.stock) {
      expect(ITEM_DEFS[it], `${id}:${it}`).toBeDefined();
      expect(ITEM_DEFS[it]!.price, `${id}:${it}`).toBeGreaterThan(0);
    }
  });
  it('劇本與寶箱給的道具都有定義；戰鬥道具都在資料表', () => {
    const ids = new Set<string>();
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>;
        if (typeof r.item === 'string') ids.add(r.item);
        Object.values(r).forEach(walk);
      }
    };
    walk(SCRIPTS);
    walk(AREAS);
    for (const id of ids) expect(ITEM_DEFS[id], id).toBeDefined();
    for (const id of Object.keys(ITEMS)) expect(ITEM_DEFS[id]?.kind, id).toBe('use');
  });
  it('劇本裡的 shop 事件都有對應商店', () => {
    const shops = new Set<string>();
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>;
        if (r.event === 'shop' && typeof r.id === 'string') shops.add(r.id);
        Object.values(r).forEach(walk);
      }
    };
    walk(SCRIPTS);
    expect(shops.size).toBeGreaterThan(0);
    for (const id of shops) expect(SHOPS[id], id).toBeDefined();
  });
});

describe('買賣', () => {
  it('買：扣錢、進背包；錢不夠買不了', () => {
    const s = newGame();
    s.gold = 100;
    expect(buy(s, 'sword_iron')).toBe(true);
    expect(s.gold).toBe(30);
    expect(s.inventory.sword_iron).toBe(1);
    expect(buy(s, 'sword_iron')).toBe(false);
    expect(s.gold).toBe(30);
  });
  it('折扣與賣價 50%；重要物品與非賣品不能賣', () => {
    expect(buyPrice('lantern_tin', 10)).toBe(54);
    expect(sellPrice('lantern_tin')).toBe(30);
    expect(sellPrice('lamp_wick')).toBe(0);
    expect(sellPrice('old_lantern')).toBe(0);
    const s = newGame();
    s.inventory.lamp_wick = 1;
    expect(sell(s, 'lamp_wick')).toBe(false);
    expect(sellable(s)).toEqual(['potion_s']);
    const g = s.gold;
    expect(sell(s, 'potion_s')).toBe(true);
    expect(s.gold).toBe(g + 15);
    expect(s.inventory.potion_s).toBe(1);
  });
  it('非賣品不能買', () => {
    const s = newGame();
    s.gold = 9999;
    expect(buy(s, 'old_lantern')).toBe(false);
    expect(buy(s, 'nope')).toBe(false);
  });
  it('未知商店退回雜貨店貨架', () => {
    expect(shopStock('???')).toEqual([...SHOPS.ch1_general!.stock]);
  });
});

describe('裝備', () => {
  it('換裝：背包 ↔ 欄位，原本那件放回背包', () => {
    const s = newGame();
    s.inventory.lantern_tin = 1;
    s.inventory.old_lantern = 1;
    expect(equip(s, 'lian', 'old_lantern')).toBe(true);
    expect(s.inventory.old_lantern).toBeUndefined();
    expect(gearBonus(s, 'lian').atk).toBe(2);
    expect(gearDelta(s, 'lian', 'lantern_tin').atk).toBe(2);
    expect(equip(s, 'lian', 'lantern_tin')).toBe(true);
    expect(s.inventory.old_lantern).toBe(1);
    expect(s.members.lian!.equipment.weapon).toBe('lantern_tin');
    expect(unequip(s, 'lian', 'weapon')).toBe(true);
    expect(s.inventory.lantern_tin).toBe(1);
    expect(gearBonus(s, 'lian').atk).toBe(0);
  });
  it('限定角色：瑟琳的劍連恩不能裝；沒有的東西不能裝', () => {
    const s = newGame();
    s.inventory.sword_iron = 1;
    expect(canEquip('lian', ITEM_DEFS.sword_iron)).toBe(false);
    expect(equip(s, 'lian', 'sword_iron')).toBe(false);
    expect(equip(s, 'lian', 'armor_cloth')).toBe(false);
  });
  it('穿在身上的鑰匙道具仍算持有（hasItem 條件）', () => {
    const s = newGame();
    applyEffect(s, { item: 'old_lantern' });
    equip(s, 'lian', 'old_lantern');
    expect(owns(s, 'old_lantern')).toBe(true);
    expect(check(s, { hasItem: 'old_lantern' })).toBe(true);
  });
  it('加成會帶進戰鬥（ATK/DEF/HP/SPD）', () => {
    const s = newGame();
    const plain = createBattle({ party: battleParty(s), enemies: ['mist_wolf'], seed: 1 }).state.heroes[0]!;
    for (const id of ['lantern_brass', 'armor_leather', 'ring_swift']) {
      s.inventory[id] = 1;
      equip(s, 'lian', id);
    }
    const geared = createBattle({ party: battleParty(s), enemies: ['mist_wolf'], seed: 1 }).state.heroes[0]!;
    expect(geared.atk - plain.atk).toBe(8);
    expect(geared.def - plain.def).toBe(5);
    expect(geared.maxHp - plain.maxHp).toBe(20);
    expect(geared.hp).toBe(geared.maxHp);
    expect(geared.spd - plain.spd).toBe(3);
  });
  it('回復藥（中）在戰鬥中可用並回 160', async () => {
    const { chooseCommand } = await import('../src/core/battle/engine');
    let st = createBattle({ party: [{ id: 'rourke', level: 5 }], enemies: ['mist_wolf'], seed: 3, items: { potion_m: 1 } }).state;
    st.heroes[0]!.hp = 10;
    if (st.phase === 'playerCommand') {
      st = chooseCommand(st, { type: 'item', itemId: 'potion_m', target: 0 }).state;
      expect(st.items.potion_m).toBe(0);
      expect(st.heroes[0]!.hp).toBeGreaterThanOrEqual(10 + 160 - 60); // 可能被敵人打一下
    }
  });
});
