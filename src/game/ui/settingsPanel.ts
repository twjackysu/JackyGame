// 設定面板（標題、地圖共用）：自動時機、BGM、音效、文字速度。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, pressBounce } from '../fx/feel';
import { getSettings, updateSettings, type Settings } from '../settings';

type Row = { label: string; desc: string; value: (s: Settings) => string; toggle: (s: Settings) => Partial<Settings> };

const ROWS: Row[] = [
  { label: '背景音樂', desc: '', value: (s) => (s.bgm ? '開' : '關'), toggle: (s) => ({ bgm: !s.bgm }) },
  { label: '音效', desc: '', value: (s) => (s.sfx ? '開' : '關'), toggle: (s) => ({ sfx: !s.sfx }) },
  { label: '省電畫質', desc: '粒子減量、關閉光暈濾鏡（手機發燙或卡頓時開）', value: (s) => (s.lowFx ? '開' : '關'), toggle: (s) => ({ lowFx: !s.lowFx }) },
];

/** 開啟設定面板；關閉時 resolve。 */
export function openSettings(scene: Phaser.Scene, depth = 900): Promise<void> {
  return new Promise((resolve) => {
    const ui = scene.add.container(0, 0).setDepth(depth);
    const dim = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setInteractive();
    const top = 300;
    const h = 150 + ROWS.length * 120 + 110;
    const g = scene.add.graphics();
    g.fillStyle(0x0a0d1a, 0.97).fillRoundedRect(50, top, GAME_WIDTH - 100, h, 24);
    g.lineStyle(2, 0xffd27a, 0.8).strokeRoundedRect(50, top, GAME_WIDTH - 100, h, 24);
    const title = scene.add.text(GAME_WIDTH / 2, top + 60, '設定', { fontFamily: TITLE_FONT, fontSize: '40px', color: '#ffd27a' }).setOrigin(0.5);
    ui.add([dim, g, title]);
    ROWS.forEach((r, i) => {
      const y = top + 160 + i * 120;
      const row = scene.add.container(GAME_WIDTH / 2, y);
      const bg = scene.add.graphics();
      bg.fillStyle(0x14182c, 1).fillRoundedRect(-280, -50, 560, 100, 16);
      const lt = scene.add.text(-256, r.desc ? -16 : 0, r.label, { fontFamily: UI_FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0, 0.5);
      const parts: Phaser.GameObjects.GameObject[] = [bg, lt];
      if (r.desc) parts.push(scene.add.text(-256, 24, r.desc, { fontFamily: UI_FONT, fontSize: '18px', color: '#8a94b8' }).setOrigin(0, 0.5));
      const pill = scene.add.graphics();
      const vt = scene.add.text(206, 0, '', { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: '#0a0d1a' }).setOrigin(0.5);
      parts.push(pill, vt);
      const refresh = () => {
        const v = r.value(getSettings());
        const on = v !== '關';
        pill.clear().fillStyle(on ? 0xffd27a : 0x3a4060, 1).fillRoundedRect(156, -28, 100, 56, 28);
        vt.setText(v).setColor(on ? '#0a0d1a' : '#c0c6e0');
      };
      refresh();
      row.add(parts).setSize(560, 100).setInteractive({ useHandCursor: true });
      row.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        updateSettings(r.toggle(getSettings()));
        SFX.uiTap();
        pressBounce(scene, row);
        refresh();
      });
      ui.add(row);
    });
    const close = scene.add.text(GAME_WIDTH / 2, top + h - 55, '關閉', { fontFamily: UI_FONT, fontSize: '32px', fontStyle: '700', color: '#aab4dd' })
      .setOrigin(0.5).setPadding(40, 10, 40, 10).setInteractive({ useHandCursor: true });
    close.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiCancel();
      ui.destroy();
      resolve();
    });
    ui.add(close);
    ui.setAlpha(0);
    scene.tweens.add({ targets: ui, alpha: 1, duration: 180 });
  });
}
