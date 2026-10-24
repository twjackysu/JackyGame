// 即時戰鬥試玩場景（除錯入口：?debug&scene=RtBattle&stage=forest_entry；D-063／D-065，design/20 §B8 P1）。
// Phaser 只負責畫 BattleState 與收輸入 → BattleCommand；戰鬥結果全部由 src/core/battle/rt 決定（D-062）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { SKILLS, STAGES } from '../../core/battle/rt/data';
import { createBattle, enemiesOf, playerOf, step } from '../../core/battle/rt/engine';
import { BOT_PROFILES, PlayerBot, summarize } from '../../core/battle/rt/sim';
import type { BattleCommand, BattleState, Shape, Unit } from '../../core/battle/rt/types';
import { CAMPFIRE_RULES, TICKS_PER_SEC, UNIT } from '../../core/battle/rt/types';
import { cellIndex, findPath, gridOf } from '../../core/battle/rt/path';
import { ENEMIES, SWORDSMAN } from '../../core/battle/rt/data';
import { GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, bigText, floatNumber, shockRing, sparks } from '../fx/feel';

const STEP_MS = 1000 / TICKS_PER_SEC;
const STAGE_IDS = Object.keys(STAGES);
const SKILL_KEYS = ['heavy_slash', 'whirlwind', 'charge', 'parry'] as const;
/** 畫面橫向可見的世界格數 */
const VIEW_UNITS_W = 1050;
/** 世界可視區：標題列下方到畫面底（操作鍵疊在上面） */
const VIEW_TOP = 110;
const VIEW_BOTTOM = 1280;
/** 主角在可視區的垂直位置（偏上，留空間給下方操作鍵） */
const FOCUS_Y = 0.42;
/** 立繪對應（D-067；沒有圖就退回程式圓形） */
const SPRITE: Record<string, { key: string; h: number; flip: boolean; tint?: number }> = {
  swordsman: { key: 'hero_lian', h: 3.6, flip: true },
  wolf: { key: 'enemy_mist_wolf', h: 2.9, flip: true },
  wolf_pup: { key: 'enemy_mist_wolf', h: 2.9, flip: true, tint: 0xc8e0ff },
  alpha_wolf: { key: 'enemy_mist_wolf', h: 2.8, flip: true, tint: 0xffb080 },
  thorn_shooter: { key: 'enemy_thorn_shroom', h: 2.9, flip: false },
  wolf_king: { key: 'enemy_boss_wolfking', h: 3.0, flip: false },
};
const HINT_KEY = 'jg_rt_hint_seen';
const fx0 = (x: Unit): number => x.facingX / 1000;
const fy0 = (x: Unit): number => x.facingY / 1000;

export class RtBattleScene extends Phaser.Scene {
  private s!: BattleState;
  private stageId = 'forest_entry';
  private seed = 1;
  private acc = 0;
  private g!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Graphics;
  private evIdx = 0;
  private k = 0.4;
  private ox = 0;
  private oy = 0;
  private pending: BattleCommand[] = [];
  private stick: { id: number; bx: number; by: number; dx: number; dy: number } | null = null;
  private btnText: Phaser.GameObjects.Text[] = [];
  private bot: PlayerBot | null = null;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  private ended = false;
  private hud!: Phaser.GameObjects.Text;
  /** 單位圖層（HP 條等疊在 sprite 上方） */
  private top!: Phaser.GameObjects.Graphics;
  /** 靜態地面（只畫一次，每幀只移動位置） */
  private ground!: Phaser.GameObjects.Image;
  private calmText!: Phaser.GameObjects.Text;
  /** 上一 tick 的座標（60 FPS 插值用） */
  private prev = new Map<number, { x: number; y: number }>();
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  /** 點地移動的路徑預覽（世界座標）；玩家換格或目的地改變才重算 */
  private pathPreview: { key: string; pts: [number, number][] } | null = null;
  /** 點了營火：走到旁邊就自動休息 */
  private restOnArrive = false;
  private flashUntil = new Map<number, number>();
  /** 命中停頓（hit-stop）剩餘毫秒：期間不推進模擬 */
  private hitStop = 0;
  /** 鏡頭（世界座標，鏡頭中心） */
  private camX = 0;
  private camY = 0;
  private hint: Phaser.GameObjects.Container | null = null;
  /** 已播過特效的技能段（`施放 tick:段`） */
  private fxDone = new Set<string>();
  /** 選單開著＝暫停 */
  private menu: Phaser.GameObjects.Container | null = null;
  private botName: string | null = null;
  private lastWarnTick = -1;

  constructor() {
    super('RtBattle');
  }

  init(data: { stage?: string; seed?: number; bot?: string }): void {
    const q = new URLSearchParams(window.location.search);
    this.stageId = data.stage ?? q.get('stage') ?? 'forest_entry';
    if (!STAGES[this.stageId]) this.stageId = 'forest_entry';
    this.seed = data.seed ?? Number(q.get('seed') ?? 1);
    const b = (data.bot !== undefined ? data.bot : q.get('bot')) as keyof typeof BOT_PROFILES | null;
    this.bot = b && BOT_PROFILES[b] ? new PlayerBot({ ...BOT_PROFILES[b], ult: true, potionAtPct: b === 'auto' ? undefined : 35 }, b) : null;
    this.botName = this.bot ? b : null;
  }

  create(): void {
    this.s = createBattle({ stageId: this.stageId, seed: this.seed });
    this.acc = 0;
    this.evIdx = 0;
    this.ended = false;
    this.pending = [];
    this.stick = null;
    // 鏡頭：畫面寬約 10.5 格（角色夠大、手機看得清楚），跟隨主角（D-067）
    this.k = GAME_WIDTH / VIEW_UNITS_W;
    this.prev.clear();
    this.sprites.clear();
    this.flashUntil.clear();
    this.fxDone.clear();
    this.hitStop = 0;
    const p0 = playerOf(this.s);
    this.camX = p0.x;
    this.camY = p0.y;
    this.updateCamera(1);
    this.cameras.main.setBackgroundColor('#0b1410');
    this.ground = this.makeGround();
    this.g = this.add.graphics();
    this.top = this.add.graphics().setDepth(45);
    this.ui = this.add.graphics().setDepth(50);
    // 頂部標題列（蓋在世界之上；底部漸層避免硬切）
    const hdr = this.add.graphics().setDepth(48);
    hdr.fillStyle(0x0b1410, 0.94).fillRect(0, 0, GAME_WIDTH, VIEW_TOP);
    for (let i = 0; i < 12; i++) hdr.fillStyle(0x0b1410, 0.6 * (1 - i / 12)).fillRect(0, VIEW_TOP + i * 2, GAME_WIDTH, 2);
    this.add.text(GAME_WIDTH / 2, 40, `即時戰鬥試玩・${STAGES[this.stageId]!.name}`, { fontFamily: TITLE_FONT, fontSize: '30px', color: '#ffd27a' }).setOrigin(0.5).setDepth(49);
    this.calmText = this.add.text(GAME_WIDTH / 2 - 50, 850, '', { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#ffd27a', stroke: '#000', strokeThickness: 4, backgroundColor: '#00000088' }).setPadding(14, 6, 14, 6).setOrigin(0.5).setDepth(65);
    this.hud = this.add.text(GAME_WIDTH / 2, 82, '', { fontFamily: UI_FONT, fontSize: '18px', color: '#c8d0f0' }).setOrigin(0.5).setDepth(49);
    this.makeButtons();
    this.menu = null;
    // 右上角選單（手機上不用改網址就能換關、重來、看 Bot 示範）
    const mb = this.add.text(GAME_WIDTH - 44, 40, '☰', { fontFamily: UI_FONT, fontSize: '40px', color: '#ffd27a' }).setOrigin(0.5).setDepth(49).setInteractive({ useHandCursor: true });
    mb.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      SFX.uiTap();
      this.toggleMenu();
    });
    if (this.botName) this.add.text(44, 40, '觀戰', { fontFamily: UI_FONT, fontSize: '20px', color: '#9fd8ff', backgroundColor: '#1a2a3a' }).setPadding(8, 4, 8, 4).setOrigin(0.5).setDepth(49);
    if (!this.bot) this.showHint();
    // 刷怪關的開場說明（怪會重生、營火是安全區）
    if (STAGES[this.stageId]?.spawnGroups?.length) {
      this.time.delayedCall(400, () => bigText(this, GAME_WIDTH / 2, 760, '怪物會重生・5 分鐘能打倒幾隻？\n打不過就退回營火（怪不追進來）', '#ffd27a', 30, 2600));
    }
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    const kb = this.input.keyboard;
    if (kb) this.keys = kb.addKeys('W,A,S,D,ONE,TWO,THREE,FOUR,SPACE,R,Q') as Record<string, Phaser.Input.Keyboard.Key>;
    (window as unknown as { __rt?: unknown }).__rt = { state: () => this.s, result: () => summarize(this.s), send: (c: BattleCommand) => this.pending.push(c) };
  }

