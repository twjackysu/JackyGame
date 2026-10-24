// 商店面板（E3）：購買／出售分頁、選取 → 再點一次（或按鈕）成交、裝備可以直接替隊友換上。
// 結構注意：通關機器人會找「depth = 傳入 depth 的 Container」裡第一個可互動的 Container（商品列）與文字「離開」。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { buyPrice, canEquip, gearDelta, sellPrice, sellable, shopStock, wornTemplate } from '../../core/state/equip';
import { bagCount } from '../../core/state/gear';
import type { MemberId } from '../../core/state/gameState';
import { SHOPS, itemDef } from '../../data/equipment';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, pressBounce, sparks } from '../fx/feel';
import { gameApi, opId, session, withNames } from '../session';
import { deltaScore, deltaText, heroName, itemIcon, itemSubline, itemNameColor, perkLine } from './gearUi';

const PAGE = 6;
const ROW_H = 88;
const LIST_Y = 340;

export function openShop(scene: Phaser.Scene, shopId: string, depth = 300, discountPct = 0): Promise<void> {
  return new Promise((resolve) => {
    const s = session.state;
    const def = SHOPS[shopId] ?? SHOPS['ch1_general']!;
    const ui = scene.add.container(0, 0).setDepth(depth);
    const dim = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setInteractive();
    const g = scene.add.graphics();
    g.fillStyle(0x0a0d1a, 0.97).fillRoundedRect(24, 90, GAME_WIDTH - 48, 1110, 24);
    g.lineStyle(2, 0xffd27a, 0.8).strokeRoundedRect(24, 90, GAME_WIDTH - 48, 1110, 24);
    const title = scene.add.text(GAME_WIDTH / 2, 142, def.name, { fontFamily: TITLE_FONT, fontSize: '38px', color: '#ffd27a' }).setOrigin(0.5);
    const greet = scene.add.text(GAME_WIDTH / 2, 192, discountPct ? `${def.greet}（全部 ${discountPct}% 折扣）` : def.greet, { fontFamily: UI_FONT, fontSize: '21px', color: '#aab4dd' }).setOrigin(0.5);
    const gold = scene.add.text(GAME_WIDTH / 2, 240, '', { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: '#ffe6a0' }).setOrigin(0.5);
    const tabBuy = scene.add.text(250, 296, '購買', { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5).setPadding(24, 8, 24, 8).setInteractive({ useHandCursor: true });
    const tabSell = scene.add.text(470, 296, '出售', { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5).setPadding(24, 8, 24, 8).setInteractive({ useHandCursor: true });
    const tabG = scene.add.graphics();
    ui.add([dim, g, title, greet, gold, tabG, tabBuy, tabSell]);

    let mode: 'buy' | 'sell' = 'buy';
    let page = 0;
    let selected: string | null = null;
    let body: Phaser.GameObjects.GameObject[] = [];

    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      ui.add(o);
      body.push(o);
      return o;
    };
    const stop = (ev: Phaser.Types.Input.EventData) => ev.stopPropagation();

    const list = (): string[] => (mode === 'buy' ? shopStock(shopId) : sellable(s));

    const deal = (id: string, row?: Phaser.GameObjects.Container): void => {
      const ok = (mode === 'buy' ? gameApi.buy(opId('buy'), { itemId: id, discountPct }) : gameApi.sell(opId('sell'), { itemId: id })).ok;
      if (!ok) {
        SFX.uiCancel();
        flash(mode === 'buy' ? '金幣不夠' : '不能賣');
        return;
      }
      SFX.itemGet();
      if (row) {
        pressBounce(scene, row);
        sparks(scene, row.x + 240, row.y, 10, 'spark', 0xffd27a);
      }
      if (mode === 'sell' && bagCount(s, id) <= 0) selected = null;
      render();
    };

    let flashT: Phaser.GameObjects.Text | undefined;
    const flash = (msg: string) => {
      flashT?.destroy();
      flashT = scene.add.text(GAME_WIDTH / 2, 1110, msg, { fontFamily: UI_FONT, fontSize: '24px', color: '#ff9a9a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(depth + 1);
      const t = flashT;
      scene.tweens.add({ targets: t, alpha: 0, y: 1090, delay: 700, duration: 400, onComplete: () => t.destroy() });
    };

    const render = (): void => {
      body.forEach((o) => o.destroy());
      body = [];
      gold.setText(`◎ 金幣 ${s.gold}`);
      tabG.clear();
      const tx = mode === 'buy' ? 250 : 470;
      tabG.fillStyle(0xffd27a, 1).fillRoundedRect(tx - 60, 316, 120, 5, 2);
      tabBuy.setColor(mode === 'buy' ? '#ffd27a' : '#6a7398');
      tabSell.setColor(mode === 'sell' ? '#ffd27a' : '#6a7398');

      const ids = list();
      const pages = Math.max(1, Math.ceil(ids.length / PAGE));
      page = Math.min(page, pages - 1);
      if (selected && !ids.includes(selected)) selected = null;
      if (ids.length === 0) add(scene.add.text(GAME_WIDTH / 2, LIST_Y + 120, '背包裡沒有能賣的東西。', { fontFamily: UI_FONT, fontSize: '24px', color: '#6a7398' }).setOrigin(0.5));
      ids.slice(page * PAGE, page * PAGE + PAGE).forEach((id, i) => {
        const d = itemDef(id);
        const y = LIST_Y + i * ROW_H + ROW_H / 2;
        const price = mode === 'buy' ? buyPrice(id, discountPct) : sellPrice(id);
        const afford = mode === 'sell' || s.gold >= price;
        const sel = selected === id;
        const row = add(scene.add.container(GAME_WIDTH / 2, y));
        const bg = scene.add.graphics();
        bg.fillStyle(sel ? 0x2a2f52 : 0x151a30, 1).fillRoundedRect(-310, -40, 620, 80, 14);
        bg.lineStyle(sel ? 3 : 1.5, sel ? 0xffd27a : afford ? 0x4a5380 : 0x2a3050, 1).strokeRoundedRect(-310, -40, 620, 80, 14);
        row.add(bg);
        row.add(itemIcon(scene, id, -266, 0, 62));
        const own = bagCount(s, id);
        row.add(scene.add.text(-224, -16, d.name, { fontFamily: UI_FONT, fontSize: '25px', fontStyle: '700', color: afford ? itemNameColor(d.id) : '#6a7398' }).setOrigin(0, 0.5));
        row.add(scene.add.text(-224, 17, itemSubline(d), { fontFamily: UI_FONT, fontSize: '18px', color: '#9aa4cc' }).setOrigin(0, 0.5));
        row.add(scene.add.text(296, -14, mode === 'buy' ? `${price} 金` : `+${price} 金`, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: afford ? '#ffd27a' : '#5a6380' }).setOrigin(1, 0.5));
        row.add(scene.add.text(296, 18, `持有 ${own}`, { fontFamily: UI_FONT, fontSize: '18px', color: '#7a84a8' }).setOrigin(1, 0.5));
        row.setSize(620, 80).setInteractive({ useHandCursor: true });
        row.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
          stop(ev);
          if (selected === id) deal(id, row);
          else {
            selected = id;
            SFX.uiTap();
            render();
          }
        });
      });
      // 翻頁
      if (pages > 1) {
        const py = LIST_Y + PAGE * ROW_H + 24;
        const pt = add(scene.add.text(GAME_WIDTH / 2, py, `${page + 1} / ${pages}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#aab4dd' }).setOrigin(0.5));
        void pt;
        const mk = (x: number, label: string, dir: number) => {
          const b = add(scene.add.text(x, py, label, { fontFamily: UI_FONT, fontSize: '30px', color: '#ffd27a' }).setOrigin(0.5).setPadding(20, 6, 20, 6).setInteractive({ useHandCursor: true }));
          b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
            stop(ev);
            page = (page + dir + pages) % pages;
            SFX.uiTap();
            render();
          });
        };
        mk(GAME_WIDTH / 2 - 110, '◀', -1);
        mk(GAME_WIDTH / 2 + 110, '▶', 1);
      }
      renderDetail();
    };

    const renderDetail = (): void => {
      const top = 928;
      const box = add(scene.add.graphics());
      box.fillStyle(0x10142a, 1).fillRoundedRect(44, top, GAME_WIDTH - 88, 186, 16);
      box.lineStyle(1.5, 0x3a4270, 1).strokeRoundedRect(44, top, GAME_WIDTH - 88, 186, 16);
      if (!selected) {
        add(scene.add.text(GAME_WIDTH / 2, top + 93, mode === 'buy' ? '點商品看說明，再點一次購買。' : '點物品看說明，再點一次賣出（半價）。', { fontFamily: UI_FONT, fontSize: '22px', color: '#6a7398' }).setOrigin(0.5));
        return;
      }
      const id = selected;
      const d = itemDef(id);
      add(scene.add.text(70, top + 22, d.name, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#ffd27a' }));
      add(scene.add.text(70, top + 58, [d.desc, perkLine(d)].filter(Boolean).join('\n'), { fontFamily: UI_FONT, fontSize: '20px', color: '#c8d0f0', wordWrap: { width: 420, useAdvancedWrap: true } }));
      // 成交按鈕
      const price = mode === 'buy' ? buyPrice(id, discountPct) : sellPrice(id);
      const ok = mode === 'sell' || s.gold >= price;
      const btn = add(scene.add.container(GAME_WIDTH - 140, top + 52));
      const bb = scene.add.graphics();
      bb.fillStyle(ok ? 0xffd27a : 0x2a3050, 1).fillRoundedRect(-80, -30, 160, 60, 14);
      btn.add(bb);
      btn.add(scene.add.text(0, 0, mode === 'buy' ? `購買 ${price}` : `賣出 +${price}`, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: ok ? '#1a1206' : '#6a7398' }).setOrigin(0.5));
      btn.setSize(160, 60).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        stop(ev);
        pressBounce(scene, btn);
        deal(id);
      });
      // 裝備：隊友比較＋直接換上
      if (d.kind === 'gear' && mode === 'buy') {
        const who = s.party.filter((m) => canEquip(m, d));
        if (who.length === 0) {
          add(scene.add.text(70, top + 148, '隊伍裡沒有人能裝備。', { fontFamily: UI_FONT, fontSize: '19px', color: '#6a7398' }));
          return;
        }
        who.slice(0, 4).forEach((m: MemberId, i) => {
          const x = 70 + i * 152;
          const worn = wornTemplate(s, m, d.slot!) === id;
          const dt = gearDelta(s, m, id);
          const good = deltaScore(dt) > 0;
          const chip = add(scene.add.container(x + 70, top + 148));
          const cg = scene.add.graphics();
          cg.fillStyle(worn ? 0x1d3a2a : 0x1a1f3a, 1).fillRoundedRect(-70, -26, 144, 52, 12);
          cg.lineStyle(1.5, worn ? 0x7dffb0 : good ? 0x7dffb0 : 0x4a5380, 1).strokeRoundedRect(-70, -26, 144, 52, 12);
          chip.add(cg);
          chip.add(scene.add.text(2, -10, withNames(heroName(m)), { fontFamily: UI_FONT, fontSize: '18px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5));
          chip.add(scene.add.text(2, 12, worn ? '裝備中' : deltaText(dt) || '一樣', { fontFamily: UI_FONT, fontSize: '14px', color: worn ? '#7dffb0' : good ? '#7dffb0' : '#ff9a9a' }).setOrigin(0.5));
          chip.setSize(144, 52).setInteractive({ useHandCursor: true });
          chip.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
            stop(ev);
            if (worn) return;
            if (bagCount(s, id) <= 0) {
              SFX.uiCancel();
              flash('先買下來才能裝備');
              return;
            }
            gameApi.equip(opId('equip'), { member: m, ref: id });
            SFX.confirm();
            sparks(scene, chip.x, chip.y, 12, 'spark', 0x7dffb0);
            render();
          });
        });
        add(scene.add.text(GAME_WIDTH - 70, top + 104, '點隊友＝換上', { fontFamily: UI_FONT, fontSize: '16px', color: '#6a7398' }).setOrigin(1, 0.5));
      }
    };

    const setMode = (m: 'buy' | 'sell') => (ev: Phaser.Types.Input.EventData) => {
      stop(ev);
      if (mode === m) return;
      mode = m;
      page = 0;
      selected = null;
      SFX.uiTap();
      render();
    };
    tabBuy.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => setMode('buy')(ev));
    tabSell.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => setMode('sell')(ev));

    const leave = scene.add.text(GAME_WIDTH / 2, 1158, '離開', { fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: '#aab4dd' })
      .setOrigin(0.5).setPadding(40, 8, 40, 8).setInteractive({ useHandCursor: true });
    leave.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      stop(ev);
      SFX.uiCancel();
      session.save();
      flashT?.destroy();
      ui.destroy();
      resolve();
    });
    ui.add(leave);
    // 進場
    ui.setAlpha(0);
    scene.tweens.add({ targets: ui, alpha: 1, duration: 180 });
    render();
  });
}
