// 線上版登入（第 148 輪，NEXT #2）：Entra External ID 的 OAuth 2.0 授權碼＋PKCE（S256），不加套件（MSAL 很大）。
// 只有建置時設了 VITE_ENTRA_AUTHORITY＋VITE_ENTRA_CLIENT_ID 才會用；沒設＝跟以前一樣（dev token 或沒有登入）。
// 拿到的 id_token（aud＝client id）存在 jg_online_token，伺服器 server/jwtAuth.ts 驗簽章／iss／aud／exp。
// 這個檔案只放純函式（亂數、雜湊、fetch、儲存都由呼叫端給），方便測試。
export interface EntraConfig {
  /** 例：https://<租戶>.ciamlogin.com/<租戶>.onmicrosoft.com/v2.0 前面那段（不含 /oauth2/...） */
  authority: string;
  clientId: string;
  /** 回到遊戲的網址（要跟 Entra 的 app registration 登記的一樣） */
  redirectUri: string;
}

export const LOGIN_STATE_KEY = 'jg_login_state';
export const LOGIN_VERIFIER_KEY = 'jg_login_verifier';

const B64URL = /[+/=]/g;
export function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(B64URL, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''));
}

/** PKCE（RFC 7636）：verifier 43 字（32 個亂數位元組）、challenge＝base64url(SHA-256(verifier)) */
export async function pkcePair(random: (n: number) => Uint8Array, sha256: (data: Uint8Array) => Promise<ArrayBuffer>): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(random(32));
  return { verifier, challenge: await pkceChallenge(verifier, sha256) };
}

export async function pkceChallenge(verifier: string, sha256: (data: Uint8Array) => Promise<ArrayBuffer>): Promise<string> {
  return base64url(new Uint8Array(await sha256(new TextEncoder().encode(verifier))));
}

const trim = (u: string): string => u.replace(/\/+$/, '');

/** 登入頁網址（瀏覽器整頁轉過去） */
export function authorizeUrl(cfg: EntraConfig, challenge: string, state: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: cfg.redirectUri,
    response_mode: 'query',
    scope: 'openid offline_access',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });
  return `${trim(cfg.authority)}/oauth2/v2.0/authorize?${q.toString()}`;
}

/** 用授權碼換 token 的請求（POST，表單格式；公開用戶端不帶 secret） */
export function tokenRequest(cfg: EntraConfig, code: string, verifier: string): { url: string; body: string } {
  const body = new URLSearchParams({ client_id: cfg.clientId, grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri, code_verifier: verifier, scope: 'openid offline_access' });
  return { url: `${trim(cfg.authority)}/oauth2/v2.0/token`, body: body.toString() };
}

/** 登入回來的網址：有 code 而且 state 對得上才算（擋 CSRF）；error 也回報 */
export function parseRedirect(search: string, expectState: string | null): { code: string } | { error: string } | null {
  const q = new URLSearchParams(search);
  const err = q.get('error');
  if (err) return { error: err };
  const code = q.get('code');
  if (!code) return null;
  if (!expectState || q.get('state') !== expectState) return { error: 'state' };
  return { code };
}

/** JWT 還有多久過期（秒；不驗簽章，只是決定要不要重新登入——驗簽章是伺服器的事） */
export function tokenSecondsLeft(token: string, nowMs: number): number {
  const p = token.split('.')[1];
  if (!p) return -1;
  try {
    const json = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    return typeof json.exp === 'number' ? json.exp - Math.floor(nowMs / 1000) : -1;
  } catch {
    return -1;
  }
}

/** 儲存（localStorage 放 token；sessionStorage 放這次登入的 state／verifier） */
interface Kv {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface LoginDeps {
  cfg: EntraConfig;
  local: Kv;
  session: Kv;
  random: (n: number) => Uint8Array;
  sha256: (data: Uint8Array) => Promise<ArrayBuffer>;
  fetch: (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
  /** 整頁轉到登入頁 */
  go: (url: string) => void;
  now: () => number;
}

/** 開始登入：記下 state／verifier，轉到登入頁 */
export async function beginLogin(d: LoginDeps): Promise<void> {
  const { verifier, challenge } = await pkcePair(d.random, d.sha256);
  const state = base64url(d.random(16));
  d.session.setItem(LOGIN_STATE_KEY, state);
  d.session.setItem(LOGIN_VERIFIER_KEY, verifier);
  d.go(authorizeUrl(d.cfg, challenge, state));
}

/**
 * 啟動時：網址帶登入結果就換 token、存起來；回傳可用的 token（沒有或快過期＝undefined，畫面顯示「登入」）。
 * tokenKey 是 jg_online_token。
 */
export async function finishLogin(d: LoginDeps, search: string, tokenKey: string): Promise<{ token?: string; error?: string; handled: boolean }> {
  const r = parseRedirect(search, d.session.getItem(LOGIN_STATE_KEY));
  if (r) {
    const verifier = d.session.getItem(LOGIN_VERIFIER_KEY);
    d.session.removeItem(LOGIN_STATE_KEY);
    d.session.removeItem(LOGIN_VERIFIER_KEY);
    if ('error' in r) return { error: r.error, handled: true };
    if (!verifier) return { error: 'verifier', handled: true };
    const req = tokenRequest(d.cfg, r.code, verifier);
    const res = await d.fetch(req.url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: req.body });
    const j = (await res.json()) as { id_token?: unknown; error?: unknown };
    if (!res.ok || typeof j.id_token !== 'string') return { error: typeof j.error === 'string' ? j.error : 'token', handled: true };
    d.local.setItem(tokenKey, j.id_token);
    return { token: j.id_token, handled: true };
  }
  const saved = d.local.getItem(tokenKey);
  // 開發用的 dev: token 不是 JWT；正式版遇到就當沒登入
  if (!saved || saved.startsWith('dev:') || tokenSecondsLeft(saved, d.now()) < 60) return { handled: false };
  return { token: saved, handled: false };
}
