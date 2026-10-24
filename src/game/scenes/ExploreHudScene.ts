// 自由探索的 HUD（獨立場景、不跟鏡頭捲動）：區域名＋目標、選單按鈕、虛擬搖桿、互動按鈕、提示訊息、夜晚暗角。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { AREAS } from '../../data/areas';
import { SIDE_GOALS } from '../../data/sideQuests';
import { check } from '../../core/state/gameState';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, pressBounce } from '../fx/feel';
import { openBonds } from '../ui/bondPanel';
import { openBag } from '../ui/bagPanel';
import { openSettings } from '../ui/settingsPanel';
import { session } from '../session';
import type { ExploreScene } from './ExploreScene';

export class ExploreHudScene extends Phaser.Scene {
  private goal!: Phaser.GameObjects.Text;
  private base!: Phaser.GameObjects.Arc;
  private knob!: Phaser.GameObjects.Arc;
  private act!: Phaser.GameObjects.Container;
  private actLabel!: Phaser.GameObjects.Text;
  private actName: string | null = null;
  private areaId = 'greylamp';

  constructor() {
    super('ExploreHud');
  }

  init(data: { area?: string }): void {
    this.areaId = data.area ?? 'greylamp';
    this.actName = null;
  }

  private world(): ExploreScene {
    return this.scene.get('Explore') as ExploreScene;
  }

