// 線上登入（26-security，D-305）：RS256 簽章、kid、iss、aud、exp、nbf、sub；alg=none／HS256／竄改都被擋。
import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { JwtAuth } from '../server/jwtAuth';
import { ApiError } from '../src/net/protocol';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
const NOW = 1_800_000_000;
const auth = new JwtAuth({ issuer: 'https://login.example/t/v2.0', audience: 'game-api', keys: async () => [jwk], now: () => NOW * 1000 });
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const claims = { iss: 'https://login.example/t/v2.0', aud: 'game-api', sub: 'abc-123_X', exp: NOW + 600, nbf: NOW - 10 };
function tok(c: Record<string, unknown> = claims, head: Record<string, unknown> = { alg: 'RS256', kid: 'k1' }, key = privateKey): string {
  const data = `${b64(head)}.${b64(c)}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`;
}
const why = async (t: string | undefined): Promise<string> => {
  try {
    return `ok:${await auth.resolve(t)}`;
  } catch (e) {
    return e instanceof ApiError ? `${e.code}:${e.message}` : `throw:${String(e)}`;
  }
};

describe('JwtAuth', () => {
  it('合法 token → ext_<sub>', async () => {
    expect(await why(tok())).toBe('ok:ext_abc-123_X');
    expect(await why(tok({ ...claims, aud: ['x', 'game-api'] }))).toBe('ok:ext_abc-123_X');
  });
  it('擋：過期、還沒生效、別的 iss／aud、怪 sub、別人的金鑰、未知 kid、alg none／HS256、竄改內容、垃圾', async () => {
    expect(await why(tok({ ...claims, exp: NOW - 120 }))).toBe('unauthorized:exp');
    expect(await why(tok({ ...claims, nbf: NOW + 120 }))).toBe('unauthorized:nbf');
    expect(await why(tok({ ...claims, iss: 'https://evil' }))).toBe('unauthorized:iss');
    expect(await why(tok({ ...claims, aud: 'other' }))).toBe('unauthorized:aud');
    expect(await why(tok({ ...claims, sub: '../admin' }))).toBe('unauthorized:sub');
    expect(await why(tok(claims, undefined, other.privateKey))).toBe('unauthorized:signature');
    expect(await why(tok(claims, { alg: 'RS256', kid: 'k9' }))).toBe('unauthorized:kid');
    expect(await why(`${b64({ alg: 'none', kid: 'k1' })}.${b64(claims)}.`)).toBe('unauthorized:alg');
    const hsData = `${b64({ alg: 'HS256', kid: 'k1' })}.${b64(claims)}`;
    expect(await why(`${hsData}.${createHmac('sha256', JSON.stringify(jwk)).update(hsData).digest('base64url')}`)).toBe('unauthorized:alg');
    const [h, , s] = tok().split('.');
    expect(await why(`${h}.${b64({ ...claims, sub: 'someone_else' })}.${s}`)).toBe('unauthorized:signature');
    expect(await why(undefined)).toBe('unauthorized:token');
    expect(await why('a.b')).toBe('unauthorized:token');
    expect(await why('!!.!!.!!')).toBe('unauthorized:token');
  });
});
