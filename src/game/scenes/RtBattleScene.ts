// 即時戰鬥試玩場景（除錯入口：?debug&scene=RtBattle&stage=forest_entry；D-063／D-065，design/20 §B8 P1）。
// Phaser 只負責畫 BattleState 與收輸入 → BattleCommand；戰鬥結果全部由 src/core/battle/rt 決定（D-062）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { SKILLS, STAGES } from '../../core/battle/rt/data';
import { createBattle, enemiesOf, isSolidAt, playerOf, setBossFury, setGearBonus, setSkillMods, skillShape, step, xpToNext } from '../../core/battle/rt/engine';
import { RARITY_COLOR, genGear } from '../../core/battle/rt/gear';
import { bonusOf, isUpgrade, openRtBagPanel, type BagState } from '../ui/rtBagPanel';
import { addWithAutoSalvage } from '../rtBag';
import { gearIcon } from '../fx/gearIcons';
import { skillModsOf } from '../rtBag';
import { BOT_PROFILES, PlayerBot, summarize } from '../../core/battle/rt/sim';
import type { BattleCommand, BattleState, Shape, Unit } from '../../core/battle/rt/types';
import { CAMPFIRE_RULES, CHEST_RULES, TICKS_PER_SEC, UNIT } from '../../core/battle/rt/types';
import { cellIndex, findPath, gridOf } from '../../core/battle/rt/path';
import { ENEMIES, SWORDSMAN } from '../../core/battle/rt/data';
import { makeTestWorldStage } from '../../core/battle/rt/maps/testWorld';
import { makeMistwoodStage, MISTWOOD_KING } from '../../core/battle/rt/maps/mistwood';
import { GAME_WIDTH } from '../config';
import { ACTIONS, BTN_COUNT, JOY_INDEX, buttonPos, buttonR, clampPos, inStickZone, loadControls, saveControls, swapSlots, type RtAction, type RtControls } from '../rtControls';
import { openRtControlsPanel } from '../ui/rtControlsPanel';
import { EMPTY_SNAP, FURY_UNLOCK, cleanBag, fmtSec, furyUnlocked, loadRecord, mergeRun, recordBoss, saveRecord, spend, walletOf, type RunSnap } from '../rtRecord';
import { TITLE_FONT, UI_FONT, bigText, floatNumber, shockRing, sparks } from '../fx/feel';

const STEP_MS = 1000 / TICKS_PER_SEC;
const STAGE_IDS = Object.keys(STAGES);
/** 畫面橫向可見的世界格數 */
const VIEW_UNITS_W = 1050;
/** 世界可視區：標題列下方到畫面底（操作鍵疊在上面） */
const VIEW_TOP = 110;
const VIEW_BOTTOM = 1280;
/** 地面材質分塊大小（px） */
const GROUND_CHUNK = 1024;
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

/** 掉落物名稱（寶箱內容顯示用） */
const LOOT_NAMES: Record<string, string> = Object.fromEntries([['gold', '金幣'], ['dust', '粉塵'], ['crystal', '結晶'], ['potion', '藥水']]);

