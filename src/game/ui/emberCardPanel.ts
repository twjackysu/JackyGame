// 營火燼牌（D-127）：在營火旁和旅商莫托打的卡牌小遊戲。規則在 core/cards/emberCards.ts。
// 全螢幕面板：上半是莫托的後排／前排、中間天候、下半是你的前排／後排與手牌。點一張牌看說明、再點一次（或按「出牌」）打出。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { aiMove, applyMove, CARD_STAKE, CARDS, cardPower, deckWith, legalMoves, MERCHANT_DECK, newCardGame, nextReward, rowScore, totalScore, type CardGame, type Row } from '../../core/cards/emberCards';
import { GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, bigText } from '../fx/feel';
import { drawMerchant } from '../fx/merchant';

export interface CardCtx {
  coin: () => number;
  /** 付錢（正數）或收錢（負數） */
  pay: (n: number) => void;
}

const ROW_NAME = ['前排', '後排'];
const KEY = 'jg_cards';
interface Stats {
  played: number;
  won: number;
  /** 下注贏來的莫托的牌 */
  cards: string[];
}
function stats(): Stats {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Stats>;
    return { played: v.played ?? 0, won: v.won ?? 0, cards: Array.isArray(v.cards) ? v.cards.filter((x): x is string => typeof x === 'string' && !!CARDS[x]) : [] };
  } catch {
    return { played: 0, won: 0, cards: [] };
  }
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
  if (c.row === undefined) return { fill: 0x2a1a3a, edge: 0xc89aff };
  return c.row === 0 ? { fill: 0x3a1c14, edge: 0xe0805a } : { fill: 0x142438, edge: 0x6ab0ff };
}

