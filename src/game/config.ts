import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { BattleScene } from './scenes/BattleScene';
import { DialogueScene } from './scenes/DialogueScene';
import { MapScene } from './scenes/MapScene';
import { CardScene } from './scenes/CardScene';
import { ExploreScene } from './scenes/ExploreScene';
import { ExploreHudScene } from './scenes/ExploreHudScene';

/** Portrait 9:16 design resolution. Everything is laid out in these units. */
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const COLORS = {
  bg: 0x0b0f1e,
  bgHex: '#0b0f1e',
  ember: 0xffa54a,
  gold: 0xffd27a,
  skyTop: 0x05060f,
  skyMid: 0x1a1240,
  skyBottom: 0x3a1a3a,
} as const;

export function createGameConfig(parent: string | HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: COLORS.bgHex,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      powerPreference: 'high-performance',
    },
    input: {
      activePointers: 3,
    },
    scene: [BootScene, TitleScene, BattleScene, DialogueScene, MapScene, CardScene, ExploreScene, ExploreHudScene],
  };
}
