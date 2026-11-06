// ADO.NET 連線字串 → tedious 設定（25 §4.5，D-279）。Jacky 用 GAME_DB_CONNECTION_STRING 自己填，不進 git。
// 支援 JackyAIStudio 常見寫法：帳密、Managed Identity、Server=tcp:host,port、(localdb)（回 driver: 'msnodesqlv8'）。

export interface DbTarget {
  driver: 'tedious' | 'msnodesqlv8';
  server: string;
  port?: number;
  database?: string;
  auth: { type: 'sql'; user: string; password: string } | { type: 'managed-identity'; clientId?: string } | { type: 'default' } | { type: 'windows' };
  encrypt: boolean;
  trustServerCertificate: boolean;
  connectTimeoutMs?: number;
  /** 原字串（msnodesqlv8 直接用） */
  raw: string;
}

/** key=value; 解析（值可以用 {} 或 "" 包住含分號的內容）；key 不分大小寫、空白忽略 */
export function parsePairs(s: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < s.length) {
    const eq = s.indexOf('=', i);
    if (eq < 0) break;
    const key = s.slice(i, eq).trim().toLowerCase().replace(/\s+/g, ' ');
    let j = eq + 1;
    while (s[j] === ' ') j++;
    let val = '';
    const q = s[j];
    if (q === '{' || q === '"' || q === "'") {
      const close = q === '{' ? '}' : q;
      let k = j + 1;
      for (; k < s.length; k++) {
        if (s[k] === close) {
          if (s[k + 1] === close) {
            val += close;
            k++;
            continue;
          }
          break;
        }
        val += s[k];
      }
      j = k + 1;
      const semi = s.indexOf(';', j);
      i = semi < 0 ? s.length : semi + 1;
    } else {
      const semi = s.indexOf(';', j);
      val = (semi < 0 ? s.slice(j) : s.slice(j, semi)).trim();
      i = semi < 0 ? s.length : semi + 1;
    }
    if (key) out.set(key, val);
  }
  return out;
}

const pick = (m: Map<string, string>, ...keys: string[]): string | undefined => {
  for (const k of keys) if (m.has(k)) return m.get(k);
  return undefined;
};
const yes = (v: string | undefined, d: boolean): boolean => (v === undefined ? d : ['true', 'yes', '1', 'mandatory', 'strict'].includes(v.toLowerCase()));

export function parseConnectionString(raw: string): DbTarget {
  const m = parsePairs(raw);
  let server = pick(m, 'server', 'data source', 'address', 'addr', 'network address') ?? '';
  if (!server) throw new Error('connection string: missing Server');
  server = server.replace(/^tcp:/i, '');
  let port: number | undefined;
  const comma = server.lastIndexOf(',');
  if (comma > 0) {
    port = Number(server.slice(comma + 1));
    server = server.slice(0, comma);
  }
  const database = pick(m, 'database', 'initial catalog');
  const user = pick(m, 'user id', 'uid', 'user');
  const password = pick(m, 'password', 'pwd') ?? '';
  const authKw = (pick(m, 'authentication') ?? '').toLowerCase();
  const local = /^\(localdb\)/i.test(server);
  let auth: DbTarget['auth'];
  if (authKw.includes('managed identity') || authKw.includes('msi')) auth = { type: 'managed-identity', clientId: user };
  else if (authKw.includes('default')) auth = { type: 'default' };
  else if (yes(pick(m, 'trusted_connection', 'integrated security'), false)) auth = { type: 'windows' };
  else if (user) auth = { type: 'sql', user, password };
  else auth = { type: 'default' };
  const timeout = pick(m, 'connect timeout', 'connection timeout');
  return {
    driver: local ? 'msnodesqlv8' : 'tedious',
    server,
    port: Number.isFinite(port) ? port : undefined,
    database,
    auth,
    encrypt: yes(pick(m, 'encrypt'), true),
    trustServerCertificate: yes(pick(m, 'trustservercertificate', 'trust server certificate'), false),
    connectTimeoutMs: timeout ? Number(timeout) * 1000 : undefined,
    raw,
  };
}

/** 給 log 用：把密碼遮掉 */
export function redact(raw: string): string {
  return raw.replace(/((?:password|pwd)\s*=\s*)(\{[^}]*\}|"[^"]*"|[^;]*)/gi, '$1***');
}
