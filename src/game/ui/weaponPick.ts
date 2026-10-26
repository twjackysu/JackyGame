// 第一次冒險的武器選擇（D-150，第 33 輪）：序章播完、開場說明之前，讓新玩家在長劍／長弓之間挑一把。
// 以前長弓藏在標題「設定」旁的小按鈕，新玩家多半不知道有第二種打法。之後隨時可以在 ☰ 或標題切換。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { ARCHER, BOW_SKILLS, SKILLS, SWORDSMAN } from '../../core/battle/rt/data';
import { UNIT } from '../../core/battle/rt/types';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT } from '../fx/feel';
import { WEAPON_NAME, type WeaponId } from '../weapon';

const STORE = 'jg_weapon';

/** 這台裝置選過武器沒（舊玩家在標題切換過也算） */
export function weaponChosen(): boolean {
  try {
    return localStorage.getItem(STORE) !== null;
  } catch {
    return true; // 不能存就不要每次都問
  }
}

const INFO: Record<WeaponId, { tag: string; play: string; col: number; css: string }> = {
  sword: { tag: '近身連斬・格擋反擊', play: '貼上去砍，旋風斬清狼群，\n看準預告按格擋反擊。\n血厚、上手最快。', col: 0xffb35a, css: '#ffd27a' },
  bow: { tag: '遠距穿透・後躍拉開', play: '站在 5 格外射，\n狼貼過來就後躍射擊，\n一箭穿過一整排。', col: 0x8ad8ff, css: '#a8e4ff' },
};

