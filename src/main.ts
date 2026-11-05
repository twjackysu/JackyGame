import Phaser from 'phaser';
import { installAudioUnlock } from './audio/sfx';
import { createGameConfig } from './game/config';
import { applySettings } from './game/settings';
import { installFpsGuard } from './game/perf/fpsGuard';
import { installBackButton } from './game/backButton';
import { installOrientationGuard } from './game/orientation';
import { browserSwEnv, installSwUpdates } from './swUpdate';
import { installVersionCheck } from './versionCheck';

installAudioUnlock();
applySettings();

// Block pinch-zoom / double-tap zoom gestures that slip past CSS on iOS Safari.
for (const evt of ['gesturestart', 'gesturechange', 'dblclick'] as const) {
  document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
}

const game = new Phaser.Game(createGameConfig('game'));
installFpsGuard(game);
installBackButton();
installOrientationGuard(game);
if (import.meta.env.PROD) {
  void installSwUpdates(browserSwEnv());
  // D-270：有新版就更新（標題畫面自動重整；冒險中只跳提示）
  installVersionCheck(() => game.scene.isActive('RtBattle'));
}

if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}
