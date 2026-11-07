// 線上版客戶端（V6 build:online，第 146 輪，D-306）：VITE_SERVER_URL 有值時 boot.ts 走這裡，**不打包 src/server**
// （本機伺服器、LocalDb、遷移舊存檔都不進線上 bundle；tests/online-bundle.test.ts 掃描）。
// 登入 token：localStorage 的 jg_online_token（之後 Entra External ID 登入畫面寫入）；
// 建置時 VITE_AUTH_MODE=dev 就自動給一個「dev:<裝置亂數>」（只對 AUTH_MODE=dev 的伺服器有效，正式伺服器一律 jwt）。
// 線上帳號從新開始（26-security：離線存檔可改檔作弊，不能匯入），所以這裡沒有 migrate.legacy／migrate.sync。
import type { CharacterView, WeaponView } from '../net/views';
import { HttpTransport } from '../net/HttpTransport';
import { GameClient } from './GameClient';
import { characterCache } from './characterCache';

export const ONLINE_TOKEN_KEY = 'jg_online_token';

function randomId(): string {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  const a = new Uint8Array(8);
  if (c?.getRandomValues) c.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 登入 token；沒有就看建置設定要不要給開發用的 */
export function onlineToken(ls: Pick<Storage, 'getItem' | 'setItem'> | undefined, devMode: boolean): string | undefined {
  const saved = ls?.getItem(ONLINE_TOKEN_KEY) ?? null;
  if (saved) return saved;
  if (!devMode) return undefined;
  const t = `dev:d${randomId()}`;
  try {
    ls?.setItem(ONLINE_TOKEN_KEY, t);
  } catch {
    /* 存不下就這次用 */
  }
  return t;
}

/** base 是伺服器根網址（例如 https://xxx.azurecontainerapps.io），結尾斜線可有可無 */
export function apiUrl(base: string, path: '/api' | '/health'): string {
  return base.replace(/\/+$/, '') + path;
}

export async function startOnlineClient(base: string, token: string | undefined, onUnauthorized?: () => void): Promise<GameClient> {
  // 冷啟動預熱（25 §4.3：API 縮到 0，第一次要幾秒）；失敗不管，之後的呼叫自己會重送
  void fetch(apiUrl(base, '/health')).catch(() => undefined);
  return new GameClient(new HttpTransport(apiUrl(base, '/api')), { token, timeoutMs: 15000, ...(onUnauthorized ? { onUnauthorized } : {}) });
}

/**
 * 線上版「目前角色」：帳號選中的角色；一個都沒有就用本機選的武器建第一個。
 * （本機版是 migrate.sync 把舊存檔同步上去；線上版不同步，伺服器的角色就是唯一的真相。）
 */
export async function onlineActive(client: GameClient, weapon: WeaponView): Promise<CharacterView> {
  const ticket = characterCache.ticket();
  const me = await findOrCreateActive(client, weapon);
  characterCache.set(me, ticket);
  return me;
}

async function findOrCreateActive(client: GameClient, weapon: WeaponView): Promise<CharacterView> {
  const [acc, list] = await Promise.all([client.call('account.get', {}), client.call('character.list', {})]);
  const cur = list.find((c) => c.id === acc.activeCharacterId) ?? list.slice().sort((a, b) => a.slot - b.slot)[0];
  if (cur) return cur;
  return client.call('character.create', { name: '旅人', weapon });
}
