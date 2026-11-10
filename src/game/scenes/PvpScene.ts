// 競技場（V5 非同步 PvP 天梯，24 §6.2、第 144 輪）：
// 伺服器 pvp.start 發種子與雙方配裝 → 這裡用同一份引擎在本機打（對手由 PlayerBot 操作，跟伺服器重跑時一模一樣）→
// 記下自己的指令 → pvp.finish 交給伺服器重跑判勝負、改段位分。畫面只送意圖，勝負以伺服器為準（26-security）。
// 跟大地圖的 RtBattleScene 分開：競技場整塊放得進一個畫面（不用鏡頭）、沒有掉落與存檔，畫面全部程式美術。
import Phaser from 'phaser';
import { STAGES, WEAPONS } from '../../core/battle/rt/data';
import { playerDef, playerOf, skillDef, skillShape, step } from '../../core/battle/rt/engine';
import { PVP_MAX_CMDS_PER_TICK, PVP_STAGE, startPvp, type PvpInputs } from '../../core/battle/rt/pvpMatch';
import type { PlayerBot } from '../../core/battle/rt/sim';
import { TICKS_PER_SEC, UNIT, type BattleCommand, type BattleState, type Shape, type SkillMod, type Unit } from '../../core/battle/rt/types';
import { canChallenge, rankAura, rankName } from '../../core/meta/pvpRank';
import { auraCss, drawRankAura } from '../fx/rankAura';
import { ArenaArt } from '../fx/arenaArt';
import { vsIntro } from '../fx/vsIntro';
import { getSettings } from '../settings';
import { SFX } from '../../audio/sfx';
import { setBackHandler } from '../backButton';
import { GAME_HEIGHT, GAME_WIDTH, TALL } from '../config';
import { UI_FONT, bigText, fadeOutThen, floatNumber, hitSparks, shockRing, sparks } from '../fx/feel';
import { FieldFx } from '../fx/fieldFx';
import { RangedFx } from '../fx/rangedFx';
import { hitLook } from '../fx/hitTint';
import { InputSystem } from '../rt/InputSystem';
import { buttonPos, loadControls } from '../rtControls';
import { pvpOps, type PvpOpen, type PvpResult } from '../pvpOps';
import { heroKey, WEAPON_NAME } from '../weapon';
import { agoText, recentLook, seasonLines, streakLine } from '../pvpRecent';
import type { PvpRecentView } from '../../net/views';
import { DiscLayer } from '../rt/uiDisc';

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
  private discs!: DiscLayer;
  private hpBars: [Phaser.GameObjects.Image, Phaser.GameObjects.Image][] = [];
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
  // ---- 技能特效與命中回饋（第 156 輪，D-338）：共用冒險地圖的純畫面工具（FieldFx／RangedFx／hitSparks／floatNumber）；不搬全域頓幀 ----
  private readonly ffx = new FieldFx(this, { k: () => K, sx: (x) => this.sx(x), sy: (y) => this.sy(y) });
  private readonly rfx = new RangedFx(this, {
    k: () => K,
    sx: (x) => this.sx(x),
    sy: (y) => this.sy(y),
    hitStop: () => undefined, // 競技場不頓幀（頓幀會停住模擬的時鐘，兩邊同時在動不適合）
    viewTop: 110,
    slash: (x, y, ang, r, deg, color, width) => this.ffx.slash(x, y, ang, r, deg, color, width),
    starImpact: (vx, vy, r) => this.ffx.starImpact(vx, vy, r),
    fallingStar: (g, vx, vy, f) => this.ffx.fallingStar(g, vx, vy, f),
    spawnFrost: (x, y, r) => this.frost(x, y, r),
  });
  /** 已播過特效的技能段（`單位:施放 tick:段`） */
  private fxDone = new Set<string>();
  /** 受擊後仰（只在畫面上）：往被打的方向退一下再滑回來 */
  private knocks = new Map<number, { dx: number; dy: number; at: number; ms: number }>();
  /** 血條殘影（扣血後白色的那一段慢慢追上） */
  private hpGhost = new Map<number, number>();

  constructor() {
    super('Pvp');
  }

  /** 結果畫面按「⚔ 再挑一次」重開場景時帶進來的對手（第 150 輪） */
  private rematch: { foeId: string; foeName: string } | null = null;
  private arenaArt: ArenaArt | null = null;

  init(data?: { rematch?: { foeId: string; foeName: string } }): void {
    this.rematch = data?.rematch ?? null;
    // Phaser 的 restart() 沒帶資料時會沿用上一次的 → 用完就清掉，「再來一場」才不會又變成指名
    this.sys.settings.data = {};
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
    this.fxDone.clear();
    this.knocks.clear();
    this.hpGhost.clear();
    this.hudText = null;
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
    this.hudGhost = this.add.graphics().setDepth(59.42);
    this.discs = new DiscLayer(this, 59.5); // 按鈕底烤成貼圖（第 154 輪，同冒險地圖）
    this.hpBars = [];
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
    // 測試用（跟冒險地圖的 __rt 一樣）：讀狀態、送指令
    (window as unknown as { __pvp?: unknown }).__pvp = { state: () => this.s, phase: () => this.phase, setup: () => this.open?.setup, send: (c: BattleCommand) => this.inp.push(c) };
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
    let closeButtons = (): void => undefined;
    const start = (foeId?: string, foeName?: string) => {
      if (!box.active) return;
      closeButtons();
      box.destroy();
      this.phase = 'loading';
      this.status.setText(foeName ? `向 ${foeName} 下戰帖…` : '尋找對手…');
      void pvpOps.start(foeId).then((o) => (this.scene.isActive() ? this.begin(o) : undefined));
    };
    closeButtons = this.endButtons([
      ['開始對戰', () => start()],
      ['離開', () => this.leave()],
    ]);
    // 輸了直接再挑同一個對手（第 150 輪）：不等排行，馬上下戰帖（分差規則伺服器會再檢查，不行就回到錯誤畫面）
    if (this.rematch) {
      const r = this.rematch;
      this.rematch = null;
      start(r.foeId, r.foeName);
      return;
    }
    void pvpOps.ladder().then((lad) => {
      if (!this.scene.isActive() || !box.active) return;
      if (!lad) {
        sub.setText('伺服器沒有回應，排行讀不到');
        return;
      }
      sub.setText(`你的段位：${rankName(lad.rating)} ${lad.rating}　第 ${lad.pos} / ${lad.total} 名${lad.streak >= 2 ? `・${lad.streak} 連勝` : ''}`);
      // 最近戰績（第 149 輪）：右上角「近況 勝敗和」（照勝敗上色）；點一下展開最近 5 場，輸掉的可以「⚔ 再挑一次」（第 150 輪，D-323）
      // 賽季（第 153 輪，D-328）：左上角小字，一季＝台北一週，只給稱號
      if (lad.season) box.add(this.add.text(58, top + 14, seasonLines(lad.season, rankName), { fontFamily: UI_FONT, fontSize: '18px', color: '#aab8d4', lineSpacing: 0 }).setOrigin(0, 0));
      if (lad.recent.length) this.recentBadge(box, W - 60, top + 44, lad.recent, top + 120, (id, name) => start(id, name));
      lad.rows.forEach((r, i) => {
        const y = top + 145 + i * 44 + (i >= 10 ? 12 : 0);
        const col = r.me ? '#ffd27a' : '#ffffff';
        if (r.me) {
          const hl = this.add.graphics().fillStyle(0xffd27a, 0.14).fillRoundedRect(56, y - 20, W - 112, 40, 8);
          box.add(hl);
        }
        // 指名挑戰（第 149 輪，D-319）：段位分差 200 內的對手名字前面有 ⚔，點整列就挑他（伺服器會再檢查一次）
        const can = !r.me && !!r.id && canChallenge(lad.rating, r.rating);
        if (can) {
          const hit = this.add.rectangle(W / 2, y, W - 112, 40, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
          hit.on('pointerdown', () => {
            SFX.confirm();
            start(r.id, r.name);
          });
          box.add(hit);
        }
        box.add([
          this.add.text(76, y, `${r.pos}`, { fontFamily: UI_FONT, fontSize: '24px', color: r.pos <= 3 ? '#ffd27a' : '#9aa4b8' }).setOrigin(0, 0.5),
          this.add.text(136, y, r.me ? `${r.name}（你）` : can ? `⚔ ${r.name}` : r.name, { fontFamily: UI_FONT, fontSize: '24px', color: can ? '#ffe7b0' : col }).setOrigin(0, 0.5),
          this.add.text(W - 250, y, WEAPON_NAME[r.weapon], { fontFamily: UI_FONT, fontSize: '22px', color: '#9aa4b8' }).setOrigin(0, 0.5),
          this.add.text(W - 76, y, `${rankName(r.rating)} ${r.rating}`, { fontFamily: UI_FONT, fontSize: '24px', color: r.me ? col : auraCss(r.rating) }).setOrigin(1, 0.5),
        ]);
      });
      box.add(this.add.text(W / 2, this.oy + 16 * UNIT * K + 44, '點 ⚔ 的名字指名挑戰（段位分差 200 內）・電腦操作\n你的等級、裝備、技能點與選的打法都會帶進場\n（HP ×3、傷害減半、裝備等級差距縮小，打得久一點）\n競技場的第 3 招是位移招（衝鋒／後躍射擊／閃現），要自己按', { fontFamily: UI_FONT, fontSize: '20px', color: '#8a92a6', align: 'center', stroke: '#0b0e18', strokeThickness: 6 }).setOrigin(0.5));
    });
  }

  /** 右上角「近況」：一個字一場（勝金、敗紅、和灰），點了展開／收起最近 5 場的清單 */
  private recentBadge(box: Phaser.GameObjects.Container, rx: number, cy: number, recent: PvpRecentView[], listTop: number, challenge: (foeId: string, foeName: string) => void): void {
    const label = this.add.text(rx, cy - 13, '近況 ▾', { fontFamily: UI_FONT, fontSize: '18px', color: '#c8d0e0' }).setOrigin(1, 0.5);
    box.add(label);
    let x = rx;
    for (const r of [...recent].reverse()) {
      const o = recentLook(r.outcome);
      const t = this.add.text(x, cy + 11, o.ch, { fontFamily: UI_FONT, fontSize: '20px', color: o.color }).setOrigin(1, 0.5);
      x -= t.width + 1;
      box.add(t);
    }
    const w = Math.max(label.width, rx - x) + 20;
    const hit = this.add.rectangle(rx - w / 2 + 10, cy, w, 56, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    box.add(hit);
    let panel: Phaser.GameObjects.Container | null = null;
    hit.on('pointerdown', () => {
      SFX.uiTap();
      if (panel) {
        panel.destroy();
        panel = null;
        label.setText('近況 ▾');
        return;
      }
      label.setText('近況 ▴');
      panel = this.recentPanel(recent, listTop, challenge);
      box.add(panel);
    });
  }

  /** 最近 5 場的清單（蓋在排行上面）：結果、對手、分數變化、多久以前；可以復仇的有按鈕 */
  private recentPanel(recent: PvpRecentView[], top: number, challenge: (foeId: string, foeName: string) => void): Phaser.GameObjects.Container {
    const W = GAME_WIDTH;
    const rowH = 70;
    const h = 64 + recent.length * rowH;
    const c = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(0x070912, 0.97).fillRoundedRect(52, top, W - 104, h, 16);
    bg.lineStyle(2, 0xffd27a, 0.5).strokeRoundedRect(52, top, W - 104, h, 16);
    // 吃掉點擊：別讓底下的天梯列被點到
    const block = this.add.rectangle(W / 2, top + h / 2, W - 104, h, 0x000000, 0.001).setInteractive();
    c.add([bg, block, this.add.text(W / 2, top + 32, '最近戰績', { fontFamily: UI_FONT, fontSize: '24px', color: '#ffd27a' }).setOrigin(0.5)]);
    const now = Date.now();
    recent.forEach((r, i) => {
      const y = top + 64 + i * rowH + rowH / 2;
      const o = recentLook(r.outcome);
      const d = r.delta > 0 ? `+${r.delta}` : `${r.delta}`;
      c.add([
        this.add.text(78, y, o.ch, { fontFamily: UI_FONT, fontSize: '30px', color: o.color }).setOrigin(0, 0.5),
        this.add.text(124, y - 12, r.foeName, { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0, 0.5),
        this.add.text(124, y + 16, `${d} 分・${agoText(now - r.at)}`, { fontFamily: UI_FONT, fontSize: '18px', color: r.delta >= 0 ? '#a8d8a0' : '#e8a098' }).setOrigin(0, 0.5),
      ]);
      if (r.revenge && r.foeId) {
        const bx = W - 150;
        const btn = this.add.graphics();
        btn.fillStyle(0x5a1f1f, 1).fillRoundedRect(bx - 78, y - 24, 156, 48, 12);
        btn.lineStyle(2, 0xff9a80, 0.9).strokeRoundedRect(bx - 78, y - 24, 156, 48, 12);
        const bh = this.add.rectangle(bx, y, 156, 48, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
        const foeId = r.foeId;
        bh.on('pointerdown', () => {
          SFX.confirm();
          challenge(foeId, r.foeName);
        });
        c.add([btn, this.add.text(bx, y, '⚔ 再挑一次', { fontFamily: UI_FONT, fontSize: '22px', color: '#ffe0d0' }).setOrigin(0.5), bh]);
      }
    });
    return c;
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
    // 第 153 輪：VS 橫幅演出（以前是置中三行字）
    this.status.setText('');
    vsIntro(this, GAME_WIDTH / 2, this.status.y, { name: '你', sub: `Lv ${o.setup.me.level ?? 1} ${WEAPON_NAME[o.setup.me.weapon]}・${rankName(o.rating)} ${o.rating}`, color: ME }, { name: o.foeName, sub: `Lv ${o.setup.foe.level ?? 1} ${foeW}・${rankName(o.foeRating)} ${o.foeRating}`, color: FOE }, 1450);
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
      const name = id === 'dodge' ? '閃避' : (skillDef(this.s, id, playerOf(this.s))?.name ?? WEAPONS[w].skills[id]?.name ?? id); // 選了哪種打法就顯示那一招的名字
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

  update(t: number, delta: number): void {
    this.arenaArt?.update(t);
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
        this.skillFx();
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
    // 第 153 輪（A7）：場地美術搬到 fx/arenaArt（石板、沙地紋章、看台、火盆）；格子與掩體位置不變
    this.arenaArt = new ArenaArt(this, { ox: this.ox, oy: this.oy, cell: UNIT * K, cols: 14, rows: 16, solid: STAGES[PVP_STAGE]?.arena.solid?.rows ?? [], me: ME, foe: FOE, lowFx: getSettings().lowFx });
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
    if (a) drawRankAura(g, a, x, y, r, now);
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
      const kn = this.knocks.get(u.id);
      let kx = 0;
      let ky = 0;
      let lean = 0;
      if (kn) {
        const kt = (now - kn.at) / kn.ms;
        if (kt >= 1) this.knocks.delete(u.id);
        else {
          const e = (1 - kt) * (1 - kt);
          kx = kn.dx * e;
          ky = kn.dy * e;
          lean = (kn.dx > 0 ? 1 : -1) * 9 * e;
        }
      }
      sp.setPosition(px + kx, py + r * 0.15 - bob + ky).setScale(base).setAngle(lean).setDepth(30 + pos.y / 100);
      if (u.facingX !== 0) sp.setFlipX(u.facingX < 0);
      sp.setAlpha(u.invulnUntil >= s.tick ? 0.5 : 1);
      if ((this.flashUntil.get(u.id) ?? 0) > now) sp.setTintFill(0xffffff);
      else if (u.pid) sp.setTint(0xffa8a0);
      else sp.clearTint();
      const top = sp.y - sp.displayHeight * 0.95;
      // 頭上血條
      const bw = 70;
      g.fillStyle(0x000000, 0.7).fillRect(px - bw / 2 - 2, top - 10, bw + 4, 10);
      g.fillStyle(0xffffff, 0.9).fillRect(px - bw / 2, top - 8, bw * this.ghostHp(u.id, Math.max(0, u.hp) / u.maxHp), 6);
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
    // 血條（第 154 輪）：底和滿格烤成貼圖，每幀只裁切滿格的寬度（以前每幀 4 個圓角矩形＝16 段弧、每段 100 個點）
    const bar = (i: number, x: number, y: number, w: number, pct: number, col: number, right: boolean) => {
      const [back, fill] = (this.hpBars[i] ??= hpBarImages(this, x, y, w, col));
      back.setVisible(true);
      const fw = Math.max(1, w * Math.max(0, Math.min(1, pct)));
      fill.setVisible(true).setCrop(right ? w - fw : 0, 0, fw, 20);
    };
    // 扣血殘影（畫在滿格貼圖底下、黑底上面）
    const gm = this.hpGhost.get(me.id) ?? 0;
    const gf = this.hpGhost.get(foe.id) ?? 0;
    this.hudGhost.clear();
    if (gm > me.hp / me.maxHp) this.hudGhost.fillStyle(0xffffff, 0.85).fillRect(24, 40, 250 * gm, 20);
    if (gf > foe.hp / foe.maxHp) this.hudGhost.fillStyle(0xffffff, 0.85).fillRect(W - 24 - 250 * gf, 40, 250 * gf, 20);
    bar(0, 24, 40, 250, me.hp / me.maxHp, ME, false);
    bar(1, W - 274, 40, 250, foe.hp / foe.maxHp, FOE, true);
    h.fillStyle(0x9ac0ff, 0.9).fillRect(24, 70, (250 * me.mp) / Math.max(1, playerDef(s, me).mp), 6);
    const left = Math.max(0, Math.ceil((s.timeLimitTicks - s.tick) / TICKS_PER_SEC));
    this.timer.setText(this.phase === 'replay' ? `▶×${REPLAY_SPEED}  ${left}` : `${left}`);
    if (!this.names.length) return;
    if (!this.hudText) {
      // 第 156 輪：兩邊實際生效的等級與數值寫出來（數字直接讀場上的單位，不是另外算的）
      const o = this.open!.setup;
      const line = (u: Unit, side: typeof o.me): string => `攻 ${u.atk}・防 ${u.def}・HP ${u.maxHp}${buildNote(side)}`;
      this.hudText = [
        this.add.text(24, 14, `你 · Lv ${o.me.level ?? 1} ${WEAPON_NAME[o.me.weapon]}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#bfe0ff' }).setDepth(61),
        this.add.text(W - 24, 14, `${this.open!.foeName} · Lv ${o.foe.level ?? 1} ${WEAPON_NAME[o.foe.weapon]}`, { fontFamily: UI_FONT, fontSize: '22px', color: '#ffb0a8' }).setOrigin(1, 0).setDepth(61),
        this.add.text(24, 82, line(me, o.me), { fontFamily: UI_FONT, fontSize: '17px', color: '#9fb8d8' }).setDepth(61),
        this.add.text(W - 24, 82, line(foe, o.foe), { fontFamily: UI_FONT, fontSize: '17px', color: '#d8a8a0' }).setOrigin(1, 0).setDepth(61),
      ];
    }
    // 按鈕：冷卻中變暗＋剩幾秒
    const fight = this.phase === 'fight';
    this.buttons.forEach((b, bi) => {
      const id = b.id === 'dodge' ? 'dodge' : b.id;
      const left = Math.max(0, (me.ready[id] ?? 0) - s.tick);
      const ult = b.id === 'blade_storm';
      const noMp = ult && me.mp < (skillDef(s, 'blade_storm', me)?.mp ?? 0);
      const dim = left > 0 || noMp || !fight;
      this.discs.show(bi, b.x, b.y, { r: b.r, fill: ult ? 0x3a1430 : b.id === 'dodge' ? 0x10283a : 0x1a1d2a, fillA: dim ? 0.55 : 0.9, lw: 3, stroke: ult ? 0xff9ae0 : b.id === 'dodge' ? 0x7ad8ff : 0xffd27a, strokeA: dim ? 0.35 : 0.9 });
      b.label.setAlpha(dim ? 0.5 : 1);
      b.cd.setText(left > 0 ? `${Math.ceil(left / TICKS_PER_SEC)}` : '');
    });
    this.discs.hideFrom(this.buttons.length);
    const st = this.inp.stick;
    if (st && fight) {
      h.lineStyle(3, 0xffffff, 0.35).strokeCircle(st.bx, st.by, 80);
      h.fillStyle(0xffffff, 0.35).fillCircle(st.bx + (st.dx / DIR) * 60, st.by + (st.dy / DIR) * 60, 34);
    }
  }
  private hudText: Phaser.GameObjects.Text[] | null = null;
  private hudGhost!: Phaser.GameObjects.Graphics;

  /** 血條殘影：回傳白色殘影畫到哪（≥ cur）；扣血後慢慢追上，補血直接跟上 */
  private ghostHp(id: number, cur: number): number {
    const g0 = this.hpGhost.get(id);
    if (g0 === undefined || g0 <= cur) {
      this.hpGhost.set(id, cur);
      return cur;
    }
    const dt = Math.min(50, this.game.loop.delta);
    const g1 = Math.max(cur, g0 - Math.max(0.0006 * dt, (g0 - cur) * dt * 0.006));
    this.hpGhost.set(id, g1);
    return g1;
  }

  /** 冰系招式的寒氣（冒險地圖是地上的冰晶層；競技場用一圈往外擴的冰霧代替） */
  private frost(x: number, y: number, r: number): void {
    const c = this.add.circle(this.sx(x), this.sy(y), r * K, 0xbff4ff, 0.3).setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: c, alpha: 0, scale: 1.15, duration: 700, ease: 'Cubic.Out', onComplete: () => c.destroy() });
  }

  /**
   * 技能特效（第 156 輪，D-338）：照冒險地圖 RtBattleScene.skillFx 的規則，雙方都播——每一段命中（atTick）到了才出特效，接觸時機是核心的 tick。
   * 以前競技場放招只有腳下一塊淡淡的隊伍色範圍（Jacky 11/10：「放技能也沒有出現」）。純畫面，不影響戰鬥。
   */
  private skillFx(): void {
    for (const u of this.units()) {
      const a = u.action;
      if (!a || a.kind !== 'skill' || u.dead) continue;
      const sk = skillDef(this.s, a.id, u);
      if (!sk) continue;
      const k = this.s.tick - a.start;
      const w = this.weaponOf(u);
      const foe = !!u.pid;
      sk.hits.forEach((h, i) => {
        const key = `${u.id}:${a.start}:${i}`;
        if (k < h.atTick || this.fxDone.has(key)) return;
        this.fxDone.add(key);
        const ang = Math.atan2(a.dirY, a.dirX);
        const big = h.mult >= 150;
        const ult = sk.role === 'ult';
        const hs = skillShape(this.s, a.id, h.shape, u);
        const st = h.status?.id;
        if (w === 'bow') {
          this.rfx.bowFx(u.x, u.y, ang, hs, ult, !!sk.dash, st === 'break', st === 'freeze', st);
          return;
        }
        if (w === 'staff') {
          this.rfx.staffFx(u.x + ((h.ahead ?? 0) * a.dirX) / 1000, u.y + ((h.ahead ?? 0) * a.dirY) / 1000, ang, hs, ult, sk.hits.length === 1, sk.dash ? Math.sign(sk.dash.distance) * (k >= sk.dash.fromTick + sk.dash.ticks ? 1 : 0) : 0, st);
          return;
        }
        // 長劍：對手的刀光偏暖色（看得出是誰的招）；大招與重擊金色、帶狀態的照元素色
        const base = foe ? 0xffa07a : 0x9fd8ff;
        const px = this.sx(u.x);
        const py = this.sy(u.y);
        if (sk.dash) {
          const g = this.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
          const dc = st === 'weak' ? 0xc0a0ff : base;
          const L = UNIT * 2.6 * K;
          g.fillStyle(dc, 0.25).fillTriangle(px - Math.sin(ang) * 18, py + Math.cos(ang) * 18, px + Math.sin(ang) * 18, py - Math.cos(ang) * 18, px - Math.cos(ang) * L, py - Math.sin(ang) * L);
          g.fillStyle(0xffffff, 0.4).fillTriangle(px - Math.sin(ang) * 6, py + Math.cos(ang) * 6, px + Math.sin(ang) * 6, py - Math.cos(ang) * 6, px - Math.cos(ang) * L * 0.7, py - Math.sin(ang) * L * 0.7);
          this.tweens.add({ targets: g, alpha: 0, duration: 320, onComplete: () => g.destroy() });
          if (i === 0) {
            sparks(this, px, py, 8, 'spark', 0xd8f0ff, 260);
            shockRing(this, px, py, dc, 46, 220, 5);
          }
          if (hs.type === 'circle' && !h.oncePerTarget) {
            shockRing(this, px, py, dc, hs.r * K * 1.2, 380, 9);
            sparks(this, px, py, 16, 'spark', 0xd8f0ff, 420);
            this.cameras.main.shake(120, 0.005);
          }
        } else if (hs.type === 'circle') {
          const col = big ? 0xffd05a : ult ? 0xff7ad0 : base;
          const start = (this.time.now / 90) % (Math.PI * 2);
          for (let j = 0; j < 2; j++) this.ffx.slash(u.x, u.y, start + j * Math.PI, hs.r, 160, col, 7);
          shockRing(this, px, py, col, hs.r * K, 240, 5);
          if (ult) this.ffx.slash(u.x, u.y, start + Math.PI / 2, hs.r * 0.6, 160, 0xffd0f0, 6);
          if (ult && big) {
            this.cameras.main.shake(180, 0.007);
            shockRing(this, px, py, 0xffd05a, hs.r * K * 1.15, 420, 10);
          }
        } else if (hs.type === 'sector') {
          this.ffx.slash(u.x, u.y, ang, hs.r, hs.deg + 30, big ? 0xffd05a : base, big ? 10 : 7);
          if (big) sparks(this, px + Math.cos(ang) * hs.r * K * 0.7, py + Math.sin(ang) * hs.r * K * 0.7, 8, 'spark', 0xffe8b0, 260);
        } else if (hs.type === 'line') {
          this.ffx.groundSplit(u.x, u.y, ang, hs.len, hs.width);
        }
        if (ult && sk.hits.length === 1 && hs.type !== 'line') this.rfx.starfall(u.x, u.y, hs.type === 'circle' ? hs.r : UNIT * 3);
        if (st === 'freeze') {
          const fr = hs.type === 'circle' ? hs.r : UNIT * 2;
          this.frost(u.x, u.y, fr);
          shockRing(this, px, py, 0xbff4ff, fr * K * 1.15, 520, 8);
          sparks(this, px, py, 20, 'spark', 0xd8fbff, 420);
        } else if (st === 'break' && big) {
          const fx = px + Math.cos(ang) * UNIT * 1.4 * K;
          const fy = py + Math.sin(ang) * UNIT * 1.4 * K;
          sparks(this, fx, fy, ult ? 24 : 14, 'ember', 0xff6a4a, 380);
          if (hs.type === 'sector' && !ult) {
            this.ffx.slash(u.x, u.y, ang, hs.r * 1.12, hs.deg + 44, 0xff5a3a, 14);
            shockRing(this, fx, fy, 0xff8a5a, UNIT * 1.6 * K, 300, 6);
          }
          if (ult && hs.type === 'line') this.ffx.moonArc(u.x, u.y, ang, hs.len, hs.width);
        } else if (st === 'weak') sparks(this, px, py, 8, 'ember', 0xb08aff, 300);
      });
    }
  }

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
        const sw = src ? this.weaponOf(src) : 'sword';
        if (src && e.origin === 'normal') {
          // 普攻：弓＝飛箭、杖＝魔彈（冒險地圖同一套）、劍＝一道小刀光
          if (sw === 'bow') this.rfx.arrowShot(src.x, src.y, dst.x, dst.y, src.pid ? 0xffd8b0 : 0xf4f0d0);
          else if (sw === 'staff') this.rfx.magicBolt(src.x, src.y, dst.x, dst.y, src.pid ? 0xff9ac8 : 0xc89aff);
          else this.ffx.slash(src.x, src.y, Math.atan2(dst.y - src.y, dst.x - src.x), UNIT * 1.5, 90, src.pid ? 0xffb89a : 0xcfeaff, 5);
        }
        if (dst.id === me.id) {
          this.cameras.main.shake(e.crit ? 160 : 90, e.crit ? 0.01 : 0.004);
          SFX.hit();
        } else (e.crit ? SFX.hitHeavy : SFX.hitLight)();
        // 命中回饋：火花朝被打飛的方向噴（顏色看元素／武器）、後仰、分級的傷害數字；持續傷害（中毒、灼燒）只跳小數字
        const dx = src ? dst.x - src.x : 0;
        const dy = src ? dst.y - src.y : -1;
        const d = Math.hypot(dx, dy) || 1;
        const sk = src && e.origin !== 'normal' ? skillDef(this.s, e.skill, src) : undefined;
        const ult = sk?.role === 'ult';
        if (e.origin !== 'dot') {
          const look = hitLook(sw, sk, e.crit);
          hitSparks(this, this.sx(dst.x), this.sy(dst.y) - 26, Math.atan2(dy, dx), e.crit || ult ? 12 : 7, look.tex, look.color, e.crit ? 300 : 220);
          const m = e.crit || e.origin === 'counter' ? 15 : 9;
          this.knocks.set(dst.id, { dx: (dx / d) * m, dy: (dy / d) * m * 0.6, at: now, ms: e.crit ? 170 : 120 });
        }
        const mine = dst.id === me.id;
        const tier = e.origin === 'dot' ? undefined : ult ? 'ult' : e.crit ? 'crit' : undefined;
        floatNumber(this, this.sx(dst.x), this.sy(dst.y) - 74, `${e.amount}`, { size: e.origin === 'dot' ? 20 : tier ? 38 : 28, color: mine ? '#ff8a7a' : e.origin === 'dot' ? '#d8b0ff' : '#ffffff', ...(tier && !mine ? { tier } : {}), ...(e.crit && e.origin !== 'dot' ? { label: '暴擊' } : e.origin === 'counter' ? { label: '反擊' } : {}) });
      } else if (e.type === 'cast') {
        const u = this.s.units.find((x) => x.id === e.id);
        const sk = u && skillDef(this.s, e.skill, u);
        const h = sk?.hits[0];
        // 出招預告：這一招會打到哪（隊伍色，施放瞬間閃一下）；真正的特效在每段命中的 tick（skillFx）
        if (u && h) this.fx.push({ kind: 'shape', until: now + 260, dur: 260, col: u.pid ? FOE : ME, x0: u.x, y0: u.y, x1: 0, y1: 0, shape: skillShape(this.s, e.skill, h.shape, u), dx: u.facingX, dy: u.facingY });
        // 招式名從頭上跳出來（選了哪種打法就是那個名字）
        if (u && sk) {
          const sp = this.sprites.get(u.id);
          const ult = sk.role === 'ult';
          const t = this.add.text(this.sx(u.x), (sp ? sp.y - sp.displayHeight : this.sy(u.y) - 80) - 44, sk.name, { fontFamily: UI_FONT, fontSize: ult ? '30px' : '22px', fontStyle: '900', color: ult ? '#ffd0f0' : u.pid ? '#ffc8b8' : '#cfeaff', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5).setDepth(72).setScale(0.6);
          this.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.Out' });
          this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, delay: 420, duration: 380, onComplete: () => t.destroy() });
          if (!u.pid) (ult ? SFX.hitHeavy : SFX.uiTap)();
        }
        if (sk?.role === 'ult') {
          this.cameras.main.flash(150, 255, 200, 240);
          this.arenaArt?.roar(getSettings().lowFx, now); // 看台小歡呼（第 154 輪）
        }
      } else if (e.type === 'dodge') SFX.dodge();
      else if (e.type === 'block') SFX.parry();
      else if (e.type === 'guard') {
        // 攻守一體（D-345）：護盾架起來——一圈光環＋「護盾 +N」
        const gu = this.s.units.find((q) => q.id === e.id);
        if (gu) {
          if (!gu.pid) SFX.parry();
          shockRing(this, this.sx(gu.x), this.sy(gu.y) - 20, 0xffe08a, 52, 300, 5);
          floatNumber(this, this.sx(gu.x), this.sy(gu.y) - 70, `護盾 +${e.amount}`, { color: '#ffe08a', size: 18 });
        }
      }
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
    const up = rankName(r.rating) !== rankName(before) ? `\n段位：${rankName(before)} → ${rankName(r.rating)}${r.seasonTier ? `\n★ 本季首次到達${rankName(r.rating)}` : ''}` : `\n段位：${rankName(r.rating)}`;
    this.status.setText(`${title}\n段位分 ${r.rating}（${r.delta >= 0 ? '+' : ''}${r.delta}）${up}`).setFontSize(40).setColor(r.outcome === 'victory' ? '#ffd27a' : '#ffffff');
    this.tweens.add({ targets: this.status, scale: { from: 1.25, to: 1 }, duration: 300, ease: 'Back.Out' });
    if (r.outcome === 'victory') {
      this.cameras.main.flash(250, 255, 220, 150);
      this.arenaArt?.cheer(getSettings().lowFx); // 觀眾灑彩紙（第 153 輪）
    }
    // 本季第一次到達這個段位（D-328）：段位色的光圈從結果字往外擴
    if (r.seasonTier) {
      const col = rankAura(r.rating)?.color ?? 0xffd27a;
      this.time.delayedCall(260, () => {
        if (!this.scene.isActive() || this.phase !== 'result') return;
        shockRing(this, this.status.x, this.status.y + 60, col, 320, 760, 10);
        sparks(this, this.status.x, this.status.y + 60, 26, 'spark', col, 600);
      });
    }
    // 連勝／今日首勝（D-324）：伺服器說的，只有字和光
    const sl = streakLine(r);
    if (sl) {
      const cx = GAME_WIDTH / 2;
      const y = this.status.y - 190;
      this.time.delayedCall(420, () => {
        if (!this.scene.isActive() || this.phase !== 'result') return;
        bigText(this, cx, y, sl, r.firstWin ? '#fff2a8' : '#ffb36a', r.firstWin ? 50 : 44, 1600);
        shockRing(this, cx, y, r.firstWin ? 0xffe08a : 0xff9a4a, 260, 620, 8);
        sparks(this, cx, y, r.firstWin ? 34 : 20, 'spark', r.firstWin ? 0xffe08a : 0xffa060, 520);
        if (r.firstWin) SFX.perfect();
        else SFX.itemGet();
      });
    }
    this.endButtons();
  }

  /** @returns 把這組按鈕收掉（大廳點天梯列指名挑戰時用） */
  private endButtons(list?: [string, () => void][]): () => void {
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
    const close = () => {
      for (const m of made) m.destroy();
    };
    if (list) {
      list.forEach(([label, fn], i) => mk(cx + (i ? 150 : -150), label, fn));
      return close;
    }
    for (const b of this.buttons) {
      b.label.setVisible(false);
      b.cd.setVisible(false);
    }
    this.buttons = [];
    // 輸了、對手還在指名範圍內（第 150 輪）：重播旁邊多一顆「⚔ 再挑一次」
    const o = this.open;
    const rematch = !!o && this.last?.outcome === 'defeat' && canChallenge(this.last.rating, o.foeRating);
    if (this.last && o) mk(rematch ? cx - 150 : cx, '▶ 看重播', () => this.replay(), y - 110);
    if (rematch && o) mk(cx + 150, '⚔ 再挑一次', () => fadeOutThen(this, 200, () => this.scene.restart({ rematch: { foeId: o.foeId, foeName: o.foeName } })), y - 110);
    mk(cx - 150, '再來一場', () => fadeOutThen(this, 200, () => this.scene.restart()));
    mk(cx + 150, '離開', () => this.leave());
    return close;
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
    this.fxDone.clear();
    this.knocks.clear();
    this.hpGhost.clear();
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

/** 頂端血條的底（黑、圓角）與滿格（隊伍色、圓角）兩張圖片，深度跟 hud 畫筆一樣（第 154 輪） */
function hpBarImages(scene: Phaser.Scene, x: number, y: number, w: number, col: number): [Phaser.GameObjects.Image, Phaser.GameObjects.Image] {
  const kb = `pvp_hpbar_bg_${w}`;
  const kf = `pvp_hpbar_${w}_${col}`;
  if (!scene.textures.exists(kb)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x000000, 0.7).fillRoundedRect(0, 0, w + 6, 26, 6);
    g.generateTexture(kb, w + 6, 26);
    g.destroy();
  }
  if (!scene.textures.exists(kf)) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(col, 1).fillRoundedRect(0, 0, w, 20, 5);
    g.generateTexture(kf, w, 20);
    g.destroy();
  }
  return [scene.add.image(x - 3, y - 3, kb).setOrigin(0).setDepth(59.4), scene.add.image(x, y, kf).setOrigin(0).setDepth(59.45)];
}

/** 配裝摘要的尾巴：技能點強化了幾招、選了幾種打法（有才寫） */
function buildNote(side: { skillMods?: Record<string, SkillMod>; skillVariants?: string[] }): string {
  const n = Object.keys(side.skillMods ?? {}).length;
  const v = side.skillVariants?.length ?? 0;
  return `${n ? `・強化 ${n} 招` : ''}${v ? `・打法 ${v}` : ''}`;
}
