// 戰鬥場景（07 §5、03 §3、05 §4）。邏輯全在 core/battle/engine，這裡只負責呈現、輸入與手感。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { playMusic } from '../../audio/music';
import {
  availableCommands,
  chooseCommand,
  createBattle,
  currentHero,
  resolveDefense,
  resolveTiming,
  type ActorRef,
  type AvailableCommand,
  type BattleEvent,
  type BattleState,
  type Command,
} from '../../core/battle/engine';
import { MAX_EMBER, WINDOWS, judgeAttack, judgeDefense, type DefenseResult, type Telegraph, type Timing } from '../../core/battle/formulas';
import { SKILLS, type HeroId } from '../../core/battle/skills';
import { GestureTracker, type Gesture } from '../../core/input/gesture';
import { ENCOUNTERS, ENEMIES } from '../../data/combatants';
import { ART, enemyArtKey, generateCombatantArt, heroArtKey } from '../art/silhouettes';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { session, withNames } from '../session';
import { getSettings } from '../settings';
import { backdropKey, type BackdropId } from '../art/backdrops';
import { grantXp } from '../../core/state/gameState';
import {
  UI_FONT, bigText, floatNumber, hitStop, pressBounce, setBaseSpeed, shockRing, slowMo, sparks, wait, fadeOutThen } from '../fx/feel';

export interface BattleSceneData {
  encounter?: string;
  party?: { id: HeroId; level: number }[];
  /** 示範連戰：勝利後接下一場 */
  chain?: string[];
  seed?: number;
  /** 劇情戰：結束後回到 DialogueScene（wake，帶 outcome） */
  story?: boolean;
  /** 新手教學戰：星燼全滿、提示較多 */
  tutorial?: boolean;
}

type Mode = 'busy' | 'command' | 'panel' | 'timing' | 'defense' | 'end';

interface UnitView {
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  aura: Phaser.GameObjects.Image;
  bars: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  lamps: Phaser.GameObjects.Container;
  status: Phaser.GameObjects.Text;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  side: 'hero' | 'enemy';
  dead: boolean;
}

const HERO_COLOR: Record<string, number> = {
  lian: 0xffa54a, rourke: 0xe0705a, io: 0x7fd8ff, serin: 0xc8d4ff, liora: 0xff7a5a,
};
const TELE_COLOR: Record<Telegraph, number> = { white: 0xffffff, red: 0xff4a4a, purple: 0xb46bff };
const TELE_HINT: Record<Telegraph, string> = { white: '點擊 → 格擋', red: '滑動 → 閃避', purple: '長按 → 引路' };
const STATUS_LABEL: Record<string, string> = {
  guarding: '防禦', taunt: '挑釁', counterStance: '反擊架勢', veteranInstinct: '老兵的直覺', weakRevealed: '弱點顯現',
  silenced: '靜默', howl: '嚎叫！', poison: '中毒', umbra: '蝕', empowered: '引路之光',
};

const ATTACK_LEAD_MS = 260; // 光環出現到開始收縮
const RING_MS = 760; // 外圈收縮到判定圈
const RING_R0 = 175;
const RING_R1 = 58;

const now = (): number => performance.now();
function eventTime(p: Phaser.Input.Pointer): number {
  const ts = (p.event as Event | undefined)?.timeStamp;
  const n = now();
  return ts !== undefined && Math.abs(ts - n) < 1000 ? ts : n;
}

export class BattleScene extends Phaser.Scene {
  private bs!: BattleState;
  private data0: Required<Pick<BattleSceneData, 'encounter' | 'party' | 'chain'>> & { seed: number; story: boolean; tutorial: boolean } = {
    encounter: 'forest_a', party: [], chain: [], seed: 1, story: false, tutorial: false,
  };
  private mode: Mode = 'busy';
  private heroes: UnitView[] = [];
  private enemies: UnitView[] = [];
  private target = 0;
  private reticle!: Phaser.GameObjects.Container;
  private turnBar!: Phaser.GameObjects.Container;
  private emberG!: Phaser.GameObjects.Graphics;
  private emberShown = 0;
  private roundText!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Container[] = [];
  private buttonBar!: Phaser.GameObjects.Container;
  private panel?: Phaser.GameObjects.Container;
  private ringG!: Phaser.GameObjects.Graphics;
  private edge!: Phaser.GameObjects.Image;
  private hint!: Phaser.GameObjects.Text;
  private dim!: Phaser.GameObjects.Rectangle;
  private fog: Phaser.GameObjects.Image[] = [];
  private isWebGL = false;

  // 時機輸入
  private timing?: { start: number; x: number; y: number; scale: number; done: boolean; resolve: (t: Timing) => void };
  // 防守輸入
  private gestures = new GestureTracker();
  private defense?: {
    tele: Telegraph;
    impacts: number[];
    targetHero: number;
    taps: number[];
    swipes: number[];
    presses: { at: number; up?: number }[];
    scale: number;
    ringStart: number;
  };
  private lastTelegraph?: Extract<BattleEvent, { type: 'telegraph' }>;

  constructor() {
    super('Battle');
  }

  init(data: BattleSceneData): void {
    const q = new URLSearchParams(window.location.search);
    const enc = data.encounter ?? q.get('enc') ?? 'forest_a';
    const lv = Number(q.get('lv') ?? 4);
    const partyIds = (q.get('party') ?? 'lian,rourke,io').split(',').filter(Boolean) as HeroId[];
    this.data0 = {
      encounter: ENCOUNTERS[enc] ? enc : 'forest_a',
      party: data.party ?? partyIds.map((id) => ({ id, level: lv })),
      chain: data.chain ?? [],
      seed: data.seed ?? ((Math.random() * 1e9) | 0),
      story: !!data.story,
      tutorial: !!data.tutorial,
    };
    this.mode = 'busy';
    this.heroes = [];
    this.enemies = [];
    this.fog = [];
    this.panel = undefined;
    this.timing = undefined;
    this.defense = undefined;
    this.target = 0;
    this.emberShown = 0;
    this.buttons = [];
    this.coachStep = 0;
    this.coach = undefined;
  }

