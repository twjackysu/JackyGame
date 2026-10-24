// design/14 階段 1.5：GameApi（LocalGameApi）與「場景不直接改資產」的邊界
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalGameApi } from '../src/server/localGameApi';
import { KvEventJournal, fixedClock } from '../src/core/save/localPorts';
import { MemoryKV } from '../src/core/save/save';
import { newGame, type GameState } from '../src/core/state/gameState';
import { bagCount } from '../src/core/state/gear';
import { wornTemplate } from '../src/core/state/equip';
import { chestFlag } from '../src/core/explore/area';
import { AREAS } from '../src/data/areas';
import { RULES_VERSION } from '../src/data/rules';
import { firstKillFlag } from '../src/data/drops';

function setup(seed = 1) {
  const s: GameState = newGame(0, seed);
  const journal = new KvEventJournal(new MemoryKV());
  const api = new LocalGameApi(() => s, journal, fixedClock(1000));
  return { s, journal, api };
}

describe('LocalGameApi', () => {
  it('買：成功扣錢、附規則版本、記事件；同 operationId 重送不重複扣款', () => {
    const { s, api, journal } = setup();
    s.gold = 200;
    const r = api.buy('op-1', { itemId: 'lantern_tin' });
    expect(r).toMatchObject({ ok: true, rulesVersion: RULES_VERSION, operationId: 'op-1' });
    const gold = s.gold;
    expect(api.buy('op-1', { itemId: 'lantern_tin' })).toMatchObject({ ok: true, duplicate: true });
    expect(s.gold).toBe(gold);
    expect(bagCount(s, 'lantern_tin')).toBe(1);
    const ev = journal.recent();
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'buy', rulesVersion: RULES_VERSION, timestamp: 1000 });
    expect(ev[0]!.details.goldDelta).toBe(gold - 200);
  });

  it('買：錢不夠／非賣品／稀有品回傳錯誤代碼，不記事件', () => {
    const { s, api, journal } = setup();
    s.gold = 0;
    expect(api.buy('a', { itemId: 'lantern_tin' }).error).toBe('not_enough_gold');
    expect(api.buy('b', { itemId: 'old_lantern' }).error).toBe('not_for_sale');
    expect(api.buy('c', { itemId: 'moon_fang' }).error).toBe('not_for_sale');
    expect(api.buy('', { itemId: 'potion_s' }).error).toBe('invalid');
    expect(journal.recent()).toHaveLength(0);
  });

  it('賣、裝備、卸下', () => {
    const { s, api } = setup();
    s.gold = 500;
    api.buy('b1', { itemId: 'lantern_tin' });
    api.buy('b2', { itemId: 'lantern_tin' });
    expect(api.equip('e1', { member: 'lian', ref: 'lantern_tin' }).ok).toBe(true);
    expect(wornTemplate(s, 'lian', 'weapon')).toBe('lantern_tin');
    expect(api.sell('s1', { itemId: 'lantern_tin' }).ok).toBe(true);
    expect(api.sell('s2', { itemId: 'lantern_tin' }).error).toBe('not_owned'); // 身上那件不能賣
    expect(api.unequip('u1', { member: 'lian', slot: 'weapon' }).ok).toBe(true);
    expect(api.equip('e2', { member: 'lian', ref: 'sword_iron' }).error).toBe('cannot_equip');
  });

  it('寶箱：內容由地圖資料決定、只能開一次', () => {
    const { s, api } = setup();
    const [areaId, chest] = Object.entries(AREAS).flatMap(([id, a]) => a.entities.filter((e) => e.kind === 'chest' && !e.hidden).map((e) => [id, e] as const))[0]!;
    const r = api.openChest('c1', { areaId, entityId: chest.id });
    expect(r.ok).toBe(true);
    expect(s.flags[chestFlag(areaId, chest.id)]).toBe(true);
    expect(api.openChest('c2', { areaId, entityId: chest.id }).error).toBe('already_claimed');
    expect(api.openChest('c3', { areaId, entityId: 'nope' }).error).toBe('not_found');
  });

  it('明雷小怪金幣', () => {
    const { s, api } = setup();
    const [areaId, enemy] = Object.entries(AREAS).flatMap(([id, a]) => a.entities.filter((e) => e.kind === 'enemy' && (e.gold ?? 0) > 0).map((e) => [id, e] as const))[0]!;
    const g = s.gold;
    expect(api.claimEnemyGold('g1', { areaId, entityId: enemy.id }).data?.gold).toBe(enemy.gold);
    expect(s.gold).toBe(g + enemy.gold!);
  });

  it('戰鬥獎勵：消耗品只會變少、Boss 首殺必掉＋記旗標、同種子可重現', () => {
    const run = () => {
      const { s, api } = setup(42);
      s.inventory.potion_s = 2;
      const r = api.claimBattleRewards('w1', { defeated: ['boss_wolfking'], consumablesLeft: { potion_s: 9, lamp_oil: 0 } });
      return { s, r };
    };
    const { s, r } = run();
    expect(s.inventory.potion_s).toBe(2); // 不能憑空變多
    expect(r.data!.drops.length).toBeGreaterThan(0);
    expect(r.data!.newBossPoint).toBe(true);
    expect(s.flags[firstKillFlag('boss_wolfking')]).toBe(true);
    expect(run().r.data).toEqual(r.data);
  });

  it('技能樹重置收費', () => {
    const { s, api } = setup();
    s.tree = { lian: ['x'] };
    s.gold = 0;
    const r = api.resetTree('r1', { member: 'lian', atCamp: false });
    expect(r.ok || r.error === 'not_enough_gold').toBe(true);
    expect(api.resetTree('r2', { member: 'lian', atCamp: true }).ok).toBe(true);
  });
});

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listTs(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('場景／UI 不直接改玩家資產（一律經 GameApi）', () => {
  // BootScene 的除錯存檔（?chapter=N）例外
  const files = listTs('src/game').filter((f) => !f.endsWith('BootScene.ts'));
  const MUTATION = [
    /\.inventory\[[^\]]+\]\s*=(?!=)/,
    /delete\s+[\w.]*inventory\[/,
    /\.gold\s*[-+]?=(?!=)/,
    /\.gear\[[^\]]+\]\s*=(?!=)/,
    /\.equipment\[[^\]]+\]\s*=(?!=)/,
    /\{\s*gold\s*:/,
  ];
  const FORBIDDEN_IMPORT = /import\s*\{[^}]*\b(buy|sell|equip|unequip|grantDrops|resetTree|addItem|createInstance)\b[^}]*\}\s*from\s*['"][^'"]*core\/state\/(equip|gear|skillTree)['"]/;
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      const hits = MUTATION.filter((r) => r.test(src)).map(String);
      expect(hits).toEqual([]);
      expect(FORBIDDEN_IMPORT.test(src)).toBe(false);
    });
  }
});