export function openEmberCardPanel(scene: Phaser.Scene, ctx: CardCtx, onClose: () => void): Phaser.GameObjects.Container {
  const root = scene.add.container(GAME_WIDTH / 2, 640).setDepth(960);
  let g: CardGame | null = null;
  let staked = 0;
  let sel = -1;
  let busy = false;
  let lastLog = '';
  /** 這場下注贏到的牌 */
  let prizeCard: string | undefined;
  /** 剛出的那張牌（畫面上彈一下）：[side, row, 數量] */
  let fresh: [number, Row, number] | null = null;

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

  const portrait = scene.add.graphics();
  const drawPortrait = (): void => {
    portrait.clear();
    drawMerchant(portrait, -282, -560, 96, scene.time.now);
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
    items.push(scene.add.rectangle(0, y, 680, 104, weather ? (row === 0 ? 0x1a2a3a : 0x2a2a30) : 0x14100a, 0.9).setStrokeStyle(2, side === 0 ? 0x8a6a3a : 0x5a4a6a, 0.8));
    items.push(scene.add.text(-330, y - 36, `${side === 0 ? '你的' : '莫托'}${ROW_NAME[row]}${weather ? (row === 0 ? '・霜寒' : '・濃霧') : ''}`, { fontFamily: UI_FONT, fontSize: '15px', color: weather ? '#9fd8ff' : '#a89880' }).setOrigin(0, 0.5));
    if (S.horn[row]) items.push(scene.add.text(-330, y + 10, '戰號×2', { fontFamily: UI_FONT, fontSize: '20px', color: '#ffd27a' }).setOrigin(0, 0.5));
    const n = S.rows[row].length;
    const gap = Math.min(64, 480 / Math.max(1, n));
    S.rows[row].forEach((id, i) => {
      const x = -230 + 30 + i * gap;
      const col = cardColor(id);
      const pop = fresh && fresh[0] === side && fresh[1] === row && i === n - 1 && fresh[2] === n;
      const face = scene.add.rectangle(x, y + 6, 56, 80, col.fill, 1).setStrokeStyle(pop ? 4 : 2, pop ? 0xffffff : col.edge, 1);
      items.push(face);
      if (pop) scene.tweens.add({ targets: face, scale: { from: 1.6, to: 1 }, duration: 260, ease: 'Back.Out' });
      const p = cardPower(game, side, row, id);
      const base = CARDS[id]!.power;
      items.push(scene.add.text(x, y - 10, `${p}`, { fontFamily: TITLE_FONT, fontSize: '28px', color: p > base ? '#7dffb0' : p < base ? '#ff8a7a' : '#ffffff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5));
      items.push(scene.add.text(x, y + 30, CARDS[id]!.name.slice(0, 2), { fontFamily: UI_FONT, fontSize: '14px', color: '#e8dcc8' }).setOrigin(0.5));
    });
    items.push(scene.add.circle(300, y + 6, 30, 0x0a0806, 1).setStrokeStyle(3, 0xffd27a, 0.9));
    items.push(scene.add.text(300, y + 6, `${rowScore(game, side, row)}`, { fontFamily: TITLE_FONT, fontSize: '28px', color: '#ffe08a' }).setOrigin(0.5));
  };

  const gems = (wins: number): string => '◆'.repeat(Math.min(2, wins)) + '◇'.repeat(Math.max(0, 2 - wins));

  function render(): void {
    root.remove(portrait);
    root.removeAll(true);
    const items: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, GAME_WIDTH, 1280, 0x080604, 1).setInteractive()];
    items.push(portrait);
    items.push(scene.add.text(30, -600, '營火燼牌', { fontFamily: TITLE_FONT, fontSize: '42px', color: '#ffd27a' }).setOrigin(0.5));
    if (!g) {
      lobby(items);
      root.add(items);
      return;
    }
    const game = g;
    const op = game.sides[1];
    const me = game.sides[0];
    items.push(scene.add.text(30, -552, `旅商莫托　手牌 ${op.hand.length}　${gems(op.wins)}　${op.passed ? '【已放棄】' : ''}`, { fontFamily: UI_FONT, fontSize: '21px', fontStyle: '700', color: op.passed ? '#a89880' : '#e8c8a0' }).setOrigin(0.5));
    items.push(scene.add.text(30, -520, `第 ${game.round} 局　莫托 ${totalScore(game, 1)}　你 ${totalScore(game, 0)}`, { fontFamily: UI_FONT, fontSize: '20px', color: '#ffe08a' }).setOrigin(0.5));
    drawRow(items, game, 1, 1, -440);
    drawRow(items, game, 1, 0, -330);
    items.push(scene.add.text(0, -265, lastLog || (game.turn === 0 ? '輪到你出牌' : '莫托思考中…'), { fontFamily: UI_FONT, fontSize: '19px', color: '#c8d0f0' }).setOrigin(0.5));
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
      const tag = c.ability === 'bond' ? '同袍' : c.ability === 'scout' ? '斥候' : c.ability === 'hero' ? '傳奇' : '';
      if (tag) items.push(scene.add.text(x, y + 6, tag, { fontFamily: UI_FONT, fontSize: '15px', color: '#ffd27a' }).setOrigin(0.5));
      items.push(scene.add.text(x, y + 44, c.name, { fontFamily: UI_FONT, fontSize: '17px', color: '#f0e6d8', align: 'center', wordWrap: { width: 92, useAdvancedWrap: true } }).setOrigin(0.5));
    });
    const sc = sel >= 0 ? me.hand[sel] : undefined;
    const info = sc ? `${CARDS[sc]!.name}${CARDS[sc]!.power ? `（${CARDS[sc]!.power} 點・${CARDS[sc]!.row === 0 ? '前排' : '後排'}）` : ''}${CARDS[sc]!.desc ? `：${CARDS[sc]!.desc}` : ''}` : myTurn ? '點一張牌看說明，再點一次打出' : '';
    items.push(scene.add.text(0, 420, info, { fontFamily: UI_FONT, fontSize: '19px', color: '#e8dcc8', align: 'center', wordWrap: { width: 640, useAdvancedWrap: true } }).setOrigin(0.5));
    const canPlay = myTurn && sel >= 0 && legalMoves(game, 0).some((m) => m.type === 'play' && m.card === sel);
    items.push(btn(-200, 500, '出牌', () => play(sel), true, 24, !canPlay));
    items.push(btn(20, 500, '放棄這一局', () => pass(), false, 22, !myTurn));
    items.push(btn(230, 500, staked ? '認輸離開' : '離開', () => leave(), false, 22));
    root.add(items);
  }

  function lobby(items: Phaser.GameObjects.GameObject[]): void {
    const st = stats();
    items.push(scene.add.text(30, -545, '旅商莫托：「坐下來歇歇腿，玩一把？」', { fontFamily: UI_FONT, fontSize: '20px', color: '#e8c8a0' }).setOrigin(0.5));
    const rules = [
      '三局兩勝。雙方各抽 10 張牌，整場不補牌。',
      '輪流出一張牌到前排或後排，總點數高的贏這一局。',
      '覺得夠了就「放棄這一局」：對手還能繼續出，',
      '但你省下的牌留到下一局——什麼時候收手是關鍵。',
      '',
      '同袍：同排的同名牌越多越強',
      '斥候：送到對手那邊，換你抽 2 張',
      '戰號：一排點數 ×2　傳奇：不受天候與戰號影響',
      '霜寒／濃霧：雙方前排／後排都變 1 點　晴空：解除',
    ];
    items.push(scene.add.text(0, -270, rules.join('\n'), { fontFamily: UI_FONT, fontSize: '21px', color: '#e8dcc8', align: 'center', lineSpacing: 8 }).setOrigin(0.5));
    const nx = nextReward(st.cards);
    items.push(scene.add.text(0, -50, `你的牌組 ${deckWith(st.cards).length + 1} 張${st.cards.length ? `（贏來的：${st.cards.map((id) => CARDS[id]!.name).join('、')}）` : ''}\n${nx ? `下注贏了，莫托會把「${CARDS[nx]!.name}」給你` : '莫托的牌你全都贏到了！'}`, { fontFamily: UI_FONT, fontSize: '19px', color: '#c8d0f0', align: 'center', lineSpacing: 6, wordWrap: { width: 640, useAdvancedWrap: true } }).setOrigin(0.5));
    items.push(scene.add.text(0, 10, `戰績 ${st.won} 勝 / ${st.played} 場　手上金幣 ${ctx.coin()}`, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#ffe08a' }).setOrigin(0.5));
    const can = ctx.coin() >= CARD_STAKE;
    items.push(btn(0, 90, can ? `下注 ${CARD_STAKE} 金開局（贏了拿 ${CARD_STAKE * 2}）` : `金幣不夠下注（${CARD_STAKE}）`, () => start(true), true, 26, !can));
    items.push(btn(0, 180, '練習一局（不賭）', () => start(false), false, 24));
    items.push(btn(0, 500, '回行商', () => onClose(), false, 26));
  }

  function result(items: Phaser.GameObjects.GameObject[], game: CardGame): void {
    const w = game.winner;
    const msg = w === 0 ? '你贏了！' : w === 1 ? '莫托贏了' : '平手';
    const line = prizeCard ? '「這張牌歸你了……好好用它。」' : w === 0 ? '「哈，下次我可不會手下留情。」' : w === 1 ? '「承讓承讓，金幣我就收下了。」' : '「勢均力敵，再來？」';
    const prize = (staked ? (w === 0 ? `＋${staked * 2} 金` : w === -1 ? `退回 ${staked} 金` : `輸掉 ${staked} 金`) : '練習局') + (prizeCard ? `　＋新牌「${CARDS[prizeCard]!.name}」` : '');
    items.push(scene.add.text(0, 120, msg, { fontFamily: TITLE_FONT, fontSize: '64px', color: w === 0 ? '#ffd27a' : w === 1 ? '#ff9a8a' : '#c8d0f0', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5));
    items.push(scene.add.text(0, 200, `${game.results.map((r, i) => `第 ${i + 1} 局 ${r === 0 ? '勝' : r === 1 ? '負' : '平'}`).join('　')}\n${prize}\n莫托：${line}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#e8dcc8', align: 'center', lineSpacing: 8 }).setOrigin(0.5, 0));
    items.push(btn(-120, 470, '再來一局', () => {
      g = null;
      render();
    }, true, 26));
    items.push(btn(120, 470, '回行商', () => onClose(), false, 26));
  }

  function start(bet: boolean): void {
    if (bet) {
      if (ctx.coin() < CARD_STAKE) return;
      ctx.pay(CARD_STAKE);
      staked = CARD_STAKE;
    } else staked = 0;
    g = newCardGame((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, [deckWith(stats().cards), MERCHANT_DECK]);
    prizeCard = undefined;
    sel = -1;
    lastLog = g.turn === 0 ? '擲硬幣：你先手' : '擲硬幣：莫托先手';
    fresh = null;
    render();
    if (g.turn === 1) aiTurn(1000);
  }

  function finishIfOver(): void {
    if (!g?.over) return;
    const st = stats();
    st.played++;
    if (g.winner === 0) st.won++;
    saveStats(st);
    if (staked && g.winner === 0) {
      prizeCard = nextReward(st.cards);
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
      if (pc.ability === 'scout') lastLog = lastLog.startsWith('你') ? `你把「${pc.name}」送到莫托那邊，抽了 2 張` : `莫托把「${pc.name}」送到你這邊，他抽了 2 張`;
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
      const t = bigText(scene, GAME_WIDTH / 2, 560, r === 0 ? `第 ${rounds + 1} 局　你贏了！` : r === 1 ? `第 ${rounds + 1} 局　莫托贏了` : `第 ${rounds + 1} 局　平手`, r === 0 ? '#ffd27a' : r === 1 ? '#ff9a8a' : '#c8d0f0', 46, 1100);
      t.setDepth(990);
      if (r === 0) SFX.itemGet();
      wait = 1700;
    }
    finishIfOver();
    render();
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
      applyMove(g, 1, aiMove(g, 1));
      after(before, rounds);
    });
  }

  function leave(): void {
    if (g && !g.over && staked) {
      // 認輸：賭注給莫托
      const st = stats();
      st.played++;
      saveStats(st);
    }
    onClose();
  }

  render();
  return root;
}

function hexOf(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
