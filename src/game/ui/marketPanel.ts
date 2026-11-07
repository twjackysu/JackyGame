// 拍賣所（V4，24 §4.1，第 143 輪）：跟其他冒險者（單機版是模擬玩家，上線後是真人）買賣裝備。
// 三個分頁：逛逛（部位篩選、照價格排、分頁）、上架（行囊裡的裝備＋定價）、我的掛單（取消、看賣掉沒）。
// 所有動作都交給伺服器（marketOps）；畫面只負責顯示，價格規則（上架費、手續費）讀 core/meta/market 只拿來「顯示」。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { GEAR_SLOTS, RARITY_COLOR, RARITY_NAME, SLOT_NAME, gearLines, isGear, type GearSlot, type RtGear } from '../../core/battle/rt/gear';
import { MARKET_FEE_PCT, MARKET_PAGE, PRICE_MAX, listFee, priceStats, sellerGets } from '../../core/meta/market';
import { buyPrice, sellPrice } from '../../core/meta/shop';
import type { ListingView } from '../../net/views';
import { GAME_HEIGHT, GAME_WIDTH, TALL } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { coinFly } from '../fx/coinFly';
import { gearIcon } from '../fx/gearIcons';
import type { MarketOps, MarketPage } from '../marketOps';
import { soldNewsText } from '../marketNews';
import { BAG_MAX, isUpgrade, type BagState } from '../rtBag';
import { gearTitleW, skillNames } from '../weapon';

export interface MarketCtx {
  ops: MarketOps;
  bag: () => BagState;
  coin: () => number;
  /** 打開前的金幣（模擬玩家可能在你不在時買走掛單：打開後多出來的就告訴玩家） */
  coinBefore: number;
}

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const ROWS = 9;
const HOUR = 3600_000;
/** 定價的快捷鍵：行商買價的幾成（行商收購只給 25%） */
const PRESETS: [string, number][] = [
  ['便宜賣', 0.4],
  ['中等價', 0.6],
  ['高價', 0.85],
];

const gearOf = (l: ListingView): RtGear | null => (isGear(l.gear) ? (l.gear as unknown as RtGear) : null);

