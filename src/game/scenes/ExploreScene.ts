// 自由探索場景（docs/design/11-open-world.md E1）：俯視格子地圖、點擊尋路＋拖曳虛擬搖桿、鏡頭跟隨、同伴跟隨、
// NPC／門／寶箱／告示互動（跑現有 DialogueRunner 劇本節點）、城門出口。HUD 與面板在 ExploreHudScene（不跟鏡頭捲動）。
import Phaser from 'phaser';
import { mulberry32 } from '../../core/rng';
import { SFX } from '../../audio/sfx';
import { chapterTrack, playMusic } from '../../audio/music';
import {
  interact, markerOf, outleveled, nextObjective, present, chestFlag, lampFlag, solidRects, type AreaDef, type AreaEntity, type Marker,
} from '../../core/explore/area';
import {
  findPath, nearestWalkable, parseGrid, pathToAdjacent, slideMove, walkable, type Grid, type Pt,
} from '../../core/explore/grid';
import { applyEffects, check, type CompanionId, type Condition, type MemberId } from '../../core/state/gameState';
import { AREAS } from '../../data/areas';
import { ENCOUNTERS, ENEMIES } from '../../data/combatants';
import { currentChapter } from '../../data/maps';
import { banterFor } from '../../data/banter';
import { HERO_COLOR } from '../ui/partyPanel';
import type { BattleSceneData } from './BattleScene';
import { generateCombatantArt } from '../art/silhouettes';
import { TILE, drawAreaGround, drawChest, drawChibi, drawSignBoard } from '../art/exploreArt';
import { UI_FONT, fadeOutThen, shockRing, sparks } from '../fx/feel';
import { highFx } from '../settings';
import { session, withNames } from '../session';
import { battleParty } from '../../core/state/equip';
import { ITEM_DEFS } from '../../data/equipment';
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
  heart: { t: '♥', col: '#ff8ab0' },
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

/** 已打倒的明雷敵人（區域 → id）。從出口或世界地圖進入區域時清空＝重生；劇本／戰鬥回來則保留。 */
const DEFEATED = new Map<string, Set<string>>();

/** 支線中跟著隊伍走的 NPC */
const ESCORTS: { id: string; body: string; hair: string; art?: string; when: Condition }[] = [
  { id: 'mia', body: '#c84040', hair: '#7a4a2a', art: 'walk_npc_mia', when: { all: [{ flag: 'q_lost_kid_found' }, { flag: 'q_lost_kid_done', not: true }] } },
];

export class ExploreScene extends Phaser.Scene {
  area!: AreaDef;
  private grid!: Grid;
  private player!: Phaser.GameObjects.Container;
  private playerImg!: Phaser.GameObjects.Image;
  private followers: { c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; id?: MemberId }[] = [];
  private trail: Pt[] = [];
  /** 純外觀用亂數（NPC 閒晃、閒聊、燈光閃爍）：每次進場由 session 的 'ui' stream 取種子 */
  private fx: () => number = mulberry32(1);
  private escorts = new Map<string, { c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image }>();
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
    if (data.area) DEFEATED.set(this.area.id, new Set());
    this.chasing = new Set();
    this.lampGlow = new Map();
    this.lampPost = new Map();
    this.grid = parseGrid(this.area.rows, solidRects(this.area));
    this.followers = [];
    this.trail = [];
    this.escorts = new Map();
    this.fleeing = new Set();
    this.lastBanter = 0;
    this.path = [];
    this.pending = undefined;
    this.actors = [];
    this.hiddenLeft = new Set();
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
  private chasing = new Set<string>();
  private lampGlow = new Map<string, Phaser.GameObjects.Image>();
  private lampPost = new Map<string, Phaser.GameObjects.Image>();

  /** 是否在營火旁（4 格內）——技能樹免費重置用 */
  nearRest(): boolean {
    if (!this.player) return false;
    const px = this.player.x / TILE - 0.5;
    const py = this.player.y / TILE - 0.5;
    return this.actors.some((a) => !!a.e.rest && Math.hypot(a.tx - px, a.ty - py) <= 4);
  }

    /** 還沒現形的隱藏寶箱 id */
  private hiddenLeft = new Set<string>();
  private isHidden(a: Actor): boolean {
    return this.hiddenLeft.has(a.e.id);
  }

  /** 走近隱藏寶箱（2 格內）→ 現形 */
  private revealHidden(): void {
    if (this.hiddenLeft.size === 0) return;
    const px = this.player.x / TILE - 0.5;
    const py = this.player.y / TILE - 0.5;
    for (const a of this.actors) {
      if (!this.isHidden(a) || Math.hypot(a.tx - px, a.ty - py) > 2.2) continue;
      this.hiddenLeft.delete(a.e.id);
      if (a.obj) {
        this.tweens.add({ targets: a.obj, alpha: 1, duration: 500 });
        sparks(this, a.obj.x, a.obj.y - 10, 30, 'spark', 0x9fe0ff, 400);
        shockRing(this, a.obj.x, a.obj.y - 6, 0x9fe0ff, 70, 500, 4);
      }
      SFX.itemGet();
      this.hud()?.toast('✦ 發現了隱藏的寶箱！', 2000);
    }
  }

