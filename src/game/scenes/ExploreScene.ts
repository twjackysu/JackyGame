// 自由探索場景（docs/design/11-open-world.md E1）：俯視格子地圖、點擊尋路＋拖曳虛擬搖桿、鏡頭跟隨、同伴跟隨、
// NPC／門／寶箱／告示互動（跑現有 DialogueRunner 劇本節點）、城門出口。HUD 與面板在 ExploreHudScene（不跟鏡頭捲動）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { chapterTrack, playMusic } from '../../audio/music';
import {
  interact, markerOf, nextObjective, present, chestFlag, type AreaDef, type AreaEntity, type Marker,
} from '../../core/explore/area';
import {
  findPath, nearestWalkable, parseGrid, pathToAdjacent, slideMove, walkable, type Grid, type Pt,
} from '../../core/explore/grid';
import { applyEffects } from '../../core/state/gameState';
import { AREAS } from '../../data/areas';
import { generateCombatantArt } from '../art/silhouettes';
import { TILE, drawAreaGround, drawChest, drawChibi, drawSignBoard } from '../art/exploreArt';
import { UI_FONT, fadeOutThen, shockRing, sparks } from '../fx/feel';
import { highFx } from '../settings';
import { session, withNames } from '../session';
import type { ExploreHudScene } from './ExploreHudScene';

export interface ExploreData {
  area?: string;
  spawn?: string;
}

const SPEED = 230; // px/s
const FOOT_R = 12;
const MARK: Record<Marker, { t: string; col: string } | null> = {
  main: { t: '！', col: '#ffd27a' },
  side: { t: '？', col: '#7fd8ff' },
  shop: { t: '$', col: '#9fe8a0' },
  chat: { t: '…', col: '#d8dcf0' },
  none: null,
};

interface Actor {
  e: AreaEntity;
  tx: number;
  ty: number;
  home: Pt;
  obj?: Phaser.GameObjects.Container;
  img?: Phaser.GameObjects.Image;
  mark?: Phaser.GameObjects.Text;
  moving: boolean;
}

export class ExploreScene extends Phaser.Scene {
  area!: AreaDef;
  private grid!: Grid;
  private player!: Phaser.GameObjects.Container;
  private playerImg!: Phaser.GameObjects.Image;
  private followers: { c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image }[] = [];
  private trail: Pt[] = [];
  private path: Pt[] = [];
  private pending?: Actor;
  private actors: Actor[] = [];
  private stick: { sx: number; sy: number; vx: number; vy: number } | null = null;
  private down: { x: number; y: number; t: number } | null = null;
  /** 暫停移動與輸入（面板、對話泡泡、轉場） */
  busy = false;
  private leaving = false;
  private walkT = 0;
  private lastSave = 0;
  private bubble?: Phaser.GameObjects.Container;
  private onGate = false;

  constructor() {
    super('Explore');
  }

  init(data: ExploreData): void {
    const flags = session.state.flags;
    const id = data.area ?? (typeof flags['__ex_area'] === 'string' ? (flags['__ex_area'] as string) : 'greylamp');
    this.area = AREAS[id] ?? AREAS['greylamp']!;
    this.grid = parseGrid(this.area.rows, this.area.buildings);
    this.followers = [];
    this.trail = [];
    this.path = [];
    this.pending = undefined;
    this.actors = [];
    this.stick = null;
    this.down = null;
    this.busy = false;
    this.leaving = false;
    this.bubble = undefined;
    this.onGate = false;
    // 出生點：指定的 spawn ＞ 存檔座標（同一區域）＞ default
    let sp: Pt | undefined = data.spawn ? this.area.spawns[data.spawn] : undefined;
    if (!sp && flags['__ex_area'] === this.area.id && typeof flags['__ex_x'] === 'number' && typeof flags['__ex_y'] === 'number') {
      sp = { x: flags['__ex_x'] as number, y: flags['__ex_y'] as number };
    }
    this.spawnAt = sp ?? this.area.spawns['default']!;
  }

  private spawnAt: Pt = { x: 0, y: 0 };

