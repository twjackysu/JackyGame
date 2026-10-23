// 隊伍編成面板（地圖用）：點兩位成員交換位置；前 3 位上場，連恩必須上場。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { ACTIVE_PARTY, swapPartyMembers, type MemberId } from '../../core/state/gameState';
import { HEROES } from '../../data/combatants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, pressBounce } from '../fx/feel';
import { session } from '../session';

export const HERO_COLOR: Record<string, number> = { lian: 0xffa54a, rourke: 0xe0705a, io: 0x7fd8ff, serin: 0xc8d4ff, liora: 0xff7a5a };

const ROLE: Record<string, string> = {
  lian: '提燈・燈印與共鳴',
  serin: '前鋒・破防與承傷',
  liora: '火術・範圍爆破',
  io: '水歌・回復與淨化',
  rourke: '重甲・挑釁與反擊',
};

const ELEM: Record<string, string> = { light: '光', phys: '物', fire: '火', water: '水' };

/** 開啟隊伍面板；關閉時 resolve（有變更時已自動存檔）。 */
export function openParty(scene: Phaser.Scene, depth = 900): Promise<void> {
  return new Promise((resolve) => {
    const ui = scene.add.container(0, 0).setDepth(depth);
    const dim = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78).setInteractive();
    const n = session.state.party.length;
    const top = 220;
    const rowH = 132;
    const h = 200 + n * rowH + 60 + 110;
    const g = scene.add.graphics();
    g.fillStyle(0x0a0d1a, 0.97).fillRoundedRect(40, top, GAME_WIDTH - 80, h, 24);
    g.lineStyle(2, 0xffd27a, 0.8).strokeRoundedRect(40, top, GAME_WIDTH - 80, h, 24);
    const title = scene.add.text(GAME_WIDTH / 2, top + 56, '隊伍編成', { fontFamily: TITLE_FONT, fontSize: '40px', color: '#ffd27a' }).setOrigin(0.5);
    const hint = scene.add.text(GAME_WIDTH / 2, top + 108, '點兩位成員交換位置・前 3 位出戰', { fontFamily: UI_FONT, fontSize: '22px', color: '#8a94b8' }).setOrigin(0.5);
    const msg = scene.add.text(GAME_WIDTH / 2, top + h - 140, '', { fontFamily: UI_FONT, fontSize: '22px', color: '#ff9a7a' }).setOrigin(0.5);
    ui.add([dim, g, title, hint, msg]);

    let selected = -1;
    const rows: Phaser.GameObjects.Container[] = [];
    const rowY = (i: number) => top + 200 + i * rowH + (i >= ACTIVE_PARTY ? 60 : 0);
    const divider = scene.add.text(GAME_WIDTH / 2, rowY(ACTIVE_PARTY) - 88, '— 待命 —', { fontFamily: UI_FONT, fontSize: '22px', color: '#6a7398' }).setOrigin(0.5);
    divider.setVisible(n > ACTIVE_PARTY);
    ui.add(divider);

    const build = () => {
      rows.forEach((r) => r.destroy());
      rows.length = 0;
      session.state.party.forEach((m: MemberId, i) => {
        const active = i < ACTIVE_PARTY;
        const row = scene.add.container(GAME_WIDTH / 2, rowY(i));
        const bg = scene.add.graphics();
        const col = HERO_COLOR[m] ?? 0xffffff;
        const sel = i === selected;
        bg.fillStyle(sel ? 0x2a2f50 : active ? 0x161b30 : 0x0f1222, 1).fillRoundedRect(-300, -56, 600, 112, 18);
        bg.lineStyle(sel ? 3 : 2, sel ? 0xffd27a : col, sel ? 1 : active ? 0.7 : 0.25).strokeRoundedRect(-300, -56, 600, 112, 18);
        bg.fillStyle(0x0a0d1a, 1).fillCircle(-232, 0, 38);
        bg.lineStyle(3, col, active ? 1 : 0.45).strokeCircle(-232, 0, 38);
        const def = HEROES[m];
        const mem = session.state.members[m];
        const initial = scene.add.text(-232, 0, (def?.name ?? m).slice(0, 1), { fontFamily: UI_FONT, fontSize: '32px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5);
        const name = scene.add.text(-176, -22, `${def?.name ?? m}　Lv ${mem?.level ?? 1}`, { fontFamily: UI_FONT, fontSize: '28px', color: active ? '#ffffff' : '#9aa2c0' }).setOrigin(0, 0.5);
        const role = scene.add.text(-176, 22, `${ROLE[m] ?? ''}　〔${ELEM[def?.attackElement ?? 'phys']}〕`, { fontFamily: UI_FONT, fontSize: '20px', color: '#8a94b8' }).setOrigin(0, 0.5);
        const badge = scene.add.text(270, 0, active ? '出戰' : '待命', {
          fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: active ? '#0a0d1a' : '#c0c6e0',
          backgroundColor: active ? '#ffd27a' : '#3a4060', padding: { x: 12, y: 6 },
        }).setOrigin(1, 0.5);
        row.add([bg, initial, name, role, badge]).setSize(600, 112).setInteractive({ useHandCursor: true });
        row.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          SFX.uiTap();
          pressBounce(scene, row);
          msg.setText('');
          if (selected < 0) {
            selected = i;
          } else if (selected === i) {
            selected = -1;
          } else {
            const next = swapPartyMembers(session.state.party, selected, i);
            if (next) {
              session.state.party = next;
              session.save();
              SFX.lampPlace(1);
            } else {
              msg.setText('連恩必須出戰');
              scene.cameras.main.shake(120, 0.004);
            }
            selected = -1;
          }
          build();
        });
        ui.add(row);
        rows.push(row);
      });
    };
    build();

    const close = scene.add.container(GAME_WIDTH / 2, top + h - 70);
    const cbg = scene.add.graphics();
    cbg.fillStyle(0xffd27a, 1).fillRoundedRect(-140, -36, 280, 72, 36);
    const ct = scene.add.text(0, 0, '完成', { fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: '#0a0d1a' }).setOrigin(0.5);
    close.add([cbg, ct]).setSize(280, 72).setInteractive({ useHandCursor: true });
    close.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      ui.destroy();
      resolve();
    });
    ui.add(close);
    ui.setAlpha(0);
    scene.tweens.add({ targets: ui, alpha: 1, duration: 160 });
  });
}
