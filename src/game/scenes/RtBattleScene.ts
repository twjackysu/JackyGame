// 即時戰鬥試玩場景（除錯入口：?debug&scene=RtBattle&stage=forest_entry；D-063／D-065，design/20 §B8 P1）。
// Phaser 只負責畫 BattleState 與收輸入 → BattleCommand；戰鬥結果全部由 src/core/battle/rt 決定（D-062）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { SKILLS, STAGES } from '../../core/battle/rt/data';
import { createBattle, enemiesOf, playerOf, step } from '../../core/battle/rt/engine';
import { BOT_PROFILES, PlayerBot, summarize } from '../../core/battle/rt/sim';
import type { BattleCommand, BattleState, Shape } from '../../core/battle/rt/types';
import { TICKS_PER_SEC } from '../../core/battle/rt/types';
import { ENEMIES, SWORDSMAN } from '../../core/battle/rt/data';
import { GAME_WIDTH } from '../config';
import { TITLE_FONT, UI_FONT, bigText, floatNumber, shockRing, sparks } from '../fx/feel';

const STEP_MS = 1000 / TICKS_PER_SEC;
const STAGE_IDS = Object.keys(STAGES);
const SKILL_KEYS = ['heavy_slash', 'whirlwind', 'charge', 'parry'] as const;

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

  constructor() {
    super('RtBattle');
  }

  init(data: { stage?: string; seed?: number; bot?: string }): void {
    const q = new URLSearchParams(window.location.search);
    this.stageId = data.stage ?? q.get('stage') ?? 'forest_entry';
    if (!STAGES[this.stageId]) this.stageId = 'forest_entry';
    this.seed = data.seed ?? Number(q.get('seed') ?? 1);
    const b = (data.bot ?? q.get('bot')) as keyof typeof BOT_PROFILES | null;
    this.bot = b && BOT_PROFILES[b] ? new PlayerBot(BOT_PROFILES[b], b) : null;
  }

  create(): void {
    this.s = createBattle({ stageId: this.stageId, seed: this.seed });
    this.acc = 0;
    this.evIdx = 0;
    this.ended = false;
    this.pending = [];
    this.stick = null;
    const a = this.s.arena;
    this.k = Math.min((GAME_WIDTH - 40) / a.w, 860 / a.h);
    this.ox = (GAME_WIDTH - a.w * this.k) / 2;
    this.oy = 110;
    this.cameras.main.setBackgroundColor('#0b1410');
    this.g = this.add.graphics();
    this.ui = this.add.graphics().setDepth(50);
    this.add.text(GAME_WIDTH / 2, 40, `即時戰鬥試玩・${STAGES[this.stageId]!.name}`, { fontFamily: TITLE_FONT, fontSize: '30px', color: '#ffd27a' }).setOrigin(0.5);
    this.hud = this.add.text(GAME_WIDTH / 2, 82, '', { fontFamily: UI_FONT, fontSize: '18px', color: '#c8d0f0' }).setOrigin(0.5);
    this.makeButtons();
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
    if (this.ended) return;
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
    if (this.ended) return;
    this.acc += Math.min(delta, 250);
    let n = 0;
    while (this.acc >= STEP_MS && n < 6 && this.s.outcome === 'running') {
      step(this.s, this.commands());
      this.acc -= STEP_MS;
      n++;
    }
    this.playEvents();
    this.draw();
    if (this.s.outcome !== 'running') this.finish();
  }

  private sx(x: number): number {
    return this.ox + x * this.k;
  }
  private sy(y: number): number {
    return this.oy + y * this.k;
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
        floatNumber(this, this.sx(d.x), this.sy(d.y) - 30, `${e.amount}${e.crit ? '!' : ''}`, { color: toPlayer ? '#ff8a8a' : e.crit ? '#ffd05a' : e.origin === 'counter' ? '#7dffb0' : '#ffffff', size: e.crit || e.origin === 'counter' ? 34 : 26 });
        if (!toPlayer && e.origin !== 'dot') {
          SFX.hitLight();
          sparks(this, this.sx(d.x), this.sy(d.y), 6, 'spark', 0xffffff, 260);
        }
        if (toPlayer) this.cameras.main.shake(90, 0.004);
      } else if (e.type === 'dodge') SFX.dodge();
      else if (e.type === 'block') {
        SFX.parry();
        const p = playerOf(this.s);
        shockRing(this, this.sx(p.x), this.sy(p.y), 0x7dffb0, 90, 300, 6);
        bigText(this, this.sx(p.x), this.sy(p.y) - 80, '格擋！', '#7dffb0', 40, 300);
      } else if (e.type === 'dodged') {
        const p = playerOf(this.s);
        floatNumber(this, this.sx(p.x), this.sy(p.y) - 40, 'MISS', { color: '#9fd8ff', size: 26 });
      } else if (e.type === 'death') {
        const d = u(e.id);
        if (d && d.side === 'enemy') {
          SFX.hitHeavy();
          sparks(this, this.sx(d.x), this.sy(d.y), 18, 'spark', 0xffd27a, 420);
        }
      } else if (e.type === 'phase2') bigText(this, GAME_WIDTH / 2, 520, '狼王暴怒！', '#ff7a5a', 52, 700);
      else if (e.type === 'wallStun') bigText(this, GAME_WIDTH / 2, 520, '撞牆暈眩！趁現在！', '#ffd27a', 40, 700);
      else if (e.type === 'cast') SFX.blip();
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

  private draw(): void {
    const g = this.g.clear();
    const s = this.s;
    // 地面
    g.fillStyle(0x16261c, 1).fillRect(this.ox, this.oy, s.arena.w * this.k, s.arena.h * this.k);
    g.lineStyle(4, 0x4a6a50, 1).strokeRect(this.ox, this.oy, s.arena.w * this.k, s.arena.h * this.k);
    g.lineStyle(1, 0x203a28, 1);
    for (let x = 0; x <= s.arena.w; x += 100) g.lineBetween(this.sx(x), this.oy, this.sx(x), this.sy(s.arena.h));
    for (let y = 0; y <= s.arena.h; y += 100) g.lineBetween(this.ox, this.sy(y), this.sx(s.arena.w), this.sy(y));
    // 預告：填色隨時間加深＋粗虛邊（不只靠顏色；紫＝附狀態、黃＝可格擋外框）
    for (const t of s.telegraphs) {
      const prog = Math.min(1, (s.tick - t.startTick) / Math.max(1, t.hitTick - t.startTick));
      const owner = s.units.find((x) => x.id === t.ownerId);
      const atk = owner ? ENEMIES[owner.defId]?.attacks.find((a) => a.id === t.attackId) : undefined;
      const col = atk?.status ? 0xb060ff : 0xff3a3a;
      g.fillStyle(col, 0.12 + prog * 0.3);
      this.shapePath(t.shape, t.ox, t.oy, t.dirX, t.dirY, g, true);
      g.lineStyle(t.blockable ? 3 : 5, t.blockable ? 0xffd27a : col, 0.9);
      this.shapePath(t.shape, t.ox, t.oy, t.dirX, t.dirY, g, false);
    }
    // 單位
    for (const x of s.units) {
      if (x.dead) continue;
      const px = this.sx(x.x);
      const py = this.sy(x.y);
      const r = x.r * this.k;
      const isP = x.side === 'player';
      const boss = !!ENEMIES[x.defId]?.boss;
      const inv = isP && x.invulnUntil >= s.tick;
      g.fillStyle(0x000000, 0.35).fillEllipse(px, py + r * 0.7, r * 2.2, r * 0.9);
      g.fillStyle(isP ? (inv ? 0x9fd8ff : 0x4a8aff) : boss ? 0x8a3a6a : x.defId === 'thorn_shooter' ? 0x5a8a3a : x.defId === 'alpha_wolf' ? 0x8a6a3a : 0x6a6a7a, inv ? 0.6 : 1).fillCircle(px, py, r);
      g.lineStyle(isP ? 3 : 2, isP ? 0xffffff : boss ? 0xffb0d0 : 0xd0d0e0, 1).strokeCircle(px, py, r);
      // 面向
      g.lineStyle(3, 0xffffff, 0.9).lineBetween(px, py, px + (x.facingX / 1000) * r * 1.4, py + (x.facingY / 1000) * r * 1.4);
      // 狀態
      if (x.statuses.some((q) => (q.id === 'stun' || q.id === 'freeze') && q.until > s.tick)) g.lineStyle(3, 0xffe066, 1).strokeCircle(px, py - r - 10, 8);
      if (x.statuses.some((q) => q.id === 'poison' && q.until > s.tick)) g.fillStyle(0xb060ff, 1).fillCircle(px + r, py - r, 6);
      // HP 條
      const w = Math.max(40, r * 2.4);
      g.fillStyle(0x000000, 0.7).fillRect(px - w / 2, py - r - 16, w, 7);
      g.fillStyle(isP ? 0x7dffb0 : 0xff6a6a, 1).fillRect(px - w / 2, py - r - 16, w * (x.hp / x.maxHp), 7);
      // 鎖定
      if (!isP && playerOf(s).targetId === x.id) g.lineStyle(2, 0xffd27a, 0.9).strokeCircle(px, py, r + 6);
      // 玩家施放中：畫技能範圍
      if (isP && x.action?.kind === 'skill') {
        const sk = SKILLS[x.action.id];
        const h = sk?.hits[0] ?? sk?.block?.counter;
        if (h) {
          g.fillStyle(0x7dc8ff, 0.18);
          this.shapePath(h.shape, x.x, x.y, x.action.dirX, x.action.dirY, g, true);
        }
      }
    }
    this.drawUi();
  }

  private drawUi(): void {
    const g = this.ui.clear();
    const s = this.s;
    const p = playerOf(s);
    this.hud.setText(`HP ${p.hp}/${p.maxHp}　敵人 ${enemiesOf(s).length}　${(s.tick / TICKS_PER_SEC).toFixed(1)} 秒`);
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
    mk(640, '再一次', () => this.scene.restart({ stage: this.stageId, seed: this.seed + 1 }));
    const next = STAGE_IDS[(STAGE_IDS.indexOf(this.stageId) + 1) % STAGE_IDS.length]!;
    mk(730, `下一關：${STAGES[next]!.name}`, () => this.scene.restart({ stage: next, seed: this.seed + 1 }));
  }
}
