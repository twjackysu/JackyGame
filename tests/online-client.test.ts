// 線上版客戶端（D-306，build:online）：onlineClient 的登入 token、網址、「目前角色」——
// 真的起 server/http（記憶體 DB、DevAuth），用 startOnlineClient 連上去：沒角色就用本機武器建一個、之後拿同一個、能看天梯。
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttp } from '../server/http';
import { DevAuth } from '../server/devAuth';
import { apiUrl, onlineActive, onlineToken, ONLINE_TOKEN_KEY, startOnlineClient } from '../src/client/onlineClient';
import { ApiError } from '../src/net/protocol';
import { DocDb } from '../src/server/db/docDb';
import { MemoryStore } from '../src/server/db/memory/MemoryDb';
import { GameServer } from '../src/server/GameServer';

let base = '';
let close: () => Promise<void>;

beforeAll(async () => {
  const db = await DocDb.open(new MemoryStore(), () => Date.now());
  const game = new GameServer({ db, auth: new DevAuth(), local: false, sim: true });
  const http = createHttp(game, { corsOrigins: [] });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  close = () => new Promise((r) => http.close(() => r()));
});
afterAll(() => close());

function fakeLs(init: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> & { m: Record<string, string> } {
  const m = { ...init };
  return { m, getItem: (k) => m[k] ?? null, setItem: (k, v) => void (m[k] = v) };
}

describe('線上版客戶端', () => {
  it('token：有存就用；dev 模式自動給 dev:<亂數> 並記住；正式模式沒 token 就不給', () => {
    expect(onlineToken(fakeLs({ [ONLINE_TOKEN_KEY]: 'jwt.x.y' }), true)).toBe('jwt.x.y');
    const ls = fakeLs();
    const t = onlineToken(ls, true)!;
    expect(t).toMatch(/^dev:[a-z0-9_]{1,24}$/);
    expect(onlineToken(ls, true)).toBe(t);
    expect(onlineToken(fakeLs(), false)).toBeUndefined();
    expect(onlineToken(undefined, false)).toBeUndefined();
  });

  it('網址：結尾斜線可有可無', () => {
    expect(apiUrl('https://a.example/', '/api')).toBe('https://a.example/api');
    expect(apiUrl('https://a.example', '/health')).toBe('https://a.example/health');
  });

  it('沒角色就用本機武器建第一個，之後拿同一個；能看天梯', async () => {
    const c = await startOnlineClient(base, 'dev:online_t1');
    const me = await onlineActive(c, 'bow');
    expect(me.weapon).toBe('bow');
    const again = await onlineActive(c, 'staff');
    expect(again.id).toBe(me.id);
    expect((await c.call('character.list', {})).length).toBe(1);
    const lad = await c.call('pvp.ladder', { characterId: me.id });
    expect(lad.rows.length).toBeGreaterThan(0);
  });

  it('沒 token 被擋（unauthorized）；離線存檔不能匯入', async () => {
    const anon = await startOnlineClient(base, undefined);
    await expect(anon.call('account.get', {})).rejects.toMatchObject({ code: 'unauthorized' });
    const c = await startOnlineClient(base, 'dev:online_t2');
    const err = await c.call('migrate.legacy', { snapshot: {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
  });
});
