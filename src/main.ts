import Phaser from 'phaser';
import { installAudioUnlock } from './audio/sfx';
import { createGameConfig } from './game/config';
import { applySettings } from './game/settings';
import { installFpsGuard } from './game/perf/fpsGuard';
import { installBackButton } from './game/backButton';

installAudioUnlock();
applySettings();

// Block pinch-zoom / double-tap zoom gestures that slip past CSS on iOS Safari.
for (const evt of ['gesturestart', 'gesturechange', 'dblclick'] as const) {
  document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
}

const game = new Phaser.Game(createGameConfig('game'));
installFpsGuard(game);
installBackButton();

if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}
