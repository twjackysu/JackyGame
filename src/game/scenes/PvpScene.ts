// 競技場（V5 非同步 PvP 天梯，24 §6.2、第 144 輪）：
// 伺服器 pvp.start 發種子與雙方配裝 → 這裡用同一份引擎在本機打（對手由 PlayerBot 操作，跟伺服器重跑時一模一樣）→
// 記下自己的指令 → pvp.finish 交給伺服器重跑判勝負、改段位分。畫面只送意圖，勝負以伺服器為準（26-security）。
// 跟大地圖的 RtBattleScene 分開：競技場整塊放得進一個畫面（不用鏡頭）、沒有掉落與存檔，畫面全部程式美術。
import Phaser from 'phaser';
import { STAGES, WEAPONS } from '../../core/battle/rt/data';
import { playerDef, playerOf, skillDef, skillShape, step } from '../../core/battle/rt/engine';
import { PVP_MAX_CMDS_PER_TICK, PVP_STAGE, startPvp, type PvpInputs } from '../../core/battle/rt/pvpMatch';
import type { PlayerBot } from '../../core/battle/rt/sim';
import { TICKS_PER_SEC, UNIT, type BattleCommand, type BattleState, type Shape, type Unit } from '../../core/battle/rt/types';
import { rankAura, rankName } from '../../core/meta/pvpRank';
import { SFX } from '../../audio/sfx';
import { setBackHandler } from '../backButton';
import { GAME_HEIGHT, GAME_WIDTH, TALL } from '../config';
import { UI_FONT, fadeOutThen } from '../fx/feel';
import { InputSystem } from '../rt/InputSystem';
import { buttonPos, loadControls } from '../rtControls';
import { pvpOps, type PvpOpen, type PvpResult } from '../pvpOps';
import { heroKey, WEAPON_NAME } from '../weapon';

const STEP_MS = 1000 / TICKS_PER_SEC;
const DIR = 1000;
/** 競技場縮放：14×16 格整塊放進畫面上半部 */
const K = 0.44;
const ME = 0x6ab8ff;
const FOE = 0xff6a5a;
type Phase = 'lobby' | 'loading' | 'intro' | 'fight' | 'judging' | 'result' | 'replay' | 'error';
/** 重播速度（第 146 輪：結算畫面「看重播」） */
const REPLAY_SPEED = 2;

export class PvpScene extends Phaser.Scene {
  private phase: Phase = 'loading';
  private open: PvpOpen | null = null;
  private s!: BattleState;
  private foeBot!: PlayerBot;
  private inputs: PvpInputs = [];
  /** 伺服器判定的結果（重播完再顯示一次） */
  private last: PvpResult | null = null;
  /** 重播進行到第幾筆指令紀錄 */
  private rpIdx = 0;
  private inp = new InputSystem();
  private acc = 0;
  private evIdx = 0;
  private prev = new Map<number, { x: number; y: number }>();
  private ox = 0;
  private oy = 0;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private flashUntil = new Map<number, number>();
  private fx: { kind: 'streak' | 'shape'; until: number; dur: number; col: number; x0: number; y0: number; x1: number; y1: number; shape?: Shape; dx?: number; dy?: number }[] = [];
  private status!: Phaser.GameObjects.Text;
  /** 大字後面的暗底（字蓋在競技場上看得清楚） */
  private statusBg!: Phaser.GameObjects.Graphics;
  private timer!: Phaser.GameObjects.Text;
  private names: Phaser.GameObjects.Text[] = [];
  private buttons: { id: string; x: number; y: number; r: number; label: Phaser.GameObjects.Text; cd: Phaser.GameObjects.Text }[] = [];
  private skills: string[] = [];

  constructor() {
    super('Pvp');
  }

  init(): void {
    this.phase = 'lobby';
    this.open = null;
    this.inputs = [];
    this.inp.reset();
    this.acc = 0;
    this.evIdx = 0;
    this.prev.clear();
    this.sprites.clear();
    this.flashUntil.clear();
    this.fx = [];
    this.names = [];
    this.buttons = [];
  }

