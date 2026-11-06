// 帳號共用倉庫（F1，第 145 輪，D-302）：營火行商「倉庫」分頁。上面是倉庫（點一下拿回行囊），下面是行囊（點一下放進倉庫）。
// 同一個帳號的角色都拿得到——換個角色就能用另一個角色打到的裝備。所有動作交給伺服器（warehouseOps）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { RARITY_COLOR, isGear, type RtGear } from '../../core/battle/rt/gear';
import { BAG_MAX } from '../../core/meta/bag';
import type { ItemView } from '../../net/views';
import { GAME_HEIGHT, GAME_WIDTH, TALL } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import type { WarehouseOps, WarehousePage } from '../warehouseOps';
import { gearTitleW } from '../weapon';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const ROWS = 6;
const FAILED: Record<string, string> = { 'warehouse full': '倉庫滿了', 'bag full': '行囊滿了', item: '那件已經不在了' };

export function openWarehousePanel(scene: Phaser.Scene, ops: WarehouseOps, onClose: () => void): Phaser.GameObjects.Container {
  const EXIT_Y = 560 + Math.round(TALL * 0.4);
  const root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(960);
  let data: WarehousePage | null = null;
  let busy = false;
  let error = false;
  let whPage = 0;
  let bagPage = 0;

  let lastToast: Phaser.GameObjects.Text | null = null;
  const toast = (msg: string, col = '#ffd27a'): void => {
    lastToast?.destroy();
    const y0 = GAME_HEIGHT / 2 + 410;
    const t = (lastToast = scene.add.text(GAME_WIDTH / 2, y0, msg, { fontFamily: TITLE_FONT, fontSize: '30px', color: col, stroke: '#000', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setDepth(990));
    scene.tweens.add({ targets: t, y: y0 - 40, alpha: 0, delay: 1300, duration: 700, onComplete: () => t.destroy() });
  };
  root.once('destroy', () => {
    if (lastToast) scene.tweens.killTweensOf(lastToast);
    lastToast?.destroy();
  });

  const run = (p: () => Promise<WarehousePage | null>, ok?: string): void => {
    if (busy) return;
    busy = true;
    render();
    void p().then((d) => {
      busy = false;
      if (!root.active) return;
      error = !d;
      if (!d) {
        render();
        return toast('倉庫暫時打不開，等一下再試', '#ff9a8a');
      }
      data = d;
      if (d.failed) toast(FAILED[d.failed] ?? `沒辦法：${d.failed}`, '#ff9a8a');
      else if (ok) {
        SFX.itemGet();
        toast(ok);
      }
      render();
    });
  };

  const btn = (x: number, y: number, label: string, fn: () => void, hi = false, size = 24): Phaser.GameObjects.Text =>
    scene.add
      .text(x, y, label, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: '700', color: hi ? '#1a0f08' : '#ffffff', backgroundColor: hi ? '#ffd27a' : '#3a2a14' })
      .setOrigin(0.5)
      .setPadding(16, 8, 16, 8)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.uiTap();
        fn();
      });

  const gearRow = (y: number, it: ItemView, right: string, fn: (() => void) | undefined): Phaser.GameObjects.GameObject[] => {
    const g = isGear(it.gear) ? (it.gear as unknown as RtGear) : null;
    const col = g ? RARITY_COLOR[g.rarity] : 0x808080;
    const bg = scene.add.rectangle(0, y, 640, 50, 0x1a140c, 0.95).setStrokeStyle(2, col, 0.9);
    if (fn)
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        if (busy) return;
        SFX.uiTap();
        fn();
      });
    return [
      bg,
      scene.add.text(-300, y, g ? gearTitleW(g) : '？', { fontFamily: UI_FONT, fontSize: '22px', color: hex(col) }).setOrigin(0, 0.5),
      scene.add.text(300, y, right, { fontFamily: UI_FONT, fontSize: '20px', color: '#c8b898' }).setOrigin(1, 0.5),
    ];
  };

  /** 一個分頁的清單：標題列＋◀ ▶＋最多 ROWS 列 */
  const list = (items: Phaser.GameObjects.GameObject[], y0: number, title: string, rows: ItemView[], page: number, setPage: (p: number) => void, right: string, act: (it: ItemView) => void): void => {
    const pages = Math.max(1, Math.ceil(rows.length / ROWS));
    const pg = Math.min(page, pages - 1);
    items.push(scene.add.text(-310, y0, title, { fontFamily: UI_FONT, fontSize: '22px', color: '#c8d0e0' }).setOrigin(0, 0.5));
    if (pages > 1) items.push(btn(200, y0, '◀', () => setPage((pg + pages - 1) % pages), false, 18), scene.add.text(250, y0, `${pg + 1}/${pages}`, { fontFamily: UI_FONT, fontSize: '18px', color: '#a8b8d0' }).setOrigin(0.5), btn(300, y0, '▶', () => setPage((pg + 1) % pages), false, 18));
    if (!rows.length) items.push(scene.add.text(0, y0 + 56, '（空）', { fontFamily: UI_FONT, fontSize: '22px', color: '#6a7090' }).setOrigin(0.5));
    rows.slice(pg * ROWS, pg * ROWS + ROWS).forEach((it, i) => items.push(...gearRow(y0 + 50 + i * 56, it, right, () => act(it))));
  };

  function render(): void {
    root.removeAll(true);
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x06080c, 0.96).setInteractive()];
    items.push(scene.add.text(0, -585, '倉庫', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    items.push(scene.add.text(0, -538, '同一個帳號的角色都拿得到・換角色在標題「角色」', { fontFamily: UI_FONT, fontSize: '18px', color: '#a8b8d0' }).setOrigin(0.5));
    if (!data) items.push(scene.add.text(0, -200, error ? '倉庫暫時打不開\n等一下再試' : '打開倉庫…', { fontFamily: UI_FONT, fontSize: '26px', color: '#8890a8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    else {
      const wh = data.warehouse.items;
      const bag = data.character.items.filter((i) => i.location === 'bag').sort((a, b) => a.pos - b.pos);
      list(items, -470, `倉庫 ${wh.length}/${data.warehouse.max}（點一下拿回行囊）`, wh, whPage, (p) => ((whPage = p), render()), '拿出', (it) => run(() => ops.take(it.id), '放進行囊了'));
      list(items, -470 + 50 + ROWS * 56 + 40, `行囊 ${bag.length}/${BAG_MAX}（點一下放進倉庫）`, bag, bagPage, (p) => ((bagPage = p), render()), '放進去', (it) => run(() => ops.put(it.id), '收進倉庫了'));
    }
    if (busy) items.push(scene.add.text(300, -585, '…', { fontFamily: UI_FONT, fontSize: '26px', color: '#9fd8ff' }).setOrigin(1, 0.5));
    items.push(btn(0, EXIT_Y, '離開', () => onClose(), true, 28));
    root.add(items);
  }

  render();
  run(() => ops.view());
  return root;
}