  // ---------- 輸入 ----------
  private readonly JOY = { x: 150, y: 1150, r: 90 };
  private btnPos(i: number): { x: number; y: number } {
    // 右下：四技能呈弧形，閃避在最右下
    // 5＝大招（劍刃風暴，MP 40）、6＝藥水（D-071：試玩場景放上鍵位）
    const P = [{ x: 470, y: 1190 }, { x: 470, y: 1080 }, { x: 570, y: 1010 }, { x: 660, y: 1075 }, { x: 640, y: 1185 }, { x: 570, y: 900 }, { x: 672, y: 948 }];
    return P[i]!;
  }
  private btnR(i: number): number {
    return i === 6 ? 40 : 50;
  }

  private makeButtons(): void {
    const names = [...SKILL_KEYS.map((id) => SKILLS[id]!.name), '閃避', '大招', '藥水'];
    this.btnText = names.map((n, i) => {
      const { x, y } = this.btnPos(i);
      return this.add.text(x, y, n, { fontFamily: UI_FONT, fontSize: i === 4 ? '22px' : i === 6 ? '17px' : '20px', fontStyle: '700', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(60);
    });
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.ended || this.menu) return;
    if (p.y < VIEW_TOP && p.x > GAME_WIDTH - 100) return; // 選單鍵
    if (this.hint) this.dismissHint();
    for (let i = 0; i < 7; i++) {
      const b = this.btnPos(i);
      if (Math.hypot(p.x - b.x, p.y - b.y) <= this.btnR(i) + 2) {
        if (i < 4) this.pending.push({ type: 'skill', id: SKILL_KEYS[i]! });
        else if (i === 4) this.pending.push({ type: 'dodge', dx: this.stick?.dx ?? 0, dy: this.stick?.dy ?? 0 });
        else if (i === 5) this.pending.push({ type: 'skill', id: 'blade_storm' });
        else this.pending.push({ type: 'potion' });
        SFX.uiTap();
        return;
      }
    }
    if (p.y > 980 && p.x < 360) {
      this.stick = { id: p.id, bx: p.x, by: p.y, dx: 0, dy: 0 };
      return;
    }
    // 點敵人＝鎖定
    const wx = (p.x - this.ox) / this.k;
    const wy = (p.y - this.oy) / this.k;
    // 點營火＝走過去休息（design/20 B4）
    const fire = (STAGES[this.stageId]?.campfires ?? []).find((c) => Math.hypot(c.x - wx, c.y - wy) <= UNIT * 0.9);
    if (fire && !this.bot) {
      this.pending.push({ type: 'moveTo', x: fire.x, y: fire.y + UNIT });
      this.restOnArrive = true;
      this.tapMarker(p.x, p.y);
      return;
    }
    const hit = enemiesOf(this.s).find((e) => Math.hypot(e.x - wx, e.y - wy) <= e.r + 60);
    if (hit) {
      this.pending.push({ type: 'target', id: hit.id });
      this.restOnArrive = false;
      return;
    }
    // 點地＝走過去（A* 繞石頭；D-071）；搖桿一動或點敵人就取消
    if (p.y > VIEW_TOP && !this.bot) {
      this.pending.push({ type: 'moveTo', x: Math.round(wx), y: Math.round(wy) });
      this.restOnArrive = false;
      this.tapMarker(p.x, p.y);
    }
  }

  /** 點地標記：一圈縮小的光環 */
  private tapMarker(x: number, y: number): void {
    const g = this.add.graphics().setDepth(40).setPosition(x, y);
    g.lineStyle(4, 0x9fd8ff, 0.9).strokeEllipse(0, 0, 70, 34);
    g.fillStyle(0x9fd8ff, 0.25).fillEllipse(0, 0, 30, 14);
    this.tweens.add({ targets: g, scaleX: 0.3, scaleY: 0.3, alpha: 0, duration: 380, ease: 'Cubic.In', onComplete: () => g.destroy() });
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.stick || p.id !== this.stick.id || !p.isDown) return;
    const dx = p.x - this.stick.bx;
    const dy = p.y - this.stick.by;
    const d = Math.hypot(dx, dy);
    if (d < 14) {
      this.stick.dx = 0;
      this.stick.dy = 0;
    } else {
      this.stick.dx = Math.round((dx / d) * 1000);
      this.stick.dy = Math.round((dy / d) * 1000);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.stick && p.id === this.stick.id) this.stick = null;
  }

  private commands(): BattleCommand[] {
    if (this.bot) return this.bot.decide(this.s);
    const out = this.pending;
    this.pending = [];
    let dx = this.stick?.dx ?? 0;
    let dy = this.stick?.dy ?? 0;
    const K = this.keys;
    if (K) {
      const kx = (K.D?.isDown ? 1 : 0) - (K.A?.isDown ? 1 : 0);
      const ky = (K.S?.isDown ? 1 : 0) - (K.W?.isDown ? 1 : 0);
      if (kx || ky) {
        dx = kx * 1000;
        dy = ky * 1000;
      }
      const one = [K.ONE, K.TWO, K.THREE, K.FOUR];
      one.forEach((key, i) => {
        if (key && Phaser.Input.Keyboard.JustDown(key)) out.push({ type: 'skill', id: SKILL_KEYS[i]! });
      });
      if (K.SPACE && Phaser.Input.Keyboard.JustDown(K.SPACE)) out.push({ type: 'dodge', dx, dy });
      if (K.R && Phaser.Input.Keyboard.JustDown(K.R)) out.push({ type: 'skill', id: 'blade_storm' });
      if (K.Q && Phaser.Input.Keyboard.JustDown(K.Q)) out.push({ type: 'potion' });
    }
    if (dx || dy) this.restOnArrive = false;
    if (this.restOnArrive) {
      const pl = playerOf(this.s);
      const near = (STAGES[this.stageId]?.campfires ?? []).some((c) => Math.hypot(c.x - pl.x, c.y - pl.y) <= CAMPFIRE_RULES.restUnits * UNIT);
      if (near) {
        out.push({ type: 'rest' });
        this.restOnArrive = false;
      }
    }
    out.unshift(dx || dy ? { type: 'move', dx, dy } : { type: 'stop' });
    return out;
  }