export function openMarketPanel(scene: Phaser.Scene, ctx: MarketCtx, onClose: () => void): Phaser.GameObjects.Container {
  const EXIT_Y = 560 + Math.round(TALL * 0.4);
  let tab: 'browse' | 'sell' | 'mine' = 'browse';
  let slot: GearSlot | undefined;
  /** 伺服器的頁（每頁 MARKET_PAGE 筆）與畫面上的半頁 */
  let page = 0;
  let sub = 0;
  let sellPage = 0;
  let data: MarketPage | null = null;
  let busy = false;
  let error = false;
  let detail: { kind: 'listing'; l: ListingView } | { kind: 'sell'; g: RtGear; price: number } | null = null;
  let first = true;
  /** 最近成交（D-329）：部位:稀有度 → 價格列表；'wait'＝讀取中；null＝讀不到 */
  const sold = new Map<string, number[] | 'wait' | null>();
  const root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(960);

  let lastToast: Phaser.GameObjects.Text | null = null;
  const toast = (msg: string, col = '#ffd27a', size = 32, hold = 1100): void => {
    lastToast?.destroy();
    const y0 = GAME_HEIGHT / 2 + 410;
    const t = (lastToast = scene.add.text(GAME_WIDTH / 2, y0, msg, { fontFamily: TITLE_FONT, fontSize: `${size}px`, color: col, stroke: '#000', strokeThickness: 6, align: 'center', wordWrap: { width: GAME_WIDTH - 40, useAdvancedWrap: true } }).setOrigin(0.5).setDepth(990));
    scene.tweens.add({ targets: t, y: y0 - 40, alpha: 0, delay: hold, duration: 700, onComplete: () => t.destroy() });
  };
  /** 賣出時飛進錢包的金幣（第 151 輪）：面板關掉一起收（D-254） */
  let coins: Phaser.GameObjects.GameObject[] = [];
  const payday = (gain: number): void => {
    for (const o of coins) if (o.active) o.destroy();
    coins = coinFly(scene, { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 380 }, { x: GAME_WIDTH / 2 - 90, y: GAME_HEIGHT / 2 - 500 }, gain);
    SFX.coins(coins.length);
  };
  root.once('destroy', () => {
    if (lastToast) scene.tweens.killTweensOf(lastToast);
    lastToast?.destroy();
    for (const o of coins) {
      scene.tweens.killTweensOf(o);
      if (o.active) o.destroy();
    }
  });

  /** 送一個動作給伺服器；連點不重送；回來後重畫 */
  const run = (p: () => Promise<MarketPage | null>, ok?: (d: MarketPage) => void): void => {
    if (busy) return;
    busy = true;
    render();
    void p().then((d) => {
      busy = false;
      if (!root.active) return;
      if (!d) {
        error = true;
        render();
        return toast('拍賣所暫時連不上，等一下再試', '#ff9a8a');
      }
      error = false;
      data = d;
      if (d.failed) {
        detail = null;
        toast(failText(d.failed), '#ff9a8a');
      }
      else ok?.(d);
      // 賣出通知（第 149 輪；放在動作結果後面：比「上架了」更值得看）：伺服器說上次看過之後賣掉了哪些；舊存檔第一次打開（伺服器還沒有紀錄）照舊用金幣差
      const news = soldNewsText(d.news, first);
      if (news) {
        SFX.itemGet();
        toast(news, '#7dffb0', 26, 2600);
        payday(d.news.reduce((sum, l) => sum + sellerGets(l.price), 0));
      } else if (first) {
        const gained = d.character.wallet.coin - ctx.coinBefore;
        if (gained > 0) {
          SFX.itemGet();
          toast(`你不在的時候有人買走掛單\n+${gained} 金`, '#7dffb0');
          payday(gained);
        }
      }
      first = false;
      render();
    });
  };
  const failText = (m: string): string => (m === 'listing' ? '晚了一步，已經被買走了' : m === 'bag full' ? '背包滿了' : m.startsWith('not enough') ? '金幣不夠' : m === 'too many listings' ? '同時最多掛 20 件' : '交易沒有成立');

  const btn = (x: number, y: number, label: string, fn: () => void, hi = false, size = 24, off = false): Phaser.GameObjects.Text => {
    const t = scene.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: '700', color: off ? '#8a8070' : hi ? '#1a0f08' : '#ffffff', backgroundColor: off ? '#2a2218' : hi ? '#ffd27a' : '#3a2a14' }).setOrigin(0.5).setPadding(size > 20 ? 18 : 10, 8, size > 20 ? 18 : 10, 8);
    if (!off)
      t.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.uiTap();
        fn();
      });
    return t;
  };
  const row = (y: number, g: RtGear, label: string, sub2: string, right: string, rightCol: string, fn: () => void): Phaser.GameObjects.GameObject[] => {
    const h = 62;
    const col = RARITY_COLOR[g.rarity];
    const bg = scene.add.rectangle(0, y, 650, h, 0x1a140c, 0.95).setStrokeStyle(g.rarity > 1 ? 3 : 2, col, 0.95).setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      fn();
    });
    return [
      bg,
      ...gearIcon(scene, -292, y, g.slot, g.rarity, h * 0.78),
      scene.add.text(-255, y - 12, label, { fontFamily: UI_FONT, fontSize: '20px', color: hex(col) }).setOrigin(0, 0.5),
      scene.add.text(-255, y + 15, sub2, { fontFamily: UI_FONT, fontSize: '15px', color: '#a89880' }).setOrigin(0, 0.5),
      scene.add.text(310, y, right, { fontFamily: UI_FONT, fontSize: '21px', fontStyle: '700', color: rightCol }).setOrigin(1, 0.5),
    ];
  };
  const pager = (items: Phaser.GameObjects.GameObject[], y: number, label: string, prev: (() => void) | null, next: (() => void) | null): void => {
    items.push(btn(-150, y, '◀', () => prev?.(), false, 24, !prev));
    items.push(scene.add.text(0, y, label, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5));
    items.push(btn(150, y, '▶', () => next?.(), false, 24, !next));
  };
  const hoursLeft = (l: ListingView): string => {
    const h = Math.max(0, Math.ceil((l.expiresAt - Date.now()) / HOUR));
    return h > 0 ? `剩 ${h} 小時` : '已過期';
  };

  function render(): void {
    root.removeAll(true);
    const st = ctx.bag();
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x06080c, 0.96).setInteractive()];
    items.push(scene.add.text(0, -585, '拍賣所', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#9fd8ff' }).setOrigin(0.5));
    items.push(scene.add.text(0, -538, `跟其他冒險者買賣裝備・成交收 ${MARKET_FEE_PCT}% 手續費・掛 48 小時`, { fontFamily: UI_FONT, fontSize: '18px', color: '#a8b8d0' }).setOrigin(0.5));
    items.push(scene.add.text(0, -500, `金幣 ${data?.character.wallet.coin ?? ctx.coin()}　背包 ${st.bag.length}/${BAG_MAX}`, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#ffe08a' }).setOrigin(0.5));
    const tabBtn = (x: number, t: typeof tab, label: string) =>
      btn(x, -448, label, () => {
        tab = t;
        detail = null;
        render();
      }, tab === t, 24);
    items.push(tabBtn(-200, 'browse', '逛逛'), tabBtn(0, 'sell', '上架'), tabBtn(200, 'mine', '我的掛單'));
    if (!data) items.push(scene.add.text(0, -200, error ? '拍賣所暫時連不上\n等一下再打開看看' : '正在看看有什麼貨…', { fontFamily: UI_FONT, fontSize: '26px', color: '#8890a8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    else if (tab === 'browse') browseTab(items, data, st);
    else if (tab === 'sell') sellTab(items, st);
    else mineTab(items, data);
    if (busy && data) items.push(scene.add.text(300, -500, '…', { fontFamily: UI_FONT, fontSize: '26px', color: '#9fd8ff' }).setOrigin(1, 0.5));
    items.push(btn(0, EXIT_Y, '離開', () => onClose(), true, 28));
    if (detail?.kind === 'listing') items.push(...listingCard(detail.l, st));
    else if (detail?.kind === 'sell') items.push(...sellCard(detail.g, detail.price));
    root.add(items);
  }

  function browseTab(items: Phaser.GameObjects.GameObject[], d: MarketPage, st: BagState): void {
    // 部位篩選（換篩選回到第一頁）
    const opts: (GearSlot | undefined)[] = [undefined, ...GEAR_SLOTS];
    opts.forEach((s, i) => {
      items.push(btn(-306 + i * 102, -390, s ? SLOT_NAME[s] : '全部', () => {
        slot = s;
        page = 0;
        sub = 0;
        run(() => ctx.ops.view(slot, 0));
      }, slot === s, 18));
    });
    const shown = d.listings.slice(sub * ROWS, sub * ROWS + ROWS);
    if (!shown.length) items.push(scene.add.text(0, -200, page || sub ? '沒有更多了' : '現在沒有人在賣這種東西\n晚點再來看看', { fontFamily: UI_FONT, fontSize: '24px', color: '#8890a8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    const coin = d.character.wallet.coin;
    shown.forEach((l, i) => {
      const g = gearOf(l);
      if (!g) return;
      const up = isUpgrade(st, g);
      items.push(...row(-325 + i * 70, g, `${up ? '▲ ' : ''}【${SLOT_NAME[g.slot]}】${gearTitleW(g)}`, `${l.mine ? '你的掛單' : `賣家 ${l.sellerName}`}・物品等級 ${g.ilvl}`, `${l.price} 金`, l.mine ? '#a8b8d0' : coin >= l.price ? '#ffe08a' : '#ff8a7a', () => {
        detail = { kind: 'listing', l };
        render();
      }));
    });
    const more = d.listings.length > (sub + 1) * ROWS || d.listings.length >= MARKET_PAGE;
    const prev = page || sub ? () => (sub ? ((sub = 0), render()) : ((page -= 1), (sub = 1), run(() => ctx.ops.view(slot, page)))) : null;
    const next = more ? () => (sub === 0 && d.listings.length > ROWS ? ((sub = 1), render()) : ((page += 1), (sub = 0), run(() => ctx.ops.view(slot, page)))) : null;
    pager(items, 325, `第 ${page * 2 + sub + 1} 頁`, prev, next);
    items.push(scene.add.text(0, 385, '▲＝比身上同部位的好　照價格由低到高排', { fontFamily: UI_FONT, fontSize: '17px', color: '#8890a8' }).setOrigin(0.5));
  }

  function sellTab(items: Phaser.GameObjects.GameObject[], st: BagState): void {
    const pages = Math.max(1, Math.ceil(st.bag.length / ROWS));
    sellPage = Math.min(sellPage, pages - 1);
    items.push(scene.add.text(0, -390, '選一件背包裡的裝備上架（身上穿的要先脫下）', { fontFamily: UI_FONT, fontSize: '19px', color: '#c8d0f0' }).setOrigin(0.5));
    if (!st.bag.length) items.push(scene.add.text(0, -200, '背包是空的\n打怪撿到的裝備可以拿來這裡賣', { fontFamily: UI_FONT, fontSize: '24px', color: '#8890a8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    st.bag.slice(sellPage * ROWS, sellPage * ROWS + ROWS).forEach((g, i) => {
      items.push(...row(-325 + i * 70, g, `${isUpgrade(st, g) ? '▲ ' : ''}【${SLOT_NAME[g.slot]}】${gearTitleW(g)}`, `${RARITY_NAME[g.rarity]}・物品等級 ${g.ilvl}・行商收購 ${sellPrice(g)} 金`, '上架 ›', '#9fd8ff', () => {
        detail = { kind: 'sell', g, price: Math.round(buyPrice(g) * 0.6) };
        render();
      }));
    });
    if (pages > 1)
      pager(items, 325, `${sellPage + 1} / ${pages}`, () => ((sellPage = (sellPage + pages - 1) % pages), render()), () => ((sellPage = (sellPage + 1) % pages), render()));
  }

  function mineTab(items: Phaser.GameObjects.GameObject[], d: MarketPage): void {
    const open = d.mine.filter((l) => l.status === 'open').length;
    items.push(scene.add.text(0, -390, `掛賣中 ${open} 件（最多 20 件）・點一下可以取消`, { fontFamily: UI_FONT, fontSize: '19px', color: '#c8d0f0' }).setOrigin(0.5));
    if (!d.mine.length) items.push(scene.add.text(0, -200, '還沒有掛單\n到「上架」選一件裝備開價', { fontFamily: UI_FONT, fontSize: '24px', color: '#8890a8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    d.mine.slice(0, ROWS).forEach((l, i) => {
      const g = gearOf(l);
      if (!g) return;
      const [txt, col] = l.status === 'open' ? [`${l.price} 金`, '#ffe08a'] : l.status === 'sold' ? [`已賣出 +${sellerGets(l.price)}`, '#7dffb0'] : l.status === 'expired' ? ['過期・已退回', '#a89880'] : ['已取消', '#a89880'];
      items.push(...row(-325 + i * 70, g, `【${SLOT_NAME[g.slot]}】${gearTitleW(g)}`, l.status === 'open' ? `掛賣中・${hoursLeft(l)}` : `開價 ${l.price} 金`, txt, col, () => {
        if (l.status !== 'open') return;
        detail = { kind: 'listing', l };
        render();
      }));
    });
  }

  /** 卡片底：圖示、名字、數值 */
  function gearHead(out: Phaser.GameObjects.GameObject[], g: RtGear): number {
    const col = RARITY_COLOR[g.rarity];
    out.push(...gearIcon(scene, -240, -290, g.slot, g.rarity, 72));
    out.push(scene.add.text(0, -290, gearTitleW(g), { fontFamily: TITLE_FONT, fontSize: '32px', color: hex(col) }).setOrigin(0.5));
    out.push(scene.add.text(0, -248, `${RARITY_NAME[g.rarity]}・${SLOT_NAME[g.slot]}・物品等級 ${g.ilvl}`, { fontFamily: UI_FONT, fontSize: '21px', color: '#c8d0f0' }).setOrigin(0.5));
    const gl = gearLines(g, skillNames());
    const lines = scene.add.text(0, -218, gl.join('\n'), { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff', align: 'center', lineSpacing: gl.length > 4 ? 4 : 8 }).setOrigin(0.5, 0);
    out.push(lines);
    return -218 + lines.height;
  }
  const card = (out: Phaser.GameObjects.GameObject[], g: RtGear, bottom: number): void => {
    out.splice(1, 0, scene.add.rectangle(0, (-330 + bottom) / 2, 620, bottom + 330, 0x0c1018, 0.97).setStrokeStyle(4, RARITY_COLOR[g.rarity], 1));
  };
  const back = (): void => {
    detail = null;
    render();
  };

  function listingCard(l: ListingView, st: BagState): Phaser.GameObjects.GameObject[] {
    const g = gearOf(l);
    if (!g) return [];
    const out: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setInteractive()];
    let y = gearHead(out, g) + 40;
    out.push(scene.add.text(0, y, l.mine ? `你的掛單・${hoursLeft(l)}` : `賣家 ${l.sellerName}・行商賣這種貨約 ${buyPrice(g)} 金`, { fontFamily: UI_FONT, fontSize: '19px', color: '#a8b8d0' }).setOrigin(0.5));
    if (!l.mine && isUpgrade(st, g)) out.push(scene.add.text(0, (y += 34), '這件比你身上的好！', { fontFamily: UI_FONT, fontSize: '21px', color: '#7dffb0' }).setOrigin(0.5));
    y += 70;
    if (l.mine) {
      out.push(btn(-120, y, '取消掛單（退回背包）', () => run(() => ctx.ops.cancel(l.id, slot, page), () => ((detail = null), toast('已取消，裝備回到背包'))), false, 22, busy));
      out.push(btn(170, y, '返回', back));
    } else {
      const coin = data?.character.wallet.coin ?? 0;
      const full = st.bag.length >= BAG_MAX;
      const ok = coin >= l.price && !full && !busy;
      out.push(btn(-120, y, full ? '背包滿了' : coin >= l.price ? `購買（${l.price} 金）` : `金幣不夠（${l.price}）`, () =>
        run(() => ctx.ops.buy(l.id, slot, page), () => {
          detail = null;
          SFX.itemGet();
          scene.cameras.main.flash(120, 160, 220, 255);
          toast(`買到 ${gearTitleW(g)}！\n到行囊換上`, hex(RARITY_COLOR[g.rarity]));
        }), ok, 24, !ok));
      out.push(btn(150, y, '返回', back));
    }
    card(out, g, y + 60);
    return out;
  }

  function sellCard(g: RtGear, price: number): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setInteractive()];
    let y = gearHead(out, g) + 46;
    const setPrice = (p: number) => {
      detail = { kind: 'sell', g, price: Math.max(1, Math.min(PRICE_MAX, Math.round(p))) };
      render();
    };
    out.push(btn(-200, y, '−10%', () => setPrice(Math.min(price - 1, price * 0.9)), false, 20));
    out.push(scene.add.text(0, y, `${price} 金`, { fontFamily: TITLE_FONT, fontSize: '40px', color: '#ffe08a' }).setOrigin(0.5));
    out.push(btn(200, y, '+10%', () => setPrice(Math.max(price + 1, price * 1.1)), false, 20));
    y += 62;
    PRESETS.forEach(([label, k], i) => out.push(btn(-200 + i * 200, y, `${label} ${Math.round(buyPrice(g) * k)}`, () => setPrice(buyPrice(g) * k), false, 18)));
    // 最近成交（第 153 輪，D-329）：同部位同稀有度別人最近賣多少；點一下用中位數定價
    y += 50;
    const hk = `${g.slot}:${g.rarity}`;
    const h = sold.get(hk);
    if (h === undefined && ctx.ops.history) {
      sold.set(hk, 'wait');
      void ctx.ops.history(g.slot, g.rarity).then((v) => {
        sold.set(hk, v);
        if (root.active && detail?.kind === 'sell' && `${detail.g.slot}:${detail.g.rarity}` === hk) render();
      });
    }
    const st = Array.isArray(h) ? priceStats(h) : null;
    const kind = `${RARITY_NAME[g.rarity]}${SLOT_NAME[g.slot]}`;
    if (st) out.push(btn(0, y, `最近成交 ${st.n} 筆・中位 ${st.median} 金（${st.lo}～${st.hi}）→ 用這個價`, () => setPrice(st.median), false, 17));
    else out.push(scene.add.text(0, y, h === 'wait' || h === undefined ? '讀取最近成交…' : h === null ? '最近成交讀不到' : `最近還沒有人賣出${kind}`, { fontFamily: UI_FONT, fontSize: '17px', color: '#7a8aa8' }).setOrigin(0.5));
    y += 48;
    out.push(scene.add.text(0, y, `上架費 ${listFee(price)} 金（不退）・賣掉實拿 ${sellerGets(price)} 金\n賣給行商只有 ${sellPrice(g)} 金・行商賣這種貨約 ${buyPrice(g)} 金`, { fontFamily: UI_FONT, fontSize: '18px', color: '#a8b8d0', align: 'center', lineSpacing: 6 }).setOrigin(0.5));
    y += 80;
    const coin = data?.character.wallet.coin ?? 0;
    const ok = coin >= listFee(price) && !busy;
    out.push(btn(-120, y, coin >= listFee(price) ? '上架！' : '金幣不夠付上架費', () =>
      run(() => ctx.ops.list(g.uid, price, slot, page), () => {
        detail = null;
        tab = 'mine';
        SFX.confirm();
        toast(`上架了！${price} 金`, '#9fd8ff');
      }), ok, 24, !ok));
    out.push(btn(150, y, '返回', back));
    card(out, g, y + 60);
    return out;
  }

  render();
  run(() => ctx.ops.view(undefined, 0));
  return root;
}
