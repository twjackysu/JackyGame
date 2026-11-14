// 燼火祝福三選一（P2，D-343）：打怪累積滿了就跳出來，戰鬥暫停，選一張。
// 直式單手：三張大卡直排在畫面下半（拇指點得到）、點一下就選；剛跳出來的 0.45 秒不收點擊（戰鬥中手指還在按技能，避免誤選）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import type { EffectDef } from '../../core/battle/rt/effects';
import { t } from '../../i18n';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { ELEMENT_LOOK, drawEffectIcon } from '../fx/effectIcon';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { BLESS_CARD, blessSynergy, blessTrigger, synergyKey } from './blessCard';

const CARD_W = 640;
const CARD_H = 168;
const GAP = 22;

/** 蓋著的牌（D-383）：比三張祝福矮一點、暗紫色、一個問號——一眼看得出「這張不一樣」 */
const DARK_H = 124;
const DARK_COLOR = 0x9a5ae0;

export function openBlessPanel(scene: Phaser.Scene, offer: readonly EffectDef[], have: readonly EffectDef[], rerolls: number, onPick: (i: number) => void, onReroll: () => void, onGamble?: () => void, gear: readonly EffectDef[] = []): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const root = scene.add.container(0, 0).setDepth(1850);
  const owned = [...have, ...gear]; // 搭配提示也看獨特效果裝備
  const cards: Phaser.GameObjects.Container[] = [];
  // 遮罩不全黑：看得到後面停住的戰場（知道自己在哪、在打誰）
  root.add(scene.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x06040a, 0.78).setInteractive());
  const total = offer.length * CARD_H + (offer.length - 1) * GAP + (onGamble ? GAP + DARK_H : 0);
  const bottom = GAME_HEIGHT - 190; // 最下面留給「重抽」
  const top = bottom - total;
  const headY = top - 150;
  const title = scene.add.text(cx, headY, t('bless.title'), { fontFamily: TITLE_FONT, fontSize: '54px', color: '#ffd27a', stroke: '#2a1404', strokeThickness: 7 }).setOrigin(0.5);
  root.add(title);
  root.add(scene.add.text(cx, headY + 52, t('bless.sub'), { fontFamily: UI_FONT, fontSize: '23px', color: '#e8dcc0' }).setOrigin(0.5));
  // 已經有的祝福：一排小圖示＋名字
  if (have.length) {
    const names = have.map((d) => d.name).join('・');
    root.add(scene.add.text(cx, headY + 92, `${t('bless.have')}${names}`, { fontFamily: UI_FONT, fontSize: '19px', color: '#b8a888', wordWrap: { width: 640, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5, 0));
  }
  let done = false;
  // 用真實時間算（場景時鐘在掉幀的手機上會變慢）
  const openedAt = Date.now();
  const armed = (): boolean => Date.now() - openedAt >= 450;
  const g = scene.add.graphics();
  root.add(g);
  offer.forEach((d, i) => {
    const y = top + i * (CARD_H + GAP) + CARD_H / 2;
    const L = ELEMENT_LOOK[d.element];
    const card = scene.add.container(cx, y);
    const C = BLESS_CARD;
    const bg = scene.add.rectangle(0, 0, CARD_W, CARD_H, 0x1c140c, C.on ? 0.001 : 0.97).setInteractive({ useHandCursor: true });
    if (!C.on) bg.setStrokeStyle(4, L.color, 1);
    const glow = scene.add.rectangle(0, 0, CARD_W, CARD_H, L.color, C.on ? 0 : 0.1);
    const ig = scene.add.graphics();
    const x0 = -CARD_W / 2;
    const y0 = -CARD_H / 2;
    if (C.on) {
      // 圓角卡：深色底＋左邊一段元素色（圖示坐在上面）＋元素色框＋上緣一條細高光
      ig.fillStyle(0x1c140c, 0.97).fillRoundedRect(x0, y0, CARD_W, CARD_H, C.radius);
      ig.fillStyle(L.color, C.bandA).fillRoundedRect(x0, y0, C.band, CARD_H, { tl: C.radius, bl: C.radius, tr: 0, br: 0 });
      ig.fillStyle(L.color, C.bandA * 0.4).fillRect(x0 + C.band, y0, 26, CARD_H);
      ig.fillStyle(L.color, 0.06).fillRoundedRect(x0, y0, CARD_W, CARD_H, C.radius);
      ig.lineStyle(4, L.color, 1).strokeRoundedRect(x0, y0, CARD_W, CARD_H, C.radius);
      ig.lineStyle(2, L.light, 0.22).lineBetween(x0 + C.radius, y0 + 5, -x0 - C.radius, y0 + 5);
    }
    drawEffectIcon(ig, x0 + 92, 0, 56, d.element, false, d.glyph);
    const long = d.desc.length > 32;
    const name = scene.add.text(x0 + 176, long ? -52 : -38, d.name, { fontFamily: TITLE_FONT, fontSize: d.name.length > 7 ? '34px' : '40px', color: L.css, stroke: '#140a04', strokeThickness: 5 }).setOrigin(0, 0.5);
    const desc = scene.add.text(x0 + 176, long ? 24 : 30, d.desc, { fontFamily: UI_FONT, fontSize: long ? '20px' : '25px', color: '#f4ecd8', wordWrap: { width: CARD_W - 200, useAdvancedWrap: true }, lineSpacing: 4 }).setOrigin(0, 0.5);
    card.add([glow, bg, ig, name, desc]);
    if (C.on) {
      // 觸發方式的小標：右上角一顆小膠囊
      const chip = scene.add.text(-x0 - 16, y0 + 14, t(`bless.trig.${blessTrigger(d)}`), { fontFamily: UI_FONT, fontSize: `${C.chipFont}px`, fontStyle: '700', color: L.css }).setOrigin(1, 0).setPadding(12, 4, 12, 4);
      const cb = chip.getBounds();
      ig.fillStyle(0x0c0806, 0.85).fillRoundedRect(cb.x, cb.y, cb.width, cb.height, cb.height / 2);
      ig.lineStyle(2, L.color, 0.8).strokeRoundedRect(cb.x, cb.y, cb.width, cb.height, cb.height / 2);
      card.add(chip);
      // 搭配：和身上的祝福會互相帶動時，卡片下緣掛一條金色的籤
      const syn = blessSynergy(d, owned);
      if (syn) {
        const st = scene.add.text(-x0 - 18, -y0, `✦ ${t('bless.syn.pre')}｜${t(synergyKey(syn), { name: syn.with.name })}`, { fontFamily: UI_FONT, fontSize: `${C.synFont}px`, fontStyle: '700', color: '#ffe08a' }).setOrigin(1, 0.5).setPadding(14, 0, 14, 0);
        const w = st.width;
        const sg = scene.add.graphics();
        sg.fillStyle(0x2a1c08, 1).fillRoundedRect(-x0 - 18 - w, -y0 - C.synH / 2, w, C.synH, C.synH / 2);
        sg.lineStyle(2, 0xffd27a, 0.95).strokeRoundedRect(-x0 - 18 - w, -y0 - C.synH / 2, w, C.synH, C.synH / 2);
        card.add([sg, st]);
      }
    }
    cards.push(card);
    root.add(card);
    // 由下往上依序滑進來
    card.setAlpha(0).setScale(0.92);
    scene.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 220, delay: 80 + i * 70, ease: 'Back.Out' });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (done || !armed()) return;
      done = true;
      SFX.uiTap(); // 選定的音效在場景收到 blessPick 時播（SFX.blessPick）
      // 沒選的兩張（和蓋著的牌）淡下去：看得出選了哪一張
      if (BLESS_CARD.on) for (const c of cards) if (c !== card) scene.tweens.add({ targets: c, alpha: BLESS_CARD.fadeOthers, duration: 110 });
      scene.tweens.add({ targets: card, scale: 1.06, duration: 140, yoyo: true, onComplete: () => onPick(i) });
    });
  });
  if (onGamble) {
    const y = top + offer.length * (CARD_H + GAP) + DARK_H / 2;
    const card = scene.add.container(cx, y);
    const round = BLESS_CARD.on;
    const bg = scene.add.rectangle(0, 0, CARD_W, DARK_H, 0x150c22, round ? 0.001 : 0.98).setInteractive({ useHandCursor: true });
    if (!round) bg.setStrokeStyle(4, DARK_COLOR, 1);
    // 牌背：斜格紋＋中間一個問號
    const pg = scene.add.graphics();
    if (round) {
      pg.fillStyle(0x150c22, 0.98).fillRoundedRect(-CARD_W / 2, -DARK_H / 2, CARD_W, DARK_H, BLESS_CARD.radius);
      pg.lineStyle(4, DARK_COLOR, 1).strokeRoundedRect(-CARD_W / 2, -DARK_H / 2, CARD_W, DARK_H, BLESS_CARD.radius);
    }
    pg.lineStyle(2, DARK_COLOR, 0.16);
    for (let x = -CARD_W / 2 - DARK_H; x < CARD_W / 2; x += 26) {
      const x0 = Math.max(-CARD_W / 2 + 8, x + 8);
      const x1 = Math.min(CARD_W / 2 - 8, x + DARK_H - 8);
      if (x1 > x0) pg.lineBetween(x0, DARK_H / 2 - (x0 - x), x1, DARK_H / 2 - (x1 - x));
    }
    const ix = -CARD_W / 2 + 92;
    pg.fillStyle(0x0c0614, 1).fillCircle(ix, 0, 46);
    pg.lineStyle(4, DARK_COLOR, 1).strokeCircle(ix, 0, 46);
    pg.lineStyle(2, 0xffd27a, 0.7).strokeCircle(ix, 0, 38);
    const q = scene.add.text(ix, 0, '？', { fontFamily: TITLE_FONT, fontSize: '54px', color: '#ffd27a', stroke: '#1a0a2a', strokeThickness: 6 }).setOrigin(0.5);
    const name = scene.add.text(-CARD_W / 2 + 176, -30, t('bless.dark.name'), { fontFamily: TITLE_FONT, fontSize: '36px', color: '#d8b8ff', stroke: '#140a04', strokeThickness: 5 }).setOrigin(0, 0.5);
    const desc = scene.add.text(-CARD_W / 2 + 176, 22, t('bless.dark.desc'), { fontFamily: UI_FONT, fontSize: '22px', color: '#e8dcf4', wordWrap: { width: CARD_W - 200, useAdvancedWrap: true }, lineSpacing: 4 }).setOrigin(0, 0.5);
    card.add([bg, pg, q, name, desc]);
    cards.push(card);
    root.add(card);
    card.setAlpha(0).setScale(0.92);
    scene.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 220, delay: 80 + offer.length * 70, ease: 'Back.Out' });
    scene.tweens.add({ targets: q, scale: 1.14, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (done || !armed()) return;
      done = true;
      SFX.uiTap();
      // 翻牌：橫向壓扁再送出（結果由 core 決定，場景收到 blessGamble 才演）
      scene.tweens.add({ targets: card, scaleX: 0.04, duration: 160, ease: 'Quad.In', onComplete: () => onGamble() });
    });
  }
  const canReroll = rerolls > 0;
  const rr = scene.add.text(cx, GAME_HEIGHT - 110, canReroll ? t('bless.reroll', { n: rerolls }) : t('bless.noReroll'), { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: canReroll ? '#ffffff' : '#7a705c', backgroundColor: canReroll ? '#3a2a14' : '#1a140c' }).setOrigin(0.5).setPadding(26, 12, 26, 12);
  if (canReroll) {
    rr.setInteractive({ useHandCursor: true });
    rr.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (done || !armed()) return;
      done = true;
      SFX.uiTap();
      onReroll();
    });
  }
  root.add(rr);
  title.setScale(1.3).setAlpha(0);
  scene.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 240, ease: 'Back.Out' });
  return root;
}

