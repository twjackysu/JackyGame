// 營火行商（D-116）：用金幣自由買賣。買＝貨架 4 件裝備＋材料＋付費換一批；賣＝背包裡的裝備換金幣。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { RARITY_COLOR, RARITY_NAME, SLOT_NAME, gearLines, gearTitle, type RtGear } from '../../core/battle/rt/gear';
import { gearIcon } from '../fx/gearIcons';
import { BAG_MAX, bonusOf, equipWith, isUpgrade, weakestSlot, type BagState } from '../rtBag';
import { walletOf, type RtRecord } from '../rtRecord';
import { SHOP_GOODS, SHOP_REROLL, buyGear, buyPrice, cleanShop, coinOf, isDeal, isPicked, stockPrice, rerollShop, sellPrice, shopIlvl, shopStock, spendCoin, withPick } from '../rtShop';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { drawMerchant } from '../fx/merchant';

const PER_PAGE = 7;
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const LINES = ['「金幣放著不會變多，拿來換點好東西吧。」', '「荊棘谷的貨？那可要多付點勇氣。」', '「賣我不要的，我轉手賣給下一個冒險者。」', '「深夜的貨特別亮，價錢也特別亮。」'];

export interface ShopCtx {
  rec: () => RtRecord;
  save: (r: RtRecord) => void;
  bag: () => BagState;
  /** 行囊改變（呼叫端存檔並套用到戰鬥） */
  setBag: (st: BagState) => void;
  level: number;
  region: string;
  /** 營火燼牌（D-127）：有給才出現「燼牌」分頁按鈕 */
  onCards?: () => void;
}

