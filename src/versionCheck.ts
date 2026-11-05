// 「永遠玩到最新版」（D-270，Jacky 11/5 要求）。
//
// 每次 build 都會在 dist 放一份 version.json（vite.config.ts），內容是這次 build 的版本號、
// commit 與 commit 時間；它不進 service worker 的預先快取，每次都從網路拿。
// - 網頁／PWA：開啟時（和切回前景時）去拿 version.json；比自己新、而且還停在標題畫面 →
//   清掉 service worker 快取、帶 ?v=<build> 重新載入（避開 GitHub Pages 的 10 分鐘 HTTP 快取）。
//   已經在冒險中 → 上方跳一條「有新版本・更新」，不在戰鬥中硬重整。
// - Android／iOS App：程式包在 App 裡，只能請玩家裝新版 → 跳出提示＋「下載新版」。
// 離線、拿不到、格式不對 → 什麼都不做（遊戲完全離線也要能玩）。

export interface BuildInfo {
  version: string;
  build: string;
  /** commit 時間（毫秒）；Pages 和 APK 同一個 commit 會一樣。 */
  time: number;
}

export const REMOTE_VERSION_URL = 'https://twjackysu.github.io/JackyGame/version.json';
export const APK_URL = 'https://github.com/twjackysu/JackyGame/releases/tag/latest';
export const TRY_KEY = 'jg_upd_try';
export const CHECK_GAP_MS = 5 * 60_000;

export type UpdateAction = 'none' | 'reload' | 'banner' | 'native';

export function parseBuildInfo(x: unknown): BuildInfo | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.version !== 'string' || typeof o.build !== 'string' || typeof o.time !== 'number') return null;
  if (!Number.isFinite(o.time) || !o.build) return null;
  return { version: o.version, build: o.build, time: o.time };
}

/** 遠端比本地新：不同 build 而且 commit 時間比較晚（避免 CDN 還沒更新時倒退）。 */
export function isNewer(local: BuildInfo, remote: BuildInfo | null): boolean {
  return !!remote && remote.build !== local.build && remote.time > local.time;
}

export function decideUpdate(
  local: BuildInfo,
  remote: BuildInfo | null,
  opts: { native: boolean; inGame: boolean; tried: string | null },
): UpdateAction {
  if (!isNewer(local, remote)) return 'none';
  if (opts.native) return 'native';
  // 同一個新版已經自動重整過一次還是舊的 → 不再自動重整（避免無限重整），改跳提示。
  if (opts.inGame || opts.tried === remote!.build) return 'banner';
  return 'reload';
}

/** 重整的網址：保留原本的查詢參數（例如 debug），v 換成新 build。 */
export function reloadUrl(href: string, build: string): string {
  const u = new URL(href);
  u.searchParams.set('v', build);
  u.hash = '';
  return u.toString();
}

export function updateText(local: BuildInfo, remote: BuildInfo, mode: 'web' | 'android' | 'ios'): string {
  const ver = remote.version !== local.version ? `${remote.version}（你的是 ${local.version}）` : remote.version;
  if (mode === 'android') return `有新版本 ${ver}，下載新版 APK 直接安裝（存檔會保留）`;
  if (mode === 'ios') return `有新版本 ${ver}，請用 Xcode 重新安裝，或改玩網頁版`;
  return `有新版本 ${ver}`;
}

// ---------- 瀏覽器端 ----------

function localInfo(): BuildInfo {
  return { version: __APP_VERSION__, build: __BUILD_ID__, time: __BUILD_TIME__ };
}

type Cap = { isNativePlatform?: () => boolean; getPlatform?: () => string };
function cap(): Cap | undefined {
  return (window as unknown as { Capacitor?: Cap }).Capacitor;
}
function isNative(): boolean {
  return !!cap()?.isNativePlatform?.();
}

