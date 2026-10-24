// 羈絆面板（地圖右上 ♥）：每位同伴的立繪、羈絆階段、好感條、心情台詞、已解鎖／未解鎖的羈絆事件。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { BONDS, BOND_TIERS, bondMet, bondTier } from '../../data/bonds';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, pressBounce, sparks } from '../fx/feel';
import { session, withNames } from '../session';
import { HERO_COLOR } from './partyPanel';
import { HD_PORTRAITS, generatePortraitArt } from '../art/silhouettes';
import { HAND_ART } from '../../data/handArt';

export function openBonds(scene: Phaser.Scene, depth = 900): Promise<void> {
  return new Promise((resolve) => {
    const s = session.state;
    generatePortraitArt(scene);
    const ui = scene.add.container(0, 0).setDepth(depth);
    const dim = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.82).setInteractive();
    const top = 70;
    const cardH = 236;
    const h = 130 + BONDS.length * (cardH + 14) + 110;
    const g = scene.add.graphics();
    g.fillStyle(0x0a0d1a, 0.97).fillRoundedRect(24, top, GAME_WIDTH - 48, h, 24);
    g.lineStyle(2, 0xff9ab8, 0.7).strokeRoundedRect(24, top, GAME_WIDTH - 48, h, 24);
    const title = scene.add.text(GAME_WIDTH / 2, top + 52, '♥ 羈絆', { fontFamily: TITLE_FONT, fontSize: '42px', color: '#ffc2d4' }).setOrigin(0.5);
    const sub = scene.add.text(GAME_WIDTH / 2, top + 98, '在營火與選擇之間，關係會慢慢改變', { fontFamily: UI_FONT, fontSize: '20px', color: '#8a94b8' }).setOrigin(0.5);
    ui.add([dim, g, title, sub]);

    BONDS.forEach((b, i) => {
      const y = top + 130 + i * (cardH + 14);
      const met = bondMet(s, b);
      const col = HERO_COLOR[b.id] ?? 0xffffff;
      const card = scene.add.container(0, y);
      const bg = scene.add.graphics();
      bg.fillStyle(met ? 0x141932 : 0x0c0f1c, 1).fillRoundedRect(44, 0, GAME_WIDTH - 88, cardH, 18);
      bg.lineStyle(2, col, met ? 0.6 : 0.15).strokeRoundedRect(44, 0, GAME_WIDTH - 88, cardH, 18);
      card.add(bg);
      // 立繪（裁切在左側框內）
      const key = `portrait_${b.id}`;
      if (scene.textures.exists(key)) {
        // 手繪立繪：放大、從頭頂往下裁出臉與上半身
        const big = HAND_ART.includes(key) || HD_PORTRAITS.has(key);
        const p = big
          ? scene.add.image(132, 6, key).setOrigin(0.5, 0)
          : scene.add.image(130, cardH - 6, key).setOrigin(0.5, 1).setScale(0.74);
        if (big) p.setScale((cardH * 2.1) / p.height);
        if (!met) p.setTintFill(0x1a1f36);
        const mask = scene.make.graphics({}, false);
        mask.fillRect(52, y + 8, 160, cardH - 16);
        p.setMask(mask.createGeometryMask());
        card.add(p);
      }
      if (!met) {
        card.add(scene.add.text(380, cardH / 2, '？？？\n尚未相遇', { fontFamily: UI_FONT, fontSize: '28px', color: '#4a5378', align: 'center' }).setOrigin(0.5));
        ui.add(card);
        return;
      }
      const tier = bondTier(s, b);
      const aff = s.affinity[b.id] ?? 0;
      card.add(scene.add.text(232, 22, b.name, { fontFamily: TITLE_FONT, fontSize: '34px', color: '#ffffff' }));
      card.add(scene.add.text(232 + 34 * b.name.length + 14, 32, b.epithet, { fontFamily: UI_FONT, fontSize: '19px', color: '#8a94b8' }));
      card.add(scene.add.text(GAME_WIDTH - 64, 26, BOND_TIERS[tier] ?? '', {
        fontFamily: UI_FONT, fontSize: '20px', fontStyle: '700', color: '#0a0d1a', backgroundColor: tier >= 4 ? '#ff9ab8' : '#ffd27a', padding: { x: 10, y: 4 },
      }).setOrigin(1, 0));
      // 好感條 + 愛心
      const bar = scene.add.graphics();
      bar.fillStyle(0x000000, 0.6).fillRoundedRect(232, 76, 300, 14, 7);
      bar.fillStyle(0xff7aa0, 1).fillRoundedRect(232, 76, Math.max(6, 300 * Math.min(1, aff / 100)), 14, 7);
      bar.fillStyle(0xffffff, 0.3).fillRect(236, 78, Math.max(0, 300 * Math.min(1, aff / 100) - 8), 2);
      card.add(bar);
      const hearts = '♥'.repeat(tier) + '♡'.repeat(4 - tier);
      card.add(scene.add.text(548, 70, hearts, { fontFamily: UI_FONT, fontSize: '24px', color: '#ff9ab8' }));
      // 心情台詞
      card.add(scene.add.text(232, 104, `「${withNames(b.moods[tier] ?? '')}」`, {
        fontFamily: UI_FONT, fontSize: '22px', color: '#e8dcc8', wordWrap: { width: GAME_WIDTH - 300 },
      }));
      // 羈絆事件
      b.events.forEach((e, k) => {
        const done = !!s.flags[e.flag];
        const ex = 232 + (k % 2) * 230;
        const ey = 154 + Math.floor(k / 2) * 34;
        card.add(scene.add.text(ex, ey, done ? `✦ ${e.title}` : `○ ${e.hint}`, {
          fontFamily: UI_FONT, fontSize: '19px', color: done ? '#ffd27a' : '#5a6388',
        }));
      });
      card.setSize(GAME_WIDTH, cardH).setInteractive(new Phaser.Geom.Rectangle(44, 0, GAME_WIDTH - 88, cardH), Phaser.Geom.Rectangle.Contains);
      card.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.uiTap();
        sparks(scene, 130, y + 80, 14, 'ember', 0xff9ab8, 220);
      });
      ui.add(card);
    });

    const close = scene.add.container(GAME_WIDTH / 2, top + h - 60);
    const cbg = scene.add.graphics();
    cbg.fillStyle(0xffc2d4, 1).fillRoundedRect(-140, -34, 280, 68, 34);
    const ct = scene.add.text(0, 0, '關閉', { fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: '#0a0d1a' }).setOrigin(0.5);
    close.add([cbg, ct]).setSize(280, 68).setInteractive({ useHandCursor: true });
    close.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      pressBounce(scene, close);
      ui.destroy();
      resolve();
    });
    ui.add(close);
    ui.setAlpha(0);
    scene.tweens.add({ targets: ui, alpha: 1, duration: 160 });
  });
}