  create(): void {
    const W = GAME_WIDTH;
    this.cameras.main.setBackgroundColor('#0b0e18');
    this.ox = Math.round((W - 14 * UNIT * K) / 2);
    this.oy = 150 + Math.round(TALL / 2);
    this.drawArena();
    this.g = this.add.graphics().setDepth(20);
    this.hud = this.add.graphics().setDepth(60);
    this.timer = this.add.text(W / 2, 58, '', { fontFamily: UI_FONT, fontSize: '34px', color: '#ffe0a0' }).setOrigin(0.5).setDepth(61);
    this.statusBg = this.add.graphics().setDepth(79);
    this.status = this.add.text(W / 2, this.oy + (16 * UNIT * K) / 2, '', { fontFamily: UI_FONT, fontSize: '36px', color: '#ffffff', align: 'center', lineSpacing: 10, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setDepth(80);
    setBackHandler(this, () => {
      if (this.phase === 'fight' || this.phase === 'judging') return 'handled'; // 打到一半不能逃（逃了就沒有結果）
      this.leave();
      return 'handled';
    });
    // 搖桿：點在按鈕以外的地方
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.phase !== 'fight') return;
      const b = this.buttons.find((x) => Math.hypot(x.x - p.x, x.y - p.y) <= x.r + 8);
      if (b) this.press(b.id);
      else if (!this.inp.stick) this.inp.stickStart(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.inp.stickMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.inp.stickEnd(p));
    this.inp.bindKeys(this.input.keyboard, loadControls());
    this.lobby();
  }

  /** 天梯大廳：排行＋「開始對戰」（第 144 輪） */
  private lobby(): void {
    const W = GAME_WIDTH;
    const box = this.add.container(0, 0).setDepth(85);
    const top = this.oy + 20;
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0d1a, 0.92).fillRoundedRect(36, top, W - 72, 16 * UNIT * K - 40, 20);
    bg.lineStyle(2, 0xffd27a, 0.7).strokeRoundedRect(36, top, W - 72, 16 * UNIT * K - 40, 20);
    const title = this.add.text(W / 2, top + 44, '⚔ 競技場天梯', { fontFamily: UI_FONT, fontSize: '38px', color: '#ffd27a' }).setOrigin(0.5);
    const sub = this.add.text(W / 2, top + 92, '讀取排行…', { fontFamily: UI_FONT, fontSize: '24px', color: '#c8d0e0' }).setOrigin(0.5);
    box.add([bg, title, sub]);
    const start = () => {
      box.destroy();
      this.phase = 'loading';
      this.status.setText('尋找對手…');
      void pvpOps.start().then((o) => (this.scene.isActive() ? this.begin(o) : undefined));
    };
    this.endButtons([
      ['開始對戰', start],
      ['離開', () => this.leave()],
    ]);
    void pvpOps.ladder().then((lad) => {
      if (!this.scene.isActive() || !box.active) return;
      if (!lad) {
        sub.setText('伺服器沒有回應，排行讀不到');
        return;
      }
      sub.setText(`你的段位：${rankName(lad.rating)} ${lad.rating}　第 ${lad.pos} / ${lad.total} 名`);
      lad.rows.forEach((r, i) => {
        const y = top + 145 + i * 44 + (i >= 10 ? 12 : 0);
        const col = r.me ? '#ffd27a' : '#ffffff';
        if (r.me) {
          const hl = this.add.graphics().fillStyle(0xffd27a, 0.14).fillRoundedRect(56, y - 20, W - 112, 40, 8);
          box.add(hl);
        }
        box.add([
          this.add.text(76, y, `${r.pos}`, { fontFamily: UI_FONT, fontSize: '24px', color: r.pos <= 3 ? '#ffd27a' : '#9aa4b8' }).setOrigin(0, 0.5),
          this.add.text(136, y, r.me ? `${r.name}（你）` : r.name, { fontFamily: UI_FONT, fontSize: '24px', color: col }).setOrigin(0, 0.5),
          this.add.text(W - 250, y, WEAPON_NAME[r.weapon], { fontFamily: UI_FONT, fontSize: '22px', color: '#9aa4b8' }).setOrigin(0, 0.5),
          this.add.text(W - 76, y, `${rankName(r.rating)} ${r.rating}`, { fontFamily: UI_FONT, fontSize: '24px', color: col }).setOrigin(1, 0.5),
        ]);
      });
      box.add(this.add.text(W / 2, this.oy + 16 * UNIT * K + 44, '對手是其他冒險者的配裝（電腦操作）\n勝負由伺服器重播你的操作判定', { fontFamily: UI_FONT, fontSize: '20px', color: '#7a8296', align: 'center' }).setOrigin(0.5));
    });
  }