/**
 * 翻開蓋著的牌（D-383）：結果已經由 core 決定（blessGamble 事件），這裡只是把牌面翻過來給玩家看一秒——
 * 標題（雙重祝福！／翻開了／帶著一道燼痕）＋拿到的祝福（圖示、名字、說明）＋燼痕那一行。點一下可以提早關；關掉後 onDone。
 */
export function openGambleReveal(scene: Phaser.Scene, result: 'double' | 'single' | 'cursed', got: readonly EffectDef[], cursePct: number, onDone: () => void): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const root = scene.add.container(0, 0).setDepth(1850);
  const shade = scene.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x06040a, 0.6).setInteractive();
  root.add(shade);
  const bad = result === 'cursed';
  const edge = bad ? 0xff5a4a : result === 'double' ? 0xffd27a : DARK_COLOR;
  const ROW = 112;
  const H = 104 + got.length * ROW + (bad ? 64 : 0) + 20;
  const card = scene.add.container(cx, Math.round(GAME_HEIGHT * 0.44));
  const g = scene.add.graphics();
  g.fillStyle(0x150c22, 0.98).fillRoundedRect(-CARD_W / 2, -H / 2, CARD_W, H, 16);
  g.lineStyle(5, edge, 1).strokeRoundedRect(-CARD_W / 2, -H / 2, CARD_W, H, 16);
  g.lineStyle(2, edge, 0.45).strokeRoundedRect(-CARD_W / 2 + 10, -H / 2 + 10, CARD_W - 20, H - 20, 10);
  card.add(g);
  card.add(scene.add.text(0, -H / 2 + 56, t(`bless.dark.${result}`), { fontFamily: TITLE_FONT, fontSize: result === 'double' ? '52px' : '40px', color: bad ? '#ff9a8a' : result === 'double' ? '#ffe08a' : '#d8b8ff', stroke: '#140a04', strokeThickness: 7 }).setOrigin(0.5));
  got.forEach((d, i) => {
    const y = -H / 2 + 104 + i * ROW + ROW / 2;
    const L = ELEMENT_LOOK[d.element];
    drawEffectIcon(g, -CARD_W / 2 + 84, y, 40, d.element, false, d.glyph);
    card.add(scene.add.text(-CARD_W / 2 + 150, y - 24, d.name, { fontFamily: TITLE_FONT, fontSize: '36px', color: L.css, stroke: '#140a04', strokeThickness: 5 }).setOrigin(0, 0.5));
    card.add(scene.add.text(-CARD_W / 2 + 150, y + 24, d.desc, { fontFamily: UI_FONT, fontSize: d.desc.length > 26 ? '18px' : '22px', color: '#f4ecd8', wordWrap: { width: CARD_W - 180, useAdvancedWrap: true } }).setOrigin(0, 0.5));
  });
  if (bad) card.add(scene.add.text(0, H / 2 - 52, t('bless.curse', { pct: cursePct }), { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#ff8a8a', stroke: '#1a0404', strokeThickness: 4 }).setOrigin(0.5));
  root.add(card);
  // 牌翻過來：橫向從一條線展開
  card.setScale(0.04, 1);
  scene.tweens.add({ targets: card, scaleX: 1, duration: 180, ease: 'Back.Out' });
  if (result === 'double') scene.tweens.add({ targets: card, scaleY: 1.05, duration: 160, delay: 180, yoyo: true });
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    scene.tweens.add({ targets: root, alpha: 0, duration: 140, onComplete: () => onDone() });
  };
  const openedAt = Date.now();
  shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    if (Date.now() - openedAt >= 350) finish();
  });
  scene.time.delayedCall(result === 'single' ? 1300 : 1700, finish);
  return root;
}

