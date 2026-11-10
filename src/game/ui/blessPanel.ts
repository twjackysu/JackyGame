// 燼火祝福三選一（P2，D-343）：打怪累積滿了就跳出來，戰鬥暫停，選一張。
// 直式單手：三張大卡直排在畫面下半（拇指點得到）、點一下就選；剛跳出來的 0.45 秒不收點擊（戰鬥中手指還在按技能，避免誤選）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import type { EffectDef } from '../../core/battle/rt/effects';
import { t } from '../../i18n';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { ELEMENT_LOOK, drawEffectIcon } from '../fx/effectIcon';
import { TITLE_FONT, UI_FONT } from '../fx/feel';

const CARD_W = 640;
const CARD_H = 168;
const GAP = 22;

export function openBlessPanel(scene: Phaser.Scene, offer: readonly EffectDef[], have: readonly EffectDef[], rerolls: number, onPick: (i: number) => void, onReroll: () => void): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const root = scene.add.container(0, 0).setDepth(1850);
  // 遮罩不全黑：看得到後面停住的戰場（知道自己在哪、在打誰）
  root.add(scene.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x06040a, 0.78).setInteractive());
  const total = offer.length * CARD_H + (offer.length - 1) * GAP;
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
    const bg = scene.add.rectangle(0, 0, CARD_W, CARD_H, 0x1c140c, 0.97).setStrokeStyle(4, L.color, 1).setInteractive({ useHandCursor: true });
    const glow = scene.add.rectangle(0, 0, CARD_W, CARD_H, L.color, 0.1);
    const ig = scene.add.graphics();
    drawEffectIcon(ig, -CARD_W / 2 + 92, 0, 56, d.element, false, d.glyph);
    const name = scene.add.text(-CARD_W / 2 + 176, d.desc.length > 32 ? -52 : -38, d.name, { fontFamily: TITLE_FONT, fontSize: d.name.length > 7 ? '34px' : '40px', color: L.css, stroke: '#140a04', strokeThickness: 5 }).setOrigin(0, 0.5);
    const long = d.desc.length > 32;
    const desc = scene.add.text(-CARD_W / 2 + 176, long ? 24 : 30, d.desc, { fontFamily: UI_FONT, fontSize: long ? '20px' : '25px', color: '#f4ecd8', wordWrap: { width: CARD_W - 200, useAdvancedWrap: true }, lineSpacing: 4 }).setOrigin(0, 0.5);
    card.add([glow, bg, ig, name, desc]);
    root.add(card);
    // 由下往上依序滑進來
    card.setAlpha(0).setScale(0.92);
    scene.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 220, delay: 80 + i * 70, ease: 'Back.Out' });
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (done || !armed()) return;
      done = true;
      SFX.confirm();
      scene.tweens.add({ targets: card, scale: 1.06, duration: 140, yoyo: true, onComplete: () => onPick(i) });
    });
  });
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
