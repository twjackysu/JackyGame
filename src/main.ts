import Phaser from 'phaser';
import { installAudioUnlock } from './audio/sfx';
import { createGameConfig } from './game/config';
import { applySettings } from './game/settings';
import { installFpsGuard } from './game/perf/fpsGuard';
import { installBackButton } from './game/backButton';
import { installPressFx } from './game/fx/pressFx';
import { installBtnSkin } from './game/fx/btnSkin';
import { installOrientationGuard } from './game/orientation';
import { browserSwEnv, installSwUpdates } from './swUpdate';
import { installVersionCheck } from './versionCheck';
import { bootServer } from './client/boot';

installAudioUnlock();
applySettings();

// Block pinch-zoom / double-tap zoom gestures that slip past CSS on iOS Safari.
for (const evt of ['gesturestart', 'gesturechange', 'dblclick'] as const) {
  document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
}

installBtnSkin(); // 要在第一個 Text 建立之前
const game = new Phaser.Game(createGameConfig('game'));
installFpsGuard(game);
installPressFx(game);
installBackButton();
installOrientationGuard(game);
if (import.meta.env.PROD) {
  void installSwUpdates(browserSwEnv());
  // D-270：有新版就更新（標題畫面自動重整；冒險中只跳提示）
  installVersionCheck(() => game.scene.isActive('RtBattle'));
}

// D-281：遊戲裡的本機伺服器（V1 只把舊存檔複製一份過去，遊戲照舊讀寫舊存檔）
const server = bootServer();

if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
  (window as unknown as { __server?: typeof server }).__server = server;
}