/**
 * 身上的祝福清單（第 162 輪，P2-c ⑤）：點右上角的火苗／圖示打開——HUD 只有圖示沒有名字，選過幾個之後記不得各是什麼。
 * 每個一列（圖示＋名字＋說明），最下面寫離下一次選擇還差幾隻、怎樣會消散；點任何地方關掉。戰鬥暫停（和其他面板一樣）。
 */
export function openBlessList(scene: Phaser.Scene, have: readonly EffectDef[], meter: number, need: number, full: boolean, onClose: () => void, gearFx: readonly EffectDef[] = [], curse?: { n: number; pct: number }): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const root = scene.add.container(0, 0).setDepth(1850);
  const shade = scene.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x06040a, 0.78).setInteractive();
  root.add(shade);
  const ROW = have.length >= 7 ? 94 : 104; // 帶滿 8 個時在 16:9 的畫面上也放得下（最下面兩行說明不壓到「關閉」）
  const total = Math.max(1, have.length) * ROW;
  const top = Math.max(250, Math.round(GAME_HEIGHT / 2 - total / 2 - 20));
  root.add(scene.add.text(cx, top - 96, t('bless.listTitle', { n: have.length }), { fontFamily: TITLE_FONT, fontSize: '46px', color: '#ffd27a', stroke: '#2a1404', strokeThickness: 7 }).setOrigin(0.5));
  const g = scene.add.graphics();
  root.add(g);
  if (!have.length) root.add(scene.add.text(cx, top + ROW / 2, t('bless.listEmpty'), { fontFamily: UI_FONT, fontSize: '25px', color: '#e8dcc0', align: 'center', wordWrap: { width: 600, useAdvancedWrap: true } }).setOrigin(0.5));
  have.forEach((d, i) => {
    const y = top + i * ROW + ROW / 2;
    const L = ELEMENT_LOOK[d.element];
    g.fillStyle(0x1c140c, 0.97).fillRoundedRect(cx - 320, y - ROW / 2 + 5, 640, ROW - 10, 12);
    g.lineStyle(3, L.color, 0.9).strokeRoundedRect(cx - 320, y - ROW / 2 + 5, 640, ROW - 10, 12);
    drawEffectIcon(g, cx - 262, y, 34, d.element, false, d.glyph);
    root.add(scene.add.text(cx - 206, y - 22, d.name, { fontFamily: TITLE_FONT, fontSize: '30px', color: L.css, stroke: '#140a04', strokeThickness: 4 }).setOrigin(0, 0.5));
    if (BLESS_CARD.on) {
      // 名字那一行的右邊：觸發方式的小標；和身上另一個祝福（或獨特效果裝備）會互相帶動時，前面寫出是哪一個
      const chip = scene.add.text(cx + 306, y - 24, t(`bless.trig.${blessTrigger(d)}`), { fontFamily: UI_FONT, fontSize: '18px', fontStyle: '700', color: L.css }).setOrigin(1, 0.5).setPadding(10, 3, 10, 3);
      const cb = chip.getBounds();
      g.fillStyle(0x0c0806, 0.85).fillRoundedRect(cb.x, cb.y, cb.width, cb.height, cb.height / 2);
      g.lineStyle(2, L.color, 0.8).strokeRoundedRect(cb.x, cb.y, cb.width, cb.height, cb.height / 2);
      root.add(chip);
      const syn = blessSynergy(d, [...have, ...gearFx]);
      if (syn) root.add(scene.add.text(cb.x - 12, y - 24, `✦ ${t('bless.syn.short', { name: syn.with.name })}`, { fontFamily: UI_FONT, fontSize: '19px', fontStyle: '700', color: '#ffe08a' }).setOrigin(1, 0.5));
    }
    root.add(scene.add.text(cx - 206, y + 20, d.desc, { fontFamily: UI_FONT, fontSize: d.desc.length > 26 ? '18px' : '21px', color: '#f4ecd8', wordWrap: { width: 500, useAdvancedWrap: true } }).setOrigin(0, 0.5));
  });
  const foot = `${full ? t('bless.listFull') : t('bless.listNext', { n: Math.max(0, need - meter) })}\n${t('bless.listRule')}${gearFx.length ? `\n${t('unique.listLine', { names: gearFx.map((d) => d.name).join('、') })}` : ''}`;
  if (curse?.n) root.add(scene.add.text(cx, top - 44, t('bless.curseLine', curse), { fontFamily: UI_FONT, fontSize: '21px', fontStyle: '700', color: '#ff8a8a', stroke: '#1a0404', strokeThickness: 4 }).setOrigin(0.5));
  root.add(scene.add.text(cx, top + total + 26, foot, { fontFamily: UI_FONT, fontSize: '21px', color: '#b8a888', align: 'center', lineSpacing: 8, wordWrap: { width: 640, useAdvancedWrap: true } }).setOrigin(0.5, 0));
  root.add(scene.add.text(cx, GAME_HEIGHT - 120, t('bless.listClose'), { fontFamily: UI_FONT, fontSize: '22px', color: '#8a8270' }).setOrigin(0.5));
  const openedAt = Date.now();
  shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    if (Date.now() - openedAt < 250) return;
    SFX.uiTap();
    onClose();
  });
  return root;
}
