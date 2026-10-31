// 橫向提示（D-216，第 82 輪）：遊戲只做直式。原生 App 已鎖直式（AndroidManifest／Info.plist），
// 但瀏覽器與 iOS 的 PWA 不一定照 manifest 鎖方向——手機橫過來時畫面縮成中間一條、戰鬥照跑。
// 觸控裝置變成橫向 → 蓋一層「請把手機轉回直式」、遊戲迴圈暫停、聲音暫停；轉回來就繼續。桌機（細指標）不管。
import type Phaser from 'phaser';
import { setAudioPaused } from '../audio/sfx';

// 高度 ≤ 600：只管橫拿的手機；平板橫放（高 ≥ 744）照舊左右留黑邊玩得下去
const QUERY = '(orientation: landscape) and (pointer: coarse) and (max-height: 600px)';

/** 純判斷（測試用）：觸控且寬大於高＝要提示 */
export function needsRotate(w: number, h: number, touch: boolean): boolean {
  return touch && w > h && h <= 600;
}

export function installOrientationGuard(game: Phaser.Game): void {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  const mq = window.matchMedia(QUERY);
  let box: HTMLDivElement | null = null;
  let asleep = false;
  const apply = (): void => {
    const on = mq.matches;
    if (on && !box) {
      box = document.createElement('div');
      box.setAttribute('role', 'alert');
      box.style.cssText =
        'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
        'background:#05040a;color:#ffe2a8;font:600 20px/1.5 system-ui,"PingFang TC","Noto Sans TC",sans-serif;text-align:center;touch-action:none';
      box.innerHTML =
        '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="#ffd27a" stroke-width="3" stroke-linecap="round">' +
        '<rect x="22" y="8" width="20" height="36" rx="4"/><path d="M29 38h6"/><path d="M10 50a24 24 0 0 0 40 4"/><path d="M50 46v8h-8"/></svg>' +
        '<div>請把手機轉回直式</div><div style="font-size:14px;font-weight:400;color:#a99f8a">遊戲已暫停，轉回來就繼續</div>';
      document.body.appendChild(box);
    }
    if (box) box.style.display = on ? 'flex' : 'none';
    if (on && !asleep) {
      asleep = true;
      game.loop.sleep();
      setAudioPaused(true);
    } else if (!on && asleep) {
      asleep = false;
      game.loop.wake();
      setAudioPaused(document.visibilityState === 'hidden');
    }
  };
  mq.addEventListener?.('change', apply);
  // 開機時就是橫的：等 Phaser 開完第一幀再睡（太早 sleep 會讓開機流程卡住）
  if (mq.matches) game.events.once('ready', apply);
}
