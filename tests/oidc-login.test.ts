// 線上版登入（第 148 輪，src/client/oidcLogin.ts）：PKCE（RFC 7636 的範例向量）、登入頁網址、回來時 state 要對、換 token、過期判斷。
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authorizeUrl, beginLogin, finishLogin, parseRedirect, pkceChallenge, tokenSecondsLeft, type LoginDeps } from '../src/client/oidcLogin';

const sha256 = async (d: Uint8Array): Promise<ArrayBuffer> => {
  const b = createHash('sha256').update(d).digest();
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const cfg = { authority: 'https://jg.ciamlogin.com/jg.onmicrosoft.com/', clientId: 'cid-123', redirectUri: 'https://twjackysu.github.io/JackyGame/online/' };
const kv = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const jwt = (exp: number) => `h.${Buffer.from(JSON.stringify({ sub: 'u1', exp })).toString('base64url')}.s`;

describe('線上版登入（PKCE）', () => {
  it('RFC 7636 範例：verifier → challenge', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', sha256)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('登入頁網址：授權碼＋S256＋state，authority 結尾斜線可有可無', () => {
    const u = new URL(authorizeUrl(cfg, 'CH', 'ST'));
    expect(u.origin + u.pathname).toBe('https://jg.ciamlogin.com/jg.onmicrosoft.com/oauth2/v2.0/authorize');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ client_id: 'cid-123', response_type: 'code', code_challenge: 'CH', code_challenge_method: 'S256', state: 'ST', redirect_uri: cfg.redirectUri });
  });

  it('回來的網址：state 不對＝錯誤；沒有 code＝不是登入回來', () => {
    expect(parseRedirect('?code=abc&state=X', 'X')).toEqual({ code: 'abc' });
    expect(parseRedirect('?code=abc&state=Y', 'X')).toEqual({ error: 'state' });
    expect(parseRedirect('?code=abc&state=X', null)).toEqual({ error: 'state' });
    expect(parseRedirect('?error=access_denied', 'X')).toEqual({ error: 'access_denied' });
    expect(parseRedirect('?debug', 'X')).toBeNull();
  });

  it('整段：beginLogin 轉頁 → 回來 finishLogin 用同一個 verifier 換 id_token、存起來；重整之後讀存的', async () => {
    const local = kv();
    const session = kv();
    let went = '';
    let posted: { url: string; body: string } | null = null;
    let n = 0;
    const now = 1_800_000_000_000;
    const token = jwt(now / 1000 + 3600);
    const d: LoginDeps = {
      cfg,
      local,
      session,
      random: (k) => Uint8Array.from({ length: k }, () => (n++ * 37) & 255),
      sha256,
      fetch: async (url, init) => {
        posted = { url, body: init.body };
        return { ok: true, json: async () => ({ id_token: token }) };
      },
      go: (u) => {
        went = u;
      },
      now: () => now,
    };
    await beginLogin(d);
    const at = new URL(went);
    const state = at.searchParams.get('state')!;
    const challenge = at.searchParams.get('code_challenge')!;
    const r = await finishLogin(d, `?code=THE_CODE&state=${state}`, 'jg_online_token');
    expect(r).toEqual({ token, handled: true });
    const body = new URLSearchParams(posted!.body);
    expect(posted!.url).toBe('https://jg.ciamlogin.com/jg.onmicrosoft.com/oauth2/v2.0/token');
    expect(body.get('code')).toBe('THE_CODE');
    expect(body.get('grant_type')).toBe('authorization_code');
    // 送出去的 verifier 雜湊後＝當初登入頁的 challenge
    expect(await pkceChallenge(body.get('code_verifier')!, sha256)).toBe(challenge);
    expect(local.m.get('jg_online_token')).toBe(token);
    expect(session.m.size).toBe(0);
    // 重整：沒有 code → 讀存的；快過期／dev token 當沒登入
    expect(await finishLogin(d, '', 'jg_online_token')).toEqual({ token, handled: false });
    local.setItem('jg_online_token', jwt(now / 1000 + 30));
    expect((await finishLogin(d, '', 'jg_online_token')).token).toBeUndefined();
    local.setItem('jg_online_token', 'dev:abc');
    expect((await finishLogin(d, '', 'jg_online_token')).token).toBeUndefined();
    // 重放同一個 code（state 已經用掉）
    expect((await finishLogin(d, `?code=THE_CODE&state=${state}`, 'jg_online_token')).error).toBe('state');
  });

  it('過期秒數：壞掉的 token 當已過期', () => {
    expect(tokenSecondsLeft(jwt(1000), 900_000)).toBe(100);
    expect(tokenSecondsLeft('garbage', 0)).toBe(-1);
  });
});

describe('登入過期（GameClient.onUnauthorized）', () => {
  it('伺服器回 unauthorized：叫一次 onUnauthorized（之後不再叫），錯誤照樣丟給呼叫的人；其他錯誤不叫', async () => {
    const { GameClient } = await import('../src/client/GameClient');
    const { LocalTransport } = await import('../src/net/LocalTransport');
    let code = 'unauthorized';
    const t = new LocalTransport(async (j) => JSON.stringify({ id: (JSON.parse(j) as { id: number }).id, ok: false, error: { code, message: 'x' } }));
    let n = 0;
    const c = new GameClient(t, { token: 'old', onUnauthorized: () => n++ });
    await expect(c.call('character.list', {})).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(c.call('character.list', {})).rejects.toMatchObject({ code: 'unauthorized' });
    expect(n).toBe(1);
    code = 'rejected';
    const c2 = new GameClient(t, { onUnauthorized: () => n++ });
    await expect(c2.call('character.list', {})).rejects.toMatchObject({ code: 'rejected' });
    expect(n).toBe(1);
  });
});
