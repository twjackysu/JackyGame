// 營火燼牌（D-127）：在營火旁和旅商莫托（第 28 輪起還有荊棘谷的薇菈、裂谷的葛倫，D-129）打的卡牌小遊戲。規則在 core/cards/emberCards.ts。
// 全螢幕面板：上半是莫托的後排／前排、中間天候、下半是你的前排／後排與手牌。點一張牌看說明、再點一次（或按「出牌」）打出。
import Phaser from 'phaser';
import { loadChoices, rivalEcho } from '../choices';
import { loadEncounters, rivalEncounterEcho } from '../encounters';
import { breakAtPunct } from './tipText';
import { SFX } from '../../audio/sfx';
import { aiMove, ALL_REWARDS, applyMove, CARDS, PLAYER_DECK, CHEST_CARDS, cardPower, DECK_MAX, DECK_MIN, deckWith, ownedCards, legalMoves, maxReach, newCardGame, nextReward, OPPONENTS, opponentsAt, rowScore, totalScore, type CardGame, type Opponent, type Row } from '../../core/cards/emberCards';
import { worldMap } from '../worldMaps';
import { GAME_HEIGHT, GAME_WIDTH, TALL } from '../config';
import { TITLE_FONT, UI_FONT, bigText } from '../fx/feel';
import { drawCardRival, drawMerchant } from '../fx/merchant';

export interface CardCtx {
  /** 現在在哪張地圖的營火（決定有哪些對手，D-129） */
  map: string;
  /** 離開按鈕的字（預設「回行商」） */
  closeLabel?: string;
  coin: () => number;
  /** 付錢（正數）或收錢（負數） */
  pay: (n: number) => void;
}

const ROW_NAME = ['前排', '後排'];
const KEY = 'jg_cards';
interface Stats {
  played: number;
  won: number;
  /** 下注贏來的牌（各對手的都在這裡） */
  cards: string[];
  /** 各對手的戰績（D-129） */
  by: Record<string, { played: number; won: number }>;
  /** 留在箱子裡、不帶上場的牌（D-130，可重複 id） */
  off: string[];
}
function stats(): Stats {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Stats>;
    const by: Stats['by'] = {};
    for (const o of OPPONENTS) {
      const b = v.by?.[o.id];
      by[o.id] = { played: b?.played ?? 0, won: b?.won ?? 0 };
    }
    const ids = (a: unknown): string[] => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string' && !!CARDS[x]) : []);
    return { played: v.played ?? 0, won: v.won ?? 0, cards: ids(v.cards), by, off: ids(v.off) };
  } catch {
    return { played: 0, won: 0, cards: [], by: {}, off: [] };
  }
}
/** ☰ 紀錄用：燼牌戰績與收集 */
export function cardSummary(): { won: number; played: number; have: number; total: number } {
  const st = stats();
  return { won: st.won, played: st.played, have: ownedCards(st.cards).length - PLAYER_DECK.length, total: ALL_REWARDS.length };
}

/** 寶箱裡的燼牌（D-131）：還沒拿過就加進收藏，回傳有沒有新拿到 */
export function grantCard(id: string): boolean {
  if (!CARDS[id]) return false;
  const st = stats();
  if (st.cards.includes(id)) return false;
  st.cards.push(id);
  saveStats(st);
  return true;
}

/** 以前就開過的寶箱（D-131 之前的存檔）：補發牌，回傳補了哪些 */
export function syncChestCards(opened: readonly string[]): string[] {
  const out: string[] = [];
  for (const [chest, id] of Object.entries(CHEST_CARDS)) if (opened.includes(chest) && grantCard(id)) out.push(id);
  return out;
}

function bump(s: Stats, id: string, won: boolean): void {
  s.played++;
  if (won) s.won++;
  const b = (s.by[id] ??= { played: 0, won: 0 });
  b.played++;
  if (won) b.won++;
}
function saveStats(s: Stats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 無痕模式：略過 */
  }
}

function cardColor(id: string): { fill: number; edge: number } {
  const c = CARDS[id]!;
  if (c.ability === 'hero') return { fill: 0x3a2a0c, edge: 0xffd27a };
  if (c.ability === 'scorch') return { fill: 0x3a160a, edge: 0xff7a2a };
  if (c.ability === 'echo') return { fill: 0x2a1438, edge: 0xd89aff };
  if (c.row === undefined) return { fill: 0x2a1a3a, edge: 0xc89aff };
  return c.row === 0 ? { fill: 0x3a1c14, edge: 0xe0805a } : { fill: 0x142438, edge: 0x6ab0ff };
}

