// 角色面板（F1 多角色，D-302）：標題「角色」鈕打開。3 個角色欄：切換、建立（選武器，名字從清單挑）、刪除（按兩次）。
// 規則都在伺服器（core/meta/roster.ts）；這裡只送意圖、照伺服器的回應畫。換角色成功 resolve(true)，標題要重開。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { CHARACTER_SLOTS } from '../../core/meta/roster';
import type { CharacterView, WeaponView } from '../../net/views';
import { forgetMetThisVisit } from '../encounters';
import { createCharacter, deleteCharacter, loadRoster, switchCharacter, type RosterInfo } from '../../client/roster';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, pressBounce } from '../fx/feel';
import { WEAPON_NAME } from '../weapon';
import { pickName } from '../rosterNames';

const WEAPON_LOOK: Record<WeaponView, { fill: number; line: number; text: string }> = {
  sword: { fill: 0x2a2010, line: 0xffd27a, text: '#ffe0a0' },
  bow: { fill: 0x12200e, line: 0xc8f0a0, text: '#c8f0a0' },
  staff: { fill: 0x180e24, line: 0xdcc0ff, text: '#dcc0ff' },
};

type Btn = Phaser.GameObjects.Container;

export function openRoster(scene: Phaser.Scene, depth = 900): Promise<boolean> {
  return new Promise((resolve) => {
    const ui = scene.add.container(0, 0).setDepth(depth);
    const dim = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78).setInteractive();
    const h = 190 + CHARACTER_SLOTS * 190 + 120;
    const top = Math.max(120, Math.round(GAME_HEIGHT / 2 - h / 2 + 30));
    const g = scene.add.graphics();
    g.fillStyle(0x0a0d1a, 0.97).fillRoundedRect(40, top, GAME_WIDTH - 80, h, 24);
    g.lineStyle(2, 0xffd27a, 0.8).strokeRoundedRect(40, top, GAME_WIDTH - 80, h, 24);
    const title = scene.add.text(GAME_WIDTH / 2, top + 58, '角色', { fontFamily: TITLE_FONT, fontSize: '40px', color: '#ffd27a' }).setOrigin(0.5);
    const sub = scene.add.text(GAME_WIDTH / 2, top + 108, '最多 3 個角色：等級、行囊、金幣各自分開', { fontFamily: UI_FONT, fontSize: '20px', color: '#8a94b8' }).setOrigin(0.5);
    ui.add([dim, g, title, sub]);
    const body = scene.add.container(0, 0);
    ui.add(body);
    let busy = false;
    let info: RosterInfo | null = null;
    let creating = -1;
    let confirmDel = '';
    let note = '';

    const btn = (x: number, y: number, w: number, label: string, look: { fill: number; line: number; text: string }, fn: (() => void) | null, size = 24): Btn => {
      const c = scene.add.container(x, y);
      const bg = scene.add.graphics();
      bg.fillStyle(fn ? look.fill : 0x1a1d2c, 1).fillRoundedRect(-w / 2, -30, w, 60, 16);
      bg.lineStyle(2, fn ? look.line : 0x3a4060, fn ? 0.9 : 0.6).strokeRoundedRect(-w / 2, -30, w, 60, 16);
      const t = scene.add.text(0, 0, label, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: '700', color: fn ? look.text : '#6a7090' }).setOrigin(0.5);
      c.add([bg, t]).setSize(w, 60);
      if (fn)
        c.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          if (busy) return;
          SFX.uiTap();
          pressBounce(scene, c);
          fn();
        });
      return c;
    };
    const gold = { fill: 0x3a2c10, line: 0xffd27a, text: '#ffe08a' };
    const grey = { fill: 0x14182c, line: 0x6a7090, text: '#c0c6e0' };
    const red = { fill: 0x3a1010, line: 0xff7a7a, text: '#ffb0b0' };

    const run = (fn: () => Promise<void>) => {
      busy = true;
      void fn().finally(() => {
        busy = false;
        if (!closed) draw();
      });
    };

    let closed = false;
    const finish = (switched: boolean) => {
      closed = true;
      ui.destroy();
      resolve(switched);
    };

    const rowOf = (c: CharacterView | undefined, slot: number, y: number): Phaser.GameObjects.GameObject[] => {
      const out: Phaser.GameObjects.GameObject[] = [];
      const card = scene.add.graphics();
      const active = !!c && c.id === info?.activeId;
      card.fillStyle(active ? 0x1c1a10 : 0x14182c, 1).fillRoundedRect(70, y - 80, GAME_WIDTH - 140, 160, 18);
      if (active) card.lineStyle(3, 0xffd27a, 0.9).strokeRoundedRect(70, y - 80, GAME_WIDTH - 140, 160, 18);
      out.push(card);
      if (!c) {
        if (creating === slot) {
          out.push(scene.add.text(GAME_WIDTH / 2, y - 44, '選一把武器（之後也可以在標題換）', { fontFamily: UI_FONT, fontSize: '22px', color: '#c0c6e0' }).setOrigin(0.5));
          (['sword', 'bow', 'staff'] as const).forEach((w, i) =>
            out.push(
              btn(170 + i * 190, y + 20, 170, WEAPON_NAME[w], WEAPON_LOOK[w], () =>
                run(async () => {
                  const name = pickName(info?.characters.map((x) => x.name) ?? []);
                  const made = await createCharacter(name, w, slot);
                  if (!made) {
                    note = '建立失敗，請再試一次';
                    return;
                  }
                  if (await switchCharacter(made.id)) {
                    forgetMetThisVisit();
                    SFX.confirm();
                    finish(true);
                    return;
                  }
                  note = '切換失敗，請再試一次';
                  info = await loadRoster();
                }),
              ),
            ),
          );
        } else {
          out.push(scene.add.text(110, y, `角色欄 ${slot + 1}　空`, { fontFamily: UI_FONT, fontSize: '26px', color: '#6a7090' }).setOrigin(0, 0.5));
          out.push(btn(GAME_WIDTH - 200, y, 220, '＋ 建立新角色', gold, () => {
            creating = slot;
            draw();
          }));
        }
        return out;
      }
      const look = WEAPON_LOOK[c.weapon];
      out.push(scene.add.text(110, y - 42, c.name, { fontFamily: UI_FONT, fontSize: '32px', fontStyle: '700', color: '#ffffff' }).setOrigin(0, 0.5));
      out.push(scene.add.text(110, y + 6, `Lv ${c.level}　${WEAPON_NAME[c.weapon]}`, { fontFamily: UI_FONT, fontSize: '24px', color: look.text }).setOrigin(0, 0.5));
      out.push(scene.add.text(110, y + 46, `金幣 ${c.wallet.coin}　裝備 ${c.items.length} 件`, { fontFamily: UI_FONT, fontSize: '20px', color: '#8a94b8' }).setOrigin(0, 0.5));
      if (active) out.push(scene.add.text(GAME_WIDTH - 200, y - 30, '使用中', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: '#ffd27a' }).setOrigin(0.5));
      else
        out.push(
          btn(GAME_WIDTH - 200, y - 30, 200, '切換', gold, () =>
            run(async () => {
              if (await switchCharacter(c.id)) {
                forgetMetThisVisit();
                SFX.confirm();
                finish(true);
                return;
              }
              note = '切換失敗，請再試一次';
            }),
          ),
        );
      const canDel = !active && (info?.characters.length ?? 0) > 1;
      if (canDel)
        out.push(
          btn(GAME_WIDTH - 200, y + 40, 200, confirmDel === c.id ? '確定刪除？' : '刪除', confirmDel === c.id ? red : grey, () => {
            if (confirmDel !== c.id) {
              confirmDel = c.id;
              scene.time.delayedCall(3000, () => {
                if (confirmDel === c.id && ui.active) {
                  confirmDel = '';
                  draw();
                }
              });
              draw();
              return;
            }
            run(async () => {
              confirmDel = '';
              const err = await deleteCharacter(c.id);
              note = err ? (err.includes('market') ? '拍賣所或交易裡還有這個角色的東西，先取消' : '刪除失敗') : `已刪除「${c.name}」`;
              info = await loadRoster();
            });
          }, 22),
        );
      return out;
    };

    const draw = () => {
      body.removeAll(true);
      if (!info) {
        body.add(scene.add.text(GAME_WIDTH / 2, top + h / 2, busy ? '讀取中…' : '讀不到角色資料', { fontFamily: UI_FONT, fontSize: '28px', color: '#c0c6e0' }).setOrigin(0.5));
      } else {
        for (let s = 0; s < CHARACTER_SLOTS; s++) body.add(rowOf(info.characters.find((c) => c.slot === s), s, top + 240 + s * 190));
      }
      if (note) body.add(scene.add.text(GAME_WIDTH / 2, top + h - 112, note, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffd27a' }).setOrigin(0.5));
      body.add(btn(GAME_WIDTH / 2, top + h - 55, 220, '關閉', grey, () => finish(false), 28));
    };

    busy = true;
    draw();
    void loadRoster().then((r) => {
      info = r;
      busy = false;
      if (!closed) draw();
    });
    ui.setAlpha(0);
    scene.tweens.add({ targets: ui, alpha: 1, duration: 180 });
  });
}