  create(): void {
    const s = session.state;
    session.setScriptPos('explore', this.area.id);
    s.flags['__ex_area'] = this.area.id;
    s.location = { region: this.area.region, node: this.area.id };
    generateCombatantArt(this);
    this.buildTextures();
    const W = this.grid.w * TILE;
    const H = this.grid.h * TILE;
    this.add.image(0, 0, `ex_ground_${this.area.id}`).setOrigin(0, 0).setDepth(-100);
    this.addLights();
    // 實體
    for (const e of this.area.entities) {
      const a: Actor = { e, tx: e.x, ty: e.y, home: { x: e.x, y: e.y }, moving: false };
      this.actors.push(a);
      this.buildActor(a);
    }
    // 玩家與同伴
    const start = this.blockers().has(`${this.spawnAt.x},${this.spawnAt.y}`) || !walkable(this.grid, this.spawnAt.x, this.spawnAt.y)
      ? this.area.spawns['default']!
      : this.spawnAt;
    const px = start.x * TILE + TILE / 2;
    const py = start.y * TILE + TILE / 2;
    const party = s.party.filter((m) => m !== 'lian').slice(0, 3);
    party.forEach((m, i) => {
      const f = this.makeWalker(`hero_${m}`, 80);
      f.c.setPosition(px, py + (i + 1) * 4);
      this.followers.push(f);
    });
    const p = this.makeWalker('hero_lian', 92);
    this.player = p.c.setPosition(px, py);
    this.playerImg = p.img;
    // 提燈光圈（掌燈人）
    if (this.area.night) {
      const halo = this.add.image(0, -36, 'ex_glow').setScale(1.6).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD);
      this.player.addAt(halo, 0);
      this.tweens.add({ targets: halo, alpha: 0.22, duration: 220, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
    }
    for (let i = 0; i < 60; i++) this.trail.push({ x: px, y: py });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.player, true, 0.14, 0.14, 0, -40);
    cam.fadeIn(400, 0, 0, 0);
    this.refreshMarkers();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.time.addEvent({ delay: 2200, loop: true, callback: () => this.wanderTick() });

    this.scene.launch('ExploreHud', { area: this.area.id });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('ExploreHud');
      const w = window as unknown as { __explore?: unknown };
      if (w.__explore) delete w.__explore;
    });
    playMusic(chapterTrack(this.area.region));
    this.savePos(true);
    this.installDebug();
  }

  // ------------------------------------------------------------ 美術
  private buildTextures(): void {
    const key = `ex_ground_${this.area.id}`;
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, this.grid.w * TILE, this.grid.h * TILE);
      if (tex) {
        drawAreaGround(tex.getContext(), this.area, this.grid);
        tex.refresh();
      }
    }
    const canvasTex = (k: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): void => {
      if (this.textures.exists(k)) return;
      const t = this.textures.createCanvas(k, w, h);
      if (!t) return;
      draw(t.getContext());
      t.refresh();
    };
    canvasTex('ex_glow', 256, 256, (c) => {
      const g = c.createRadialGradient(128, 128, 4, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,230,180,1)');
      g.addColorStop(0.25, 'rgba(255,190,110,0.55)');
      g.addColorStop(0.6, 'rgba(255,150,70,0.15)');
      g.addColorStop(1, 'rgba(255,140,60,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
    });
    canvasTex('ex_chest', 48, 48, (c) => drawChest(c, false));
    canvasTex('ex_chest_open', 48, 48, (c) => drawChest(c, true));
    canvasTex('ex_sign', 48, 48, (c) => drawSignBoard(c));
    canvasTex('ex_shadow', 48, 16, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.beginPath();
      c.ellipse(24, 8, 22, 7, 0, 0, Math.PI * 2);
      c.fill();
    });
    for (const e of this.area.entities) {
      if (e.kind === 'npc' && e.look && !e.look.hero) {
        canvasTex(`ex_npc_${e.look.body}_${e.look.hair}`, 64, 96, (c) => drawChibi(c, e.look!.body, e.look!.hair));
      }
    }
  }

  private addLights(): void {
    const g = this.grid;
    const flicker = (img: Phaser.GameObjects.Image): void => {
      this.tweens.add({
        targets: img, alpha: img.alpha * 0.7, duration: 160 + Math.random() * 200, yoyo: true, repeat: -1,
        ease: 'Stepped', easeParams: [2], delay: Math.random() * 400,
      });
    };
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (g.tiles[y]![x] !== 'L') continue;
        const img = this.add.image(x * TILE + 24, y * TILE + 12, 'ex_glow').setScale(1.3).setAlpha(0.42)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(y * TILE + 60);
        flicker(img);
      }
    }
    for (const b of this.area.buildings) {
      if (!b.lit) continue;
      const img = this.add.image((b.x + b.w / 2) * TILE, (b.y + b.h) * TILE - 20, 'ex_glow').setScale(1.4)
        .setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(-50);
      flicker(img);
    }
    if (highFx()) {
      // 螢火蟲
      this.add.particles(0, 0, 'ember', {
        x: { min: 0, max: g.w * TILE }, y: { min: 0, max: g.h * TILE }, lifespan: { min: 2500, max: 5000 },
        speedX: { min: -10, max: 10 }, speedY: { min: -14, max: -2 }, scale: { start: 0.35, end: 0 },
        alpha: { start: 0.9, end: 0 }, frequency: 220, tint: 0xd8ffa0, blendMode: Phaser.BlendModes.ADD,
      }).setDepth(5000);
    }
  }

  private makeWalker(key: string, height: number): { c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image } {
    const c = this.add.container(0, 0);
    const sh = this.add.image(0, 0, 'ex_shadow').setScale(0.9);
    const img = this.add.image(0, 2, key).setOrigin(0.5, 1);
    const src = this.textures.get(key).getSourceImage() as { height: number };
    img.setScale(height / Math.max(1, src.height));
    c.add([sh, img]);
    return { c, img };
  }

  private buildActor(a: Actor): void {
    const e = a.e;
    const x = a.tx * TILE + TILE / 2;
    const y = a.ty * TILE + TILE / 2;
    const c = this.add.container(x, y).setDepth(y);
    a.obj = c;
    if (e.kind === 'npc') {
      if (e.look?.hero) {
        const w = this.makeWalker(`hero_${e.look.hero}`, 72);
        w.c.setPosition(0, 0);
        c.add(w.c);
        a.img = w.img;
      } else if (e.look) {
        const sh = this.add.image(0, 0, 'ex_shadow').setScale(0.8);
        const img = this.add.image(0, 6, `ex_npc_${e.look.body}_${e.look.hair}`).setOrigin(0.5, 1).setScale(0.78);
        c.add([sh, img]);
        a.img = img;
        this.tweens.add({ targets: img, scaleY: 0.8, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    } else if (e.kind === 'chest') {
      const open = !!session.state.flags[chestFlag(this.area.id, e.id)];
      a.img = this.add.image(0, -4, open ? 'ex_chest_open' : 'ex_chest');
      c.add(a.img);
      if (!open) {
        const gl = this.add.image(0, -10, 'glow').setScale(0.7).setTint(0xffd27a).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
        c.addAt(gl, 0);
        this.tweens.add({ targets: gl, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 });
      }
    } else if (e.kind === 'sign') {
      a.img = this.add.image(0, -4, 'ex_sign');
      c.add(a.img);
    }
    c.setVisible(present(session.state, e) || e.kind === 'door' || e.kind === 'gate');
  }

  /** 頭上標記依旗標刷新（劇本回來、寶箱開啟後） */
  refreshMarkers(): void {
    const s = session.state;
    for (const a of this.actors) {
      a.mark?.destroy();
      a.mark = undefined;
      if (!present(s, a.e)) continue;
      const m = MARK[markerOf(s, this.area.id, a.e)];
      if (!m || !a.obj) continue;
      const top = a.e.kind === 'npc' ? -78 : a.e.kind === 'door' ? -44 : a.e.kind === 'gate' ? -60 : -40;
      const t = this.add.text(0, top, m.t, {
        fontFamily: UI_FONT, fontSize: m.t === '…' ? '28px' : '34px', fontStyle: '900', color: m.col, stroke: '#000', strokeThickness: 6,
      }).setOrigin(0.5);
      a.obj.add(t);
      a.mark = t;
      if (m.t !== '…') this.tweens.add({ targets: t, y: top - 10, duration: 420, yoyo: true, repeat: -1, ease: 'Quad.Out' });
      else t.setAlpha(0.7);
    }
  }

  // ------------------------------------------------------------ 輸入
  private onDown(p: Phaser.Input.Pointer): void {
    if (this.busy || this.leaving) return;
    if (this.bubble) this.closeBubble();
    this.down = { x: p.x, y: p.y, t: this.time.now };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.down || !p.isDown || this.busy) return;
    const dx = p.x - this.down.x;
    const dy = p.y - this.down.y;
    if (!this.stick && Math.hypot(dx, dy) > 26) {
      this.stick = { sx: this.down.x, sy: this.down.y, vx: 0, vy: 0 };
      this.path = [];
      this.pending = undefined;
    }
    if (this.stick) {
      const len = Math.hypot(dx, dy);
      const k = Math.min(1, len / 90);
      this.stick.vx = len > 0 ? (dx / len) * k : 0;
      this.stick.vy = len > 0 ? (dy / len) * k : 0;
      this.hud()?.showStick(this.stick.sx, this.stick.sy, this.stick.vx, this.stick.vy);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const wasStick = !!this.stick;
    this.stick = null;
    this.hud()?.hideStick();
    const d = this.down;
    this.down = null;
    if (wasStick || !d || this.busy || this.leaving) return;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    this.tapTile(Math.floor(wp.x / TILE), Math.floor(wp.y / TILE), wp.x, wp.y);
  }

  /** 點某一格：有實體 → 走過去互動；否則尋路走到該格（不可走則找最近的可走格） */
  tapTile(tx: number, ty: number, wx?: number, wy?: number): void {
    const s = session.state;
    // NPC 圖比格子高：點在頭部也算
    const hit = this.actors.find((a) => {
      if (!present(s, a.e) && a.e.kind !== 'door' && a.e.kind !== 'gate') return false;
      if (a.tx === tx && a.ty === ty) return true;
      return a.e.kind === 'npc' && wx !== undefined && wy !== undefined && a.obj
        && Math.abs(wx - a.obj.x) < 26 && wy < a.obj.y && wy > a.obj.y - 80;
    });
    if (hit) {
      this.walkToActor(hit);
      return;
    }
    const goal = nearestWalkable(this.grid, { x: tx, y: ty }, this.blockers());
    if (!goal) return;
    const path = findPath(this.grid, this.playerTile(), goal, this.blockers());
    if (!path) return;
    this.path = path;
    this.pending = undefined;
    this.tapRing(goal.x * TILE + TILE / 2, goal.y * TILE + TILE / 2);
  }

  private tapRing(x: number, y: number): void {
    const r = this.add.circle(x, y, 14).setStrokeStyle(3, 0xffd27a, 0.9).setDepth(4000);
    this.tweens.add({ targets: r, scale: 1.8, alpha: 0, duration: 380, onComplete: () => r.destroy() });
  }

  walkToActor(a: Actor): boolean {
    const from = this.playerTile();
    if (a.e.kind === 'gate') {
      const p = findPath(this.grid, from, { x: a.tx, y: a.ty }, this.blockers());
      if (!p) return false;
      this.path = p;
      this.pending = undefined;
      return true;
    }
    if (Math.abs(from.x - a.tx) + Math.abs(from.y - a.ty) === 1) {
      this.path = [];
      this.pending = undefined;
      this.doInteract(a);
      return true;
    }
    const r = pathToAdjacent(this.grid, from, { x: a.tx, y: a.ty }, this.blockers());
    if (!r) return false;
    this.path = r.path;
    this.pending = a;
    this.tapRing(a.tx * TILE + TILE / 2, a.ty * TILE + TILE / 2);
    return true;
  }

  /** 互動提示按鈕（HUD）：玩家旁邊有可互動實體時 */
  nearbyActor(): Actor | undefined {
    const p = this.playerTile();
    const s = session.state;
    return this.actors.find((a) => {
      if (a.e.kind === 'gate') return false;
      if (!present(s, a.e) && a.e.kind !== 'door') return false;
      if (Math.abs(a.tx - p.x) + Math.abs(a.ty - p.y) !== 1) return false;
      const m = markerOf(s, this.area.id, a.e);
      return m !== 'none' || a.e.kind === 'chest' && !s.flags[chestFlag(this.area.id, a.e.id)] || a.e.kind === 'sign' || a.e.kind === 'door';
    });
  }

  actNearby(): void {
    const a = this.nearbyActor();
    if (a && !this.busy) this.doInteract(a);
  }

  // ------------------------------------------------------------ 互動
  private doInteract(a: Actor): void {
    const s = session.state;
    // 面向目標
    const dx = a.tx * TILE + TILE / 2 - this.player.x;
    if (Math.abs(dx) > 4) this.playerImg.setFlipX(dx < 0);
    if (a.img && a.e.kind === 'npc') a.img.setFlipX(this.player.x < (a.obj?.x ?? 0));
    const r = interact(s, this.area.id, a.e, Math.random());
    if (r.kind === 'script') {
      SFX.confirm();
      this.runScript(r.script, r.node, r.after);
    } else if (r.kind === 'say') {
      SFX.blip();
      this.say(a, `${a.e.name ? `${a.e.name}\n` : ''}${r.text}`);
    } else if (r.kind === 'loot') {
      applyEffects(s, r.effects);
      SFX.itemGet();
      a.img?.setTexture('ex_chest_open');
      a.obj?.list.filter((o) => o instanceof Phaser.GameObjects.Image && o.texture.key === 'glow').forEach((o) => o.destroy());
      if (a.obj) {
        sparks(this, a.obj.x, a.obj.y - 10, 22, 'ember', 0xffd27a, 260);
        shockRing(this, a.obj.x, a.obj.y, 0xffd27a, 80, 360, 4);
      }
      this.hud()?.toast(r.text);
      this.refreshMarkers();
      this.savePos(true);
    } else {
      if (a.e.kind === 'chest') this.hud()?.toast('空的。');
    }
  }

  private runScript(script: string, node: string, after?: 'map'): void {
    this.leaving = true;
    this.path = [];
    this.savePos(true);
    const s = session.state;
    s.flags['__return'] = after === 'map' ? 'Map' : 'Explore';
    session.save();
    fadeOutThen(this, 350, () => this.scene.start('Dialogue', { script, node, returnTo: after === 'map' ? 'Map' : 'Explore' }));
  }

  private say(a: Actor, text: string): void {
    this.closeBubble();
    if (!a.obj) return;
    const t = this.add.text(0, 0, withNames(text), {
      fontFamily: UI_FONT, fontSize: '22px', color: '#ffffff', wordWrap: { width: 420, useAdvancedWrap: true }, lineSpacing: 4,
    }).setOrigin(0.5, 1);
    const w = Math.max(160, t.width + 36);
    const h = t.height + 28;
    const g = this.add.graphics();
    g.fillStyle(0x070912, 0.94).fillRoundedRect(-w / 2, -h, w, h, 16);
    g.lineStyle(2, 0xffd27a, 0.9).strokeRoundedRect(-w / 2, -h, w, h, 16);
    g.fillStyle(0x070912, 0.94).fillTriangle(-10, 0, 10, 0, 0, 12);
    t.setPosition(0, -14);
    const top = a.e.kind === 'npc' ? 90 : 50;
    const bx = Phaser.Math.Clamp(a.obj.x, w / 2 + 8, this.grid.w * TILE - w / 2 - 8);
    const b = this.add.container(bx, a.obj.y - top, [g, t]).setDepth(6000).setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: b, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
    this.bubble = b;
    this.time.delayedCall(3600, () => {
      if (this.bubble === b) this.closeBubble();
    });
  }

  private closeBubble(): void {
    const b = this.bubble;
    if (!b) return;
    this.bubble = undefined;
    this.tweens.add({ targets: b, alpha: 0, duration: 120, onComplete: () => b.destroy() });
  }

  /** 踩到城門 */
  private enterGate(a: Actor): void {
    const s = session.state;
    if (a.e.done && s.flags[a.e.done]) {
      // 已出過鎮：直接回世界地圖
      this.leaveToMap();
      return;
    }
    const r = interact(s, this.area.id, a.e);
    if (r.kind === 'script') {
      this.runScript(r.script, r.node, r.after);
      return;
    }
    if (r.kind === 'say') {
      SFX.uiCancel();
      const guard = this.actors.find((x) => x.e.id === 'guard') ?? a;
      this.say(guard, r.text);
      // 被擋回去
      const back = findPath(this.grid, this.playerTile(), { x: a.tx, y: a.ty - 2 }, this.blockers());
      if (back) this.path = back;
    }
  }

  leaveToMap(): void {
    if (this.leaving) return;
    this.leaving = true;
    SFX.confirm();
    const s = session.state;
    s.flags['__ex_x'] = this.area.spawns['gate']?.x ?? this.area.spawns['default']!.x;
    s.flags['__ex_y'] = this.area.spawns['gate']?.y ?? this.area.spawns['default']!.y;
    s.location = { region: this.area.region, node: 'town_gate' };
    session.setScriptPos('map', this.area.region);
    session.save();
    fadeOutThen(this, 400, () => this.scene.start('Map'));
  }

  // ------------------------------------------------------------ 更新
  update(_t: number, dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    let moved = false;
    if (!this.busy && !this.leaving) {
      if (this.stick && (this.stick.vx !== 0 || this.stick.vy !== 0)) {
        const n = slideMove(this.grid, this.player.x, this.player.y, this.stick.vx * SPEED * dt, this.stick.vy * SPEED * dt, TILE, FOOT_R, this.blockers());
        moved = n.x !== this.player.x || n.y !== this.player.y;
        if (Math.abs(this.stick.vx) > 0.15) this.playerImg.setFlipX(this.stick.vx < 0);
        this.player.setPosition(n.x, n.y);
      } else if (this.path.length > 0) {
        const nx = this.path[0]!;
        const tx = nx.x * TILE + TILE / 2;
        const ty = nx.y * TILE + TILE / 2;
        const dx = tx - this.player.x;
        const dy = ty - this.player.y;
        const d = Math.hypot(dx, dy);
        const step = SPEED * dt;
        if (Math.abs(dx) > 2) this.playerImg.setFlipX(dx < 0);
        if (d <= step) {
          this.player.setPosition(tx, ty);
          this.path.shift();
          if (this.path.length === 0 && this.pending) {
            const a = this.pending;
            this.pending = undefined;
            this.doInteract(a);
          }
        } else {
          this.player.x += (dx / d) * step;
          this.player.y += (dy / d) * step;
        }
        moved = true;
      }
    }
    // 走路彈跳
    if (moved) {
      this.walkT += dt * 14;
      this.playerImg.y = 2 - Math.abs(Math.sin(this.walkT)) * 6;
      this.playerImg.angle = Math.sin(this.walkT) * 3;
      const last = this.trail[this.trail.length - 1]!;
      if (Math.hypot(last.x - this.player.x, last.y - this.player.y) >= 4) {
        this.trail.push({ x: this.player.x, y: this.player.y });
        if (this.trail.length > 80) this.trail.shift();
      }
    } else {
      this.playerImg.y = 2;
      this.playerImg.angle = 0;
    }
    this.player.setDepth(this.player.y);
    this.followers.forEach((f, i) => {
      const tgt = this.trail[Math.max(0, this.trail.length - 1 - (i + 1) * 11)]!;
      const dx = tgt.x - f.c.x;
      const dy = tgt.y - f.c.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        const k = Math.min(1, dt * 10);
        f.c.x += dx * k;
        f.c.y += dy * k;
        if (Math.abs(dx) > 1) f.img.setFlipX(dx < 0);
        f.img.y = 2 - Math.abs(Math.sin(this.walkT + i + 1)) * (d > 3 ? 5 : 0);
      } else f.img.y = 2;
      f.c.setDepth(f.c.y);
    });
    // 城門
    const pt = this.playerTile();
    const gate = this.actors.find((a) => a.e.kind === 'gate' && a.tx === pt.x && a.ty === pt.y)
      ?? this.actors.find((a) => a.e.kind === 'gate' && a.ty === pt.y && Math.abs(a.tx - pt.x) <= 1 && this.grid.tiles[pt.y]![pt.x] === 'G');
    if (gate && !this.onGate && !this.leaving && !this.busy) {
      this.onGate = true;
      this.path = [];
      this.stick = null;
      this.hud()?.hideStick();
      this.enterGate(gate);
    } else if (!gate) this.onGate = false;
    if (moved && this.time.now - this.lastSave > 1500) this.savePos(false);
    this.hud()?.setAct(this.nearbyActor()?.e.name ?? null);
  }

  // ------------------------------------------------------------ NPC 閒晃
  private wanderTick(): void {
    if (this.busy || this.leaving) return;
    const pt = this.playerTile();
    for (const a of this.actors) {
      const r = a.e.wander ?? 0;
      if (r <= 0 || a.moving || !a.obj || Math.random() < 0.5) continue;
      if (this.bubble && this.bubble.x === a.obj.x) continue;
      const dirs: Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      const d = dirs[Math.floor(Math.random() * 4)]!;
      const nx = a.tx + d.x;
      const ny = a.ty + d.y;
      if (Math.abs(nx - a.home.x) > r || Math.abs(ny - a.home.y) > r) continue;
      if (nx === pt.x && ny === pt.y) continue;
      if (!walkable(this.grid, nx, ny, this.blockers())) continue;
      if (this.path.some((p) => p.x === nx && p.y === ny)) continue;
      a.tx = nx;
      a.ty = ny;
      a.moving = true;
      if (d.x !== 0) a.img?.setFlipX(d.x < 0);
      this.tweens.add({
        targets: a.obj, x: nx * TILE + TILE / 2, y: ny * TILE + TILE / 2, duration: 520, ease: 'Sine.easeInOut',
        onUpdate: () => a.obj?.setDepth(a.obj.y),
        onComplete: () => {
          a.moving = false;
        },
      });
    }
  }

  // ------------------------------------------------------------ 工具
  playerTile(): Pt {
    return { x: Math.floor(this.player.x / TILE), y: Math.floor(this.player.y / TILE) };
  }

  private blockers(): Set<string> {
    const s = session.state;
    const b = new Set<string>();
    for (const a of this.actors) {
      if (a.e.kind === 'gate' || a.e.kind === 'door') continue;
      if (!present(s, a.e)) continue;
      b.add(`${a.tx},${a.ty}`);
    }
    return b;
  }

  private savePos(force: boolean): void {
    this.lastSave = this.time.now;
    const s = session.state;
    const p = this.playerTile();
    s.flags['__ex_area'] = this.area.id;
    s.flags['__ex_x'] = p.x;
    s.flags['__ex_y'] = p.y;
    if (force || this.time.now - this.lastSave >= 0) session.save();
  }

  private hud(): ExploreHudScene | undefined {
    const h = this.scene.get('ExploreHud') as ExploreHudScene | undefined;
    return h && this.scene.isActive('ExploreHud') ? h : undefined;
  }

  objective(): AreaEntity | undefined {
    return nextObjective(session.state, this.area);
  }

  private installDebug(): void {
    if (!new URLSearchParams(location.search).has('debug')) return;
    (window as unknown as { __explore: unknown }).__explore = {
      area: this.area.id,
      pos: () => this.playerTile(),
      objective: () => this.objective()?.id,
      entities: () => this.actors.map((a) => ({ id: a.e.id, x: a.tx, y: a.ty, marker: markerOf(session.state, this.area.id, a.e) })),
      /** 走到實體並互動（城門：走上去） */
      goto: (id: string) => {
        const a = this.actors.find((x) => x.e.id === id);
        return !!a && !this.busy && !this.leaving && this.walkToActor(a);
      },
      tap: (x: number, y: number) => this.tapTile(x, y),
      busy: () => this.busy || this.leaving || this.path.length > 0,
    };
  }
}

