// 線上登入（26-security，D-305）：驗 Entra External ID 發的 JWT（RS256）。驗簽章（JWKS 的 kid）、iss、aud、exp、nbf；
// accountId 一律從 token 的 sub 來（不收客戶端傳的 accountId）。只用 node:crypto，不加套件。
import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';
import { ApiError } from '../src/net/protocol';
import type { Auth } from '../src/server/auth';

export interface JwtOptions {
  issuer: string;
  audience: string;
  /** 拿 JWKS 的 keys（main.ts 從 JWT_JWKS_URL 抓、快取；測試直接給） */
  keys: () => Promise<(JsonWebKey & { kid?: string })[]>;
  now?: () => number;
  /** 時鐘誤差容忍（秒） */
  skewSec?: number;
}

const b64json = (s: string): Record<string, unknown> => {
  const v = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as unknown;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
  return v as Record<string, unknown>;
};

export class JwtAuth implements Auth {
  constructor(private readonly o: JwtOptions) {}

  async resolve(token: string | undefined): Promise<string> {
    const bad = (why: string) => new ApiError('unauthorized', why);
    if (typeof token !== 'string' || token.length > 8192) throw bad('token');
    const parts = token.split('.');
    if (parts.length !== 3) throw bad('token');
    const [h, p, sig] = parts as [string, string, string];
    let head: Record<string, unknown>;
    let body: Record<string, unknown>;
    try {
      head = b64json(h);
      body = b64json(p);
    } catch {
      throw bad('token');
    }
    // 只收 RS256（擋 alg=none 與 HS256 拿公鑰當密碼的攻擊）
    if (head.alg !== 'RS256' || typeof head.kid !== 'string') throw bad('alg');
    const jwk = (await this.o.keys()).find((k) => k.kid === head.kid && (k.kty === 'RSA'));
    if (!jwk) throw bad('kid');
    const ok = verify('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(sig, 'base64url'));
    if (!ok) throw bad('signature');
    const now = Math.floor((this.o.now ?? Date.now)() / 1000);
    const skew = this.o.skewSec ?? 60;
    if (body.iss !== this.o.issuer) throw bad('iss');
    const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
    if (!aud.includes(this.o.audience)) throw bad('aud');
    if (typeof body.exp !== 'number' || body.exp + skew < now) throw bad('exp');
    if (typeof body.nbf === 'number' && body.nbf - skew > now) throw bad('nbf');
    const sub = body.sub;
    if (typeof sub !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(sub)) throw bad('sub');
    return `ext_${sub}`;
  }
}

/** 從 JWKS 網址抓 keys，快取 1 小時；找不到 kid 時（換金鑰）最多每 5 分鐘重抓一次 */
export function jwksFetcher(url: string, fetchFn: typeof fetch = fetch): () => Promise<(JsonWebKey & { kid?: string })[]> {
  let cache: { at: number; keys: (JsonWebKey & { kid?: string })[] } | null = null;
  return async () => {
    if (cache && Date.now() - cache.at < 3600_000) return cache.keys;
    const res = await fetchFn(url);
    if (!res.ok) throw new ApiError('internal', 'jwks');
    const j = (await res.json()) as { keys?: unknown };
    cache = { at: Date.now(), keys: Array.isArray(j.keys) ? (j.keys as (JsonWebKey & { kid?: string })[]) : [] };
    return cache.keys;
  };
}
