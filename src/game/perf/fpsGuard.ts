// 效能守門員：連續一段時間 FPS 偏低時自動切換「省電畫質」並提示一次（D-034）。
// 自動化瀏覽器（navigator.webdriver）不啟用，避免 headless 的低 FPS 誤觸。
import type Phaser from 'phaser';
import { getSettings, updateSettings } from '../settings';

/** 純函式：給一串每秒取樣的 FPS，判斷是否該降畫質（最近 `window` 筆都低於門檻）。 */
export function shouldDowngrade(samples: readonly number[], threshold = 42, window = 8): boolean {
  if (samples.length < window) return false;
  return samples.slice(-window).every((f) => f > 0 && f < threshold);
}

export function installFpsGuard(game: Phaser.Game): void {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return;
  const samples: number[] = [];
  let started = 0;
  const timer = window.setInterval(() => {
    const s = getSettings();
    if (s.lowFx) {
      window.clearInterval(timer);
      return;
    }
    if (document.hidden) {
      samples.length = 0;
      return;
    }
    started++;
    if (started < 6) return; // 開場載入期不算
    samples.push(game.loop.actualFps);
    if (samples.length > 30) samples.shift();
    if (shouldDowngrade(samples)) {
      updateSettings({ lowFx: true });
      window.clearInterval(timer);
      toast('偵測到畫面不夠順，已切換「省電畫質」（可在 ⚙ 設定關閉）');
    }
  }, 1000);
}

function toast(msg: string): void {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = [
    'position:fixed', 'left:50%', 'top:12px', 'transform:translateX(-50%)', 'z-index:9999', 'max-width:90vw',
    'padding:10px 16px', 'border-radius:12px', 'background:rgba(10,13,26,.94)', 'color:#ffe9c4', 'border:1px solid #ffd27a',
    'font:14px/1.4 system-ui,sans-serif', 'text-align:center', 'pointer-events:none', 'transition:opacity .4s',
  ].join(';');
  document.body.appendChild(el);
  window.setTimeout(() => (el.style.opacity = '0'), 4500);
  window.setTimeout(() => el.remove(), 5000);
}
