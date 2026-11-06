// 面對面交易（託管，F3，第 144 輪）：跟其他冒險者當面換東西（單機版是模擬冒險者，它們會「收購」你放上來的裝備）。
// 流程：選對象 → 點行囊的裝備放上去（再點一次拿回來）、金幣可加減 → 看對方出價 → 鎖定 → 確認交換。
// 所有動作交給伺服器（tradeOps）；放上去的東西由伺服器保管，任何一方改內容，雙方都要重新鎖定與確認（防最後一秒偷換）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { RARITY_COLOR, isGear, type RtGear } from '../../core/battle/rt/gear';
import { TRADE_MAX_ITEMS } from '../../core/meta/trade';
import type { TradeView } from '../../net/views';
import { GAME_HEIGHT, GAME_WIDTH, TALL } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import type { TradeOps, TradePage } from '../tradeOps';
import { WEAPON_NAME, gearTitleW } from '../weapon';

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const BAG_ROWS = 6;
const COIN_STEP = 100;

export function openTradePanel(scene: Phaser.Scene, ops: TradeOps, onClose: () => void): Phaser.GameObjects.Container {
  const EXIT_Y = 560 + Math.round(TALL * 0.4);
  const root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(960);
  let data: TradePage | null = null;
  let trade: TradeView | null = null;
  let busy = false;
  let error = false;
  let bagPage = 0;
  /** 對象清單（交易動作的回應不帶清單，留著上次的） */
  let partners: TradePage['partners'] = [];

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

  const run = (p: () => Promise<TradePage | null>): void => {
    if (busy) return;
    busy = true;
    render();
    void p().then((d) => {
      busy = false;
      if (!root.active) return;
      if (!d) {
        error = true;
        render();
        return toast('交易暫時連不上，等一下再試', '#ff9a8a');
      }
      error = false;
      const before = trade;
      data = d;
      if (d.partners.length) partners = d.partners;
      if (d.failed) {
        toast(d.failed === 'not enough coin' ? '金幣不夠' : d.failed === 'stale' ? '對方改了內容，請重新確認' : `沒辦法：${d.failed}`, '#ff9a8a');
        // 被拒的動作不會回交易狀態：重新讀一次
        if (before) {
          trade = before;
          render();
          busy = false;
          return run(() => ops.get(before.id));
        }
      } else if (d.trade) {
        trade = d.trade;
        if (d.trade.status === 'done' && before?.status !== 'done') {
          SFX.itemGet();
          toast(`交易完成！${d.trade.theirs.coin ? `得到 ${d.trade.theirs.coin} 金` : ''}`);
        }
      }
      render();
    });
  };

  const btn = (x: number, y: number, label: string, fn: () => void, hi = false, size = 24, off = false): Phaser.GameObjects.Text => {
    const t = scene.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: '700', color: off ? '#8a8070' : hi ? '#1a0f08' : '#ffffff', backgroundColor: off ? '#2a2218' : hi ? '#ffd27a' : '#3a2a14' }).setOrigin(0.5).setPadding(16, 8, 16, 8);
    if (!off)
      t.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.uiTap();
        fn();
      });
    return t;
  };
  const gearRow = (y: number, gear: Record<string, unknown>, right: string, fn?: () => void): Phaser.GameObjects.GameObject[] => {
    const g = isGear(gear) ? (gear as unknown as RtGear) : null;
    const col = g ? RARITY_COLOR[g.rarity] : 0x808080;
    const bg = scene.add.rectangle(0, y, 640, 50, 0x1a140c, 0.95).setStrokeStyle(2, col, 0.9);
    if (fn)
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.uiTap();
        fn();
      });
    return [
      bg,
      scene.add.text(-300, y, g ? gearTitleW(g) : '？', { fontFamily: UI_FONT, fontSize: '22px', color: hex(col) }).setOrigin(0, 0.5),
      scene.add.text(300, y, right, { fontFamily: UI_FONT, fontSize: '20px', color: '#c8b898' }).setOrigin(1, 0.5),
    ];
  };

  function render(): void {
    root.removeAll(true);
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x06080c, 0.96).setInteractive()];
    items.push(scene.add.text(0, -585, '面對面交易', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    items.push(scene.add.text(0, -538, '放上去的東西由伺服器保管・任一方改內容都要重新鎖定', { fontFamily: UI_FONT, fontSize: '18px', color: '#a8b8d0' }).setOrigin(0.5));
    if (data) items.push(scene.add.text(0, -500, `金幣 ${data.character.wallet.coin}`, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#ffe08a' }).setOrigin(0.5));
    if (!data) items.push(scene.add.text(0, -200, error ? '交易暫時連不上\n等一下再打開看看' : '找找附近的冒險者…', { fontFamily: UI_FONT, fontSize: '26px', color: '#8890a8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    else if (!trade || trade.status !== 'open') partnersView(items);
    else tradeView(items, trade);
    if (busy) items.push(scene.add.text(300, -500, '…', { fontFamily: UI_FONT, fontSize: '26px', color: '#9fd8ff' }).setOrigin(1, 0.5));
    items.push(btn(0, EXIT_Y, '離開', () => onClose(), true, 28));
    root.add(items);
  }

  function partnersView(items: Phaser.GameObjects.GameObject[]): void {
    const ps = partners;
    items.push(scene.add.text(0, -440, ps.length ? '跟誰交易？（他們會收購你放上去的裝備）' : '附近還沒有其他冒險者\n先逛逛拍賣所再回來', { fontFamily: UI_FONT, fontSize: '22px', color: '#c8d0e0', align: 'center' }).setOrigin(0.5));
    if (!ps.length) {
      items.push(btn(0, -340, '重新找找', () => run(() => ops.partners())));
      return;
    }
    ps.slice(0, 9).forEach((p, i) => {
      const y = -370 + i * 70;
      const bg = scene.add.rectangle(0, y, 560, 58, 0x1a140c, 0.95).setStrokeStyle(2, 0xffd27a, 0.6).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.confirm();
        run(() => ops.open(p.characterId));
      });
      items.push(bg, scene.add.text(-250, y, p.name, { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0, 0.5), scene.add.text(250, y, WEAPON_NAME[p.weapon], { fontFamily: UI_FONT, fontSize: '22px', color: '#9aa4b8' }).setOrigin(1, 0.5));
    });
  }

  function tradeView(items: Phaser.GameObjects.GameObject[], t: TradeView): void {
    const mineIds = t.mine.items.map((i) => i.id);
    const offer = (ids: string[], coin: number) => run(() => ops.offer(t.id, ids, coin));
    // 對方
    items.push(scene.add.text(-310, -450, `${t.partnerName} 出：`, { fontFamily: UI_FONT, fontSize: '24px', color: '#9fd8ff' }).setOrigin(0, 0.5));
    items.push(scene.add.text(310, -450, `${t.theirs.coin} 金${t.confirmed.them ? '　✔ 已確認' : t.locked.them ? '　🔒 已鎖定' : ''}`, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: t.locked.them ? '#ffd27a' : '#ffe08a' }).setOrigin(1, 0.5));
    t.theirs.items.slice(0, 2).forEach((it, i) => items.push(...gearRow(-400 + i * 56, it.gear, '')));
    // 我
    const y0 = -400 + Math.min(2, t.theirs.items.length) * 56 + 20;
    items.push(scene.add.text(-310, y0, `你放：${t.mine.items.length}/${TRADE_MAX_ITEMS} 件`, { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0, 0.5));
    items.push(btn(110, y0, `−${COIN_STEP}`, () => offer(mineIds, Math.max(0, t.mine.coin - COIN_STEP)), false, 20, t.mine.coin <= 0));
    items.push(scene.add.text(200, y0, `${t.mine.coin} 金`, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffe08a' }).setOrigin(0.5));
    items.push(btn(290, y0, `+${COIN_STEP}`, () => offer(mineIds, t.mine.coin + COIN_STEP), false, 20, (data?.character.wallet.coin ?? 0) < COIN_STEP));
    t.mine.items.forEach((it, i) => items.push(...gearRow(y0 + 50 + i * 56, it.gear, '點一下拿回', () => offer(mineIds.filter((x) => x !== it.id), t.mine.coin))));
    // 行囊（點一下放上去）
    const yb = y0 + 50 + t.mine.items.length * 56 + 16;
    const bag = (data?.character.items ?? []).filter((i) => i.location === 'bag' && !i.bound).sort((a, b) => a.pos - b.pos);
    const pages = Math.max(1, Math.ceil(bag.length / BAG_ROWS));
    bagPage = Math.min(bagPage, pages - 1);
    items.push(scene.add.text(-310, yb, `行囊（點一下放上去）`, { fontFamily: UI_FONT, fontSize: '20px', color: '#a8b8d0' }).setOrigin(0, 0.5));
    if (pages > 1) items.push(btn(230, yb, '◀', () => ((bagPage = (bagPage + pages - 1) % pages), render()), false, 18), btn(290, yb, '▶', () => ((bagPage = (bagPage + 1) % pages), render()), false, 18));
    const full = mineIds.length >= TRADE_MAX_ITEMS;
    bag.slice(bagPage * BAG_ROWS, bagPage * BAG_ROWS + BAG_ROWS).forEach((it, i) => items.push(...gearRow(yb + 46 + i * 56, it.gear, full ? '' : '放上去', full ? undefined : () => offer([...mineIds, it.id], t.mine.coin))));
    // 鎖定／確認／取消
    const ya = EXIT_Y - 80;
    const empty = !t.mine.items.length && !t.mine.coin && !t.theirs.items.length && !t.theirs.coin;
    if (!t.locked.me) items.push(btn(-200, ya, '鎖定', () => run(() => ops.lock(t.id)), true, 26, empty));
    else if (!t.confirmed.me) items.push(btn(-200, ya, '確認交換', () => run(() => ops.confirm(t.id, t.rev)), true, 26, !t.locked.them));
    else items.push(btn(-200, ya, '等對方確認', () => run(() => ops.get(t.id)), false, 24));
    items.push(btn(200, ya, '取消交易', () => run(() => ops.cancel(t.id)), false, 24));
  }

  render();
  run(() => ops.partners());
  return root;
}
