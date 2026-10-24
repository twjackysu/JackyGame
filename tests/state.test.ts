import { bagCount } from '../src/core/state/gear';
import { describe, expect, it } from 'vitest';
import {
  applyEffects,
  check,
  checkChance,
  grantXp,
  newGame,
  xpToNext,
} from '../src/core/state/gameState';
import { AUTO_KEY, BAK_KEY, MemoryKV, SaveStore, deserialize, serialize } from '../src/core/save/save';

describe('GameState effects & conditions', () => {
  it('applies effects with clamping', () => {
    const s = newGame(0);
    applyEffects(s, [
      { flag: 'exposed_captain' },
      { divergence: 5 },
      { divergence: 200 },
      { rep: 'order', delta: -150 },
      { affinity: 'io', delta: 10 },
      { item: 'old_lantern' },
      { item: 'potion_s', count: -2 },
      { gold: -999 },
      { codex: 'legacy_lighthouse' },
      { codex: 'legacy_lighthouse' },
      { join: 'rourke', guest: true },
      { card: 'c_veteran' },
    ]);
    expect(s.flags.exposed_captain).toBe(true);
    expect(s.divergence).toBe(100);
    expect(s.reputation.order).toBe(-100);
    expect(s.affinity.io).toBe(10);
    expect(bagCount(s, 'old_lantern')).toBe(1);
    expect(bagCount(s, 'potion_s')).toBe(0);
    expect(s.gold).toBe(0);
    expect(s.codex).toEqual(['legacy_lighthouse']);
    expect(s.party).toEqual(['lian', 'rourke']);
    expect(s.members.rourke?.guest).toBe(true);
    expect(s.cards.c_veteran).toBe(1);
    applyEffects(s, [{ leave: 'rourke' }]);
    expect(s.party).toEqual(['lian']);
  });

  it('evaluates conditions', () => {
    const s = newGame(0);
    applyEffects(s, [{ flag: 'saved_caravan' }, { affinity: 'io', delta: 40 }, { flag: 'n', value: 3 }]);
    expect(check(s, { flag: 'saved_caravan' })).toBe(true);
    expect(check(s, { flag: 'saved_caravan', not: true })).toBe(false);
    expect(check(s, { flag: 'n', equals: 3 })).toBe(true);
    expect(check(s, { all: [{ affinityAtLeast: ['io', 40] }, { inParty: 'lian' }] })).toBe(true);
    expect(check(s, { any: [{ hasCodex: 'x' }, { divergenceAtLeast: 1 }] })).toBe(false);
  });

  it('check chance follows 03 §5', () => {
    expect(checkChance(5, 5)).toBeCloseTo(0.5);
    expect(checkChance(4, 3)).toBeCloseTo(0.62);
    expect(checkChance(1, 9)).toBe(0.05);
    expect(checkChance(12, 3)).toBe(0.95);
  });

  it('levels up with xp curve and grants stat points to Lian', () => {
    const s = newGame(0);
    expect(xpToNext(1)).toBe(40);
    const ups = grantXp(s, 'lian', 400);
    expect(ups).toBe(3); // 40 + 121 + 232 = 393 → Lv4
    expect(s.members.lian?.level).toBe(4);
    expect(s.statPoints).toBe(3);
  });
});

describe('SaveStore', () => {
  it('round-trips and keeps a backup', () => {
    const kv = new MemoryKV();
    const store = new SaveStore(kv);
    expect(store.load()).toBeNull();
    const s = newGame(123);
    s.flags.a = true;
    expect(store.save(s)).toBe(true);
    s.flags.b = 2;
    store.save(s);
    expect(store.load()?.flags).toEqual({ a: true, b: 2 });
    expect(deserialize(kv.getItem(BAK_KEY) as string)?.flags).toEqual({ a: true });
  });

  it('falls back to backup when main save is corrupt', () => {
    const kv = new MemoryKV();
    const store = new SaveStore(kv);
    const s = newGame(1);
    s.gold = 777;
    store.save(s);
    store.save(s);
    kv.setItem(AUTO_KEY, '{broken');
    expect(store.load()?.gold).toBe(777);
  });

  it('rejects future versions and fills missing fields', () => {
    expect(deserialize(JSON.stringify({ version: 999 }))).toBeNull();
    const partial = deserialize(JSON.stringify({ version: 1, gold: 5 }));
    expect(partial?.gold).toBe(5);
    expect(partial?.reputation.order).toBe(0);
    expect(deserialize(serialize(newGame(0)))?.heroName).toBe('連恩');
  });
});