async function fetchRemote(native: boolean): Promise<BuildInfo | null> {
  try {
    const base = native ? REMOTE_VERSION_URL : new URL('./version.json', location.href).toString();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`${base}?t=${Date.now()}`, { cache: 'no-store', signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return parseBuildInfo(await res.json());
  } catch {
    return null;
  }
}

function ssGet(k: string): string | null {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
function ssSet(k: string, v: string): void {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

async function hardReload(build: string): Promise<void> {
  ssSet(TRY_KEY, build);
  try {
    // 先讓遊戲存檔（RtBattleScene 聽這個事件）。
    window.dispatchEvent(new Event('jg-app-hidden'));
  } catch {
    /* ignore */
  }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignore */
  }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* ignore */
  }
  location.replace(reloadUrl(location.href, build));
}

let shown: HTMLElement | null = null;

function showBar(text: string, btn: string, onBtn: () => void): void {
  if (shown) return;
  const bar = document.createElement('div');
  bar.id = 'jg-update-bar';
  bar.setAttribute('role', 'alert');
  bar.style.cssText = [
    'position:fixed', 'left:50%', 'top:calc(env(safe-area-inset-top, 0px) + 10px)', 'transform:translateX(-50%)',
    'z-index:9999', 'display:flex', 'align-items:center', 'gap:10px', 'width:max-content', 'max-width:calc(100vw - 24px)', 'box-sizing:border-box',
    'padding:10px 12px 10px 16px', 'border-radius:14px', 'background:rgba(20,16,30,.94)',
    'border:1px solid #d8b070', 'box-shadow:0 6px 24px rgba(0,0,0,.5)', 'color:#fff1d0',
    'font:15px/1.35 system-ui,"Noto Sans TC",sans-serif',
  ].join(';');
  const msg = document.createElement('span');
  msg.textContent = text;
  msg.style.cssText = 'flex:1 1 auto;min-width:0';
  const go = document.createElement('button');
  go.textContent = btn;
  go.style.cssText = 'flex:none;padding:7px 14px;border:0;border-radius:10px;background:#e8b45a;color:#2a1606;font-weight:700;font-size:15px';
  go.addEventListener('click', (e) => {
    e.stopPropagation();
    onBtn();
  });
  const x = document.createElement('button');
  x.textContent = '✕';
  x.setAttribute('aria-label', '稍後');
  x.style.cssText = 'flex:none;padding:4px 8px;border:0;background:transparent;color:#bba;font-size:16px';
  x.addEventListener('click', (e) => {
    e.stopPropagation();
    bar.remove();
  });
  for (const el of [bar, go, x]) {
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }
  bar.append(msg, go, x);
  document.body.appendChild(bar);
  shown = bar;
}

/** inGame：現在是不是在冒險中（不是標題／載入畫面）。 */
export function installVersionCheck(inGame: () => boolean): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  const native = isNative();
  const local = localInfo();
  let last = 0;
  let busy = false;
  const check = async (): Promise<void> => {
    const now = Date.now();
    if (busy || shown || now - last < CHECK_GAP_MS) return;
    busy = true;
    last = now;
    const remote = await fetchRemote(native);
    busy = false;
    const act = decideUpdate(local, remote, { native, inGame: inGame(), tried: ssGet(TRY_KEY) });
    if (act === 'none' || !remote) return;
    if (act === 'reload') {
      void hardReload(remote.build);
    } else if (act === 'banner') {
      showBar(updateText(local, remote, 'web'), '更新', () => void hardReload(remote.build));
    } else if (cap()?.getPlatform?.() === 'ios') {
      showBar(updateText(local, remote, 'ios'), '網頁版', () => {
        location.href = REMOTE_VERSION_URL.replace('version.json', '');
      });
    } else {
      showBar(updateText(local, remote, 'android'), '下載新版', () => {
        location.href = APK_URL;
      });
    }
  };
  const start = (): void => {
    void check();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void check();
    });
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
