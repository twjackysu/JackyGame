import { describe, expect, it } from 'vitest';
import { createBattle, chooseCommand, resolveDefense, resolveTiming, WIDE_PERFECT_SCALE, type BattleState } from '../src/core/battle/engine';
import { battleParty, buy, equip, gearPerks, grantDrops, sellPrice } from '../src/core/state/equip';
import { newGame, newGamePlus } from '../src/core/state/gameState';
import { ITEM_DEFS, SHOPS, rarityOf } from '../src/data/equipment';
import { DROPS, firstKillFlag, rollDrops } from '../src/data/drops';
import { ENEMIES } from '../src/data/combatants';

describe('稀有掉落資料（D-049）', () => {
  it('稀有／神級不在任何商店，也不能用 buy() 買', () => {
    for (const [sid, shop] of Object.entries(SHOPS)) for (const id of shop.stock) expect(rarityOf(id), `${sid}:${id}`).toBe('common');
    const s = newGame();
    s.gold = 99999;
    expect(buy(s, 'moon_fang')).toBe(false);
    expect(buy(s, 'wolf_fang_charm')).toBe(false);
  });
  it('神級都有特效、稀有以上都能賣、都有掉落來源', () => {
    const legend = Object.values(ITEM_DEFS).filter((d) => d.rarity === 'legendary');
    expect(legend.length).toBeGreaterThanOrEqual(5);
    for (const d of legend) expect(d.perk, d.id).toBeDefined();
    const dropped = new Set(Object.values(DROPS).flatMap((d) => [...d.pool.map((e) => e.item), ...(d.firstKill ? [d.firstKill] : [])]));
    for (const d of Object.values(ITEM_DEFS)) {
      if ((d.rarity ?? 'common') === 'common' || d.id === 'mist_pendant') continue;
      expect(dropped.has(d.id), `${d.id} 沒有掉落來源`).toBe(true);
      expect(sellPrice(d.id), d.id).toBeGreaterThan(0);
      expect(d.source, d.id).toBeTruthy();
    }
  });
  it('掉落表的敵人與物品都存在、機率合理', () => {
    for (const [eid, def] of Object.entries(DROPS)) {
      expect(ENEMIES[eid], eid).toBeDefined();
      for (const e of def.pool) {
        expect(ITEM_DEFS[e.item], e.item).toBeDefined();
        expect(e.chance).toBeGreaterThan(0);
        expect(e.chance).toBeLessThanOrEqual(0.3);
        if (rarityOf(e.item) === 'legendary' && !eid.startsWith('boss_')) expect(e.chance).toBeLessThanOrEqual(0.01);
      }
      if (def.firstKill) expect(rarityOf(def.firstKill)).toBe('rare');
    }
  });
});

describe('rollDrops', () => {
  it('Boss 首殺必掉，之後不保證', () => {
    for (let seed = 1; seed < 50; seed++) expect(rollDrops(['boss_wolfking'], seed)).toContain('wolfking_pelt');
    let again = 0;
    for (let seed = 1; seed < 400; seed++) if (rollDrops(['boss_wolfking'], seed, () => true).includes('wolfking_pelt')) again++;
    expect(again).toBe(0);
  });
  it('小怪機率統計接近表定值；決定性', () => {
    let rare = 0;
    let legend = 0;
    const N = 20000;
    for (let seed = 1; seed <= N; seed++) {
      const d = rollDrops(['mist_wolf'], seed * 7919);
      if (d.includes('wolf_fang_charm')) rare++;
      if (d.includes('moon_fang')) legend++;
      expect(d.length).toBeLessThanOrEqual(1);
    }
    expect(rare / N).toBeGreaterThan(0.03);
    expect(rare / N).toBeLessThan(0.05);
    expect(legend / N).toBeGreaterThan(0.003);
    expect(legend / N).toBeLessThan(0.01);
    expect(rollDrops(['mist_wolf', 'mist_wolf', 'umbra_boar'], 42)).toEqual(rollDrops(['mist_wolf', 'mist_wolf', 'umbra_boar'], 42));
  });
  it('沒有掉落表的敵人不掉東西', () => {
    expect(rollDrops(['tr_beast', 'boss_starfall_core'], 3)).toEqual([]);
  });
  it('grantDrops 寫進背包並設定首殺旗標', () => {
    const s = newGame();
    grantDrops(s, ['wolfking_pelt'], ['boss_wolfking', 'mist_wolf']);
    expect(s.inventory['wolfking_pelt']).toBe(1);
    expect(s.flags[firstKillFlag('boss_wolfking')]).toBe(true);
    expect(s.flags[firstKillFlag('mist_wolf')]).toBeUndefined();
  });
  it('二週目保留稀有／神級（背包與身上），普通裝備不保留', () => {
    const s = newGame();
    s.inventory['moon_fang'] = 1;
    s.inventory['lantern_tin'] = 1;
    s.inventory['first_lamp'] = 1;
    equip(s, 'lian', 'first_lamp');
    const n = newGamePlus(s);
    expect(n.inventory['moon_fang']).toBe(1);
    expect(n.inventory['first_lamp']).toBe(1);
    expect(n.inventory['lantern_tin']).toBeUndefined();
  });
});

