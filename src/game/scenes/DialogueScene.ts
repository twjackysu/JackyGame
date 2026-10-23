// 對話場景（07 §4）：打字機、名牌、剪影立繪、選擇與檢定擲骰、外部事件（戰鬥／章節卡）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { playMusic, stopMusic } from '../../audio/music';
import { DialogueRunner, type DialogueStep, type ShownOption } from '../../core/dialogue/runner';
import type { HeroId } from '../../core/battle/skills';
import { SPEAKER_NAMES } from '../../data/dialogue/speakers';
import { CH1_ENTRIES } from '../../data/dialogue/ch1';
import { generateCombatantArt, generatePortraitArt } from '../art/silhouettes';
import { backdropFor, backdropKey } from '../art/backdrops';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, bigText, pressBounce, shockRing, sparks, fadeOutThen } from '../fx/feel';
import { RENAMEABLE, SCRIPTS, session, withNames } from '../session';
import { textCharMs } from '../settings';
import type { BattleSceneData } from './BattleScene';

export interface DialogueSceneData {
  script: string;
  node?: string;
}

const PORTRAIT: Record<string, string> = {
  lian: 'portrait_lian', serin: 'portrait_serin', rourke: 'portrait_rourke', io: 'portrait_io', girl: 'portrait_io', knight: 'npc_knight', guard: 'npc_knight', gwen: 'npc_gwen',
  mara: 'npc_mara', hanna: 'npc_hanna', toby: 'npc_toby', farrow: 'npc_farrow', bern: 'npc_bern',
};
const NAME_COLOR: Record<string, string> = {
  lian: '#ffb565', serin: '#c8d4ff', rourke: '#e0705a', io: '#7fd8ff', liora: '#ff7a5a', gwen: '#ffd27a', knight: '#9fb0d8',
};
const STAT_NAME: Record<string, string> = { str: '力', agi: '敏', int: '智', cha: '魅' };
const CHAPTER_TITLE: Record<string, [string, string]> = {
  ch0: ['序章', '被留下的燈'],
  ch1: ['第一章', '霧角森林'],
  ch2: ['第二章', '沉鐘'],
  ch3: ['第三章', '星冠'],
};

const BOX_Y = 1030;
const ENCOUNTER_LEVEL_FLOOR: Record<string, number> = {
  ch0_tutorial: 3, forest_a: 3, forest_b: 3, path_a: 3, path_b: 3, caravan: 3, shrine_boar: 4, boss_wolfking: 4,
};

export class DialogueScene extends Phaser.Scene {
  private runner!: DialogueRunner;
  private scriptId = 'ch0';
  private lastNode = '';
  private box!: Phaser.GameObjects.Container;
  private nameText!: Phaser.GameObjects.Text;
  private nameBg!: Phaser.GameObjects.Graphics;
  private bodyText!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Text;
  private portraits: Record<'left' | 'right', Phaser.GameObjects.Image | null> = { left: null, right: null };
  private fullText = '';
  private shown = 0;
  private typing?: Phaser.Time.TimerEvent;
  private waiting: 'tap' | 'choice' | 'busy' = 'busy';
  private lamp!: Phaser.GameObjects.Image;

  constructor() {
    super('Dialogue');
  }

  init(data: DialogueSceneData): void {
    this.scriptId = data.script ?? 'ch0';
    const script = SCRIPTS[this.scriptId];
    if (!script) throw new Error(`unknown script ${this.scriptId}`);
    const node = data.node && script.nodes[data.node] ? data.node : script.start ?? 'start';
    const entry = this.scriptId === 'ch1' ? CH1_ENTRIES.find((e) => e.node === node) : undefined;
    if (entry) session.state.location = { region: 'ch1', node: entry.location };
    this.runner = new DialogueRunner({ ...script, start: node }, session.state);
    this.lastNode = '';
    this.portraits = { left: null, right: null };
    this.waiting = 'busy';
  }

  create(): void {
    generateCombatantArt(this);
    generatePortraitArt(this);
    this.drawBackdrop();
    this.buildBox();
    this.input.on('pointerdown', () => this.onTap());
    // 場景重啟（start）時 Phaser 不會清掉自訂監聽器 → 先移除舊的，否則 onWake 會跑兩次（"no pending event" 當機）
    this.events.off(Phaser.Scenes.Events.WAKE);
    this.events.on(Phaser.Scenes.Events.WAKE, (_: unknown, d?: { outcome?: string }) => this.onWake(d?.outcome ?? 'win'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE));
    this.ambientMusic(0.6);
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.time.delayedCall(300, () => this.advance());
  }