  create(): void {
    const area = AREAS[this.areaId];
    if (area?.night) {
      const key = 'ex_vignette';
      if (!this.textures.exists(key)) {
        const t = this.textures.createCanvas(key, GAME_WIDTH / 4, GAME_HEIGHT / 4);
        if (t) {
          const c = t.getContext();
          const g = c.createRadialGradient(GAME_WIDTH / 8, GAME_HEIGHT / 8 + 4, 30, GAME_WIDTH / 8, GAME_HEIGHT / 8, GAME_HEIGHT / 6.2);
          g.addColorStop(0, 'rgba(6,8,24,0)');
          g.addColorStop(0.6, 'rgba(6,8,24,0.25)');
          g.addColorStop(1, 'rgba(4,5,16,0.8)');
          c.fillStyle = g;
          c.fillRect(0, 0, GAME_WIDTH / 4, GAME_HEIGHT / 4);
          t.refresh();
        }
      }
      this.add.image(0, 0, key).setOrigin(0, 0).setScale(4).setDepth(0);
    }
    // 頂欄
    const top = this.add.graphics().setDepth(10);
    top.fillStyle(0x05060c, 0.78).fillRect(0, 0, GAME_WIDTH, 150);
    top.lineStyle(2, 0xffd27a, 0.35).lineBetween(0, 150, GAME_WIDTH, 150);
    this.add.text(GAME_WIDTH / 2, 56, area?.name ?? '', { fontFamily: TITLE_FONT, fontSize: '36px', color: '#ffd27a' }).setOrigin(0.5).setDepth(11);
    this.goal = this.add.text(GAME_WIDTH / 2, 110, '', { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5).setDepth(11);
    this.refreshGoal();
    this.button(44, 56, '⚙', '#c8d0f0', () => openSettings(this));
    this.button(GAME_WIDTH - 40, 56, '♥', '#ff9ab8', () => openBonds(this));
    this.button(GAME_WIDTH - 168, 56, '🎒', '#ffd27a', () => openBag(this));
    this.button(GAME_WIDTH - 104, 56, '🗺', '#aab4dd', async () => {
      this.world().leaveToMap();
    }, true);
    // 搖桿
    this.base = this.add.circle(0, 0, 90, 0x0a0d1a, 0.35).setStrokeStyle(3, 0xffd27a, 0.5).setDepth(20).setVisible(false);
    this.knob = this.add.circle(0, 0, 38, 0xffd27a, 0.5).setDepth(21).setVisible(false);
    // 互動按鈕（旁邊有人／物時）
    this.act = this.add.container(GAME_WIDTH - 130, GAME_HEIGHT - 150).setDepth(30).setVisible(false);
    const g = this.add.graphics();
    g.fillStyle(0x0a0d1a, 0.9).fillCircle(0, 0, 70);
    g.lineStyle(4, 0xffd27a, 1).strokeCircle(0, 0, 70);
    const icon = this.add.text(0, -14, '✦', { fontFamily: UI_FONT, fontSize: '40px', color: '#ffd27a' }).setOrigin(0.5);
    this.actLabel = this.add.text(0, 30, '', { fontFamily: UI_FONT, fontSize: '20px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5);
    this.act.add([g, icon, this.actLabel]);
    this.act.setSize(150, 150).setInteractive({ useHandCursor: true });
    this.act.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      pressBounce(this, this.act);
      this.world().actNearby();
    });
    // 第一次：操作說明
    const s = session.state;
    if (!s.flags['tip_explore']) {
      s.flags['tip_explore'] = true;
      this.toast('點地面走過去，按住拖曳是搖桿。\n點人物或門可以互動；頭上「！」推進主線。', 5200);
    }
  }

  private button(x: number, y: number, label: string, color: string, fn: () => Promise<void>, noPause = false): void {
    const b = this.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: '40px', color, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(12).setPadding(10, 10, 10, 10).setInteractive({ useHandCursor: true });
    b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      const w = this.world();
      if (w.busy) return;
      SFX.uiTap();
      if (!noPause) w.busy = true;
      void fn().then(() => {
        if (!noPause) w.busy = false;
        this.refreshGoal();
      });
    });
  }

  refreshGoal(): void {
    const o = this.world()?.objective?.();
    let text = o ? `目標：前往「${o.name ?? o.id}」` : '自由探索中';
    // 進行中的支線（點燈）：顯示進度
    const f = session.state.flags;
    const area = AREAS[this.areaId];
    const lamps = area?.entities.filter((e) => e.kind === 'lamp') ?? [];
    if (lamps.length > 0 && f['q_lamps'] && !f['q_lamps_rewarded']) {
      const lit = lamps.filter((e) => f[`lamp_${this.areaId}_${e.id}`]).length;
      text += lit >= lamps.length ? '　◇ 回報老燈伕' : `　◇ 點燈 ${lit}/${lamps.length}`;
    } else {
      const side = SIDE_GOALS.find((g) => check(session.state, g.when));
      if (side) text += `　${side.text}`;
    }
    this.goal?.setText(text);
  }

  showStick(x: number, y: number, vx: number, vy: number): void {
    this.base.setPosition(x, y).setVisible(true);
    this.knob.setPosition(x + vx * 70, y + vy * 70).setVisible(true);
  }

  hideStick(): void {
    this.base?.setVisible(false);
    this.knob?.setVisible(false);
  }

  setAct(name: string | null): void {
    if (name === this.actName) return;
    this.actName = name;
    if (!this.act) return;
    this.act.setVisible(name !== null);
    if (name) {
      this.actLabel.setText(name.length > 5 ? `${name.slice(0, 5)}…` : name);
      this.act.setScale(0.6);
      this.tweens.add({ targets: this.act, scale: 1, duration: 180, ease: 'Back.Out' });
    }
    this.refreshGoal();
  }

  toast(text: string, ms = 2600): void {
    const c = this.add.container(GAME_WIDTH / 2, 230).setDepth(40).setAlpha(0);
    const t = this.add.text(0, 0, text, {
      fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff', align: 'center', lineSpacing: 6,
      wordWrap: { width: 600, useAdvancedWrap: true },
    }).setOrigin(0.5);
    const g = this.add.graphics();
    const w = t.width + 48;
    const h = t.height + 32;
    g.fillStyle(0x070912, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.lineStyle(2, 0x7fe8ff, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    c.add([g, t]);
    this.tweens.add({ targets: c, alpha: 1, y: 240, duration: 220 });
    this.time.delayedCall(ms, () => this.tweens.add({ targets: c, alpha: 0, duration: 260, onComplete: () => c.destroy() }));
  }
}
