// Android 返回鍵／返回手勢（第 80 輪，D-212）
// 以前沒有處理：Capacitor 沒裝 @capacitor/app 時按返回鍵＝直接關掉 App（打到一半手滑就跳出去）。
// 現在：遊戲中按返回＝關掉最上層面板（點它的「返回／關閉／離開／完成／繼續」），沒有面板就開暫停選單；
// 標題畫面按一次提示「再按一次返回鍵離開」，2 秒內再按才離開。
// 網頁版（PWA／瀏覽器）用 history.pushState 擋一層：返回手勢一樣先交給遊戲處理。
import Phaser from 'phaser';

/** 'handled'＝遊戲處理掉了；'exit'＝讓系統離開（App 關閉／網頁上一頁） */
export type BackResult = 'handled' | 'exit';
type Handler = () => BackResult;

let handler: Handler | null = null;

/** 場景 create 時登記；場景關掉時自動清掉（只清自己登記的） */
export function setBackHandler(scene: Phaser.Scene, fn: Handler): void {
  handler = fn;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (handler === fn) handler = null;
  });
}

/** 測試／除錯用：模擬按一次返回鍵 */
export function pressBack(): BackResult {
  return handler ? handler() : 'exit';
}

/** 面板上可以當「上一步」按的字（依序找；「認輸離開」這種會有後果的不算） */
export const BACK_LABELS = ['返回', '關閉', '離開', '完成', '繼續'] as const;

function shown(o: Phaser.GameObjects.GameObject): boolean {
  for (let c: Phaser.GameObjects.GameObject | null = o; c; c = (c as Phaser.GameObjects.Text).parentContainer ?? null) {
    const v = c as unknown as { visible?: boolean; alpha?: number; active?: boolean };
    if (v.visible === false || (v.alpha ?? 1) < 0.05 || v.active === false) return false;
  }
  return true;
}

/**
 * 在 root 底下找看得到的返回類按鈕並「點」它（往上找有 pointerdown 監聽的物件）。
 * 找到回 true。和 Playwright 截圖腳本的 clk 同一套作法。
 */
export function clickBackButton(root: readonly Phaser.GameObjects.GameObject[]): boolean {
  const texts: Phaser.GameObjects.Text[] = [];
  const walk = (l: readonly Phaser.GameObjects.GameObject[]): void => {
    for (const o of l) {
      const list = (o as Phaser.GameObjects.Container).list;
      if (list) walk(list);
      else if (o instanceof Phaser.GameObjects.Text && shown(o)) texts.push(o);
    }
  };
  walk(root);
  for (const label of BACK_LABELS) {
    // 後加的（畫面上層的）先點
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]!;
      if (t.text.trim() !== label) continue;
      for (let o: Phaser.GameObjects.GameObject | null = t; o; o = (o as Phaser.GameObjects.Text).parentContainer ?? null) {
        if (o.listenerCount('pointerdown') > 0) {
          o.emit('pointerdown', { x: t.x, y: t.y }, 0, 0, { stopPropagation() {} });
          return true;
        }
      }
    }
  }
  return false;
}

let installed = false;

/** main.ts 開機時呼叫一次 */
export function installBackButton(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) {
    void import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('backButton', () => {
          if (pressBack() === 'exit') void App.exitApp();
        }),
      )
      .catch(() => {
        /* 外掛沒裝：維持系統預設 */
      });
    return;
  }
  // 網頁：多推一層歷史，返回手勢先回到這層 → 交給遊戲
  try {
    history.pushState({ jgGuard: 1 }, '');
    window.addEventListener('popstate', () => {
      if (pressBack() === 'handled') history.pushState({ jgGuard: 1 }, '');
      else history.back();
    });
  } catch {
    /* 沙盒環境不給改歷史 */
  }
}