export function openEmberCardPanel(scene: Phaser.Scene, ctx: CardCtx, onClose: () => void): Phaser.GameObjects.Container {
  const root = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(960);
  let g: CardGame | null = null;
  let staked = 0;
  let sel = -1;
  let busy = false;
  const helloEcho = Math.random() < 0.6; // 這次打開面板要不要說抉擇的那句（D-157）
  const echoPick = Math.random();
  let lastLog = '';
  /** 這場下注贏到的牌 */
  let prizeCard: string | undefined;
  /** 新牌展示演過了沒（render 會重畫很多次，只演一次） */
  let revealed = false;
  /** 燼爆要演的牌（等 render 完再演，才不會被清掉） */
  let burnPending: [number, Row, string][] | null = null;
  let echoPending: [number, Row, string] | null = null;
  /** 剛出的那張牌（畫面上彈一下）：[side, row, 數量] */
  let fresh: [number, Row, number] | null = null;
  /** 這次的對手：預設是這張地圖的在地對手（沒有就莫托） */
  // 隱藏對手伊妲（D-132）：莫托、薇菈、葛倫都贏過一次才出現（每個營火都在）
  const secretOpen = (): boolean => OPPONENTS.filter((o) => !o.secret && !o.extra).every((o) => (stats().by[o.id]?.won ?? 0) >= 1);
  let here = opponentsAt(ctx.map, secretOpen());
  let who: Opponent = here.filter((o) => !o.secret).slice(-1)[0] ?? here[0]!;
  /** 大廳／牌組一覽 */
  let view: 'lobby' | 'deck' = 'lobby';
  /** 組牌畫面最後點的那張（底下顯示說明） */
  let deckPeek: string | undefined;

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

  // 牌桌（第 28 輪）：木板桌面＋四邊暗角（只畫一次）、桌子中央營火映過來的暖光（每幀閃）
  const table = scene.add.graphics();
  for (let y = -GAME_HEIGHT / 2, i = 0; y < GAME_HEIGHT / 2; y += 58, i++) {
    table.fillStyle(i % 2 ? 0x1e140b : 0x23170d, 1).fillRect(-GAME_WIDTH / 2, y, GAME_WIDTH, 58);
    table.fillStyle(0x0c0704, 1).fillRect(-GAME_WIDTH / 2, y, GAME_WIDTH, 2);
    // 木紋與節眼（固定位置，不用亂數）
    const off = ((i * 197) % 520) - 260;
    table.lineStyle(1, 0x2c1d10, 0.7).lineBetween(-GAME_WIDTH / 2, y + 20, off - 30, y + 22).lineBetween(off + 30, y + 36, GAME_WIDTH / 2, y + 34);
    table.fillStyle(0x140c06, 0.9).fillEllipse(off, y + 29, 34, 12);
    table.lineStyle(1, 0x2c1d10, 0.8).strokeEllipse(off, y + 29, 50, 20);
  }
  for (let k = 0; k < 14; k++) {
    const b = 16 + k * 14;
    table.fillStyle(0x000000, 0.07);
    table.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, b).fillRect(-GAME_WIDTH / 2, GAME_HEIGHT / 2 - b, GAME_WIDTH, b);
    table.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, b * 0.6, GAME_HEIGHT).fillRect(GAME_WIDTH / 2 - b * 0.6, -GAME_HEIGHT / 2, b * 0.6, GAME_HEIGHT);
  }
  const glow = scene.add.graphics();
  const drawGlow = (): void => {
    const t = scene.time.now;
    const f = 0.8 + 0.2 * Math.sin(t / 130) * Math.sin(t / 53);
    glow.clear();
    for (let k = 0; k < 5; k++) glow.fillStyle(0xff9a40, 0.035 * f).fillEllipse(0, -265, 760 - k * 120, 300 - k * 50);
  };
  scene.events.on('update', drawGlow);
  root.once('destroy', () => {
    scene.events.off('update', drawGlow);
    table.destroy();
    glow.destroy();
  });

  const portrait = scene.add.graphics();
  const drawPortrait = (): void => {
    portrait.clear();
    // 360×640（GAME_HEIGHT 1280）時 -560 會讓頭頂超出畫面上緣（第 46 輪）：腳的位置至少離上緣 108
    const py = Math.max(-560, -GAME_HEIGHT / 2 + 108);
    if (who.id === 'merchant') drawMerchant(portrait, -282, py, 96, scene.time.now);
    else drawCardRival(portrait, who.id, -282, py, 90, scene.time.now);
  };
  scene.events.on('update', drawPortrait);
  root.once('destroy', () => {
    scene.events.off('update', drawPortrait);
    portrait.destroy();
  });

  /** 場上一排：標籤、戰號、牌、點數 */
  const drawRow = (items: Phaser.GameObjects.GameObject[], game: CardGame, side: number, row: Row, y: number): void => {
    const S = game.sides[side]!;
    const weather = game.weather[row];
    items.push(scene.add.rectangle(0, y, 680, 104, weather ? (row === 0 ? 0x1a2a3a : 0x2a2a30) : 0x0e0a06, 0.62).setStrokeStyle(2, side === 0 ? 0x8a6a3a : 0x5a4a6a, 0.8));
    // 第 47 輪：排名放大到 19px 後「莫托前排・霜寒」會壓到第一張牌 → 天候改成排名下面一行（和戰號同一欄）
    items.push(scene.add.text(-330, y - 36, `${side === 0 ? '你的' : who.short}${ROW_NAME[row]}`, { fontFamily: UI_FONT, fontSize: '19px', color: weather ? '#9fd8ff' : '#a89880' }).setOrigin(0, 0.5));
    if (S.horn[row]) items.push(scene.add.text(-330, y + 4, '戰號×2', { fontFamily: UI_FONT, fontSize: '20px', color: '#ffd27a' }).setOrigin(0, 0.5));
    if (weather) items.push(scene.add.text(-330, y + (S.horn[row] ? 34 : 4), row === 0 ? '❄ 霜寒' : '☁ 濃霧', { fontFamily: UI_FONT, fontSize: '19px', color: '#9fd8ff' }).setOrigin(0, 0.5));
    const n = S.rows[row].length;
    const gap = Math.min(64, 480 / Math.max(1, n));
    S.rows[row].forEach((id, i) => {
      const x = -230 + 30 + i * gap;
      const col = cardColor(id);
      const pop = fresh && fresh[0] === side && fresh[1] === row && i === n - 1 && fresh[2] === n;
      const card = scene.add.container(x, y);
      card.add(scene.add.rectangle(0, 6, 56, 80, col.fill, 1).setStrokeStyle(pop ? 4 : 2, pop ? 0xffffff : col.edge, 1));
      const p = cardPower(game, side, row, id);
      const base = CARDS[id]!.power;
      card.add(scene.add.text(0, -10, `${p}`, { fontFamily: TITLE_FONT, fontSize: '28px', color: p > base ? '#7dffb0' : p < base ? '#ff8a7a' : '#ffffff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5));
      card.add(scene.add.text(0, 30, CARDS[id]!.name.slice(0, 2), { fontFamily: UI_FONT, fontSize: '17px', color: '#e8dcc8' }).setOrigin(0.5));
      items.push(card);
      if (pop) {
        // 莫托的牌從上方（他的手）飛進來；你的牌從下方手牌區彈上來
        const fromTop = lastLog.startsWith(who.short);
        scene.tweens.add({ targets: card, x: { from: fromTop ? 0 : x, to: x }, y: { from: fromTop ? -600 : 140, to: y }, scale: { from: 1.5, to: 1 }, angle: { from: fromTop ? -12 : 6, to: 0 }, duration: 320, ease: 'Cubic.Out' });
      }
    });
    items.push(scene.add.circle(300, y + 6, 30, 0x0a0806, 1).setStrokeStyle(3, 0xffd27a, 0.9));
    items.push(scene.add.text(300, y + 6, `${rowScore(game, side, row)}`, { fontFamily: TITLE_FONT, fontSize: '28px', color: '#ffe08a' }).setOrigin(0.5));
  };

  const gems = (wins: number): string => '◆'.repeat(Math.min(2, wins)) + '◇'.repeat(Math.max(0, 2 - wins));

  function render(): void {
    root.remove(portrait);
    root.remove(table);
    root.remove(glow);
    root.removeAll(true);
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x080604, 1).setInteractive()];
    items.push(table, glow, portrait);
    items.push(scene.add.text(30, -600, '營火燼牌', { fontFamily: TITLE_FONT, fontSize: '42px', color: '#ffd27a' }).setOrigin(0.5));
    if (!g) {
      if (view === 'deck') deckView(items);
      else lobby(items);
      root.add(items);
      return;
    }
    const game = g;
    const op = game.sides[1];
    const me = game.sides[0];
    items.push(scene.add.text(30, -552, `${who.name}　手牌 ${op.hand.length}　${gems(op.wins)}　${op.passed ? '【已放棄】' : ''}`, { fontFamily: UI_FONT, fontSize: '21px', fontStyle: '700', color: op.passed ? '#a89880' : '#e8c8a0' }).setOrigin(0.5));
    items.push(scene.add.text(30, -520, `第 ${game.round} 局　${who.short} ${totalScore(game, 1)}　你 ${totalScore(game, 0)}`, { fontFamily: UI_FONT, fontSize: '20px', color: '#ffe08a' }).setOrigin(0.5));
    drawRow(items, game, 1, 1, -440);
    drawRow(items, game, 1, 0, -330);
    items.push(scene.add.text(0, -265, lastLog || (game.turn === 0 ? '輪到你出牌' : `${who.short}思考中…`), { fontFamily: UI_FONT, fontSize: '19px', color: '#c8d0f0' }).setOrigin(0.5));
    drawRow(items, game, 0, 0, -200);
    drawRow(items, game, 0, 1, -90);
    items.push(scene.add.text(0, -18, `你　${gems(me.wins)}　手牌 ${me.hand.length}${me.passed ? '　【已放棄】' : ''}${staked ? `　賭注 ${staked} 金` : '　練習'}`, { fontFamily: UI_FONT, fontSize: '21px', fontStyle: '700', color: '#ffe08a' }).setOrigin(0.5));
    if (game.over) {
      result(items, game);
      root.add(items);
      return;
    }
    // 手牌：兩排、每排 6 張
    const myTurn = game.turn === 0 && !me.passed && !busy;
    me.hand.forEach((id, i) => {
      const r = Math.floor(i / 6);
      const inRow = Math.min(6, me.hand.length - r * 6);
      const x = (i % 6 - (inRow - 1) / 2) * 110;
      const y = 90 + r * 160 - (sel === i ? 16 : 0);
      const col = cardColor(id);
      const c = CARDS[id]!;
      const bg = scene.add.rectangle(x, y, 100, 144, col.fill, 1).setStrokeStyle(sel === i ? 5 : 3, sel === i ? 0xffffff : col.edge, 1);
      if (myTurn)
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          SFX.uiTap();
          if (sel === i) play(i);
          else {
            sel = i;
            render();
          }
        });
      items.push(bg);
      if (c.power) {
        items.push(scene.add.circle(x - 30, y - 46, 20, 0x0a0806, 1).setStrokeStyle(2, col.edge, 1));
        items.push(scene.add.text(x - 30, y - 46, `${c.power}`, { fontFamily: TITLE_FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5));
      }
      items.push(scene.add.text(x + 32, y - 50, c.row === undefined ? '特' : c.row === 0 ? '前' : '後', { fontFamily: UI_FONT, fontSize: '16px', color: hexOf(col.edge) }).setOrigin(0.5));
      const tag = c.ability === 'bond' ? '同袍' : c.ability === 'scout' ? '斥候' : c.ability === 'hero' ? '傳奇' : c.ability === 'scorch' ? '燼爆' : c.ability === 'echo' ? '回響' : '';
      if (tag) items.push(scene.add.text(x, y + 6, tag, { fontFamily: UI_FONT, fontSize: '15px', color: '#ffd27a' }).setOrigin(0.5));
      items.push(scene.add.text(x, y + 44, c.name, { fontFamily: UI_FONT, fontSize: '17px', color: '#f0e6d8', align: 'center', wordWrap: { width: 92, useAdvancedWrap: true } }).setOrigin(0.5));
    });
    const sc = sel >= 0 ? me.hand[sel] : undefined;
    // 第 48 輪：名稱一行、說明一行；以前「（1 點・後排）」的空格讓自動換行斷在「（1⏎點」
    const info = sc ? `${CARDS[sc]!.name}${CARDS[sc]!.power ? `（${CARDS[sc]!.power}點・${CARDS[sc]!.row === 0 ? '前排' : '後排'}）` : ''}${CARDS[sc]!.desc ? `\n${CARDS[sc]!.desc}` : ''}` : myTurn ? (coach(game) ?? '點一張牌看說明，再點一次打出') : '';
    items.push(scene.add.text(0, 420 + infoDy(), info, { fontFamily: UI_FONT, fontSize: '19px', color: '#e8dcc8', align: 'center', wordWrap: { width: 640, useAdvancedWrap: true } }).setOrigin(0.5));
    const canPlay = myTurn && sel >= 0 && legalMoves(game, 0).some((m) => m.type === 'play' && m.card === sel);
    if (sc && myTurn && !canPlay && CARDS[sc]!.ability === 'horn') {
      // 戰號不能吹在空排（第 28 輪）：說明為什麼按不下去
      items.push(scene.add.text(0, 462 + infoDy(), '現在沒有能加倍的牌（傳奇不吃戰號）——先出單位牌再吹', { fontFamily: UI_FONT, fontSize: '17px', color: '#ff9a8a' }).setOrigin(0.5));
    }
    items.push(btn(-200, 500 + btnDy(), '出牌', () => play(sel), true, 24, !canPlay));
    items.push(btn(20, 500 + btnDy(), '放棄這一局', () => pass(), false, 22, !myTurn));
    items.push(btn(230, 500 + btnDy(), staked ? '認輸離開' : '離開', () => leave(), false, 22));
    root.add(items);
  }

  function lobby(items: Phaser.GameObjects.GameObject[]): void {
    const st = stats();
    // 抉擇（D-157）與路上的相遇（D-159）的回聲：兩句都有的話隨機挑一句
    const echoes = [rivalEcho(who.id, loadChoices()), rivalEncounterEcho(who.id, loadEncounters())].filter((x): x is string => !!x);
    const echo = echoes.length ? echoes[Math.floor(echoPick * echoes.length)]! : null;
    const hello = scene.add.text(30, -545, `${who.short}：${echo && helloEcho ? echo : who.hello}`, { fontFamily: UI_FONT, fontSize: '19px', color: '#e8c8a0', align: 'center' }).setOrigin(0.5);
    // 一行放不下時在靠中間的標點後面換行（第 70 輪，D-202：以前自動換行會把「。」」孤零零擠到第二行）
    if (hello.width > 520) hello.setText(breakAtPunct(hello.text));
    if (hello.width > 520) hello.setWordWrapWidth(520, true);
    // 招呼語兩行時整組往上挪，打法那行不壓到頁籤
    if (hello.height > 40) hello.setY(-545 - (hello.height - 28) / 2);
    items.push(hello, scene.add.text(30, -514, `打法：${who.blurb}`, { fontFamily: UI_FONT, fontSize: '17px', color: '#b8a890' }).setOrigin(0.5));
    // 對手：三個頁籤；不在這張地圖的對手顯示去哪裡找（D-129）
    here = opponentsAt(ctx.map, secretOpen());
    // 通關後地圖的對手（D-139）：在他的營火、或交手過才列出來；五個頁籤時縮窄一點
    const tabs = OPPONENTS.filter((o) => !o.extra || here.includes(o) || !!st.by[o.id]);
    const step = tabs.length > 4 ? 138 : 172;
    tabs.forEach((o, i) => {
      const x = (i - (tabs.length - 1) / 2) * step;
      const ok = here.includes(o);
      const on = o === who;
      const b = st.by[o.id];
      const t = scene.add
        .text(x, -470, `${o.secret && !ok ? '？？？' : o.short}${b?.won ? `  ${b.won}勝` : ''}`, { fontFamily: UI_FONT, fontSize: tabs.length > 4 ? '20px' : '22px', fontStyle: '700', color: on ? '#1a0f08' : ok ? '#ffffff' : '#7a7064', backgroundColor: on ? '#ffd27a' : ok ? '#3a2a14' : '#1e1810', align: 'center' })
        .setOrigin(0.5)
        .setPadding(tabs.length > 4 ? 10 : 16, 8, tabs.length > 4 ? 10 : 16, 8);
      if (ok && !on)
        t.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          SFX.uiTap();
          who = o;
          render();
        });
      items.push(t);
      // 第 45 輪：以前每個頁籤下面都塞一行 14px 說明（手機上約 7px、互相黏在一起）→ 只有還沒解鎖的寫「在哪」，選中的對手打法寫在招呼語下面
      if (!ok) items.push(scene.add.text(x, -431, o.secret ? '贏過前三位' : `${worldMap(o.map ?? '')?.name ?? '別的地圖'}營火`, { fontFamily: UI_FONT, fontSize: '18px', color: '#9a8e80', align: 'center', wordWrap: { width: step - 8, useAdvancedWrap: true } }).setOrigin(0.5, 0));
    });
    const rules = [
      '三局兩勝。雙方各抽 10 張牌，整場不補牌。',
      '輪流出一張牌到前排或後排，總點數高的贏這一局。',
      '覺得夠了就「放棄這一局」：對手還能繼續出，',
      '但你省下的牌留到下一局——什麼時候收手是關鍵。',
      // 第 43 輪：伊妲出現後多一行「回響」，空行就拿掉（以前最後一行壓到「你的牌組…」）
      ...(secretOpen() ? [] : ['']),
      '同袍：同排的同名牌越多越強',
      '斥候：送到對手那邊，換你抽 2 張',
      '戰號：一排點數 ×2　傳奇：不受天候與戰號影響',
      '霜寒／濃霧：雙方前排／後排都變 1 點　晴空：解除',
      '燼爆：燒掉場上點數最高的單位（雙方都算）',
      ...(secretOpen() ? ['回響：再複製一張自己場上最強的單位'] : []),
    ];
    items.push(scene.add.text(0, -380, rules.join('\n'), { fontFamily: UI_FONT, fontSize: '19px', color: '#e8dcc8', align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0));
    const nx = nextReward(st.cards, who);
    const stake = who.stake;
    items.push(scene.add.text(0, -50, `你的牌組 ${deckWith(st.cards, st.off).length + 1} 張（含晴空）・寶箱裡的燼牌 ${Object.values(CHEST_CARDS).filter((id) => st.cards.includes(id)).length}/${Object.keys(CHEST_CARDS).length}\n${nx ? `下注贏了，${who.short}會把「${CARDS[nx]!.name}」給你` : `${who.short}的牌你全都贏到了！`}`, { fontFamily: UI_FONT, fontSize: '19px', color: '#c8d0f0', align: 'center', lineSpacing: 6, wordWrap: { width: 640, useAdvancedWrap: true } }).setOrigin(0.5));
    items.push(scene.add.text(0, 10, `戰績 ${st.won} 勝 / ${st.played} 場　手上金幣 ${ctx.coin()}`, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#ffe08a' }).setOrigin(0.5));
    const can = ctx.coin() >= stake;
    items.push(btn(0, 90, can ? `下注 ${stake} 金開局（贏了拿 ${stake * 2}）` : `金幣不夠下注（${stake}）`, () => start(true), true, 26, !can));
    items.push(btn(0, 180, '練習一局（不賭）', () => start(false), false, 24));
    items.push(btn(0, 290, `我的牌組（帶 ${deckWith(st.cards, st.off).length} 張）`, () => {
      view = 'deck';
      render();
    }, false, 24));
    items.push(btn(0, 500 + btnDy(), ctx.closeLabel ?? '回行商', () => onClose(), false, 26));
  }

  /**
   * 新手教練（前 3 場）：輪到你時，在說明列提示「什麼時候該收手」——燼牌最難懂的就是放棄。
   * 只看局面、不改規則；回 undefined 就顯示一般說明。
   */
  function coach(game: CardGame): string | undefined {
    if (stats().played >= 3) return undefined;
    const me = game.sides[0];
    const op = game.sides[1];
    const lead = totalScore(game, 0) - totalScore(game, 1);
    const n = who.short;
    if (op.passed && lead > 0) return `提示：${n}放棄了，你已經領先——現在放棄就贏下這局，還省下手牌`;
    // 第 62 輪：手上的牌全出也追不上，就別叫人「出剛好超過的小牌」（以前落後 8 分、只剩一張 3 點也這樣講）
    const reach = op.passed && lead < 0 ? maxReach(game, 0) : null;
    if (reach !== null && reach < totalScore(game, 1)) return op.wins < 1 && game.round < 3 ? `提示：手上的牌全出也追不上${n}了——放棄這一局，把牌留到下一局` : `提示：手上的牌全出也追不上${n}了，這局只能認了`;
    if (op.passed && lead <= 0) return `提示：${n}放棄了：出「剛好超過」的小牌就好，別浪費大牌`;
    if (game.round === 1 && lead <= -12 && me.hand.length >= op.hand.length) return `提示：落後太多？放棄這一局，把好牌留到後兩局（${n}已經多花了牌）`;
    if (game.round === 1 && me.hand.length <= 5) return '提示：第一局就快把牌打光了——三局兩勝，留點牌給後面';
    if (me.wins >= 1 && game.round >= 2) return '提示：你已經贏一局：再贏這局就拿下整場';
    return undefined;
  }

  /** 自己組牌（D-130）：點一張牌切換「帶上／留在箱子裡」，至少 12 張，超過 18 張自動拿掉最弱的 */
  function deckView(items: Phaser.GameObjects.GameObject[]): void {
    const st = stats();
    const owned = ownedCards(st.cards)
      .map((id, i) => ({ id, i }))
      .sort((a, b) => {
        const A = CARDS[a.id]!;
        const B = CARDS[b.id]!;
        return (A.row ?? 2) - (B.row ?? 2) || B.power - A.power || a.id.localeCompare(b.id) || a.i - b.i;
      });
    const offLeft = [...st.off];
    const marks = owned.map(({ id }) => {
      const k = offLeft.indexOf(id);
      if (k >= 0) offLeft.splice(k, 1);
      return k >= 0;
    });
    const using = marks.filter((m) => !m).length;
    const final = deckWith(st.cards, st.off);
    // 會被自動拿掉的：帶上的牌裡多出來的那幾張（同 id 從後面算）
    const finalLeft = [...final];
    const trimmed = owned.map(({ id }, i) => {
      if (marks[i]) return false;
      const k = finalLeft.indexOf(id);
      if (k >= 0) finalLeft.splice(k, 1);
      return k < 0;
    });
    items.push(scene.add.text(30, -545, '點一張牌看說明，再點一次：帶上場 ⇄ 留在箱子裡', { fontFamily: UI_FONT, fontSize: '20px', color: '#e8c8a0' }).setOrigin(0.5));
    const cols = 7;
    owned.forEach(({ id }, i) => {
      const x = ((i % cols) - (cols - 1) / 2) * 98;
      const y = -440 + Math.floor(i / cols) * 132;
      const c = CARDS[id]!;
      const col = cardColor(id);
      const off = marks[i]!;
      const cut = trimmed[i]!;
      const peek = deckPeek === id;
      const bg = scene.add.rectangle(x, y, 88, 120, col.fill, off ? 0.35 : 1).setStrokeStyle(peek ? 5 : 3, peek ? 0xffe08a : off ? 0x4a4038 : cut ? 0x8a7a6a : col.edge, 1);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        // 第 31 輪：第一次點只看說明（金框），同一張再點一次才切換帶上／留在箱子裡
        if (deckPeek !== id) {
          deckPeek = id;
          SFX.uiTap();
          render();
          return;
        }
        const s2 = stats();
        if (off) {
          const k = s2.off.indexOf(id);
          if (k >= 0) s2.off.splice(k, 1);
        } else {
          if (using <= DECK_MIN) {
            SFX.uiTap();
            bigText(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2, `至少要帶 ${DECK_MIN} 張`, '#ff9a8a', 34, 700).setDepth(990);
            return;
          }
          s2.off.push(id);
        }
        SFX.cardPlace();
        saveStats(s2);
        render();
      });
      items.push(bg);
      const a = off ? 0.4 : 1;
      if (c.power) items.push(scene.add.text(x - 28, y - 42, `${c.power}`, { fontFamily: TITLE_FONT, fontSize: '22px', color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setAlpha(a));
      items.push(scene.add.text(x + 30, y - 44, c.row === undefined ? '特' : c.row === 0 ? '前' : '後', { fontFamily: UI_FONT, fontSize: '14px', color: hexOf(col.edge) }).setOrigin(0.5).setAlpha(a));
      const tag = c.ability === 'bond' ? '同袍' : c.ability === 'scout' ? '斥候' : c.ability === 'hero' ? '傳奇' : c.ability === 'scorch' ? '燼爆' : c.ability === 'echo' ? '回響' : '';
      if (tag && !off && !cut) items.push(scene.add.text(x, y - 4, tag, { fontFamily: UI_FONT, fontSize: '14px', color: '#ffd27a' }).setOrigin(0.5).setAlpha(a));
      items.push(scene.add.text(x, y + 32, c.name, { fontFamily: UI_FONT, fontSize: '17px', color: '#f0e6d8', align: 'center', wordWrap: { width: 80, useAdvancedWrap: true } }).setOrigin(0.5).setAlpha(a));
      if (off) items.push(scene.add.text(x, y + 6, '箱子', { fontFamily: UI_FONT, fontSize: '16px', fontStyle: '700', color: '#a89880', backgroundColor: '#1a140e' }).setOrigin(0.5).setPadding(4, 2, 4, 2));
      else if (cut) items.push(scene.add.text(x, y + 6, '超額', { fontFamily: UI_FONT, fontSize: '14px', color: '#ff9a8a', backgroundColor: '#1a140e' }).setOrigin(0.5).setPadding(4, 2, 4, 2));
    });
    const rows = Math.ceil(owned.length / cols);
    const ty = -440 + rows * 132 + 10;
    // 第 63 輪：說明字以名稱開頭的（戰號、燼爆）不要再重複一次名稱；說明字長時按鈕跟著往下（最多到畫面下緣上方 70）
    const pc = deckPeek ? CARDS[deckPeek]! : undefined;
    const peekDesc = pc?.desc?.startsWith(`${pc.name}：`) ? pc.desc.slice(pc.name.length + 1) : pc?.desc;
    const info = scene.add.text(0, ty, `帶上 ${using} 張（${DECK_MIN}～${DECK_MAX} 張；超過時「超額」的最弱單位不會上場）\n另外每場都會多一張「晴空」${pc ? `\n\n${pc.name}${pc.power ? `（${pc.power}點・${pc.row === 0 ? '前排' : '後排'}）` : ''}${peekDesc ? `：${peekDesc}` : ''}` : ''}`, { fontFamily: UI_FONT, fontSize: '19px', color: using > DECK_MAX ? '#ff9a8a' : '#ffe08a', align: 'center', lineSpacing: 6, wordWrap: { width: 660, useAdvancedWrap: true } }).setOrigin(0.5, 0);
    items.push(info);
    const by = Math.min(Math.max(500 + btnDy(), ty + info.height + 50), GAME_HEIGHT / 2 - 70);
    items.push(btn(-130, by, '全部帶上', () => {
      const s2 = stats();
      s2.off = [];
      saveStats(s2);
      render();
    }, false, 22));
    items.push(btn(120, by, '完成', () => {
      view = 'lobby';
      render();
    }, true, 26));
  }

  function result(items: Phaser.GameObjects.GameObject[], game: CardGame): void {
    const w = game.winner;
    const msg = w === 0 ? '你贏了！' : w === 1 ? `${who.short}贏了` : '平手';
    const line = prizeCard ? '「這張牌歸你了……好好用它。」' : w === 0 ? who.lose : w === 1 ? who.win : '「勢均力敵，再來？」';
    // 第 41 輪：下注局附上手上剩多少金幣（輸了才知道還能不能再賭）
    const prize = (staked ? `${w === 0 ? `＋${staked * 2} 金` : w === -1 ? `退回 ${staked} 金` : `輸掉 ${staked} 金`}（手上 ${ctx.coin()} 金）` : '練習局') + (prizeCard ? `　＋新牌「${CARDS[prizeCard]!.name}」` : '');
    items.push(scene.add.text(0, 120, msg, { fontFamily: TITLE_FONT, fontSize: '64px', color: w === 0 ? '#ffd27a' : w === 1 ? '#ff9a8a' : '#c8d0f0', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5));
    items.push(scene.add.text(0, 200, `${game.results.map((r, i) => `第 ${i + 1} 局 ${r === 0 ? '勝' : r === 1 ? '負' : '平'}`).join('　')}\n${prize}\n${who.short}：${line}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#e8dcc8', align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0));
    items.push(btn(-120, 470 + btnDy(), '再來一局', () => {
      g = null;
      render();
    }, true, 26));
    items.push(btn(120, 470 + btnDy(), ctx.closeLabel ?? '回行商', () => onClose(), false, 26));
    if (prizeCard && !revealed) {
      revealed = true;
      scene.time.delayedCall(450, () => {
        if (root.active && prizeCard) reveal(prizeCard);
      });
    }
  }

  /** 一張大牌（新牌展示、牌組一覽用） */
  function bigCard(x: number, y: number, id: string, k = 1): Phaser.GameObjects.Container {
    const c = CARDS[id]!;
    const col = cardColor(id);
    const box = scene.add.container(x, y);
    box.add(scene.add.rectangle(0, 0, 200 * k, 290 * k, col.fill, 1).setStrokeStyle(6 * k, col.edge, 1));
    box.add(scene.add.rectangle(0, -30 * k, 170 * k, 150 * k, 0x000000, 0.25).setStrokeStyle(2 * k, col.edge, 0.5));
    if (c.power) {
      box.add(scene.add.circle(-62 * k, -108 * k, 30 * k, 0x0a0806, 1).setStrokeStyle(3 * k, col.edge, 1));
      box.add(scene.add.text(-62 * k, -108 * k, `${c.power}`, { fontFamily: TITLE_FONT, fontSize: `${36 * k}px`, color: '#ffffff' }).setOrigin(0.5));
    }
    box.add(scene.add.text(62 * k, -110 * k, c.row === undefined ? '特殊' : c.row === 0 ? '前排' : '後排', { fontFamily: UI_FONT, fontSize: `${20 * k}px`, color: hexOf(col.edge) }).setOrigin(0.5));
    // 中間的紋章：依能力畫不同的符號
    const sym = c.ability === 'hero' ? '★' : c.ability === 'scorch' ? '✹' : c.ability === 'echo' ? '❖' : c.ability === 'bond' ? '∞' : c.ability === 'scout' ? '◎' : c.ability === 'horn' ? '♫' : c.row === 0 ? '⚔' : c.row === 1 ? (/術|先知|巫|法/.test(c.name) ? '✦' : '➶') : '❄'; // 第 47 輪：燼火術士、星語先知不再畫成弓箭
    box.add(scene.add.text(0, -30 * k, sym, { fontFamily: UI_FONT, fontSize: `${70 * k}px`, color: hexOf(col.edge) }).setOrigin(0.5).setAlpha(0.85));
    box.add(scene.add.text(0, 72 * k, c.name, { fontFamily: TITLE_FONT, fontSize: `${30 * k}px`, color: '#f8ecd8', stroke: '#000', strokeThickness: 4 * k }).setOrigin(0.5));
    if (c.desc) box.add(scene.add.text(0, 112 * k, c.desc.split('：')[0]!, { fontFamily: UI_FONT, fontSize: `${18 * k}px`, color: '#ffd27a' }).setOrigin(0.5));
    return box;
  }

  /** 贏到新牌：暗幕＋旋轉光芒＋翻牌（點一下關掉） */
  function reveal(id: string): void {
    const ov = scene.add.container(0, 0);
    // 第 47 輪：0.78 時底下結算的「你贏了！」大字會從說明字後面透出來
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.9).setInteractive();
    const rays = scene.add.graphics();
    const hero = CARDS[id]!.ability === 'hero';
    const rc = hero ? 0xffd27a : cardColor(id).edge;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rays.fillStyle(rc, 0.16).fillTriangle(0, 0, Math.cos(a - 0.12) * 520, Math.sin(a - 0.12) * 520, Math.cos(a + 0.12) * 520, Math.sin(a + 0.12) * 520);
    }
    rays.setPosition(0, -140);
    const card = bigCard(0, -140, id, 1.25);
    const t1 = scene.add.text(0, -380, hero ? '傳奇卡！' : '獲得新牌！', { fontFamily: TITLE_FONT, fontSize: '54px', color: hero ? '#ffd27a' : '#ffffff', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5);
    const t2 = scene.add.text(0, 120, `「${CARDS[id]!.name}」加進你的牌組\n點一下繼續`, { fontFamily: UI_FONT, fontSize: '22px', color: '#e8dcc8', align: 'center', lineSpacing: 8, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
    ov.add([dim, rays, card, t1, t2]);
    root.add(ov);
    card.setScale(0.01, 1.25);
    scene.tweens.add({ targets: card, scaleX: 1, scaleY: 1, duration: 520, ease: 'Back.Out' });
    scene.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
    scene.tweens.add({ targets: rays, alpha: { from: 0, to: 1 }, duration: 600 });
    scene.tweens.add({ targets: t1, scale: { from: 1.6, to: 1 }, alpha: { from: 0, to: 1 }, duration: 400, ease: 'Cubic.Out' });
    scene.cameras.main.flash(220, 255, 230, 160);
    SFX.itemGet();
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 140 + Math.random() * 200;
      const e = scene.add.circle(0, -140, 3 + Math.random() * 5, rc, 1);
      ov.add(e);
      scene.tweens.add({ targets: e, x: Math.cos(a) * d, y: -140 + Math.sin(a) * d, alpha: 0, duration: 700 + Math.random() * 500, ease: 'Cubic.Out' });
    }
    dim.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      scene.tweens.killTweensOf(rays);
      ov.destroy();
    });
  }

  function start(bet: boolean): void {
    if (bet) {
      if (ctx.coin() < who.stake) return;
      ctx.pay(who.stake);
      staked = who.stake;
    } else staked = 0;
    g = newCardGame((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, [deckWith(stats().cards, stats().off), who.deck], who.short);
    prizeCard = undefined;
    revealed = false;
    sel = -1;
    lastLog = `${staked ? `付出賭注 ${staked} 金・` : ''}${g.turn === 0 ? '擲硬幣：你先手' : `擲硬幣：${who.short}先手`}`;
    fresh = null;
    render();
    if (g.turn === 1) aiTurn(1000);
  }

  function finishIfOver(): void {
    if (!g?.over) return;
    const wasOpen = secretOpen();
    const st = stats();
    bump(st, who.id, g.winner === 0);
    saveStats(st);
    if (!wasOpen && secretOpen()) {
      // 三家都贏過一次：隱藏對手出現（D-132）
      scene.time.delayedCall(1600, () => {
        if (!root.active) return;
        bigText(scene, GAME_WIDTH / 2, 520, '有人在營火邊翻開了一本書……\n隱藏對手「伊妲」出現了', '#c8a0ff', 34, 2400).setDepth(990);
        SFX.cardMagic();
      });
    }
    if (staked && g.winner === 0) {
      prizeCard = nextReward(st.cards, who);
      if (prizeCard) {
        st.cards.push(prizeCard);
        saveStats(st);
      }
    }
    if (staked) {
      if (g.winner === 0) ctx.pay(-staked * 2);
      else if (g.winner === -1) ctx.pay(-staked);
    }
    if (g.winner === 0) {
      SFX.itemGet();
      scene.cameras.main.flash(200, 255, 220, 120);
    }
  }

  /** 記下剛出的牌在哪一排（出牌前後比對各排張數） */
  function snap(game: CardGame): number[] {
    return game.sides.flatMap((S) => [S.rows[0].length, S.rows[1].length]);
  }
  function after(before: number[], rounds: number): void {
    if (!g) return;
    lastLog = g.log[g.log.length - 1] ?? '';
    // 出牌音效與斥候說明（看最後一張被打出的牌）
    const played = /「(.+)」/.exec(lastLog)?.[1];
    const pc = played ? Object.values(CARDS).find((c) => c.name === played) : undefined;
    if (pc && g.results.length === rounds) {
      if (pc.row === undefined) SFX.cardMagic();
      else SFX.cardPlace();
      if (pc.ability === 'scout') lastLog = lastLog.startsWith('你') ? `你把「${pc.name}」送到${who.short}那邊，抽了 2 張` : `${who.short}把「${pc.name}」送到你這邊，抽了 2 張`;
      else if (pc.ability === 'scorch') {
        const burnt = g.lastBurn ?? [];
        lastLog = burnt.length ? `燼爆！燒掉了${burnt.map(([sd, , id]) => `${sd === 0 ? '你的' : who.short + '的'}「${CARDS[id]!.name}」`).join('、')}` : `${lastLog}——場上沒有能燒的牌`;
        if (burnt.length) burnPending = burnt;
      } else if (pc.ability === 'echo') {
        const e = g.lastEcho;
        const mine = lastLog.startsWith('你');
        lastLog = e ? `回響！${mine ? '你' : who.short}的「${CARDS[e[2]]!.name}」多了一張` : `${lastLog}——場上沒有能複製的單位`;
        if (e) echoPending = e;
      }
      else if (pc.ability === 'frost' || pc.ability === 'fog') lastLog += `——雙方${pc.ability === 'frost' ? '前排' : '後排'}都變 1 點`;
      else if (pc.ability === 'horn') lastLog += '——一排點數 ×2';
    }
    const now = snap(g);
    const k = now.findIndex((v, i) => v > before[i]!);
    fresh = k >= 0 && g.results.length === rounds ? [Math.floor(k / 2), (k % 2) as Row, now[k]!] : null;
    let wait = 700;
    if (g.results.length > rounds) {
      // 一局結束：大字＋多停一下
      const r = g.results[g.results.length - 1]!;
      // 第 58 輪：最後一局不再出「第 3 局　伊妲贏了」大字——結算畫面已經列出每局結果，大字會壓在結算的標題上
      if (g.over) { if (r === 0) SFX.itemGet(); } else {
      const t = bigText(scene, GAME_WIDTH / 2, 560, r === 0 ? `第 ${rounds + 1} 局　你贏了！` : r === 1 ? `第 ${rounds + 1} 局　${who.short}贏了` : `第 ${rounds + 1} 局　平手`, r === 0 ? '#ffd27a' : r === 1 ? '#ff9a8a' : '#c8d0f0', 46, 1100);
      t.setDepth(990);
      if (r === 0) SFX.itemGet();
      }
      wait = 1700;
    }
    finishIfOver();
    render();
    if (burnPending) {
      burnFx(burnPending);
      burnPending = null;
    }
    if (echoPending) {
      echoFx(echoPending);
      echoPending = null;
    }
    if (!g.over && g.turn === 1) aiTurn(wait);
  }

  function play(i: number): void {
    if (!g || busy || g.turn !== 0 || i < 0) return;
    const before = snap(g);
    const rounds = g.results.length;
    if (!applyMove(g, 0, { type: 'play', card: i })) return;
    sel = -1;
    scene.cameras.main.shake(80, 0.003);
    after(before, rounds);
  }

  function pass(): void {
    if (!g || busy || g.turn !== 0) return;
    const before = snap(g);
    const rounds = g.results.length;
    applyMove(g, 0, { type: 'pass' });
    sel = -1;
    after(before, rounds);
  }

  function aiTurn(wait = 700): void {
    busy = true;
    render();
    scene.time.delayedCall(wait, () => {
      busy = false;
      if (!g || g.over || g.turn !== 1 || !root.active) return;
      const before = snap(g);
      const rounds = g.results.length;
      applyMove(g, 1, aiMove(g, 1, who));
      after(before, rounds);
    });
  }

  function leave(): void {
    if (g && !g.over && staked) {
      // 認輸：賭注給莫托
      const st = stats();
      bump(st, who.id, false);
      saveStats(st);
    }
    onClose();
  }

  /** 燼爆演出：橘色閃光＋震動；被燒的牌在原本那一排的尾端燒成灰（變橘、放大、淡出、往上冒火星） */
  function burnFx(burnt: [number, Row, string][]): void {
    scene.cameras.main.flash(180, 255, 140, 60);
    scene.cameras.main.shake(220, 0.008);
    SFX.cardMagic();
    const rowY = (side: number, row: Row): number => (side === 1 ? (row === 1 ? -440 : -330) : row === 0 ? -200 : -90);
    const cx = GAME_WIDTH / 2;
    burnt.forEach(([side, row, id], k) => {
      const n = g?.sides[side]?.rows[row].length ?? 0;
      const gap = Math.min(64, 480 / Math.max(1, n + 1));
      const x = cx - 200 + (n + k) * gap;
      const y = GAME_HEIGHT / 2 + rowY(side, row) + 6;
      const ghost = scene.add.container(x, y).setDepth(995);
      ghost.add(scene.add.rectangle(0, 0, 56, 80, 0xff6a20, 1).setStrokeStyle(3, 0xffe0a0, 1));
      ghost.add(scene.add.text(0, 0, CARDS[id]!.name.slice(0, 2), { fontFamily: UI_FONT, fontSize: '16px', color: '#2a0a00' }).setOrigin(0.5));
      scene.tweens.add({ targets: ghost, scale: 1.35, alpha: 0, angle: (Math.random() - 0.5) * 20, duration: 750, ease: 'Cubic.easeIn', onComplete: () => ghost.destroy() });
      for (let i = 0; i < 12; i++) {
        const e = scene.add.circle(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 70, 3 + Math.random() * 5, Math.random() < 0.5 ? 0xff7a2a : 0xffd27a, 1).setDepth(996);
        scene.tweens.add({ targets: e, y: e.y - 60 - Math.random() * 90, x: e.x + (Math.random() - 0.5) * 40, alpha: 0, scale: 0.3, duration: 600 + Math.random() * 500, ease: 'Cubic.easeOut', onComplete: () => e.destroy() });
      }
    });
  }

  /** 回響（D-135）：被複製的那排泛起紫色波紋，新的那張從說書回聲的位置飄過去 */
  function echoFx([side, row, id]: [number, Row, string]): void {
    scene.cameras.main.flash(160, 200, 140, 255);
    SFX.cardMagic();
    const rowY = (sd: number, r: Row): number => (sd === 1 ? (r === 1 ? -440 : -330) : r === 0 ? -200 : -90);
    const cx = GAME_WIDTH / 2;
    const y = GAME_HEIGHT / 2 + rowY(side, row) + 6;
    const from = GAME_HEIGHT / 2 + rowY(side, 1) + 6;
    for (let k = 0; k < 3; k++) {
      const ring = scene.add.ellipse(cx, y, 80, 30).setStrokeStyle(4, 0xd89aff, 1).setDepth(995).setAlpha(0.9);
      scene.tweens.add({ targets: ring, scaleX: 6, scaleY: 3, alpha: 0, delay: k * 140, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    }
    const ghost = scene.add.container(cx + 200, from).setDepth(996).setAlpha(0.95);
    ghost.add(scene.add.rectangle(0, 0, 56, 80, 0x8a5ad0, 0.9).setStrokeStyle(3, 0xf0d8ff, 1));
    ghost.add(scene.add.text(0, 0, CARDS[id]!.name.slice(0, 2), { fontFamily: UI_FONT, fontSize: '16px', color: '#fff' }).setOrigin(0.5));
    scene.tweens.add({ targets: ghost, x: cx, y, scale: 1.3, alpha: 0, duration: 650, ease: 'Sine.easeInOut', onComplete: () => ghost.destroy() });
  }

  render();
  root.setData('echo', echoFx);
  root.setData('reveal', reveal); // 截圖／除錯用
  root.setData('burn', burnFx);
  // 截圖用：直接開局／直接結束（w：0 你贏、1 對手贏、-1 平手）
  root.setData('start', start);
  root.setData('end', (w: number) => {
    if (!g) return;
    g.over = true;
    g.winner = w;
    g.results = w === -1 ? [0, 1, -1] : [w, 1 - w, w];
    finishIfOver();
    render();
  });
  return root;
}

/** 長螢幕（第 47 輪）：出牌鍵往下挪到拇指好按的地方、說明字跟著往下一點（360×640 時都是 0） */
// （寫成函式：模組載入時 config 可能還沒初始化——循環 import）
const btnDy = (): number => Math.round(TALL * 0.45);
const infoDy = (): number => Math.round(TALL * 0.25);

function hexOf(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