  // ---------- 主迴圈 ----------
  update(_t: number, delta: number): void {
    if (this.ended || this.menu) return;
    const dt = Math.min(delta, 250);
    if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - dt);
    else this.acc += dt;
    let n = 0;
    while (this.acc >= STEP_MS && n < 6 && this.s.outcome === 'running') {
      this.prev.clear();
      for (const x of this.s.units) this.prev.set(x.id, { x: x.x, y: x.y });
      step(this.s, this.commands());
      this.acc -= STEP_MS;
      n++;
      this.skillFx();
      // 事件逐 tick 播放，命中停頓才能卡在正確的那一下
      this.playEvents();
      if (this.hitStop > 0) {
        this.acc = Math.min(this.acc, STEP_MS * 0.99);
        break;
      }
    }
    if (this.acc > STEP_MS * 6) this.acc = 0;
    this.playEvents();
    this.updateCamera(Math.min(1, dt / 120));
    this.draw();
    if (this.s.outcome !== 'running') this.finish();
  }

  private previewPath(s: BattleState, p: Unit): [number, number][] {
    const goal = s.moveGoal!;
    const grid = gridOf(s.arena);
    const from = grid ? cellIndex(grid, p.x, p.y) : 0;
    const key = `${goal.x},${goal.y},${grid ? from : `${p.x},${p.y}`}`;
    if (this.pathPreview?.key === key) {
      this.pathPreview.pts[0] = [p.x, p.y];
      return this.pathPreview.pts;
    }
    let pts: [number, number][] = [[p.x, p.y], [goal.x, goal.y]];
    if (grid) {
      const cells = findPath(grid, from, cellIndex(grid, goal.x, goal.y));
      if (cells && cells.length > 1) {
        const mid = cells.slice(0, -1).map((c): [number, number] => [((c % grid.w) + 0.5) * grid.cell, (Math.floor(c / grid.w) + 0.5) * grid.cell]);
        pts = [[p.x, p.y], ...mid, [goal.x, goal.y]];
      }
    }
    this.pathPreview = { key, pts };
    return pts;
  }

  private sx(x: number): number {
    return this.ox + x * this.k;
  }
  private sy(y: number): number {
    return this.oy + y * this.k;
  }

  /** 插值後的單位座標（模擬 30 tick/秒，畫面 60 FPS） */
  private lerpPos(x: { id: number; x: number; y: number }): { x: number; y: number } {
    const pv = this.prev.get(x.id);
    if (!pv) return x;
    const a = this.hitStop > 0 ? 1 : Math.min(1, this.acc / STEP_MS);
    return { x: pv.x + (x.x - pv.x) * a, y: pv.y + (x.y - pv.y) * a };
  }

  /** 鏡頭平滑跟隨主角，並夾在場地範圍內（場地比畫面小就置中） */
  private updateCamera(t: number): void {
    const p = this.lerpPos(playerOf(this.s));
    this.camX += (p.x - this.camX) * t;
    this.camY += (p.y - this.camY) * t;
    const a = this.s.arena;
    const viewW = GAME_WIDTH / this.k;
    const viewH = (VIEW_BOTTOM - VIEW_TOP) / this.k;
    const m = 60; // 牆外留一點邊
    let left = this.camX - viewW / 2;
    let topY = this.camY - viewH * FOCUS_Y;
    if (a.w + 2 * m <= viewW) left = (a.w - viewW) / 2;
    else left = Math.max(-m, Math.min(a.w + m - viewW, left));
    // 下方被操作鍵蓋住約 35%，允許往下多捲一點，讓主角不會被按鈕擋住
    if (a.h + 2 * m <= viewH) topY = (a.h - viewH) / 2;
    else topY = Math.max(-m, Math.min(a.h + m + viewH * 0.3 - viewH, topY));
    this.ox = -left * this.k;
    this.oy = VIEW_TOP - topY * this.k;
  }

  private toggleMenu(): void {
    if (this.hint) this.dismissHint(); // 說明框不要壓在暫停選單上
    if (this.menu) {
      this.menu.destroy();
      this.menu = null;
      this.acc = 0;
      return;
    }
    if (this.ended) return;
    this.stick = null;
    const items: Phaser.GameObjects.GameObject[] = [this.add.rectangle(0, 0, GAME_WIDTH, 1280, 0x000000, 0.7).setInteractive()];
    items.push(this.add.text(0, -440, '暫停', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    const mk = (y: number, label: string, fn: () => void, hi = false) => {
      const t = this.add.text(0, y, label, { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: hi ? '#1a0f08' : '#ffffff', backgroundColor: hi ? '#ffd27a' : '#3a2a14' }).setOrigin(0.5).setPadding(24, 12, 24, 12).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        SFX.confirm();
        fn();
      });
      items.push(t);
    };
    mk(-350, '繼續', () => this.toggleMenu(), true);
    mk(-270, '重來', () => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ?? '' }));
    items.push(this.add.text(0, -190, '換關卡', { fontFamily: UI_FONT, fontSize: '22px', color: '#c8d0f0' }).setOrigin(0.5));
    STAGE_IDS.forEach((id, i) => mk(-130 + i * 76, `${id === this.stageId ? '▶ ' : ''}${STAGES[id]!.name}`, () => this.scene.restart({ stage: id, seed: this.seed + 1, bot: this.botName ?? '' })));
    mk(-130 + STAGE_IDS.length * 76 + 20, this.botName ? '改成自己操作' : '看 Bot 示範（熟練）', () => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ? '' : 'expert' }));
    this.menu = this.add.container(GAME_WIDTH / 2, 640, items).setDepth(95);
  }

  private showHint(): void {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
    } catch {
      /* 無痕模式 */
    }
    const lines = ['左下拖曳：走位（放開＝自動追擊＋普攻）', '紅色範圍＝敵人要打這裡，填滿就命中', '黃框＝可以「格擋反擊」　右下：技能／閃避', '點地面＝走過去　點敵人＝鎖定　粉紅環滿＝大招'];
    const bg = this.add.rectangle(0, 0, 620, 210, 0x000000, 0.72).setStrokeStyle(2, 0xffd27a, 0.8);
    const t = this.add.text(0, 0, lines.join('\n'), { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff', align: 'center', lineSpacing: 10 }).setOrigin(0.5);
    this.hint = this.add.container(GAME_WIDTH / 2, 300, [bg, t]).setDepth(70);
    this.time.delayedCall(6000, () => this.dismissHint());
  }

  private dismissHint(): void {
    const h = this.hint;
    if (!h) return;
    this.hint = null;
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* 無痕模式 */
    }
    this.tweens.add({ targets: h, alpha: 0, duration: 300, onComplete: () => h.destroy() });
  }

  private playEvents(): void {
    const ev = this.s.events;
    for (; this.evIdx < ev.length; this.evIdx++) {
      const e = ev[this.evIdx]!;
      const u = (id: number) => this.s.units.find((x) => x.id === id);
      if (e.type === 'damage') {
        const d = u(e.dst);
        if (!d) continue;
        const toPlayer = d.side === 'player';
        if (e.origin !== 'dot') this.flashUntil.set(d.id, this.time.now + 70);
        // 命中停頓：暴擊／反擊／技能較長，普攻短一點；被打不停頓（避免拖慢閃避判斷）
        if (!toPlayer && e.origin !== 'dot') this.hitStop = Math.max(this.hitStop, e.crit || e.origin === 'counter' ? 70 : e.origin === 'skill' ? 45 : 25);
        if (!toPlayer && (e.crit || e.origin === 'counter')) this.cameras.main.shake(70, 0.003);
        const src = u(e.src);
        if (src && src.side === 'player' && e.origin === 'normal') {
          this.slash(src.x, src.y, Math.atan2(d.y - src.y, d.x - src.x), 150, 110, e.crit ? 0xffd05a : 0xffffff, 5);
          this.knock(d.id, d.x - src.x, d.y - src.y, 10);
        } else if (src && src.side === 'player' && e.origin !== 'dot') this.knock(d.id, d.x - src.x, d.y - src.y, 16);
        floatNumber(this, this.sx(d.x), this.sy(d.y) - 30, `${e.amount}${e.crit ? '!' : ''}`, { color: toPlayer ? '#ff8a8a' : e.crit ? '#ffd05a' : e.origin === 'counter' ? '#7dffb0' : '#ffffff', size: e.crit || e.origin === 'counter' ? 34 : 26 });
        if (!toPlayer && e.origin !== 'dot') {
          SFX.hitLight();
          sparks(this, this.sx(d.x), this.sy(d.y), 6, 'spark', 0xffffff, 260);
        }
        if (toPlayer) {
          this.cameras.main.shake(90, 0.004);
          // Android／部分瀏覽器支援震動；iOS Safari 不支援就略過
          if (!this.bot && e.amount > (e.absorbed ?? 0)) {
            try {
              navigator.vibrate?.(e.amount >= d.maxHp * 0.12 ? 60 : 25);
            } catch {
              /* 不支援 */
            }
          }
        }
      } else if (e.type === 'potion') {
        const p = playerOf(this.s);
        SFX.itemGet();
        floatNumber(this, this.sx(p.x), this.sy(p.y) - 50, `+${e.heal}`, { color: '#7dffb0', size: 30 });
        sparks(this, this.sx(p.x), this.sy(p.y), 12, 'ember', 0x7dffb0, 380);
      } else if (e.type === 'regen') {
        const p = playerOf(this.s);
        floatNumber(this, this.sx(p.x) + 30, this.sy(p.y) - 40, `+${e.heal}`, { color: '#9affc0', size: 18 });
      } else if (e.type === 'aggro') {
        const d = u(e.id);
        if (d) floatNumber(this, this.sx(d.x), this.sy(d.y) - 60, '!', { color: '#ff5a5a', size: 40 });
      } else if (e.type === 'leash') {
        const d = u(e.id);
        if (d) floatNumber(this, this.sx(d.x), this.sy(d.y) - 60, '脫戰', { color: '#c8d0f0', size: 22 });
      } else if (e.type === 'reset') {
        const d = u(e.id);
        if (d) floatNumber(this, this.sx(d.x), this.sy(d.y) - 50, '回滿', { color: '#7dffb0', size: 22 });
      } else if (e.type === 'dodge') SFX.dodge();
      else if (e.type === 'block') {
        SFX.parry();
        this.hitStop = Math.max(this.hitStop, 110);
        const p = playerOf(this.s);
        shockRing(this, this.sx(p.x), this.sy(p.y), 0x7dffb0, 90, 300, 6);
        const cs = SKILLS.parry?.block?.counter.shape;
        if (cs?.type === 'sector') this.slash(p.x, p.y, Math.atan2(p.facingY, p.facingX), cs.r, cs.deg + 30, 0x7dffb0, 10);
        bigText(this, this.sx(p.x), this.sy(p.y) - 80, '格擋！', '#7dffb0', 40, 300);
      } else if (e.type === 'dodged') {
        const p = playerOf(this.s);
        floatNumber(this, this.sx(p.x), this.sy(p.y) - 40, 'MISS', { color: '#9fd8ff', size: 26 });
      } else if (e.type === 'death') {
        const d = u(e.id);
        if (d && d.side === 'enemy') {
          SFX.hitHeavy();
          sparks(this, this.sx(d.x), this.sy(d.y), 18, 'spark', 0xffd27a, 420);
          this.hitStop = Math.max(this.hitStop, ENEMIES[d.defId]?.boss ? 260 : 90);
          this.killSprite(d.id);
        }
      } else if (e.type === 'phase2') bigText(this, GAME_WIDTH / 2, 520, '狼王暴怒！', '#ff7a5a', 52, 700);
      else if (e.type === 'wallStun') bigText(this, GAME_WIDTH / 2, 520, '撞牆暈眩！趁現在！', '#ffd27a', 40, 700);
      else if (e.type === 'cast') {
        if (SKILLS[e.skill]?.role === 'ult') {
          // 大招：閃光＋金粉環＋大字（D-071 放上試玩鍵位）
          const p = playerOf(this.s);
          SFX.perfect();
          SFX.hitHeavy();
          this.cameras.main.flash(140, 255, 140, 220);
          this.cameras.main.shake(160, 0.006);
          shockRing(this, this.sx(p.x), this.sy(p.y), 0xff7ad0, 260, 520, 10);
          sparks(this, this.sx(p.x), this.sy(p.y), 26, 'ember', 0xff9ae0, 520);
          bigText(this, GAME_WIDTH / 2, 460, '劍刃風暴！', '#ff9ae0', 54, 700);
        } else SFX.blip();
      }
      else if (e.type === 'telegraph') {
        // 預告聲音提示（同一 tick 多隻只響一次）；Boss 低沉
        if (this.lastWarnTick !== e.tick) {
          this.lastWarnTick = e.tick;
          const o = u(e.owner);
          SFX.warn(!!(o && ENEMIES[o.defId]?.boss));
        }
      }
      else if (e.type === 'summon') {
        const b = u(e.id);
        if (b) shockRing(this, this.sx(b.x), this.sy(b.y), 0xb080ff, 140, 400, 5);
      } else if (e.type === 'despawn') {
        const d = u(e.id);
        if (d) sparks(this, this.sx(d.x), this.sy(d.y), 8, 'ember', 0x8a7aa8, 400);
        this.killSprite(e.id);
      } else if (e.type === 'pickup') {
        const p = playerOf(this.s);
        // 只是畫面上的字（這些東西是試玩場景的戰利品統計，不是主線玩家資產）
        const L: [string, string] =
          e.kind === 'gold' ? [`+${e.amount} 金`, '#ffd27a'] : e.kind === 'dust' ? [`粉塵 +${e.amount}`, '#9fd8ff'] : e.kind === 'crystal' ? [`結晶 +${e.amount}`, '#d0a0ff'] : [`藥水 +${e.amount}`, '#7dffb0'];
        floatNumber(this, this.sx(p.x) + 40, this.sy(p.y) - 70, L[0], { color: L[1], size: e.kind === 'gold' ? 22 : 24 });
        if (e.kind !== 'gold') SFX.itemGet();
      } else if (e.type === 'respawn') {
        const d = u(e.id);
        if (d) sparks(this, this.sx(d.x), this.sy(d.y), 10, 'ember', 0x8a7aa8, 500);
      } else if (e.type === 'rest') {
        const p = playerOf(this.s);
        SFX.itemGet();
        shockRing(this, this.sx(p.x), this.sy(p.y), 0xffb060, 120, 500, 6);
        bigText(this, this.sx(p.x), this.sy(p.y) - 90, '休息・HP 全滿', '#ffd27a', 32, 600);
      } else if (e.type === 'revive') {
        const p = playerOf(this.s);
        this.cameras.main.flash(260, 255, 210, 140);
        bigText(this, GAME_WIDTH / 2, 520, '在營火旁醒來', '#ffd27a', 40, 900);
        shockRing(this, this.sx(p.x), this.sy(p.y), 0xffd27a, 160, 600, 6);
      }
    }
  }

  private shapePath(sh: Shape, ox: number, oy: number, dx: number, dy: number, g: Phaser.GameObjects.Graphics, fill: boolean): void {
    const cx = this.sx(ox);
    const cy = this.sy(oy);
    const ang = Math.atan2(dy, dx);
    const k = this.k;
    g.beginPath();
    if (sh.type === 'circle') g.arc(cx, cy, sh.r * k, 0, Math.PI * 2);
    else if (sh.type === 'ring') {
      g.arc(cx, cy, sh.rOut * k, 0, Math.PI * 2);
      g.arc(cx, cy, sh.rIn * k, Math.PI * 2, 0, true);
    } else if (sh.type === 'sector') {
      const h = ((sh.deg / 2) * Math.PI) / 180;
      g.moveTo(cx, cy);
      g.arc(cx, cy, sh.r * k, ang - h, ang + h);
      g.closePath();
    } else {
      const w = (sh.width / 2) * k;
      const L = sh.len * k;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const pts = [[0, -w], [L, -w], [L, w], [0, w]].map(([a, b]) => [cx + a! * c - b! * s, cy + a! * s + b! * c] as const);
      g.moveTo(pts[0]![0], pts[0]![1]);
      for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
      g.closePath();
    }
    if (fill) g.fillPath();
    else g.strokePath();
  }

  /** 依進度縮放的形狀（預告「由內往外填滿」，填滿＝命中；不只靠顏色辨識） */
  private scaled(sh: Shape, f: number): Shape {
    if (sh.type === 'circle') return { ...sh, r: sh.r * f };
    if (sh.type === 'sector') return { ...sh, r: sh.r * f };
    if (sh.type === 'ring') return { ...sh, rOut: sh.rIn + (sh.rOut - sh.rIn) * f };
    return { ...sh, len: sh.len * f };
  }

  /** 地面：深綠＋格線＋零星草叢＋牆（世界座標 × k，原點在場地左上） */
  private makeGround(): Phaser.GameObjects.Image {
    const a = this.s.arena;
    const k = this.k;
    const W = a.w * k;
    const H = a.h * k;
    const key = `rt_ground_${this.stageId}_${a.w}x${a.h}`;
    const PAD = 8;
    if (this.textures.exists(key)) return this.add.image(0, 0, key).setOrigin(0).setDisplayOrigin(PAD, PAD);
    const g = this.make.graphics({ x: PAD, y: PAD }, false);
    g.fillStyle(0x16261c, 1).fillRect(0, 0, W, H);
    // 固定種子的地面斑點（不影響戰鬥 PRNG）
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < (a.w * a.h) / 9000; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      g.fillStyle(rnd() < 0.5 ? 0x1a2c1f : 0x14231a, 0.8).fillEllipse(x, y, 30 + rnd() * 60, 14 + rnd() * 24);
      if (rnd() < 0.3) {
        g.lineStyle(2, 0x2f5a36, 0.8);
        for (let j = -2; j <= 2; j++) g.lineBetween(x + j * 4, y, x + j * 6, y - 10 - rnd() * 8);
      }
    }
    g.lineStyle(1, 0x203a28, 1);
    for (let x = 0; x <= a.w; x += 100) g.lineBetween(x * k, 0, x * k, H);
    for (let y = 0; y <= a.h; y += 100) g.lineBetween(0, y * k, W, y * k);
    // 障礙物（D-070／D-071）：每格一顆圓石，影子＋底色＋亮面＋裂紋（固定種子）
    if (a.solid) {
      const c = a.solid.cell * k;
      a.solid.rows.forEach((row, cy) => {
        for (let cx = 0; cx < row.length; cx++) {
          if (row[cx] !== '#') continue;
          const x = cx * c;
          const y = cy * c;
          const j = rnd() * 0.12;
          g.fillStyle(0x050a07, 0.55).fillEllipse(x + c * 0.55, y + c * 0.78, c * 1.05, c * 0.42);
          g.fillStyle(0x4a4f52, 1).fillRoundedRect(x + c * (0.04 + j), y + c * 0.06, c * (0.92 - j), c * 0.86, c * 0.28);
          g.fillStyle(0x6c7378, 1).fillRoundedRect(x + c * (0.12 + j), y + c * 0.1, c * (0.7 - j), c * 0.46, c * 0.22);
          g.fillStyle(0x8d959a, 0.8).fillEllipse(x + c * 0.36, y + c * 0.24, c * 0.3, c * 0.12);
          g.lineStyle(2, 0x2c3033, 0.9).lineBetween(x + c * (0.3 + j), y + c * 0.5, x + c * 0.5, y + c * 0.68);
          if (rnd() < 0.5) g.fillStyle(0x3f6b3a, 0.85).fillEllipse(x + c * (0.2 + rnd() * 0.5), y + c * 0.84, c * 0.28, c * 0.1);
        }
      });
    }
    g.lineStyle(10, 0x0a120d, 1).strokeRect(-5, -5, W + 10, H + 10);
    g.lineStyle(3, 0x5a8a60, 1).strokeRect(0, 0, W, H);
    g.generateTexture(key, Math.ceil(W) + PAD * 2, Math.ceil(H) + PAD * 2);
    g.destroy();
    return this.add.image(0, 0, key).setOrigin(0).setDisplayOrigin(PAD, PAD);
  }

  /** 刀光：以 (wx, wy) 為圓心、朝 ang 掃過 deg 度的弧（世界單位半徑 wr），疊三層、ADD 混色 */
  private slash(wx: number, wy: number, ang: number, wr: number, deg: number, color: number, width: number): void {
    const g = this.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
    const cx = this.sx(wx);
    const cy = this.sy(wy);
    const r = wr * this.k;
    const h = (deg / 2) * (Math.PI / 180);
    const draw = (t: number) => {
      g.clear();
      const end = ang - h + 2 * h * Math.min(1, t * 1.6);
      for (let i = 0; i < 3; i++) {
        g.lineStyle(width * (1.6 - i * 0.45), i === 2 ? 0xffffff : color, (1 - t) * (0.35 + i * 0.3));
        g.beginPath().arc(cx, cy, r * (0.82 + i * 0.09), ang - h, end).strokePath();
      }
    };
    draw(0);
    this.tweens.addCounter({ from: 0, to: 1, duration: 170, onUpdate: (tw) => draw(tw.getValue() ?? 1), onComplete: () => g.destroy() });
  }

  /** 旋轉刀環（旋風斬／劍刃風暴） */
  private spin(wx: number, wy: number, wr: number, color: number, start: number): void {
    for (let i = 0; i < 2; i++) this.slash(wx, wy, start + i * Math.PI, wr, 160, color, 7);
    shockRing(this, this.sx(wx), this.sy(wy), color, wr * this.k, 220, 4);
  }

  /** 受擊位移（只在畫面上，不影響模擬座標） */
  private knock(id: number, dx: number, dy: number, px: number): void {
    const sp = this.sprites.get(id);
    if (!sp) return;
    const d = Math.hypot(dx, dy) || 1;
    sp.setData('kx', (dx / d) * px);
    sp.setData('ky', (dy / d) * px * 0.6);
    sp.setData('kUntil', this.time.now + 110);
  }

  /** 技能每段命中的刀光（資料驅動：依命中形狀畫，不寫 switch(skillId)） */
  private skillFx(): void {
    const p = playerOf(this.s);
    const a = p.action;
    if (!a || a.kind !== 'skill') return;
    const sk = SKILLS[a.id];
    if (!sk) return;
    const k = this.s.tick - a.start;
    sk.hits.forEach((h, i) => {
      const key = `${a.start}:${i}`;
      if (k < h.atTick || this.fxDone.has(key)) return;
      this.fxDone.add(key);
      const ang = Math.atan2(a.dirY, a.dirX);
      const big = h.mult >= 150;
      if (sk.dash) {
        // 衝鋒：身後殘影線
        const g = this.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
        const L = 90 * this.k;
        const px = this.sx(p.x);
        const py = this.sy(p.y);
        for (let j = -1; j <= 1; j++) {
          g.lineStyle(4 - Math.abs(j), 0x9fd8ff, 0.8).lineBetween(px - Math.sin(ang) * j * 14, py + Math.cos(ang) * j * 14, px - Math.cos(ang) * L - Math.sin(ang) * j * 14, py - Math.sin(ang) * L + Math.cos(ang) * j * 14);
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
      } else if (h.shape.type === 'circle') {
        const ult = sk.role === 'ult';
        this.spin(p.x, p.y, h.shape.r, big ? 0xffd05a : ult ? 0xff7ad0 : 0x9fd8ff, (this.time.now / 90) % (Math.PI * 2));
        if (ult) this.spin(p.x, p.y, h.shape.r * 0.6, 0xffd0f0, (this.time.now / 70 + Math.PI) % (Math.PI * 2));
        if (ult && big) {
          this.cameras.main.shake(200, 0.009);
          shockRing(this, this.sx(p.x), this.sy(p.y), 0xffd05a, h.shape.r * this.k * 1.1, 420, 12);
          this.hitStop = Math.max(this.hitStop, 120);
        }
      }
      else if (h.shape.type === 'sector') {
        this.slash(p.x, p.y, ang, h.shape.r, h.shape.deg + 30, big ? 0xffd05a : 0x9fd8ff, big ? 10 : 7);
        if (big) this.cameras.main.shake(80, 0.004);
      }
    });
  }

  private killSprite(id: number): void {
    const sp = this.sprites.get(id);
    if (!sp) return;
    this.sprites.delete(id);
    sp.setTintFill(0xffffff);
    this.tweens.add({ targets: sp, alpha: 0, scaleX: sp.scaleX * 1.25, scaleY: sp.scaleY * 0.6, duration: 420, ease: 'Cubic.Out', onComplete: () => sp.destroy() });
  }

  private spriteFor(x: Unit): Phaser.GameObjects.Image | null {
    const cfg = SPRITE[x.side === 'player' ? 'swordsman' : x.defId];
    if (!cfg || !this.textures.exists(cfg.key)) return null;
    let sp = this.sprites.get(x.id);
    if (!sp) {
      sp = this.add.image(0, 0, cfg.key).setOrigin(0.5, 0.92);
      const hPx = x.r * cfg.h * this.k;
      sp.setScale(hPx / sp.height);
      sp.setData('base', sp.scaleX);
      if (cfg.tint) sp.setTint(cfg.tint);
      this.sprites.set(x.id, sp);
      // 出場：從地面長出來
      const base = sp.scaleX;
      sp.setScale(base * 0.2);
      this.tweens.add({ targets: sp, scaleX: base, scaleY: base, duration: 260, ease: 'Back.Out' });
    }
    return sp;
  }

  private draw(): void {
    const g = this.g.clear();
    const top = this.top.clear();
    const s = this.s;
    const now = this.time.now;
    this.ground.setPosition(this.ox, this.oy);
    // 地面掉落：金幣（金色閃光）、粉塵（藍點）、結晶（紫菱形）、藥水（紅瓶）；上下浮動
    for (const it of s.ground ?? []) {
      const ix = this.sx(it.x);
      const iy = this.sy(it.y) - 6 - 4 * Math.sin(now / 260 + it.id);
      const k = this.k;
      g.fillStyle(0x000000, 0.35).fillEllipse(ix, this.sy(it.y) + 6, 26 * k * 2, 8 * k * 2);
      if (it.kind === 'gold') {
        g.fillStyle(0xffc83a, 1).fillCircle(ix, iy, 13);
        g.fillStyle(0xfff0a0, 1).fillCircle(ix - 4, iy - 4, 4);
      } else if (it.kind === 'dust') {
        g.fillStyle(0x7ac8ff, 0.9).fillCircle(ix, iy, 8).fillCircle(ix + 11, iy + 4, 6).fillCircle(ix - 10, iy + 5, 6);
      } else if (it.kind === 'crystal') {
        g.fillStyle(0xc080ff, 1).fillTriangle(ix, iy - 20, ix - 13, iy, ix + 13, iy).fillTriangle(ix, iy + 14, ix - 13, iy, ix + 13, iy);
        g.lineStyle(2, 0xffffff, 0.7).lineBetween(ix - 4, iy - 10, ix, iy - 17);
      } else {
        g.fillStyle(0xe04848, 1).fillCircle(ix, iy + 3, 13);
        g.fillStyle(0xf0e0c0, 1).fillRect(ix - 4, iy - 17, 8, 10);
      }
      if ((now / 400 + it.id) % 3 < 0.3) g.fillStyle(0xffffff, 0.8).fillCircle(ix + 6, iy - 8, 2.5);
    }
    // 營火：安全範圍淡圈＋木柴＋跳動的火焰與光暈
    for (const c of STAGES[this.stageId]?.campfires ?? []) {
      const cx = this.sx(c.x);
      const cy = this.sy(c.y);
      const k = this.k * 1.5;
      g.lineStyle(2, 0xffb060, 0.18).strokeCircle(cx, cy, CAMPFIRE_RULES.safeUnits * UNIT * this.k);
      g.fillStyle(0xffa040, 0.08 + 0.03 * Math.sin(now / 170)).fillCircle(cx, cy, 120 * k * (1 + 0.05 * Math.sin(now / 130)));
      g.fillStyle(0x3a2412, 1).fillRoundedRect(cx - 40 * k, cy + 4 * k, 80 * k, 14 * k, 6 * k);
      g.fillStyle(0x4a2e16, 1).fillRoundedRect(cx - 34 * k, cy - 4 * k, 68 * k, 13 * k, 6 * k);
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(now / (90 + i * 37) + i * 2);
        const fh = (46 - i * 12 + f * 6) * k;
        g.fillStyle(i === 0 ? 0xff6a20 : i === 1 ? 0xffa83a : 0xfff0a0, 0.95).fillEllipse(cx + f * 3 * k, cy - fh / 2, (36 - i * 10) * k, fh);
      }
    }
    // 預告：淡底＋由內往外填滿的進度＋外框（紫＝附狀態、黃框＝可格擋、粗紅＝不可格擋）
    for (const t of s.telegraphs) {
      const prog = Math.min(1, (s.tick - t.startTick) / Math.max(1, t.hitTick - t.startTick));
      const owner = s.units.find((x) => x.id === t.ownerId);
      const atk = owner ? ENEMIES[owner.defId]?.attacks.find((q) => q.id === t.attackId) : undefined;
      const col = atk?.status ? 0xb060ff : 0xff3a3a;
      g.fillStyle(col, 0.14);
      this.shapePath(t.shape, t.ox, t.oy, t.dirX, t.dirY, g, true);
      g.fillStyle(col, 0.22 + prog * 0.25);
      this.shapePath(this.scaled(t.shape, Math.max(0.05, prog)), t.ox, t.oy, t.dirX, t.dirY, g, true);
      const blink = prog > 0.8 && Math.floor(now / 70) % 2 === 0;
      g.lineStyle(t.blockable ? 4 : 6, t.blockable ? 0xffd27a : blink ? 0xffffff : col, 0.95);
      this.shapePath(t.shape, t.ox, t.oy, t.dirX, t.dirY, g, false);
    }
    // 單位
    const playerU = playerOf(s);
    for (const x of s.units) {
      if (x.dead) continue;
      const pos = this.lerpPos(x);
      const px = this.sx(pos.x);
      const py = this.sy(pos.y);
      const r = x.r * this.k;
      const isP = x.side === 'player';
      const boss = !!ENEMIES[x.defId]?.boss;
      const inv = isP && x.invulnUntil >= s.tick;
      const sp = this.spriteFor(x);
      const winding = !isP && s.telegraphs.some((t) => t.ownerId === x.id);
      // 腳下：陰影＋陣營圈（RO 式）
      g.fillStyle(0x000000, 0.4).fillEllipse(px, py + r * 0.15, r * 2.4, r * 1.0);
      g.lineStyle(isP ? 3 : 2, isP ? 0x7dc8ff : winding ? 0xff5a5a : boss ? 0xffb0d0 : 0xd0d0e0, sp ? 0.75 : 1).strokeEllipse(px, py + r * 0.15, r * 2.3, r * 0.95);
      let headY = py - r;
      if (sp) {
        const cfg = SPRITE[isP ? 'swordsman' : x.defId]!;
        const base = sp.getData('base') as number;
        const moving = Math.abs(pos.x - (this.prev.get(x.id)?.x ?? pos.x)) + Math.abs(pos.y - (this.prev.get(x.id)?.y ?? pos.y)) > 0.5 || !!x.action;
        const bob = moving ? Math.abs(Math.sin(now / 90 + x.id)) * r * 0.12 : Math.sin(now / 400 + x.id) * r * 0.03;
        // 蓄力：往後縮、放大一點點（敵人出招前的身體語言）
        const squash = winding ? 1 + 0.06 * Math.sin(now / 40) : 1;
        const kOn = ((sp.getData('kUntil') as number | undefined) ?? 0) > now;
        const kx = kOn ? ((sp.getData('kx') as number) ?? 0) : 0;
        const ky = kOn ? ((sp.getData('ky') as number) ?? 0) : 0;
        // 玩家普攻／施放時往前踏一點
        const lunge = isP && x.action && (x.action.kind === 'attack' || x.action.kind === 'skill') ? Math.min(1, (s.tick - x.action.start) / 6) * r * 0.25 : 0;
        sp.setPosition(px + kx + (fx0(x) * lunge), py + r * 0.15 - bob + ky + (fy0(x) * lunge)).setDepth(10 + pos.y / 100);
        if (sp.scaleY !== 0 && !this.tweens.isTweening(sp)) sp.setScale(base * squash, base / squash);
        if (cfg.flip && x.facingX !== 0) sp.setFlipX(x.facingX < 0);
        // 脫戰返回中半透明（打不到）；待機的怪稍暗
        sp.setAlpha(inv || x.mode === 'returning' ? 0.45 : x.mode === 'idle' || x.mode === 'dormant' ? 0.85 : 1);
        if ((this.flashUntil.get(x.id) ?? 0) > now) sp.setTintFill(0xffffff);
        else if (winding) sp.setTint(Math.floor(now / 90) % 2 ? 0xff9a9a : 0xffffff);
        else if (cfg.tint) sp.setTint(cfg.tint);
        else sp.clearTint();
        headY = sp.y - sp.displayHeight * 0.92;
      } else {
        g.fillStyle(isP ? (inv ? 0x9fd8ff : 0x4a8aff) : boss ? 0x8a3a6a : 0x6a6a7a, inv ? 0.6 : 1).fillCircle(px, py, r);
        g.lineStyle(3, 0xffffff, 0.9).lineBetween(px, py, px + (x.facingX / 1000) * r * 1.4, py + (x.facingY / 1000) * r * 1.4);
      }
      // 面向小箭頭（腳下）
      const fx = x.facingX / 1000;
      const fy = x.facingY / 1000;
      const ax = px + fx * r * 1.35;
      const ay = py + r * 0.15 + fy * r * 0.6;
      g.fillStyle(isP ? 0x7dc8ff : 0xd0d0e0, 0.85).fillTriangle(ax + fx * 10, ay + fy * 5, ax - fy * 7, ay + fx * 4, ax + fy * 7, ay - fx * 4);
      // 狀態
      if (x.statuses.some((q) => (q.id === 'stun' || q.id === 'freeze') && q.until > s.tick)) {
        for (let k = 0; k < 3; k++) {
          const an = now / 200 + (k * Math.PI * 2) / 3;
          top.fillStyle(0xffe066, 1).fillCircle(px + Math.cos(an) * r * 0.8, headY - 8 + Math.sin(an) * 5, 5);
        }
      }
      if (x.statuses.some((q) => q.id === 'poison' && q.until > s.tick)) top.fillStyle(0xb060ff, 1).fillCircle(px + r, headY + 10, 7);
      // HP 條（Boss 用畫面上方大條）
      if (!boss) {
        const w = Math.max(56, r * 2.4);
        top.fillStyle(0x000000, 0.7).fillRect(px - w / 2, headY - 14, w, 8);
        top.fillStyle(isP ? 0x7dffb0 : 0xff6a6a, 1).fillRect(px - w / 2, headY - 14, w * (x.hp / x.maxHp), 8);
      }
      // 鎖定
      if (!isP && playerU.targetId === x.id) {
        const rr = r * 1.4 + Math.sin(now / 150) * 3;
        top.lineStyle(3, 0xffd27a, 0.9);
        for (let k = 0; k < 4; k++) top.beginPath().arc(px, py + r * 0.15, rr, k * (Math.PI / 2) + 0.3, k * (Math.PI / 2) + 1.27).strokePath();
      }
      // 玩家施放中：畫技能範圍
      if (isP && x.action?.kind === 'skill') {
        const sk = SKILLS[x.action.id];
        const h = sk?.hits[0] ?? sk?.block?.counter;
        if (h) {
          g.fillStyle(0x7dc8ff, 0.2);
          this.shapePath(h.shape, pos.x, pos.y, x.action.dirX, x.action.dirY, g, true);
        }
      }
    }
    this.drawOffscreen(top);
    this.drawUi();
  }

  /** 畫面外的敵人：邊緣箭頭（正在預告攻擊的閃紅） */
  private drawOffscreen(g: Phaser.GameObjects.Graphics): void {
    const s = this.s;
    const now = this.time.now;
    for (const e of enemiesOf(s)) {
      const px = this.sx(e.x);
      const py = this.sy(e.y);
      const M = 30;
      if (px >= 0 && px <= GAME_WIDTH && py >= VIEW_TOP + 40 && py <= 960) continue;
      const cx = Math.max(M, Math.min(GAME_WIDTH - M, px));
      const cy = Math.max(VIEW_TOP + M, Math.min(960, py));
      const an = Math.atan2(py - cy || 0.001, px - cx || 0.001);
      const hot = s.telegraphs.some((t) => t.ownerId === e.id);
      const col = hot ? (Math.floor(now / 100) % 2 ? 0xff3a3a : 0xffffff) : ENEMIES[e.defId]?.boss ? 0xffb0d0 : 0xffd27a;
      const c = Math.cos(an);
      const sn = Math.sin(an);
      g.fillStyle(col, 0.9).fillTriangle(cx + c * 18, cy + sn * 18, cx - c * 10 - sn * 12, cy - sn * 10 + c * 12, cx - c * 10 + sn * 12, cy - sn * 10 - c * 12);
    }
  }

  private drawUi(): void {
    const g = this.ui.clear();
    const s = this.s;
    const p = playerOf(s);
    // 地圖怪關卡：附近沒有戰鬥中的怪時提示「點怪物開打」（D-073）
    const es = enemiesOf(s);
    const calm = es.length > 0 && !es.some((e) => e.mode === 'combat') && es.some((e) => e.mode === 'idle' || e.mode === 'dormant');
    this.hud.setText(`HP ${p.hp}/${p.maxHp}　MP ${p.mp}　${s.loot ? `金 ${s.loot.gold ?? 0}　粉塵 ${s.loot.dust ?? 0}` : `敵人 ${es.length}`}　${(s.tick / TICKS_PER_SEC).toFixed(1)} 秒`);
    const fires = STAGES[this.stageId]?.campfires ?? [];
    const atFire = fires.some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= CAMPFIRE_RULES.safeUnits * UNIT);
    const restTip = fires.length === 0 ? '' : atFire && (p.hp < p.maxHp || s.potions < SWORDSMAN.potion.carry) ? '點營火休息：HP 全滿・補藥水' : !atFire && p.hp * 2 < p.maxHp ? '打不過就退回營火（怪不追進來）' : '';
    this.calmText.setVisible(calm).setText(calm ? restTip || (p.hp < p.maxHp ? '休息中・自動回血　準備好就點怪物開打' : '點怪物開打（一次拉一組）') : '').setAlpha(0.75 + 0.25 * Math.sin(this.time.now / 300));
    // Boss 大血條（畫面上方）
    const boss = enemiesOf(s).find((e) => ENEMIES[e.defId]?.boss);
    if (boss) {
      const w = 600;
      const x0 = (GAME_WIDTH - w) / 2;
      g.fillStyle(0x000000, 0.75).fillRect(x0 - 3, 113, w + 6, 20);
      g.fillStyle(boss.phase === 2 ? 0xff5a3a : 0xc04a8a, 1).fillRect(x0, 116, w * (boss.hp / boss.maxHp), 14);
      g.lineStyle(2, 0xffb0d0, 0.9).strokeRect(x0 - 3, 113, w + 6, 20);
      g.lineStyle(2, 0xffffff, 0.6).lineBetween(x0 + w * 0.5, 113, x0 + w * 0.5, 133);
    }
    // 點地移動的目的地＋路徑預覽（沿 A* 格子路線的光點，往目的地流動）
    if (s.moveGoal) {
      const gx = this.sx(s.moveGoal.x);
      const gy = this.sy(s.moveGoal.y);
      const pts = this.previewPath(s, p);
      const flow = (this.time.now % 500) / 500;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i]!;
        const [bx, by] = pts[i + 1]!;
        const len = Math.hypot(bx - ax, by - ay);
        for (let d = (flow * 45) % 45; d < len; d += 45) {
          const t = d / len;
          g.fillStyle(0x9fd8ff, 0.55).fillCircle(this.sx(ax + (bx - ax) * t), this.sy(ay + (by - ay) * t), 4);
        }
      }
      const ph = (this.time.now % 600) / 600;
      g.lineStyle(3, 0x9fd8ff, 0.8 - ph * 0.6).strokeEllipse(gx, gy, 30 + ph * 26, 14 + ph * 12);
      g.fillStyle(0x9fd8ff, 0.5).fillEllipse(gx, gy, 12, 6);
    }
    // 搖桿
    g.fillStyle(0xffffff, 0.08).fillCircle(this.JOY.x, this.JOY.y, this.JOY.r);
    g.lineStyle(2, 0xffffff, 0.3).strokeCircle(this.JOY.x, this.JOY.y, this.JOY.r);
    if (this.stick) {
      g.fillStyle(0xffffff, 0.15).fillCircle(this.stick.bx, this.stick.by, this.JOY.r);
      g.fillStyle(0xffd27a, 0.7).fillCircle(this.stick.bx + (this.stick.dx / 1000) * 50, this.stick.by + (this.stick.dy / 1000) * 50, 34);
    }
    // 技能鍵（冷卻遮罩）
    const ids: string[] = [...SKILL_KEYS, 'dodge'];
    ids.forEach((id, i) => {
      const { x, y } = this.btnPos(i);
      const cd = id === 'dodge' ? SWORDSMAN.dodge.cooldownTicks : SKILLS[id]!.cooldownTicks;
      const left = Math.max(0, (p.ready[id] ?? 0) - s.tick);
      g.fillStyle(i === 4 ? 0x2a4a6a : 0x3a2a14, 0.95).fillCircle(x, y, 50);
      g.lineStyle(3, left ? 0x555566 : i === 4 ? 0x9fd8ff : 0xffd27a, 1).strokeCircle(x, y, 50);
      if (left > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(x, y, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / cd), false).fillPath();
      }
      this.btnText[i]!.setText(left > 0 ? `${(left / TICKS_PER_SEC).toFixed(1)}` : i === 4 ? '閃避' : SKILLS[id]!.name);
    });
    // 大招：MP 環（滿 40 才亮）＋冷卻
    {
      const ult = SKILLS.blade_storm!;
      const need = ult.mp ?? 40;
      const { x, y } = this.btnPos(5);
      const left = Math.max(0, (p.ready['blade_storm'] ?? 0) - s.tick);
      const ok = left === 0 && p.mp >= need;
      const now = this.time.now;
      g.fillStyle(ok ? 0x5a1a3a : 0x2a1420, 0.95).fillCircle(x, y, 50);
      g.lineStyle(5, 0x333344, 1).strokeCircle(x, y, 50);
      g.lineStyle(5, ok ? 0xff7ad0 : 0xa0507a, 1);
      g.beginPath().arc(x, y, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.mp / need), false).strokePath();
      if (ok) g.lineStyle(3, 0xffd0f0, 0.4 + 0.4 * Math.sin(now / 120)).strokeCircle(x, y, 56 + 3 * Math.sin(now / 160));
      if (left > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(x, y, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / ult.cooldownTicks), false).fillPath();
      }
      this.btnText[5]!.setText(left > 0 ? `${(left / TICKS_PER_SEC).toFixed(1)}` : ok ? '劍刃\n風暴' : `MP\n${p.mp}/${need}`);
      this.btnText[5]!.setColor(ok ? '#ffffff' : '#c890b0');
    }
    // 藥水：剩餘數量＋冷卻；血少於 40% 時閃爍提醒
    {
      const { x, y } = this.btnPos(6);
      const pt = SWORDSMAN.potion;
      const left = Math.max(0, (p.ready['potion'] ?? 0) - s.tick);
      const low = p.hp < p.maxHp * 0.4 && left === 0 && s.potions > 0;
      g.fillStyle(0x3a1414, 0.95).fillCircle(x, y, 40);
      g.lineStyle(3, left || !s.potions ? 0x555566 : low && Math.floor(this.time.now / 250) % 2 ? 0xffffff : 0xff6a6a, 1).strokeCircle(x, y, 40);
      if (left > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(x, y, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / pt.cooldownTicks), false).fillPath();
      }
      this.btnText[6]!.setText(left > 0 ? `${(left / TICKS_PER_SEC).toFixed(0)}` : `藥水\n×${s.potions}`);
    }
    // MP 條（HP 文字下方）
    {
      const w = 220;
      const x0 = (GAME_WIDTH - w) / 2;
      g.fillStyle(0x000000, 0.6).fillRect(x0 - 2, 96, w + 4, 8);
      g.fillStyle(0xff7ad0, 1).fillRect(x0, 98, (w * p.mp) / SWORDSMAN.mp, 4);
    }
  }

  private finish(): void {
    this.ended = true;
    const r = summarize(this.s);
    const win = r.victory;
    // 結束：畫面變暗、勝利金光／倒下時主角淡出
    const dim = this.add.rectangle(GAME_WIDTH / 2, 640, GAME_WIDTH, 1280, 0x000000, 0).setDepth(75);
    this.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 500 });
    this.add.rectangle(GAME_WIDTH / 2, 575, 560, 400, 0x120c06, 0.92).setStrokeStyle(3, win ? 0xffd27a : 0x8a5050, 0.9).setDepth(78);
    const pu = playerOf(this.s);
    if (win) {
      SFX.confirm();
      sparks(this, this.sx(pu.x), this.sy(pu.y) - 40, 30, 'ember', 0xffd27a, 520);
      shockRing(this, this.sx(pu.x), this.sy(pu.y), 0xffd27a, 220, 600, 8);
    } else {
      const sp = this.sprites.get(pu.id);
      if (sp) this.tweens.add({ targets: sp, alpha: 0.25, angle: sp.flipX ? -80 : 80, duration: 600, ease: 'Cubic.In' });
    }
    const farming = !!STAGES[this.stageId]?.spawnGroups?.length;
    bigText(this, GAME_WIDTH / 2, 420, win ? '勝利！' : r.outcome === 'timeout' ? (farming ? '刷怪結束' : '時間到') : '倒下了…', win || farming ? '#ffd27a' : '#ff8a8a', 72, -1);
    const lines = farming
      ? `擊殺 ${r.kills}　營火醒來 ${this.s.revives ?? 0} 次\n撿到：金幣 ${this.s.loot?.gold ?? 0}　粉塵 ${this.s.loot?.dust ?? 0}　結晶 ${this.s.loot?.crystal ?? 0}\n閃避 ${r.dodges}（躲掉 ${r.dodgedHits}）　格擋 ${r.blocks}　藥水 ${r.potionsUsed}`
      : `時間 ${(r.durationTicks / TICKS_PER_SEC).toFixed(1)} 秒　承傷 ${r.damageTaken}\n閃避 ${r.dodges}（躲掉 ${r.dodgedHits}）　格擋 ${r.blocks}`;
    this.add.text(GAME_WIDTH / 2, 520, lines, { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff', stroke: '#000', strokeThickness: 5, align: 'center', lineSpacing: 8 }).setOrigin(0.5).setDepth(80);
    const mk = (y: number, label: string, fn: () => void) => {
      const t = this.add.text(GAME_WIDTH / 2, y, label, { fontFamily: UI_FONT, fontSize: '30px', fontStyle: '700', color: '#ffffff', backgroundColor: '#3a2a14' }).setOrigin(0.5).setPadding(30, 12, 30, 12).setDepth(80).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        SFX.confirm();
        fn();
      });
    };
    mk(640, '再一次', () => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ?? '' }));
    const next = STAGE_IDS[(STAGE_IDS.indexOf(this.stageId) + 1) % STAGE_IDS.length]!;
    mk(730, `下一關：${STAGES[next]!.name}`, () => this.scene.restart({ stage: next, seed: this.seed + 1, bot: this.botName ?? '' }));
  }
}
