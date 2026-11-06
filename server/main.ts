// 線上版進入點（V6 第一步，D-305）：環境變數 → 資料庫＋登入＋頻率限制 → GameServer → HTTP。
// 執行：npx tsx server/main.ts（Dockerfile 之後補）。設定看 server/.env.example；秘密只放環境變數，不進 git。
import { DocDb } from '../src/server/db/docDb';
import { MemoryStore } from '../src/server/db/memory/MemoryDb';
import { MssqlDb } from '../src/server/db/mssql/MssqlDb';
import { GameServer } from '../src/server/GameServer';
import { RateLimiter } from '../src/server/rateLimit';
import type { Db } from '../src/server/repos/types';
import { DevAuth } from './devAuth';
import { createHttp } from './http';
import { JwtAuth, jwksFetcher } from './jwtAuth';
import type { Auth } from '../src/server/auth';

const env = process.env;
const now = () => Date.now();

async function main(): Promise<void> {
  const mode = env.AUTH_MODE ?? '';
  let auth: Auth;
  if (mode === 'dev') auth = new DevAuth();
  else if (mode === 'jwt') {
    const { JWT_ISSUER: issuer, JWT_AUDIENCE: audience, JWT_JWKS_URL: jwks } = env;
    if (!issuer || !audience || !jwks?.startsWith('https://')) throw new Error('AUTH_MODE=jwt 要設 JWT_ISSUER、JWT_AUDIENCE、JWT_JWKS_URL（https）');
    auth = new JwtAuth({ issuer, audience, keys: jwksFetcher(jwks) });
  } else throw new Error('AUTH_MODE 要是 dev 或 jwt');
  const conn = env.GAME_DB_CONNECTION_STRING;
  let db: Db;
  if (conn) db = await MssqlDb.open(conn, now, env.GAME_DB_SCHEMA || 'game', { migrate: env.GAME_DB_MIGRATE !== '0' });
  else {
    console.warn('[server] 沒有 GAME_DB_CONNECTION_STRING：用記憶體資料庫（重開就清空，只能開發用）');
    db = await DocDb.open(new MemoryStore(), now);
  }
  const game = new GameServer({ db, auth, limiter: new RateLimiter(), local: false });
  const port = Number(env.PORT || 8080);
  const cors = (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  createHttp(game, { corsOrigins: cors }).listen(port, () => console.log(`[server] listening on :${port}（AUTH_MODE=${mode}）`));
}

main().catch((e) => {
  console.error('[server] 啟動失敗：', e instanceof Error ? e.message : e);
  process.exit(1);
});