  create(): void {
    this.isWebGL = this.renderer.type === Phaser.WEBGL;
    generateCombatantArt(this);
    this.makeTextures();
    const enemies = [...(ENCOUNTERS[this.data0.encounter] ?? ['mist_wolf'])];
    // 劇情分歧：吹口哨讓狼群回來 → 狼王戰多一隻霧狼（ch1）
    if (this.data0.story && this.data0.encounter === 'boss_wolfking' && session.state.flags['wolfpack_returned']) enemies.push('mist_wolf');
    this.bs = createBattle({
      party: this.data0.party, enemies, seed: this.data0.seed,
      items: this.data0.story ? {
        potion_s: session.state.inventory['potion_s'] ?? 0, lamp_oil: session.state.inventory['lamp_oil'] ?? 0,
        ...(session.state.inventory['blast_bottle'] ? { blast_bottle: session.state.inventory['blast_bottle'] } : {}),
      } : { potion_s: 2, lamp_oil: 1, blast_bottle: 1 },
      flags: this.data0.story ? {
        tutorialEmber: this.data0.tutorial, guidingLight: !!session.state.flags['guidingLight'],
        ambushed: this.data0.encounter === 'caravan' && !!session.state.flags['caravan_ambushed'],
        retryBoost: this.retryCount(),
      } : { guidingLight: true },
    }).state;
    for (const h of this.bs.heroes) {
      h.name = withNames(h.name);
      // 第 2 章：瑟琳獨自衝鋒時受的傷（serin_scar）→ 最大 HP −10%
      if (this.data0.story && h.id === 'serin' && session.state.flags['serin_scar']) {
        h.maxHp = Math.round(h.maxHp * 0.9);
        h.hp = Math.min(h.hp, h.maxHp);
      }
    }
    const boss = enemies.some((id) => id.startsWith('boss_'));

    this.drawBackground(boss);
    this.buildUnits();
    this.buildHud();
    this.buildButtons();
    this.ringG = this.add.graphics().setDepth(700);
    this.edge = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'edge_glow').setDepth(880).setAlpha(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setBlendMode(Phaser.BlendModes.ADD);
    this.dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1).setDepth(600).setAlpha(0);
    this.hint = this.add.text(GAME_WIDTH / 2, 990, '', {
      fontFamily: UI_FONT, fontSize: '40px', fontStyle: '900', color: '#ffffff', stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(890).setAlpha(0);

    if (this.isWebGL) this.cameras.main.postFX.addVignette(0.5, 0.48, 0.92, 0.38);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer('down', p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointer('move', p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointer('up', p));

    playMusic(boss ? 'boss' : 'battle');
    this.cameras.main.fadeIn(350, 0, 0, 0);
    void this.intro(boss);
  }

  private async intro(boss: boolean): Promise<void> {
    this.enemies.forEach((v, i) => {
      v.root.setAlpha(0).setY(v.y - 40);
      this.tweens.add({ targets: v.root, alpha: 1, y: v.y, delay: 120 + i * 120, duration: 420, ease: 'Back.Out' });
    });
    this.heroes.forEach((v, i) => {
      v.root.setY(v.y + 160);
      this.tweens.add({ targets: v.root, y: v.y, delay: 200 + i * 90, duration: 420, ease: 'Cubic.Out' });
    });
    if (boss) {
      await wait(this, 400);
      this.cameras.main.shake(500, 0.01);
      SFX.hitHeavy();
      bigText(this, GAME_WIDTH / 2, 300, ENEMIES[this.bs.enemies[0]?.id ?? '']?.name ?? '', '#d9b8ff', 64, 700);
      await wait(this, 900);
    } else {
      await wait(this, 650);
    }
    if (this.bs.flags.ambushed) {
      this.cameras.main.shake(350, 0.008);
      SFX.hitHeavy();
      bigText(this, GAME_WIDTH / 2, 600, '伏擊！先手被奪', '#ff7a6a', 52, 900);
      await wait(this, 900);
    }
    const boost = Math.min(4, this.bs.flags.retryBoost ?? 0);
    if (boost > 0) {
      SFX.save();
      shockRing(this, GAME_WIDTH / 2, 938, 0xffd27a);
      bigText(this, GAME_WIDTH / 2, 600, '不屈之燈', '#ffd27a', 56, 800);
      floatNumber(this, GAME_WIDTH / 2, 670, `星燼 +${boost}・敵方攻擊 −${boost * 5}%`, { color: '#ffe2a8', size: 28 });
      await wait(this, 1000);
    }
    this.step();
  }

  // ============================================================ 材質與背景
  private makeTextures(): void {
    if (!this.textures.exists('edge_glow')) {
      const tex = this.textures.createCanvas('edge_glow', 256, 456);
      if (tex) {
        const c = tex.getContext();
        const g = c.createRadialGradient(128, 228, 120, 128, 228, 300);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.55, 'rgba(255,255,255,0.15)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        c.fillStyle = g;
        c.fillRect(0, 0, 256, 456);
        tex.refresh();
      }
    }
    if (!this.textures.exists('pillar')) {
      const tex = this.textures.createCanvas('pillar', 64, 512);
      if (tex) {
        const c = tex.getContext();
        const g = c.createLinearGradient(0, 0, 64, 0);
        g.addColorStop(0, 'rgba(255,200,120,0)');
        g.addColorStop(0.5, 'rgba(255,245,220,1)');
        g.addColorStop(1, 'rgba(255,200,120,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 64, 512);
        tex.refresh();
      }
    }
  }

  private drawBackground(boss: boolean): void {
    // 第 2 章（礦坑）遭遇：沿用對話背景（礦坑／鐘廳／深層）
    const enc = this.data0.encounter;
    const mine: BackdropId | null = enc === 'boss_bellworm' || enc.startsWith('deep_') ? 'deep' : enc === 'bell_hall' ? 'bellhall' : enc.startsWith('mine_') ? 'mine' : null;
    if (mine) {
      this.add.image(0, 0, backdropKey(this, mine)).setOrigin(0, 0).setDepth(-10);
      const shade = this.add.graphics().setDepth(-9);
      shade.fillStyle(0x000000, boss ? 0.45 : 0.3).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.add.particles(0, 0, 'ember', {
        x: { min: 0, max: GAME_WIDTH }, y: { min: 300, max: 1100 }, lifespan: { min: 2500, max: 5000 },
        speedY: { min: -14, max: -4 }, scale: { start: 0.3, end: 0 }, alpha: { start: 0.7, end: 0 }, frequency: 260,
        tint: boss ? 0xb48cff : 0xffb565, blendMode: Phaser.BlendModes.ADD,
      }).setDepth(-8);
      return;
    }
    const key = boss ? 'bg_forest_boss' : 'bg_forest';
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT);
      if (tex) {
        const c = tex.getContext();
        const sky = c.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        sky.addColorStop(0, boss ? '#07040f' : '#040810');
        sky.addColorStop(0.35, boss ? '#1c1036' : '#0c1a2c');
        sky.addColorStop(0.55, boss ? '#2b1640' : '#13283a');
        sky.addColorStop(0.62, '#0a0f18');
        sky.addColorStop(1, '#05070c');
        c.fillStyle = sky;
        c.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        // 月
        const moon = c.createRadialGradient(540, 170, 10, 540, 170, 220);
        moon.addColorStop(0, boss ? 'rgba(220,190,255,0.9)' : 'rgba(220,240,255,0.9)');
        moon.addColorStop(0.12, boss ? 'rgba(180,140,255,0.35)' : 'rgba(160,200,255,0.3)');
        moon.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = moon;
        c.fillRect(0, 0, GAME_WIDTH, 600);
        // 星
        let seed = 7;
        const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 90; i++) {
          c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
          c.fillRect(r() * GAME_WIDTH, r() * 420, 1.5, 1.5);
        }
        // 三層松樹剪影
        const layers: [number, string, number, number][] = [
          [520, boss ? '#1a1030' : '#0f1d2a', 70, 150],
          [600, boss ? '#110a20' : '#0a141e', 90, 210],
          [690, '#06080d', 120, 300],
        ];
        for (const [base, col, w, h] of layers) {
          c.fillStyle = col;
          for (let x = -40; x < GAME_WIDTH + 60; x += w * (0.55 + r() * 0.5)) {
            const hh = h * (0.6 + r() * 0.6);
            for (let k = 0; k < 4; k++) {
              const bw = (w / 2) * (1 - k * 0.2);
              const by = base - (hh * k) / 4.2;
              c.beginPath();
              c.moveTo(x - bw, by);
              c.lineTo(x, by - hh * 0.42);
              c.lineTo(x + bw, by);
              c.closePath();
              c.fill();
            }
            c.fillRect(x - 4, base - 10, 8, 12);
          }
          c.fillRect(0, base - 2, GAME_WIDTH, GAME_HEIGHT - base);
        }
        // 地面光（戰場中央）
        const ground = c.createRadialGradient(360, 640, 20, 360, 640, 420);
        ground.addColorStop(0, boss ? 'rgba(120,70,180,0.25)' : 'rgba(70,120,150,0.22)');
        ground.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = ground;
        c.fillRect(0, 300, GAME_WIDTH, 700);
        // 底部 UI 區
        const ui = c.createLinearGradient(0, 900, 0, GAME_HEIGHT);
        ui.addColorStop(0, 'rgba(4,5,10,0)');
        ui.addColorStop(0.2, 'rgba(4,5,10,0.85)');
        ui.addColorStop(1, 'rgba(4,5,10,1)');
        c.fillStyle = ui;
        c.fillRect(0, 900, GAME_WIDTH, GAME_HEIGHT - 900);
        tex.refresh();
      }
    }
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-100);

