// 節點地圖（07 §2）：依目前章節（src/data/maps.ts）顯示。點地點 → 確認 → 提燈標記沿路徑移動 → 進入該地點的劇本入口。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { playMusic } from '../../audio/music';
import { check } from '../../core/state/gameState';
import { CHAPTER_MAPS, currentChapter, type ChapterMap } from '../../data/maps';
import { HEROES } from '../../data/combatants';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { generateCombatantArt } from '../art/silhouettes';
import { TITLE_FONT, UI_FONT, pressBounce, shockRing, sparks, fadeOutThen } from '../fx/feel';
import { openSettings } from '../ui/settingsPanel';
import { HERO_COLOR, openParty } from '../ui/partyPanel';
import { drawMapCh2, drawMapCh3, drawMapCh4, drawMapCh5 } from '../art/mapArt';
import { session } from '../session';

type NodeState = 'locked' | 'open' | 'done';
const ENDING_NAME: Record<string, string> = { light: '燈火長明', crown: '新的大司星', dream: '餘燼之夢' };

export class MapScene extends Phaser.Scene {
  private token!: Phaser.GameObjects.Container;
  private busy = false;
  private bubble?: Phaser.GameObjects.Container;
  private map!: ChapterMap;

  constructor() {
    super('Map');
  }

  create(): void {
    this.busy = false;
    this.bubble = undefined;
    const st = session.state;
    const map = (this.map = CHAPTER_MAPS[currentChapter(st.flags)]);
    session.setScriptPos('map', map.id);
    session.save();
    generateCombatantArt(this);
    this.drawBackground();
    const states: Record<string, NodeState> = {};
    for (const e of map.entries) {
      const open = !e.requires || check(st, e.requires);
      const doneFlag = map.done[e.location];
      states[e.location] = !open ? 'locked' : doneFlag && st.flags[doneFlag] ? 'done' : 'open';
    }
    // 路徑
    const g = this.add.graphics();
    for (const [a, b] of map.edges) {
      const pa = map.pos[a];
      const pb = map.pos[b];
      if (!pa || !pb) continue;
      const lit = states[a] !== 'locked' && states[b] !== 'locked';
      const n = Math.ceil(Phaser.Math.Distance.Between(pa[0], pa[1], pb[0], pb[1]) / 18);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        g.fillStyle(lit ? 0xffd27a : 0x3a4060, lit ? 0.75 : 0.5);
        g.fillCircle(pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, lit ? 3.5 : 2.5);
      }
    }
    // 節點
    for (const e of map.entries) {
      const p = map.pos[e.location];
      if (!p) continue;
      this.makeNode(e.node, e.location, e.title, p[0], p[1], states[e.location] ?? 'locked');
    }
    // 提燈標記（玩家位置）
    const at = (st.location.region === map.id ? map.pos[st.location.node] : undefined) ?? map.pos[map.start]!;
    this.token = this.add.container(at[0], at[1] - 108).setDepth(50);
    const glow = this.add.image(0, 0, 'glow').setScale(0.7).setTint(0xffa54a).setBlendMode(Phaser.BlendModes.ADD);
    const lamp = this.add.image(0, 0, 'lamp_icon').setScale(1.3);
    this.token.add([glow, lamp]);
    this.tweens.add({ targets: this.token, y: this.token.y - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: glow, alpha: 0.6, duration: 170, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });

    this.drawHud(states);
    const gear = this.add.text(44, 70, '⚙', { fontFamily: UI_FONT, fontSize: '44px', color: '#c8d0f0', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(800).setPadding(12, 12, 12, 12).setInteractive({ useHandCursor: true });
    gear.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (this.busy) return;
      this.busy = true;
      SFX.uiTap();
      void openSettings(this).then(() => {
        this.busy = false;
      });
    });
    playMusic('explore');
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.closeBubble();
    });
  }

  private drawBackground(): void {
    const map = this.map;
    const key = `bg_map_${map.id}`;
    if (map.id !== 'ch1' && !this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
      if (tex) {
        const c = tex.getContext();
        if (map.id === 'ch5') drawMapCh5(c, GAME_WIDTH, GAME_HEIGHT);
        else if (map.id === 'ch4') drawMapCh4(c, GAME_WIDTH, GAME_HEIGHT);
        else if (map.id === 'ch3') drawMapCh3(c, GAME_WIDTH, GAME_HEIGHT);
        else drawMapCh2(c, GAME_WIDTH, GAME_HEIGHT);
        tex.refresh();
      }
    }
    if (map.id === 'ch1' && !this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
      if (tex) {
        const c = tex.getContext();
        const bg = c.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        bg.addColorStop(0, '#120e18');
        bg.addColorStop(0.36, '#1a1420');
        bg.addColorStop(0.42, '#0b161a');
        bg.addColorStop(1, '#050a0c');
        c.fillStyle = bg;
        c.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        // 鎮子的暖光
        const town = c.createRadialGradient(360, 330, 20, 360, 330, 330);
        town.addColorStop(0, 'rgba(255,165,74,0.22)');
        town.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = town;
        c.fillRect(0, 100, GAME_WIDTH, 500);
        // 森林：小松樹點綴
        let seed = 11;
        const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 140; i++) {
          const x = r() * GAME_WIDTH;
          const y = 540 + r() * 620;
          const h = 18 + r() * 26;
          c.fillStyle = `rgba(${20 + r() * 20},${50 + r() * 30},${50 + r() * 30},${0.5 + r() * 0.4})`;
          c.beginPath();
          c.moveTo(x, y - h);
          c.lineTo(x + h * 0.4, y);
          c.lineTo(x - h * 0.4, y);
          c.fill();
        }
        // 湖
        const lake = c.createRadialGradient(145, 715, 10, 145, 715, 120);
        lake.addColorStop(0, 'rgba(120,200,255,0.35)');
        lake.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = lake;
        c.fillRect(0, 580, 300, 280);
        // 鎮的屋頂剪影
        c.fillStyle = 'rgba(40,30,40,0.9)';
        for (let x = 40; x < 700; x += 70) {
          const y = 240 + Math.sin(x) * 10;
          c.beginPath();
          c.moveTo(x, y + 30);
          c.lineTo(x + 30, y);
          c.lineTo(x + 60, y + 30);
          c.fill();
          c.fillRect(x + 6, y + 30, 48, 30);
          c.fillStyle = 'rgba(255,190,110,0.6)';
          c.fillRect(x + 24, y + 38, 8, 10);
          c.fillStyle = 'rgba(40,30,40,0.9)';
        }
        tex.refresh();
      }
    }
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-10);
    for (const l of map.labels) {
      this.add.text(l.x, l.y, l.text, { fontFamily: TITLE_FONT, fontSize: '30px', color: l.color }).setAlpha(0.6);
    }
    this.add.particles(0, 0, 'ember', {
      x: { min: 0, max: GAME_WIDTH }, y: { min: 550, max: 1150 }, lifespan: { min: 3000, max: 6000 },
      speedY: { min: -12, max: -3 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.8, end: 0 }, frequency: 300,
      tint: 0xd8ffa0, blendMode: Phaser.BlendModes.ADD,
    });
  }

  private makeNode(node: string, loc: string, title: string, x: number, y: number, state: NodeState): void {
    const c = this.add.container(x, y).setDepth(20);
    const col = state === 'locked' ? 0x3a4060 : state === 'done' ? 0x9fb0d8 : 0xffd27a;
    if (state === 'open') {
      const halo = this.add.image(0, 0, 'glow').setScale(0.9).setTint(0xffa54a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
      this.tweens.add({ targets: halo, scale: 1.1, alpha: 0.4, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      c.add(halo);
    }
    const g = this.add.graphics();
    g.fillStyle(0x0a0d1a, 0.95).fillCircle(0, 0, 40);
    g.lineStyle(4, col, 1).strokeCircle(0, 0, 40);
    g.fillStyle(col, state === 'locked' ? 0.3 : 0.9).fillCircle(0, 0, 14);
    const label = this.add.text(0, 58, state === 'locked' ? '？？？' : title, {
      fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: state === 'locked' ? '#5a6380' : '#ffffff',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);
    c.add([g, label]);
    if (state === 'open' && this.map.done[loc]) {
      const bang = this.add.text(0, -62, '！', {
        fontFamily: UI_FONT, fontSize: '38px', fontStyle: '900', color: '#ffd27a', stroke: '#000', strokeThickness: 6,
      }).setOrigin(0.5);
      this.tweens.add({ targets: bang, y: -74, duration: 420, yoyo: true, repeat: -1, ease: 'Quad.Out' });
      c.add(bang);
    }
    c.setSize(110, 110).setInteractive({ useHandCursor: state !== 'locked' });
    c.on('pointerdown', () => {
      if (this.busy) return;
      if (state === 'locked') {
        SFX.uiCancel();
        this.tweens.add({ targets: c, x: x + 6, duration: 50, yoyo: true, repeat: 2 });
        return;
      }
      pressBounce(this, c);
      SFX.uiTap();
      this.openBubble(node, loc, title, x, y);
    });
  }

  private openBubble(node: string, loc: string, title: string, x: number, y: number): void {
    this.closeBubble();
    const bx = Phaser.Math.Clamp(x, 190, GAME_WIDTH - 190);
    const by = y < 300 ? y + 150 : y - 130;
    const b = this.add.container(bx, by).setDepth(100);
    const g = this.add.graphics();
    g.fillStyle(0x070912, 0.96).fillRoundedRect(-170, -55, 340, 110, 20);
    g.lineStyle(2, 0xffd27a, 1).strokeRoundedRect(-170, -55, 340, 110, 20);
    const danger = ['forest_edge', 'wolf_path', 'wolf_den', 'upper_tunnel', 'mid_tunnel', 'bell_hall', 'deep_level', 'bell_throat'].includes(loc);
    const t = this.add.text(0, -22, `前往 ${title}？`, { fontFamily: UI_FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);
    const sub = this.add.text(0, 6, danger ? '（可能遭遇魔物）' : '', { fontFamily: UI_FONT, fontSize: '18px', color: '#ff9a8a' }).setOrigin(0.5);
    const go = this.add.text(0, 34, '▶ 前往', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: '#ffd27a' }).setOrigin(0.5);
    b.add([g, t, sub, go]);
    b.setSize(340, 110).setInteractive({ useHandCursor: true });
    b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.confirm();
      void this.travel(node, loc, x, y);
    });
    b.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: b, scale: 1, alpha: 1, duration: 200, ease: 'Back.Out' });
    this.bubble = b;
  }

  private closeBubble(): void {
    const b = this.bubble;
    if (!b) return;
    this.bubble = undefined;
    this.tweens.add({ targets: b, alpha: 0, scale: 0.8, duration: 120, onComplete: () => b.destroy() });
  }

  private async travel(node: string, loc: string, x: number, y: number): Promise<void> {
    this.busy = true;
    this.closeBubble();
    this.tweens.killTweensOf(this.token);
    const d = Phaser.Math.Distance.Between(this.token.x, this.token.y, x, y - 108);
    await new Promise<void>((res) =>
      this.tweens.add({ targets: this.token, x, y: y - 108, duration: Math.min(900, 200 + d * 1.2), ease: 'Sine.easeInOut', onComplete: () => res() }),
    );
    sparks(this, x, y, 24, 'ember', undefined, 260);
    shockRing(this, x, y, 0xffd27a, 120, 400, 6);
    const s = session.state;
    const id = this.map.id;
    s.location = { region: id, node: loc };
    session.save();
    fadeOutThen(this, 400, () => {
      this.scene.start('Dialogue', { script: id, node, returnTo: 'Map' });
    });
  }

  private drawHud(states: Record<string, NodeState>): void {
    const s = session.state;
    const top = this.add.graphics().setDepth(90);
    top.fillStyle(0x05060c, 0.85).fillRect(0, 0, GAME_WIDTH, 190);
    top.lineStyle(2, 0xffd27a, 0.4).lineBetween(0, 190, GAME_WIDTH, 190);
    const map = this.map;
    this.add.text(GAME_WIDTH / 2, 70, map.title, { fontFamily: TITLE_FONT, fontSize: '36px', color: '#ffd27a' }).setOrigin(0.5).setDepth(91);
    const next = map.entries.find((e) => states[e.location] === 'open' && map.done[e.location] && !s.flags[map.done[e.location]!]);
    const wicks = ['wick_lake', 'wick_hunter', 'wick_shrine'].filter((f) => s.flags[f]).length;
    let goal = next ? `目標：前往「${next.title}」` : '目標：探索';
    if (map.id === 'ch1' && s.flags['ch1_met_bern'] && !s.flags['ch1_legacy']) goal += `　燈芯 ${wicks}/3`;
    if (map.id === 'ch5' && s.flags['ch5_complete']) goal = `全劇終・結局「${ENDING_NAME[String(s.flags['ending'])] ?? '？'}」`;
    this.add.text(GAME_WIDTH / 2, 140, goal, { fontFamily: UI_FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5).setDepth(91);
    const menu = this.add.text(GAME_WIDTH - 28, 70, '☰', { fontFamily: UI_FONT, fontSize: '40px', color: '#aab4dd' })
      .setOrigin(1, 0.5).setDepth(91).setInteractive({ useHandCursor: true });
    menu.on('pointerdown', () => {
      SFX.uiTap();
      session.save();
      this.scene.start('Title');
    });
    // 隊伍頭像（點擊開啟隊伍編成）
    const bar = this.add.graphics().setDepth(90);
    bar.fillStyle(0x05060c, 0.85).fillRect(0, 1140, GAME_WIDTH, 140);
    this.drawPartyBar();
  }

  private partyBar?: Phaser.GameObjects.Container;

  private drawPartyBar(): void {
    const s = session.state;
    this.partyBar?.destroy();
    const c = this.add.container(0, 0).setDepth(91);
    this.partyBar = c;
    const g = this.add.graphics();
    c.add(g);
    const bench = s.party.length > 3;
    const span = bench ? 200 : 230;
    s.party.slice(0, 3).forEach((m, i) => {
      const x = (bench ? 110 : 130) + i * span;
      const col = HERO_COLOR[m] ?? 0xffffff;
      const mem = s.members[m];
      g.fillStyle(0x0a0d1a, 1).fillCircle(x - 60, 1205, 34);
      g.lineStyle(3, col, 1).strokeCircle(x - 60, 1205, 34);
      c.add(this.add.text(x - 60, 1205, (HEROES[m]?.name ?? m).slice(0, 1), { fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5));
      c.add(this.add.text(x - 16, 1188, `${HEROES[m]?.name ?? m}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0, 0.5));
      c.add(this.add.text(x - 16, 1222, `Lv ${mem?.level ?? 1}`, { fontFamily: UI_FONT, fontSize: '20px', color: '#aab4dd' }).setOrigin(0, 0.5));
    });
    if (bench) {
      const bx = GAME_WIDTH - 74;
      g.fillStyle(0x1a2040, 1).fillRoundedRect(bx - 56, 1170, 112, 70, 16);
      g.lineStyle(2, 0xffd27a, 0.8).strokeRoundedRect(bx - 56, 1170, 112, 70, 16);
      c.add(this.add.text(bx, 1192, '隊伍', { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#ffd27a' }).setOrigin(0.5));
      c.add(this.add.text(bx, 1220, `待命 ${s.party.length - 3}`, { fontFamily: UI_FONT, fontSize: '18px', color: '#aab4dd' }).setOrigin(0.5));
    }
    const hit = this.add.zone(GAME_WIDTH / 2, 1210, GAME_WIDTH, 140).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerdown', () => {
      if (this.busy || s.party.length < 2) return;
      this.busy = true;
      SFX.uiTap();
      this.closeBubble();
      void openParty(this).then(() => {
        this.busy = false;
        this.drawPartyBar();
      });
    });
  }
}