export function openRtShopPanel(scene: Phaser.Scene, ctx: ShopCtx, onClose: () => void): Phaser.GameObjects.Container {
  let tab: 'buy' | 'sell' = 'buy';
  let page = 0;
  let detail: { g: RtGear; buy: boolean } | null = null;
  // 一半機率說出「為你挑選」的部位（第 25 輪：行商看得出你缺什麼）
  const pickNow = withPick(ctx.rec(), weakestSlot(ctx.bag(), shopIlvl(ctx.level)));
  const pickSlot = cleanShop(pickNow.shop).pick;
  const pickLeft = shopStock(pickNow, ctx.level, ctx.region).some((g) => isPicked(g));
  const line = pickSlot && pickLeft && Math.random() < 0.5 ? `「${SLOT_NAME[pickSlot]}該換了吧？特地幫你帶了一件。」` : LINES[Math.floor(Math.random() * LINES.length)]!;
  const root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(960);

  const btn = (x: number, y: number, label: string, fn: () => void, hi = false, size = 24, off = false): Phaser.GameObjects.Text => {
    const t = scene.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: '700', color: off ? '#8a8070' : hi ? '#1a0f08' : '#ffffff', backgroundColor: off ? '#2a2218' : hi ? '#ffd27a' : '#3a2a14' }).setOrigin(0.5).setPadding(18, 9, 18, 9);
    if (!off)
      t.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.uiTap();
        fn();
      });
    return t;
  };
  const row = (y: number, h: number, g: RtGear, label: string, right: string, rightCol: string, fn: () => void, mark = ''): Phaser.GameObjects.GameObject[] => {
    const col = RARITY_COLOR[g.rarity];
    const bg = scene.add.rectangle(0, y, 650, h, 0x1a140c, 0.95).setStrokeStyle(g.rarity > 1 ? 3 : 2, col, 0.95).setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      fn();
    });
    const out: Phaser.GameObjects.GameObject[] = [bg, ...gearIcon(scene, -317 + h * 0.4, y, g.slot, g.rarity, h * 0.78)];
    out.push(scene.add.text(-310 + h * 0.85, y, `${mark}${label}`, { fontFamily: UI_FONT, fontSize: '21px', color: hex(col) }).setOrigin(0, 0.5));
    out.push(scene.add.text(310, y, right, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: rightCol }).setOrigin(1, 0.5));
    return out;
  };
  let lastToast: Phaser.GameObjects.Text | null = null;
  const toast = (msg: string, col = '#ffd27a'): void => {
    lastToast?.destroy();
    const t = (lastToast = scene.add.text(GAME_WIDTH / 2, 1010, msg, { fontFamily: TITLE_FONT, fontSize: '36px', color: col, stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(990));
    scene.tweens.add({ targets: t, y: 970, alpha: 0, delay: 600, duration: 700, onComplete: () => t.destroy() });
  };
  const coinFx = (): void => {
    SFX.itemGet();
    scene.cameras.main.flash(120, 255, 220, 120);
  };

  // 標題左邊的旅商（程式美術，每幀重畫：燈火、眨眼）；render() 會 removeAll，所以每次重新放回去
  const portrait = scene.add.graphics();
  const drawPortrait = (): void => {
    portrait.clear();
    drawMerchant(portrait, -268, -498, 112, scene.time.now);
  };
  scene.events.on('update', drawPortrait);
  root.once('destroy', () => {
    scene.events.off('update', drawPortrait);
    portrait.destroy();
  });

  function render(): void {
    root.remove(portrait); // 旅商不跟著銷毀，等一下放回去
    root.removeAll(true);
    const rec = ctx.rec();
    const st = ctx.bag();
    const w = walletOf(rec);
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x080604, 0.95).setInteractive()];
    items.push(scene.add.text(0, -585, '營火行商', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    items.push(portrait);
    items.push(scene.add.text(0, -538, `旅商莫托：${line}`, { fontFamily: UI_FONT, fontSize: '19px', color: '#e8c8a0' }).setOrigin(0.5));
    items.push(scene.add.text(0, -500, `金幣 ${coinOf(rec)}　粉塵 ${w.dust}　結晶 ${w.crystal}　背包 ${st.bag.length}/${BAG_MAX}`, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#ffe08a' }).setOrigin(0.5));
    const tx = ctx.onCards ? 200 : 110;
    items.push(btn(-tx, -448, '買', () => {
      tab = 'buy';
      render();
    }, tab === 'buy', 26));
    if (ctx.onCards) items.push(btn(200, -448, '燼牌', () => ctx.onCards?.(), false, 26));
    items.push(btn(ctx.onCards ? 0 : 110, -448, '賣', () => {
      tab = 'sell';
      page = 0;
      render();
    }, tab === 'sell', 26));
    if (tab === 'buy') buyTab(items, rec, st);
    else sellTab(items, st);
    items.push(btn(0, 560, '離開', () => onClose(), true, 28));
    if (detail) items.push(...detailCard(detail.g, detail.buy));
    root.add(items);
  }

  function buyTab(items: Phaser.GameObjects.GameObject[], rec0: RtRecord, st: BagState): void {
    // 為你挑選（第 25 輪）：這批貨第一次打開時記下身上最弱的部位，稀有那件就是那個部位
    const rec = withPick(rec0, weakestSlot(st, shopIlvl(ctx.level)));
    if (rec !== rec0) ctx.save(rec);
    const stock = shopStock(rec, ctx.level, ctx.region);
    const coin = coinOf(rec);
    items.push(scene.add.text(0, -392, `今天的裝備（物品等級 ${stock[0]?.ilvl ?? '-'}・每次進地圖換一批）`, { fontFamily: UI_FONT, fontSize: '19px', color: '#c8d0f0' }).setOrigin(0.5));
    if (!stock.length) items.push(scene.add.text(0, -250, '全部賣光了！\n換一批，或下次進地圖再來', { fontFamily: UI_FONT, fontSize: '24px', color: '#8890a8', align: 'center' }).setOrigin(0.5));
    stock.forEach((g, i) => {
      const p = stockPrice(rec, g);
      const deal = isDeal(rec, g);
      const y = -335 + i * 84;
      items.push(...row(y, 74, g, `【${SLOT_NAME[g.slot]}】${gearTitle(g)}`, `${p} 金`, coin >= p ? (deal ? '#7dffb0' : '#ffe08a') : '#ff8a7a', () => {
        detail = { g, buy: true };
        render();
      }, isUpgrade(st, g) ? '▲ ' : ''));
      if (deal) {
        // 今日特價：右上角紅色小標＋原價劃線
        const tag = scene.add.text(300, y - 30, '特價', { fontFamily: UI_FONT, fontSize: '16px', fontStyle: '700', color: '#ffffff', backgroundColor: '#d0402a' }).setOrigin(1, 0.5).setPadding(8, 2, 8, 2);
        const was = scene.add.text(222, y + 22, `${buyPrice(g)}`, { fontFamily: UI_FONT, fontSize: '15px', color: '#a89880' }).setOrigin(1, 0.5);
        const strike = scene.add.rectangle(222 - was.width / 2, y + 22, was.width + 4, 2, 0xa89880).setOrigin(0.5);
        items.push(tag, was, strike);
        scene.tweens.add({ targets: tag, scale: { from: 1, to: 1.12 }, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut' });
      }
      if (isPicked(g)) {
        // 為你挑選：金色小標（在特價標的左邊）
        const pt = scene.add.text(deal ? 236 : 300, y - 30, '為你挑選', { fontFamily: UI_FONT, fontSize: '16px', fontStyle: '700', color: '#2a1a00', backgroundColor: '#ffcf5a' }).setOrigin(1, 0.5).setPadding(8, 2, 8, 2);
        items.push(pt);
      }
    });
    items.push(scene.add.text(0, 6, '材料', { fontFamily: UI_FONT, fontSize: '21px', color: '#c8d0f0' }).setOrigin(0.5));
    SHOP_GOODS.forEach((it, i) => {
      const y = 62 + i * 82;
      const ok = coin >= it.price;
      items.push(scene.add.rectangle(0, y, 650, 72, 0x1a140c, 0.95).setStrokeStyle(2, it.crystal ? 0xc890ff : 0x7ab8ff, 0.9));
      items.push(scene.add.text(-300, y - 12, it.name, { fontFamily: UI_FONT, fontSize: '23px', fontStyle: '700', color: it.crystal ? '#d8b0ff' : '#9fd8ff' }).setOrigin(0, 0.5));
      items.push(scene.add.text(-300, y + 16, it.desc, { fontFamily: UI_FONT, fontSize: '17px', color: '#a8a090' }).setOrigin(0, 0.5));
      items.push(btn(220, y, `${it.price} 金`, () => {
        const r = spendCoin(ctx.rec(), it.price);
        if (!r) return;
        // 材料直接記成「負的花費」，和分解得到粉塵同一套帳
        ctx.save({ ...r, spent: { ...r.spent, dust: (r.spent?.dust ?? 0) - it.dust, crystal: (r.spent?.crystal ?? 0) - it.crystal } });
        coinFx();
        toast(`買到 ${it.name}`, it.crystal ? '#d8b0ff' : '#9fd8ff');
        render();
      }, ok, 22, !ok));
    });
    const okR = coin >= SHOP_REROLL;
    items.push(btn(0, 250, `換一批裝備（${SHOP_REROLL} 金）`, () => {
      const r = rerollShop(ctx.rec());
      if (!r) return;
      ctx.save(r);
      SFX.confirm();
      render();
    }, false, 22, !okR));
    items.push(scene.add.text(0, 320, '▲＝比身上同部位的好　點裝備看詳細數值', { fontFamily: UI_FONT, fontSize: '18px', color: '#8890a8' }).setOrigin(0.5));
  }

  function sellTab(items: Phaser.GameObjects.GameObject[], st: BagState): void {
    const pages = Math.max(1, Math.ceil(st.bag.length / PER_PAGE));
    page = Math.min(page, pages - 1);
    items.push(scene.add.text(0, -392, '背包裡的裝備（身上穿的不能賣）', { fontFamily: UI_FONT, fontSize: '19px', color: '#c8d0f0' }).setOrigin(0.5));
    if (!st.bag.length) items.push(scene.add.text(0, -250, '背包是空的', { fontFamily: UI_FONT, fontSize: '24px', color: '#8890a8' }).setOrigin(0.5));
    st.bag.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).forEach((g, i) => {
      items.push(...row(-335 + i * 74, 64, g, `【${SLOT_NAME[g.slot]}】${gearTitle(g)}`, `+${sellPrice(g)} 金`, '#ffe08a', () => {
        detail = { g, buy: false };
        render();
      }, isUpgrade(st, g) ? '▲ ' : ''));
    });
    if (pages > 1) {
      items.push(btn(-150, 200, '◀', () => {
        page = (page + pages - 1) % pages;
        render();
      }));
      items.push(scene.add.text(0, 200, `${page + 1} / ${pages}`, { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5));
      items.push(btn(150, 200, '▶', () => {
        page = (page + 1) % pages;
        render();
      }));
    }
    // 一鍵賣掉普通裝（不含 ▲、不含強化過的）
    const junk = st.bag.filter((g) => g.rarity === 1 && !(g.enh ?? 0) && !isUpgrade(st, g));
    const sum = junk.reduce((n, g) => n + sellPrice(g), 0);
    items.push(btn(0, 290, junk.length ? `賣掉全部普通裝 ×${junk.length}（+${sum} 金）` : '沒有可以一鍵賣的普通裝', () => {
      const r = spendCoin(ctx.rec(), -sum);
      if (!r || !junk.length) return;
      ctx.save(r);
      const ids = new Set(junk.map((g) => g.uid));
      ctx.setBag({ ...st, bag: st.bag.filter((g) => !ids.has(g.uid)) });
      coinFx();
      toast(`+${sum} 金`);
      render();
    }, false, 22, !junk.length));
    items.push(scene.add.text(0, 350, '▲ 的裝備比身上的好，賣之前想清楚', { fontFamily: UI_FONT, fontSize: '18px', color: '#8890a8' }).setOrigin(0.5));
  }

  function detailCard(g: RtGear, buy: boolean): Phaser.GameObjects.GameObject[] {
    const st = ctx.bag();
    const col = RARITY_COLOR[g.rarity];
    const out: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setInteractive()];
    out.push(scene.add.rectangle(0, -60, 600, 540, 0x120c06, 0.97).setStrokeStyle(4, col, 1));
    out.push(...gearIcon(scene, -240, -290, g.slot, g.rarity, 72));
    out.push(scene.add.text(0, -290, gearTitle(g), { fontFamily: TITLE_FONT, fontSize: '34px', color: hex(col) }).setOrigin(0.5));
    out.push(scene.add.text(0, -245, `${RARITY_NAME[g.rarity]}・${SLOT_NAME[g.slot]}・物品等級 ${g.ilvl}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#c8d0f0' }).setOrigin(0.5));
    out.push(scene.add.text(0, -150, gearLines(g).join('\n'), { fontFamily: UI_FONT, fontSize: '25px', color: '#ffffff', align: 'center', lineSpacing: 10 }).setOrigin(0.5));
    const now = bonusOf(st);
    const after = bonusOf(equipWith(st, g));
    const d = (k: 'atk' | 'hp' | 'def', name: string) => {
      const v = after[k] - now[k];
      return v === 0 ? `${name} ±0` : `${name} ${v > 0 ? '+' : ''}${v}`;
    };
    if (buy) out.push(scene.add.text(0, 10, `${st.equip[g.slot] ? `換掉「${st.equip[g.slot]!.name}」` : '換上後'}：${d('atk', '攻擊')}・${d('hp', 'HP')}・${d('def', '防禦')}`, { fontFamily: UI_FONT, fontSize: '21px', color: isUpgrade(st, g) ? '#7dffb0' : '#ff9a8a', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5));
    else if (isUpgrade(st, g)) out.push(scene.add.text(0, 10, '這件比你身上的好！', { fontFamily: UI_FONT, fontSize: '22px', color: '#ffb07a' }).setOrigin(0.5));
    const back = () => {
      detail = null;
      render();
    };
    if (buy) {
      const p = stockPrice(ctx.rec(), g);
      const coin = coinOf(ctx.rec());
      const full = st.bag.length >= BAG_MAX;
      const ok = coin >= p && !full;
      const doBuy = (wear: boolean) => {
        const r = buyGear(ctx.rec(), g);
        if (!r || ctx.bag().bag.length >= BAG_MAX) return;
        ctx.save(r);
        const cur = ctx.bag();
        const mine: RtGear = { ...g, uid: `${g.uid}b${Date.now().toString(36)}` };
        const next: BagState = { ...cur, bag: [mine, ...cur.bag] };
        ctx.setBag(wear ? equipWith(next, mine) : next);
        coinFx();
        toast(wear ? `換上 ${g.name}！` : `買下 ${g.name}！到行囊換上`, hex(col));
        back();
      };
      const up = isUpgrade(st, g);
      out.push(btn(up ? -170 : -130, 140, full ? '背包滿了' : coin >= p ? `購買（${p} 金）` : `金幣不夠（${p}）`, () => doBuy(false), ok && !up, 24, !ok));
      if (up && ok) out.push(btn(60, 140, '買下並換上', () => doBuy(true), true, 24));
      out.push(btn(up && ok ? 230 : 150, 140, '返回', back));
    } else {
      out.push(btn(-130, 140, `賣出（+${sellPrice(g)} 金）`, () => {
        const r = spendCoin(ctx.rec(), -sellPrice(g));
        if (!r) return;
        ctx.save(r);
        const cur = ctx.bag();
        ctx.setBag({ ...cur, bag: cur.bag.filter((x) => x.uid !== g.uid) });
        coinFx();
        toast(`+${sellPrice(g)} 金`);
        back();
      }, true, 24));
      out.push(btn(150, 140, '返回', back));
    }
    return out;
  }

  render();
  return root;
}
