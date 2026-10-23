import Phaser from 'phaser';
import { installAudioUnlock } from './audio/sfx';
import { createGameConfig } from './game/config';

installAudioUnlock();

// Block pinch-zoom / double-tap zoom gestures that slip past CSS on iOS Safari.
for (const evt of ['gesturestart', 'gesturechange', 'dblclick'] as const) {
  document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
}

const game = new Phaser.Game(createGameConfig('game'));

if (import.meta.env.DEV) {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}
