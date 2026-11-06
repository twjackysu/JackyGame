// 26-security §4：每個 handler 對亂七八糟的參數都要回 bad_request／not_found／rejected，不能 internal（不洩漏 stack）
import { describe, expect, it } from 'vitest';
import { FakeClock, SeqIds } from '../../src/server/clock';
import { GameServer } from '../../src/server/GameServer';
import { LOCAL_TOKEN, LocalAuth } from '../../src/server/auth';
import { HANDLERS } from '../../src/server/handlers';
import { MemoryStore } from '../../src/server/db/memory/MemoryDb';
import { DocDb } from '../../src/server/db/docDb';
import { LEGACY_SAMPLE } from './fixtures';

const JUNK: unknown[] = [null, 1, 'x', [], {}, { characterId: 1 }, { characterId: 'nope' }, { characterId: 'x'.repeat(500) }, { characterId: { $ne: 1 } }, { id: ['a'] }, { itemIds: 'a' }, { itemIds: Array(500).fill('a') }, { snapshot: { a: 1 } }, { blob: { format: 'x' } }, { slot: '__proto__' }, { region: 'constructor' }];

describe('handler 參數模糊測試', () => {
  it('所有方法 × 垃圾參數 → 只會是預期的錯誤代碼', async () => {
    const db = await DocDb.open(new MemoryStore(), () => 0);
    const server = new GameServer({ db, auth: new LocalAuth(), clock: new FakeClock(), ids: new SeqIds(), local: true, rng: () => 0.5 });
    let n = 0;
    const call = async (method: string, params: unknown) => JSON.parse(await server.handle(JSON.stringify({ v: 1, id: ++n, method, params, requestId: `f${n}`, token: LOCAL_TOKEN }))) as { ok: boolean; error?: { code: string; message: string } };
    expect((await call('migrate.legacy', { snapshot: LEGACY_SAMPLE })).ok).toBe(true);
    const bad: string[] = [];
    for (const m of Object.keys(HANDLERS))
      for (const p of JUNK) {
        const r = await call(m, p);
        if (!r.ok && !['bad_request', 'not_found', 'rejected'].includes(r.error!.code)) bad.push(`${m} ${JSON.stringify(p).slice(0, 40)} → ${r.error!.code}: ${r.error!.message}`);
      }
    expect(bad).toEqual([]);
  });
});
