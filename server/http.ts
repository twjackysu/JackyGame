// 線上版的 HTTP 層（V6 第一步，第 145 輪，D-305）：POST /api 收一則協定 JSON（src/net/protocol.ts）交給 GameServer，原樣回 JSON；
// GET /health 給冷啟動預熱（25 §4.3）。只用 node:http，不加框架。HTTP 層自己擋：請求大小、Content-Type、CORS 白名單、每 IP 頻率。
// 帳號的頻率限制在 GameServer（RateLimiter，D-304）；身分驗證在 Auth（token 在協定的 body 裡）。
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { RateLimiter } from '../src/server/rateLimit';

export interface HttpOptions {
  /** 單則請求上限（位元組，26-security：16KB） */
  maxBody?: number;
  /** 允許的網頁來源（CORS）；空＝不送 CORS 標頭（同源或原生 App） */
  corsOrigins?: readonly string[];
  /** 每 IP 每秒幾次（全部方法一起算） */
  ipPerSec?: number;
  now?: () => number;
}

/**
 * 一則請求最大多少（第 148 輪）：PvP 結算要帶整場的指令紀錄（弓、法杖風箏時每個 tick 一個移動，45 秒就 25 KB；
 * 一場最多 180 秒＝5,400 筆，最壞約 0.9 MB）。其他方法還是 16 KB 以內——由 GameServer 依方法再擋（SMALL_BODY）。
 */
export const MAX_BODY = 1024 * 1024;

export function createHttp(game: { handle(json: string): Promise<string> }, o: HttpOptions = {}): Server {
  const maxBody = o.maxBody ?? MAX_BODY;
  const now = o.now ?? (() => Date.now());
  const perSec = o.ipPerSec ?? 20;
  const ipLimit = new RateLimiter({ general: { perSec, burst: perSec * 2 }, trade: { perSec, burst: perSec * 2 }, pvp: { perSec, burst: perSec * 2 } });

  const send = (res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}): void => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(body);
  };

  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    const cors: Record<string, string> = origin && o.corsOrigins?.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const path = (req.url ?? '/').split('?')[0];
    if (req.method === 'GET' && path === '/health') return send(res, 200, '{"ok":true}', cors);
    if (path !== '/api') return send(res, 404, '{"error":"not_found"}');
    if (req.method === 'OPTIONS') {
      if (!cors['Access-Control-Allow-Origin']) return send(res, 403, '{"error":"origin"}');
      res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
      return res.end();
    }
    if (req.method !== 'POST') return send(res, 405, '{"error":"method"}', cors);
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, '{"error":"content_type"}', cors);
    // Azure Container Apps 前面有反向代理：取 X-Forwarded-For 的第一個（代理自己加的），沒有就用連線位址
    const fwd = req.headers['x-forwarded-for'];
    const ip = (typeof fwd === 'string' ? fwd.split(',')[0]!.trim() : '') || req.socket.remoteAddress || '?';
    if (!ipLimit.take(ip, 'http', now())) return send(res, 429, '{"error":"rate_limited"}', cors);
    const len = Number(req.headers['content-length'] ?? 0);
    if (len > maxBody) return send(res, 413, '{"error":"too_large"}', cors);
    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > maxBody && !aborted) {
        aborted = true;
        send(res, 413, '{"error":"too_large"}', cors);
        req.destroy();
      } else if (!aborted) chunks.push(c);
    });
    req.on('end', () => {
      if (aborted) return;
      void game.handle(Buffer.concat(chunks).toString('utf8')).then((out) => send(res, 200, out, cors), () => send(res, 500, '{"error":"internal"}', cors));
    });
  });
}