  private defeated(): Set<string> {
    let d = DEFEATED.get(this.area.id);
    if (!d) DEFEATED.set(this.area.id, (d = new Set()));
    return d;
  }

  private alive(a: Actor): boolean {
    return a.e.kind !== 'enemy' || (!this.defeated().has(a.e.id) && present(session.state, a.e));
  }

  create(): void {
    this.fx = mulberry32(session.seed('ui'));
    const s = session.state;
    session.setScriptPos('explore', this.area.id);
    s.flags['__ex_area'] = this.area.id;
    s.location = { region: this.area.region, node: this.area.id };
    generateCombatantArt(this);
    this.buildTextures();
    const W = this.grid.w * TILE;
    const H = this.grid.h * TILE;
    this.add.image(0, 0, `ex_ground_${this.area.id}`).setOrigin(0, 0).setDepth(-100);
    this.addProps();
    this.addLights();
    // 實體
    for (const e of this.area.entities) {
      const a: Actor = { e, tx: e.x, ty: e.y, home: { x: e.x, y: e.y }, moving: false };
      if (!this.alive(a)) continue;
      this.actors.push(a);
      this.buildActor(a);
    }
    // 玩家與同伴
    const start = this.blockers().has(`${this.spawnAt.x},${this.spawnAt.y}`) || !walkable(this.grid, this.spawnAt.x, this.spawnAt.y)
      ? this.area.spawns['default']!
      : this.spawnAt;
    const px = start.x * TILE + TILE / 2;
    const py = start.y * TILE + TILE / 2;
    // 約會事件的同伴站在地圖上等你 → 不跟在隊伍後面（避免出現兩個人）
    const waiting = new Set(this.area.entities.filter((e) => e.date && present(s, e)).map((e) => e.look?.hero));
    const party = s.party.filter((m) => m !== 'lian' && !waiting.has(m)).slice(0, 3);
    party.forEach((m, i) => {
      const f: { c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; id?: MemberId } = this.makeWalker(`hero_${m}`, 80);
      f.id = m;
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
    // 上方留 HUD 高度，地圖最上面一排也能捲到 HUD 下方看見
    cam.setBounds(0, -300, W, H + 300);
    cam.setBackgroundColor('#081008');
    cam.startFollow(this.player, true, 0.14, 0.14, 0, -40);
    cam.fadeIn(400, 0, 0, 0);
    this.refreshMarkers();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.time.addEvent({ delay: 2200, loop: true, callback: () => this.wanderTick() });
    this.time.addEvent({ delay: 9000, loop: true, callback: () => this.banterTick() });
    this.time.addEvent({ delay: 420, loop: true, callback: () => this.enemyTick() });
    this.events.off(Phaser.Scenes.Events.WAKE);
    this.events.on(Phaser.Scenes.Events.WAKE, (_: unknown, d?: { outcome?: string }) => this.onBattleEnd(d?.outcome ?? 'win'));

    this.scene.launch('ExploreHud', { area: this.area.id });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.WAKE);
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
        drawAreaGround(tex.getContext(), this.area, this.grid, (k) => this.textures.exists(k));
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
    // 跟著隊伍走的 NPC（支線護送）
    for (const f of ESCORTS) canvasTex(`ex_npc_${f.body}_${f.hair}`, 64, 96, (c) => drawChibi(c, f.body, f.hair));
  }

  /** AI 美術物件（建築、樹、路燈、井）：圖片精靈，依腳底 y 排序，角色可以走到後面 */
  private addProps(): void {
    const has = (k: string): boolean => this.textures.exists(k);
    const fit = (img: Phaser.GameObjects.Image, w?: number, h?: number): Phaser.GameObjects.Image =>
      img.setScale(w ? w / img.width : (h ?? 48) / img.height);
    for (const b of this.area.buildings) {
      if (!b.prop || !has(b.prop)) continue;
      const bottom = (b.y + b.h) * TILE;
      const img = this.add.image((b.x + b.w / 2) * TILE, bottom + 6, b.prop).setOrigin(0.5, 1);
      fit(img, b.w * TILE * 1.15).setDepth(bottom);
      if (this.area.night) img.setTint(0xb8b8d8);
      if (b.sign) {
        const t = this.add.text((b.x + b.w / 2) * TILE, bottom - img.displayHeight + 18, b.sign, {
          fontFamily: UI_FONT, fontSize: '18px', fontStyle: '700', color: '#ffe2a8', backgroundColor: '#2a1a10cc', padding: { x: 8, y: 3 },
        }).setOrigin(0.5, 0).setDepth(bottom + 1);
        void t;
      }
    }
    const g = this.grid;
    let seed = 7;
    const r = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const t = g.tiles[y]![x];
        const cx = x * TILE + TILE / 2;
        const foot = y * TILE + 44;
        if (t === 'T' && has('prop_tree_a')) {
          const key = has('prop_tree_b') && r() < 0.4 ? 'prop_tree_b' : 'prop_tree_a';
          const img = this.add.image(cx + (r() - 0.5) * 10, foot, key).setOrigin(0.5, 1).setDepth(foot);
          fit(img, undefined, (key === 'prop_tree_a' ? 96 : 80) * (0.9 + r() * 0.25));
          if (r() < 0.5) img.setFlipX(true);
          if (this.area.night) img.setTint(0x9aa0c8);
        } else if (t === 'L' && has('prop_lamppost')) {
          const post = fit(this.add.image(cx, foot, 'prop_lamppost').setOrigin(0.5, 1).setDepth(foot), undefined, 112);
          // 支線用的熄滅路燈：整支壓暗，點亮後恢復
          const lamp = this.area.entities.find((e) => e.kind === 'lamp' && e.x === x && e.y === y);
          if (lamp) {
            this.lampPost.set(lamp.id, post);
            if (!session.state.flags[lampFlag(this.area.id, lamp.id)]) post.setTint(0x3a3a48);
          }
        } else if (t === 'o' && this.area.region === 'ch3' && g.tiles[y]![x - 1] !== 'o') {
          this.fountain(g.tiles[y]![x + 1] === 'o' ? cx + TILE / 2 : cx, foot);
        } else if (t === 'o' && has('prop_well') && g.tiles[y]![x - 1] !== 'o') {
          const two = g.tiles[y]![x + 1] === 'o';
          fit(this.add.image(two ? cx + TILE / 2 : cx, foot + 4, 'prop_well').setOrigin(0.5, 1).setDepth(foot), (two ? 2 : 1) * TILE * 0.95);
        }
      }
    }
  }

  /** 王都廣場的噴水池（程式畫＋水花粒子） */
  private fountain(cx: number, foot: number): void {
    const g = this.add.graphics().setDepth(foot);
    const by = foot - 10;
    g.fillStyle(0x000000, 0.35).fillEllipse(cx, by + 8, 96, 26);
    g.fillStyle(0x8a8494, 1).fillEllipse(cx, by, 92, 34);
    g.fillStyle(0x2a5a7a, 1).fillEllipse(cx, by - 3, 76, 24);
    g.fillStyle(0x6ab8e0, 0.5).fillEllipse(cx - 8, by - 6, 40, 10);
    g.fillStyle(0xa8a2b4, 1).fillRect(cx - 6, by - 40, 12, 36);
    g.fillStyle(0x9a94a6, 1).fillEllipse(cx, by - 40, 34, 10);
    g.fillStyle(0x6ab8e0, 0.8).fillEllipse(cx, by - 42, 24, 6);
    this.add.particles(cx, by - 44, 'ex_glow', {
      lifespan: { min: 600, max: 900 }, speedY: { min: -90, max: -60 }, speedX: { min: -34, max: 34 }, gravityY: 220,
      scale: { start: 0.09, end: 0.03 }, alpha: { start: 0.9, end: 0.1 }, tint: [0xcfefff, 0x9fdcff, 0xffffff],
      frequency: highFx() ? 40 : 110, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(foot + 1);
  }

  private addLights(): void {
    const g = this.grid;
    const flicker = (img: Phaser.GameObjects.Image): void => {
      this.tweens.add({
        targets: img, alpha: img.alpha * 0.7, duration: 160 + this.fx() * 200, yoyo: true, repeat: -1,
        ease: 'Stepped', easeParams: [2], delay: this.fx() * 400,
      });
    };
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (g.tiles[y]![x] !== 'L') continue;
        const art = this.textures.exists('prop_lamppost');
        const lamp = this.area.entities.find((e) => e.kind === 'lamp' && e.x === x && e.y === y);
        const img = this.add.image(x * TILE + (art ? 4 : 24), y * TILE + (art ? -32 : 12), 'ex_glow').setScale(1.3).setAlpha(0.42)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(y * TILE + 60);
        if (lamp) {
          this.lampGlow.set(lamp.id, img);
          if (!session.state.flags[lampFlag(this.area.id, lamp.id)]) {
            img.setAlpha(0.04);
            continue;
          }
        }
        flicker(img);
      }
    }
    // 礦晶：藍色呼吸光
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (g.tiles[y]![x] !== 'c') continue;
        const img = this.add.image(x * TILE + 24, y * TILE + 26, 'ex_glow').setScale(1.1).setAlpha(0.35).setTint(this.area.region === 'ch4' ? 0xc89aff : this.area.region === 'ch5' ? 0xffb0d8 : 0x7fe0ff)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(-40);
        this.tweens.add({ targets: img, alpha: 0.18, scale: 0.95, duration: 1400 + this.fx() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: this.fx() * 1000 });
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
    // 地圖用正面 Q 版（docs/ART_REQUESTS R-010：walk_<id>）有圖就用，沒有就用戰鬥背影圖
    const walk = key.replace(/^hero_/, 'walk_');
    if (this.textures.exists(walk)) key = walk;
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
      } else if (e.look?.art && this.textures.exists(e.look.art)) {
        const sh = this.add.image(0, 0, 'ex_shadow').setScale(0.8);
        const img = this.add.image(0, 6, e.look.art).setOrigin(0.5, 1);
        img.setScale(76 / img.height);
        c.add([sh, img]);
        a.img = img;
      } else if (e.look) {
        const sh = this.add.image(0, 0, 'ex_shadow').setScale(0.8);
        const img = this.add.image(0, 6, `ex_npc_${e.look.body}_${e.look.hair}`).setOrigin(0.5, 1).setScale(0.78);
        c.add([sh, img]);
        a.img = img;
        this.tweens.add({ targets: img, scaleY: 0.8, duration: 900 + this.fx() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    } else if (e.kind === 'door' && !this.area.buildings.some((b) => e.x >= b.x && e.x < b.x + b.w && e.y >= b.y && e.y < b.y + b.h)) {
      // 野外的劇情地點（湖畔等）：發光的光點
      const gl = this.add.image(0, 0, 'ex_glow').setScale(0.7).setAlpha(0.55).setTint(e.glow ?? 0x9fe8ff).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.image(0, 0, 'ex_glow').setScale(0.18).setTint(0xdff8ff).setBlendMode(Phaser.BlendModes.ADD);
      c.add([gl, core]);
      this.tweens.add({ targets: gl, scale: 0.9, alpha: 0.3, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (e.fx === 'fire') {
        const logs = this.add.graphics();
        logs.fillStyle(0x000000, 0.35).fillEllipse(0, 14, 50, 14);
        logs.fillStyle(0x5a3a1e, 1).fillRoundedRect(-22, 4, 44, 9, 4).fillRoundedRect(-16, -2, 34, 8, 4);
        logs.fillStyle(0x3a2412, 1).fillCircle(-22, 8, 4).fillCircle(18, 2, 4);
        const flame = this.add.particles(0, 0, 'ex_glow', {
          x: { min: -8, max: 8 }, lifespan: { min: 500, max: 900 }, speedY: { min: -70, max: -35 }, speedX: { min: -8, max: 8 },
          scale: { start: 0.16, end: 0.02 }, alpha: { start: 0.95, end: 0 }, tint: [0xffd27a, 0xff8a3a, 0xff5a2a],
          frequency: highFx() ? 45 : 110, blendMode: Phaser.BlendModes.ADD,
        });
        const sparksUp = this.add.particles(0, -10, 'ember', {
          x: { min: -6, max: 6 }, lifespan: 1600, speedY: { min: -60, max: -25 }, speedX: { min: -14, max: 14 },
          scale: { start: 0.35, end: 0 }, alpha: { start: 1, end: 0 }, frequency: highFx() ? 260 : 700, tint: 0xffb060,
          blendMode: Phaser.BlendModes.ADD,
        });
        gl.setScale(1.3);
        c.add([logs, flame, sparksUp]);
      }
    } else if (e.kind === 'enemy') {
      const eid = ENCOUNTERS[e.battle ?? '']?.[0] ?? 'mist_wolf';
      const key = this.textures.exists(`enemy_${eid}`) ? `enemy_${eid}` : 'enemy_mist_wolf';
      const sh = this.add.image(0, 0, 'ex_shadow').setScale(1.1);
      const img = this.add.image(0, 10, key).setOrigin(0.5, 1);
      img.setScale(70 / img.height);
      c.add([sh, img]);
      a.img = img;
      this.tweens.add({ targets: img, y: 4, duration: 500 + this.fx() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (e.kind === 'chest') {
      const open = !!session.state.flags[chestFlag(this.area.id, e.id)];
      if (this.textures.exists('prop_chest')) {
        a.img = this.add.image(0, 14, 'prop_chest').setOrigin(0.5, 1);
        a.img.setScale(42 / a.img.width);
        if (open) a.img.setTint(0x6a6a7a).setAlpha(0.85);
      } else a.img = this.add.image(0, -4, open ? 'ex_chest_open' : 'ex_chest');
      c.add(a.img);
      if (!open) {
        const gl = this.add.image(0, -6, 'ex_glow').setScale(0.45).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
        c.addAt(gl, 0);
        this.tweens.add({ targets: gl, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 });
        // 隱藏寶箱：走近才現形
        if (e.hidden) {
          c.setAlpha(0);
          this.hiddenLeft.add(e.id);
        }
      }
    } else if (e.kind === 'sign') {
      if (this.textures.exists('prop_signpost')) {
        a.img = this.add.image(0, 16, 'prop_signpost').setOrigin(0.5, 1);
        a.img.setScale(62 / a.img.height);
      } else a.img = this.add.image(0, -4, 'ex_sign');
      c.add(a.img);
    }
    c.setVisible(present(session.state, e) || e.kind === 'door' || e.kind === 'gate');
  }

  /** 支線護送的 NPC：條件成立就加到隊伍最後面，結束就移除 */
  private syncEscorts(): void {
    const s = session.state;
    for (const f of ESCORTS) {
      const on = check(s, f.when);
      const cur = this.escorts.get(f.id);
      if (on && !cur && this.player) {
        const art = f.art && this.textures.exists(f.art) ? f.art : `ex_npc_${f.body}_${f.hair}`;
        const w = this.makeWalker(art, 60);
        w.c.setPosition(this.player.x, this.player.y);
        this.followers.push(w);
        this.escorts.set(f.id, w);
      } else if (!on && cur) {
        cur.c.destroy();
        this.followers = this.followers.filter((x) => x !== cur);
        this.escorts.delete(f.id);
      }
    }
  }

  /** 頭上標記依旗標刷新（劇本回來、寶箱開啟後） */
  refreshMarkers(): void {
    const s = session.state;
    this.syncEscorts();
    for (const a of this.actors) {
      a.mark?.destroy();
      a.mark = undefined;
      a.obj?.setVisible(present(s, a.e) || a.e.kind === 'door' || a.e.kind === 'gate');
      if (!present(s, a.e)) continue;
      const m = MARK[markerOf(s, this.area.id, a.e)];
      if (!m || !a.obj) continue;
      const top = a.e.kind === 'npc' ? -78 : a.e.kind === 'door' ? -44 : a.e.kind === 'gate' ? -60 : a.e.kind === 'lamp' ? -118 : -40;
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
      if (this.isHidden(a)) return false;
      if (!present(s, a.e) && a.e.kind !== 'door' && a.e.kind !== 'gate') return false;
      if (a.tx === tx && a.ty === ty) return true;
      return a.e.kind === 'npc' && wx !== undefined && wy !== undefined && a.obj
        && Math.abs(wx - a.obj.x) < 26 && wy < a.obj.y && wy > a.obj.y - 80;
    });
    // 點在建築上 → 走到那棟建築的門
    const bld = this.area.buildings.find((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y - 2 && ty < b.y + b.h);
    const door = !hit && bld
      ? this.actors.find((a) => a.e.kind === 'door' && a.tx >= bld.x && a.tx < bld.x + bld.w && a.ty >= bld.y && a.ty < bld.y + bld.h)
      : undefined;
    if (hit ?? door) {
      this.walkToActor((hit ?? door)!);
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
      if (a.e.kind === 'gate' || this.isHidden(a)) return false;
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
    const r = interact(s, this.area.id, a.e, this.fx());
    if (r.kind === 'script') {
      SFX.confirm();
      this.runScript(r.script, r.node, r.after);
    } else if (r.kind === 'say') {
      SFX.blip();
      this.say(a, `${a.e.name ? `${a.e.name}\n` : ''}${r.text}`);
    } else if (r.kind === 'loot') {
      applyEffects(s, r.effects);
      SFX.itemGet();
      if (a.img?.texture.key === 'prop_chest') a.img.setTint(0x6a6a7a).setAlpha(0.85);
      else a.img?.setTexture('ex_chest_open');
      a.obj?.list.filter((o) => o instanceof Phaser.GameObjects.Image && o.texture.key === 'ex_glow').forEach((o) => o.destroy());
      if (a.obj) {
        sparks(this, a.obj.x, a.obj.y - 10, 22, 'ember', 0xffd27a, 260);
        shockRing(this, a.obj.x, a.obj.y, 0xffd27a, 80, 360, 4);
      }
      const gotGear = r.effects.some((e) => 'item' in e && ITEM_DEFS[e.item]?.kind === 'gear');
      const tip = gotGear && !s.flags['tip_gear'];
      if (tip) s.flags['tip_gear'] = true;
      this.hud()?.toast(tip ? `${r.text}\n\n（右上 🎒 行囊 → 裝備，就能換上。）` : r.text, tip ? 4200 : 2600);
      this.refreshMarkers();
      this.savePos(true);
    } else if (r.kind === 'lamp') {
      this.lightLamp(a, r.flag);
    } else {
      if (a.e.kind === 'chest') this.hud()?.toast('空的。');
    }
  }

  /** 支線「點燈」：點亮一盞路燈；全部點亮 → q_<...>_lit 旗標，回去找委託人 */
  private lightLamp(a: Actor, flag: string): void {
    const s = session.state;
    s.flags[flag] = true;
    SFX.lampPlace(Object.keys(s.flags).filter((k) => k.startsWith(`lamp_${this.area.id}_`)).length);
    const img = this.lampGlow.get(a.e.id);
    this.lampPost.get(a.e.id)?.clearTint();
    const x = a.tx * TILE + TILE / 2;
    const y = a.ty * TILE - 20;
    if (img) {
      img.setAlpha(0.9).setScale(2.4);
      this.tweens.add({ targets: img, alpha: 0.42, scale: 1.3, duration: 700, ease: 'Cubic.Out' });
    }
    sparks(this, x, y, 26, 'ember', 0xffd27a, 300);
    shockRing(this, x, y, 0xffd27a, 110, 420, 5);
    const lamps = this.area.entities.filter((e) => e.kind === 'lamp' && e.requires && 'flag' in e.requires && 'flag' in a.e.requires! && e.requires.flag === a.e.requires.flag);
    const lit = lamps.filter((e) => s.flags[lampFlag(this.area.id, e.id)]).length;
    if (lit >= lamps.length) {
      s.flags[`${(a.e.requires as { flag: string }).flag}_lit`] = true;
      this.cameras.main.flash(300, 255, 200, 120);
      this.hud()?.toast(`點亮了最後一盞！（${lit}/${lamps.length}）\n廣場亮起來了——回去找老燈伕吧。`, 3200);
    } else this.hud()?.toast(`點亮了路燈（${lit}/${lamps.length}）`, 1600);
    this.refreshMarkers();
    this.hud()?.refreshGoal();
    this.savePos(true);
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

  /** 同伴偶爾冒一句話（不擋操作，跟著同伴走） */
  private lastBanter = 0;
  private banterTick(): void {
    if (this.busy || this.leaving || this.bubble) return;
    if (this.time.now - this.lastBanter < 22000 || this.fx() < 0.45) return;
    const cands = this.followers.filter((f) => f.id);
    const f = cands[Math.floor(this.fx() * cands.length)];
    if (!f?.id) return;
    const lines = banterFor(this.area.id, f.id, f.id === 'lian' ? 0 : session.state.affinity[f.id as CompanionId] ?? 0);
    const text = lines[Math.floor(this.fx() * lines.length)];
    if (!text) return;
    this.lastBanter = this.time.now;
    const t = this.add.text(0, 0, withNames(text), { fontFamily: UI_FONT, fontSize: '19px', color: '#ffffff', wordWrap: { width: 300, useAdvancedWrap: true } }).setOrigin(0.5, 1);
    const w = t.width + 26;
    const h = t.height + 18;
    const g = this.add.graphics();
    g.fillStyle(0x070912, 0.88).fillRoundedRect(-w / 2, -h, w, h, 12);
    g.lineStyle(2, HERO_COLOR[f.id] ?? 0xffffff, 0.9).strokeRoundedRect(-w / 2, -h, w, h, 12);
    t.setPosition(0, -9);
    const b = this.add.container(0, -96, [g, t]).setScale(0.6).setAlpha(0);
    f.c.add(b);
    this.tweens.add({ targets: b, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
    this.tweens.add({ targets: b, alpha: 0, delay: 3200, duration: 300, onComplete: () => b.destroy() });
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
    const r = interact(s, this.area.id, a.e);
    // 單純出口但有條件（例：礦坑口要先跟多恩談）
    if (!a.e.talk && a.e.requires && !check(s, a.e.requires)) {
      SFX.uiCancel();
      this.say(a, a.e.lines?.[0] ?? '（現在還不能過去。）');
      const back = findPath(this.grid, this.playerTile(), { x: a.tx, y: a.ty - 2 }, this.blockers());
      if (back) this.path = back;
      return;
    }
    // 主線已完成（或本來就是單純出口）→ 前往下一個區域／世界地圖
    if ((a.e.done && s.flags[a.e.done]) || (r.kind !== 'script' && a.e.to)) {
      if (a.e.to === 'map' || !a.e.to) this.leaveToMap();
      else this.gotoArea(a.e.to.area, a.e.to.spawn);
      return;
    }
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

  gotoArea(area: string, spawn: string): void {
    if (this.leaving) return;
    this.leaving = true;
    SFX.confirm();
    const s = session.state;
    s.flags['__ex_area'] = area;
    delete s.flags['__ex_x'];
    delete s.flags['__ex_y'];
    session.setScriptPos('explore', area);
    session.save();
    fadeOutThen(this, 350, () => this.scene.start('Explore', { area, spawn }));
  }

  leaveToMap(): void {
    if (this.leaving) return;
    this.leaving = true;
    SFX.confirm();
    const s = session.state;
    this.savePos(false);
    // 灰燈鎮在第 2 章也會回來（廣場）：用目前章節的地圖節點
    const ch = currentChapter(s.flags);
    const region = ch === 'ch2' && this.area.id === 'greylamp' ? 'ch2' : this.area.region;
    const node = region === 'ch2' && this.area.id === 'greylamp' ? 'greylamp_plaza' : this.area.mapNode ?? s.location.node;
    s.location = { region, node };
    session.setScriptPos('map', region);
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
    if (moved) {
      this.movedAt = this.time.now;
      this.revealHidden();
    }
    // 走路彈跳
    if (moved) {
      const last0 = this.trail[this.trail.length - 1]!;
      if (Math.hypot(this.player.x - last0.x, this.player.y - last0.y) > 0.5) this.moveDir = { x: this.player.x - last0.x, y: this.player.y - last0.y };
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
    // 明雷：碰到敵人 → 戰鬥
    if (!this.busy && !this.leaving) {
      for (const a of this.actors) {
        if (a.e.kind !== 'enemy' || !a.obj || !this.alive(a)) continue;
        const weak = this.weakling(a);
        if (Math.hypot(a.obj.x - this.player.x, a.obj.y - this.player.y) < (weak ? 62 : 42)) {
          if (weak) this.scareOff(a);
          else this.startBattle(a);
          break;
        }
      }
    }
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
      if (a.e.kind === 'enemy' || r <= 0 || a.moving || !a.obj || this.fx() < 0.5) continue;
      if (this.bubble && this.bubble.x === a.obj.x) continue;
      const dirs: Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      const d = dirs[Math.floor(this.fx() * 4)]!;
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

  // ------------------------------------------------------------ 明雷敵人
  private enemyTick(): void {
    if (this.busy || this.leaving) return;
    const pt = this.playerTile();
    const blockers = this.blockers();
    for (const a of this.actors) {
      if (a.e.kind !== 'enemy' || a.moving || !a.obj || !this.alive(a)) continue;
      const d = Math.max(Math.abs(a.tx - pt.x), Math.abs(a.ty - pt.y));
      let step: Pt | undefined;
      const homeD = Math.max(Math.abs(a.tx - a.home.x), Math.abs(a.ty - a.home.y));
      // 只看得到前方（圖預設面向左，flipX＝面向右）4 格，或身邊 2 格內；從背後摸過去可以先制
      const facingRight = !!a.img?.flipX;
      const inFront = facingRight ? pt.x >= a.tx : pt.x <= a.tx;
      const notice = this.chasing.has(a.e.id) ? d <= 5 : d <= 2 || (d <= 4 && inFront);
      if (d <= 4 && this.weakling(a)) {
        // 等級差太大：看到你就逃
        if (!this.fleeing.has(a.e.id)) {
          this.fleeing.add(a.e.id);
          const sw = this.add.text(18, -80, '💦', { fontFamily: UI_FONT, fontSize: '28px' }).setOrigin(0.5);
          a.obj.add(sw);
          this.tweens.add({ targets: sw, y: -96, alpha: 0, duration: 900, delay: 400, onComplete: () => sw.destroy() });
        }
        const opts: Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
          .map((o) => ({ x: a.tx + o.x, y: a.ty + o.y }))
          .filter((n) => walkable(this.grid, n.x, n.y, blockers) && Math.max(Math.abs(n.x - a.home.x), Math.abs(n.y - a.home.y)) <= 6)
          .filter((n) => Math.max(Math.abs(n.x - pt.x), Math.abs(n.y - pt.y)) > d);
        step = opts[Math.floor(this.fx() * opts.length)];
      } else if (notice && homeD < 8) {
        // 發現玩家：追
        if (!this.chasing.has(a.e.id)) {
          this.chasing.add(a.e.id);
          const bang = this.add.text(0, -84, '！', {
            fontFamily: UI_FONT, fontSize: '36px', fontStyle: '900', color: '#ff6a5a', stroke: '#000', strokeThickness: 6,
          }).setOrigin(0.5);
          a.obj.add(bang);
          this.tweens.add({ targets: bang, y: -100, alpha: 0, duration: 700, delay: 300, onComplete: () => bang.destroy() });
          SFX.blip();
        }
        blockers.delete(`${a.tx},${a.ty}`);
        const p = findPath(this.grid, { x: a.tx, y: a.ty }, pt, blockers, 400);
        step = p?.[0];
      } else {
        this.chasing.delete(a.e.id);
        if (this.fx() < 0.35) {
          const r = a.e.wander ?? 2;
          const dirs: Pt[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
          const dd = dirs[Math.floor(this.fx() * 4)]!;
          const n = { x: a.tx + dd.x, y: a.ty + dd.y };
          if (Math.abs(n.x - a.home.x) <= r && Math.abs(n.y - a.home.y) <= r && walkable(this.grid, n.x, n.y, blockers)) step = n;
        }
      }
      if (!step) continue;
      if (this.path.some((p) => p.x === step!.x && p.y === step!.y) && !(step.x === pt.x && step.y === pt.y)) continue;
      blockers.delete(`${a.tx},${a.ty}`);
      blockers.add(`${step.x},${step.y}`);
      if (step.x !== a.tx) a.img?.setFlipX(step.x > a.tx);
      a.tx = step.x;
      a.ty = step.y;
      a.moving = true;
      const chase = this.chasing.has(a.e.id);
      this.tweens.add({
        targets: a.obj, x: step.x * TILE + TILE / 2, y: step.y * TILE + TILE / 2, duration: chase ? 300 : 600, ease: 'Sine.easeInOut',
        onUpdate: () => a.obj?.setDepth(a.obj.y),
        onComplete: () => {
          a.moving = false;
        },
      });
    }
  }

  private fleeing = new Set<string>();

  /** 等級差 ≥ 5 的小怪（Boss 不算） */
  private weakling(a: Actor): boolean {
    const ids = ENCOUNTERS[a.e.battle ?? 'forest_a'] ?? [];
    const lv = Math.max(1, ...ids.map((id) => ENEMIES[id]?.level ?? 1));
    return outleveled(session.state.members.lian?.level ?? 1, lv, ids.some((id) => id.startsWith('boss_')));
  }

  /** 碰到逃跑中的小怪：直接趕跑（拿金幣、不進戰鬥） */
  private scareOff(a: Actor): void {
    const s = session.state;
    this.defeated().add(a.e.id);
    this.chasing.delete(a.e.id);
    const g = a.e.gold ?? 0;
    if (g > 0) applyEffects(s, [{ gold: g }]);
    SFX.hitLight();
    if (a.obj) {
      sparks(this, a.obj.x, a.obj.y - 20, 12, 'ember', 0xffd27a, 200);
      const dir = a.obj.x >= this.player.x ? 1 : -1;
      this.tweens.add({ targets: a.obj, x: a.obj.x + dir * 160, alpha: 0, duration: 420, ease: 'Quad.In', onComplete: () => a.obj?.destroy() });
    }
    this.actors = this.actors.filter((x) => x !== a);
    this.hud()?.toast(g > 0 ? `魔物嚇得逃走了！　金幣 +${g}` : '魔物嚇得逃走了！', 1600);
    this.savePos(true);
  }

  private battleWith?: Actor;
  private moveDir: Pt = { x: 0, y: 0 };
  private movedAt = 0;

  private startBattle(a: Actor): void {
    this.busy = true;
    this.path = [];
    this.pending = undefined;
    this.stick = null;
    this.hud()?.hideStick();
    this.battleWith = a;
    this.savePos(true);
    // 先攻判定：沒被發現就碰到 → 先制；被追上（玩家沒在朝牠走）→ 敵方先攻
    let ambush: 'player' | 'enemy' | undefined;
    if (!this.chasing.has(a.e.id)) ambush = 'player';
    else if (a.obj) {
      const toward = this.moveDir.x * (a.obj.x - this.player.x) + this.moveDir.y * (a.obj.y - this.player.y) > 0;
      const walking = this.time.now - this.movedAt < 250;
      if (!(walking && toward)) ambush = 'enemy';
    }
    const s = session.state;
    const party = battleParty(s);
    SFX.hitHeavy();
    this.cameras.main.flash(220, 255, 255, 255);
    this.cameras.main.shake(200, 0.01);
    this.time.delayedCall(260, () => {
      this.scene.sleep('ExploreHud');
      this.scene.sleep();
      this.scene.run('Battle', { encounter: a.e.battle ?? 'forest_a', party, story: true, returnTo: 'Explore', ambush } satisfies BattleSceneData);
    });
  }

  private onBattleEnd(outcome: string): void {
    this.scene.wake('ExploreHud');
    const a = this.battleWith;
    this.battleWith = undefined;
    this.cameras.main.fadeIn(300, 0, 0, 0);
    const s = session.state;
    if (a && outcome === 'win') {
      this.defeated().add(a.e.id);
      this.chasing.delete(a.e.id);
      const g = a.e.gold ?? 0;
      if (g > 0) applyEffects(s, [{ gold: g }]);
      if (a.obj) {
        sparks(this, a.obj.x, a.obj.y - 20, 20, 'ember', 0xffd27a, 240);
        this.tweens.add({ targets: a.obj, alpha: 0, scale: 0.6, duration: 300, onComplete: () => a.obj?.destroy() });
      }
      this.actors = this.actors.filter((x) => x !== a);
      this.hud()?.toast(g > 0 ? `擊退了魔物！　金幣 +${g}` : '擊退了魔物！', 1800);
    } else {
      // 敗北：退回區域入口，敵人回原位
      if (a?.obj) {
        a.tx = a.home.x;
        a.ty = a.home.y;
        a.obj.setPosition(a.home.x * TILE + TILE / 2, a.home.y * TILE + TILE / 2);
      }
      const sp = this.area.spawns['default']!;
      this.player.setPosition(sp.x * TILE + TILE / 2, sp.y * TILE + TILE / 2);
      this.followers.forEach((f) => f.c.setPosition(this.player.x, this.player.y));
      for (let i = 0; i < this.trail.length; i++) this.trail[i] = { x: this.player.x, y: this.player.y };
      this.hud()?.toast('被擊退了……先整頓一下再出發吧。', 2200);
    }
    session.save();
    // 給一點無敵時間，避免一回來就又被同一群撞上
    this.time.delayedCall(700, () => {
      this.busy = false;
    });
  }

  // ------------------------------------------------------------ 工具
  playerTile(): Pt {
    return { x: Math.floor(this.player.x / TILE), y: Math.floor(this.player.y / TILE) };
  }

  private blockers(): Set<string> {
    const s = session.state;
    const b = new Set<string>();
    for (const a of this.actors) {
      if (a.e.kind === 'gate' || a.e.kind === 'door' || this.isHidden(a)) continue;
      if (!present(s, a.e) || !this.alive(a)) continue;
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
      setFlags: (f: Record<string, boolean>) => {
        Object.assign(session.state.flags, f);
        this.refreshMarkers();
      },
      busy: () => this.busy || this.leaving || this.path.length > 0,
    };
  }
}

