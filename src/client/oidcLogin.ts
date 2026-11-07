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
/** refresh token（第 149 輪，D-318）：id_token 約 1 小時就過期；有它就能不轉頁續期（Entra 的 SPA refresh token 24 小時、每用一次換新的） */
export const REFRESH_TOKEN_KEY = 'jg_online_refresh';

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

/** 用 refresh token 換新的 id_token（不轉頁） */
export function refreshRequest(cfg: EntraConfig, refreshToken: string): { url: string; body: string } {
  const body = new URLSearchParams({ client_id: cfg.clientId, grant_type: 'refresh_token', refresh_token: refreshToken, scope: 'openid offline_access' });
  return { url: `${trim(cfg.authority)}/oauth2/v2.0/token`, body: body.toString() };
}

/** 登出頁網址（Entra 清掉它那邊的登入，再回到遊戲） */
export function logoutUrl(cfg: EntraConfig): string {
  return `${trim(cfg.authority)}/oauth2/v2.0/logout?${new URLSearchParams({ post_logout_redirect_uri: cfg.redirectUri }).toString()}`;
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

/** JWT 的內容（不驗簽章——只拿來顯示名字、判斷過期；驗簽章是伺服器的事） */
function jwtClaims(token: string): Record<string, unknown> | null {
  const p = token.split('.')[1];
  if (!p) return null;
  try {
    const bin = atob(p.replace(/-/g, '+').replace(/_/g, '/'));
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as unknown;
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** JWT 還有多久過期（秒） */
export function tokenSecondsLeft(token: string, nowMs: number): number {
  const exp = jwtClaims(token)?.exp;
  return typeof exp === 'number' ? exp - Math.floor(nowMs / 1000) : -1;
}

/** 標題畫面顯示的帳號名：name → email → preferred_username（都沒有＝空字串）；最多 24 字 */
export function tokenDisplayName(token: string): string {
  const c = jwtClaims(token);
  if (!c) return '';
  const emails = Array.isArray(c.emails) ? c.emails : [];
  for (const v of [c.name, c.email, emails[0], c.preferred_username]) {
    if (typeof v === 'string' && v.trim()) return [...v.trim()].slice(0, 24).join('');
  }
  return '';
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
    storeTokens(d, tokenKey, j);
    return { token: j.id_token, handled: true };
  }
  const saved = d.local.getItem(tokenKey);
  // 開發用的 dev: token 不是 JWT；正式版遇到就當沒登入
  if (saved && !saved.startsWith('dev:') && tokenSecondsLeft(saved, d.now()) >= 60) return { token: saved, handled: false };
  // 過期了：有 refresh token 就不轉頁續期
  const fresh = await refreshLogin(d, tokenKey);
  return fresh ? { token: fresh, handled: false } : { handled: false };
}

function storeTokens(d: LoginDeps, tokenKey: string, j: { id_token?: unknown; refresh_token?: unknown }): void {
  if (typeof j.id_token === 'string') d.local.setItem(tokenKey, j.id_token);
  if (typeof j.refresh_token === 'string') d.local.setItem(REFRESH_TOKEN_KEY, j.refresh_token);
}

/**
 * 用存著的 refresh token 換新的 id_token（啟動時過期、或玩到一半伺服器回 unauthorized 時）。
 * 成功回新 token（也存起來）；失敗（沒有、被撤銷、網路錯）回 undefined，並OAuth 明確拒絕時清掉 refresh token。
 */
export async function refreshLogin(d: LoginDeps, tokenKey: string): Promise<string | undefined> {
  const rt = d.local.getItem(REFRESH_TOKEN_KEY);
  if (!rt) return undefined;
  try {
    const req = refreshRequest(d.cfg, rt);
    const res = await d.fetch(req.url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: req.body });
    const j = (await res.json()) as { id_token?: unknown; refresh_token?: unknown; error?: unknown };
    if (!res.ok || typeof j.id_token !== 'string') {
      // OAuth 回了錯誤（invalid_grant＝過期／被撤銷）才丟掉；其他（伺服器暫時壞掉）留著下次再試
      if (typeof j.error === 'string') d.local.removeItem(REFRESH_TOKEN_KEY);
      return undefined;
    }
    storeTokens(d, tokenKey, j);
    return j.id_token;
  } catch {
    return undefined; // 網路錯：refresh token 留著，下次再試
  }
}

/** 登出：清掉本機的 token，轉到 Entra 的登出頁（回來後會再轉登入頁） */
export function logout(d: Pick<LoginDeps, 'cfg' | 'local' | 'session' | 'go'>, tokenKey: string): void {
  d.local.removeItem(tokenKey);
  d.local.removeItem(REFRESH_TOKEN_KEY);
  d.session.removeItem('jg_login_tried');
  d.go(logoutUrl(d.cfg));
}
