import { describe, expect, it } from 'vitest';
import { installSwUpdates, UPDATE_GAP_MS, type SwEnv } from '../src/swUpdate';

function fakeEnv(fail = false) {
  let t = 1000;
  let visible: (() => void) | null = null;
  const calls = { register: 0, update: 0 };
  const env: SwEnv = {
    register: () => {
      calls.register++;
      if (fail) return Promise.reject(new Error('no sw'));
      return Promise.resolve({
        update: () => {
          calls.update++;
          return Promise.resolve();
        },
      });
    },
    onLoad: (fn) => fn(),
    onVisible: (fn) => {
      visible = fn;
    },
    now: () => t,
  };
  return {
    env,
    calls,
    advance: (ms: number) => (t += ms),
    show: () => visible?.(),
    hasVisible: () => visible !== null,
  };
}

describe('service worker updates (D-267)', () => {
  it('checks for a new deploy on launch', async () => {
    const f = fakeEnv();
    await installSwUpdates(f.env);
    expect(f.calls.register).toBe(1);
    expect(f.calls.update).toBe(1);
  });

  it('checks again when the app returns to the foreground, throttled', async () => {
    const f = fakeEnv();
    await installSwUpdates(f.env);
    f.advance(5_000);
    f.show();
    expect(f.calls.update).toBe(1);
    f.advance(UPDATE_GAP_MS);
    f.show();
    expect(f.calls.update).toBe(2);
    f.show();
    expect(f.calls.update).toBe(2);
  });

  it('does nothing without service worker support, and survives a failed register', async () => {
    await expect(installSwUpdates(null)).resolves.toBeUndefined();
    const f = fakeEnv(true);
    await installSwUpdates(f.env);
    expect(f.calls.update).toBe(0);
    expect(f.hasVisible()).toBe(false);
  });
});
