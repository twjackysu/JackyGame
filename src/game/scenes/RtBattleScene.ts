// 即時戰鬥試玩場景（除錯入口：?debug&scene=RtBattle&stage=forest_entry；D-063／D-065，design/20 §B8 P1）。
// Phaser 只負責畫 BattleState 與收輸入 → BattleCommand；戰鬥結果全部由 src/core/battle/rt 決定（D-062）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { SKILLS, STAGES } from '../../core/battle/rt/data';
import { createBattle, enemiesOf, playerOf, step } from '../../core/battle/rt/engine';
import { BOT_PROFILES, PlayerBot, summarize } from '../../core/battle/rt/sim';
import type { BattleCommand, BattleState, Shape, Unit } from '../../core/battle/rt/types';
import { TICKS_PER_SEC } from '../../core/battle/rt/types';
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
  /** 上一 tick 的座標（60 FPS 插值用） */
  private prev = new Map<number, { x: number; y: number }>();
  private sprites = new Map<number, Phaser.GameObjects.Image>();
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
    this.bot = b && BOT_PROFILES[b] ? new PlayerBot(BOT_PROFILES[b], b) : null;
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
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    const kb = this.input.keyboard;
    if (kb) this.keys = kb.addKeys('W,A,S,D,ONE,TWO,THREE,FOUR,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    (window as unknown as { __rt?: unknown }).__rt = { state: () => this.s, result: () => summarize(this.s) };
  }

  // ---------- 輸入 ----------
  private readonly JOY = { x: 150, y: 1150, r: 90 };
  private btnPos(i: number): { x: number; y: number } {
    // 右下：四技能呈弧形，閃避在最右下
    const P = [{ x: 470, y: 1190 }, { x: 470, y: 1080 }, { x: 570, y: 1010 }, { x: 670, y: 1060 }, { x: 640, y: 1185 }];
    return P[i]!;
  }

  private makeButtons(): void {
    const names = [...SKILL_KEYS.map((id) => SKILLS[id]!.name), '閃避'];
    this.btnText = names.map((n, i) => {
      const { x, y } = this.btnPos(i);
      return this.add.text(x, y, n, { fontFamily: UI_FONT, fontSize: i === 4 ? '22px' : '20px', fontStyle: '700', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(60);
    });
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.ended || this.menu) return;
    if (p.y < VIEW_TOP && p.x > GAME_WIDTH - 100) return; // 選單鍵
    if (this.hint) this.dismissHint();
    for (let i = 0; i < 5; i++) {
      const b = this.btnPos(i);
      if (Math.hypot(p.x - b.x, p.y - b.y) <= 52) {
        if (i < 4) this.pending.push({ type: 'skill', id: SKILL_KEYS[i]! });
        else this.pending.push({ type: 'dodge', dx: this.stick?.dx ?? 0, dy: this.stick?.dy ?? 0 });
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
    const hit = enemiesOf(this.s).find((e) => Math.hypot(e.x - wx, e.y - wy) <= e.r + 60);
    if (hit) this.pending.push({ type: 'target', id: hit.id });
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
    mk(270, this.botName ? '改成自己操作' : '看 Bot 示範（熟練）', () => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ? '' : 'expert' }));
    this.menu = this.add.container(GAME_WIDTH / 2, 640, items).setDepth(95);
  }

  private showHint(): void {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
    } catch {
      /* 無痕模式 */
    }
    const lines = ['左下拖曳：走位（放開＝自動追擊＋普攻）', '紅色範圍＝敵人要打這裡，填滿就命中', '黃框＝可以「格擋反擊」　右下：技能／閃避', '點敵人＝鎖定目標'];
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
      else if (e.type === 'cast') SFX.blip();
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
    const key = `rt_ground_${a.w}x${a.h}`;
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
      } else if (h.shape.type === 'circle') this.spin(p.x, p.y, h.shape.r, big ? 0xffd05a : 0x9fd8ff, (this.time.now / 90) % (Math.PI * 2));
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
        sp.setAlpha(inv ? 0.45 : 1);
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
    this.hud.setText(`HP ${p.hp}/${p.maxHp}　敵人 ${enemiesOf(s).length}　${(s.tick / TICKS_PER_SEC).toFixed(1)} 秒`);
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
    // 搖桿
    g.fillStyle(0xffffff, 0.08).fillCircle(this.JOY.x, this.JOY.y, this.JOY.r);
    g.lineStyle(2, 0xffffff, 0.3).strokeCircle(this.JOY.x, this.JOY.y, this.JOY.r);
    if (this.stick) {
      g.fillStyle(0xffffff, 0.15).fillCircle(this.stick.bx, this.stick.by, this.JOY.r);
      g.fillStyle(0xffd27a, 0.7).fillCircle(this.stick.bx + (this.stick.dx / 1000) * 50, this.stick.by + (this.stick.dy / 1000) * 50, 34);
    }
    // 技能鍵（冷卻遮罩）
    const ids = [...SKILL_KEYS, 'dodge'];
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
    bigText(this, GAME_WIDTH / 2, 420, win ? '勝利！' : r.outcome === 'timeout' ? '時間到' : '倒下了…', win ? '#ffd27a' : '#ff8a8a', 72, -1);
    const lines = `時間 ${(r.durationTicks / TICKS_PER_SEC).toFixed(1)} 秒　承傷 ${r.damageTaken}\n閃避 ${r.dodges}（躲掉 ${r.dodgedHits}）　格擋 ${r.blocks}`;
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