  private begin(o: PvpOpen | null): void {
    if (!o) {
      this.phase = 'error';
      this.status.setText('競技場的伺服器沒有回應\n請稍後再試');
      this.endButtons();
      return;
    }
    this.open = o;
    const st = startPvp(o.setup);
    this.s = st.s;
    this.foeBot = st.foeBot;
    this.skills = [...WEAPONS[o.setup.me.weapon].player.skills];
    for (const u of this.units()) {
      const sp = this.add.image(0, 0, heroKey(this.weaponOf(u), (k) => this.textures.exists(k))).setOrigin(0.5, 0.92).setDepth(30);
      sp.setScale((u.r * 5.5 * K) / sp.height);
      sp.setData('base', sp.scaleX);
      if (u.pid) sp.setTint(0xffa8a0);
      this.sprites.set(u.id, sp);
      this.names.push(this.add.text(0, 0, u.pid ? o.foeName : '你', { fontFamily: UI_FONT, fontSize: '22px', color: u.pid ? '#ffb0a8' : '#bfe0ff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(40));
    }
    this.makeButtons();
    // 開場：雙方介紹 1.6 秒
    this.phase = 'intro';
    const foeW = WEAPON_NAME[o.setup.foe.weapon];
    this.status.setText(`${rankName(o.rating)} ${o.rating}　你（${WEAPON_NAME[o.setup.me.weapon]}）\nVS\n${o.foeName}（${foeW}）　${rankName(o.foeRating)} ${o.foeRating}`).setFontSize(30);
    SFX.warn(false);
    this.time.delayedCall(1600, () => {
      this.status.setText('開戰！').setFontSize(64).setColor('#ffd27a');
      this.cameras.main.shake(200, 0.008);
      SFX.confirm();
      this.phase = 'fight';
      this.time.delayedCall(600, () => this.phase === 'fight' && this.status.setText(''));
    });
  }

  private units(): Unit[] {
    return this.s.units.filter((u) => u.side === 'player');
  }

  private weaponOf(u: Unit): 'sword' | 'bow' | 'staff' {
    return u.pid ? this.open!.setup.foe.weapon : this.open!.setup.me.weapon;
  }

  private press(id: string): void {
    SFX.uiTap();
    if (id === 'dodge') {
      const st = this.inp.stick;
      const p = playerOf(this.s);
      this.inp.push({ type: 'dodge', dx: st?.dx || p.facingX, dy: st?.dy || p.facingY });
    } else this.inp.push({ type: 'skill', id });
  }

  private makeButtons(): void {
    const c = loadControls();
    const w = this.open!.setup.me.weapon;
    const ids = [...c.order.filter((x) => this.skills.includes(x)), 'dodge', 'blade_storm'];
    const slot = [0, 1, 2, 3, 4, 5];
    ids.forEach((id, i) => {
      const pos = buttonPos(c, slot[i]!);
      const r = (id === 'dodge' ? 56 : 48) * c.scale;
      const name = id === 'dodge' ? '閃避' : (WEAPONS[w].skills[id]?.name ?? id);
      const label = this.add.text(pos.x, pos.y, name.length > 2 ? name.slice(0, 2) + '\n' + name.slice(2) : name, { fontFamily: UI_FONT, fontSize: name.length > 2 ? '19px' : '24px', color: '#ffffff', align: 'center', lineSpacing: 0 }).setOrigin(0.5).setDepth(62);
      const cd = this.add.text(pos.x, pos.y + r - 12, '', { fontFamily: UI_FONT, fontSize: '20px', color: '#ffd27a', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(63);
      this.buttons.push({ id, x: pos.x, y: pos.y, r, label, cd });
    });
  }

  private commands(): BattleCommand[] {
    // 只送自己的意圖；停止（stop）每個 tick 都會自動清，不用記
    const mine = this.inp.commands((i) => this.skills[i] ?? 'heavy_slash', () => false).filter((c) => c.type !== 'stop' && c.type !== 'potion' && c.type !== 'rest');
    const c = mine.slice(0, PVP_MAX_CMDS_PER_TICK);
    if (c.length) this.inputs.push({ t: this.s.tick + 1, c });
    return [...c, ...this.foeBot.decide(this.s)];
  }

  update(_t: number, delta: number): void {
    if (this.phase === 'fight' || this.phase === 'replay') {
      const rp = this.phase === 'replay';
      this.acc += rp ? delta * REPLAY_SPEED : delta;
      let n = 0;
      while (this.acc >= STEP_MS && n < (rp ? 4 * REPLAY_SPEED : 4) && this.s.outcome === 'running') {
        for (const u of this.units()) this.prev.set(u.id, { x: u.x, y: u.y });
        step(this.s, rp ? this.replayCommands() : this.commands());
        this.acc -= STEP_MS;
        n++;
        this.playEvents();
      }
      if (this.acc > STEP_MS * 4) this.acc = 0;
      if (this.s.outcome !== 'running') {
        if (rp) {
          if (this.last && this.s.outcome !== this.last.outcome) console.warn('[pvp] 重播結果和伺服器判定不同', this.s.outcome, this.last.outcome);
          this.showResult(this.last);
        }
        else this.finish();
      }
    }
    if (this.open) this.draw();
  }

  // ---------- 畫面 ----------
  private sx(x: number): number {
    return this.ox + x * K;
  }
  private sy(y: number): number {
    return this.oy + y * K;
  }

  private drawArena(): void {
    const a = this.add.graphics().setDepth(1);
    const w = 14 * UNIT * K;
    const h = 16 * UNIT * K;
    const { ox, oy } = this;
    a.fillStyle(0x000000, 0.5).fillRoundedRect(ox - 14, oy - 14, w + 28, h + 28, 18);
    a.fillStyle(0x3a3226, 1).fillRect(ox, oy, w, h);
    // 石板地：格線＋深淺交錯
    for (let gx = 0; gx < 14; gx++)
      for (let gy = 0; gy < 16; gy++) if ((gx + gy) % 2 === 0) a.fillStyle(0x433a2c, 1).fillRect(ox + gx * UNIT * K, oy + gy * UNIT * K, UNIT * K, UNIT * K);
    a.lineStyle(1, 0x2a241a, 0.8);
    for (let gx = 1; gx < 14; gx++) a.lineBetween(ox + gx * UNIT * K, oy, ox + gx * UNIT * K, oy + h);
    for (let gy = 1; gy < 16; gy++) a.lineBetween(ox, oy + gy * UNIT * K, ox + w, oy + gy * UNIT * K);
    // 中線與中央紋章
    a.lineStyle(3, 0xffd27a, 0.35).lineBetween(ox, oy + h / 2, ox + w, oy + h / 2);
    a.lineStyle(3, 0xffd27a, 0.3).strokeCircle(ox + w / 2, oy + h / 2, 70);
    a.lineStyle(2, 0xffd27a, 0.2).strokeCircle(ox + w / 2, oy + h / 2, 52);
    // 兩邊出生區
    a.fillStyle(ME, 0.1).fillRect(ox, oy + h - 2 * UNIT * K, w, 2 * UNIT * K);
    a.fillStyle(FOE, 0.1).fillRect(ox, oy, w, 2 * UNIT * K);
    // 外框（金邊）
    a.lineStyle(6, 0x8a6a3a, 1).strokeRect(ox - 3, oy - 3, w + 6, h + 6);
    a.lineStyle(2, 0xffd27a, 0.6).strokeRect(ox - 8, oy - 8, w + 16, h + 16);
    // 掩體：石塊（上面亮、側面暗）
    const rows = STAGES[PVP_STAGE]?.arena.solid?.rows ?? [];
    rows.forEach((row, gy) =>
      [...row].forEach((ch, gx) => {
        if (ch !== '#') return;
        const x = ox + gx * UNIT * K;
        const y = oy + gy * UNIT * K;
        const c = UNIT * K;
        a.fillStyle(0x000000, 0.35).fillRect(x + 4, y + 6, c, c);
        a.fillStyle(0x5a5650, 1).fillRect(x, y, c, c);
        a.fillStyle(0x7a766e, 1).fillRect(x + 2, y + 2, c - 4, c * 0.55);
        a.lineStyle(1, 0x2a2826, 1).strokeRect(x, y, c, c);
      }),
    );
  }

  private lerp(u: Unit): { x: number; y: number } {
    const p = this.prev.get(u.id);
    if (!p || (this.phase !== 'fight' && this.phase !== 'replay')) return { x: u.x, y: u.y };
    const t = Math.min(1, this.acc / STEP_MS);
    return { x: p.x + (u.x - p.x) * t, y: p.y + (u.y - p.y) * t };
  }

  /** 段位外觀（rankAura）：腳下往外擴散的光圈＋高段位的環繞光點；只是外觀，不影響戰鬥 */
  private drawAura(g: Phaser.GameObjects.Graphics, u: Unit, x: number, y: number, r: number, now: number): void {
    const a = rankAura(u.pid ? this.open!.foeRating : this.open!.rating);
    if (!a) return;
    const period = 1400;
    for (let i = 0; i < a.rings; i++) {
      const t = ((now + (i * period) / a.rings) % period) / period;
      g.lineStyle(5 - t * 3, a.color, 0.85 * (1 - t)).strokeEllipse(x, y, r * (2.7 + t * 2.2), r * (1.05 + t * 0.9));
    }
    for (let i = 0; i < a.motes; i++) {
      const ang = now / 700 + (i * Math.PI * 2) / a.motes;
      const mx = x + Math.cos(ang) * r * 1.5;
      const my = y - r * 0.9 + Math.sin(ang) * r * 0.55 - Math.sin(now / 300 + i) * r * 0.15;
      g.fillStyle(a.color, 0.4).fillCircle(mx, my, 9);
      g.fillStyle(0xffffff, 0.95).fillCircle(mx, my, 4);
    }
  }

  private shapePath(g: Phaser.GameObjects.Graphics, sh: Shape, ox: number, oy: number, dx: number, dy: number, fill: boolean): void {
    const x = this.sx(ox);
    const y = this.sy(oy);
    const a = Math.atan2(dy, dx);
    if (sh.type === 'circle') {
      if (fill) g.fillCircle(x, y, sh.r * K);
      else g.strokeCircle(x, y, sh.r * K);
    } else if (sh.type === 'ring') {
      g.strokeCircle(x, y, sh.rOut * K);
      if (sh.rIn > 0) g.strokeCircle(x, y, sh.rIn * K);
    } else if (sh.type === 'sector') {
      const half = (sh.deg / 2) * (Math.PI / 180);
      g.beginPath().moveTo(x, y).arc(x, y, sh.r * K, a - half, a + half, false).closePath();
      if (fill) g.fillPath();
      else g.strokePath();
    } else {
      const len = sh.len * K;
      const hw = (sh.width * K) / 2;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const pts = [new Phaser.Math.Vector2(x - uy * hw, y + ux * hw), new Phaser.Math.Vector2(x + ux * len - uy * hw, y + uy * len + ux * hw), new Phaser.Math.Vector2(x + ux * len + uy * hw, y + uy * len - ux * hw), new Phaser.Math.Vector2(x + uy * hw, y - ux * hw)];
      if (fill) g.fillPoints(pts, true);
      else g.strokePoints(pts, true);
    }
  }

  private draw(): void {
    const g = this.g.clear();
    const now = this.time.now;
    const s = this.s;
    // 招式的範圍閃一下（施放瞬間）、遠程普攻的彈道
    this.fx = this.fx.filter((f) => f.until > now);
    for (const f of this.fx) {
      const k = (f.until - now) / f.dur;
      if (f.kind === 'streak') {
        g.lineStyle(6 * k + 2, f.col, 0.9 * k).lineBetween(this.sx(f.x0), this.sy(f.y0) - 20, this.sx(f.x1), this.sy(f.y1) - 20);
        g.fillStyle(0xffffff, k).fillCircle(this.sx(f.x1), this.sy(f.y1) - 20, 6 * k + 2);
      } else if (f.shape) {
        g.fillStyle(f.col, 0.28 * k);
        this.shapePath(g, f.shape, f.x0, f.y0, f.dx!, f.dy!, true);
        g.lineStyle(3, f.col, 0.8 * k);
        this.shapePath(g, f.shape, f.x0, f.y0, f.dx!, f.dy!, false);
      }
    }
    this.units().forEach((u, i) => {
      const pos = this.lerp(u);
      const px = this.sx(pos.x);
      const py = this.sy(pos.y);
      const r = u.r * K;
      const col = u.pid ? FOE : ME;
      const sp = this.sprites.get(u.id)!;
      const nm = this.names[i]!;
      if (u.dead) {
        sp.setAlpha(Math.max(0, sp.alpha - 0.03)).setAngle(u.pid ? -80 : 80);
        nm.setVisible(false);
        return;
      }
      g.fillStyle(0x000000, 0.4).fillEllipse(px, py + r * 0.15, r * 2.6, r * 1.1);
      this.drawAura(g, u, px, py + r * 0.15, r, now);
      // 陣營：腳下一圈有底色的光圈（對手紅、自己藍；立繪本身看不太出差別）
      g.fillStyle(col, 0.22 + 0.08 * Math.sin(now / 250)).fillEllipse(px, py + r * 0.15, r * 2.6, r * 1.05);
      g.lineStyle(4, col, 0.95).strokeEllipse(px, py + r * 0.15, r * 2.6, r * 1.05);
      const moving = !!u.action || Math.abs(pos.x - (this.prev.get(u.id)?.x ?? pos.x)) > 0.3;
      const bob = moving ? Math.abs(Math.sin(now / 90 + u.id)) * r * 0.14 : Math.sin(now / 400 + u.id) * r * 0.04;
      const base = sp.getData('base') as number;
      sp.setPosition(px, py + r * 0.15 - bob).setScale(base).setDepth(30 + pos.y / 100);
      if (u.facingX !== 0) sp.setFlipX(u.facingX < 0);
      sp.setAlpha(u.invulnUntil >= s.tick ? 0.5 : 1);
      if ((this.flashUntil.get(u.id) ?? 0) > now) sp.setTintFill(0xffffff);
      else if (u.pid) sp.setTint(0xffa8a0);
      else sp.clearTint();
      const top = sp.y - sp.displayHeight * 0.95;
      // 頭上血條
      const bw = 70;
      g.fillStyle(0x000000, 0.7).fillRect(px - bw / 2 - 2, top - 10, bw + 4, 10);
      g.fillStyle(col, 1).fillRect(px - bw / 2, top - 8, (bw * Math.max(0, u.hp)) / u.maxHp, 6);
      nm.setPosition(px, top - 26);
    });
    this.drawHud();
    const bg = this.statusBg.clear();
    if (this.status.text) {
      const b = this.status.getBounds();
      bg.fillStyle(0x000000, 0.55).fillRoundedRect(b.x - 24, b.y - 16, b.width + 48, b.height + 32, 16);
    }
  }

  private drawHud(): void {
    const h = this.hud.clear();
    const s = this.s;
    const [me, foe] = [playerOf(s), playerOf(s, 1)];
    const W = GAME_WIDTH;
    const bar = (x: number, y: number, w: number, pct: number, col: number, right: boolean) => {
      h.fillStyle(0x000000, 0.7).fillRoundedRect(x - 3, y - 3, w + 6, 26, 6);
      const fw = w * Math.max(0, Math.min(1, pct));
      h.fillStyle(col, 1).fillRoundedRect(right ? x + w - fw : x, y, Math.max(1, fw), 20, 5);
    };
    bar(24, 40, 250, me.hp / me.maxHp, ME, false);
    bar(W - 274, 40, 250, foe.hp / foe.maxHp, FOE, true);
    h.fillStyle(0x9ac0ff, 0.9).fillRect(24, 70, (250 * me.mp) / Math.max(1, playerDef(s, me).mp), 6);
    const left = Math.max(0, Math.ceil((s.timeLimitTicks - s.tick) / TICKS_PER_SEC));
    this.timer.setText(this.phase === 'replay' ? `▶×${REPLAY_SPEED}  ${left}` : `${left}`);
    if (!this.names.length) return;
    if (!this.hudText) {
      this.hudText = [
        this.add.text(24, 14, `你 · ${WEAPON_NAME[this.open!.setup.me.weapon]}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#bfe0ff' }).setDepth(61),
        this.add.text(W - 24, 14, `${this.open!.foeName} · ${WEAPON_NAME[this.open!.setup.foe.weapon]}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffb0a8' }).setOrigin(1, 0).setDepth(61),
      ];
    }
    // 按鈕：冷卻中變暗＋剩幾秒
    const fight = this.phase === 'fight';
    for (const b of this.buttons) {
      const id = b.id === 'dodge' ? 'dodge' : b.id;
      const left = Math.max(0, (me.ready[id] ?? 0) - s.tick);
      const ult = b.id === 'blade_storm';
      const noMp = ult && me.mp < (skillDef(s, 'blade_storm', me)?.mp ?? 0);
      const dim = left > 0 || noMp || !fight;
      h.fillStyle(ult ? 0x3a1430 : b.id === 'dodge' ? 0x10283a : 0x1a1d2a, dim ? 0.55 : 0.9).fillCircle(b.x, b.y, b.r);
      h.lineStyle(3, ult ? 0xff9ae0 : b.id === 'dodge' ? 0x7ad8ff : 0xffd27a, dim ? 0.35 : 0.9).strokeCircle(b.x, b.y, b.r);
      b.label.setAlpha(dim ? 0.5 : 1);
      b.cd.setText(left > 0 ? `${Math.ceil(left / TICKS_PER_SEC)}` : '');
    }
    const st = this.inp.stick;
    if (st && fight) {
      h.lineStyle(3, 0xffffff, 0.35).strokeCircle(st.bx, st.by, 80);
      h.fillStyle(0xffffff, 0.35).fillCircle(st.bx + (st.dx / DIR) * 60, st.by + (st.dy / DIR) * 60, 34);
    }
  }
  private hudText: Phaser.GameObjects.Text[] | null = null;

  private playEvents(): void {
    const ev = this.s.events;
    const now = this.time.now;
    const me = playerOf(this.s);
    for (; this.evIdx < ev.length; this.evIdx++) {
      const e = ev[this.evIdx]!;
      if (e.type === 'damage') {
        const src = this.s.units.find((u) => u.id === e.src);
        const dst = this.s.units.find((u) => u.id === e.dst);
        if (!dst) continue;
        this.flashUntil.set(dst.id, now + 80);
        if (src && e.origin === 'normal' && this.weaponOf(src) !== 'sword') {
          this.fx.push({ kind: 'streak', until: now + 140, dur: 140, col: this.weaponOf(src) === 'staff' ? 0xc89aff : 0xf4f0d0, x0: src.x, y0: src.y, x1: dst.x, y1: dst.y });
          if (this.weaponOf(src) === 'staff') SFX.magicBolt();
          else SFX.bowShot();
        }
        if (dst.id === me.id) {
          this.cameras.main.shake(e.crit ? 160 : 90, e.crit ? 0.01 : 0.004);
          SFX.hit();
        } else (e.crit ? SFX.hitHeavy : SFX.hitLight)();
        const t = this.add.text(this.sx(dst.x) + ((this.evIdx * 37) % 30) - 15, this.sy(dst.y) - 70, `${e.amount}`, { fontFamily: UI_FONT, fontSize: e.crit ? '36px' : '26px', color: dst.id === me.id ? '#ff8a7a' : e.crit ? '#ffe04a' : '#ffffff', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5).setDepth(70);
        this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 700, ease: 'Cubic.Out', onComplete: () => t.destroy() });
      } else if (e.type === 'cast') {
        const u = this.s.units.find((x) => x.id === e.id);
        const sk = u && skillDef(this.s, e.skill, u);
        const h = sk?.hits[0];
        if (u && h) this.fx.push({ kind: 'shape', until: now + 260, dur: 260, col: u.pid ? FOE : ME, x0: u.x, y0: u.y, x1: 0, y1: 0, shape: skillShape(this.s, e.skill, h.shape, u), dx: u.facingX, dy: u.facingY });
        if (sk?.role === 'ult') this.cameras.main.flash(150, 255, 200, 240);
      } else if (e.type === 'dodge') SFX.dodge();
      else if (e.type === 'block') SFX.parry();
      else if (e.type === 'death') {
        this.cameras.main.shake(300, 0.012);
        SFX.break();
      }
    }
  }

  // ---------- 結束 ----------
  private finish(): void {
    if (this.phase !== 'fight') return;
    this.phase = 'judging';
    this.inp.reset();
    const o = this.s.outcome;
    this.status.setText(`${o === 'victory' ? '勝利' : o === 'defeat' ? '落敗' : '時間到'}\n伺服器判定中…`).setFontSize(44).setColor(o === 'victory' ? '#ffd27a' : '#ffffff');
    if (o === 'victory') SFX.roundWin();
    void pvpOps.finish(this.open!.matchId, this.inputs).then((r) => this.scene.isActive() && this.showResult(r));
  }

  private showResult(r: PvpResult | null): void {
    this.phase = 'result';
    this.last = r;
    if (!r) {
      this.status.setText('伺服器沒有接受這場的結果\n（紀錄被拒或伺服器沒有回應）').setFontSize(30).setColor('#ffb0a8');
      this.endButtons();
      return;
    }
    const before = this.open!.rating;
    const title = r.outcome === 'victory' ? '勝利' : r.outcome === 'defeat' ? '落敗' : '平手';
    const up = rankName(r.rating) !== rankName(before) ? `\n段位：${rankName(before)} → ${rankName(r.rating)}` : `\n段位：${rankName(r.rating)}`;
    this.status.setText(`${title}\n段位分 ${r.rating}（${r.delta >= 0 ? '+' : ''}${r.delta}）${up}`).setFontSize(40).setColor(r.outcome === 'victory' ? '#ffd27a' : '#ffffff');
    this.tweens.add({ targets: this.status, scale: { from: 1.25, to: 1 }, duration: 300, ease: 'Back.Out' });
    if (r.outcome === 'victory') this.cameras.main.flash(250, 255, 220, 150);
    this.endButtons();
  }

  private endButtons(list?: [string, () => void][]): void {
    const cx = GAME_WIDTH / 2;
    const y = GAME_HEIGHT - 220;
    const made: Phaser.GameObjects.Container[] = [];
    const mk = (x: number, label: string, fn: () => void, by = y) => {
      const c = this.add.container(x, by).setDepth(90);
      made.push(c);
      const bg = this.add.graphics();
      bg.fillStyle(0x0a0d1a, 0.92).fillRoundedRect(-140, -40, 280, 80, 18);
      bg.lineStyle(2, 0xffd27a, 0.8).strokeRoundedRect(-140, -40, 280, 80, 18);
      c.add([bg, this.add.text(0, 0, label, { fontFamily: UI_FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5)]);
      c.setSize(280, 80).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        SFX.confirm();
        for (const m of made) m.destroy();
        fn();
      });
    };
    if (list) {
      list.forEach(([label, fn], i) => mk(cx + (i ? 150 : -150), label, fn));
      return;
    }
    for (const b of this.buttons) {
      b.label.setVisible(false);
      b.cd.setVisible(false);
    }
    this.buttons = [];
    if (this.last && this.open) mk(cx, '▶ 看重播', () => this.replay(), y - 110);
    mk(cx - 150, '再來一場', () => fadeOutThen(this, 200, () => this.scene.restart()));
    mk(cx + 150, '離開', () => this.leave());
  }

  /** 重播剛才那場（第 146 輪）：同一個種子＋你的指令紀錄＋對手 Bot，跟伺服器重跑的是同一場；兩倍速 */
  private replay(): void {
    const st = startPvp(this.open!.setup);
    this.s = st.s;
    this.foeBot = st.foeBot;
    this.rpIdx = 0;
    this.evIdx = 0;
    this.acc = 0;
    this.prev.clear();
    this.fx = [];
    this.flashUntil.clear();
    this.phase = 'replay';
    this.status.setText(`▶ 重播 ×${REPLAY_SPEED}`).setFontSize(40).setColor('#bfe0ff').setScale(1);
    this.time.delayedCall(700, () => this.phase === 'replay' && this.status.setText(''));
  }

  private replayCommands(): BattleCommand[] {
    const t = this.s.tick + 1;
    while (this.rpIdx < this.inputs.length && this.inputs[this.rpIdx]!.t < t) this.rpIdx++;
    const r = this.inputs[this.rpIdx];
    const mine = r && r.t === t ? r.c : [];
    return [...mine, ...this.foeBot.decide(this.s)];
  }

  private leave(): void {
    fadeOutThen(this, 200, () => this.scene.start('Title'));
  }
}