  // ------------------------------------------------------------ 視覺
  private drawBackdrop(): void {
    const key = 'bg_ruins';
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
      if (tex) {
        const c = tex.getContext();
        const bg = c.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        bg.addColorStop(0, '#05060c');
        bg.addColorStop(0.5, '#141220');
        bg.addColorStop(1, '#050509');
        c.fillStyle = bg;
        c.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        // 迴廊拱門（透視）
        for (let k = 0; k < 6; k++) {
          const f = 1 - k * 0.15;
          const w = 640 * f;
          const h = 900 * f;
          const x = (GAME_WIDTH - w) / 2;
          const y = 820 - h;
          c.strokeStyle = `rgba(${120 - k * 12},${100 - k * 10},${150 - k * 14},${0.5 - k * 0.07})`;
          c.lineWidth = 26 * f;
          c.beginPath();
          c.moveTo(x, 820 - k * 30);
          c.lineTo(x, y + w / 2);
          c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
          c.lineTo(x + w, 820 - k * 30);
          c.stroke();
        }
        // 石磚地板
        c.strokeStyle = 'rgba(120,100,150,0.18)';
        c.lineWidth = 2;
        for (let i = -6; i <= 6; i++) {
          c.beginPath();
          c.moveTo(GAME_WIDTH / 2 + i * 20, 640);
          c.lineTo(GAME_WIDTH / 2 + i * 160, GAME_HEIGHT);
          c.stroke();
        }
        for (let y = 660; y < GAME_HEIGHT; y += (y - 600) * 0.3) {
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(GAME_WIDTH, y);
          c.stroke();
        }
        // 星紋刻痕
        c.fillStyle = 'rgba(200,180,255,0.35)';
        for (const [x, y] of [[180, 420], [540, 380], [360, 260]] as const) {
          c.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            const r = i % 2 ? 6 : 16;
            c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          }
          c.fill();
        }
        tex.refresh();
      }
    }
    this.add.image(0, 0, backdropKey(this, backdropFor(this.scriptId, session.state.location.node))).setOrigin(0, 0);
    // 提燈光暈（搖曳）
    this.lamp = this.add.image(GAME_WIDTH / 2, 760, 'glow').setScale(3.4).setTint(0xffa54a).setAlpha(0.45)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.lamp, alpha: 0.32, scale: 3.1, duration: 160, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [4] });
    this.add.particles(0, 0, 'ember', {
      x: { min: 0, max: GAME_WIDTH }, y: { min: 300, max: 900 }, lifespan: { min: 3000, max: 6000 },
      speedY: { min: -20, max: -5 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.7, end: 0 }, frequency: 350,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.25);
  }

  private buildBox(): void {
    this.box = this.add.container(0, BOX_Y).setDepth(100);
    const bg = this.add.graphics();
    bg.fillStyle(0x070912, 0.92).fillRoundedRect(20, 0, GAME_WIDTH - 40, 230, 22);
    bg.lineStyle(2, 0xffd27a, 0.55).strokeRoundedRect(20, 0, GAME_WIDTH - 40, 230, 22);
    bg.fillStyle(0xffd27a, 0.08).fillRoundedRect(26, 6, GAME_WIDTH - 52, 50, 18);
    this.nameBg = this.add.graphics();
    this.nameText = this.add.text(56, -2, '', {
      fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: '#ffd27a', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0, 0.5);
    this.bodyText = this.add.text(50, 40, '', {
      fontFamily: UI_FONT, fontSize: '32px', color: '#f0f2ff', lineSpacing: 14, wordWrap: { width: GAME_WIDTH - 100, useAdvancedWrap: true },
    });
    this.arrow = this.add.text(GAME_WIDTH - 60, 200, '▼', { fontFamily: UI_FONT, fontSize: '24px', color: '#ffd27a' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: this.arrow, y: 208, duration: 400, yoyo: true, repeat: -1 });
    this.box.add([bg, this.nameBg, this.nameText, this.bodyText, this.arrow]);
    this.box.setAlpha(0);
  }

  private setPortrait(speaker: string): void {
    const key = PORTRAIT[speaker];
    const side: 'left' | 'right' = speaker === 'lian' ? 'left' : 'right';
    const cur = this.portraits[side];
    if (!key) {
      // 旁白／內心：立繪淡化
      for (const p of Object.values(this.portraits)) if (p) this.tweens.add({ targets: p, alpha: 0.35, duration: 200 });
      return;
    }
    const other = this.portraits[side === 'left' ? 'right' : 'left'];
    if (other) this.tweens.add({ targets: other, alpha: 0.4, duration: 200 });
    if (cur && cur.texture.key === key) {
      this.tweens.add({ targets: cur, alpha: 1, duration: 150 });
      return;
    }
    if (cur) this.tweens.add({ targets: cur, alpha: 0, x: cur.x + (side === 'left' ? -60 : 60), duration: 200, onComplete: () => cur.destroy() });
    const x = side === 'left' ? 200 : GAME_WIDTH - 200;
    const img = this.add.image(x + (side === 'left' ? -80 : 80), 820, key).setOrigin(0.5, 1).setScale(0.95).setAlpha(0).setDepth(50);
    if (side === 'right' && speaker !== 'gwen' && speaker !== 'knight') img.setFlipX(false);
    if (this.renderer.type === Phaser.WEBGL) img.preFX?.addGlow(0xffb565, 1.5, 0, false, 0.1, 8);
    this.tweens.add({ targets: img, x, alpha: 1, duration: 260, ease: 'Cubic.Out' });
    this.portraits[side] = img;
  }

  private showLine(speaker: string, text: string): void {
    const name = withNames(SPEAKER_NAMES[speaker] ?? speaker);
    text = withNames(text);
    this.setPortrait(speaker);
    if (this.box.alpha < 1) this.tweens.add({ targets: this.box, alpha: 1, duration: 200 });
    this.nameBg.clear();
    if (name) {
      const col = Phaser.Display.Color.HexStringToColor(NAME_COLOR[speaker] ?? '#ffd27a').color;
      this.nameBg.fillStyle(0x070912, 1).fillRoundedRect(36, -24, 40 + name.length * 32, 46, 12);
      this.nameBg.lineStyle(2, col, 1).strokeRoundedRect(36, -24, 40 + name.length * 32, 46, 12);
    }
    this.nameText.setText(name).setColor(NAME_COLOR[speaker] ?? '#ffd27a');
    const inner = speaker === 'lian_inner';
    const narr = speaker === 'narration';
    this.bodyText.setColor(inner ? '#9fd8ff' : narr ? '#b8b0c8' : '#f0f2ff').setFontStyle(narr ? 'italic' : 'normal');
    this.fullText = narr ? text.replace(/^〔|〕$/g, '') : text;
    this.shown = 0;
    this.bodyText.setText('');
    this.arrow.setAlpha(0);
    this.typing?.remove();
    this.typing = this.time.addEvent({
      delay: textCharMs(),
      repeat: this.fullText.length - 1,
      callback: () => {
        this.shown++;
        this.bodyText.setText(this.fullText.slice(0, this.shown));
        if (this.shown % 3 === 0) SFX.uiTap();
        if (this.shown >= this.fullText.length) this.finishTyping();
      },
    });
    this.waiting = 'tap';
  }

  private finishTyping(): void {
    this.typing?.remove();
    this.typing = undefined;
    this.shown = this.fullText.length;
    this.bodyText.setText(this.fullText);
    this.arrow.setAlpha(1);
  }

  private onTap(): void {
    if (this.waiting !== 'tap') return;
    if (this.shown < this.fullText.length) {
      this.finishTyping();
      return;
    }
    this.advance();
  }

  // ------------------------------------------------------------ 腳本推進
  private advance(): void {
    this.waiting = 'busy';
    let step: DialogueStep;
    try {
      step = this.runner.next();
    } catch (e) {
      console.error(e);
      step = { kind: 'end' };
    }
    this.trackNode();
    switch (step.kind) {
      case 'say':
        this.showLine(step.speaker, step.text);
        return;
      case 'choice':
        this.showChoices(step.options);
        return;
      case 'event':
        this.runEvent(step.event, step.id);
        return;
      case 'roll':
        return;
      case 'end':
        this.finish();
        return;
    }
  }

  private trackNode(): void {
    const n = this.runner.currentNode;
    if (n !== this.lastNode) {
      this.lastNode = n;
      session.setScriptPos(this.scriptId, n);
      session.save();
    }
  }

  private showChoices(options: ShownOption[]): void {
    this.waiting = 'choice';
    this.arrow.setAlpha(0);
    const ui = this.add.container(0, 0).setDepth(200);
    const h = 100;
    const top = BOX_Y - 30 - options.length * (h + 14);
    options.forEach((o, i) => {
      const y = top + i * (h + 14) + h / 2;
      const c = this.add.container(GAME_WIDTH / 2, y);
      const bg = this.add.graphics();
      let tag = '';
      let tagColor = '#ffd27a';
      let locked = false;
      if (o.check && 'stat' in o.check) {
        tag = `[${STAT_NAME[o.check.stat] ?? o.check.stat} ${o.check.dc}] ${Math.round((o.chance ?? 0) * 100)}%`;
      } else if (o.check && 'codex' in o.check) {
        locked = (o.chance ?? 0) <= 0;
        tag = locked ? '[筆記] 未記載' : '[筆記] 必定成功';
        tagColor = locked ? '#5a6380' : '#7fe8ff';
      }
      const border = o.check ? Phaser.Display.Color.HexStringToColor(tagColor).color : 0x9fb0d8;
      bg.fillStyle(0x0b0f1e, 0.95).fillRoundedRect(-320, -h / 2, 640, h, 18);
      bg.lineStyle(2, border, locked ? 0.4 : 1).strokeRoundedRect(-320, -h / 2, 640, h, 18);
      const parts: Phaser.GameObjects.GameObject[] = [bg];
      if (tag) {
        parts.push(this.add.text(-296, -h / 2 + 22, tag, { fontFamily: UI_FONT, fontSize: '20px', fontStyle: '700', color: tagColor }).setOrigin(0, 0.5));
      }
      parts.push(this.add.text(-296, tag ? 12 : 0, withNames(o.text), {
        fontFamily: UI_FONT, fontSize: '27px', color: locked ? '#5a6380' : '#ffffff', wordWrap: { width: 590, useAdvancedWrap: true },
      }).setOrigin(0, 0.5));
      c.add(parts);
      c.setSize(640, h).setInteractive({ useHandCursor: !locked });
      c.setAlpha(0).setX(GAME_WIDTH / 2 + 60);
      this.tweens.add({ targets: c, alpha: 1, x: GAME_WIDTH / 2, delay: i * 70, duration: 220, ease: 'Cubic.Out' });
      c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        if (this.waiting !== 'choice') return;
        if (locked) {
          SFX.uiCancel();
          this.tweens.add({ targets: c, x: c.x + 8, duration: 50, yoyo: true, repeat: 2 });
          return;
        }
        pressBounce(this, c);
        SFX.confirm();
        void this.pick(o, ui);
      });
      ui.add(c);
    });
  }

  private async pick(o: ShownOption, ui: Phaser.GameObjects.Container): Promise<void> {
    this.waiting = 'busy';
    this.tweens.add({ targets: ui, alpha: 0, duration: 200, onComplete: () => ui.destroy() });
    const roll = this.runner.choose(o.index);
    if (roll && roll.kind === 'roll' && o.check && 'stat' in o.check) await this.rollFx(roll.success, roll.chance);
    else if (roll && roll.kind === 'roll') {
      // 筆記：必定成功的青色閃光
      SFX.perfect();
      shockRing(this, GAME_WIDTH / 2, 600, 0x7fe8ff, 260, 500, 10);
      await new Promise((r) => this.time.delayedCall(350, r));
    }
    this.advance();
  }

  /** 20 面星形骰旋轉 0.8 秒 → 成功（琥珀爆光）／失敗（灰色碎裂） */
  private async rollFx(success: boolean, chance: number): Promise<void> {
    const cx = GAME_WIDTH / 2;
    const cy = 560;
    const g = this.add.graphics().setDepth(300);
    const star = (r: number, col: number) => {
      g.clear();
      g.fillStyle(col, 1);
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        pts.push(new Phaser.Math.Vector2(Math.cos(a) * (i % 2 ? r * 0.72 : r), Math.sin(a) * (i % 2 ? r * 0.72 : r)));
      }
      g.fillPoints(pts, true);
      g.lineStyle(4, 0xffffff, 0.8).strokePoints(pts, true);
    };
    g.setPosition(cx, cy);
    star(90, 0x3a2a60);
    const num = this.add.text(cx, cy, '', { fontFamily: TITLE_FONT, fontSize: '64px', fontStyle: '900', color: '#ffffff', stroke: '#000', strokeThickness: 6 })
      .setOrigin(0.5).setDepth(301);
    const pct = this.add.text(cx, cy + 130, `成功率 ${Math.round(chance * 100)}%`, { fontFamily: UI_FONT, fontSize: '26px', color: '#cfd6ff' })
      .setOrigin(0.5).setDepth(301);
    const spin = this.tweens.add({ targets: g, angle: 720, duration: 800, ease: 'Cubic.Out' });
    for (let i = 0; i < 10; i++) {
      num.setText(String(Phaser.Math.Between(1, 20)));
      SFX.cardPlay();
      await new Promise((r) => this.time.delayedCall(40 + i * 8, r));
    }
    spin.stop();
    const face = success ? Phaser.Math.Between(Math.max(1, 21 - Math.round(chance * 20)), 20) : Phaser.Math.Between(1, Math.max(1, 20 - Math.round(chance * 20)));
    num.setText(String(face));
    if (success) {
      star(100, 0xffa54a);
      SFX.perfect();
      sparks(this, cx, cy, 50, 'ember', undefined, 600);
      shockRing(this, cx, cy, 0xffd27a, 280, 500, 12);
      bigText(this, cx, cy - 170, '成功', '#ffd27a', 64, 500);
    } else {
      star(90, 0x444455);
      SFX.uiCancel();
      sparks(this, cx, cy, 30, 'shard', 0x777788, 400);
      this.cameras.main.shake(200, 0.008);
      bigText(this, cx, cy - 170, '失敗', '#9a9aaa', 60, 500);
    }
    await new Promise((r) => this.time.delayedCall(900, r));
    this.tweens.add({ targets: [g, num, pct], alpha: 0, duration: 250, onComplete: () => { g.destroy(); num.destroy(); pct.destroy(); } });
  }

  private runEvent(kind: string, id: string): void {
    if (kind === 'battle') {
      const s = session.state;
      // 等級下限（D-016）：劇情戰依遭遇保底，避免第 1 章戰鬥次數少導致等級不足
      const floor = ENCOUNTER_LEVEL_FLOOR[id] ?? 1;
      for (const m of s.party) {
        const mem = s.members[m];
        if (mem && mem.level < floor) {
          mem.level = floor;
          mem.xp = 0;
        }
      }
      const party = s.party.slice(0, 3).map((m) => ({ id: m as HeroId, level: s.members[m]?.level ?? 1 }));
      session.save();
      this.cameras.main.flash(250, 255, 255, 255);
      SFX.hitHeavy();
      this.time.delayedCall(260, () => {
        this.scene.sleep();
        this.scene.run('Battle', {
          encounter: id, party, story: true, tutorial: id.startsWith('ch0'),
        } satisfies BattleSceneData);
      });
      return;
    }
    if (kind === 'chapterCard') {
      void this.chapterCard(id).then(() => {
        this.runner.resume('done');
        this.advance();
      });
      return;
    }
    if (kind === 'cards') {
      session.save();
      fadeOutThen(this, 300, () => {
        this.scene.sleep();
        this.scene.run('Cards', { match: id, story: true });
      });
      return;
    }
    if (kind === 'shop' || kind === 'summary' || kind === 'rename') {
      const p = kind === 'shop' ? this.shop() : kind === 'rename' ? this.rename(id) : this.summary(id);
      void p.then(() => {
        this.runner.resume('done');
        this.advance();
      });
      return;
    }
    // 未知事件：略過
    this.runner.resume('win');
    this.advance();
  }

  /** 替同伴取名：4 個候選名（手機上避免文字輸入框與鍵盤遮擋） */
  private rename(id: string): Promise<void> {
    return new Promise((resolve) => {
      const r = RENAMEABLE[id];
      if (!r) {
        resolve();
        return;
      }
      const s = session.state;
      const ui = this.add.container(0, 0).setDepth(300);
      const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72).setInteractive();
      const g = this.add.graphics();
      g.fillStyle(0x0a0d1a, 0.97).fillRoundedRect(60, 360, GAME_WIDTH - 120, 600, 24);
      g.lineStyle(2, 0x7fd8ff, 0.8).strokeRoundedRect(60, 360, GAME_WIDTH - 120, 600, 24);
      const title = this.add.text(GAME_WIDTH / 2, 420, '為她取個名字', { fontFamily: TITLE_FONT, fontSize: '38px', color: '#7fd8ff' }).setOrigin(0.5);
      const sub = this.add.text(GAME_WIDTH / 2, 470, '之後的故事都會這樣稱呼她', { fontFamily: UI_FONT, fontSize: '22px', color: '#8a94b8' }).setOrigin(0.5);
      ui.add([dim, g, title, sub]);
      r.options.forEach((nm, i) => {
        const y = 560 + i * 100;
        const row = this.add.container(GAME_WIDTH / 2, y);
        const rb = this.add.graphics();
        rb.fillStyle(0x14203a, 1).fillRoundedRect(-240, -40, 480, 80, 16).lineStyle(2, 0x7fd8ff, 0.7).strokeRoundedRect(-240, -40, 480, 80, 16);
        const t = this.add.text(0, 0, nm, { fontFamily: TITLE_FONT, fontSize: '36px', color: '#ffffff' }).setOrigin(0.5);
        row.add([rb, t]).setSize(480, 80).setInteractive({ useHandCursor: true });
        row.setAlpha(0);
        this.tweens.add({ targets: row, alpha: 1, delay: 80 * i, duration: 220 });
        row.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          s.flags[r.flag] = nm;
          SFX.levelUp();
          pressBounce(this, row);
          this.cameras.main.flash(200, 127, 216, 255);
          this.time.delayedCall(220, () => {
            session.save();
            ui.destroy();
            resolve();
          });
        });
        ui.add(row);
      });
    });
  }

  /** 雜貨店（簡易版）：用金幣買戰鬥道具 */
  private shop(): Promise<void> {
    return new Promise((resolve) => {
      const s = session.state;
      const disc = Number(s.flags['shop_discount_ch1'] ?? 0);
      const goods: [string, string, number][] = [
        ['potion_s', '小回復藥（HP+60）', 30], ['lamp_oil', '燈油（SP+2）', 40],
      ];
      const ui = this.add.container(0, 0).setDepth(300);
      const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setInteractive();
      const g = this.add.graphics();
      g.fillStyle(0x0a0d1a, 0.97).fillRoundedRect(40, 330, GAME_WIDTH - 80, 560, 24);
      g.lineStyle(2, 0xffd27a, 0.8).strokeRoundedRect(40, 330, GAME_WIDTH - 80, 560, 24);
      const title = this.add.text(GAME_WIDTH / 2, 380, disc ? `雜貨店（折扣 ${disc}%）` : '雜貨店', { fontFamily: TITLE_FONT, fontSize: '36px', color: '#ffd27a' }).setOrigin(0.5);
      const gold = this.add.text(GAME_WIDTH / 2, 430, '', { fontFamily: UI_FONT, fontSize: '26px', color: '#ffe6a0' }).setOrigin(0.5);
      ui.add([dim, g, title, gold]);
      const refresh: (() => void)[] = [];
      const upd = () => {
        gold.setText(`金幣 ${s.gold}`);
        refresh.forEach((f) => f());
      };
      goods.forEach(([id, name, price0], i) => {
        const price = Math.round(price0 * (1 - disc / 100));
        const y = 520 + i * 120;
        const row = this.add.container(GAME_WIDTH / 2, y);
        const rb = this.add.graphics();
        const t = this.add.text(-260, 0, '', { fontFamily: UI_FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0, 0.5);
        const pt = this.add.text(260, 0, `${price} 金 ▶ 購買`, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#ffd27a' }).setOrigin(1, 0.5);
        row.add([rb, t, pt]).setSize(580, 96).setInteractive({ useHandCursor: true });
        refresh.push(() => {
          const ok = s.gold >= price;
          rb.clear().fillStyle(0x18203a, 1).fillRoundedRect(-290, -48, 580, 96, 16).lineStyle(2, ok ? 0xffd27a : 0x3a4060, 1).strokeRoundedRect(-290, -48, 580, 96, 16);
          t.setText(`${name}　持有 ${s.inventory[id] ?? 0}`);
          pt.setColor(ok ? '#ffd27a' : '#5a6380');
        });
        row.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          if (s.gold < price) {
            SFX.uiCancel();
            return;
          }
          s.gold -= price;
          s.inventory[id] = (s.inventory[id] ?? 0) + 1;
          SFX.itemGet();
          pressBounce(this, row);
          upd();
        });
        ui.add(row);
      });
      const leave = this.add.text(GAME_WIDTH / 2, 830, '離開', { fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: '#aab4dd' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      leave.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.uiCancel();
        session.save();
        ui.destroy();
        resolve();
      });
      ui.add(leave);
      upd();
    });
  }

  /** 章節結算：偏移值、羈絆、聲望、等級 */
  private summary(id: string): Promise<void> {
    return new Promise((resolve) => {
      const s = session.state;
      const ui = this.add.container(0, 0).setDepth(300);
      const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setInteractive();
      const [a, b] = CHAPTER_TITLE[id] ?? [id, ''];
      const lines = [
        `劇情偏移值　${s.divergence}`,
        `連恩　Lv ${s.members.lian?.level ?? 1}　金幣 ${s.gold}`,
        ...(['io', 'rourke', 'serin'] as const).filter((c) => s.affinity[c] > 0 || s.party.includes(c)).map((c) => `${SPEAKER_NAMES[c]} 羈絆　${'♥'.repeat(Math.min(5, Math.ceil(s.affinity[c] / 10)))}${s.affinity[c]}`),
        `灰燈鎮聲望 ${s.reputation.town}　騎士團 ${s.reputation.order}`,
        `攻略筆記 ${s.codex.length} 條`,
      ];
      const t1 = this.add.text(GAME_WIDTH / 2, 330, `${a}　${b}　完`, { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5);
      ui.add([dim, t1]);
      lines.forEach((l, i) => {
        const t = this.add.text(GAME_WIDTH / 2, 450 + i * 64, l, { fontFamily: UI_FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, x: { from: GAME_WIDTH / 2 + 40, to: GAME_WIDTH / 2 }, delay: 300 + i * 220, duration: 300 });
        this.time.delayedCall(300 + i * 220, () => SFX.uiTap());
        ui.add(t);
      });
      const hint = this.add.text(GAME_WIDTH / 2, 1000, '點擊繼續', { fontFamily: UI_FONT, fontSize: '26px', color: '#aab4dd' }).setOrigin(0.5);
      ui.add(hint);
      this.time.delayedCall(600 + lines.length * 220, () => {
        dim.once('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          ui.destroy();
          resolve();
        });
      });
    });
  }

  private onWake(outcome: string): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.ambientMusic(0.5);
    this.runner.resume(outcome);
    session.save();
    this.time.delayedCall(300, () => this.advance());
  }

  /** 序章保持寂靜（冷開場），其餘章節播放探索曲 */
  private ambientMusic(fade: number): void {
    if (this.scriptId === 'ch0') stopMusic(fade);
    else playMusic('explore', fade);
  }

  private async chapterCard(id: string): Promise<void> {
    const [a, b] = CHAPTER_TITLE[id] ?? [id, ''];
    this.tweens.add({ targets: this.box, alpha: 0, duration: 200 });
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1).setDepth(400).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 0.92, duration: 500 });
    playMusic('explore');
    await new Promise((r) => this.time.delayedCall(500, r));
    SFX.resonance();
    const t1 = this.add.text(GAME_WIDTH / 2, 560, a, { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5).setDepth(401).setAlpha(0);
    const t2 = this.add.text(GAME_WIDTH / 2, 650, b, { fontFamily: TITLE_FONT, fontSize: '76px', fontStyle: '900', color: '#ffffff', stroke: '#1a0f08', strokeThickness: 8 })
      .setOrigin(0.5).setDepth(401).setAlpha(0);
    this.tweens.add({ targets: t1, alpha: 1, duration: 600 });
    this.tweens.add({ targets: t2, alpha: 1, y: 640, duration: 900, delay: 300, ease: 'Cubic.Out' });
    shockRing(this, GAME_WIDTH / 2, 620, 0xffd27a, 420, 1200, 6);
    await new Promise((r) => this.time.delayedCall(2600, r));
    this.tweens.add({ targets: [t1, t2, dim], alpha: 0, duration: 600 });
    await new Promise((r) => this.time.delayedCall(600, r));
  }

  private finish(): void {
    this.waiting = 'busy';
    session.save();
    fadeOutThen(this, 600, () => {
      const s = session.state;
      if (this.scriptId === 'ch0') s.location = { region: 'ch1', node: 'orphanage' };
      if ((this.scriptId === 'ch0' || this.scriptId === 'ch1') && !s.flags['ch1_complete']) this.scene.start('Map');
      else {
        if (s.flags['ch1_complete']) session.setScriptPos('map', 'ch1');
        session.save();
        this.scene.start('Title');
      }
    });
  }
}
