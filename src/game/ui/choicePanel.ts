// 討伐後的抉擇面板（第 35 輪，D-157）：主線 Boss 第一次倒下後跳出——標題、一段描述、兩張選項卡（取／還）。
// 點一張卡＝選取（金框），再按「就這麼做」才決定（手機上避免誤觸）。呼叫端把回傳的容器當成 menu，戰鬥會暫停。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import type { BossChoice, ChoiceOption, ChoicePick } from '../choices';

const COL: Record<ChoicePick, { line: number; css: string; tag: string }> = {
  take: { line: 0xffb35a, css: '#ffd27a', tag: '取' },
  spare: { line: 0x7dd8b0, css: '#a8f0c8', tag: '還' },
};

/** 路上的相遇（D-159）也用這個面板：標頭換成「相遇」、還的那張卡字樣換成「助」 */
export interface ChoiceLook {
  kicker?: string;
  spareTag?: string;
}

export function openChoice(scene: Phaser.Scene, ch: Pick<BossChoice, 'title' | 'prompt'> & Record<ChoicePick, ChoiceOption>, onPick: (p: ChoicePick) => void, look: ChoiceLook = {}): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const root = scene.add.container(0, 0).setDepth(1900).setAlpha(0);
  const veil = scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x05040a, 0.94).setInteractive();
  // 第 42 輪：0.88 時後面的開場大字、地區名還透得出來，和選項卡片混在一起
  root.add(veil);
  scene.tweens.add({ targets: root, alpha: 1, duration: 500 });
  root.add(scene.add.text(cx, cy - 500, look.kicker ?? '抉擇', { fontFamily: UI_FONT, fontSize: '22px', color: '#a89878' }).setOrigin(0.5));
  root.add(scene.add.text(cx, cy - 450, ch.title, { fontFamily: TITLE_FONT, fontSize: '48px', color: '#ffe6a8', stroke: '#2a1404', strokeThickness: 6 }).setOrigin(0.5));
  root.add(scene.add.text(cx, cy - 380, ch.prompt, { fontFamily: TITLE_FONT, fontSize: '26px', color: '#e8e0d0', align: 'center', lineSpacing: 12 }).setOrigin(0.5, 0));
  let sel: ChoicePick | null = null;
  let done = false;
  const paints: Record<ChoicePick, (hi: boolean) => void> = { take: () => {}, spare: () => {} };
  const go = scene.add.text(cx, cy + 470, '就這麼做', { fontFamily: TITLE_FONT, fontSize: '34px', color: '#1a1006', backgroundColor: '#ffd27a' }).setOrigin(0.5).setPadding(36, 12, 36, 12).setAlpha(0.35);
  (['take', 'spare'] as const).forEach((k, i) => {
    const opt = ch[k];
    const y = cy + 40 + i * 200;
    const c = COL[k];
    const card = scene.add.container(cx, y);
    const bg = scene.add.graphics();
    paints[k] = (hi: boolean): void => {
      bg.clear();
      bg.fillStyle(hi ? 0x241a10 : 0x140f0a, 0.97).fillRoundedRect(-300, -80, 600, 160, 18);
      bg.lineStyle(hi ? 5 : 2, c.line, hi ? 1 : 0.55).strokeRoundedRect(-300, -80, 600, 160, 18);
    };
    paints[k](false);
    const tag = scene.add.text(-250, 0, k === 'spare' && look.spareTag ? look.spareTag : c.tag, { fontFamily: TITLE_FONT, fontSize: '54px', color: c.css }).setOrigin(0.5);
    const lab = scene.add.text(-190, -28, opt.label, { fontFamily: TITLE_FONT, fontSize: '32px', color: '#fff4dc' }).setOrigin(0, 0.5);
    const desc = scene.add.text(-190, 26, opt.desc, { fontFamily: UI_FONT, fontSize: '20px', color: c.css, wordWrap: { width: 470, useAdvancedWrap: true } }).setOrigin(0, 0.5);
    const hit = scene.add.rectangle(0, 0, 600, 160, 0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      if (done) return;
      sel = k;
      paints.take(k === 'take');
      paints.spare(k === 'spare');
      go.setAlpha(1);
      SFX.blip();
    });
    card.add([bg, tag, lab, desc, hit]);
    root.add(card);
  });
  go.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
    if (done || !sel) return;
    done = true;
    SFX.perfect();
    const pick = sel;
    scene.tweens.add({ targets: root, alpha: 0, duration: 400, onComplete: () => {
      root.destroy();
      onPick(pick);
    } });
  });
  root.add(go);
  root.add(scene.add.text(cx, cy + 540, '抉擇只有一次', { fontFamily: UI_FONT, fontSize: '18px', color: '#8a8070' }).setOrigin(0.5));
  return root;
}
