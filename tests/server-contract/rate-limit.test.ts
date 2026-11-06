// 頻率限制（26-security，D-304）：每帳號每類方法一個權杖桶；PvP 結算最嚴、交易類次之；帳號之間互不影響；時間過了會補回來。
import { describe, expect, it } from 'vitest';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import { MemoryStore } from '../../src/server/db/memory/MemoryDb';
import { DocDb } from '../../src/server/db/docDb';
import { RateLimiter, classOf } from '../../src/server/rateLimit';

describe('RateLimiter', () => {
  it('分類', () => {
    expect(classOf('pvp.finish')).toBe('pvp');
    expect(classOf('market.buy')).toBe('trade');
    expect(classOf('trade.confirm')).toBe('trade');
    expect(classOf('market.browse')).toBe('general');
    expect(classOf('character.list')).toBe('general');
  });
  it('瞬間連按到上限就擋、時間過了補回、帳號之間互不影響', () => {
    const l = new RateLimiter();
    let ok = 0;
    for (let i = 0; i < 30; i++) if (l.take('a', 'character.list', 0)) ok++;
    expect(ok).toBe(20);
    expect(l.take('b', 'character.list', 0)).toBe(true);
    expect(l.take('a', 'character.list', 100)).toBe(true); // 0.1 秒補 1 個
    expect(l.take('a', 'character.list', 100)).toBe(false);
    // PvP：連開兩場後要等 3 秒
    expect(l.take('a', 'pvp.start', 0)).toBe(true);
    expect(l.take('a', 'pvp.finish', 0)).toBe(true);
    expect(l.take('a', 'pvp.start', 1000)).toBe(false);
    expect(l.take('a', 'pvp.start', 4000)).toBe(true);
  });
  it('桶太多時丟掉補滿的', () => {
    const l = new RateLimiter(undefined, 10);
    for (let i = 0; i < 10; i++) l.take(`u${i}`, 'character.list', 0);
    l.take('late', 'character.list', 60_000);
    expect(l.size).toBe(1);
  });
});

describe('GameServer 接上頻率限制', () => {
  it('超過回 rate_limited（不是 internal），其他帳號照常', async () => {
    const db = await DocDb.open(new MemoryStore(), () => 0);
    const clock = new FakeClock();
    const server = new GameServer({ db, auth: { resolve: async (t?: string) => t ?? 'anon' }, clock, ids: new SeqIds(), limiter: new RateLimiter() });
    let n = 0;
    const call = async (token: string) => JSON.parse(await server.handle(JSON.stringify({ v: 1, id: ++n, method: 'character.list', params: {}, token }))) as { ok: boolean; error?: { code: string } };
    const codes: string[] = [];
    for (let i = 0; i < 25; i++) codes.push((await call('x')).error?.code ?? 'ok');
    expect(codes.filter((c) => c === 'ok').length).toBe(20);
    expect(codes.slice(20)).toEqual(Array(5).fill('rate_limited'));
    expect((await call('y')).ok).toBe(true);
    clock.advance(1000);
    expect((await call('x')).ok).toBe(true);
  });
});
