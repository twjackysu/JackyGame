// 線上版 HTTP 層（V6 第一步，D-305）：真的起一個 node:http 伺服器（記憶體資料庫、DevAuth、頻率限制），
// 用 HttpTransport＋GameClient 走完一段：兩個帳號建角色、看拍賣所、碰不到別人的角色；離線存檔匯入被拒；健康檢查、大小、CORS、亂 token。
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttp } from '../server/http';
import { DevAuth } from '../server/devAuth';
import { GameClient } from '../src/client/GameClient';
import { HttpTransport } from '../src/net/HttpTransport';
import { ApiError } from '../src/net/protocol';
import { DocDb } from '../src/server/db/docDb';
import { MemoryStore } from '../src/server/db/memory/MemoryDb';
import { GameServer } from '../src/server/GameServer';
import { RateLimiter } from '../src/server/rateLimit';
import { LEGACY_SAMPLE } from './server-contract/fixtures';

let base = '';
let close: () => Promise<void>;

beforeAll(async () => {
  const db = await DocDb.open(new MemoryStore(), () => Date.now());
  const game = new GameServer({ db, auth: new DevAuth(), limiter: new RateLimiter(), local: false });
  const http = createHttp(game, { corsOrigins: ['https://ok.example'] });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  close = () => new Promise((r) => http.close(() => r()));
});
afterAll(() => close());

const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : `throw:${String(e)}`;
  }
};

describe('HTTP 伺服器', () => {
  it('健康檢查、404、只收 POST JSON、太大 413、CORS 白名單', async () => {
    expect(await (await fetch(`${base}/health`)).json()).toEqual({ ok: true });
    expect((await fetch(`${base}/nope`)).status).toBe(404);
    expect((await fetch(`${base}/api`)).status).toBe(405);
    expect((await fetch(`${base}/api`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } })).status).toBe(415);
    expect((await fetch(`${base}/api`, { method: 'POST', body: 'x'.repeat(20_000), headers: { 'Content-Type': 'application/json' } })).status).toBe(413);
    const ok = await fetch(`${base}/api`, { method: 'OPTIONS', headers: { Origin: 'https://ok.example' } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://ok.example');
    expect((await fetch(`${base}/api`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } })).status).toBe(403);
  });

  it('走完一段：建角色、看拍賣所、碰不到別人的角色；亂 token unauthorized；線上不能匯入離線存檔', async () => {
    let n = 0;
    const mk = (token: string) => new GameClient(new HttpTransport(`${base}/api`), { token, timeoutMs: 5000, retries: 2, newRequestId: () => `${token}-${++n}` });
    const a = mk('dev:alice');
    const b = mk('dev:bob');
    expect(await code(mk('hacker').call('character.list', {}))).toBe('unauthorized');
    expect(await code(a.call('migrate.legacy', { snapshot: LEGACY_SAMPLE }))).toBe('rejected');
    expect(await code(a.call('migrate.pull', {}))).toBe('rejected');
    const A = await a.call('character.create', { name: '艾薇', weapon: 'bow' });
    const B = await b.call('character.create', { name: '洛恩', weapon: 'sword' });
    expect(A.level).toBe(1);
    expect((await a.call('account.get', {})).activeCharacterId).toBe(A.id);
    // 新角色空手：拍賣所沒東西可賣、也買不起
    expect((await b.call('market.browse', {})).listings).toEqual([]);
    expect(await code(b.call('character.get', { id: A.id }))).toBe('not_found');
    expect(B.wallet.coin).toBe(0);
  });
});