/** HUD 時間：一分鐘內顯示「12.3 秒」，之後「3:05」 */
function clock(tick: number): string {
  const sec = tick / TICKS_PER_SEC;
  if (sec < 60) return `${sec.toFixed(1)} 秒`;
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

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
  private keys?: Partial<Record<RtAction, Phaser.Input.Keyboard.Key>>;
  /** 操作設定（D-088） */
  private ctl: RtControls = loadControls();
  /** 調整按鈕位置模式：拖曳＝移動、點兩個技能鍵＝交換 */
  private editing: { drag: number | null; sx: number; sy: number; moved: boolean; pick: number | null; ui: Phaser.GameObjects.Container } | null = null;
  /** 大地圖的獨立紀錄：上次寫進 localStorage 時的快照（D-087） */
  private saved: RunSnap = EMPTY_SNAP;
  private bossTimed = false;
  /** 行囊與身上裝備（D-091；只有正式大地圖） */
  private bagSt: BagState = { bag: [], equip: {} };
  /** 這場產生裝備用的種子鹽 */
  private runSalt = 1;
  private ended = false;
  private hud!: Phaser.GameObjects.Text;
  /** 單位圖層（HP 條等疊在 sprite 上方） */
  private top!: Phaser.GameObjects.Graphics;
  /** 靜態地面（只畫一次，每幀只移動位置）；大地圖切成多塊材質（手機 GPU 單張上限常是 4096px） */
  private ground!: Phaser.GameObjects.Container;
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
  /** 玩家有沒有主動點過怪／按過技能（刷怪關 30 秒沒動作就提示） */
  private engaged = false;
  /** 精英／Boss 邊緣箭頭的距離字（物件池） */
  private arrowLabels: Phaser.GameObjects.Text[] = [];
  /** 營火光暈（預先烘好的放射漸層，ADD 混色；每幀只改位置與縮放） */
  private glows: Phaser.GameObjects.Image[] = [];
  /** 大地圖目標列（沒有就 null） */
  private goal: Phaser.GameObjects.Text | null = null;
  /** 目前所在地區（StageDefinition.zones）；換區時顯示名稱 */
  private zoneName: string | null = null;
  /** 這場已經提示過隱藏精英 */
  private streakHinted = false;
  /** 這場已經提示過 Boss 弱點 */
  private bossMemo = false;
  /** 已經提示過「有點熟悉」的寶箱 */
  private chestHinted = new Set<string>();
  /** 小地圖（場地比畫面大很多時才有）：畫面座標與每世界單位的像素 */
  private mini: { x: number; y: number; w: number; h: number; s: number } | null = null;
  private idleHinted = false;

  constructor() {
    super('RtBattle');
  }

  init(data: { stage?: string; seed?: number; bot?: string }): void {
    const q = new URLSearchParams(window.location.search);
    this.stageId = data.stage ?? q.get('stage') ?? 'forest_entry';
    // 除錯：48×96 測試大地圖（分塊地面／大地圖效能檢查用，不進選單）
    if (this.stageId === 'test_world' && q.has('debug') && !STAGES.test_world) STAGES.test_world = makeTestWorldStage();
    // 霧語森林（D-085）：目前只有除錯入口；標題入口等 D-083
    if (this.stageId === 'mistwood' && !STAGES.mistwood) STAGES.mistwood = makeMistwoodStage();
    if (!STAGES[this.stageId]) this.stageId = 'forest_entry';
    this.seed = data.seed ?? Number(q.get('seed') ?? 1);
    const b = (data.bot !== undefined ? data.bot : q.get('bot')) as keyof typeof BOT_PROFILES | null;
    this.bot = b && BOT_PROFILES[b] ? new PlayerBot({ ...BOT_PROFILES[b], ult: true, potionAtPct: b === 'auto' ? undefined : 35, ...(this.stageId === 'mistwood' ? { campfireBelowPotions: 8, advanceTo: MISTWOOD_KING } : {}) }, b) : null;
    this.botName = this.bot ? b : null;
  }

  create(): void {
    // Bot 示範也帶著玩家的等級與裝備（只讀、不存）
    const big = !!STAGES[this.stageId]?.bossZone && !!STAGES[this.stageId]?.spawnGroups?.length && this.stageId === 'mistwood';
    const rec0 = this.tracked || big ? loadRecord(this.stageId) : {};
    this.bagSt = this.tracked || big ? cleanBag(rec0) : { bag: [], equip: {} };
    this.runSalt = (((rec0.runs ?? 0) + 1) * 2654435761 + this.seed * 40503) >>> 0;
    this.s = createBattle({ stageId: this.stageId, seed: this.seed, level: rec0.level, xp: rec0.xp, bonus: this.tracked || big ? bonusOf(this.bagSt) : undefined, skillMods: this.tracked || big ? skillModsOf(this.bagSt) : undefined });
    this.ctl = loadControls();
    this.saved = EMPTY_SNAP;
    this.bossTimed = false;
    this.editing = null;
    if (this.tracked) {
      // 正式大地圖（D-087）：沒有時間限制（核心的 timeLimitTicks 只給模擬器用）；開過的寶箱下次是空箱
      this.s.timeLimitTicks = 24 * 3600 * TICKS_PER_SEC;
      const rec = loadRecord(this.stageId);
      const valid = new Set((STAGES[this.stageId]?.chests ?? []).map((c) => c.id));
      const opened = (rec.chests ?? []).filter((id) => valid.has(id));
      if (opened.length) this.s.chestsOpened = [...opened];
      // 暴怒狼王（D-099）：上次選了而且已解鎖 → 這次進森林的狼王就是暴怒版
      if (rec.fury && furyUnlocked(rec, this.s.prog?.level ?? 1)) setBossFury(this.s, true);
      this.saved = { ...EMPTY_SNAP, chests: [...opened] };
      saveRecord(this.stageId, { ...rec, runs: (rec.runs ?? 0) + 1 });
      const onHide = (): void => {
        if (document.visibilityState === 'hidden') this.persist();
      };
      document.addEventListener('visibilitychange', onHide);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.persist();
        document.removeEventListener('visibilitychange', onHide);
      });
    }
    this.acc = 0;
    this.evIdx = 0;
    this.ended = false;
    this.pending = [];
    this.stick = null;
    // 鏡頭：畫面寬約 10.5 格（角色夠大、手機看得清楚），跟隨主角（D-067）
    this.k = GAME_WIDTH / (STAGES[this.stageId]?.viewUnits ?? VIEW_UNITS_W);
    this.prev.clear();
    this.sprites.clear();
    this.flashUntil.clear();
    this.fxDone.clear();
    this.hitStop = 0;
    this.engaged = false;
    this.idleHinted = false;
    this.zoneName = null;
    this.chestHinted = new Set();
    this.bossMemo = false;
    this.streakHinted = false;
    this.arrowLabels = [];
    const p0 = playerOf(this.s);
    this.camX = p0.x;
    this.camY = p0.y;
    this.updateCamera(1);
    this.cameras.main.setBackgroundColor('#0b1410');
    this.ground = this.makeGround();
    this.glows = (STAGES[this.stageId]?.campfires ?? []).map(() => this.add.image(0, 0, this.glowTexture()).setBlendMode(Phaser.BlendModes.ADD));
    this.g = this.add.graphics();
    this.top = this.add.graphics().setDepth(45);
    this.ui = this.add.graphics().setDepth(50);
    // 頂部標題列（蓋在世界之上；底部漸層避免硬切）
    const hdr = this.add.graphics().setDepth(48);
    hdr.fillStyle(0x0b1410, 0.94).fillRect(0, 0, GAME_WIDTH, VIEW_TOP);
    for (let i = 0; i < 12; i++) hdr.fillStyle(0x0b1410, 0.6 * (1 - i / 12)).fillRect(0, VIEW_TOP + i * 2, GAME_WIDTH, 2);
    this.add.text(GAME_WIDTH / 2, 40, this.tracked || this.stageId === 'mistwood' ? STAGES[this.stageId]!.name : `即時戰鬥試玩・${STAGES[this.stageId]!.name}`, { fontFamily: TITLE_FONT, fontSize: '30px', color: '#ffd27a' }).setOrigin(0.5).setDepth(49);
    this.calmText = this.add.text(GAME_WIDTH / 2 - 50, 850, '', { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#ffd27a', stroke: '#000', strokeThickness: 4, backgroundColor: '#00000088' }).setPadding(14, 6, 14, 6).setOrigin(0.5).setDepth(65);
    this.hud = this.add.text(GAME_WIDTH / 2, 82, '', { fontFamily: UI_FONT, fontSize: '18px', color: '#c8d0f0' }).setOrigin(0.5).setDepth(49);
    // 大地圖（有 Boss 又有重生點）：HUD 下方的目標列
    const stG = STAGES[this.stageId];
    this.goal = stG?.bossZone && stG.spawnGroups?.length ? this.add.text(GAME_WIDTH / 2, 110, '', { fontFamily: UI_FONT, fontSize: '20px', fontStyle: '700', color: '#ffd27a', backgroundColor: 'rgba(0,0,0,0.55)' }).setPadding(12, 3, 12, 3).setOrigin(0.5).setDepth(49) : null;
    this.makeButtons();
    this.makeMinimap();
    this.makeFireBtn();
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
    const st0 = STAGES[this.stageId];
    if (st0?.intro || st0?.spawnGroups?.length) {
      const intro = st0.intro ?? '怪物會重生・5 分鐘能打倒幾隻？\n打不過就退回營火（怪不追進來）';
      this.time.delayedCall(400, () => bigText(this, GAME_WIDTH / 2, 760, intro, '#ffd27a', 30, 2600));
    }
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.bindKeys();
    (window as unknown as { __rt?: unknown }).__rt = { state: () => this.s, result: () => summarize(this.s), send: (c: BattleCommand) => this.pending.push(c) };
  }

  // ---------- 輸入 ----------
  private get JOY(): { x: number; y: number; r: number } {
    return { ...buttonPos(this.ctl, JOY_INDEX), r: Math.round(90 * this.ctl.scale) };
  }
  /** 0–3 技能欄、4 閃避、5 大招（劍刃風暴，MP 40）、6 藥水；位置與大小照操作設定（D-088） */
  private btnPos(i: number): { x: number; y: number } {
    return buttonPos(this.ctl, i);
  }
  private btnR(i: number): number {
    return buttonR(this.ctl, i);
  }
  private slotSkill(i: number): string {
    return this.ctl.order[i]!;
  }

  /** 桌機快捷鍵（照操作設定綁定；改鍵後重綁） */
  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    for (const k of Object.values(this.keys ?? {})) if (k) kb.removeKey(k);
    const keys: Partial<Record<RtAction, Phaser.Input.Keyboard.Key>> = {};
    for (const a of ACTIONS) if (this.ctl.keys[a]) keys[a] = kb.addKey(this.ctl.keys[a]);
    this.keys = keys;
  }

  private makeButtons(): void {
    for (const t of this.btnText) t.destroy();
    const names = [...this.ctl.order.map((id) => SKILLS[id]!.name), '閃避', '大招', '藥水'];
    const sc = this.ctl.scale;
    this.btnText = names.map((n, i) => {
      const { x, y } = this.btnPos(i);
      return this.add.text(x, y, n, { fontFamily: UI_FONT, fontSize: `${Math.round((i === 4 ? 22 : i === 6 ? 17 : 20) * sc)}px`, fontStyle: '700', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(60);
    });
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.editing) return this.editDown(p);
    if (this.ended || this.menu) return;
    if (p.y < VIEW_TOP && p.x > GAME_WIDTH - 100) return; // 選單鍵
    if (this.fireBtn?.visible && this.fireBtn.getBounds().contains(p.x, p.y)) return; // 營火捷徑
    if (this.hint) this.dismissHint();
    for (let i = 0; i < BTN_COUNT; i++) {
      const b = this.btnPos(i);
      if (Math.hypot(p.x - b.x, p.y - b.y) <= this.btnR(i) + 2) {
        if (i < 4 || i === 5) this.engaged = true;
        if (i < 4) this.pending.push({ type: 'skill', id: this.slotSkill(i) });
        else if (i === 4) this.pending.push({ type: 'dodge', dx: this.stick?.dx ?? 0, dy: this.stick?.dy ?? 0 });
        else if (i === 5) this.pending.push({ type: 'skill', id: 'blade_storm' });
        else this.pending.push({ type: 'potion' });
        SFX.uiTap();
        return;
      }
    }
    // 點小地圖＝走到那裡（A* 尋路）
    const m = this.mini;
    if (m && !this.bot && p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h) {
      const goal = this.freeNear(Math.round((p.x - m.x) / m.s), Math.round((p.y - m.y) / m.s));
      if (goal) this.pending.push({ type: 'moveTo', x: goal[0], y: goal[1] });
      this.restOnArrive = false;
      SFX.uiTap();
      return;
    }
    if (m && p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h) return;
    if (inStickZone(this.ctl, p.x, p.y)) {
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
      this.engaged = true;
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
    if (this.editing) return this.editMove(p);
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
    if (this.editing) return this.editUp();
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
      const kx = (K.right?.isDown ? 1 : 0) - (K.left?.isDown ? 1 : 0);
      const ky = (K.down?.isDown ? 1 : 0) - (K.up?.isDown ? 1 : 0);
      if (kx || ky) {
        dx = kx * 1000;
        dy = ky * 1000;
      }
      const one = [K.slot1, K.slot2, K.slot3, K.slot4];
      one.forEach((key, i) => {
        if (key && Phaser.Input.Keyboard.JustDown(key)) out.push({ type: 'skill', id: this.slotSkill(i) });
      });
      if (K.dodge && Phaser.Input.Keyboard.JustDown(K.dodge)) out.push({ type: 'dodge', dx, dy });
      if (K.ult && Phaser.Input.Keyboard.JustDown(K.ult)) out.push({ type: 'skill', id: 'blade_storm' });
      if (K.potion && Phaser.Input.Keyboard.JustDown(K.potion)) out.push({ type: 'potion' });
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
    if (this.editing) {
      this.draw();
      return;
    }
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
    this.idleHint();
    this.zoneBanner();
    this.updateFireBtn();
    this.chestHint();
    this.streakHint();
    if (this.s.tick % (10 * TICKS_PER_SEC) === 0) this.persist();
    if (this.s.outcome !== 'running') this.finish();
  }

  // ---------- 大地圖獨立紀錄（D-087） ----------
  /** 這張地圖有沒有跨場紀錄（有 Boss 巢穴的刷怪大地圖） */
  private get tracked(): boolean {
    const st = STAGES[this.stageId];
    return !!st?.bossZone && !!st.spawnGroups?.length && !this.bot;
  }
  private snap(): RunSnap {
    const s = this.s;
    return { kills: summarize(s).kills, coin: s.loot?.gold ?? 0, dust: s.loot?.dust ?? 0, crystal: s.loot?.crystal ?? 0, chests: [...(s.chestsOpened ?? [])], sec: s.tick / TICKS_PER_SEC };
  }
  /** 把這場新增的擊殺、材料、寶箱、時間寫進紀錄（每 10 秒、離開、結束時） */
  private persist(): void {
    if (!this.tracked || !this.s) return;
    const now = this.snap();
    const rec = mergeRun(loadRecord(this.stageId), this.saved, now);
    if (this.s.prog) {
      rec.level = this.s.prog.level;
      rec.xp = this.s.prog.xp;
    }
    saveRecord(this.stageId, rec);
    this.saved = now;
  }

  // ---------- 裝備（D-091） ----------
  /** 撿到裝備：用種子產生數值、放進行囊、立刻存檔；稀有以上大字 */
  private gotGear(itemId: number, rarity: 1 | 2 | 3, ilvl: number): void {
    if (!this.tracked) return;
    const p = playerOf(this.s);
    const g = genGear((Math.imul(this.runSalt, 31) + itemId * 2246822519) >>> 0, rarity, ilvl);
    // 行囊滿了：自動分解最差的普通裝（D-100）；連普通裝都沒有才提示整理
    const r = addWithAutoSalvage(this.bagSt, g);
    if (!r) {
      floatNumber(this, this.sx(p.x), this.sy(p.y) - 110, '行囊滿了！（☰ → 行囊整理）', { color: '#ff9a8a', size: 24 });
      return;
    }
    this.bagSt = r.st;
    this.saveBag();
    if (r.salvaged) {
      const w = spend(loadRecord(this.stageId), -r.dust, 0);
      if (w) saveRecord(this.stageId, w);
      floatNumber(this, this.sx(p.x), this.sy(p.y) - 150, `行囊滿・自動分解 ${r.salvaged.name} +${r.dust} 粉塵`, { color: '#c8c0a8', size: 20 });
      if (r.salvaged.uid === g.uid) return;
    }
    const col = `#${RARITY_COLOR[rarity].toString(16).padStart(6, '0')}`;
    // 撿到的裝備圖示從主角頭上飄起來（D-101）
    const icon = this.add.container(this.sx(p.x), this.sy(p.y) - 70, gearIcon(this, 0, 0, g.slot, rarity, rarity >= 3 ? 64 : 48)).setDepth(70);
    this.tweens.add({ targets: icon, y: icon.y - 90, duration: 900, ease: 'Cubic.Out' });
    this.tweens.add({ targets: icon, alpha: 0, delay: 700, duration: 400, onComplete: () => icon.destroy(true) });
    if (rarity >= 3) {
      SFX.perfect();
      bigText(this, GAME_WIDTH / 2, 560, `稀有裝備！\n${g.name}`, col, 44, 1200);
    } else {
      SFX.confirm();
      floatNumber(this, this.sx(p.x), this.sy(p.y) - 120, g.name, { color: col, size: rarity === 2 ? 28 : 24 });
    }
    if (!this.gearTipShown) {
      this.gearTipShown = true;
      this.time.delayedCall(900, () => bigText(this, GAME_WIDTH / 2, 640, '撿到裝備了！☰ → 行囊 可以換上', '#9fd8ff', 30, 1800));
    }
  }
  private gearTipShown = false;
  /** 營火旁的「行囊・強化」捷徑（D-093） */
  private fireBtn: Phaser.GameObjects.Text | null = null;

  private makeFireBtn(): void {
    this.fireBtn = null;
    if (!this.tracked) return;
    const b = this.add.text(GAME_WIDTH / 2, 960, '行囊・強化', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: '#1a0f08', backgroundColor: '#ffd27a' }).setOrigin(0.5).setPadding(20, 10, 20, 10).setDepth(62).setVisible(false).setInteractive({ useHandCursor: true });
    b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (this.menu || this.editing || this.ended) return;
      SFX.uiTap();
      this.stick = null;
      this.openBag(false);
    });
    this.fireBtn = b;
  }

  private updateFireBtn(): void {
    const b = this.fireBtn;
    if (!b) return;
    const p = playerOf(this.s);
    const near = !p.dead && (STAGES[this.stageId]?.campfires ?? []).some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= CAMPFIRE_RULES.safeUnits * UNIT);
    const up = near && this.bagSt.bag.some((g) => isUpgrade(this.bagSt, g));
    b.setVisible(near && !this.menu).setText(up ? '行囊・強化 ▲' : '行囊・強化');
  }

  private saveBag(): void {
    const rec = loadRecord(this.stageId);
    saveRecord(this.stageId, { ...rec, bag: this.bagSt.bag, equip: this.bagSt.equip });
  }

  private openBag(fromMenu = true): void {
    this.persist(); // 這場剛撿的材料先算進錢包
    this.menu?.destroy();
    this.menu = openRtBagPanel(
      this,
      this.bagSt,
      () => {
        const p = playerOf(this.s);
        return `${this.s.prog ? `Lv ${this.s.prog.level}　` : ''}攻擊 ${p.atk}　HP ${p.maxHp}　防禦 ${p.def}`;
      },
      (st) => {
        this.bagSt = st;
        this.saveBag();
        setGearBonus(this.s, bonusOf(st));
        setSkillMods(this.s, skillModsOf(st));
      },
      () => {
        this.menu?.destroy();
        this.menu = null;
        if (fromMenu) this.toggleMenu();
        else this.acc = 0;
      },
      {
        wallet: () => walletOf(loadRecord(this.stageId)),
        atFire: () => {
          const p = playerOf(this.s);
          return (STAGES[this.stageId]?.campfires ?? []).some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= CAMPFIRE_RULES.safeUnits * UNIT);
        },
        spend: (d, c) => {
          const r = spend(loadRecord(this.stageId), d, c);
          if (!r) return false;
          saveRecord(this.stageId, r);
          return true;
        },
      },
    );
  }

  // ---------- 調整按鈕位置（D-088） ----------
  private hitButton(x: number, y: number): number {
    for (let i = 0; i <= JOY_INDEX; i++) {
      const b = this.btnPos(i);
      const r = i === JOY_INDEX ? this.JOY.r : this.btnR(i);
      if (Math.hypot(x - b.x, y - b.y) <= r + 6) return i;
    }
    return -1;
  }
  private startEdit(): void {
    if (this.menu) {
      this.menu.destroy();
      this.menu = null;
    }
    this.stick = null;
    const bg = this.add.rectangle(0, 0, GAME_WIDTH, 250, 0x000000, 0.8);
    const t = this.add.text(0, -70, '調整按鈕位置', { fontFamily: TITLE_FONT, fontSize: '36px', color: '#ffd27a' }).setOrigin(0.5);
    const h = this.add.text(0, -18, '拖曳按鈕或搖桿＝移動位置\n點一個技能鍵、再點另一個＝交換技能', { fontFamily: UI_FONT, fontSize: '22px', color: '#ffffff', align: 'center', lineSpacing: 6 }).setOrigin(0.5);
    const mk = (x: number, label: string, fn: () => void, hi = false): Phaser.GameObjects.Text => {
      const b = this.add.text(x, 70, label, { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: hi ? '#1a0f08' : '#ffffff', backgroundColor: hi ? '#ffd27a' : '#3a2a14' }).setOrigin(0.5).setPadding(22, 10, 22, 10).setInteractive({ useHandCursor: true });
      b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        SFX.confirm();
        fn();
      });
      return b;
    };
    const done = mk(130, '完成', () => this.endEdit(), true);
    const reset = mk(-130, '恢復預設位置', () => {
      this.ctl = { ...this.ctl, pos: {} };
      saveControls(this.ctl);
      this.makeButtons();
    });
    const ui = this.add.container(GAME_WIDTH / 2, 330, [bg, t, h, done, reset]).setDepth(961);
    this.editing = { drag: null, sx: 0, sy: 0, moved: false, pick: null, ui };
  }
  private endEdit(): void {
    if (!this.editing) return;
    this.editing.ui.destroy();
    this.editing = null;
    saveControls(this.ctl);
    this.acc = 0;
    this.toggleMenu();
  }
  private editDown(p: Phaser.Input.Pointer): void {
    const e = this.editing!;
    if (p.y > 205 && p.y < 455) return; // 說明框（按鈕自己處理）
    const i = this.hitButton(p.x, p.y);
    e.drag = i >= 0 ? i : null;
    e.sx = p.x;
    e.sy = p.y;
    e.moved = false;
  }
  private editMove(p: Phaser.Input.Pointer): void {
    const e = this.editing!;
    if (e.drag === null || !p.isDown) return;
    if (!e.moved && Math.hypot(p.x - e.sx, p.y - e.sy) < 12) return;
    e.moved = true;
    e.pick = null;
    this.ctl = { ...this.ctl, pos: { ...this.ctl.pos, [e.drag]: clampPos(p.x, p.y) } };
    if (e.drag < BTN_COUNT) {
      const b = this.btnPos(e.drag);
      this.btnText[e.drag]?.setPosition(b.x, b.y);
    }
  }
  private editUp(): void {
    const e = this.editing!;
    const i = e.drag;
    e.drag = null;
    if (i === null || e.moved || i > 3) {
      if (e.moved) saveControls(this.ctl);
      return;
    }
    // 點技能鍵：第一下選取、第二下交換
    if (e.pick === null) {
      e.pick = i;
      SFX.uiTap();
    } else {
      if (e.pick !== i) {
        this.ctl = swapSlots(this.ctl, e.pick, i);
        saveControls(this.ctl);
        this.makeButtons();
        SFX.confirm();
      }
      e.pick = null;
    }
  }

  private glowTexture(): string {
    const key = 'rt_fire_glow';
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, 256, 256);
    if (!tex) return key;
    const ctx = tex.getContext();
    const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,190,90,0.8)');
    gr.addColorStop(0.35, 'rgba(255,140,50,0.32)');
    gr.addColorStop(1, 'rgba(255,100,30,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 256, 256);
    tex.refresh();
    return key;
  }

  /** 地圖上的 Boss 倒下（刷怪地圖不會因此結束）：金色閃光＋討伐大字＋首殺紀錄（獨立 localStorage，不碰主線存檔） */
  private bossSlain(name: string, fury = false): void {
    SFX.perfect();
    this.cameras.main.flash(260, 255, 220, 140);
    this.cameras.main.shake(320, 0.01);
    const p = playerOf(this.s);
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 180, () => shockRing(this, this.sx(p.x), this.sy(p.y), 0xffd27a, 220 + i * 90, 600, 8));
    sparks(this, this.sx(p.x), this.sy(p.y), 40, 'ember', 0xffd27a, 700);
    let first = true;
    let best = false;
    const sec = this.s.tick / TICKS_PER_SEC;
    if (this.tracked) {
      const r = recordBoss(loadRecord(this.stageId), this.bossTimed ? null : sec, Date.now(), fury);
      saveRecord(this.stageId, r.rec);
      first = r.first;
      best = r.best;
      if (r.rec.bossKills === FURY_UNLOCK.kills && (this.s.prog?.level ?? 1) < FURY_UNLOCK.level && STAGES[this.stageId]?.bossZone?.fury) this.time.delayedCall(4600, () => this.furyUnlockedToast());
      this.persist();
    }
    const timed = !this.bossTimed;
    this.bossTimed = true;
    this.time.delayedCall(300, () => bigText(this, GAME_WIDTH / 2, 440, `${name} 討伐！`, '#ffd27a', 60, 1800));
    const again = STAGES[this.stageId]?.bossZone?.respawnTicks ? '離開巢穴一會兒，牠會再回來' : '可以繼續刷怪，或從 ☰ 離開';
    const head = first ? '首次討伐！森林安靜了一點…' : fury ? '暴怒的狼王倒下了！看看掉了什麼' : best ? `最快紀錄！${fmtSec(sec)}` : '再次討伐！';
    const sub = `${head}${timed && !best && this.tracked ? `\n本次 ${fmtSec(sec)}` : ''}\n${again}`;
    this.time.delayedCall(1900, () => bigText(this, GAME_WIDTH / 2, 540, sub, '#f4e6c0', 32, 2600));
  }

  /** 隱藏精英的「遊戲記憶」提示：第一次連殺到門檻的 2/3 時出現一次 */
  private streakHint(): void {
    const h = STAGES[this.stageId]?.hiddenElite;
    if (!h || this.streakHinted || this.bot || (this.s.streak ?? 0) < Math.ceil((h.streak * 2) / 3)) return;
    this.streakHinted = true;
    bigText(this, GAME_WIDTH / 2, 600, '（記得……不倒下一直打下去，首領會被引出來……）', '#d8c8ff', 26, 2200);
  }

  /** 隱藏寶箱附近第一次靠近：「這個地方似乎有點熟悉……」（design/20 C2，只提示不指路） */
  private chestHint(): void {
    const list = STAGES[this.stageId]?.chests;
    if (!list?.length || this.bot) return;
    const p = playerOf(this.s);
    for (const c of list) {
      if (this.chestHinted.has(c.id) || this.s.chestsOpened?.includes(c.id)) continue;
      if (Math.hypot(c.x - p.x, c.y - p.y) > CHEST_RULES.hintUnits * UNIT) continue;
      this.chestHinted.add(c.id);
      const t = this.add.text(GAME_WIDTH / 2, 640, '這個地方似乎有點熟悉……', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: 'italic', color: '#d8c8ff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(66).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 0.9, duration: 700, hold: 1800, yoyo: true, onComplete: () => t.destroy() });
    }
  }

  /** 走進新地區 → 上方淡入淡出地區名稱（開場那一區也會顯示一次） */
  private zoneBanner(): void {
    const zs = STAGES[this.stageId]?.zones;
    if (!zs?.length) return;
    const p = playerOf(this.s);
    const z = zs.find((q) => p.x >= q.x0 && p.x < q.x1 && p.y >= q.y0 && p.y < q.y1);
    if (!z || z.name === this.zoneName) return;
    this.zoneName = z.name;
    const t = this.add.text(GAME_WIDTH / 2, 190, `— ${z.name} —`, { fontFamily: TITLE_FONT, fontSize: '40px', color: '#f4e6c0', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(66).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 180, duration: 500, ease: 'Cubic.Out', hold: 1400, yoyo: true, onComplete: () => t.destroy() });
    if (!z.hint) return;
    const h = this.add.text(GAME_WIDTH / 2, 240, z.hint, { fontFamily: TITLE_FONT, fontSize: '26px', color: z.danger ? '#ff8a7a' : '#d8e8ff', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(66).setAlpha(0);
    this.tweens.add({ targets: h, alpha: 1, y: 232, duration: 500, delay: 250, ease: 'Cubic.Out', hold: 1900, yoyo: true, onComplete: () => h.destroy() });
    if (z.danger && !this.bot) SFX.uiTap();
  }

  /** 地圖怪關卡：開場 30 秒都沒點怪也沒按技能 → 提示「點狼開打」並在最近的怪身上打光圈 */
  private idleHint(): void {
    if (this.idleHinted || this.bot || this.engaged) return;
    const st = STAGES[this.stageId];
    if (!st?.mapAi || this.s.tick < 30 * TICKS_PER_SEC) return;
    this.idleHinted = true;
    if (summarize(this.s).kills > 0) return;
    const p = playerOf(this.s);
    const near = enemiesOf(this.s).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    bigText(this, GAME_WIDTH / 2, 680, '點一下怪物，就會走過去開打！', '#9fd8ff', 34, 2400);
    if (!near) return;
    SFX.uiTap();
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 450, () => {
        if (near.dead) return;
        shockRing(this, this.sx(near.x), this.sy(near.y), 0x9fd8ff, 110, 500, 5);
      });
    }
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

  /** 離開森林前先把紀錄寫好 */
  private leave(fn: () => void): void {
    this.persist();
    fn();
  }

  /** 暫停選單裡的「本次／累計」紀錄 */
  private recordText(y: number): Phaser.GameObjects.Text {
    const rec = loadRecord(this.stageId);
    const now = this.snap();
    const total = mergeRun(rec, this.saved, now);
    const nChest = STAGES[this.stageId]?.chests?.length ?? 0;
    const lines = [
      `本次：擊殺 ${now.kills}・金幣 ${now.coin}・粉塵 ${now.dust}・結晶 ${now.crystal}`,
      `累計：擊殺 ${total.kills ?? 0}・金幣 ${total.coin ?? 0}・粉塵 ${total.dust ?? 0}・結晶 ${total.crystal ?? 0}`,
      `狼王討伐 ${rec.bossKills ?? 0} 次${rec.furyKills ? `（暴怒 ${rec.furyKills}）` : ''}${rec.bestBossSec !== undefined ? `・最快 ${fmtSec(rec.bestBossSec)}` : ''}・寶箱 ${(total.chests ?? []).length}/${nChest}`,
      `進入森林 ${rec.runs ?? 1} 次・累計 ${fmtSec(total.playSec ?? 0)}`,
    ];
    if (this.s.prog) lines.unshift(`Lv ${this.s.prog.level}・經驗 ${this.s.prog.xp}/${xpToNext(this.s.prog.level)}`);
    return this.add.text(0, y, lines.join('\n'), { fontFamily: UI_FONT, fontSize: '22px', color: '#e8dcc0', align: 'center', lineSpacing: 10, backgroundColor: '#00000066' }).setOrigin(0.5, 0).setPadding(18, 12, 18, 12);
  }

  /** 第一次達成暴怒狼王解鎖條件（D-099） */
  private furyUnlockedToast(): void {
    SFX.warn(true);
    bigText(this, GAME_WIDTH / 2, 600, '解鎖：狼王暴怒！\n☰ 暫停選單可以開啟・掉落更好', '#ff7a5a', 34, 2600);
  }

  /** 暫停選單的「狼王暴怒」開關（D-099）：沒解鎖時顯示條件 */
  private furyButton(mk: (y: number, label: string, fn: () => void, hi?: boolean) => void, items: Phaser.GameObjects.GameObject[], y: number): void {
    const rec = loadRecord(this.stageId);
    const lv = this.s.prog?.level ?? 1;
    if (!furyUnlocked(rec, lv)) {
      items.push(this.add.text(0, y, `🔒 狼王暴怒（Lv${FURY_UNLOCK.level} 或討伐 ${FURY_UNLOCK.kills} 次解鎖）`, { fontFamily: UI_FONT, fontSize: '22px', color: '#9a8a7a', backgroundColor: '#2a2018' }).setOrigin(0.5).setPadding(18, 12, 18, 12));
      return;
    }
    const on = !!this.s.bossFury;
    mk(y, on ? '🔥 狼王暴怒：開' : '狼王暴怒：關', () => {
      const next = !on;
      const now = setBossFury(this.s, next);
      saveRecord(this.stageId, { ...loadRecord(this.stageId), fury: next });
      this.toggleMenu();
      bigText(this, GAME_WIDTH / 2, 470, next ? (now ? '狼王暴怒了！HP・攻擊大增・掉落更好' : '下一次出現的狼王會是暴怒版') : now ? '狼王恢復平靜' : '下一次出現的狼王恢復一般', next ? '#ff7a5a' : '#c8d0f0', 34, 1600);
      if (next) SFX.warn(true);
    }, on);
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
    // 開場說明等還在畫面上的大字（depth 950）收掉，免得疊在選單上
    for (const o of [...this.children.list]) if (o instanceof Phaser.GameObjects.Text && o.depth === 950) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
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
    const ctlBtn = (y: number) => mk(y, '操作設定', () => {
      this.menu?.destroy();
      this.menu = null;
      this.menu = openRtControlsPanel(this, this.ctl, (c, edit) => {
        this.ctl = c;
        saveControls(c);
        this.makeButtons();
        this.bindKeys();
        this.menu?.destroy();
        this.menu = null;
        if (edit) this.startEdit();
        else this.toggleMenu();
      });
    });
    if (this.tracked || STAGES[this.stageId]?.id === 'mistwood') {
      // 正式大地圖（標題入口）：不列試玩關
      if (this.tracked) {
        const up = this.bagSt.bag.filter((g) => isUpgrade(this.bagSt, g)).length;
        mk(-270, `行囊（${this.bagSt.bag.length}）${up ? `　▲${up}` : ''}`, () => this.openBag(), up > 0);
      }
      ctlBtn(-190);
      mk(-110, this.botName ? '改成自己操作' : '看 Bot 示範', () => this.leave(() => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ? '' : 'normal' })));
      mk(-30, '重新進入森林', () => this.leave(() => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ?? '' })));
      if (this.tracked && STAGES[this.stageId]?.bossZone?.fury) this.furyButton(mk, items, 50);
      mk(this.tracked && STAGES[this.stageId]?.bossZone?.fury ? 130 : 50, '回標題', () => this.leave(() => this.scene.start('Title')));
      items.push(this.recordText(this.tracked && STAGES[this.stageId]?.bossZone?.fury ? 210 : 130));
      this.menu = this.add.container(GAME_WIDTH / 2, 640, items).setDepth(960);
      return;
    }
    ctlBtn(-270);
    mk(-190, '重來', () => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ?? '' }));
    items.push(this.add.text(0, -120, '換關卡', { fontFamily: UI_FONT, fontSize: '22px', color: '#c8d0f0' }).setOrigin(0.5));
    STAGE_IDS.forEach((id, i) => mk(-60 + i * 72, `${id === this.stageId ? '▶ ' : ''}${STAGES[id]!.name}`, () => this.scene.restart({ stage: id, seed: this.seed + 1, bot: this.botName ?? '' })));
    mk(-60 + STAGE_IDS.length * 72 + 14, this.botName ? '改成自己操作' : '看 Bot 示範（熟練）', () => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ? '' : 'expert' }));
    mk(-60 + STAGE_IDS.length * 72 + 90, '回標題', () => this.scene.start('Title'));
    this.menu = this.add.container(GAME_WIDTH / 2, 640, items).setDepth(960);
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
        // 遊戲記憶（design/20 C2-2）：地圖上第一次遇到 Boss → 內心提示弱點（只提示，不加傷害）
        if (d && ENEMIES[d.defId]?.boss && STAGES[this.stageId]?.spawnGroups?.length && !this.bossMemo) {
          this.bossMemo = true;
          this.time.delayedCall(600, () => bigText(this, GAME_WIDTH / 2, 600, '（記得……牠衝鋒撞到樹或石頭會暈！）', '#d8c8ff', 28, 2200));
        }
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
        const cs0 = SKILLS.parry?.block?.counter.shape;
        const cs = cs0 && skillShape(this.s, 'parry', cs0);
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
          if (ENEMIES[d.defId]?.boss && STAGES[this.stageId]?.spawnGroups?.length) this.bossSlain(`${d.fury ? '暴怒的' : ''}${ENEMIES[d.defId]!.name}`, !!d.fury);
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
      } else if (e.type === 'pickup' && e.kind === 'gear') {
        this.gotGear(e.item, e.rarity ?? 1, e.amount);
      } else if (e.type === 'pickup') {
        const p = playerOf(this.s);
        // 只是畫面上的字（這些東西是試玩場景的戰利品統計，不是主線玩家資產）
        const L: [string, string] =
          e.kind === 'gold' ? [`+${e.amount} 金`, '#ffd27a'] : e.kind === 'dust' ? [`粉塵 +${e.amount}`, '#9fd8ff'] : e.kind === 'crystal' ? [`結晶 +${e.amount}`, '#d0a0ff'] : [`藥水 +${e.amount}`, '#7dffb0'];
        floatNumber(this, this.sx(p.x) + 40, this.sy(p.y) - 70, L[0], { color: L[1], size: e.kind === 'gold' ? 22 : 24 });
        if (e.kind !== 'gold') SFX.itemGet();
      } else if (e.type === 'levelUp') {
        // 升級（D-090）：金色光柱＋大字＋數值浮字，立刻存檔
        const p = playerOf(this.s);
        if (this.tracked && e.level === FURY_UNLOCK.level && STAGES[this.stageId]?.bossZone?.fury && (loadRecord(this.stageId).bossKills ?? 0) < FURY_UNLOCK.kills) this.furyUnlockedToast();
        SFX.perfect();
        this.cameras.main.flash(180, 255, 230, 160);
        const col = this.add.rectangle(this.sx(p.x), this.sy(p.y) - 200, 90, 420, 0xffe08a, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
        this.tweens.add({ targets: col, scaleX: 0.1, alpha: 0, duration: 900, ease: 'Cubic.In', onComplete: () => col.destroy() });
        bigText(this, GAME_WIDTH / 2, 470, `等級提升！Lv ${e.level}`, '#ffe08a', 54, 1000);
        floatNumber(this, this.sx(p.x), this.sy(p.y) - 110, `HP ${e.maxHp}・攻擊 ${e.atk}`, { color: '#ffe08a', size: 26 });
        sparks(this, this.sx(p.x), this.sy(p.y) - 30, 36, 'ember', 0xffe08a, 700);
        shockRing(this, this.sx(p.x), this.sy(p.y), 0xffe08a, 200, 600, 8);
        this.persist();
      } else if (e.type === 'enhance') {
        const p = playerOf(this.s);
        SFX.confirm();
        bigText(this, GAME_WIDTH / 2, 520, `武器強化 +${e.level}！`, '#ffd27a', 46, 800);
        floatNumber(this, this.sx(p.x), this.sy(p.y) - 100, `攻擊 ${e.atk}`, { color: '#ffd27a', size: 26 });
        sparks(this, this.sx(p.x), this.sy(p.y) - 30, 24, 'spark', 0xffd27a, 520);
        shockRing(this, this.sx(p.x), this.sy(p.y), 0xffd27a, 130, 450, 6);
      } else if (e.type === 'ramp') {
        if (e.minute < 5) bigText(this, GAME_WIDTH / 2, 470, `第 ${e.minute} 分鐘・狼群越來越兇了（+${e.pct}%）`, '#ff9a6a', 30, 1100);
      } else if (e.type === 'fury') {
        // 暴怒版開關：舊的 Boss 單位被換掉（文字提示由選單顯示；進森林時套用不提示）
        this.sprites.get(e.old)?.destroy();
        this.sprites.delete(e.old);
        const d = u(e.id);
        if (d) sparks(this, this.sx(d.x), this.sy(d.y), 24, 'ember', e.on ? 0xff6050 : 0x8a7aa8, 700);
      } else if (e.type === 'respawn') {
        const d = u(e.id);
        if (d) sparks(this, this.sx(d.x), this.sy(d.y), 10, 'ember', 0x8a7aa8, 500);
        if (d && e.group === 'boss') {
          bigText(this, GAME_WIDTH / 2, 470, `${d.fury ? '暴怒的' : ''}${ENEMIES[d.defId]?.name ?? 'Boss'}回到巢穴了・可以再挑戰`, '#ff8a7a', 34, 1400);
          SFX.warn(true);
        } else if (d && d.tier === 'elite') {
          bigText(this, GAME_WIDTH / 2, 470, `${ENEMIES[d.defId]?.name ?? '精英'}出現了！`, '#ffa040', 40, 900);
          SFX.warn(true);
        }
      } else if (e.type === 'hiddenElite') {
        const d = u(e.id);
        SFX.warn(true);
        this.cameras.main.shake(220, 0.006);
        bigText(this, GAME_WIDTH / 2, 420, `隱藏的${ENEMIES[d?.defId ?? '']?.name ?? '首領'}現身！`, '#ffa040', 46, 1200);
        this.time.delayedCall(700, () => bigText(this, GAME_WIDTH / 2, 490, '比一般的強很多・掉落三倍', '#ffd27a', 28, 1400));
        if (d) shockRing(this, this.sx(d.x), this.sy(d.y), 0xffa040, 180, 650, 8);
      } else if (e.type === 'riot') {
        SFX.warn(true);
        this.cameras.main.shake(260, 0.006);
        bigText(this, GAME_WIDTH / 2, 420, e.elite ? '狼群暴動！首領也來了！' : '狼群暴動！', '#ff7a5a', 50, 1200);
        this.time.delayedCall(700, () => bigText(this, GAME_WIDTH / 2, 490, `${e.count} 隻狼衝過來了・打倒掉落加倍`, '#ffd27a', 28, 1400));
        shockRing(this, this.sx(e.x), this.sy(e.y), 0xff5a3a, 200, 700, 8);
      } else if (e.type === 'chest') {
        const c = STAGES[this.stageId]?.chests?.find((q) => q.id === e.chest);
        const x = c ? this.sx(c.x) : GAME_WIDTH / 2;
        const y = c ? this.sy(c.y) : 600;
        SFX.perfect();
        SFX.itemGet();
        this.cameras.main.flash(120, 255, 230, 160);
        shockRing(this, x, y, 0xffd27a, 160, 520, 7);
        sparks(this, x, y - 20, 30, 'ember', 0xffe08a, 620);
        const got = Object.entries(e.loot).map(([k, n]) => `${LOOT_NAMES[k] ?? k} ×${n}`).join('　');
        bigText(this, GAME_WIDTH / 2, 390, '找到隱藏寶箱！', '#ffd27a', 46, 1000);
        this.time.delayedCall(500, () => bigText(this, GAME_WIDTH / 2, 446, got, '#f4e6c0', 30, 1400));
      } else if (e.type === 'rest') {
        const p = playerOf(this.s);
        SFX.itemGet();
        shockRing(this, this.sx(p.x), this.sy(p.y), 0xffb060, 120, 500, 6);
        bigText(this, this.sx(p.x), this.sy(p.y) - 90, '休息・HP 全滿', '#ffd27a', 32, 600);
      } else if (e.type === 'revive') {
        const p = playerOf(this.s);
        // 倒下→黑幕 1 秒淡入（像真的昏過去再醒來），再出字
        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.time.delayedCall(450, () => bigText(this, GAME_WIDTH / 2, 520, '在營火旁醒來', '#ffd27a', 40, 1100));
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
  private makeGround(): Phaser.GameObjects.Container {
    const a = this.s.arena;
    const k = this.k;
    const W = a.w * k;
    const H = a.h * k;
    const key = `rt_ground_${this.stageId}_${a.w}x${a.h}`;
    const PAD = 8;
    const TW = Math.ceil(W) + PAD * 2;
    const TH = Math.ceil(H) + PAD * 2;
    const box = this.add.container(0, 0);
    // 分塊：每塊最多 GROUND_CHUNK px；小關卡只有一塊（跟以前一樣）
    const nx = Math.ceil(TW / GROUND_CHUNK);
    const ny = Math.ceil(TH / GROUND_CHUNK);
    const chunkKey = (i: number, j: number): string => (nx * ny === 1 ? key : `${key}_${i}_${j}`);
    const place = (): Phaser.GameObjects.Container => {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        box.add(this.add.image(i * GROUND_CHUNK - PAD, j * GROUND_CHUNK - PAD, chunkKey(i, j)).setOrigin(0));
      }
      return box;
    };
    if (this.textures.exists(chunkKey(0, 0))) return place();
    // 每塊各自重畫一次（Graphics.generateTexture 不吃物件位置，要用 translateCanvas 平移；同一個固定種子，所以每塊畫出同一張地圖）
    const paint = (g: Phaser.GameObjects.Graphics, bx0: number, by0: number, bx1: number, by1: number): void => {
      g.fillStyle(0x16261c, 1).fillRect(0, 0, W, H);
      // 固定種子的地面斑點（不影響戰鬥 PRNG）
      let seed = 1234567;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      for (let i = 0; i < (a.w * a.h) / 9000; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const dark = rnd() < 0.5;
        const ew = 30 + rnd() * 60;
        const eh = 14 + rnd() * 24;
        const grass = rnd() < 0.3 ? [0, 1, 2, 3, 4].map(() => rnd() * 8) : null;
        // 亂數照樣消耗（每塊畫出同一張圖），只是這塊外面的不畫
        if (x < bx0 - 80 || x > bx1 + 80 || y < by0 - 40 || y > by1 + 40) continue;
        g.fillStyle(dark ? 0x1a2c1f : 0x14231a, 0.8).fillEllipse(x, y, ew, eh);
        if (grass) {
          g.lineStyle(2, 0x2f5a36, 0.8);
          for (let j = -2; j <= 2; j++) g.lineBetween(x + j * 4, y, x + j * 6, y - 10 - grass[j + 2]!);
        }
      }
      g.lineStyle(1, 0x203a28, 1);
      for (let x = 0; x <= a.w; x += 100) g.lineBetween(x * k, 0, x * k, H);
      for (let y = 0; y <= a.h; y += 100) g.lineBetween(0, y * k, W, y * k);
      // 障礙物（D-070／D-071）：成片的（周圍 8 格有 5 格以上也是障礙）畫成樹林，零散的畫成圓石。
      // 每格用座標雜湊當亂數（分塊時只畫這一塊附近的格子，結果仍一致）
      if (a.solid) {
        const c = a.solid.cell * k;
        const rows = a.solid.rows;
        const solidAt = (x: number, y: number): boolean => x < 0 || y < 0 || y >= rows.length || x >= rows[y]!.length || rows[y]![x] === '#';
        const dense = (x: number, y: number): boolean => {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && solidAt(x + dx, y + dy)) n++;
          return n >= 5;
        };
        const hr = (x: number, y: number, i: number): number => {
          let h = (x * 374761393 + y * 668265263 + i * 2246822519) | 0;
          h = Math.imul(h ^ (h >>> 13), 1274126177);
          return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
        };
        const cx0 = Math.max(0, Math.floor(bx0 / c) - 1);
        const cx1 = Math.ceil(bx1 / c) + 1;
        const cy0 = Math.max(0, Math.floor(by0 / c) - 1);
        const cy1 = Math.min(rows.length - 1, Math.ceil(by1 / c) + 1);
        // 樹林底（深色地面，讓林帶讀起來是一整片）
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= Math.min(cx1, rows[cy]!.length - 1); cx++) {
          if (rows[cy]![cx] === '#' && dense(cx, cy)) g.fillStyle(0x0c170e, 1).fillRect(cx * c - 1, cy * c - 1, c + 2, c + 2);
        }
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= Math.min(cx1, rows[cy]!.length - 1); cx++) {
          if (rows[cy]![cx] !== '#') continue;
          const x = cx * c;
          const y = cy * c;
          if (dense(cx, cy)) {
            // 樹冠：影子＋兩層葉團＋左上亮面（由上往下畫，下面的樹蓋住上面的，有前後感）
            const ox = (hr(cx, cy, 1) - 0.5) * c * 0.3;
            const oy = (hr(cx, cy, 2) - 0.5) * c * 0.3;
            const r = c * (0.62 + hr(cx, cy, 3) * 0.18);
            g.fillStyle(0x050a06, 0.5).fillEllipse(x + c / 2 + ox + c * 0.12, y + c * 0.75 + oy, r * 2.1, r * 1.1);
            g.fillStyle(hr(cx, cy, 4) < 0.5 ? 0x1b3620 : 0x203f25, 1).fillCircle(x + c / 2 + ox, y + c / 2 + oy, r);
            g.fillStyle(0x2a5230, 1).fillCircle(x + c / 2 + ox - r * 0.2, y + c / 2 + oy - r * 0.25, r * 0.62);
            g.fillStyle(0x3d7042, 0.7).fillCircle(x + c / 2 + ox - r * 0.35, y + c / 2 + oy - r * 0.4, r * 0.28);
            continue;
          }
          const j = hr(cx, cy, 5) * 0.12;
          g.fillStyle(0x050a07, 0.55).fillEllipse(x + c * 0.55, y + c * 0.78, c * 1.05, c * 0.42);
          g.fillStyle(0x4a4f52, 1).fillRoundedRect(x + c * (0.04 + j), y + c * 0.06, c * (0.92 - j), c * 0.86, c * 0.28);
          g.fillStyle(0x6c7378, 1).fillRoundedRect(x + c * (0.12 + j), y + c * 0.1, c * (0.7 - j), c * 0.46, c * 0.22);
          g.fillStyle(0x8d959a, 0.8).fillEllipse(x + c * 0.36, y + c * 0.24, c * 0.3, c * 0.12);
          g.lineStyle(2, 0x2c3033, 0.9).lineBetween(x + c * (0.3 + j), y + c * 0.5, x + c * 0.5, y + c * 0.68);
          if (hr(cx, cy, 6) < 0.5) g.fillStyle(0x3f6b3a, 0.85).fillEllipse(x + c * (0.2 + hr(cx, cy, 7) * 0.5), y + c * 0.84, c * 0.28, c * 0.1);
        }
      }
      g.lineStyle(10, 0x0a120d, 1).strokeRect(-5, -5, W + 10, H + 10);
      g.lineStyle(3, 0x5a8a60, 1).strokeRect(0, 0, W, H);
    };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const rx = i * GROUND_CHUNK;
      const ry = j * GROUND_CHUNK;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.translateCanvas(PAD - rx, PAD - ry);
      paint(g, rx - PAD, ry - PAD, rx - PAD + GROUND_CHUNK, ry - PAD + GROUND_CHUNK);
      g.generateTexture(chunkKey(i, j), Math.min(GROUND_CHUNK, TW - rx), Math.min(GROUND_CHUNK, TH - ry));
      g.destroy();
    }
    return place();
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
      const hs = skillShape(this.s, a.id, h.shape); // 裝備的範圍特效（D-098）
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
      } else if (hs.type === 'circle') {
        const ult = sk.role === 'ult';
        this.spin(p.x, p.y, hs.r, big ? 0xffd05a : ult ? 0xff7ad0 : 0x9fd8ff, (this.time.now / 90) % (Math.PI * 2));
        if (ult) this.spin(p.x, p.y, hs.r * 0.6, 0xffd0f0, (this.time.now / 70 + Math.PI) % (Math.PI * 2));
        if (ult && big) {
          this.cameras.main.shake(200, 0.009);
          shockRing(this, this.sx(p.x), this.sy(p.y), 0xffd05a, hs.r * this.k * 1.1, 420, 12);
          this.hitStop = Math.max(this.hitStop, 120);
        }
      }
      else if (hs.type === 'sector') {
        this.slash(p.x, p.y, ang, hs.r, hs.deg + 30, big ? 0xffd05a : 0x9fd8ff, big ? 10 : 7);
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
      const hPx = x.r * cfg.h * this.k * (x.fury ? 1.15 : 1);
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
    // 畫面外的地面塊不送進渲染
    for (const im of this.ground.list as Phaser.GameObjects.Image[]) {
      const x = this.ox + im.x;
      const y = this.oy + im.y;
      im.setVisible(x < GAME_WIDTH && x + im.width > 0 && y < VIEW_BOTTOM && y + im.height > 0);
    }
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
      } else if (it.kind === 'gear') {
        // 裝備：稀有度顏色的劍形圖示；精良以上有光柱（design/20 B5）
        const col = RARITY_COLOR[it.rarity ?? 1];
        if ((it.rarity ?? 1) >= 2) {
          const a = (it.rarity === 3 ? 0.35 : 0.22) + 0.1 * Math.sin(now / 200 + it.id);
          g.fillStyle(col, a).fillRect(ix - 7, iy - 150, 14, 150);
          g.fillStyle(col, a * 0.5).fillRect(ix - 16, iy - 120, 32, 120);
        }
        g.fillStyle(0x000000, 0.5).fillCircle(ix, iy - 4, 17);
        g.lineStyle(3, col, 1).strokeCircle(ix, iy - 4, 17);
        g.fillStyle(col, 1).fillRect(ix - 2, iy - 17, 4, 18).fillRect(ix - 8, iy + 0, 16, 3);
      } else if (it.kind === 'crystal') {
        g.fillStyle(0xc080ff, 1).fillTriangle(ix, iy - 20, ix - 13, iy, ix + 13, iy).fillTriangle(ix, iy + 14, ix - 13, iy, ix + 13, iy);
        g.lineStyle(2, 0xffffff, 0.7).lineBetween(ix - 4, iy - 10, ix, iy - 17);
      } else {
        g.fillStyle(0xe04848, 1).fillCircle(ix, iy + 3, 13);
        g.fillStyle(0xf0e0c0, 1).fillRect(ix - 4, iy - 17, 8, 10);
      }
      if ((now / 400 + it.id) % 3 < 0.3) g.fillStyle(0xffffff, 0.8).fillCircle(ix + 6, iy - 8, 2.5);
    }
    // 隱藏寶箱：遠處看不到，靠近（hintUnits 內）才慢慢浮現；打開後留下空箱
    const pl0 = playerOf(s);
    for (const c of STAGES[this.stageId]?.chests ?? []) {
      const opened = !!s.chestsOpened?.includes(c.id);
      const d = Math.hypot(c.x - pl0.x, c.y - pl0.y) / UNIT;
      const a = opened ? 0.55 : Math.max(0, Math.min(1, (CHEST_RULES.hintUnits - d) / 2.5));
      if (a <= 0) continue;
      const cx = this.sx(c.x);
      const cy = this.sy(c.y);
      const k = this.k * 1.4;
      g.fillStyle(0x000000, 0.35 * a).fillEllipse(cx, cy + 16 * k, 60 * k, 14 * k);
      g.fillStyle(0x6a4020, a).fillRoundedRect(cx - 26 * k, cy - 8 * k, 52 * k, 26 * k, 4 * k);
      g.fillStyle(opened ? 0x2a1a0e : 0x8a5a2a, a).fillRoundedRect(cx - 28 * k, cy - (opened ? 26 : 20) * k, 56 * k, 14 * k, 5 * k);
      g.fillStyle(0xd8b050, a).fillRect(cx - 4 * k, cy - 10 * k, 8 * k, 10 * k);
      if (!opened && (now / 500) % 2 < 0.25) g.fillStyle(0xfff0c0, a).fillCircle(cx + 18 * k, cy - 18 * k, 3 * k);
    }
    // 營火：安全範圍淡圈＋木柴＋跳動的火焰與光暈
    let fi = 0;
    for (const c of STAGES[this.stageId]?.campfires ?? []) {
      const cx = this.sx(c.x);
      const cy = this.sy(c.y);
      const k = this.k * 1.5;
      g.lineStyle(2, 0xffb060, 0.18).strokeCircle(cx, cy, CAMPFIRE_RULES.safeUnits * UNIT * this.k);
      const gl = this.glows[fi++];
      if (gl) gl.setPosition(cx, cy - 10 * k).setScale((300 * k * (1 + 0.06 * Math.sin(now / 130))) / 128).setAlpha(0.85 + 0.15 * Math.sin(now / 170));
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
        sp.setPosition(px + kx + (fx0(x) * lunge), py + r * 0.15 - bob + ky + (fy0(x) * lunge)).setDepth(10 + Math.min(30, (pos.y / Math.max(1, s.arena.h)) * 30)); // 大地圖也不會蓋過 HUD／選單（深度 45 以上）
        if (sp.scaleY !== 0 && !this.tweens.isTweening(sp)) sp.setScale(base * squash, base / squash);
        if (cfg.flip && x.facingX !== 0) sp.setFlipX(x.facingX < 0);
        // 脫戰返回中半透明（打不到）；待機的怪稍暗
        sp.setAlpha(inv || x.mode === 'returning' ? 0.45 : x.mode === 'idle' || x.mode === 'dormant' ? 0.85 : 1);
        if ((this.flashUntil.get(x.id) ?? 0) > now) sp.setTintFill(0xffffff);
        else if (winding) sp.setTint(Math.floor(now / 90) % 2 ? 0xff9a9a : 0xffffff);
        else if (x.fury) sp.setTint(Math.floor(now / 500) % 2 ? 0xff6050 : 0xff8a70); // 暴怒版：紅色脈動
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
          this.shapePath(skillShape(this.s, x.action.id, h.shape), pos.x, pos.y, x.action.dirX, x.action.dirY, g, true);
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
    const p = playerOf(s);
    let li = 0;
    for (const e of enemiesOf(s)) {
      const px = this.sx(e.x);
      const py = this.sy(e.y);
      const M = 30;
      if (px >= 0 && px <= GAME_WIDTH && py >= VIEW_TOP + 40 && py <= 960) continue;
      const elite = e.tier === 'elite' || !!ENEMIES[e.defId]?.boss;
      // 有小地圖的大地圖：待機的一般怪只在小地圖上，箭頭只留給追過來的怪與精英／Boss（design/20 B6）
      if (this.mini && !elite && e.mode !== 'combat') continue;
      const cx = Math.max(M, Math.min(GAME_WIDTH - M, px));
      const cy = Math.max(VIEW_TOP + M, Math.min(960, py));
      const an = Math.atan2(py - cy || 0.001, px - cx || 0.001);
      const hot = s.telegraphs.some((t) => t.ownerId === e.id);
      const col = hot ? (Math.floor(now / 100) % 2 ? 0xff3a3a : 0xffffff) : ENEMIES[e.defId]?.boss ? 0xffb0d0 : 0xffd27a;
      const c = Math.cos(an);
      const sn = Math.sin(an);
      // 精英／Boss：大一號的橘金箭頭＋脈動光圈（值得特地去打）
      const big = elite;
      const z = big ? 1.7 : 1;
      if (big && !hot) g.fillStyle(0xff9a3a, 0.25 + 0.15 * Math.sin(now / 180)).fillCircle(cx, cy, 26);
      g.fillStyle(big && !hot ? 0xffa040 : col, 0.9).fillTriangle(cx + c * 18 * z, cy + sn * 18 * z, cx - c * 10 * z - sn * 12 * z, cy - sn * 10 * z + c * 12 * z, cx - c * 10 * z + sn * 12 * z, cy - sn * 10 * z - c * 12 * z);
      if (big && this.mini) {
        // 距離（1 格＝1 公尺），字放在箭頭內側
        let tx = this.arrowLabels[li];
        if (!tx) {
          tx = this.add.text(0, 0, '', { fontFamily: UI_FONT, fontSize: '18px', fontStyle: '700', color: '#ffd27a', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(51);
          this.arrowLabels.push(tx);
        }
        li++;
        tx.setVisible(true).setText(`${Math.round(Math.hypot(e.x - p.x, e.y - p.y) / UNIT)}m`).setPosition(cx - c * 40, cy - sn * 40);
      }
    }
    for (let i = li; i < this.arrowLabels.length; i++) this.arrowLabels[i]!.setVisible(false);
    // 畫面外地上的精良以上裝備（D-100）：邊緣閃爍菱形（稀有度顏色），提醒回去撿
    for (const it of s.ground ?? []) {
      if (it.kind !== 'gear' || (it.rarity ?? 1) < 2) continue;
      const px = this.sx(it.x);
      const py = this.sy(it.y);
      if (px >= 0 && px <= GAME_WIDTH && py >= VIEW_TOP + 40 && py <= 960) continue;
      const cx = Math.max(24, Math.min(GAME_WIDTH - 24, px));
      const cy = Math.max(VIEW_TOP + 24, Math.min(950, py));
      const r = 11 + 2 * Math.sin(now / 140);
      g.fillStyle(RARITY_COLOR[it.rarity ?? 2], 0.3).fillCircle(cx, cy, r + 8);
      g.fillStyle(RARITY_COLOR[it.rarity ?? 2], 1).fillPoints([{ x: cx, y: cy - r }, { x: cx + r * 0.7, y: cy }, { x: cx, y: cy + r }, { x: cx - r * 0.7, y: cy }], true);
      g.lineStyle(2, 0xffffff, 0.8).strokePoints([{ x: cx, y: cy - r }, { x: cx + r * 0.7, y: cy }, { x: cx, y: cy + r }, { x: cx - r * 0.7, y: cy }], true);
    }
  }

  /** 小地圖：場地面積超過畫面約 2.5 倍才顯示；石頭與邊框烘成材質，單位點每幀畫在 ui 上 */
  private makeMinimap(): void {
    this.mini = null;
    const a = this.s.arena;
    const viewW = GAME_WIDTH / this.k;
    const viewH = (VIEW_BOTTOM - VIEW_TOP) / this.k;
    if (a.w * a.h < viewW * viewH * 2.5) return;
    const s = Math.min(130 / a.w, 190 / a.h);
    const w = Math.round(a.w * s);
    const h = Math.round(a.h * s);
    const x = 12;
    const y = VIEW_TOP + 12;
    const key = `rt_mini_${this.stageId}_${a.w}x${a.h}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x0b1410, 0.85).fillRect(0, 0, w + 4, h + 4);
      g.fillStyle(0x1f3a26, 1).fillRect(2, 2, w, h);
      if (a.solid) {
        const c = a.solid.cell * s;
        g.fillStyle(0x6c7378, 1);
        a.solid.rows.forEach((row, cy) => {
          for (let cx = 0; cx < row.length; cx++) if (row[cx] === '#') g.fillRect(2 + cx * c, 2 + cy * c, Math.max(1, c), Math.max(1, c));
        });
      }
      g.lineStyle(2, 0x5a8a60, 1).strokeRect(1, 1, w + 2, h + 2);
      g.generateTexture(key, w + 4, h + 4);
      g.destroy();
    }
    this.add.image(x - 2, y - 2, key).setOrigin(0).setDepth(49).setAlpha(0.9);
    this.mini = { x, y, w, h, s };
  }

  /** 小地圖點在石頭上時，找最近的空地（格中心，最多 3 格外） */
  private freeNear(x: number, y: number): [number, number] | null {
    const sol = this.s.arena.solid;
    if (!sol || !isSolidAt(sol, x, y)) return [x, y];
    const c = sol.cell;
    const cx = Math.floor(x / c);
    const cy = Math.floor(y / c);
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const px = (cx + dx) * c + c / 2;
      const py = (cy + dy) * c + c / 2;
      if (px < 0 || py < 0 || px > this.s.arena.w || py > this.s.arena.h || isSolidAt(sol, px, py)) continue;
      const d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = [px, py]; }
    }
    return best;
  }

  private drawMinimap(g: Phaser.GameObjects.Graphics): void {
    const m = this.mini;
    if (!m) return;
    const s = this.s;
    const now = this.time.now;
    // 目前畫面範圍
    const vx = (0 - this.ox) * m.s / this.k;
    const vy = (VIEW_TOP - this.oy) * m.s / this.k;
    const x0 = Math.max(0, vx);
    const y0 = Math.max(0, vy);
    const x1 = Math.min(m.w, vx + (GAME_WIDTH / this.k) * m.s);
    const y1 = Math.min(m.h, vy + ((VIEW_BOTTOM - VIEW_TOP) / this.k) * m.s);
    if (x1 > x0 && y1 > y0) g.lineStyle(1, 0xffffff, 0.45).strokeRect(m.x + x0, m.y + y0, x1 - x0, y1 - y0);
    for (const c of STAGES[this.stageId]?.campfires ?? []) {
      g.fillStyle(0xffa040, 0.6 + 0.4 * Math.sin(now / 200)).fillCircle(m.x + c.x * m.s, m.y + c.y * m.s, 4);
    }
    // Boss 巢穴：骷髏記號（圓＋叉），暴怒版是紅色
    const bz = STAGES[this.stageId]?.bossZone;
    if (bz) {
      const bx = m.x + bz.x * m.s;
      const by = m.y + bz.y * m.s;
      const col = s.bossFury ? 0xff5040 : 0xe8dcc0;
      g.lineStyle(1.5, col, 0.9).strokeCircle(bx, by, 6);
      g.lineBetween(bx - 3, by - 3, bx + 3, by + 3).lineBetween(bx - 3, by + 3, bx + 3, by - 3);
    }
    // 開過的寶箱：灰色小方塊（沒開的不畫，留給玩家自己找）
    for (const c of STAGES[this.stageId]?.chests ?? []) {
      if ((s.chestsOpened ?? []).includes(c.id)) g.fillStyle(0x8a8070, 0.8).fillRect(m.x + c.x * m.s - 2, m.y + c.y * m.s - 2, 4, 4);
    }
    for (const e of enemiesOf(s)) {
      const elite = e.tier === 'elite' || ENEMIES[e.defId]?.boss;
      g.fillStyle(e.mode === 'combat' ? 0xff5a4a : elite ? 0xffa040 : 0xc06a6a, e.mode === 'dormant' ? 0.5 : 0.95).fillCircle(m.x + e.x * m.s, m.y + e.y * m.s, elite ? 3.5 : 2.2);
    }
    // 地上的精良以上裝備（D-100）：稀有度顏色的閃爍菱形，免得錯過
    for (const it of s.ground ?? []) {
      if (it.kind !== 'gear' || (it.rarity ?? 1) < 2) continue;
      const gx = m.x + it.x * m.s;
      const gy = m.y + it.y * m.s;
      const r = 3 + Math.sin(now / 150) * 1.2;
      g.fillStyle(RARITY_COLOR[it.rarity ?? 2], 1).fillPoints([{ x: gx, y: gy - r - 1 }, { x: gx + r, y: gy }, { x: gx, y: gy + r + 1 }, { x: gx - r, y: gy }], true);
    }
    if (s.moveGoal) g.fillStyle(0x9fd8ff, 0.9).fillCircle(m.x + s.moveGoal.x * m.s, m.y + s.moveGoal.y * m.s, 2.5);
    const p = playerOf(s);
    g.fillStyle(0xffffff, 1).fillCircle(m.x + p.x * m.s, m.y + p.y * m.s, 3.5);
    g.lineStyle(1.5, 0x9fd8ff, 0.5 + 0.5 * Math.sin(now / 250)).strokeCircle(m.x + p.x * m.s, m.y + p.y * m.s, 6);
  }

  private drawUi(): void {
    const g = this.ui.clear();
    const s = this.s;
    const p = playerOf(s);
    this.drawMinimap(g);
    // ☰ 上的小紅點：行囊裡有比身上好的裝備（D-093）
    if (this.tracked && this.bagSt.bag.some((x) => isUpgrade(this.bagSt, x))) {
      g.fillStyle(0xff4a4a, 1).fillCircle(GAME_WIDTH - 22, 22, 9);
      g.lineStyle(2, 0xffffff, 0.9).strokeCircle(GAME_WIDTH - 22, 22, 9);
    }
    // 地圖怪關卡：附近沒有戰鬥中的怪時提示「點怪物開打」（D-073）
    const es = enemiesOf(s);
    const calm = es.length > 0 && !es.some((e) => e.mode === 'combat') && es.some((e) => e.mode === 'idle' || e.mode === 'dormant');
    this.hud.setText(`${s.prog ? `Lv ${s.prog.level}　` : ''}HP ${p.hp}/${p.maxHp}　MP ${p.mp}　${s.loot ? `${s.enhance?.level ? `武器 +${s.enhance.level}　` : ''}金 ${s.loot.gold ?? 0}　粉塵 ${s.loot.dust ?? 0}` : `敵人 ${es.length}`}　${clock(s.tick)}`);
    if (this.goal) {
      const st = STAGES[this.stageId]!;
      const bossDef = st.enemies.map((e) => ENEMIES[e.enemyId]).find((d) => d?.boss);
      const done = !!bossDef && (s.bossKills ?? []).includes(bossDef.id);
      this.goal.setText(bossDef ? (done ? `✔ ${bossDef.name} 已討伐・離開巢穴可再挑戰` : `目標：往北，打倒${bossDef.name}`) : '').setColor(done ? '#9fe8a0' : '#ffd27a');
    }
    const fires = STAGES[this.stageId]?.campfires ?? [];
    const atFire = fires.some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= CAMPFIRE_RULES.safeUnits * UNIT);
    const restTip = fires.length === 0 ? '' : atFire && (p.hp < p.maxHp || s.potions < SWORDSMAN.potion.carry) ? '點營火休息：HP 全滿・補藥水' : !atFire && p.hp * 2 < p.maxHp ? '打不過就退回營火（怪不追進來）' : '';
    this.calmText.setVisible(calm).setText(calm ? restTip || (p.hp < p.maxHp ? '休息中・自動回血　準備好就點怪物開打' : '點怪物開打（一次拉一組）') : '').setAlpha(0.75 + 0.25 * Math.sin(this.time.now / 300));
    // Boss 大血條（畫面上方）
    // 地圖怪關卡：Boss 交戰中才顯示（在遠處待機時不擋畫面）
    const boss = enemiesOf(s).find((e) => ENEMIES[e.defId]?.boss && (!STAGES[this.stageId]?.mapAi || e.mode === 'combat'));
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
    const ids: string[] = [...this.ctl.order, 'dodge'];
    ids.forEach((id, i) => {
      const { x, y } = this.btnPos(i);
      const R = this.btnR(i);
      const cd = id === 'dodge' ? SWORDSMAN.dodge.cooldownTicks : SKILLS[id]!.cooldownTicks;
      const left = Math.max(0, (p.ready[id] ?? 0) - s.tick);
      g.fillStyle(i === 4 ? 0x2a4a6a : 0x3a2a14, 0.95).fillCircle(x, y, R);
      g.lineStyle(3, left ? 0x555566 : i === 4 ? 0x9fd8ff : 0xffd27a, 1).strokeCircle(x, y, R);
      if (this.editing?.pick === i) g.lineStyle(5, 0x7dffb0, 0.6 + 0.4 * Math.sin(this.time.now / 120)).strokeCircle(x, y, R + 8);
      if (left > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / cd), false).fillPath();
      }
      this.btnText[i]!.setText(left > 0 ? `${(left / TICKS_PER_SEC).toFixed(1)}` : i === 4 ? '閃避' : SKILLS[id]!.name);
    });
    // 大招：MP 環（滿 40 才亮）＋冷卻
    {
      const ult = SKILLS.blade_storm!;
      const need = ult.mp ?? 40;
      const { x, y } = this.btnPos(5);
      const R = this.btnR(5);
      const left = Math.max(0, (p.ready['blade_storm'] ?? 0) - s.tick);
      const ok = left === 0 && p.mp >= need;
      const now = this.time.now;
      g.fillStyle(ok ? 0x5a1a3a : 0x2a1420, 0.95).fillCircle(x, y, R);
      g.lineStyle(5, 0x333344, 1).strokeCircle(x, y, R);
      g.lineStyle(5, ok ? 0xff7ad0 : 0xa0507a, 1);
      g.beginPath().arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.mp / need), false).strokePath();
      if (ok) g.lineStyle(3, 0xffd0f0, 0.4 + 0.4 * Math.sin(now / 120)).strokeCircle(x, y, R + 6 + 3 * Math.sin(now / 160));
      if (left > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / ult.cooldownTicks), false).fillPath();
      }
      this.btnText[5]!.setText(left > 0 ? `${(left / TICKS_PER_SEC).toFixed(1)}` : ok ? '劍刃\n風暴' : `MP\n${p.mp}/${need}`);
      this.btnText[5]!.setColor(ok ? '#ffffff' : '#c890b0');
    }
    // 藥水：剩餘數量＋冷卻；血少於 40% 時閃爍提醒
    {
      const { x, y } = this.btnPos(6);
      const R = this.btnR(6);
      const pt = SWORDSMAN.potion;
      const left = Math.max(0, (p.ready['potion'] ?? 0) - s.tick);
      const low = p.hp < p.maxHp * 0.4 && left === 0 && s.potions > 0;
      g.fillStyle(0x3a1414, 0.95).fillCircle(x, y, R);
      g.lineStyle(3, left || !s.potions ? 0x555566 : low && Math.floor(this.time.now / 250) % 2 ? 0xffffff : 0xff6a6a, 1).strokeCircle(x, y, R);
      if (left > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / pt.cooldownTicks), false).fillPath();
      }
      this.btnText[6]!.setText(left > 0 ? `${(left / TICKS_PER_SEC).toFixed(0)}` : `藥水\n×${s.potions}`);
    }
    // MP 條（HP 文字下方）
    {
      const w = 220;
      const x0 = (GAME_WIDTH - w) / 2;
      g.fillStyle(0x000000, 0.6).fillRect(x0 - 2, 96, w + 4, 8);
      g.fillStyle(0xff7ad0, 1).fillRect(x0, 98, (w * p.mp) / SWORDSMAN.mp, 4);
      // 經驗條（D-090）：MP 條正下方，金色
      if (s.prog) {
        g.fillStyle(0x000000, 0.6).fillRect(x0 - 2, 104, w + 4, 6);
        g.fillStyle(0xffe08a, 1).fillRect(x0, 105, Math.min(w, (w * s.prog.xp) / xpToNext(s.prog.level)), 3);
      }
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
      ? `擊殺 ${r.kills}　營火醒來 ${this.s.revives ?? 0} 次\n撿到：金幣 ${this.s.loot?.gold ?? 0}　粉塵 ${this.s.loot?.dust ?? 0}　結晶 ${this.s.loot?.crystal ?? 0}　武器 +${this.s.enhance?.level ?? 0}\n閃避 ${r.dodges}（躲掉 ${r.dodgedHits}）　格擋 ${r.blocks}　藥水 ${r.potionsUsed}`
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
