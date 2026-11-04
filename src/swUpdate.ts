// Service worker registration that actively checks for a new deploy (D-267).
//
// The stock `registerSW.js` only calls `register()`; Chromium then often skips the
// update check on later launches (tested: three reloads after a new deploy still ran
// the old build). We call `update()` on every launch and whenever the app comes back
// to the foreground, throttled so a quick tab switch doesn't refetch. With
// `skipWaiting` + `clientsClaim` the new worker takes over at once; the new build
// shows on the next launch/reload. We never force-reload a running game.

export const UPDATE_GAP_MS = 60_000;

interface SwReg {
  update(): Promise<unknown>;
}
export interface SwEnv {
  register(url: string, opts: { scope: string }): Promise<SwReg>;
  onLoad(fn: () => void): void;
  onVisible(fn: () => void): void;
  now(): number;
}

/** Returns a promise for tests; callers can ignore it. */
export function installSwUpdates(env: SwEnv | null): Promise<void> {
  if (!env) return Promise.resolve();
  return new Promise((resolve) => {
    env.onLoad(() => {
      env
        .register('./sw.js', { scope: './' })
        .then((reg) => {
          let last = env.now();
          // The first `register()` already fetches sw.js when nothing is installed;
          // when one is installed it may not, so ask explicitly.
          reg.update().catch(() => {});
          env.onVisible(() => {
            const t = env.now();
            if (t - last < UPDATE_GAP_MS) return;
            last = t;
            reg.update().catch(() => {});
          });
        })
        .catch(() => {})
        .finally(() => resolve());
    });
  });
}

export function browserSwEnv(): SwEnv | null {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const sw = navigator.serviceWorker;
  return {
    register: (url, opts) => sw.register(url, opts),
    onLoad: (fn) => {
      if (document.readyState === 'complete') fn();
      else window.addEventListener('load', fn, { once: true });
    },
    onVisible: (fn) =>
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') fn();
      }),
    now: () => Date.now(),
  };
}