export function openWeaponPick(scene: Phaser.Scene, onPick: (w: WeaponId) => void): Phaser.GameObjects.Container {
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const root = scene.add.container(0, 0).setDepth(1900);
  const veil = scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x06050c, 0.9).setInteractive();
  root.add(veil);
  root.add(scene.add.text(cx, cy - 470, '選擇你的武器', { fontFamily: TITLE_FONT, fontSize: '52px', color: '#ffe6a8', stroke: '#2a1404', strokeThickness: 6 }).setOrigin(0.5));
  root.add(scene.add.text(cx, cy - 410, '前世玩到全成就的兩種打法——之後在 ☰ 暫停選單隨時可以換', { fontFamily: UI_FONT, fontSize: '20px', color: '#c8bca0' }).setOrigin(0.5));
  let done = false;
  (['sword', 'bow'] as const).forEach((w, i) => {
    const x = cx + (i === 0 ? -170 : 170);
    const y = cy + 20;
    const inf = INFO[w];
    const def = w === 'bow' ? ARCHER : SWORDSMAN;
    const card = scene.add.container(x, y);
    const bg = scene.add.graphics();
    const paint = (hi: boolean): void => {
      bg.clear();
      bg.fillStyle(0x140f0a, 0.96).fillRoundedRect(-155, -340, 310, 680, 18);
      bg.lineStyle(hi ? 5 : 3, inf.col, hi ? 1 : 0.6).strokeRoundedRect(-155, -340, 310, 680, 18);
    };
    paint(false);
    card.add(bg);
    // 武器圖示（程式畫的）
    const ic = scene.add.graphics();
    ic.fillStyle(inf.col, 0.14).fillCircle(0, -230, 86);
    if (w === 'sword') {
      ic.fillStyle(0xe8eef8, 1).fillTriangle(0, -308, -10, -284, 10, -284).fillRect(-10, -284, 20, 90);
      ic.fillStyle(0xffffff, 0.6).fillRect(-2, -294, 4, 98);
      ic.fillStyle(0xd8a040, 1).fillRoundedRect(-40, -196, 80, 13, 5).fillRect(-6, -183, 12, 30);
      ic.fillStyle(0xffd27a, 1).fillCircle(0, -150, 8);
    } else {
      ic.lineStyle(9, 0x5a3a1a, 1).beginPath().arc(30, -230, 84, Math.PI - 1.05, Math.PI + 1.05, false).strokePath();
      ic.lineStyle(4, 0xd8a050, 1).beginPath().arc(30, -230, 87, Math.PI - 0.9, Math.PI + 0.9, false).strokePath();
      const tx = 30 + Math.cos(Math.PI - 1.05) * 84;
      const ty = Math.sin(Math.PI - 1.05) * 84;
      ic.lineStyle(2, 0xf0f0e0, 1).lineBetween(tx, -230 - ty, tx + 26, -230).lineBetween(tx + 26, -230, tx, -230 + ty);
      ic.lineStyle(4, 0x8a6a40, 1).lineBetween(tx + 26, -230, 70, -230);
      ic.fillStyle(0xf4f8ff, 1).fillTriangle(86, -230, 68, -240, 68, -220);
      ic.fillStyle(inf.col, 0.5).fillCircle(78, -230, 14);
    }
    card.add(ic);
    card.add(scene.add.text(0, -110, WEAPON_NAME[w], { fontFamily: TITLE_FONT, fontSize: '50px', fontStyle: '900', color: inf.css }).setOrigin(0.5));
    card.add(scene.add.text(0, -60, inf.tag, { fontFamily: UI_FONT, fontSize: '21px', fontStyle: '700', color: '#f4e6c0' }).setOrigin(0.5));
    card.add(scene.add.text(0, 10, inf.play, { fontFamily: UI_FONT, fontSize: '19px', color: '#c8c0a8', align: 'center', lineSpacing: 6 }).setOrigin(0.5));
    // 數值條：攻擊距離／生命／防禦
    const bars = scene.add.graphics();
    const rows: [string, number, string][] = [
      ['射程', def.attackRange / (5 * UNIT), `${def.attackRange / UNIT} 格`],
      ['生命', def.hp / 620, `${def.hp}`],
      ['防禦', def.def / 20, `${def.def}`],
    ];
    rows.forEach(([name, v, txt], k) => {
      const by = 90 + k * 40;
      card.add(scene.add.text(-130, by, name, { fontFamily: UI_FONT, fontSize: '18px', color: '#a89878' }).setOrigin(0, 0.5));
      bars.fillStyle(0x2a2218, 1).fillRoundedRect(-78, by - 6, 150, 12, 5);
      bars.fillStyle(inf.col, 0.9).fillRoundedRect(-78, by - 6, Math.max(12, 150 * Math.min(1, v)), 12, 5);
      card.add(scene.add.text(130, by, txt, { fontFamily: UI_FONT, fontSize: '17px', color: '#e8dcc0' }).setOrigin(1, 0.5));
    });
    card.add(bars);
    const names = (w === 'bow' ? def.skills.map((id) => BOW_SKILLS[id]?.name ?? id) : def.skills.map((id) => SKILLS[id]?.name ?? id)).join('・');
    card.add(scene.add.text(0, 220, names, { fontFamily: UI_FONT, fontSize: '16px', color: '#b8a888', align: 'center', wordWrap: { width: 270, useAdvancedWrap: true } }).setOrigin(0.5));
    const pick = scene.add.text(0, 292, `選${WEAPON_NAME[w]}`, { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: '#1a0f08', backgroundColor: inf.css }).setOrigin(0.5).setPadding(36, 12, 36, 12);
    card.add(pick);
    const hit = scene.add.rectangle(0, 0, 310, 680, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    card.add(hit);
    hit.on('pointerover', () => paint(true));
    hit.on('pointerout', () => paint(false));
    hit.on('pointerup', () => {
      if (done) return;
      done = true;
      paint(true);
      SFX.confirm();
      scene.tweens.add({ targets: card, scale: 1.06, duration: 120, yoyo: true });
      scene.tweens.add({ targets: root, alpha: 0, delay: 260, duration: 300, onComplete: () => {
        root.destroy();
        onPick(w);
      } });
    });
    card.setAlpha(0).setY(y + 30);
    scene.tweens.add({ targets: card, alpha: 1, y, delay: 150 + i * 120, duration: 400, ease: 'Cubic.easeOut' });
    root.add(card);
  });
  return root;
}
