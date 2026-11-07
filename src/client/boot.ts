// 開機（V1 Q2，D-281）：啟動遊戲裡的本機伺服器，第一次把舊的 localStorage 存檔遷移成帳號／角色。
// V1 這一步只「複製」：舊 key 照樣保留、遊戲照舊讀寫舊 key（玩家看到的完全不變）；V2 畫面層全部改走 GameClient 後才停寫舊 key。
// 這裡是過渡期唯一讀舊存檔的地方（之後會刪掉）。
import type { GameClient } from './GameClient';
import type { MigrateResult } from '../net/views';

/**
 * 線上版伺服器網址（D-306）：建置時 VITE_SERVER_URL 有值＝線上版（npm run build:online）。
 * Vite 在建置時把它換成字串常數，沒用到的分支（連同動態 import 的 localServer／src/server）不會打包。
 */
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? '';
export const ONLINE = SERVER_URL !== '';

export interface BootResult {
  client: GameClient;
  kind: 'idb' | 'kv' | 'memory' | 'online';
  migrate?: MigrateResult;
  error?: string;
}

/** localStorage 裡 jg_ 開頭的 key（不含備份） */
export function legacySnapshot(ls: Pick<Storage, 'key' | 'getItem' | 'length'>): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (!k || !k.startsWith('jg_') || k.startsWith('jg_backup_')) continue;
    const v = ls.getItem(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

let booted: Promise<BootResult> | null = null;

/** 啟動一次（之後呼叫拿同一個結果）；任何錯誤都不影響遊戲（只記下來） */
export function bootServer(): Promise<BootResult> {
  return (booted ??= (async () => {
    if (import.meta.env.VITE_SERVER_URL) {
      // 線上版：不遷移舊存檔（26-security：線上帳號從新開始）
      const { startOnlineClient, onlineToken } = await import('./onlineClient');
      let ls: Storage | undefined;
      try {
        ls = localStorage;
      } catch {
        ls = undefined;
      }
      let token = onlineToken(ls, import.meta.env.VITE_AUTH_MODE === 'dev');
      let loginError: string | undefined;
      // 正式登入（第 148 輪）：建置時設了 Entra 才走 PKCE；沒登入就整頁轉去登入頁（同一個分頁只自動轉一次，失敗不會一直轉）
      if (import.meta.env.VITE_ENTRA_AUTHORITY && import.meta.env.VITE_ENTRA_CLIENT_ID && ls) {
        const { beginLogin, finishLogin } = await import('./oidcLogin');
        const { ONLINE_TOKEN_KEY } = await import('./onlineClient');
        const deps = {
          cfg: { authority: import.meta.env.VITE_ENTRA_AUTHORITY, clientId: import.meta.env.VITE_ENTRA_CLIENT_ID, redirectUri: location.origin + location.pathname },
          local: ls,
          session: sessionStorage,
          random: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
          sha256: (d: Uint8Array) => crypto.subtle.digest('SHA-256', new Uint8Array(d)),
          fetch: (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => fetch(url, init),
          go: (url: string) => location.assign(url),
          now: () => Date.now(),
        };
        try {
          const r = await finishLogin(deps, location.search, ONLINE_TOKEN_KEY);
          if (r.handled) history.replaceState(null, '', location.pathname);
          token = r.token;
          loginError = r.error;
          if (token) sessionStorage.removeItem('jg_login_tried');
          else if (!r.error && !sessionStorage.getItem('jg_login_tried')) {
            sessionStorage.setItem('jg_login_tried', '1');
            await beginLogin(deps);
          }
        } catch (e) {
          loginError = e instanceof Error ? e.message : String(e);
        }
      }
      const client = await startOnlineClient(import.meta.env.VITE_SERVER_URL, token);
      return { client, kind: 'online' as const, ...(loginError ? { error: `login: ${loginError}` } : {}) };
    }
    const { startLocalServer } = await import('./localServer');
    const { client, kind } = await startLocalServer();
    const out: BootResult = { client, kind };
    try {
      const acc = await client.call('account.get', {});
      if (!acc.migrated) {
        const snap = legacySnapshot(localStorage);
        const hasBackup = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).some((k) => k?.startsWith('jg_backup_'));
        if (Object.keys(snap).length && !hasBackup) {
          try {
            localStorage.setItem(`jg_backup_${Date.now()}`, JSON.stringify(snap));
          } catch {
            /* 空間不夠就不備份（舊 key 本來就還在） */
          }
        }
        out.migrate = await client.call('migrate.legacy', { snapshot: snap });
      }
    } catch (e) {
      out.error = e instanceof Error ? e.message : String(e);
    }
    return out;
  })());
}