describe('神級特效（perks）', () => {
  const base = (perks: ('lampStart' | 'spRegen' | 'lastStand' | 'widePerfect' | 'swift')[], enemies = ['mist_wolf', 'mist_wolf']) =>
    createBattle({ party: [{ id: 'lian', level: 5, perks }, { id: 'serin', level: 5 }], enemies, seed: 7 });
  it('裝備神級 → battleParty 帶 perks', () => {
    const s = newGame();
    s.inventory['first_lamp'] = 1;
    equip(s, 'lian', 'first_lamp');
    expect(gearPerks(s, 'lian')).toEqual(['lampStart']);
    expect(battleParty(s)[0]!.perks).toEqual(['lampStart']);
  });
  it('lampStart：開場每個敵人 1 盞燈', () => {
    const r = base(['lampStart']);
    expect(r.state.enemies.map((e) => e.lamps)).toEqual([1, 1]);
    expect(r.events.some((e) => e.type === 'perk')).toBe(true);
    expect(base([]).state.enemies.every((e) => e.lamps === 0)).toBe(true);
  });
  it('widePerfect：判定窗口 ×1.15', () => {
    expect(base(['widePerfect']).state.windowScale).toBe(WIDE_PERFECT_SCALE);
    expect(base([]).state.windowScale).toBe(1);
  });
  it('swift：慢速角色也最先行動', () => {
    const r = createBattle({ party: [{ id: 'rourke', level: 5, perks: ['swift'] }, { id: 'io', level: 5 }], enemies: ['rune_hound'], seed: 3 });
    expect(r.state.actor).toEqual({ side: 'hero', index: 0 });
  });
  it('spRegen：回合開始 SP +2', () => {
    const a = base(['spRegen', 'swift']).state;
    const b = base(['swift']).state;
    expect(a.heroes[0]!.sp).toBe(b.heroes[0]!.sp + 1);
  });
  it('lastStand：第一次致命傷以 1 HP 撐住', () => {
    let st: BattleState = createBattle({ party: [{ id: 'lian', level: 1, hp: 1, perks: ['lastStand', 'swift'] }], enemies: ['boss_wolfking'], seed: 5 }).state;
    expect(st.heroes[0]!.lastStand).toBe(true);
    // 連恩防禦後讓狼王攻擊——跑到敵方攻擊結算
    let saw = false;
    for (let i = 0; i < 40 && st.phase !== 'defeat' && st.phase !== 'victory'; i++) {
      if (st.phase === 'playerCommand') {
        const r = chooseCommand(st, { type: 'guard' });
        st = r.state;
      } else if (st.phase === 'playerTiming') st = resolveTiming(st, 'good').state;
      else if (st.phase === 'enemyTelegraph') {
        const before = st.heroes[0]!.lastStand;
        const r = resolveDefenseAll(st);
        if (r.events.some((e) => e.type === 'perk' && e.perk === 'lastStand')) saw = true;
        st = r.state;
        if (before && !st.heroes[0]!.lastStand) expect(st.heroes[0]!.hp === 1 || saw).toBe(true);
      }
    }
    expect(saw).toBe(true);
  });
});

function resolveDefenseAll(st: BattleState) {
  const hits = st.pendingEnemy?.hits.length ?? 1;
  return resolveDefense(st, Array.from({ length: hits }, () => 'fail' as const));
}