    // 霧
    for (let i = 0; i < 5; i++) {
      const f = this.add.image(Phaser.Math.Between(0, GAME_WIDTH), 420 + i * 90, 'glow')
        .setScale(2.6, 0.7).setAlpha(boss ? 0.16 : 0.1).setTint(boss ? 0x9c7cff : 0x8fb8d8)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(-50);
      this.tweens.add({
        targets: f, x: f.x + (i % 2 ? 220 : -220), duration: 9000 + i * 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.fog.push(f);
    }
    // 螢火 / 餘燼
    this.add.particles(0, 0, 'ember', {
      x: { min: 0, max: GAME_WIDTH }, y: { min: 250, max: 900 }, lifespan: { min: 3000, max: 6000 },
      speedY: { min: -30, max: -8 }, speedX: { min: -12, max: 12 }, scale: { start: 0.35, end: 0 },
      alpha: { start: 0.9, end: 0 }, frequency: 260, tint: boss ? 0xc8a0ff : 0xd8ffa0, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(-40);
  }

  // ============================================================ 單位
  private buildUnits(): void {
    const ex = [[360], [220, 500], [140, 360, 580]][this.bs.enemies.length - 1] ?? [360];
    const ey = [[430], [410, 450], [460, 380, 460]][this.bs.enemies.length - 1] ?? [430];
    this.bs.enemies.forEach((e, i) => {
      const art = ART[enemyArtKey(e.id)];
      const v = this.makeUnitView('enemy', enemyArtKey(e.id), ex[i] ?? 360, ey[i] ?? 430, e.hp, e.maxHp, e.name, art?.h ?? 140);
      const boss = e.id.startsWith('boss_');
      v.sprite.setScale(boss ? 0.62 : 0.5);
      if (this.isWebGL) v.sprite.preFX?.addGlow(boss ? 0x9a6bff : 0x5a7cff, 2, 0, false, 0.1, 10);
      v.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.selectTarget(i));
      this.tweens.add({ targets: v.sprite, y: -6, duration: 1400 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.enemies.push(v);
    });
    const hx = [[360], [240, 480], [140, 360, 580]][this.bs.heroes.length - 1] ?? [360];
    this.bs.heroes.forEach((h, i) => {
      const art = ART[heroArtKey(h.id)];
      const v = this.makeUnitView('hero', heroArtKey(h.id), hx[i] ?? 360, 790, h.hp, h.maxHp, h.name, art?.h ?? 200);
      v.sprite.setScale(0.5);
      if (art?.glow) {
        const gx = (art.glow.x - art.w / 2);
        const gy = (art.glow.y - art.h / 2);
        const lamp = this.add.image(gx, gy, 'glow').setScale(art.glow.scale).setTint(art.glow.color)
          .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
        v.root.add(lamp);
        this.tweens.add({
          targets: lamp, alpha: 0.55, scale: art.glow.scale * 0.85, duration: 180 + i * 40, yoyo: true, repeat: -1,
          ease: 'Stepped', easeParams: [3],
        });
      }
      this.tweens.add({ targets: v.sprite, scaleY: 0.51, duration: 1600 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.heroes.push(v);
    });
    this.reticle = this.add.container(0, 0).setDepth(650);
    const rg = this.add.graphics();
    rg.lineStyle(4, 0xffd27a, 1);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      rg.lineBetween(Math.cos(a) * 64, Math.sin(a) * 64, Math.cos(a) * 84, Math.sin(a) * 84);
    }
    rg.strokeCircle(0, 0, 70);
    this.reticle.add(rg).setAlpha(0);
    this.tweens.add({ targets: this.reticle, angle: 360, duration: 6000, repeat: -1 });
  }

  private makeUnitView(
    side: 'hero' | 'enemy', key: string, x: number, y: number, hp: number, maxHp: number, name: string, h: number,
  ): UnitView {
    const root = this.add.container(x, y).setDepth(side === 'enemy' ? 100 : 200);
    const shadow = this.add.ellipse(0, h * 0.25, side === 'enemy' ? 150 : 110, 26, 0x000000, 0.45);
    const aura = this.add.image(0, 0, 'glow').setScale(1.4).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    const sprite = this.add.image(0, 0, key);
    const bars = this.add.graphics();
    const label = this.add.text(0, 0, name, {
      fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#e8ecff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    const lamps = this.add.container(0, -h * 0.32 - 34);
    const status = this.add.text(0, 0, '', {
      fontFamily: UI_FONT, fontSize: '18px', color: '#ffd27a', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    root.add([shadow, aura, sprite, bars, label, lamps, status]);
    const v: UnitView = { root, sprite, shadow, aura, bars, label, lamps, status, x, y, hp, maxHp, side, dead: false };
    if (side === 'enemy') {
      label.setPosition(0, -h * 0.32 - 4).setFontSize(20);
      status.setPosition(0, h * 0.32 + 6);
    } else {
      label.setPosition(0, 86);
      status.setPosition(0, -110);
    }
    this.drawBars(v);
    return v;
  }

  private drawBars(v: UnitView, sp?: number, breakPct?: number): void {
    const g = v.bars;
    g.clear();
    if (v.dead && v.side === 'enemy') return;
    const w = v.side === 'enemy' ? 130 : 150;
    const y = v.side === 'enemy' ? v.label.y + 16 : 104;
    const pct = Math.max(0, v.hp / v.maxHp);
    g.fillStyle(0x000000, 0.7).fillRoundedRect(-w / 2 - 2, y - 2, w + 4, 14, 5);
    const col = v.side === 'enemy' ? 0xff5a6a : pct > 0.5 ? 0x6cff9a : pct > 0.25 ? 0xffd25a : 0xff5a5a;
    g.fillStyle(col, 1).fillRoundedRect(-w / 2, y, Math.max(2, w * pct), 10, 4);
    g.fillStyle(0xffffff, 0.35).fillRect(-w / 2 + 2, y + 1, Math.max(0, w * pct - 4), 2);
    if (v.side === 'enemy' && breakPct !== undefined) {
      g.fillStyle(0x000000, 0.7).fillRect(-w / 2, y + 14, w, 6);
      g.fillStyle(0x7fd0ff, 1).fillRect(-w / 2, y + 14, w * breakPct, 6);
    }
    if (v.side === 'hero') {
      const hpTxt = `${Math.max(0, Math.round(v.hp))}/${v.maxHp}`;
      let t = v.root.getByName('hpTxt') as Phaser.GameObjects.Text | null;
      if (!t) {
        t = this.add.text(w / 2, y + 14, '', { fontFamily: UI_FONT, fontSize: '16px', color: '#cfd6ff', stroke: '#000', strokeThickness: 3 })
          .setOrigin(1, 0).setName('hpTxt');
        v.root.add(t);
      }
      t.setText(hpTxt);
      if (sp !== undefined) {
        for (let k = 0; k < 6; k++) {
          g.fillStyle(k < sp ? 0x7fd8ff : 0x23304a, 1).fillCircle(-w / 2 + 6 + k * 13, y + 22, 4.5);
        }
      }
    }
  }

  private syncBars(): void {
    this.bs.heroes.forEach((h, i) => {
      const v = this.heroes[i];
      if (!v) return;
      v.hp = h.hp;
      this.drawBars(v, h.sp);
      const st: string[] = [];
      if (h.status.guarding) st.push('🛡防禦');
      if (h.status.taunt) st.push('挑釁');
      if (h.status.counterStance) st.push('反擊');
      if (h.status.poison) st.push('毒');
      if (h.status.umbra) st.push('蝕');
      if (h.status.empowered) st.push('✦');
      v.status.setText(st.join(' '));
    });
    this.bs.enemies.forEach((e, i) => {
      const v = this.enemies[i];
      if (!v) return;
      v.hp = e.hp;
      this.drawBars(v, undefined, e.breakMax ? e.breakGauge / e.breakMax : 0);
      this.setLamps(i, e.downed ? 0 : e.lamps);
      const st: string[] = [];
      if (e.broken) st.push('破防');
      if (e.status.howl) st.push('嚎叫');
      if (e.status.weakRevealed) st.push(`弱:${e.weak.map((w) => ({ fire: '火', light: '光', phys: '物', water: '水', earth: '土', umbra: '蝕' })[w]).join('')}`);
      v.status.setText(st.join(' ')).setColor(e.broken ? '#7fd0ff' : '#ffd27a');
    });
    this.updateTurnBar();
    this.roundText.setText(`第 ${Math.max(1, this.bs.round)} 回合`);
  }

  private setLamps(i: number, n: number): void {
    const v = this.enemies[i];
    if (!v) return;
    while (v.lamps.length < n) {
      const k = v.lamps.length;
      const img = this.add.image(0, 0, 'lamp_icon').setBlendMode(Phaser.BlendModes.ADD).setScale(0);
      v.lamps.add(img);
      this.tweens.add({ targets: img, scale: 1.1, duration: 260, ease: 'Back.Out' });
      this.tweens.add({ targets: img, alpha: 0.7, duration: 300 + k * 30, yoyo: true, repeat: -1 });
    }
    while (v.lamps.length > n) (v.lamps.last as Phaser.GameObjects.Image).destroy();
    v.lamps.each((c: Phaser.GameObjects.GameObject) => {
      const img = c as Phaser.GameObjects.Image;
      const k = v.lamps.getIndex(img);
      img.setX((k - (v.lamps.length - 1) / 2) * 30);
    });
  }

  // ============================================================ HUD
  private buildHud(): void {
    this.turnBar = this.add.container(0, 0).setDepth(500);
    this.roundText = this.add.text(GAME_WIDTH - 24, 40, '', {
      fontFamily: UI_FONT, fontSize: '22px', color: '#aab4dd', stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(500);
    const spd = this.add.text(GAME_WIDTH - 24, 150, '', {
      fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: '#ffd27a', stroke: '#000', strokeThickness: 4,
      backgroundColor: '#0a0d1acc', padding: { x: 12, y: 6 },
    }).setOrigin(1, 0.5).setDepth(520).setInteractive({ useHandCursor: true });
    const applySpeed = () => {
      setBaseSpeed(this, this.speed);
      spd.setText(this.speed > 1 ? '⏩ ×2' : '▶ ×1');
    };
    spd.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.speed = this.speed > 1 ? 1 : 2;
      try {
        localStorage.setItem('jackygame.battleSpeed', String(this.speed));
      } catch {
        /* 無法儲存就算了 */
      }
      SFX.uiTap();
      applySpeed();
    });
    try {
      this.speed = Number(localStorage.getItem('jackygame.battleSpeed') ?? 1) > 1 ? 2 : 1;
    } catch {
      this.speed = 1;
    }
    applySpeed();
    this.add.text(24, 40, '行動順序', { fontFamily: UI_FONT, fontSize: '20px', color: '#7f89b0' }).setOrigin(0, 0.5).setDepth(500);
    this.add.text(36, 938, '星燼', {
      fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: '#ffd27a', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(500);
    this.emberG = this.add.graphics().setDepth(500);
    this.emberShown = this.bs.ember;
    this.drawEmber();
    this.syncBars();
  }

  private drawEmber(): void {
    const g = this.emberG;
    g.clear();
    for (let k = 0; k < MAX_EMBER; k++) {
      const x = 118 + k * 34;
      const y = 938;
      const on = k < this.emberShown;
      g.fillStyle(on ? 0xffa54a : 0x1e2236, 1);
      g.fillPoints([
        new Phaser.Math.Vector2(x, y - 13), new Phaser.Math.Vector2(x + 10, y),
        new Phaser.Math.Vector2(x, y + 13), new Phaser.Math.Vector2(x - 10, y),
      ], true);
      if (on) {
        g.fillStyle(0xfff0c8, 1);
        g.fillCircle(x - 2, y - 3, 3);
      }
    }
  }

  private updateTurnBar(): void {
    this.turnBar.removeAll(true);
    const list: ActorRef[] = [];
    if (this.bs.actor) list.push(this.bs.actor);
    for (const r of this.bs.queue) {
      const u = (r.side === 'hero' ? this.bs.heroes : this.bs.enemies)[r.index];
      if (u && !u.downed) list.push(r);
    }
    list.slice(0, 9).forEach((r, i) => {
      const u = (r.side === 'hero' ? this.bs.heroes : this.bs.enemies)[r.index];
      if (!u) return;
      const x = 52 + i * 66 + (i > 0 ? 14 : 0);
      const y = 96;
      const big = i === 0;
      const col = r.side === 'hero' ? HERO_COLOR[u.id] ?? 0xffffff : 0x8a5cff;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.6).fillCircle(x, y, big ? 32 : 25);
      g.lineStyle(big ? 4 : 2, col, 1).strokeCircle(x, y, big ? 32 : 25);
      if (r.side === 'enemy') g.fillStyle(0x2a1640, 0.9).fillCircle(x, y, big ? 28 : 22);
      const t = this.add.text(x, y, u.name.slice(0, 1), {
        fontFamily: UI_FONT, fontSize: big ? '28px' : '22px', fontStyle: '700', color: r.side === 'hero' ? '#ffffff' : '#d9b8ff',
      }).setOrigin(0.5);
      this.turnBar.add([g, t]);
    });
  }

  // ============================================================ 按鈕
  private buildButtons(): void {
    this.buttonBar = this.add.container(0, 0).setDepth(510);
    const defs: [string, string, () => void][] = [
      ['攻擊', '⚔', () => this.onAttack()],
      ['技能', '✦', () => this.openPanel('skill')],
      ['道具', '◈', () => this.openPanel('item')],
      ['防禦', '⛨', () => this.issue({ type: 'guard' })],
    ];
    defs.forEach(([label, icon, fn], i) => {
      const x = 96 + i * 176;
      const y = 1090;
      const c = this.add.container(x, y);
      const bg = this.add.graphics();
      const ic = this.add.text(0, -26, icon, { fontFamily: UI_FONT, fontSize: '54px', color: '#ffffff' }).setOrigin(0.5);
      const tx = this.add.text(0, 44, label, {
        fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: '#ffffff', stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5);
      c.add([bg, ic, tx]);
      c.setSize(160, 170).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        if (this.mode !== 'command') return;
        pressBounce(this, c);
        SFX.uiTap();
        fn();
      });
      c.setData('bg', bg);
      this.buttons.push(c);
      this.buttonBar.add(c);
    });
    this.paintButtons(0xffa54a);
    this.buttonBar.setAlpha(0.35);
  }

  private paintButtons(color: number): void {
    this.buttons.forEach((c) => {
      const g = c.getData('bg') as Phaser.GameObjects.Graphics;
      g.clear();
      g.fillStyle(0x0a0d1a, 0.92).fillRoundedRect(-80, -85, 160, 170, 22);
      g.fillStyle(color, 0.16).fillRoundedRect(-80, -85, 160, 170, 22);
      g.lineStyle(3, color, 0.9).strokeRoundedRect(-80, -85, 160, 170, 22);
      g.fillStyle(0xffffff, 0.06).fillRoundedRect(-74, -79, 148, 60, 18);
    });
  }

  private setButtonsActive(on: boolean): void {
    this.tweens.add({ targets: this.buttonBar, alpha: on ? 1 : 0.25, y: on ? 0 : 20, duration: 200 });
  }

  // ============================================================ 流程
  private step(): void {
    this.syncBars();
    const s = this.bs;
    if (s.phase === 'victory') return void this.showEnd(true);
    if (s.phase === 'defeat') return void this.showEnd(false);
    if (s.phase === 'playerCommand') return this.enterCommand();
    if (s.phase === 'enemyTelegraph') return void this.runDefense();
  }

  private enterCommand(): void {
    const hero = currentHero(this.bs);
    const idx = this.bs.actor?.index ?? 0;
    if (!hero) return;
    this.mode = 'command';
    this.paintButtons(HERO_COLOR[hero.id] ?? 0xffa54a);
    this.setButtonsActive(true);
    if (this.data0.tutorial) this.coachTip();
    this.heroes.forEach((v, i) => {
      this.tweens.add({ targets: v.root, scale: i === idx ? 1.08 : 0.94, y: i === idx ? v.y - 14 : v.y, alpha: v.dead ? 0.45 : i === idx ? 1 : 0.8, duration: 220, ease: 'Cubic.Out' });
    });
    if (!this.bs.enemies[this.target] || this.bs.enemies[this.target]!.downed) {
      this.target = Math.max(0, this.bs.enemies.findIndex((e) => !e.downed));
    }
    this.showReticle();
  }

  private coachStep = 0;
  private speed = 1;
  private coach?: Phaser.GameObjects.Container;

  /** 教學戰提示（序章）：依序教 攻擊時機 → 燈印 → 共鳴 */
  private coachTip(): void {
    const lamps = this.bs.enemies.reduce((a, e) => a + (e.downed ? 0 : e.lamps), 0);
    let msg = '';
    if (this.coachStep === 0) msg = '按「攻擊」，在光環重疊的瞬間點擊畫面！';
    else if (lamps < 3) msg = '「技能」→「燈印」：在敵人身上點燈。\n完美時機可以一次點 2 盞。';
    else msg = '燈印夠多了！「技能」→「共鳴」一口氣引爆！';
    this.coachStep++;
    this.coach?.destroy();
    const c = this.add.container(GAME_WIDTH / 2, 196).setDepth(860);
    const g = this.add.graphics();
    g.fillStyle(0x0a0d1a, 0.92).fillRoundedRect(-320, -48, 640, 96, 18);
    g.lineStyle(2, 0x7fe8ff, 1).strokeRoundedRect(-320, -48, 640, 96, 18);
    const t = this.add.text(0, 0, msg, {
      fontFamily: UI_FONT, fontSize: '25px', color: '#dff6ff', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);
    c.add([g, t]).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, y: 204, duration: 250 });
    this.coach = c;
  }

  private hideCoach(): void {
    const c = this.coach;
    if (!c) return;
    this.coach = undefined;
    this.tweens.add({ targets: c, alpha: 0, duration: 150, onComplete: () => c.destroy() });
  }

  private showReticle(): void {
    const v = this.enemies[this.target];
    if (!v || this.bs.enemies.filter((e) => !e.downed).length <= 0) return;
    this.reticle.setPosition(v.x, v.y).setAlpha(1).setScale(1.4);
    this.tweens.add({ targets: this.reticle, scale: 1, duration: 200, ease: 'Back.Out' });
  }

  private selectTarget(i: number): void {
    if (this.mode !== 'command') return;
    if (this.bs.enemies[i]?.downed) return;
    this.target = i;
    SFX.uiTap();
    this.showReticle();
  }

  private onAttack(): void {
    this.issue({ type: 'attack', target: this.target });
  }

  private openPanel(kind: 'skill' | 'item'): void {
    const cmds = availableCommands(this.bs).filter((c) => c.type === kind);
    if (cmds.length === 0) {
      floatNumber(this, GAME_WIDTH / 2, 960, kind === 'skill' ? '沒有技能' : '沒有道具', { color: '#aab4dd', size: 28 });
      return;
    }
    this.mode = 'panel';
    const p = this.add.container(0, GAME_HEIGHT).setDepth(520);
    const bg = this.add.graphics();
    const h = 140 + cmds.length * 104;
    bg.fillStyle(0x070912, 0.97).fillRoundedRect(12, -h, GAME_WIDTH - 24, h + 30, 26);
    bg.lineStyle(2, 0xffd27a, 0.6).strokeRoundedRect(12, -h, GAME_WIDTH - 24, h + 30, 26);
    p.add(bg);
    p.add(this.add.text(40, -h + 40, kind === 'skill' ? '技能' : '道具', {
      fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: '#ffd27a',
    }).setOrigin(0, 0.5));
    const close = this.add.text(GAME_WIDTH - 44, -h + 40, '✕ 返回', { fontFamily: UI_FONT, fontSize: '28px', color: '#aab4dd' })
      .setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => {
      SFX.uiCancel();
      this.closePanel();
      this.mode = 'command';
    });
    p.add(close);
    cmds.forEach((c, i) => {
      const y = -h + 100 + i * 104 + 46;
      const row = this.add.container(GAME_WIDTH / 2, y);
      const rb = this.add.graphics();
      rb.fillStyle(c.usable ? 0x18203a : 0x10131e, 1).fillRoundedRect(-320, -44, 640, 90, 16);
      rb.lineStyle(2, c.usable ? 0x7fd8ff : 0x2a3048, 1).strokeRoundedRect(-320, -44, 640, 90, 16);
      const name = this.add.text(-296, -12, c.name, {
        fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: c.usable ? '#ffffff' : '#5a6380',
      }).setOrigin(0, 0.5);
      const desc = this.add.text(-296, 22, this.describe(c), {
        fontFamily: UI_FONT, fontSize: '19px', color: c.usable ? '#9fb0d8' : '#4a5370',
      }).setOrigin(0, 0.5);
      const cost = this.add.text(296, 0, this.costLabel(c), {
        fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: c.costEmber ? '#ffa54a' : '#7fd8ff',
      }).setOrigin(1, 0.5);
      row.add([rb, name, desc, cost]);
      row.setSize(640, 90).setInteractive({ useHandCursor: c.usable });
      row.on('pointerdown', () => {
        if (!c.usable) {
          SFX.uiCancel();
          this.tweens.add({ targets: row, x: row.x + 10, duration: 50, yoyo: true, repeat: 2 });
          return;
        }
        pressBounce(this, row);
        SFX.uiTap();
        this.closePanel();
        if (c.type === 'skill') this.issue({ type: 'skill', skillId: c.skillId, target: this.target });
        else this.issue({ type: 'item', itemId: c.itemId, target: this.lowestHero() });
      });
      p.add(row);
    });
    this.tweens.add({ targets: p, y: GAME_HEIGHT - 20, duration: 280, ease: 'Back.Out' });
    this.panel = p;
  }

  private closePanel(): void {
    const p = this.panel;
    if (!p) return;
    this.panel = undefined;
    this.tweens.add({ targets: p, y: GAME_HEIGHT + 700, duration: 200, ease: 'Cubic.In', onComplete: () => p.destroy() });
  }

  private describe(c: AvailableCommand): string {
    const d: Record<string, string> = {
      lamp_mark: '點燃燈印：完美時 2 盞。每盞讓敵人回合開始灼傷',
      resonance: '引爆全部燈印，燈愈多傷害愈驚人',
      guiding_light: '揭示弱點，隊友下次攻擊 +30%',
      glimmer_song: '全體回復（完美 30%），可復活倒地隊友',
      silence: '打斷敵人的嚎叫',
      rewind: '把隊伍狀態倒回上次被攻擊前（每戰一次）',
      taunt: '2 回合內吸引所有單體攻擊',
      counter_stance: '格擋成功必定反擊',
      veteran_instinct: '2 回合內敵人預兆提早 0.2 秒',
      potion_s: '回復 60 HP（HP 最低的隊友）',
      lamp_oil: '回復 2 SP',
    };
    return d[c.skillId ?? c.itemId ?? ''] ?? '';
  }

  private costLabel(c: AvailableCommand): string {
    if (c.type === 'item') return `×${c.count ?? 0}`;
    if (c.costEmber) return `星燼 ${c.costEmber}`;
    if (c.costSp) return `SP ${c.costSp}`;
    return '';
  }

  private lowestHero(): number {
    let best = 0;
    let pct = 2;
    this.bs.heroes.forEach((h, i) => {
      if (h.downed) return;
      const p = h.hp / h.maxHp;
      if (p < pct) {
        pct = p;
        best = i;
      }
    });
    return best;
  }

  private async issue(cmd: Command): Promise<void> {
    if (this.mode !== 'command' && this.mode !== 'panel') return;
    this.mode = 'busy';
    this.hideCoach();
    this.setButtonsActive(false);
    this.tweens.add({ targets: this.reticle, alpha: 0, duration: 150 });
    let r: ReturnType<typeof chooseCommand>;
    try {
      r = chooseCommand(this.bs, cmd);
    } catch (err) {
      console.warn(err);
      this.enterCommand();
      return;
    }
    this.bs = r.state;
    const heroIdx = r.events.find((e) => e.type === 'command')?.actor.index ?? 0;
    const sk = cmd.skillId ? SKILLS[cmd.skillId] : undefined;
    if (sk) await this.skillBanner(sk.name, HERO_COLOR[this.bs.heroes[heroIdx]?.id ?? ''] ?? 0xffd27a);
    if (this.bs.phase === 'playerTiming') {
      const c = this.bs.pendingCommand!;
      let tx = this.enemies[c.target ?? this.target]?.x ?? 360;
      let ty = this.enemies[c.target ?? this.target]?.y ?? 420;
      if (c.skillId === 'resonance') {
        tx = 360;
        ty = 420;
      } else if (c.skillId === 'glimmer_song') {
        tx = this.heroes[heroIdx]?.x ?? 360;
        ty = (this.heroes[heroIdx]?.y ?? 790) - 20;
      }
      const timing = await this.runTiming(tx, ty);
      await this.heroStrike(heroIdx, c, timing);
      const r2 = resolveTiming(this.bs, timing);
      this.bs = r2.state;
      await this.play([...r.events.filter((e) => e.type !== 'command'), ...r2.events]);
    } else {
      if (cmd.type === 'guard') {
        const v = this.heroes[heroIdx];
        if (v) {
          SFX.parry();
          shockRing(this, v.x, v.y, 0x9fd0ff, 110, 400, 6);
        }
      }
      if (cmd.type === 'item') SFX.itemGet();
      if (cmd.type === 'item' && cmd.itemId === 'blast_bottle') {
        SFX.hitHeavy();
        this.cameras.main.shake(300, 0.014);
        this.cameras.main.flash(160, 255, 150, 80);
      }
      await this.play(r.events);
    }
    this.step();
  }

  private async skillBanner(name: string, color: number): Promise<void> {
    const y = 640;
    const g = this.add.graphics().setDepth(860);
    g.fillStyle(0x000000, 0.65).fillRect(0, y - 38, GAME_WIDTH, 76);
    g.fillStyle(color, 0.9).fillRect(0, y - 38, GAME_WIDTH, 3).fillRect(0, y + 35, GAME_WIDTH, 3);
    const t = this.add.text(GAME_WIDTH / 2, y, name, {
      fontFamily: UI_FONT, fontSize: '40px', fontStyle: '900', color: '#ffffff', stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(861);
    g.setAlpha(0);
    this.tweens.add({ targets: g, alpha: 1, duration: 120, ease: 'Cubic.Out' });
    t.setX(GAME_WIDTH / 2 + 120).setAlpha(0);
    this.tweens.add({ targets: t, x: GAME_WIDTH / 2, alpha: 1, duration: 200, ease: 'Cubic.Out' });
    SFX.blip();
    await wait(this, 520);
    this.tweens.add({ targets: [g, t], alpha: 0, duration: 200, onComplete: () => { g.destroy(); t.destroy(); } });
  }

  // ============================================================ 我方時機
  private runTiming(x: number, y: number): Promise<Timing> {
    return new Promise((resolve) => {
      this.mode = 'timing';
      this.timing = { start: now() + ATTACK_LEAD_MS, x, y, scale: this.bs.windowScale, done: false, resolve };
      const auto = getSettings().autoTiming;
      this.hint.setText(auto ? '自動時機' : '光環重疊時 點擊！').setColor('#ffd27a').setY(990).setAlpha(1);
      if (auto) {
        const tm = this.timing;
        void this.untilReal(tm.start + RING_MS).then(() => {
          if (this.timing === tm) this.finishTiming(null, 'good');
        });
      }
    });
  }

  private finishTiming(at: number | null, forced?: Timing): void {
    const tm = this.timing;
    if (!tm || tm.done) return;
    tm.done = true;
    const target = tm.start + RING_MS;
    const result: Timing = forced ?? (at === null ? 'miss' : judgeAttack(at - target, tm.scale));
    this.ringG.clear();
    this.hint.setAlpha(0);
    const col = result === 'perfect' ? 0xffd27a : result === 'good' ? 0x9fe0ff : 0x777777;
    shockRing(this, tm.x, tm.y, col, result === 'perfect' ? 190 : 120, 340, result === 'perfect' ? 12 : 6);
    if (result === 'perfect') {
      SFX.perfect();
      bigText(this, tm.x, tm.y - 130, 'PERFECT', '#ffd27a', 58, 300);
    } else if (result === 'good') {
      SFX.uiTap();
      bigText(this, tm.x, tm.y - 130, 'GOOD', '#9fe0ff', 46, 220);
    } else {
      bigText(this, tm.x, tm.y - 130, 'MISS', '#8a90a8', 40, 220);
    }
    this.timing = undefined;
    this.mode = 'busy';
    tm.resolve(result);
  }

  private drawTimingRing(t: number): void {
    const tm = this.timing;
    if (!tm) return;
    const g = this.ringG;
    g.clear();
    const p = Phaser.Math.Clamp((t - tm.start) / RING_MS, 0, 1.4);
    const appear = Phaser.Math.Clamp((t - (tm.start - ATTACK_LEAD_MS)) / ATTACK_LEAD_MS, 0, 1);
    // 判定圈
    g.lineStyle(6, 0xffd27a, 0.9 * appear).strokeCircle(tm.x, tm.y, RING_R1);
    g.fillStyle(0xffd27a, 0.12 * appear).fillCircle(tm.x, tm.y, RING_R1);
    // 收縮外圈
    const r = RING_R0 - (RING_R0 - RING_R1) * Math.min(p, 1.4);
    if (r > 8) {
      const close = 1 - Math.min(1, Math.abs(r - RING_R1) / 60);
      g.lineStyle(4 + close * 6, close > 0.85 ? 0xffffff : 0x9fe0ff, appear);
      g.strokeCircle(tm.x, tm.y, r);
    }
    if (t > tm.start + RING_MS + WINDOWS.attackGood * tm.scale + 40) this.finishTiming(null);
  }

  private async heroStrike(i: number, c: Command, timing: Timing): Promise<void> {
    const v = this.heroes[i];
    if (!v) return;
    const tgt = this.enemies[c.target ?? this.target];
    if (c.skillId === 'glimmer_song') {
      SFX.levelUp();
      sparks(this, v.x, v.y - 40, 30, 'spark', 0x9fe8ff, 300);
      await wait(this, 300);
      return;
    }
    if (c.skillId === 'resonance') return;
    const dx = tgt ? (tgt.x - v.x) * 0.25 : 0;
    await new Promise<void>((res) =>
      this.tweens.add({ targets: v.root, x: v.x + dx, y: v.y - 120, scale: 1.15, duration: 140, ease: 'Cubic.In', onComplete: () => res() }),
    );
    if (c.skillId === 'lamp_mark' && tgt) {
      // 燈火飛向目標
      const orb = this.add.image(v.x + dx, v.y - 150, 'ember').setScale(1.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(750);
      await new Promise<void>((res) =>
        this.tweens.add({ targets: orb, x: tgt.x, y: tgt.y - 30, duration: 200, ease: 'Quad.In', onComplete: () => { orb.destroy(); res(); } }),
      );
    }
    if (timing === 'perfect') void slowMo(this, 0.25, 180);
    this.tweens.add({ targets: v.root, x: v.x, y: v.y - 14, scale: 1.08, duration: 320, delay: 80, ease: 'Cubic.Out' });
  }

  // ============================================================ 敵方防守
  private async runDefense(): Promise<void> {
    const tel = this.lastTelegraph;
    if (!tel) {
      // 不應發生：沒有預兆事件 → 視同全部失敗
      this.bs = resolveDefense(this.bs, []).state;
      return this.step();
    }
    this.mode = 'busy';
    this.setButtonsActive(false);
    this.heroes.forEach((v) => this.tweens.add({ targets: v.root, scale: 1, y: v.y, duration: 200 }));
    const ev = this.enemies[tel.enemy];
    const color = TELE_COLOR[tel.telegraph];
    const scale = tel.windowScale;
    const lead = tel.windUpMs + tel.leadBonusMs + 350 + (this.data0.tutorial ? 500 : 0); // 讓玩家看清楚預兆
    const t0 = now();
    const impacts = tel.hits.map((h) => t0 + lead + h);
    const targetHero = tel.targets.length > 1 ? -1 : tel.targets[0] ?? 0;
    this.defense = { tele: tel.telegraph, impacts, targetHero, taps: [], swipes: [], presses: [], scale, ringStart: t0 + 200 };
    this.gestures = new GestureTracker();

    // 預兆：敵人發光 + 畫面邊緣暈光 + 提示
    if (ev) {
      ev.aura.setTint(color).setAlpha(0).setScale(1);
      this.tweens.add({ targets: ev.aura, alpha: 0.95, scale: 1.9, duration: lead * 0.8, ease: 'Quad.In' });
      this.tweens.add({ targets: ev.root, y: ev.y - 26, scale: 1.08, duration: lead, ease: 'Quad.In' });
      if (this.isWebGL) ev.sprite.setTintFill(color);
      this.time.delayedCall(90, () => ev.sprite.clearTint());
    }
    this.edge.setTint(color);
    this.tweens.add({ targets: this.edge, alpha: tel.telegraph === 'white' ? 0.35 : 0.55, duration: 250 });
    const atkName = ENEMIES[this.bs.enemies[tel.enemy]?.id ?? '']?.attacks.find((a) => a.id === tel.attack)?.name ?? '';
    this.hint.setText(`${atkName}　${getSettings().autoTiming ? '自動防守' : TELE_HINT[tel.telegraph]}`).setColor(Phaser.Display.Color.IntegerToColor(color).rgba).setY(990).setAlpha(0);
    this.tweens.add({ targets: this.hint, alpha: 1, duration: 150 });
    const gestureIcon = this.gestureIcon(tel.telegraph, color);
    this.tweens.add({ targets: this.buttonBar, alpha: 0.06, duration: 200 });
    SFX.blip();
    this.mode = 'defense';

    const results: DefenseResult[] = [];
    for (let h = 0; h < impacts.length; h++) {
      const impact = impacts[h]!;
      await this.untilReal(impact);
      // 敵人出擊（命中瞬間）
      this.enemyLunge(tel.enemy, targetHero);
      // 若已有成功輸入，立即結算；否則等待晚按的寬限
      // 自動時機：防守固定成功
      let r = getSettings().autoTiming ? 'success' as DefenseResult : this.evalHit(h, false);
      if (r === null) {
        await this.untilReal(impact + (tel.telegraph === 'purple' ? 20 : WINDOWS.parryGood * scale));
        r = this.evalHit(h, true) ?? 'fail';
      }
      results.push(r);
      await this.defenseFx(r, tel.telegraph, targetHero);
    }
    this.mode = 'busy';
    this.defense = undefined;
    this.ringG.clear();
    this.tweens.add({ targets: [this.edge, this.hint], alpha: 0, duration: 250 });
    this.tweens.add({ targets: gestureIcon, alpha: 0, duration: 200, onComplete: () => gestureIcon.destroy() });
    if (ev) {
      this.tweens.add({ targets: ev.aura, alpha: 0, duration: 300 });
      this.tweens.add({ targets: ev.root, x: ev.x, y: ev.y, scale: 1, duration: 350, ease: 'Cubic.Out' });
    }
    this.lastTelegraph = undefined;
    const r = resolveDefense(this.bs, results);
    this.bs = r.state;
    await this.play(r.events);
    this.step();
  }

  /** 手勢圖示（👆點擊 / 👉滑動 / ✋長按），在提示字下方循環示範 */
  private gestureIcon(tele: Telegraph, color: number): Phaser.GameObjects.Container {
    const c = this.add.container(GAME_WIDTH / 2, 1100).setDepth(890);
    const g = this.add.graphics();
    const finger = this.add.graphics();
    finger.fillStyle(0xffffff, 1).fillCircle(0, 0, 16);
    finger.fillStyle(0xffffff, 0.9).fillRoundedRect(-9, 0, 18, 50, 8);
    c.add([g, finger]);
    const tws: Phaser.Tweens.Tween[] = [];
    c.once(Phaser.GameObjects.Events.DESTROY, () => tws.forEach((t) => t.remove()));
    if (tele === 'white') {
      tws.push(this.tweens.add({ targets: finger, y: 12, scale: 0.9, duration: 220, yoyo: true, repeat: -1, repeatDelay: 250 }));
      tws.push(this.tweens.addCounter({
        from: 0, to: 1, duration: 470, repeat: -1,
        onUpdate: (tw) => {
          const v = tw.getValue() ?? 0;
          g.clear().lineStyle(4, color, 1 - v).strokeCircle(0, 0, 20 + v * 50);
        },
      }));
    } else if (tele === 'red') {
      g.lineStyle(6, color, 0.9).lineBetween(-90, 0, 90, 0).lineBetween(90, 0, 70, -16).lineBetween(90, 0, 70, 16);
      finger.setX(-80);
      tws.push(this.tweens.add({ targets: finger, x: 80, duration: 300, ease: 'Quad.In', repeat: -1, repeatDelay: 300 }));
    } else {
      tws.push(this.tweens.addCounter({
        from: 0, to: 1, duration: 800, repeat: -1,
        onUpdate: (tw) => {
          const v = tw.getValue() ?? 0;
          g.clear().lineStyle(6, 0x333344, 1).strokeCircle(0, 0, 44);
          g.lineStyle(6, color, 1).beginPath().arc(0, 0, 44, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2).strokePath();
        },
      }));
    }
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 150 });
    return c;
  }

  private untilReal(t: number): Promise<void> {
    return new Promise((res) => {
      const tick = () => (now() >= t - 4 ? res() : window.setTimeout(tick, Math.min(16, Math.max(1, t - now() - 4))));
      tick();
    });
  }

  /** 回傳 null 表示「還沒有成功輸入，可再等」（final=false 時） */
  private evalHit(h: number, final: boolean): DefenseResult | null {
    const d = this.defense;
    if (!d) return 'fail';
    const impact = d.impacts[h]!;
    const prevImpact = h > 0 ? d.impacts[h - 1]! : -Infinity;
    const minAt = Math.max(prevImpact + 60, impact - 600);
    if (d.tele === 'white' || d.tele === 'red') {
      const pool = d.tele === 'white' ? d.taps : d.swipes;
      let best: DefenseResult = 'fail';
      let bestIdx = -1;
      pool.forEach((at, k) => {
        if (at < minAt) return;
        const r = judgeDefense(d.tele, { kind: d.tele === 'white' ? 'tap' : 'swipe', deltaMs: at - impact }, d.scale);
        const rank = (x: DefenseResult) => (x === 'perfect' ? 2 : x === 'success' ? 1 : 0);
        if (rank(r) > rank(best)) {
          best = r;
          bestIdx = k;
        }
      });
      if (bestIdx >= 0) pool.splice(bestIdx, 1);
      if (best === 'fail' && !final) return null;
      return best;
    }
    // purple：長按
    for (const pr of d.presses) {
      if (pr.at < minAt) continue;
      const r = judgeDefense('purple', { kind: 'hold', deltaMs: pr.at - impact, holdUntilImpact: pr.up === undefined || pr.up >= impact }, d.scale);
      if (r !== 'fail') return r;
    }
    return final ? 'fail' : null;
  }

  private enemyLunge(enemy: number, targetHero: number): void {
    const ev = this.enemies[enemy];
    if (!ev) return;
    const hv = this.heroes[targetHero >= 0 ? targetHero : 1] ?? this.heroes[0];
    const tx = hv ? ev.x + (hv.x - ev.x) * 0.55 : ev.x;
    const ty = hv ? ev.y + (hv.y - ev.y) * 0.55 : ev.y + 200;
    this.tweens.killTweensOf(ev.root);
    this.tweens.add({ targets: ev.root, x: tx, y: ty, scale: 1.25, duration: 70, ease: 'Quad.In', yoyo: true, hold: 90 });
  }

  private async defenseFx(r: DefenseResult, tele: Telegraph, targetHero: number): Promise<void> {
    const targets = targetHero >= 0 ? [targetHero] : this.heroes.map((_, i) => i);
    const v0 = this.heroes[targets[0] ?? 0];
    if (!v0) return;
    const x = targetHero >= 0 ? v0.x : 360;
    const y = v0.y - 40;
    if (r === 'fail') {
      this.cameras.main.shake(160, 0.012);
      this.edge.setTint(0xff2020).setAlpha(0.8);
      this.tweens.add({ targets: this.edge, alpha: 0.3, duration: 220 });
      return;
    }
    if (tele === 'white') {
      SFX.parry();
      sparks(this, x, y - 30, r === 'perfect' ? 36 : 18, 'spark', 0xffffff, 520);
      shockRing(this, x, y - 30, r === 'perfect' ? 0xffd27a : 0xdfe8ff, r === 'perfect' ? 180 : 110, 300, 8);
    } else if (tele === 'red') {
      SFX.dodge();
      for (const i of targets) {
        const v = this.heroes[i];
        if (v) this.tweens.add({ targets: v.root, x: v.x + 70, duration: 90, yoyo: true, hold: 120, ease: 'Cubic.Out' });
      }
    } else {
      SFX.lampPlace(4);
      shockRing(this, x, y, 0xd6b0ff, 200, 420, 10);
      sparks(this, x, y, 30, 'ember', 0xc8a0ff, 300);
    }
    const label = r === 'perfect' ? 'PERFECT' : tele === 'white' ? '格擋' : tele === 'red' ? '閃避' : '引路';
    bigText(this, x, y - 140, label, r === 'perfect' ? '#ffd27a' : '#dfe8ff', r === 'perfect' ? 56 : 44, 240);
    if (r === 'perfect') {
      await hitStop(this, 70);
      void slowMo(this, 0.3, 160);
    }
  }

  // ============================================================ 輸入
  private onPointer(kind: 'down' | 'move' | 'up', p: Phaser.Input.Pointer): void {
    const t = eventTime(p);
    if (this.mode === 'timing') {
      if (kind === 'down' && this.timing && t >= this.timing.start - ATTACK_LEAD_MS * 0.5) this.finishTiming(t);
      return;
    }
    if (this.mode !== 'defense' || !this.defense) return;
    let out: Gesture[] = [];
    if (kind === 'down') {
      out = this.gestures.pointerDown(t, p.x, p.y);
      this.defense.presses.push({ at: t });
      // 即時回饋：點擊閃一下
      if (this.defense.tele === 'white') {
        this.defense.taps.push(t);
        const hv = this.heroes[this.defense.targetHero] ?? this.heroes[0];
        if (hv) shockRing(this, hv.x, hv.y - 70, 0xffffff, 60, 160, 4);
      }
    } else if (kind === 'move') out = this.gestures.pointerMove(t, p.x, p.y);
    else {
      out = this.gestures.pointerUp(t, p.x, p.y);
      const last = this.defense.presses[this.defense.presses.length - 1];
      if (last && last.up === undefined) last.up = t;
    }
    for (const g of out) if (g.kind === 'swipe') this.defense.swipes.push(g.at);
  }

  update(): void {
    const t = now();
    if (this.timing) this.drawTimingRing(t);
    if (this.mode === 'defense' && this.defense) {
      this.gestures.update(t);
      // 命中提示圈：收縮到目標英雄身上
      const d = this.defense;
      const next = d.impacts.find((im) => im > t - 40);
      const g = this.ringG;
      g.clear();
      if (next !== undefined) {
        const hv = this.heroes[d.targetHero] ?? this.heroes[1] ?? this.heroes[0];
        if (hv) {
          const x = d.targetHero >= 0 ? hv.x : 360;
          const y = hv.y - 40;
          const span = Math.max(300, next - d.ringStart);
          const p = Phaser.Math.Clamp(1 - (next - t) / span, 0, 1);
          const col = TELE_COLOR[d.tele];
          g.lineStyle(5, col, 0.8).strokeCircle(x, y, 60);
          g.lineStyle(3 + p * 6, col, 0.3 + p * 0.7).strokeCircle(x, y, 60 + (1 - p) * 150);
          const holding = d.tele === 'purple' && d.presses.some((pr) => pr.up === undefined);
          if (holding) g.fillStyle(col, 0.25).fillCircle(x, y, 60);
        }
      }
    }
  }

  // ============================================================ 事件播放
  private async play(events: BattleEvent[]): Promise<void> {
    for (const e of events) await this.playOne(e);
    this.syncBars();
  }

  /** 這場劇情戰已經輸過幾次（不屈之燈加成用） */
  private retryCount(): number {
    const v = session.state.flags[`retry_${this.data0.encounter}`];
    return typeof v === 'number' ? v : 0;
  }

  private viewOf(r: ActorRef): UnitView | undefined {
    return (r.side === 'hero' ? this.heroes : this.enemies)[r.index];
  }

  private async playOne(e: BattleEvent): Promise<void> {
    switch (e.type) {
      case 'turnStart':
        this.updateTurnBar();
        return;
      case 'telegraph':
        this.lastTelegraph = e;
        return;
      case 'damage':
        return this.fxDamage(e);
      case 'heal': {
        const v = this.viewOf(e.target);
        if (!v || e.amount <= 0) return;
        v.hp = Math.min(v.maxHp, v.hp + e.amount);
        if (e.target.side === 'hero') this.drawBars(v, this.bs.heroes[e.target.index]?.sp);
        else {
          const be = this.bs.enemies[e.target.index];
          this.drawBars(v, undefined, be ? be.breakGauge / Math.max(1, be.breakMax) : undefined);
        }
        floatNumber(this, v.x, v.y - 80, `+${e.amount}`, { color: '#7dffb0', size: 40 });
        sparks(this, v.x, v.y - 20, 14, 'spark', 0x7dffb0, 200);
        await wait(this, 120);
        return;
      }
      case 'lampPlaced': {
        const v = this.enemies[e.target];
        const have = v?.lamps.length ?? 0;
        for (let k = 0; k < e.count; k++) {
          SFX.lampPlace(e.total - e.count + k);
          this.setLamps(e.target, have + k + 1);
          if (v) sparks(this, v.x, v.y - 40, 16, 'ember', undefined, 260);
          await wait(this, 160);
        }
        return;
      }
      case 'resonance':
        return this.fxResonance(e);
      case 'break': {
        const v = this.enemies[e.target];
        if (!v) return;
        SFX.break();
        sparks(this, v.x, v.y, 40, 'shard', 0x9fe0ff, 620);
        bigText(this, v.x, v.y - 120, 'BREAK', '#9fe0ff', 64, 380);
        this.tweens.add({ targets: v.sprite, angle: 12, duration: 200, yoyo: true, hold: 300 });
        this.cameras.main.shake(220, 0.014);
        await wait(this, 380);
        return;
      }
      case 'statusApplied': {
        const v = this.viewOf(e.target);
        const lbl = STATUS_LABEL[e.status];
        if (!v || !lbl) return;
        if (e.status === 'guarding') return;
        floatNumber(this, v.x, v.y - (v.side === 'enemy' ? 90 : 120), lbl, { color: e.target.side === 'enemy' ? '#ffd27a' : '#c8b0ff', size: 28 });
        if (e.status === 'howl') {
          this.cameras.main.shake(400, 0.008);
          SFX.hitHeavy();
        }
        await wait(this, 260);
        return;
      }
      case 'counter': {
        const v = this.heroes[e.hero];
        if (v) floatNumber(this, v.x, v.y - 140, '反擊！', { color: '#ffd27a', size: 30 });
        return;
      }
      case 'downed': {
        const v = this.viewOf(e.target);
        if (!v) return;
        v.dead = true;
        if (v.side === 'enemy') {
          sparks(this, v.x, v.y, 50, 'ember', 0xb48cff, 420);
          shockRing(this, v.x, v.y, 0xb48cff, 160, 500, 6);
          this.tweens.add({ targets: v.root, alpha: 0, scaleX: 1.3, scaleY: 0.2, duration: 500, ease: 'Cubic.In' });
          if (e.target.index === this.target) this.reticle.setAlpha(0);
          SFX.hitHeavy();
          await wait(this, 300);
        } else {
          this.tweens.add({ targets: v.root, alpha: 0.4, duration: 300 });
          v.sprite.setTint(0x555566);
          floatNumber(this, v.x, v.y - 120, '倒地', { color: '#ff7a7a', size: 30 });
          await wait(this, 300);
        }
        return;
      }
      case 'revived': {
        const v = this.viewOf(e.target);
        if (!v) return;
        v.dead = false;
        v.hp = e.hp;
        v.sprite.clearTint();
        this.tweens.add({ targets: v.root, alpha: 1, duration: 300 });
        sparks(this, v.x, v.y, 24, 'spark', 0xffffff, 260);
        return;
      }
      case 'phaseChange': {
        const v = this.enemies[e.enemy];
        this.tweens.add({ targets: this.dim, alpha: 0.6, duration: 300, yoyo: true, hold: 700 });
        this.cameras.main.shake(900, 0.012);
        SFX.hitHeavy();
        await wait(this, 300);
        if (v) shockRing(this, v.x, v.y, 0xb46bff, 420, 800, 14);
        bigText(this, GAME_WIDTH / 2, 560, '霧起', '#d9b8ff', 90, 700);
        this.fog.forEach((f) => this.tweens.add({ targets: f, alpha: 0.32, duration: 1200 }));
        floatNumber(this, GAME_WIDTH / 2, 660, '判定窗口縮小', { color: '#c8b0ff', size: 28 });
        await wait(this, 1100);
        return;
      }
      case 'emberDrained': {
        // 吞噬星燼：星燼珠從星燼條飛向敵人，紫色吸收演出
        const v = this.enemies[e.enemy];
        if (!v) return;
        const from = this.emberShown;
        bigText(this, GAME_WIDTH / 2, 640, `星燼被吞噬 −${e.amount}`, '#c8a0ff', 44, 520);
        this.cameras.main.shake(260, 0.006);
        for (let k = 0; k < e.amount; k++) {
          const x = 118 + Math.max(0, from - 1 - k) * 34;
          const orb = this.add.image(x, 938, 'ember').setScale(1.4).setTint(0xc8a0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(760);
          this.tweens.add({
            targets: orb, x: v.x, y: v.y - 30, scale: 0.4, duration: 520, delay: k * 120, ease: 'Cubic.easeIn',
            onComplete: () => {
              sparks(this, v.x, v.y - 30, 18, 'ember', 0xb48cff, 300);
              orb.destroy();
            },
          });
        }
        SFX.lampPlace(0);
        await wait(this, 520 + e.amount * 120);
        return;
      }
      case 'ember': {
        this.emberShown = e.total;
        this.drawEmber();
        if (e.delta > 0) {
          const x = 118 + (e.total - 1) * 34;
          sparks(this, x, 938, 10, 'ember', undefined, 160);
          SFX.save();
        }
        return;
      }
      case 'skip': {
        const v = this.viewOf(e.actor);
        if (v && e.reason === 'broken') {
          floatNumber(this, v.x, v.y - 90, '破防中…', { color: '#9fe0ff', size: 28 });
          await wait(this, 400);
        }
        return;
      }
      default:
        return;
    }
  }

  private async fxDamage(e: Extract<BattleEvent, { type: 'damage' }>): Promise<void> {
    const v = this.viewOf(e.target);
    if (!v) return;
    v.hp = Math.max(0, v.hp - e.amount);
    const isEnemy = e.target.side === 'enemy';
    const pct = e.amount / v.maxHp;
    const dot = e.source === 'burn' || e.source === 'poison';
    if (!dot) {
      // 白閃 + 擊退
      v.sprite.setTintFill(0xffffff);
      this.time.delayedCall(70, () => {
        if (!v.dead || isEnemy) v.sprite.clearTint();
      });
      const kx = isEnemy ? 0 : 0;
      const ky = isEnemy ? -18 : 18;
      this.tweens.add({ targets: v.sprite, x: kx + Phaser.Math.Between(-8, 8), y: ky, duration: 60, yoyo: true, ease: 'Quad.Out' });
      sparks(this, v.x, v.y - 20, Math.round(10 + pct * 60), e.crit ? 'ember' : 'spark', e.weak ? 0xffb060 : undefined, 380 + pct * 400);
      if (pct > 0.18 || e.crit) SFX.hitHeavy();
      else SFX.hitLight();
      this.cameras.main.shake(80 + pct * 300, Math.min(0.025, 0.004 + pct * 0.05));
    }
    const color = dot ? (e.source === 'poison' ? '#9dff6a' : '#ffa54a') : isEnemy ? (e.crit ? '#ffd27a' : e.weak ? '#ffb060' : '#ffffff') : '#ff6a6a';
    const size = dot ? 30 : e.crit ? 64 : e.weak ? 54 : 46;
    const label = e.source === 'counter' ? '反擊' : e.weak && !dot ? '弱點！' : e.source === 'burn' ? '灼燒' : undefined;
    floatNumber(this, v.x, v.y - (isEnemy ? 60 : 90), `${e.amount}`, { color, size, label });
    const be = isEnemy ? this.bs.enemies[e.target.index] : undefined;
    this.drawBars(v, isEnemy ? undefined : this.bs.heroes[e.target.index]?.sp, be ? be.breakGauge / Math.max(1, be.breakMax) : undefined);
    if (!dot) await hitStop(this, Math.round(50 + Math.min(70, pct * 200)));
    await wait(this, dot ? 260 : 120);
  }

  private async fxResonance(e: Extract<BattleEvent, { type: 'resonance' }>): Promise<void> {
    const cam = this.cameras.main;
    this.tweens.add({ targets: this.dim, alpha: 0.7, duration: 250 });
    await wait(this, 260);
    // 燈印依序亮起（音階上升）
    let k = 0;
    for (const p of e.perTarget) {
      const v = this.enemies[p.target];
      if (!v) continue;
      v.root.setDepth(650);
      for (let n = 0; n < p.lamps; n++) {
        SFX.lampPlace(k++);
        const img = v.lamps.getAt(n) as Phaser.GameObjects.Image | undefined;
        if (img) this.tweens.add({ targets: img, scale: 2.2, duration: 120, yoyo: true });
        sparks(this, v.x, v.y - 60, 10, 'ember', undefined, 200);
        await wait(this, 140);
      }
    }
    SFX.resonance();
    cam.zoomTo(0.92, 250, 'Cubic.Out');
    await wait(this, 300);
    // 光柱 + 衝擊波
    for (const p of e.perTarget) {
      const v = this.enemies[p.target];
      if (!v) continue;
      const pil = this.add.image(v.x, v.y - 200, 'pillar').setDepth(760).setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(30 + p.lamps * 30, 900).setAlpha(0);
      this.tweens.add({ targets: pil, alpha: 1, displayWidth: 60 + p.lamps * 40, duration: 120, yoyo: true, hold: 260, onComplete: () => pil.destroy() });
      shockRing(this, v.x, v.y, 0xffd27a, 260 + p.lamps * 30, 600, 14);
      sparks(this, v.x, v.y, 30 + p.lamps * 10, 'ember', undefined, 700);
    }
    cam.flash(200, 255, 230, 180);
    cam.shake(500, 0.02 + e.totalLamps * 0.003);
    cam.zoomTo(1.06, 120, 'Quad.Out');
    this.time.delayedCall(140, () => cam.zoomTo(1, 500, 'Cubic.Out'));
    if (e.totalLamps >= 5) bigText(this, GAME_WIDTH / 2, 260, '五燈共鳴', '#ffd27a', 80, 700);
    await hitStop(this, 120);
    this.tweens.add({ targets: this.dim, alpha: 0, duration: 400 });
    this.enemies.forEach((v) => v.root.setDepth(100));
    this.enemies.forEach((_, i) => this.setLamps(i, 0));
  }

  // ============================================================ 結束
  private async showEnd(win: boolean): Promise<void> {
    this.mode = 'end';
    this.setButtonsActive(false);
    this.reticle.setAlpha(0);
    await wait(this, 500);
    this.tweens.add({ targets: this.dim, alpha: 0.65, duration: 400 });
    const xp = win ? this.bs.enemies.reduce((a, e) => a + (ENEMIES[e.id]?.xp ?? 0), 0) : 0;
    if (win) {
      SFX.roundWin();
      this.time.delayedCall(300, () => SFX.levelUp());
      bigText(this, GAME_WIDTH / 2, 470, 'VICTORY', '#ffd27a', 110, -1);
      sparks(this, GAME_WIDTH / 2, 470, 60, 'ember', undefined, 700);
    } else {
      bigText(this, GAME_WIDTH / 2, 470, '燈火熄滅……', '#ff8a8a', 72, -1);
    }
    await wait(this, 500);
    if (win) {
      const t = this.add.text(GAME_WIDTH / 2, 590, '', {
        fontFamily: UI_FONT, fontSize: '32px', color: '#ffffff', stroke: '#000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(960);
      const o = { v: 0 };
      this.tweens.add({ targets: o, v: xp, duration: 700, onUpdate: () => t.setText(`經驗值 +${Math.round(o.v)}`) });
      const g = this.add.graphics().setDepth(960);
      const bar = { p: 0 };
      this.tweens.add({
        targets: bar, p: 1, duration: 800, ease: 'Cubic.Out',
        onUpdate: () => {
          g.clear();
          g.fillStyle(0x000000, 0.7).fillRoundedRect(160, 630, 400, 16, 8);
          g.fillStyle(0xffd27a, 1).fillRoundedRect(160, 630, 400 * bar.p, 16, 8);
        },
      });
    }
    await wait(this, 600);
    const next = win ? this.data0.chain[0] : this.data0.encounter;
    const story = this.data0.story;
    if (story && win) {
      for (const m of session.state.party) {
        const ups = grantXp(session.state, m, xp);
        if (ups > 0) {
          const v = this.heroes[this.bs.heroes.findIndex((h) => h.id === m)];
          if (v) bigText(this, v.x, v.y - 150, 'LEVEL UP', '#7dffb0', 40, 900);
        }
      }
      for (const it of ['potion_s', 'lamp_oil', 'blast_bottle'] as const) {
        const left = this.bs.items[it];
        if (left !== undefined) session.state.inventory[it] = left;
      }
    }
    const label = story ? (win ? '繼續 ▶' : '重新振作') : win ? (next ? '繼續前進 ▶' : '回到標題') : '再試一次';
    const btn = this.add.container(GAME_WIDTH / 2, 800).setDepth(970);
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0d1a, 0.95).fillRoundedRect(-200, -50, 400, 100, 24);
    bg.lineStyle(3, 0xffd27a, 1).strokeRoundedRect(-200, -50, 400, 100, 24);
    const tx = this.add.text(0, 0, label, { fontFamily: UI_FONT, fontSize: '36px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5);
    btn.add([bg, tx]).setSize(400, 100).setInteractive({ useHandCursor: true }).setAlpha(0);
    this.tweens.add({ targets: btn, alpha: 1, duration: 300 });
    this.tweens.add({ targets: btn, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    btn.on('pointerdown', () => {
      SFX.confirm();
      pressBounce(this, btn);
      fadeOutThen(this, 350, () => {
        if (story) {
          // 不屈之燈：劇情戰敗北次數記在存檔，下次同一場戰鬥開場加成；勝利後清除
          const key = `retry_${this.data0.encounter}`;
          if (win) delete session.state.flags[key];
          else session.state.flags[key] = this.retryCount() + 1;
          session.save();
          this.scene.stop();
          this.scene.wake('Dialogue', { outcome: win ? 'win' : 'lose' });
        } else if (win && !next) this.scene.start('Title');
        else {
          this.scene.restart({
            encounter: next, party: this.data0.party, chain: win ? this.data0.chain.slice(1) : this.data0.chain,
          } satisfies BattleSceneData);
        }
      });
    });
  }
}
