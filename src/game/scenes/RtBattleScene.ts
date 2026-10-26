// 即時戰鬥試玩場景（除錯入口：?debug&scene=RtBattle&stage=forest_entry；D-063／D-065，design/20 §B8 P1）。
// Phaser 只負責畫 BattleState 與收輸入 → BattleCommand；戰鬥結果全部由 src/core/battle/rt 決定（D-062）。
import Phaser from 'phaser';
import { SFX } from '../../audio/sfx';
import { SKILLS, STAGES } from '../../core/battle/rt/data';
import { activeHazards, attacksOf, createBattle, enemiesOf, isSolidAt, playerDef, playerOf, setBossFury, setGearBonus, setSkillMods, setSkillVariants, skillDef, skillShape, step, ventLeft, xpToNext } from '../../core/battle/rt/engine';
import { RARITY_COLOR, genGear } from '../../core/battle/rt/gear';
import { bonusOf, isUpgrade, openRtBagPanel, type BagState } from '../ui/rtBagPanel';
import { openRtShopPanel } from '../ui/rtShopPanel';
import { coinOf, spendCoin } from '../rtShop';
import { cardSummary, grantCard, openEmberCardPanel, syncChestCards } from '../ui/emberCardPanel';
import { addWithAutoSalvage } from '../rtBag';
import { gearIcon } from '../fx/gearIcons';
import { skillModsOf } from '../rtBag';
import { BOT_PROFILES, PlayerBot, summarize } from '../../core/battle/rt/sim';
import type { BattleCommand, BattleState, Shape, Telegraph, Unit } from '../../core/battle/rt/types';
import { CAMPFIRE_RULES, CHEST_RULES, ELITE_AFFIXES, TICKS_PER_SEC, UNIT, aggroUnitsOf, type EliteAffix } from '../../core/battle/rt/types';

/** 精英詞綴顏色（D-113）：迅捷青、堅韌綠、狂暴紅 */
/** 命中時會在地上長出荊棘的招式（第 23 輪） */
const THORN_ATTACKS = new Set(['queen_lance', 'queen_lance2', 'queen_roots', 'queen_bloom', 'mother_lance', 'mother_roots']);
/** 燼心岩王與黑曜首領（D-125）：命中那一刻地上裂出熔岩（走 thornPending，命中時改呼叫 spawnLava） */
/** 背上畫火焰鬃毛的怪（D-125） */
const FLAME_MANE = new Set(['ember_wolf', 'obsidian_alpha', 'magma_stalker']);
const LAVA_ATTACKS = new Set(['colossus_fissure', 'colossus_fissure2', 'colossus_stomp', 'colossus_quake', 'obs_slam', 'slime_splash', 'magma_burst', 'magma_charge', 'colossus_core_burst']);

/** 星骸守望者的召喚墜星（第 31 輪）：預告畫成藍白色＋從夜空落下的星星，落地時跟地圖的落星一樣爆開 */
const METEOR_ATTACKS = new Set(['sentinel_meteor', 'sentinel_meteor2', 'eclipse_howl']);

function lerpColor(a: number, b: number, t: number): number {
  const m = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

const AFFIX_COLOR: Record<EliteAffix, number> = { swift: 0x5af0ff, tough: 0x9adf6a, frenzy: 0xff5a4a };
import { cellIndex, findPath, gridOf } from '../../core/battle/rt/path';
import { ENEMIES } from '../../core/battle/rt/data';
import { gearName, loadWeapon, nextWeapon, saveWeapon, weaponSetup, WEAPON_NAME } from '../weapon';
import { makeTestWorldStage } from '../../core/battle/rt/maps/testWorld';
import { WORLD_MAPS, worldMap, FINALE_MAP } from '../worldMaps';
import { GAME_HEIGHT, GAME_WIDTH, TALL } from '../config';
import { ACTIONS, BTN_COUNT, JOY_INDEX, buttonPos, buttonR, clampPos, inStickZone, loadControls, saveControls, swapSlots, type RtAction, type RtControls } from '../rtControls';
import { openRtControlsPanel } from '../ui/rtControlsPanel';
import { bountyKill, bountyTargetsOf, cleanBounties } from '../rtBounty';
import { cleanRanks, cleanVariants, mergeMods, rankMods, skillPoints, usedPoints } from '../rtSkills';
import { openRtSkillPanel } from '../ui/rtSkillPanel';
import { EMPTY_SNAP, FURY_UNLOCK, cleanBag, fmtSec, furyUnlocked, loadRecord, nightUnlocked, mergeRun, recordBoss, saveRecord, spend, mapOpen, nextGoal, levelTip, bossKillsOf, walletOf, type RtRecord, type RunSnap } from '../rtRecord';
import { TITLE_FONT, UI_FONT, bigText, floatNumber, shockRing, sparks } from '../fx/feel';
import { Ambient } from '../fx/ambient';
import { loadFinaleStats, playFinale, playPrologue, prologueSeen } from '../ui/finale';
import { choiceOf, loadChoices, makeChoice, saveChoices, shopDiscountPct, SPARE_DISCOUNT, type BossChoice, type ChoicePick } from '../choices';
import { openChoice } from '../ui/choicePanel';
import { openWeaponPick, weaponChosen } from '../ui/weaponPick';
import { loadMemories, MEMORIES, MEMORY_RADIUS, memoriesOf, recall, saveMemories, type Memory } from '../memories';
import { getSettings } from '../settings';
import { drawCardRival, drawMerchant } from '../fx/merchant';
import { CARDS as EMBER_CARDS, CHEST_CARDS, opponentsAt } from '../../core/cards/emberCards';

const STEP_MS = 1000 / TICKS_PER_SEC;
const STAGE_IDS = Object.keys(STAGES);
/** 畫面橫向可見的世界格數 */
const VIEW_UNITS_W = 1050;
/** 世界可視區：標題列下方到畫面底（操作鍵疊在上面） */
const VIEW_TOP = 110;
/** 抉擇的痕跡走近時的一句話（D-157） */
const CHOICE_ECHO: Record<string, string> = {
  'mistwood:spare': '霧裡的小狼，抬頭看了你一眼。',
  'mistwood:take': '石座上，只剩一截冷掉的角根。',
  'thornvale:spare': '白花在荊棘之間，輕輕搖著。',
  'thornvale:take': '斷掉的根鬚，再也沒有長回來。',
  'emberrift:spare': '燼心還在跳，像是在跟你打招呼。',
  'emberrift:take': '岩石冷冰冰的，一點光都沒有。',
  'starfall:spare': '夜空的星座，在你頭頂閃了一下。',
  'starfall:take': '這裡曾經嵌著一顆星，現在只剩空空的凹槽。',
};
const VIEW_BOTTOM = GAME_HEIGHT;
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
  shade_wolf: { key: 'enemy_mist_wolf', h: 3.0, flip: true, tint: 0xa88aff },
  thorn_shooter: { key: 'enemy_thorn_shroom', h: 2.9, flip: false },
  thorn_mother: { key: 'enemy_thorn_shroom', h: 2.6, flip: false, tint: 0x8fe07a },
  wolf_king: { key: 'enemy_boss_wolfking', h: 3.0, flip: false },
  // 荊棘谷（D-114）：先用現有立繪染色，之後有圖再換（ART_REQUESTS）
  thorn_wolf: { key: 'enemy_mist_wolf', h: 2.9, flip: true, tint: 0x9fe08a },
  thorn_queen: { key: 'enemy_boss_wolfking', h: 3.2, flip: false, tint: 0xb8f0a0 },
  night_thorn_alpha: { key: 'enemy_mist_wolf', h: 3.0, flip: true, tint: 0xc890ff },
  thorn_stalker: { key: 'enemy_mist_wolf', h: 3.1, flip: true, tint: 0xff8a5c },
  mist_warden: { key: 'enemy_mist_wolf', h: 3.0, flip: true, tint: 0x7ae8d8 },
  // 燼紅裂谷（D-125）：史萊姆與岩王是程式美術（fx/emberArt.ts），其他先用現有立繪染色
  slag_slime: { key: 'enemy_slag_slime', h: 2.2, flip: false },
  ember_wolf: { key: 'enemy_mist_wolf', h: 2.9, flip: true, tint: 0xffa070 },
  ember_shroom: { key: 'enemy_thorn_shroom', h: 2.9, flip: false, tint: 0xffb080 },
  obsidian_alpha: { key: 'enemy_mist_wolf', h: 3.0, flip: true, tint: 0x9a8aa8 },
  ember_colossus: { key: 'enemy_ember_colossus', h: 3.0, flip: true },
  magma_stalker: { key: 'enemy_mist_wolf', h: 3.1, flip: true, tint: 0xff6a3a },
  // 星隕高原（D-138）：守望者與魔像是程式美術（fx/starArt.ts），其他先用現有立繪染色
  star_wolf: { key: 'enemy_mist_wolf', h: 2.9, flip: true, tint: 0x9ab8ff },
  star_shroom: { key: 'enemy_thorn_shroom', h: 2.9, flip: false, tint: 0xb8a8ff },
  crystal_golem: { key: 'enemy_crystal_golem', h: 2.4, flip: false },
  astral_alpha: { key: 'enemy_mist_wolf', h: 3.0, flip: true, tint: 0xe0d0ff },
  star_sentinel: { key: 'enemy_star_sentinel', h: 3.1, flip: true },
  comet_stalker: { key: 'enemy_mist_wolf', h: 3.1, flip: true, tint: 0xc8e0ff },
  eclipse_wolf: { key: 'enemy_mist_wolf', h: 3.1, flip: true, tint: 0x7a5aff },
};
const HINT_KEY = 'jg_rt_hint_seen';
/** 巡邏怪的仇恨圈／視線顏色（D-117） */
const PATROL_COLOR: Record<string, number> = { thorn_stalker: 0xff8a5c, shade_wolf: 0xa88aff, mist_warden: 0x6ae8d0, magma_stalker: 0xff5a2a, comet_stalker: 0x8ab0ff, eclipse_wolf: 0x9a7aff };
/** 懸賞名稱：兩張地圖共用（D-114，棘背狼算野狼、狼后算狼王） */
const BOUNTY_LABEL: Record<string, string> = { wolf: '野狼／棘背狼／燼鬃狼／星痕狼', wolf_king: '狼王／狼后／岩王／守望者', thorn_shooter: '荊棘射手／燼芯菇／星芒菇', alpha_wolf: '首領級精英' };
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
  /** Boss 倒下的慢動作（第 29 輪）：剩餘毫秒，期間戰鬥以 0.3 倍速前進 */
  private slowMs = 0;
  /** 鏡頭（世界座標，鏡頭中心） */
  private camX = 0;
  private camY = 0;
  private dotNum = new Map<number, { t: Phaser.GameObjects.Text; at: number; sum: number; skill: string }>();
  private lastBowSfx = 0;
  private hint: Phaser.GameObjects.Container | null = null;
  /** 已播過特效的技能段（`施放 tick:段`） */
  private fxDone = new Set<string>();
  /** 選單開著＝暫停 */
  private menu: Phaser.GameObjects.Container | null = null;
  private botName: string | null = null;
  private lastWarnTick = -1;
  private blinkHinted = new Set<string>();
  /** 玩家有沒有主動點過怪／按過技能（刷怪關 30 秒沒動作就提示） */
  private engaged = false;
  /** 精英／Boss 邊緣箭頭的距離字（物件池） */
  private arrowLabels: Phaser.GameObjects.Text[] = [];
  /** 營火光暈（預先烘好的放射漸層，ADD 混色；每幀只改位置與縮放） */
  private glows: Phaser.GameObjects.Image[] = [];
  /** 大地圖目標列（沒有就 null） */
  private goal: Phaser.GameObjects.Text | null = null;
  private goalDone = false;
  /** HUD 的金幣＝錢包（上次存檔時）＋這場還沒存的（D-116 行商之後金幣是能花的錢） */
  private coinBase = -1;
  private leftFire = false;
  /** true＝先不跳一次性提示：開場大字（y 760）還在、或上一個提示還沒消失（用場景時鐘，和 bigText 補間同步） */
  private tipBusy = false;
  /** 荊棘巡獵者的腳印（D-117，純畫面）：世界座標＋朝向＋留下的時間 */
  private paws: { x: number; y: number; a: number; t: number; side: number }[] = [];
  /** 每隻巡邏怪上一個腳印的位置（unit id → 位置） */
  private pawLast = new Map<number, { x: number; y: number; side: number }>();
  private tipsDone = new Set<string>();
  private fireHinted = false;
  /** 前 3 次進大地圖才顯示的引導 */
  private newbie = false;
  private dustBase = 0;
  private goalAt = 0;
  private goalNext = '';
  /** 地面長出的荊棘（狼后／母樹的毒刺、根系環、綻放命中時；只是畫面） */
  private thornFx: { x: number; y: number; born: number; size: number; seed: number; wither?: number }[] = [];
  /** 霜旋（D-121）在地上留下的冰晶與結霜圈（純畫面，世界座標） */
  private frostG!: Phaser.GameObjects.Graphics;
  private frostFx: { x: number; y: number; born: number; size: number; seed: number; ring?: number }[] = [];
  private thornPending: Telegraph[] = [];
  /** 碎甲（D-121 演出收尾，第 26 輪）：每隻怪上一次看到的破甲結束 tick；變大＝剛被破甲 → 盾片碎裂 */
  private breakSeen = new Map<number, number>();
  /** 影步殘影（第 26 輪）：上一次留下分身的時間 */
  private ghostAt = 0;
  private bountyTxt: Phaser.GameObjects.Text | null = null;
  /** 還沒點的技能點（☰ 紅點用；升級與改動時更新） */
  private ptsLeft = 0;
  /** 目前所在地區（StageDefinition.zones）；換區時顯示名稱 */
  private zoneName: string | null = null;
  /** 這場已經提示過隱藏精英 */
  private streakHinted = false;
  /** 這場已經提示過 Boss 弱點 */
  private bossMemo = false;
  /** 已經提示過「有點熟悉」的寶箱 */
  private chestHinted = new Set<string>();
  /** 前世的記憶（D-137）：這張圖還沒想起來的記憶點 */
  private memLeft: Memory[] = [];
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
    // 正式大地圖：霧語森林（D-085）、荊棘谷（D-114）
    const wm = worldMap(this.stageId);
    if (wm && !STAGES[wm.id]) STAGES[wm.id] = wm.make();
    if (!STAGES[this.stageId]) this.stageId = 'forest_entry';
    this.seed = data.seed ?? Number(q.get('seed') ?? 1);
    const b = (data.bot !== undefined ? data.bot : q.get('bot')) as keyof typeof BOT_PROFILES | null;
    this.bot = b && BOT_PROFILES[b] ? new PlayerBot({ ...BOT_PROFILES[b], ult: true, potionAtPct: b === 'auto' ? undefined : 35, ...(wm ? { campfireBelowPotions: 8, advanceTo: wm.bossAt } : {}) }, b) : null;
    this.botName = this.bot ? b : null;
    this.ventHit.clear();
    this.ventKills = 0;
  }

  create(): void {
    // Bot 示範也帶著玩家的等級與裝備（只讀、不存）
    const big = !!STAGES[this.stageId]?.bossZone && !!STAGES[this.stageId]?.spawnGroups?.length && !!worldMap(this.stageId);
    const rec0 = this.tracked || big ? loadRecord(this.stageId) : {};
    this.bagSt = this.tracked || big ? cleanBag(rec0) : { bag: [], equip: {} };
    this.runSalt = (((rec0.runs ?? 0) + 1) * 2654435761 + this.seed * 40503) >>> 0;
    this.s = createBattle({ stageId: this.stageId, seed: this.seed, level: rec0.level, xp: rec0.xp, bonus: this.tracked || big ? bonusOf(this.bagSt) : undefined, skillMods: this.tracked ? mergeMods(skillModsOf(this.bagSt), rankMods(cleanRanks(rec0.skills, rec0.level ?? 1))) : big ? skillModsOf(this.bagSt) : undefined, skillVariants: this.tracked ? cleanVariants(rec0.variants, cleanRanks(rec0.skills, rec0.level ?? 1)) : undefined, night: this.tracked && !!rec0.night && nightUnlocked(rec0), weapon: this.tracked || worldMap(this.stageId) ? weaponSetup(loadWeapon()) : undefined });
    this.ctl = loadControls();
    this.saved = EMPTY_SNAP;
    this.bossTimed = false;
    this.editing = null;
    if (this.tracked) {
      // 正式大地圖（D-087）：沒有時間限制（核心的 timeLimitTicks 只給模擬器用）；開過的寶箱下次是空箱
      this.s.timeLimitTicks = 24 * 3600 * TICKS_PER_SEC;
      const rec = loadRecord(this.stageId);
      const valid = new Set((STAGES[this.stageId]?.chests ?? []).filter((c) => !c.nightOnly).map((c) => c.id));
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
    this.slowMs = 0;
    this.engaged = false;
    this.idleHinted = false;
    this.afterChoice = [];
    this.choiceMarkSaid = false;
    { const p0 = playerOf(this.s); const kinds: Record<string, 'cub' | 'flower' | 'wisp' | 'star'> = { mistwood: 'cub', thornvale: 'flower', emberrift: 'wisp', starfall: 'star' }; const kind = kinds[this.stageId]; this.cub = this.tracked && !this.bot && kind && loadChoices()[this.stageId] === 'spare' ? { x: p0.x - UNIT, y: p0.y + UNIT, a: 0, t: 0, face: 1, kind } : null; }
    { const bz = STAGES[this.stageId]?.bossZone; const cp = loadChoices()[this.stageId]; this.choiceMark = bz && cp && this.tracked ? { x: bz.x + UNIT * 1.6, y: bz.y + UNIT * 1.2, map: this.stageId, pick: cp } : null; }
    this.zoneName = null;
    this.chestHinted = new Set();
    this.bossMemo = false;
    this.cameras.main.setZoom(1); // 保險：舊版 Boss 登場會推鏡頭
    this.blinkHinted = new Set(); // 場景重開不會重跑欄位初始值
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
    this.frostG = this.add.graphics().setDepth(9); // 霜旋的冰晶（在單位底下、地面之上）
    this.top = this.add.graphics().setDepth(45);
    this.ui = this.add.graphics().setDepth(50);
    // 頂部標題列（蓋在世界之上；底部漸層避免硬切）
    const hdr = this.add.graphics().setDepth(48);
    hdr.fillStyle(0x0b1410, 0.94).fillRect(0, 0, GAME_WIDTH, VIEW_TOP);
    for (let i = 0; i < 12; i++) hdr.fillStyle(0x0b1410, 0.6 * (1 - i / 12)).fillRect(0, VIEW_TOP + i * 2, GAME_WIDTH, 2);
    // 深夜（D-103）：整個畫面壓暗、偏藍
    this.nightShade = this.s.night ? this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.nightTexture()).setDisplaySize(3200, 3200).setDepth(42) : null;
    // 環境粒子（第 27 輪）：大地圖才有；光塵／螢火蟲、花瓣孢子、火星灰燼
    const amb = worldMap(this.stageId);
    this.ambient = amb ? new Ambient(this, amb.decor, getSettings().lowFx, !!this.s.night, { x: 0, y: VIEW_TOP, w: GAME_WIDTH, h: VIEW_BOTTOM - VIEW_TOP }) : null;
    this.add.text(GAME_WIDTH / 2, 40, this.tracked || worldMap(this.stageId) ? `${STAGES[this.stageId]!.name}${this.s.night ? '・深夜' : ''}` : `即時戰鬥試玩・${STAGES[this.stageId]!.name}`, { fontFamily: TITLE_FONT, fontSize: '30px', color: '#ffd27a' }).setOrigin(0.5).setDepth(49);
    this.calmText = this.add.text(GAME_WIDTH / 2 - 50, 850, '', { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#ffd27a', stroke: '#000', strokeThickness: 4, backgroundColor: '#00000088' }).setPadding(14, 6, 14, 6).setOrigin(0.5).setDepth(65);
    this.hud = this.add.text(GAME_WIDTH / 2, 82, '', { fontFamily: UI_FONT, fontSize: '18px', color: '#c8d0f0' }).setOrigin(0.5).setDepth(49);
    // 大地圖（有 Boss 又有重生點）：HUD 下方的目標列
    const stG = STAGES[this.stageId];
    if (this.s.night && this.tracked && STAGES[this.stageId]?.chests?.some((c) => c.nightOnly)) {
      this.time.delayedCall(3200, () => bigText(this, GAME_WIDTH / 2, 600, '深夜：遠處的藍色光柱是夜光寶箱\n（每次進深夜都會補滿）', '#bfe0ff', 30, 2200));
      // 深夜的山谷（D-115）：毒沼擴散＋多兩灘
      if (STAGES[this.stageId]?.hazards?.some((h) => h.nightOnly || h.nightR)) this.time.delayedCall(5600, () => bigText(this, GAME_WIDTH / 2, 600, '深夜的毒沼擴散了\n荊棘坡與迴廊也冒出新的毒沼', '#a8f08a', 30, 2200));
      // 深夜的裂谷（D-125）：噴發口更頻繁＋熔核巡者
      // 深夜的高原（D-138）：星星落得更頻繁
      if (STAGES[this.stageId]?.vents?.some((v) => v.nightEveryTicks)) this.time.delayedCall(5600, () => (this.starMap ? bigText(this, GAME_WIDTH / 2, 600, '深夜的星星落得更頻繁\n晶簇林有「星蝕狼」在巡邏', '#c8d8ff', 30, 2200) : bigText(this, GAME_WIDTH / 2, 600, '深夜的熔岩口噴得更頻繁\n熔渣坡有「熔核巡者」在巡邏', '#ffb36a', 30, 2200)));
    }
    // 營地懸賞（D-109）：小地圖下方小字，完成自動領獎
    this.bountyTxt = this.tracked ? this.add.text(10, VIEW_TOP + 212, '', { fontFamily: UI_FONT, fontSize: '17px', color: '#e8dcc0', backgroundColor: 'rgba(0,0,0,0.5)', lineSpacing: 2 }).setPadding(8, 4, 8, 4).setOrigin(0, 0).setDepth(49) : null;
    this.refreshBounty();
    this.ptsLeft = this.tracked ? this.skillPointsLeft() : 0;
    this.goalDone = false; this.goalAt = 0; this.goalNext = '';
    this.coinBase = this.tracked ? coinOf(loadRecord(this.stageId)) : -1;
    this.leftFire = false;
    this.fireHinted = false;
    this.newbie = this.tracked && (loadRecord(this.stageId).runs ?? 0) <= 3;
    this.dustBase = this.tracked ? walletOf(loadRecord(this.stageId)).dust : 0;
    this.thornFx = []; this.thornPending = []; this.frostFx = [];
    this.breakSeen.clear(); this.ghostAt = 0;
    this.goal = stG?.bossZone && stG.spawnGroups?.length ? this.add.text(GAME_WIDTH / 2, 95, '', { fontFamily: UI_FONT, fontSize: '20px', fontStyle: '700', color: '#ffd27a', backgroundColor: 'rgba(0,0,0,0.55)', align: 'center', lineSpacing: 4 }).setPadding(12, 3, 12, 3).setOrigin(0.5, 0).setDepth(49) : null;
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
    // 第 26 輪：開場一次只出一件事——有開場大字時，操作說明框等大字消失（3.6 秒）再出，不再五段文字疊在一起
    this.hint = null; // 場景重開時上一場的說明框已被銷毀
    this.tipBusy = false; // 場景重啟不會重建物件：上一場排的 delayedCall 已被清掉，要手動歸零
    this.paws = [];
    this.pawLast.clear();
    { const have = loadMemories(); this.memLeft = this.tracked && !this.bot ? memoriesOf(this.stageId).filter((m) => !have.includes(m.id)) : []; }
    // 序章（D-134）：第一次進第一張大地圖先播前世的故事，播完才開始開場說明
    if (!this.bot && this.stageId === WORLD_MAPS[0]!.id && !prologueSeen()) {
      this.tipBusy = true;
      this.menu = playPrologue(this, () => {
        this.menu = null;
        this.acc = 0;
        if (weaponChosen()) return this.opening();
        // 第一次冒險：選武器（D-150）。選長弓要重新進入地圖（戰鬥數值是開場算好的），序章已看過所以直接開場
        this.menu = openWeaponPick(this, (w) => {
          this.menu = null;
          saveWeapon(w);
          if (w !== (this.s.weapon ?? 'sword')) this.scene.restart({ stage: this.stageId, seed: this.seed, bot: '' });
          else {
            this.acc = 0;
            this.opening();
          }
        });
      });
    } else this.opening();
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
    const names = [...this.ctl.order.map((id) => ((this.s ? skillDef(this.s, id) : undefined) ?? SKILLS[id])!.name), '閃避', '大招', '藥水'];
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
    if (this.cardBtn?.visible && this.cardBtn.getBounds().contains(p.x, p.y)) return;
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
    let dt = Math.min(delta, 250);
    if (this.slowMs > 0) {
      this.slowMs = Math.max(0, this.slowMs - dt);
      dt *= 0.3;
    }
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
    this.ambient?.update(dt, this.ox, this.oy);
    this.draw();
    this.idleHint();
    this.zoneBanner();
    this.updateFireBtn();
    this.chestHint();
    this.memoryCheck();
    this.streakHint();
    if (this.s.tick % (10 * TICKS_PER_SEC) === 0) this.persist();
    if (this.s.outcome !== 'running') this.finish();
  }

  /** 怪被噴發口燒死（第 27 輪）：橘色「燒死了！」＋火星往上竄；這趟第 1、3、6、10… 隻再出一行大字（連燒計數） */
  private ventKill(x: number, y: number): void {
    this.ventKills++;
    const n = this.ventKills;
    const vx = this.sx(x);
    const vy = this.sy(y);
    const st = this.starMap; // 星隕高原（D-138）：被星星砸死
    floatNumber(this, vx, vy - 56, st ? (n > 1 ? `砸死了！×${n}` : '砸死了！') : n > 1 ? `燒死了！×${n}` : '燒死了！', { color: st ? '#c8d8ff' : '#ffb050', size: 34 });
    sparks(this, vx, vy - 10, 16, 'ember', st ? 0x8aa8ff : 0xffc060, 760);
    sparks(this, vx, vy - 30, 8, 'spark', st ? 0xe0e8ff : 0xfff0b0, 900);
    if (this.bot) return;
    if (n === 1) bigText(this, GAME_WIDTH / 2, 430, st ? '引到落星底下砸扁了！' : '引進噴口燒掉了！', st ? '#c8d8ff' : '#ffc070', 36, 900);
    else if ([3, 6, 10, 15, 20, 30, 50].includes(n)) bigText(this, GAME_WIDTH / 2, 430, st ? `落星已砸死 ${n} 隻！` : `噴口已燒死 ${n} 隻！`, st ? '#c8d8ff' : '#ffc070', 36, 900);
  }

  // ---------- 大地圖獨立紀錄（D-087） ----------
  /** 這張地圖有沒有跨場紀錄（有 Boss 巢穴的刷怪大地圖） */
  private hazardHinted = false;
  private ventHinted = false;
  /** 這張圖的噴發口是墜星（D-138，星隕高原） */
  private get starMap(): boolean {
    return worldMap(this.stageId)?.decor === 'star';
  }
  private ambient: Ambient | null = null;
  /** 噴發口燒死的回饋（第 27 輪）：被噴發口打到的怪 id → tick；這趟燒死幾隻 */
  private ventHit = new Map<number, number>();
  private ventKills = 0;
  private bloomHinted = false;
  private meteorHinted = false;
  /** 這張地圖的 Boss 與地形稱呼（D-114）：霧語森林＝狼王／森林、荊棘谷＝狼后／山谷 */
  private get bw(): string {
    return worldMap(this.stageId)?.bw ?? '狼王';
  }
  private get mw(): string {
    return worldMap(this.stageId)?.mw ?? '森林';
  }
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
    this.coinBase = coinOf(rec);
    this.dustBase = walletOf(rec).dust;
  }

  // ---------- 技能點（D-110） ----------
  /** 裝備特效＋技能點（只有正式大地圖才有技能點） */
  private allMods(st: Parameters<typeof skillModsOf>[0]): ReturnType<typeof skillModsOf> {
    if (!this.tracked) return skillModsOf(st);
    return mergeMods(skillModsOf(st), rankMods(cleanRanks(loadRecord(this.stageId).skills, this.s.prog?.level ?? 1)));
  }

  private skillPointsLeft(): number {
    const lv = this.s.prog?.level ?? 1;
    return skillPoints(lv) - usedPoints(cleanRanks(loadRecord(this.stageId).skills, lv));
  }

  private openSkills(): void {
    this.persist();
    this.menu?.destroy();
    const lv = this.s.prog?.level ?? 1;
    this.menu = openRtSkillPanel(
      this,
      cleanRanks(loadRecord(this.stageId).skills, lv),
      this.s.skillVariants ?? [],
      lv,
      (r, v) => {
        saveRecord(this.stageId, { ...loadRecord(this.stageId), skills: r, variants: v });
        setSkillMods(this.s, this.allMods(this.bagSt));
        setSkillVariants(this.s, v);
        this.ptsLeft = this.skillPointsLeft();
      },
      () => {
        this.menu?.destroy();
        this.menu = null;
        this.toggleMenu();
      },
      this.s.weapon ?? 'sword',
    );
  }

  // ---------- 營地懸賞（D-109） ----------
  private refreshBounty(): void {
    if (!this.bountyTxt) return;
    const st = cleanBounties(loadRecord(this.stageId).bounty);
    // 懸賞三張地圖共用：這張地圖打不到的目標標「別張地圖」（例：燼紅裂谷沒有荊棘母樹）
    const stg = STAGES[this.stageId];
    const here = bountyTargetsOf([...(stg?.spawnGroups ?? []).map((g) => g.enemyId), ...(stg?.enemies ?? []).map((e) => e.enemyId)]);
    this.bountyTxt.setText(['懸賞', ...st.list.map((b) => `${BOUNTY_LABEL[b.target] ?? ENEMIES[b.target]?.name ?? b.target} ${b.got}/${b.need}${here.has(b.target) ? '' : '（別張地圖）'}`)].join('\n'));
  }

  private bountyKill(defId: string): void {
    if (!this.tracked) return;
    const rec = loadRecord(this.stageId);
    const st = cleanBounties(rec.bounty);
    const r = bountyKill(st, defId);
    if (r.st === st) return;
    let out: RtRecord = { ...rec, bounty: r.st };
    r.completed.forEach((b, i) => {
      out = spend(out, -b.reward.dust, -b.reward.crystal) ?? out;
      const name = ENEMIES[b.target]?.name ?? b.target;
      const got = [b.reward.dust ? `粉塵 +${b.reward.dust}` : '', b.reward.crystal ? `結晶 +${b.reward.crystal}` : ''].filter(Boolean).join('・');
      this.time.delayedCall(600 + i * 1400, () => {
        SFX.itemGet();
        bigText(this, GAME_WIDTH / 2, 430, `懸賞完成！${name} ×${b.need}\n${got}`, '#ffe08a', 36, 1200);
      });
    });
    saveRecord(this.stageId, out);
    this.dustBase = walletOf(out).dust;
    this.refreshBounty();
    if (r.completed.length && this.bountyTxt) this.tweens.add({ targets: this.bountyTxt, scale: 1.12, duration: 160, yoyo: true });
  }

  // ---------- 裝備（D-091） ----------
  /** 撿到裝備：用種子產生數值、放進行囊、立刻存檔；稀有以上大字 */
  private gotGear(itemId: number, rarity: 1 | 2 | 3, ilvl: number): void {
    if (!this.tracked) return;
    this.time.delayedCall(900, () => this.tipOnce('jg_tip_gear', '撿到裝備了！☰「行囊」或營火旁可以換上', '#9fe8a0'));
    const p = playerOf(this.s);
    const g = genGear((Math.imul(this.runSalt, 31) + itemId * 2246822519) >>> 0, rarity, ilvl, { night: !!this.s.night, region: this.stageId });
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
      if (w) {
        saveRecord(this.stageId, w);
        this.dustBase = walletOf(w).dust;
      }
      floatNumber(this, this.sx(p.x), this.sy(p.y) - 150, `行囊滿・自動分解 ${gearName(r.salvaged)} +${r.dust} 粉塵`, { color: '#c8c0a8', size: 20 });
      if (r.salvaged.uid === g.uid) return;
    }
    const col = `#${RARITY_COLOR[rarity].toString(16).padStart(6, '0')}`;
    // 撿到的裝備圖示從主角頭上飄起來（D-101）
    const icon = this.add.container(this.sx(p.x), this.sy(p.y) - 70, gearIcon(this, 0, 0, g.slot, rarity, rarity >= 3 ? 64 : 48)).setDepth(70);
    this.tweens.add({ targets: icon, y: icon.y - 90, duration: 900, ease: 'Cubic.Out' });
    this.tweens.add({ targets: icon, alpha: 0, delay: 700, duration: 400, onComplete: () => icon.destroy(true) });
    if (rarity >= 3) {
      SFX.perfect();
      bigText(this, GAME_WIDTH / 2, 560, `${g.night ? '深夜的稀有！' : '稀有裝備！'}\n${gearName(g)}`, g.night ? '#b8a8ff' : col, 44, 1200);
    } else {
      SFX.confirm();
      floatNumber(this, this.sx(p.x), this.sy(p.y) - 120, gearName(g), { color: col, size: rarity === 2 ? 28 : 24 });
    }
    if (!this.gearTipShown) {
      this.gearTipShown = true;
      this.time.delayedCall(900, () => bigText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, '撿到裝備了！☰ → 行囊 可以換上', '#9fd8ff', 30, 1800));
    }
  }
  private gearTipShown = false;
  /** 營火旁的「行囊・強化」捷徑（D-093） */
  private shopBtn: Phaser.GameObjects.Text | null = null;
  private fireBtn: Phaser.GameObjects.Text | null = null;

  private makeFireBtn(): void {
    this.fireBtn = null;
    this.shopBtn = null;
    this.cardBtn = null;
    if (!this.tracked) return;
    const b = this.add.text(GAME_WIDTH / 2 - 95, 960 + TALL, '行囊・強化', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: '#1a0f08', backgroundColor: '#ffd27a' }).setOrigin(0.5).setPadding(20, 10, 20, 10).setDepth(62).setVisible(false).setInteractive({ useHandCursor: true });
    b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (this.menu || this.editing || this.ended) return;
      SFX.uiTap();
      this.stick = null;
      this.openBag(false);
    });
    this.fireBtn = b;
    // 營火行商（D-116）
    const sb = this.add.text(GAME_WIDTH / 2 + 125, 960 + TALL, '行商', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: '#1a0f08', backgroundColor: '#9fe8a0' }).setOrigin(0.5).setPadding(20, 10, 20, 10).setDepth(62).setVisible(false).setInteractive({ useHandCursor: true });
    sb.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (this.menu || this.editing || this.ended) return;
      SFX.uiTap();
      this.stick = null;
      this.openShop();
    });
    this.shopBtn = sb;
    // 燼牌捷徑（D-129）：營火旁直接找人打牌（在地對手坐在營火另一邊）
    const cb = this.add.text(88, 960 + TALL, '燼牌', { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#1a0f08', backgroundColor: '#ffb36a' }).setOrigin(0.5).setPadding(16, 10, 16, 10).setDepth(62).setVisible(false).setInteractive({ useHandCursor: true });
    cb.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (this.menu || this.editing || this.ended) return;
      SFX.uiTap();
      this.stick = null;
      this.persist();
      this.openCards(true);
    });
    this.cardBtn = cb;
  }
  private cardBtn: Phaser.GameObjects.Text | null = null;

  private openShop(): void {
    this.persist(); // 這場剛撿的金幣先算進錢包
    this.menu?.destroy();
    this.fireBtn?.setVisible(false);
    this.shopBtn?.setVisible(false);
    this.cardBtn?.setVisible(false);
    this.menu = openRtShopPanel(
      this,
      {
        rec: () => loadRecord(this.stageId),
        save: (r) => {
          saveRecord(this.stageId, r);
          this.coinBase = coinOf(r);
          this.dustBase = walletOf(r).dust;
        },
        bag: () => this.bagSt,
        setBag: (st) => {
          this.bagSt = st;
          this.saveBag();
          setGearBonus(this.s, bonusOf(st));
          setSkillMods(this.s, this.allMods(st));
        },
        level: this.s.prog?.level ?? 1,
        region: this.stageId,
        onCards: () => this.openCards(),
      },
      () => {
        this.menu?.destroy();
        this.menu = null;
        this.acc = 0;
      },
    );
  }

  /** 營火燼牌（D-127）：從行商面板進來，離開回到行商；從營火「燼牌」捷徑進來就直接關掉 */
  private openCards(fromFire = false): void {
    this.menu?.destroy();
    this.fireBtn?.setVisible(false);
    this.shopBtn?.setVisible(false);
    this.cardBtn?.setVisible(false);
    // 以前就開過的寶箱補發燼牌（D-131）
    syncChestCards(WORLD_MAPS.flatMap((m) => loadRecord(m.id).chests ?? []));
    this.menu = openEmberCardPanel(
      this,
      {
        map: this.stageId,
        closeLabel: fromFire ? '回營火' : undefined,
        coin: () => coinOf(loadRecord(this.stageId)),
        pay: (n) => {
          const r = spendCoin(loadRecord(this.stageId), n);
          if (!r) return;
          saveRecord(this.stageId, r);
          this.coinBase = coinOf(r);
        },
      },
      () => {
        if (!fromFire) return this.openShop();
        this.menu?.destroy();
        this.menu = null;
        this.acc = 0;
      },
    );
  }

  private updateFireBtn(): void {
    const b = this.fireBtn;
    if (!b) return;
    const p = playerOf(this.s);
    const near = !p.dead && (STAGES[this.stageId]?.campfires ?? []).some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= CAMPFIRE_RULES.safeUnits * UNIT);
    const up = near && this.bagSt.bag.some((g) => isUpgrade(this.bagSt, g));
    b.setVisible(near && !this.menu).setText(up ? '行囊・強化 ▲' : '行囊・強化');
    this.shopBtn?.setVisible(near && !this.menu);
    this.cardBtn?.setVisible(near && !this.menu);
    // 新手引導（第 23 輪）：前幾次進地圖、第一次離開營火又回來時說明營火能做什麼（開場就在營火旁，所以等「回來」才提示）
    if (!near) this.leftFire = true;
    else if (this.leftFire && !this.fireHinted && !this.menu && this.newbie) {
      this.fireHinted = true;
      bigText(this, GAME_WIDTH / 2, 600, '回到營火：點火堆＝休息回滿・補藥水\n「行囊・強化」換裝／強化　「行商」用金幣買賣', '#ffe0a0', 26, 2600);
    }
  }

  private saveBag(): void {
    const rec = loadRecord(this.stageId);
    saveRecord(this.stageId, { ...rec, bag: this.bagSt.bag, equip: this.bagSt.equip });
  }

  private openBag(fromMenu = true): void {
    this.persist(); // 這場剛撿的材料先算進錢包
    this.menu?.destroy();
    this.fireBtn?.setVisible(false);
    this.shopBtn?.setVisible(false);
    this.cardBtn?.setVisible(false);
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
        setSkillMods(this.s, this.allMods(st));
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
          this.dustBase = walletOf(r).dust;
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

  /** 深夜：主角身邊亮、越遠越暗的藍黑色暈影（中心透明） */
  private nightShade: Phaser.GameObjects.Image | null = null;
  private nightTexture(): string {
    const key = 'rt_night_shade';
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, 512, 512);
    if (!tex) return key;
    const ctx = tex.getContext();
    const gr = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gr.addColorStop(0, 'rgba(6,10,36,0)');
    gr.addColorStop(0.1, 'rgba(6,10,36,0.04)');
    gr.addColorStop(0.28, 'rgba(6,10,36,0.4)');
    gr.addColorStop(0.5, 'rgba(6,10,36,0.58)');
    gr.addColorStop(1, 'rgba(6,10,36,0.66)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 512, 512);
    tex.refresh();
    return key;
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
      if (fury && r.rec.furyKills === 1 && STAGES[this.stageId]?.night) this.time.delayedCall(4600, () => bigText(this, GAME_WIDTH / 2, 600, `解鎖：深夜的${this.mw}！\n☰ 暫停選單・怪更兇、掉得更好`, '#9fb8ff', 34, 2600));
      const nx = worldMap(worldMap(this.stageId)?.next ?? '');
      // 討伐後的抉擇（D-157）：還沒選過就跳抉擇面板（舊存檔已經打倒過的，下一次討伐時補問），新地圖／暴怒解鎖的提示等選完再出
      const ch = !this.bot && !fury ? choiceOf(this.stageId) : undefined;
      const pending = !!ch && !loadChoices()[this.stageId];
      const later = (ms: number, fn: () => void): void => {
        if (pending) this.afterChoice.push(fn);
        else this.time.delayedCall(ms, fn);
      };
      if (pending && ch) this.time.delayedCall(4300, () => this.showChoice(ch));
      // 最後一張地圖第一次討伐 → 通關演出（D-133）
      if (r.first && this.stageId === FINALE_MAP && !this.bot) later(5000, () => this.showFinale());
      if (r.first && nx) later(4600, () => bigText(this, GAME_WIDTH / 2, 600, `新地圖開放：${nx.name}！\n回標題選「前往${nx.name}」${nx.recLevel ? `・建議 Lv${nx.recLevel}` : ''}`, '#a8f08a', 34, 3000));
      if (r.rec.bossKills === FURY_UNLOCK.kills && (this.s.prog?.level ?? 1) < FURY_UNLOCK.level && STAGES[this.stageId]?.bossZone?.fury) later(4600, () => this.furyUnlockedToast());
      this.persist();
    }
    const timed = !this.bossTimed;
    this.bossTimed = true;
    this.time.delayedCall(300, () => bigText(this, GAME_WIDTH / 2, 440, `${name} 討伐！`, '#ffd27a', 60, 1800));
    const again = STAGES[this.stageId]?.bossZone?.respawnTicks ? '離開巢穴一會兒，牠會再回來' : '可以繼續刷怪，或從 ☰ 離開';
    const head = first ? (worldMap(this.stageId)?.firstKill ?? '首次討伐！') : fury ? `暴怒的${this.bw}倒下了！看看掉了什麼` : best ? `最快紀錄！${fmtSec(sec)}` : '再次討伐！';
    const sub = `${head}${timed && !best && this.tracked ? `\n本次 ${fmtSec(sec)}` : ''}\n${again}`;
    this.time.delayedCall(1900, () => bigText(this, GAME_WIDTH / 2, 540, sub, '#f4e6c0', 32, 2600));
  }

  /** 抉擇選完之後才出的提示（新地圖開放等） */
  private afterChoice: (() => void)[] = [];
  private choiceMark: { x: number; y: number; map: string; pick: ChoicePick } | null = null;

  /** 討伐後的抉擇（D-157）：戰鬥暫停（當成 menu）；取＝馬上拿結晶、還＝之後行商便宜。有面板開著就晚一點再跳 */
  private showChoice(ch: BossChoice): void {
    if (this.ended) return;
    if (this.menu || this.editing) {
      this.time.delayedCall(1200, () => this.showChoice(ch));
      return;
    }
    if (this.hint) this.dismissHint();
    this.menu = openChoice(this, ch, (pick) => {
      this.menu = null;
      this.acc = 0;
      const c = makeChoice(loadChoices(), this.stageId, pick);
      if (c) {
        saveChoices(c);
        const bz = STAGES[this.stageId]?.bossZone;
        if (bz) this.choiceMark = { x: bz.x + UNIT * 1.6, y: bz.y + UNIT * 1.2, map: this.stageId, pick };
        this.choiceMarkSaid = true;
        if (pick === 'take' && this.tracked) {
          const rec = spend(loadRecord(this.stageId), 0, -ch.take.crystal);
          if (rec) saveRecord(this.stageId, rec);
          SFX.itemGet();
        }
      }
      const p = playerOf(this.s);
      shockRing(this, this.sx(p.x), this.sy(p.y), pick === 'take' ? 0xffb35a : 0x7dd8b0, 260, 700, 8);
      sparks(this, this.sx(p.x), this.sy(p.y), 26, pick === 'take' ? 'ember' : 'spark', pick === 'take' ? 0xffd27a : 0xa8f0c8, 520);
      const extra = pick === 'take' ? `\n+${ch.take.crystal} 結晶` : `\n行商的裝備 −${c ? shopDiscountPct(c) : SPARE_DISCOUNT}%`;
      bigText(this, GAME_WIDTH / 2, 560, `${ch[pick].after}${extra}`, pick === 'take' ? '#ffd27a' : '#a8f0c8', 30, 2600);
      const q = this.afterChoice;
      this.afterChoice = [];
      q.forEach((fn, i) => this.time.delayedCall(3600 + i * 3200, fn));
    });
  }

  /** 開場：地圖說明大字＋操作說明框（序章播完才跑） */
  private opening(): void {
    const st00 = STAGES[this.stageId];
    if (!this.bot) {
      if (st00?.intro || st00?.spawnGroups?.length) this.time.delayedCall(3600, () => this.showHint());
      else this.showHint();
    }
    // 刷怪關的開場說明（怪會重生、營火是安全區）
    const st0 = STAGES[this.stageId];
    this.tipBusy = false;
    if (st0?.intro || st0?.spawnGroups?.length) {
      // 開場大字 0.4 秒出現、約 3.4 秒消失，提示（y 700）等它走了再出
      this.tipBusy = true;
      this.time.delayedCall(3800, () => (this.tipBusy = false));

      const intro = st0.intro ?? '怪物會重生・5 分鐘能打倒幾隻？\n打不過就退回營火（怪不追進來）';
      this.time.delayedCall(400, () => bigText(this, GAME_WIDTH / 2, 760, intro, '#ffd27a', 30, 2600));
    }
  }

  /** Boss 倒下（第 29 輪）：慢動作 1.4 秒＋從屍體放射出的光芒（地圖主色＋金色）慢慢轉、淡出 */
  private bossRays(x: number, y: number, color: number, long = true): void {
    // 第 31 輪：只有第一次討伐（或第一次打倒暴怒版）放滿 1.4 秒；之後刷 Boss 只留 0.45 秒，不拖節奏
    this.slowMs = long ? 1400 : 450;
    const g = this.add.graphics().setDepth(60).setBlendMode(Phaser.BlendModes.ADD).setPosition(x, y);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const len = 520 + (i % 3) * 140;
      const w = 0.06 + (i % 2) * 0.04;
      g.fillStyle(i % 2 ? color : 0xffe6a8, 0.32);
      g.fillTriangle(0, 0, Math.cos(a - w) * len, Math.sin(a - w) * len, Math.cos(a + w) * len, Math.sin(a + w) * len);
    }
    g.fillStyle(0xfff4d8, 0.6).fillCircle(0, 0, 46);
    g.setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: g, scale: 1, alpha: 1, duration: 260, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: g, angle: 24, duration: 2200 });
    this.tweens.add({ targets: g, alpha: 0, delay: 900, duration: 1300, onComplete: () => g.destroy() });
  }

  /** 通關演出（D-133）：戰鬥暫停（當成 menu），按「繼續冒險」回到地圖；有面板開著就晚一點再播 */
  private showFinale(): void {
    if (this.ended) return;
    if (this.menu || this.editing) {
      this.time.delayedCall(1500, () => this.showFinale());
      return;
    }
    this.fireBtn?.setVisible(false);
    this.shopBtn?.setVisible(false);
    this.cardBtn?.setVisible(false);
    this.menu = playFinale(this, loadFinaleStats(), () => {
      this.menu = null;
      this.acc = 0;
      bigText(this, GAME_WIDTH / 2, 560, '地上的戰利品別忘了撿！', '#f4e6c0', 32, 1800);
    });
  }

  /** 隱藏精英的「遊戲記憶」提示：第一次連殺到門檻的 2/3 時出現一次 */
  private streakHint(): void {
    const h = STAGES[this.stageId]?.hiddenElite;
    if (!h || this.streakHinted || this.bot || (this.s.streak ?? 0) < Math.ceil((h.streak * 2) / 3)) return;
    this.streakHinted = true;
    bigText(this, GAME_WIDTH / 2, 600, '（記得……不倒下一直打下去，首領會被引出來……）', '#d8c8ff', 26, 2200);
  }

  /** 前世的記憶（D-137）：走到記憶點旁邊 → 想起一段事、拿結晶（不暫停戰鬥） */
  private memoryCheck(): void {
    if (!this.memLeft.length) return;
    const p = playerOf(this.s);
    if (p.dead) return;
    const i = this.memLeft.findIndex((m) => Math.hypot(m.tx * UNIT + UNIT / 2 - p.x, m.ty * UNIT + UNIT / 2 - p.y) < MEMORY_RADIUS * UNIT);
    if (i < 0) return;
    const mem = this.memLeft.splice(i, 1)[0]!;
    const r = recall(loadMemories(), mem.id);
    if (!r) return;
    saveMemories(r.ids);
    const rec = spend(loadRecord(this.stageId), 0, -r.crystal);
    if (rec) saveRecord(this.stageId, rec);
    SFX.itemGet();
    const x = this.sx(mem.tx * UNIT + UNIT / 2);
    const y = this.sy(mem.ty * UNIT + UNIT / 2);
    sparks(this, x, y, 30, 'spark', 0xd8b0ff, 420);
    shockRing(this, x, y, 0xc89aff, 200, 700, 6);
    this.cameras.main.flash(220, 190, 150, 255);
    // 上方的回憶卡：標題、內容、獎勵；6 秒後淡出
    const c = this.add.container(GAME_WIDTH / 2, 300).setDepth(940).setAlpha(0);
    const body = this.add.text(0, 6, mem.lines, { fontFamily: TITLE_FONT, fontSize: '27px', color: '#f0e6ff', align: 'center', lineSpacing: 10, wordWrap: { width: 600, useAdvancedWrap: true } }).setOrigin(0.5, 0);
    const h = body.height + 120;
    const bg = this.add.graphics();
    bg.fillStyle(0x140a22, 0.9).fillRoundedRect(-320, -56, 640, h, 18);
    bg.lineStyle(2, 0xc89aff, 0.9).strokeRoundedRect(-320, -56, 640, h, 18);
    const head = this.add.text(0, -32, `✦ 前世的記憶　${r.ids.length}/${MEMORIES.length}`, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#c8a0ff' }).setOrigin(0.5);
    const gain = this.add.text(0, h - 80, `+${r.crystal} 結晶${r.all ? '　——所有的記憶都想起來了！' : ''}`, { fontFamily: UI_FONT, fontSize: '22px', color: r.all ? '#ffd27a' : '#a8e8ff' }).setOrigin(0.5);
    c.add([bg, head, body, gain]);
    this.tweens.add({ targets: c, alpha: 1, y: 290, duration: 500, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: r.all ? 8000 : 6000, duration: 700, onComplete: () => c.destroy() });
    if (r.all) this.time.delayedCall(600, () => bigText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, '前世的記憶　全部想起來了', '#d8b0ff', 40, 2200));
  }

  /** ☰「前世的記憶」（D-137）：重讀想起來的記憶；沒想起來的只寫在哪張地圖 */
  private openMemoryBook(): void {
    this.menu?.destroy();
    const have = loadMemories();
    const items: Phaser.GameObjects.GameObject[] = [this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0614, 0.92).setInteractive()];
    items.push(this.add.text(0, -540, `✦ 前世的記憶　${have.length}/${MEMORIES.length}`, { fontFamily: TITLE_FONT, fontSize: '40px', color: '#d8b0ff' }).setOrigin(0.5));
    items.push(this.add.text(0, -488, '地上浮著的紫色光點・走過去就會想起來（每段 +1 結晶）', { fontFamily: UI_FONT, fontSize: '19px', color: '#9a88b8' }).setOrigin(0.5));
    let y = -440;
    for (const wm of WORLD_MAPS) {
      items.push(this.add.text(-310, y, wm.name, { fontFamily: UI_FONT, fontSize: '22px', fontStyle: '700', color: wm.color }).setOrigin(0, 0));
      y += 38;
      for (const m of memoriesOf(wm.id)) {
        const got = have.includes(m.id);
        const t = this.add.text(-290, y, got ? m.lines : '？？？（還沒想起來）', { fontFamily: got ? TITLE_FONT : UI_FONT, fontSize: '20px', color: got ? '#f0e6ff' : '#6a5a80', lineSpacing: 6, wordWrap: { width: 590, useAdvancedWrap: true } }).setOrigin(0, 0);
        items.push(t);
        y += t.height + 16;
      }
      y += 14;
    }
    const back = this.add.text(0, Math.min(y + 40, 580), '返回', { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: '#1a0f08', backgroundColor: '#d8b0ff' }).setOrigin(0.5).setPadding(28, 12, 28, 12).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      SFX.uiCancel();
      this.menu?.destroy();
      this.menu = null;
      this.toggleMenu();
    });
    items.push(back);
    this.menu = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2, items).setDepth(960);
  }

  /** 隱藏寶箱附近第一次靠近：「這個地方似乎有點熟悉……」（design/20 C2，只提示不指路） */
  private chestHint(): void {
    const list = STAGES[this.stageId]?.chests;
    if (!list?.length || this.bot) return;
    const p = playerOf(this.s);
    for (const c of list) {
      if (c.nightOnly || this.chestHinted.has(c.id) || this.s.chestsOpened?.includes(c.id)) continue;
      if (Math.hypot(c.x - p.x, c.y - p.y) > CHEST_RULES.hintUnits * UNIT) continue;
      this.chestHinted.add(c.id);
      const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '這個地方似乎有點熟悉……', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: 'italic', color: '#d8c8ff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(66).setAlpha(0);
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
    const dayChests = new Set((STAGES[this.stageId]?.chests ?? []).filter((c) => !c.nightOnly).map((c) => c.id));
    const nChest = dayChests.size;
    const lines = [
      `本次：擊殺 ${now.kills}・金幣 ${now.coin}・粉塵 ${now.dust}・結晶 ${now.crystal}`,
      `累計：擊殺 ${total.kills ?? 0}・金幣 ${total.coin ?? 0}・粉塵 ${total.dust ?? 0}・結晶 ${total.crystal ?? 0}`,
      `${this.bw}討伐 ${rec.bossKills ?? 0} 次${rec.furyKills ? `（暴怒 ${rec.furyKills}）` : ''}${rec.bestBossSec !== undefined ? `・最快 ${fmtSec(rec.bestBossSec)}` : ''}・寶箱 ${(total.chests ?? []).filter((id) => dayChests.has(id)).length}/${nChest}`,
      `出發冒險 ${rec.runs ?? 1} 次・累計 ${fmtSec(total.playSec ?? 0)}`,
      `懸賞完成 ${cleanBounties(rec.bounty).done} 張・手上金幣 ${coinOf(rec)}（營火行商）`,
    ];
    { const chs = choiceOf(this.stageId); const cp = loadChoices()[this.stageId]; if (chs && cp) lines.push(`你的抉擇：${chs.short[cp]}${cp === 'take' ? '' : `（行商 −${shopDiscountPct(loadChoices())}%）`}`); }
    if (memoriesOf(this.stageId).length) { const mh = loadMemories(); lines.push(`前世的記憶：這裡 ${memoriesOf(this.stageId).filter((m) => mh.includes(m.id)).length}/${memoriesOf(this.stageId).length}・全部 ${mh.length}/${MEMORIES.length}`); }
    const cs = cardSummary();
    if (cs.played || cs.have) lines.push(`營火燼牌 ${cs.won} 勝 / ${cs.played} 場・收集 ${cs.have}/${cs.total} 張`);
    const tip = worldMap(this.stageId) ? levelTip(this.stageId, rec, this.s.prog?.level ?? 1) : null;
    if (tip) lines.unshift(tip);
    if (worldMap(this.stageId)) lines.unshift(`▶ 下一個目標：${nextGoal(this.stageId, rec, this.s.prog?.level ?? 1, bossKillsOf(worldMap(this.stageId)?.next ?? ''))}`);
    if (this.s.prog) lines.unshift(`Lv ${this.s.prog.level}・經驗 ${this.s.prog.xp}/${xpToNext(this.s.prog.level)}`);
    return this.add.text(0, y, lines.join('\n'), { fontFamily: UI_FONT, fontSize: '22px', color: '#e8dcc0', align: 'center', lineSpacing: 10, backgroundColor: '#00000066' }).setOrigin(0.5, 0).setPadding(18, 12, 18, 12);
  }

  /** 暫停選單的「深夜的森林」開關（D-103）：要重新進入森林才生效 */
  private nightButton(mk: (y: number, label: string, fn: () => void, hi?: boolean) => void, items: Phaser.GameObjects.GameObject[], y: number): void {
    const rec = loadRecord(this.stageId);
    if (!nightUnlocked(rec)) {
      items.push(this.add.text(0, y, `🔒 深夜的${this.mw}（打倒暴怒${this.bw}解鎖）`, { fontFamily: UI_FONT, fontSize: '22px', color: '#9a8a7a', backgroundColor: '#2a2018' }).setOrigin(0.5).setPadding(18, 12, 18, 12));
      return;
    }
    const on = !!this.s.night;
    mk(y, on ? '🌙 回到白天（重新進入）' : `🌙 深夜的${this.mw}（重新進入）`, () => this.leave(() => {
      saveRecord(this.stageId, { ...loadRecord(this.stageId), night: !on });
      this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ?? '' });
    }), on);
  }

  /** 第一次達成暴怒狼王解鎖條件（D-099） */
  private furyUnlockedToast(): void {
    SFX.warn(true);
    bigText(this, GAME_WIDTH / 2, 600, `解鎖：${this.bw}暴怒！\n☰ 暫停選單可以開啟・掉落更好`, '#ff7a5a', 34, 2600);
  }

  /** 暫停選單的「狼王暴怒」開關（D-099）：沒解鎖時顯示條件 */
  private furyButton(mk: (y: number, label: string, fn: () => void, hi?: boolean) => void, items: Phaser.GameObjects.GameObject[], y: number): void {
    const rec = loadRecord(this.stageId);
    const lv = this.s.prog?.level ?? 1;
    if (!furyUnlocked(rec, lv)) {
      items.push(this.add.text(0, y, `🔒 ${this.bw}暴怒（Lv${FURY_UNLOCK.level} 或討伐 ${FURY_UNLOCK.kills} 次解鎖）`, { fontFamily: UI_FONT, fontSize: '22px', color: '#9a8a7a', backgroundColor: '#2a2018' }).setOrigin(0.5).setPadding(18, 12, 18, 12));
      return;
    }
    const on = !!this.s.bossFury;
    mk(y, on ? `🔥 ${this.bw}暴怒：開` : `${this.bw}暴怒：關`, () => {
      const next = !on;
      const now = setBossFury(this.s, next);
      saveRecord(this.stageId, { ...loadRecord(this.stageId), fury: next });
      this.toggleMenu();
      bigText(this, GAME_WIDTH / 2, 470, next ? (now ? `${this.bw}暴怒了！HP・攻擊大增・掉落更好` : `下一次出現的${this.bw}會是暴怒版`) : now ? `${this.bw}恢復平靜` : `下一次出現的${this.bw}恢復一般`, next ? '#ff7a5a' : '#c8d0f0', 34, 1600);
      if (next) SFX.warn(true);
    }, on);
  }

  private toggleMenu(): void {
    if (this.hint) this.dismissHint(); // 說明框不要壓在暫停選單上
    this.fireBtn?.setVisible(false); // 營火按鈕不要從選單底下透出來（關掉後下一幀會再顯示）
    this.shopBtn?.setVisible(false);
    this.cardBtn?.setVisible(false);
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
    const items: Phaser.GameObjects.GameObject[] = [this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setInteractive()];
    items.push(this.add.text(0, -440, '暫停', { fontFamily: TITLE_FONT, fontSize: '44px', color: '#ffd27a' }).setOrigin(0.5));
    const mk = (y: number, label: string, fn: () => void, hi = false, x = 0) => {
      const t = this.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: '28px', fontStyle: '700', color: hi ? '#1a0f08' : '#ffffff', backgroundColor: hi ? '#ffd27a' : '#3a2a14' }).setOrigin(0.5).setPadding(24, 12, 24, 12).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        SFX.confirm();
        fn();
      });
      items.push(t);
    };
    mk(-350, '繼續', () => this.toggleMenu(), true);
    const ctlBtn = (y: number, x = 0) => mk(y, '操作設定', () => {
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
    }, false, x);
    if (this.tracked || worldMap(this.stageId)) {
      // 正式大地圖（標題入口）：不列試玩關
      if (this.tracked) {
        const up = this.bagSt.bag.filter((g) => isUpgrade(this.bagSt, g)).length;
        mk(-270, `行囊（${this.bagSt.bag.length}）${up ? `　▲${up}` : ''}`, () => this.openBag(), up > 0, -140);
        const pts = this.skillPointsLeft();
        mk(-270, `技能點${pts > 0 ? `（${pts}）` : ''}`, () => this.openSkills(), pts > 0, 160);
      }
      if (this.tracked) {
        ctlBtn(-190, -150);
        mk(-190, `前世的記憶 ${loadMemories().length}/${MEMORIES.length}`, () => this.openMemoryBook(), false, 165);
      } else ctlBtn(-190);
      if (this.tracked && !this.botName) {
        // 換武器（D-147）：存起來後重新進入地圖（從營火出發）
        const w = loadWeapon();
        const other = nextWeapon(w);
        mk(-110, '看 Bot 示範', () => this.leave(() => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: 'normal' })), false, -165);
        mk(-110, `武器：${WEAPON_NAME[w]} ⇄`, () => {
          saveWeapon(other);
          this.leave(() => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: '' }));
        }, false, 150);
      } else mk(-110, this.botName ? '改成自己操作' : '看 Bot 示範', () => this.leave(() => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ? '' : 'normal' })));
      mk(-30, `重新進入${this.mw}`, () => this.leave(() => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ?? '' })));
      let y = 50;
      if (this.tracked && STAGES[this.stageId]?.bossZone?.fury) {
        this.furyButton(mk, items, y);
        y += 80;
      }
      if (this.tracked && STAGES[this.stageId]?.night) {
        this.nightButton(mk, items, y);
        y += 80;
      }
      // 兩張地圖之間直接移動（D-114）：等級、行囊共用，只是換地圖
      // 第 26 輪：改成走登記表（D-124）——其他已開放的大地圖都列出來
      if (!this.botName && worldMap(this.stageId)) {
        WORLD_MAPS.forEach((m, i) => {
          if (m.id === this.stageId || !mapOpen(m.id)) return;
          mk(y, `${i ? '前往' : '回'}${m.name}`, () => this.leave(() => this.scene.start('RtBattle', { stage: m.id, bot: '' })));
          y += 80;
        });
      }
      mk(y, '回標題', () => this.leave(() => this.scene.start('Title')));
      items.push(this.recordText(y + 80));
      this.menu = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2, items).setDepth(960);
      return;
    }
    ctlBtn(-270);
    mk(-190, '重來', () => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ?? '' }));
    items.push(this.add.text(0, -120, '換關卡', { fontFamily: UI_FONT, fontSize: '22px', color: '#c8d0f0' }).setOrigin(0.5));
    STAGE_IDS.forEach((id, i) => mk(-60 + i * 72, `${id === this.stageId ? '▶ ' : ''}${STAGES[id]!.name}`, () => this.scene.restart({ stage: id, seed: this.seed + 1, bot: this.botName ?? '' })));
    mk(-60 + STAGE_IDS.length * 72 + 14, this.botName ? '改成自己操作' : '看 Bot 示範（熟練）', () => this.scene.restart({ stage: this.stageId, seed: this.seed + 1, bot: this.botName ? '' : 'expert' }));
    mk(-60 + STAGE_IDS.length * 72 + 90, '回標題', () => this.scene.start('Title'));
    this.menu = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2, items).setDepth(960);
  }

  private showHint(): void {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
    } catch {
      /* 無痕模式 */
    }
    // 第 23 輪縮成兩行：紅框、黃框、大招、裝備改成第一次遇到時才提示（tipOnce）
    const lines = ['左下拖曳走路・放開＝自動追擊＋普攻', '點怪物開打・右下：技能與閃避'];
    const bg = this.add.rectangle(0, 0, 600, 112, 0x000000, 0.72).setStrokeStyle(2, 0xffd27a, 0.8);
    const t = this.add.text(0, 0, lines.join('\n'), { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff', align: 'center', lineSpacing: 10 }).setOrigin(0.5);
    this.hint = this.add.container(GAME_WIDTH / 2, 300, [bg, t]).setDepth(70);
    this.time.delayedCall(6000, () => this.dismissHint());
  }

  /**
   * 巡邏的精英（D-117：荊棘巡獵者、深夜的霧影狼）：巡邏中畫出仇恨範圍（淡圈）＋面向的視線扇形，讓玩家看得出「牠往哪走、離多近會被發現」；
   * 走過的地方留下會淡掉的腳印。第一次靠近時提示一次。純畫面，不碰戰鬥狀態。
   */
  private drawPatroller(g: Phaser.GameObjects.Graphics, x: Unit, pos: { x: number; y: number }, px: number, py: number, now: number, p: Unit): void {
    const patrolling = x.mode === 'idle' || x.mode === 'returning';
    const col = PATROL_COLOR[x.defId] ?? 0xff8a5c;
    // 腳印：每走 0.8 格左右交替留一個
    let last = this.pawLast.get(x.id);
    if (!last) this.pawLast.set(x.id, (last = { x: pos.x, y: pos.y, side: 1 }));
    const moved = Math.hypot(pos.x - last.x, pos.y - last.y);
    if (moved > UNIT * 0.8) {
      if (moved < UNIT * 3) {
        last.side = -last.side;
        this.paws.push({ x: pos.x, y: pos.y, a: Math.atan2(pos.y - last.y, pos.x - last.x), t: now, side: last.side });
        if (this.paws.length > 40) this.paws.shift();
      }
      last.x = pos.x;
      last.y = pos.y;
    }
    if (!patrolling) return;
    const R = aggroUnitsOf(x) * UNIT * this.k;
    const pulse = 0.5 + 0.5 * Math.sin(now / 350);
    g.lineStyle(2, col, 0.18 + 0.1 * pulse).strokeCircle(px, py, R);
    // 視線扇形（往面向方向）
    const fa = Math.atan2(x.facingY, x.facingX);
    const pts = [{ x: px, y: py }];
    for (let k = 0; k <= 10; k++) {
      const an = fa - 0.55 + (k / 10) * 1.1;
      pts.push({ x: px + Math.cos(an) * R, y: py + Math.sin(an) * R });
    }
    g.fillStyle(col, 0.1 + 0.06 * pulse).fillPoints(pts, true);
    if (!this.bot && !p.dead && Math.hypot(p.x - x.x, p.y - x.y) < UNIT * 10) this.tipOnce('jg_tip_stalker', `${ENEMIES[x.defId]?.name ?? ''}在巡邏——別走進牠的範圍，或正面迎戰`, '#ffb07a');
  }

  /** 巡邏怪的腳印（所有巡邏怪共用一個陣列，每幀畫一次） */
  private drawPaws(g: Phaser.GameObjects.Graphics, now: number): void {
    if (!this.paws.length) return;
    if (now - this.paws[0]!.t >= 5000) this.paws = this.paws.filter((w) => now - w.t < 5000);
    const s0 = UNIT * 0.09 * this.k;
    for (const w of this.paws) {
      const al = 0.45 * (1 - (now - w.t) / 5000);
      const wx = this.sx(w.x + Math.cos(w.a + Math.PI / 2) * w.side * UNIT * 0.18);
      const wy = this.sy(w.y + Math.sin(w.a + Math.PI / 2) * w.side * UNIT * 0.18);
      g.fillStyle(0x3a1a12, al).fillEllipse(wx, wy, s0 * 2.2, s0 * 1.6);
      for (let k = -1; k <= 1; k++) {
        const ta = w.a + k * 0.5;
        g.fillCircle(wx + Math.cos(ta) * s0 * 1.7, wy + Math.sin(ta) * s0 * 1.7, s0 * 0.55);
      }
    }
  }

  /** 每台裝置只提示一次的小引導（第 23 輪）；說明框還在時先不提示 */
  private tipOnce(key: string, text: string, color: string): void {
    if (this.tipsDone.has(key) || this.hint || this.tipBusy) return;
    this.tipsDone.add(key); // 記在記憶體：大招提示每幀都會呼叫，不要每幀讀 localStorage
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      return;
    }
    this.tipBusy = true;
    this.time.delayedCall(2200, () => (this.tipBusy = false));
    bigText(this, GAME_WIDTH / 2, 700, text, color, 30, 1600);
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
        if (e.skill === 'vent' && d.side === 'enemy') this.ventHit.set(d.id, e.tick);
        const toPlayer = d.side === 'player';
        if (e.origin !== 'dot') this.flashUntil.set(d.id, this.time.now + 70);
        // 命中停頓：暴擊／反擊／技能較長，普攻短一點；被打不停頓（避免拖慢閃避判斷）
        if (!toPlayer && e.origin !== 'dot') this.hitStop = Math.max(this.hitStop, e.crit || e.origin === 'counter' ? 70 : e.origin === 'skill' ? 45 : 25);
        if (!toPlayer && (e.crit || e.origin === 'counter')) this.cameras.main.shake(70, 0.003);
        const src = u(e.src);
        if (src && src.side === 'player' && e.origin === 'normal' && this.s.weapon === 'staff') {
          // 法杖普攻（D-152）：一顆紫色魔彈
          this.magicBolt(src.x, src.y, d.x, d.y, e.crit ? 0xffd05a : 0xc89aff);
          this.knock(d.id, d.x - src.x, d.y - src.y, 7);
        } else if (src && src.side === 'player' && e.origin === 'normal' && this.s.weapon === 'bow') {
          // 長弓普攻（D-147）：一支箭飛過去
          this.arrowShot(src.x, src.y, d.x, d.y, e.crit ? 0xffd05a : 0xd8f0ff);
          this.knock(d.id, d.x - src.x, d.y - src.y, 6);
        } else if (src && src.side === 'player' && e.origin === 'normal') {
          this.slash(src.x, src.y, Math.atan2(d.y - src.y, d.x - src.x), 150, 110, e.crit ? 0xffd05a : 0xffffff, 5);
          this.knock(d.id, d.x - src.x, d.y - src.y, 10);
        } else if (src && src.side === 'player' && e.origin !== 'dot') this.knock(d.id, d.x - src.x, d.y - src.y, 16);
        // 持續傷害的數字合併（第 34 輪）：同一隻怪 1 秒內的灼燒＋中毒跳成同一個數字（狼群身上一堆小數字太吵）
        const dn = e.origin === 'dot' && !toPlayer ? this.dotNum.get(d.id) : undefined;
        if (dn && dn.t.active && this.time.now - dn.at < 1000) {
          dn.sum += e.amount;
          if (dn.skill !== e.skill) dn.t.setColor('#ffd27a');
          dn.t.setText(`${dn.sum}`);
        } else if (e.origin === 'dot' && !toPlayer) {
          if (e.skill === 'burn' && this.onScreen(d.x, d.y)) this.emberPuff(this.sx(d.x), this.sy(d.y) - 20);
          const t = floatNumber(this, this.sx(d.x), this.sy(d.y) - 30, `${e.amount}`, { color: e.skill === 'burn' ? '#ffa850' : e.skill === 'poison' ? '#b8ff7a' : '#ffffff', size: 22 });
          this.dotNum.set(d.id, { t, at: this.time.now, sum: e.amount, skill: e.skill });
        } else
        floatNumber(this, this.sx(d.x), this.sy(d.y) - 30, `${e.amount}${e.crit ? '!' : ''}`, { color: toPlayer ? '#ff8a8a' : e.crit ? '#ffd05a' : e.origin === 'counter' ? '#7dffb0' : e.skill === 'burn' ? '#ffa850' : e.skill === 'poison' ? '#b8ff7a' : '#ffffff', size: e.crit || e.origin === 'counter' ? 34 : e.origin === 'dot' ? 22 : 26 });
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
        // 巡邏的精英發現你（D-117）：橘色衝擊環＋警告音＋「被發現了！」
        if (d?.patrol && !this.bot) {
          shockRing(this, this.sx(d.x), this.sy(d.y), 0xff8a5c, 60, 260, 5);
          SFX.warn(false);
          floatNumber(this, this.sx(d.x), this.sy(d.y) - 130, '被發現了！', { color: '#ffb07a', size: 30 });
        }
        if (d?.affix) this.time.delayedCall(250, () => floatNumber(this, this.sx(d.x), this.sy(d.y) - 90, `${ELITE_AFFIXES[d.affix!].name}！`, { color: `#${AFFIX_COLOR[d.affix!].toString(16).padStart(6, '0')}`, size: 32 }));
        // 遊戲記憶（design/20 C2-2）：地圖上第一次遇到 Boss → 內心提示弱點（只提示，不加傷害）
        if (d && ENEMIES[d.defId]?.boss && STAGES[this.stageId]?.spawnGroups?.length && !this.bossMemo) {
          this.bossMemo = true;
          this.bossIntro(d);
          this.time.delayedCall(2100, () => bigText(this, GAME_WIDTH / 2, 600, '（記得……牠衝鋒撞到樹或石頭會暈！）', '#d8c8ff', 28, 2200));
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
        // 反擊的形狀跟著選的變化走（第 25 輪修：以前一律畫原招的扇形）
        const pd = skillDef(this.s, 'parry');
        const cs0 = pd?.block?.counter.shape;
        const cs = cs0 && skillShape(this.s, 'parry', cs0);
        const ang = Math.atan2(p.facingY, p.facingX);
        if (this.s.weapon === 'staff') this.hexShield(p.x, p.y);
        if (cs && this.s.weapon === 'staff') this.staffFx(p.x, p.y, ang, cs, false, true, 0, pd?.block?.counter.status?.id); // 法杖：屏障炸開／鏡像光束（D-152）
        else if (cs && this.s.weapon === 'bow' && cs.type !== 'line') this.bowFx(p.x, p.y, ang, cs, false, false, false, false, pd?.block?.counter.status?.id); // 流光見切（D-148）：四面射出；殘月見切（D-149）：紫色扇形
        else if (cs?.type === 'sector') this.slash(p.x, p.y, ang, cs.r, cs.deg + 30, 0x7dffb0, 10);
        else if (cs?.type === 'circle') {
          this.spin(p.x, p.y, cs.r, 0xffd27a, (this.time.now / 90) % (Math.PI * 2));
          shockRing(this, this.sx(p.x), this.sy(p.y), 0xffd27a, cs.r * this.k * 1.1, 380, 8);
        } else if (cs?.type === 'line') {
          // 迴光一閃（D-121）：擋下的瞬間一道白金劍氣直射出去；長弓的見切射擊是一支金色重箭（D-147）
          if (this.s.weapon === 'bow') this.arrowBeam(p.x, p.y, ang, cs.len, cs.width, 0xffe08a, true);
          else this.groundSplit(p.x, p.y, ang, cs.len, cs.width);
          this.cameras.main.flash(110, 255, 250, 220);
          this.hitStop = Math.max(this.hitStop, 160);
        }
        bigText(this, this.sx(p.x), this.sy(p.y) - 80, cs?.type === 'line' ? `${pd!.name}！` : '格擋！', cs?.type === 'line' ? '#fff2c0' : '#7dffb0', 40, 300);
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
          this.bountyKill(d.defId);
          if (this.ventHit.get(d.id) === e.tick) this.ventKill(d.x, d.y);
          this.ventHit.delete(d.id);
          if (d.defId === 'thorn_queen' || d.defId === 'thorn_mother') this.thornWither(d.x, d.y, d.defId === 'thorn_queen');
          if (ENEMIES[d.defId]?.boss && !this.bot) {
            const rec = this.tracked ? loadRecord(this.stageId) : {};
            const long = d.fury ? !rec.furyKills : !rec.bossKills;
            this.bossRays(this.sx(d.x), this.sy(d.y), Phaser.Display.Color.HexStringToColor(worldMap(this.stageId)?.color ?? '#ffd27a').color, long);
          }
          if (ENEMIES[d.defId]?.boss && STAGES[this.stageId]?.spawnGroups?.length) this.bossSlain(`${d.fury ? '暴怒的' : ''}${ENEMIES[d.defId]!.name}`, !!d.fury);
          else if (d.defId === 'thorn_mother') {
            // 荊棘母樹倒下（D-107）：綠色衝擊波＋葉片＋大字
            this.cameras.main.shake(220, 0.007);
            shockRing(this, this.sx(d.x), this.sy(d.y), 0x6aff7a, 220, 560, 10);
            sparks(this, this.sx(d.x), this.sy(d.y), 26, 'ember', 0x9aff7a, 700);
            bigText(this, GAME_WIDTH / 2, 470, '荊棘母樹 倒下了！', '#9aff8a', 46, 900);
          } else if (d.defId === 'thorn_stalker') {
            this.cameras.main.shake(180, 0.006);
            shockRing(this, this.sx(d.x), this.sy(d.y), 0xff8a5c, 180, 480, 8);
            sparks(this, this.sx(d.x), this.sy(d.y), 22, 'ember', 0xffa07a, 600);
            bigText(this, GAME_WIDTH / 2, 470, '荊棘巡獵者 倒下了！', '#ffb07a', 44, 900);
          } else if (d.defId === 'magma_stalker' || d.defId === 'obsidian_alpha') {
            // 熔核巡者／黑曜首領倒下：熔岩衝擊環＋火星＋大字
            this.cameras.main.shake(180, 0.006);
            shockRing(this, this.sx(d.x), this.sy(d.y), 0xff6a2a, 190, 500, 9);
            sparks(this, this.sx(d.x), this.sy(d.y), 24, 'ember', 0xffa050, 640);
            bigText(this, GAME_WIDTH / 2, 470, `${ENEMIES[d.defId]!.name} 倒下了！`, '#ffa868', 44, 900);
          } else if (d.defId === 'comet_stalker' || d.defId === 'astral_alpha' || d.defId === 'eclipse_wolf') {
            // 彗星巡者／星輝首領倒下（D-138）：藍白星爆環＋碎星
            this.cameras.main.shake(180, 0.006);
            shockRing(this, this.sx(d.x), this.sy(d.y), 0x8aa8ff, 190, 500, 9);
            shockRing(this, this.sx(d.x), this.sy(d.y), 0xffffff, 110, 300, 4);
            sparks(this, this.sx(d.x), this.sy(d.y), 24, 'spark', 0xc8d8ff, 640);
            bigText(this, GAME_WIDTH / 2, 470, `${ENEMIES[d.defId]!.name} 倒下了！`, '#c8d8ff', 44, 900);
          } else if (d.defId === 'mist_warden') {
            // 迷霧巡守倒下（D-120）：青色霧環＋霧粒散開
            this.cameras.main.shake(160, 0.005);
            shockRing(this, this.sx(d.x), this.sy(d.y), 0x6ae8d0, 180, 480, 8);
            sparks(this, this.sx(d.x), this.sy(d.y), 22, 'ember', 0xbaf8ee, 620);
            bigText(this, GAME_WIDTH / 2, 470, '迷霧巡守 倒下了！', '#9af0e0', 44, 900);
          }
        }
      } else if (e.type === 'phase2') bigText(this, GAME_WIDTH / 2, 520, (worldMap(this.stageId)?.phase2 ?? WORLD_MAPS[0]!.phase2)[0], (worldMap(this.stageId)?.phase2 ?? WORLD_MAPS[0]!.phase2)[1], 52, 700);
      else if (e.type === 'wallStun') bigText(this, GAME_WIDTH / 2, 520, '撞牆暈眩！趁現在！', '#ffd27a', 40, 700);
      else if (e.type === 'blink') {
        // 暴怒狼王霧中瞬移（D-105）：原地與落點各冒一團霧、不做插值滑動
        const b = u(e.id);
        this.prev.delete(e.id);
        SFX.dodge();
        // 荊棘谷的狼后（D-114）：鑽進地底、從背後的荊棘裡冒出來（綠色）
        const wmb = worldMap(this.stageId) ?? WORLD_MAPS[0]!;
        const wd = b?.defId === 'mist_warden';
        sparks(this, this.sx(e.fromX), this.sy(e.fromY), 16, 'ember', wmb.blinkFx[0], 520);
        shockRing(this, this.sx(e.fromX), this.sy(e.fromY), wmb.blinkFx[1], 90, 360, 6);
        if (b) {
          sparks(this, this.sx(b.x), this.sy(b.y), 20, 'ember', wmb.blinkFx[2], 560);
          shockRing(this, this.sx(b.x), this.sy(b.y), 0xff6a6a, 120, 420, 8);
        }
        this.cameras.main.shake(120, 0.004);
        if (b && !this.blinkHinted.has(b.defId)) {
          this.blinkHinted.add(b.defId);
          bigText(this, GAME_WIDTH / 2, 520, wd ? '巡守隱入霧中——小心背後！' : wmb.blink[0], wd ? '#9af0e0' : wmb.blink[1], 38, 900);
        }
      }
      else if (e.type === 'cast') {
        if (skillDef(this.s, e.skill)?.role === 'ult') {
          // 大招：閃光＋金粉環＋大字（D-071 放上試玩鍵位）
          const p = playerOf(this.s);
          SFX.perfect();
          SFX.hitHeavy();
          this.cameras.main.flash(140, 255, 140, 220);
          this.cameras.main.shake(160, 0.006);
          shockRing(this, this.sx(p.x), this.sy(p.y), 0xff7ad0, 260, 520, 10);
          sparks(this, this.sx(p.x), this.sy(p.y), 26, 'ember', 0xff9ae0, 520);
          bigText(this, GAME_WIDTH / 2, 460, `${skillDef(this.s, 'blade_storm')!.name}！`, '#ff9ae0', 54, 700);
        } else SFX.blip();
      }
      else if (e.type === 'telegraph') {
        // 預告聲音提示（同一 tick 多隻只響一次）；Boss 低沉
        if (this.lastWarnTick !== e.tick) {
          this.lastWarnTick = e.tick;
          const o = u(e.owner);
          SFX.warn(!!(o && ENEMIES[o.defId]?.boss));
        }
        // 新手引導（第 23 輪）：第一次看到敵人預告、第一次看到可格擋的黃框，各提示一次（每台裝置一次）
        if (!this.bot) {
          const tg0 = this.s.telegraphs.find((t) => t.ownerId === e.owner && t.attackId === e.attack);
          if (tg0?.blockable) this.tipOnce('jg_tip_block', '黃框＝可以格擋！敵人打到前按「格擋反擊」', '#ffe08a');
          else this.tipOnce('jg_tip_tele', '紅色範圍填滿就命中——走出去！', '#ff9a8a');
        }
        // 精英詞綴招式（D-118）：怪頭上飄招式名（詞綴顏色），一看就知道要閃還是格擋
        if (e.attack.startsWith('affix_')) {
          const o = u(e.owner);
          const lb = o ? attacksOf(o).find((q) => q.id === e.attack)?.label : undefined;
          if (o?.affix && lb) floatNumber(this, this.sx(o.x), this.sy(o.y) - 110, `${lb}！`, { color: `#${AFFIX_COLOR[o.affix].toString(16).padStart(6, '0')}`, size: 28 });
          if (o?.affix === 'tough' && lb) this.cameras.main.shake(120, 0.003);
        }
        // 地面荊棘（第 23 輪）：記下預告，命中那一刻在範圍裡長出荊棘
        if (METEOR_ATTACKS.has(e.attack)) {
          const tg = [...this.s.telegraphs].reverse().find((t) => t.ownerId === e.owner && t.attackId === e.attack);
          if (tg) this.thornPending.push({ ...tg });
          if (e.attack === 'eclipse_howl') {
            const o = u(e.owner);
            if (o) floatNumber(this, this.sx(o.x), this.sy(o.y) - 110, '星蝕嚎叫！', { color: '#b8a0ff', size: 28 });
          }
          if (e.attack === 'sentinel_meteor' && !this.meteorHinted && !this.bot) {
            this.meteorHinted = true;
            bigText(this, GAME_WIDTH / 2, 520, '守望者召喚墜星——藍圈在你腳下！', '#c8d8ff', 36, 900);
          }
        }
        if (THORN_ATTACKS.has(e.attack) || LAVA_ATTACKS.has(e.attack)) {
          const tg = [...this.s.telegraphs].reverse().find((t) => t.ownerId === e.owner && t.attackId === e.attack);
          if (tg) this.thornPending.push({ ...tg });
        }
        // 荊棘綻放（D-114）：狼后腳下冒出綠色孢子＋第一次提示跑出圈外
        if (e.attack === 'colossus_core_burst') {
          // 暴怒岩王的熔心爆發（第 26 輪）：胸口熔心亮起＋大圈警告
          const o = u(e.owner);
          if (o) {
            shockRing(this, this.sx(o.x), this.sy(o.y), 0xff8a3a, 5.2 * 100 * this.k, 1100, 8);
            sparks(this, this.sx(o.x), this.sy(o.y) - 60, 30, 'ember', 0xffb36a, 900);
          }
          this.cameras.main.shake(300, 0.004);
          SFX.warn(true);
          bigText(this, GAME_WIDTH / 2, 520, '熔心爆發——跑出圈外！', '#ffb36a', 40, 900);
        }
        if (e.attack === 'queen_bloom') {
          const o = u(e.owner);
          if (o) {
            shockRing(this, this.sx(o.x), this.sy(o.y), 0x8adf4a, 3.2 * 100 * this.k, 900, 6);
            sparks(this, this.sx(o.x), this.sy(o.y), 26, 'ember', 0xc8ff8a, 900);
          }
          if (!this.bloomHinted) {
            this.bloomHinted = true;
            bigText(this, GAME_WIDTH / 2, 520, '荊棘綻放——跑出圈外！', '#c8ff8a', 40, 900);
          }
        }
      }
      else if (e.type === 'hazard') {
        const p = u(e.id);
        if (p) sparks(this, this.sx(p.x), this.sy(p.y), 6, 'ember', 0x9adf5a, 500);
        if (!this.hazardHinted) {
          this.hazardHinted = true;
          bigText(this, GAME_WIDTH / 2, 470, '毒沼！站在裡面會一直中毒\n快走出去', '#a8f08a', 34, 1400);
        }
      }
      else if (e.type === 'vent') {
        // 噴發（D-125）：火柱粒子＋衝擊環；離玩家近才震畫面、出聲
        const vx = this.sx(e.x);
        const vy = this.sy(e.y);
        const pl = playerOf(this.s);
        const near = Math.hypot(pl.x - e.x, pl.y - e.y) < UNIT * 8;
        if (Math.hypot(pl.x - e.x, pl.y - e.y) < UNIT * 14 && this.starMap) {
          // 墜星落地（D-138）：白色閃光＋藍色衝擊環＋碎星四濺
          this.starImpact(vx, vy, e.r * this.k);
        } else if (Math.hypot(pl.x - e.x, pl.y - e.y) < UNIT * 14) {
          sparks(this, vx, vy, 22, 'ember', 0xff8a3a, 620);
          sparks(this, vx, vy - 20, 10, 'spark', 0xffe0a0, 820);
          shockRing(this, vx, vy, 0xff7a2a, e.r * this.k * 1.25, 380, 8);
          const col = this.add.rectangle(vx, vy, e.r * this.k * 0.9, e.r * this.k * 3.2, 0xffa040, 0.55).setOrigin(0.5, 1).setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: col, scaleX: 0.2, alpha: 0, duration: 420, ease: 'Cubic.easeIn', onComplete: () => col.destroy() });
        }
        if (near) {
          this.cameras.main.shake(110, 0.004);
          SFX.hitHeavy();
        }
        if (!this.ventHinted && near && !this.bot) {
          this.ventHinted = true;
          if (this.starMap) bigText(this, GAME_WIDTH / 2, 470, '星星砸下來了！地上出現藍圈就快走開\n（閃避可以躲・把追你的怪引過來砸）', '#c8d8ff', 30, 1800);
          else bigText(this, GAME_WIDTH / 2, 470, '熔岩口噴發！地上發亮就快走開\n（閃避可以躲・把追你的怪引過來燒）', '#ffb36a', 30, 1800);
        }
      }
      else if (e.type === 'shard') {
        // 撿到星光碎片（D-141）：藍色光點往主角身上收、+MP／+HP 飄字
        const pl = playerOf(this.s);
        const tx = this.sx(pl.x);
        const ty = this.sy(pl.y) - 40;
        sparks(this, this.sx(e.x), this.sy(e.y) - 18, 14, 'spark', 0xc8d8ff, 520);
        shockRing(this, tx, ty + 40, 0x8aa8ff, 90, 320, 4);
        floatNumber(this, tx, ty - 30, `+${e.mp} MP${e.heal ? `・+${e.heal}` : ''}`, { color: '#a8c8ff', size: 28 });
        SFX.cardMagic();
        if (!this.bot) this.tipOnce('jg_tip_shard', '星光碎片：落星之後地上會留 5 秒，撿起來回 MP 與 HP', '#c8d8ff');
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
        if (this.tracked) this.ptsLeft = this.skillPointsLeft();
        // 升級（D-090）：金色光柱＋大字＋數值浮字，立刻存檔
        const p = playerOf(this.s);
        if (this.tracked && e.level === FURY_UNLOCK.level && STAGES[this.stageId]?.bossZone?.fury && (loadRecord(this.stageId).bossKills ?? 0) < FURY_UNLOCK.kills) this.furyUnlockedToast();
        SFX.perfect();
        this.cameras.main.flash(180, 255, 230, 160);
        const col = this.add.rectangle(this.sx(p.x), this.sy(p.y) - 200, 90, 420, 0xffe08a, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
        this.tweens.add({ targets: col, scaleX: 0.1, alpha: 0, duration: 900, ease: 'Cubic.In', onComplete: () => col.destroy() });
        bigText(this, GAME_WIDTH / 2, 470, `等級提升！Lv ${e.level}${this.tracked ? '\n技能點 +1（☰ → 技能點）' : ''}`, '#ffe08a', 54, 1000);
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
        bigText(this, GAME_WIDTH / 2, 390, c?.nightOnly ? '夜光寶箱！' : '找到隱藏寶箱！', c?.nightOnly ? '#bfe0ff' : '#ffd27a', 46, 1000);
        this.time.delayedCall(500, () => bigText(this, GAME_WIDTH / 2, 446, got, '#f4e6c0', 30, 1400));
        // 寶箱裡的燼牌（D-131）：第一次拿到才出字
        const card = this.tracked ? CHEST_CARDS[e.chest] : undefined;
        if (card && grantCard(card)) this.time.delayedCall(1300, () => bigText(this, GAME_WIDTH / 2, 500, `＋燼牌「${EMBER_CARDS[card]?.name ?? card}」\n營火行商的「燼牌」可以用`, '#ffb36a', 28, 1800));
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
    // 省記憶體（第 31 輪）：一張大地圖的地面材質約 50MB（GPU），以前四張圖都留著；換圖時把別張圖的地面丟掉，回來再畫
    for (const tk of this.textures.getTextureKeys()) if (tk.startsWith('rt_ground_') && tk !== key && !tk.startsWith(`${key}_`)) this.textures.remove(tk);
    if (this.textures.exists(chunkKey(0, 0))) return place();
    // 每塊各自重畫一次（Graphics.generateTexture 不吃物件位置，要用 translateCanvas 平移；同一個固定種子，所以每塊畫出同一張地圖）
    // 地圖色調（D-114）：荊棘谷是紅褐色乾土＋紫紅荊棘叢，其他沿用森林綠
    const wmp = worldMap(this.stageId) ?? WORLD_MAPS[0]!;
    const tv = wmp.decor === 'thorn';
    const ember = wmp.decor === 'ember';
    const starD = wmp.decor === 'star';
    const P = wmp.palette;
    const paint = (g: Phaser.GameObjects.Graphics, bx0: number, by0: number, bx1: number, by1: number): void => {
      g.fillStyle(P.ground, 1).fillRect(0, 0, W, H);
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
        g.fillStyle(dark ? P.spotA : P.spotB, 0.8).fillEllipse(x, y, ew, eh);
        if (grass) {
          g.lineStyle(2, P.grass, 0.8);
          for (let j = -2; j <= 2; j++) g.lineBetween(x + j * 4, y, x + j * 6, y - 10 - grass[j + 2]!);
        }
      }
      // 毒沼（D-114）：暗綠泥水＋亮綠泡泡＋深色邊（畫在格線下面）
      for (const h of activeHazards(this.s)) {
        const hx = h.x * k;
        const hy = h.y * k;
        const hr2 = h.r * k;
        if (hx + hr2 < bx0 - 40 || hx - hr2 > bx1 + 40 || hy + hr2 < by0 - 40 || hy - hr2 > by1 + 40) continue;
        g.fillStyle(0x0e1608, 0.9).fillEllipse(hx, hy + hr2 * 0.06, hr2 * 2.15, hr2 * 1.95);
        g.fillStyle(0x2c4418, 0.95).fillEllipse(hx, hy, hr2 * 2, hr2 * 1.8);
        g.fillStyle(0x46682a, 0.8).fillEllipse(hx - hr2 * 0.15, hy - hr2 * 0.12, hr2 * 1.3, hr2 * 1.05);
        let bs = Math.round(h.x * 7 + h.y * 13);
        const br = () => ((bs = (bs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
        for (let b = 0; b < 9; b++) {
          const ang = br() * Math.PI * 2;
          const rr = Math.sqrt(br()) * hr2 * 0.75;
          g.fillStyle(0x9adf5a, 0.35 + br() * 0.35).fillCircle(hx + Math.cos(ang) * rr, hy + Math.sin(ang) * rr * 0.9, 3 + br() * 7);
        }
      }
      // 噴發口（D-125）：焦黑火山口＋暗紅熔岩芯（噴發預告另外每幀畫）
      for (const v of STAGES[this.stageId]?.vents ?? []) {
        const vx = v.x * k;
        const vy = v.y * k;
        const vr = v.r * k;
        if (vx + vr < bx0 - 40 || vx - vr > bx1 + 40 || vy + vr < by0 - 40 || vy - vr > by1 + 40) continue;
        if (starD) {
          // 墜星落點（D-138）：被砸出來的淺坑＋放射裂痕＋坑底一塊發光的星晶
          g.fillStyle(0x070812, 0.85).fillEllipse(vx, vy, vr * 2.1, vr * 1.8);
          g.fillStyle(0x1c2140, 1).fillEllipse(vx, vy, vr * 1.5, vr * 1.25);
          g.lineStyle(2, 0x4a5aa0, 0.7);
          for (let t = 0; t < 7; t++) {
            const a2 = (t / 7) * Math.PI * 2 + vx * 0.01;
            g.lineBetween(vx + Math.cos(a2) * vr * 0.7, vy + Math.sin(a2) * vr * 0.6, vx + Math.cos(a2) * vr * 1.15, vy + Math.sin(a2) * vr * 0.98);
          }
          // 坑底的星晶碎塊（菱形，避免看起來像箭頭）
          g.fillStyle(0x6a7ad8, 0.9).fillPoints([new Phaser.Math.Vector2(vx, vy - vr * 0.3), new Phaser.Math.Vector2(vx + vr * 0.17, vy), new Phaser.Math.Vector2(vx, vy + vr * 0.22), new Phaser.Math.Vector2(vx - vr * 0.17, vy)], true);
          g.fillStyle(0xd8e0ff, 0.9).fillPoints([new Phaser.Math.Vector2(vx, vy - vr * 0.18), new Phaser.Math.Vector2(vx + vr * 0.07, vy), new Phaser.Math.Vector2(vx, vy + vr * 0.1), new Phaser.Math.Vector2(vx - vr * 0.07, vy)], true);
          continue;
        }
        g.fillStyle(0x0a0606, 0.9).fillEllipse(vx, vy, vr * 2.2, vr * 1.9);
        g.fillStyle(0x3a1a10, 1).fillEllipse(vx, vy, vr * 1.5, vr * 1.25);
        g.fillStyle(0x8a2a10, 0.9).fillEllipse(vx, vy, vr * 0.8, vr * 0.6);
        g.fillStyle(0xff7a2a, 0.7).fillEllipse(vx, vy, vr * 0.36, vr * 0.26);
        g.lineStyle(2, 0x5a2a18, 0.8).strokeEllipse(vx, vy, vr * 2.0, vr * 1.7);
      }
      g.lineStyle(1, P.grid, 1);
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
          if (rows[cy]![cx] === '#' && dense(cx, cy)) g.fillStyle(P.under, 1).fillRect(cx * c - 1, cy * c - 1, c + 2, c + 2);
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
            g.fillStyle(hr(cx, cy, 4) < 0.5 ? P.crownA : P.crownB, 1).fillCircle(x + c / 2 + ox, y + c / 2 + oy, r);
            g.fillStyle(P.crownHi, 1).fillCircle(x + c / 2 + ox - r * 0.2, y + c / 2 + oy - r * 0.25, r * 0.62);
            g.fillStyle(P.crownTop, 0.7).fillCircle(x + c / 2 + ox - r * 0.35, y + c / 2 + oy - r * 0.4, r * 0.28);
            if (tv) {
              // 荊棘叢：放射狀的刺＋偶爾一顆紅漿果
              g.lineStyle(2, 0xd8c09a, 0.75);
              for (let t = 0; t < 4; t++) {
                const ang = hr(cx, cy, 10 + t) * Math.PI * 2;
                const bx = x + c / 2 + ox + Math.cos(ang) * r * 0.7;
                const by = y + c / 2 + oy + Math.sin(ang) * r * 0.7;
                g.lineBetween(bx, by, bx + Math.cos(ang) * r * 0.45, by + Math.sin(ang) * r * 0.45);
              }
              if (hr(cx, cy, 15) < 0.25) g.fillStyle(0xff4a5a, 0.9).fillCircle(x + c / 2 + ox + r * 0.25, y + c / 2 + oy + r * 0.1, r * 0.12);
            }
            if (starD && hr(cx, cy, 30) < 0.85) {
              // 星晶（D-138）：樹冠位置長出一簇藍紫色晶柱（亮面＋白色稜線）
              const bx = x + c / 2 + ox;
              const by = y + c / 2 + oy + r * 0.2;
              for (let t = 0; t < 3; t++) {
                const lean = (hr(cx, cy, 31 + t) - 0.5) * r * 0.9;
                const hh = r * (0.9 + hr(cx, cy, 34 + t) * 0.8);
                const ww = r * 0.22;
                const px = bx + (t - 1) * r * 0.42;
                g.fillStyle(t === 1 ? 0x7a86e0 : 0x5a62b8, 1).fillTriangle(px - ww, by, px + ww, by, px + lean, by - hh);
                g.fillStyle(0xc8d4ff, 0.75).fillTriangle(px - ww * 0.2, by, px + ww * 0.5, by, px + lean, by - hh);
              }
            }
            if (ember && hr(cx, cy, 20) < 0.4) {
              // 燼岩（D-125）：玄武岩上發光的熔岩裂紋（外層暗橘、內層亮黃）
              const ang = hr(cx, cy, 21) * Math.PI;
              const x0 = x + c / 2 + ox - Math.cos(ang) * r * 0.7;
              const y0 = y + c / 2 + oy - Math.sin(ang) * r * 0.7;
              const xm = x + c / 2 + ox + (hr(cx, cy, 22) - 0.5) * r * 0.5;
              const ym = y + c / 2 + oy + (hr(cx, cy, 23) - 0.5) * r * 0.5;
              const x1 = x + c / 2 + ox + Math.cos(ang) * r * 0.7;
              const y1 = y + c / 2 + oy + Math.sin(ang) * r * 0.7;
              g.lineStyle(5, 0xc8401a, 0.55).lineBetween(x0, y0, xm, ym).lineBetween(xm, ym, x1, y1);
              g.lineStyle(2, 0xffb04a, 0.9).lineBetween(x0, y0, xm, ym).lineBetween(xm, ym, x1, y1);
            }
            continue;
          }
          const j = hr(cx, cy, 5) * 0.12;
          if (starD) {
            // 星隕高原的零星晶柱（D-138）：影子＋三根發光晶柱
            g.fillStyle(0x04050c, 0.6).fillEllipse(x + c * 0.55, y + c * 0.82, c * 1.05, c * 0.4);
            g.fillStyle(0x3a3e7a, 1).fillTriangle(x + c * 0.12, y + c * 0.86, x + c * 0.5, y + c * 0.86, x + c * 0.26, y + c * 0.2);
            g.fillStyle(0x6a76d0, 1).fillTriangle(x + c * 0.3, y + c * 0.9, x + c * 0.74, y + c * 0.9, x + c * (0.5 + j), y - c * 0.1);
            g.fillStyle(0x4a52a0, 1).fillTriangle(x + c * 0.6, y + c * 0.88, x + c * 0.92, y + c * 0.88, x + c * 0.82, y + c * 0.36);
            g.fillStyle(0xd8e0ff, 0.8).fillTriangle(x + c * 0.48, y + c * 0.9, x + c * 0.6, y + c * 0.9, x + c * (0.5 + j), y - c * 0.1);
            continue;
          }
          if (ember) {
            // 燼岩的零星岩柱：黑色玄武岩＋一道熔岩裂紋（不長青苔）
            g.fillStyle(0x050303, 0.6).fillEllipse(x + c * 0.55, y + c * 0.8, c * 1.05, c * 0.4);
            g.fillStyle(0x221c1a, 1).fillRoundedRect(x + c * (0.06 + j), y + c * 0.04, c * (0.88 - j), c * 0.88, c * 0.2);
            g.fillStyle(0x3a302c, 1).fillRoundedRect(x + c * (0.14 + j), y + c * 0.08, c * (0.6 - j), c * 0.4, c * 0.16);
            g.lineStyle(4, 0xc8401a, 0.6).lineBetween(x + c * 0.3, y + c * 0.3, x + c * 0.55, y + c * 0.75);
            g.lineStyle(2, 0xffb04a, 0.95).lineBetween(x + c * 0.3, y + c * 0.3, x + c * 0.55, y + c * 0.75);
            continue;
          }
          g.fillStyle(0x050a07, 0.55).fillEllipse(x + c * 0.55, y + c * 0.78, c * 1.05, c * 0.42);
          g.fillStyle(0x4a4f52, 1).fillRoundedRect(x + c * (0.04 + j), y + c * 0.06, c * (0.92 - j), c * 0.86, c * 0.28);
          g.fillStyle(0x6c7378, 1).fillRoundedRect(x + c * (0.12 + j), y + c * 0.1, c * (0.7 - j), c * 0.46, c * 0.22);
          g.fillStyle(0x8d959a, 0.8).fillEllipse(x + c * 0.36, y + c * 0.24, c * 0.3, c * 0.12);
          g.lineStyle(2, 0x2c3033, 0.9).lineBetween(x + c * (0.3 + j), y + c * 0.5, x + c * 0.5, y + c * 0.68);
          if (hr(cx, cy, 6) < 0.5) g.fillStyle(0x3f6b3a, 0.85).fillEllipse(x + c * (0.2 + hr(cx, cy, 7) * 0.5), y + c * 0.84, c * 0.28, c * 0.1);
        }
      }
      g.lineStyle(10, 0x0a120d, 1).strokeRect(-5, -5, W + 10, H + 10);
      g.lineStyle(3, P.edge, 1).strokeRect(0, 0, W, H);
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
    const sk = skillDef(this.s, a.id);
    if (!sk) return;
    const k = this.s.tick - a.start;
    sk.hits.forEach((h, i) => {
      const key = `${a.start}:${i}`;
      if (k < h.atTick || this.fxDone.has(key)) return;
      this.fxDone.add(key);
      const ang = Math.atan2(a.dirY, a.dirX);
      const big = h.mult >= 150;
      const hs = skillShape(this.s, a.id, h.shape); // 裝備的範圍特效（D-098）
      if (this.s.weapon === 'bow') {
        this.bowFx(p.x, p.y, ang, hs, sk.role === 'ult', !!sk.dash, h.status?.id === 'break', h.status?.id === 'freeze', h.status?.id);
        return;
      }
      if (this.s.weapon === 'staff') {
        this.staffFx(p.x + ((h.ahead ?? 0) * a.dirX) / 1000, p.y + ((h.ahead ?? 0) * a.dirY) / 1000, ang, hs, sk.role === 'ult', sk.hits.length === 1, sk.dash ? Math.sign(sk.dash.distance) * (k >= sk.dash.fromTick + sk.dash.ticks ? 1 : 0) : 0, h.status?.id);
        return;
      }
      if (sk.dash) {
        // 衝鋒：身後殘影線
        const g = this.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
        const L = 90 * this.k;
        const px = this.sx(p.x);
        const py = this.sy(p.y);
        for (let j = -1; j <= 1; j++) {
          g.lineStyle(4 - Math.abs(j), h.status?.id === 'weak' ? 0xc0a0ff : 0x9fd8ff, 0.8).lineBetween(px - Math.sin(ang) * j * 14, py + Math.cos(ang) * j * 14, px - Math.cos(ang) * L - Math.sin(ang) * j * 14, py - Math.sin(ang) * L + Math.cos(ang) * j * 14);
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
        // 流星衝（D-112）：衝到底的落地爆炸（非 oncePerTarget 的圓）
        if (hs.type === 'circle' && !h.oncePerTarget) {
          shockRing(this, this.sx(p.x), this.sy(p.y), 0x9fd8ff, hs.r * this.k * 1.2, 380, 10);
          sparks(this, this.sx(p.x), this.sy(p.y), 18, 'spark', 0xd8f0ff, 520);
          this.cameras.main.shake(140, 0.007);
        }
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
      } else if (hs.type === 'line') {
        this.groundSplit(p.x, p.y, ang, hs.len, hs.width);
      }
      // 星落一閃（D-112）：單發大招 → 天上落下一道光柱
      if (sk.role === 'ult' && sk.hits.length === 1 && hs.type !== 'line') this.starfall(p.x, p.y, hs.type === 'circle' ? hs.r : UNIT * 3);
      // 變化二（D-121）：帶狀態的招式多一層顏色——霜旋寒氣、碎甲／斬月紅色碎光、影步紫色殘影
      const st = h.status?.id;
      if (st === 'freeze') {
        this.spawnFrost(p.x, p.y, hs.type === 'circle' ? hs.r : UNIT * 2);
        shockRing(this, this.sx(p.x), this.sy(p.y), 0xbff4ff, (hs.type === 'circle' ? hs.r : UNIT * 2) * this.k * 1.15, 520, 10);
        sparks(this, this.sx(p.x), this.sy(p.y), 26, 'spark', 0xd8fbff, 700);
        this.cameras.main.flash(90, 190, 240, 255);
      } else if (st === 'break' && big) {
        const fx = this.sx(p.x) + Math.cos(ang) * UNIT * 1.4 * this.k;
        const fy = this.sy(p.y) + Math.sin(ang) * UNIT * 1.4 * this.k;
        sparks(this, fx, fy, sk.role === 'ult' ? 30 : 16, 'ember', 0xff6a4a, 560);
        if (sk.role === 'ult') {
          if (hs.type === 'line') this.moonArc(p.x, p.y, ang, hs.len, hs.width);
          this.cameras.main.shake(220, 0.01);
          this.hitStop = Math.max(this.hitStop, 120);
        }
      } else if (st === 'weak') sparks(this, this.sx(p.x), this.sy(p.y), 8, 'ember', 0xb08aff, 360);
    });
  }

  /** 熔岩裂地（D-125）：命中範圍裡裂出發光的熔岩紋＋火星，1.4 秒冷卻變暗（純畫面） */
  private spawnLava(t: Telegraph): void {
    const sh = t.shape;
    const g = this.add.graphics().setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    const lines: [number, number][][] = [];
    const zig = (x0: number, y0: number, x1: number, y1: number, n: number, amp: number): [number, number][] => {
      const pts: [number, number][] = [];
      const nx = -(y1 - y0);
      const ny = x1 - x0;
      const L = Math.hypot(nx, ny) || 1;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const o = i === 0 || i === n ? 0 : (Math.random() - 0.5) * amp;
        pts.push([x0 + (x1 - x0) * f + (nx / L) * o, y0 + (y1 - y0) * f + (ny / L) * o]);
      }
      return pts;
    };
    if (sh.type === 'line') {
      const ex = t.ox + (t.dirX / 1000) * sh.len;
      const ey = t.oy + (t.dirY / 1000) * sh.len;
      lines.push(zig(t.ox, t.oy, ex, ey, 9, sh.width * 0.5));
      for (let i = 0; i < 4; i++) {
        const f = 0.2 + Math.random() * 0.7;
        const bx = t.ox + (ex - t.ox) * f;
        const by = t.oy + (ey - t.oy) * f;
        const a = Math.atan2(ey - t.oy, ex - t.ox) + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.6);
        lines.push(zig(bx, by, bx + Math.cos(a) * sh.width * 0.9, by + Math.sin(a) * sh.width * 0.9, 3, sh.width * 0.2));
      }
    } else if (sh.type === 'circle' || sh.type === 'ring') {
      const r0 = sh.type === 'ring' ? sh.rIn : sh.r * 0.15;
      const r1 = sh.type === 'ring' ? sh.rOut : sh.r;
      const n = sh.type === 'ring' ? 10 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        lines.push(zig(t.ox + Math.cos(a) * r0, t.oy + Math.sin(a) * r0, t.ox + Math.cos(a) * r1, t.oy + Math.sin(a) * r1, 4, (r1 - r0) * 0.25));
      }
    } else return;
    const draw = (heat: number) => {
      g.clear();
      for (const pts of lines) {
        const v = pts.map(([x, y]) => new Phaser.Math.Vector2(this.sx(x), this.sy(y)));
        g.lineStyle(16, 0xc8401a, 0.35 * heat).strokePoints(v, false);
        g.lineStyle(7, 0xff7a2a, 0.85 * heat).strokePoints(v, false);
        g.lineStyle(2.5, 0xffe6a0, heat).strokePoints(v, false);
      }
    };
    draw(1);
    const o = { h: 1 };
    // 跟著鏡頭：每幀用世界座標重畫（1.4 秒）
    this.tweens.add({ targets: o, h: 0, duration: 1400, ease: 'Quad.easeIn', onUpdate: () => draw(o.h), onComplete: () => g.destroy() });
    sparks(this, this.sx(t.ox), this.sy(t.oy), 14, 'ember', 0xff8a3a, 520);
  }

  /** 噴發口預告（D-125）：平常熔岩芯微微發光；噴發前 warnTicks 圈內越來越亮、外圈收縮 */
  private drawVents(g: Phaser.GameObjects.Graphics, now: number): void {
    const vs = STAGES[this.stageId]?.vents;
    if (!vs?.length) return;
    const pl = playerOf(this.s);
    for (const v of vs) {
      if (Math.abs(v.x - pl.x) > UNIT * 12 || Math.abs(v.y - pl.y) > UNIT * 16) continue;
      const vx = this.sx(v.x);
      const vy = this.sy(v.y);
      const vr = v.r * this.k;
      const left = ventLeft(this.s.tick, v, this.s.night);
      // 墜星（D-138）用藍白色，其他是熔岩橘
      const C = this.starMap ? [0x8aa8ff, 0x6a86ff, 0xe0e8ff, 0xc8d8ff, 0xffffff] : [0xff7a2a, 0xff5a1a, 0xffc04a, 0xffd08a, 0xffe0b0];
      g.fillStyle(C[0]!, 0.12 + 0.06 * Math.sin(now / 300 + v.x)).fillEllipse(vx, vy, vr * 1.1, vr * 0.9);
      if (this.starMap) {
        // 星光碎片（D-141）：落點中央一塊發光的星晶，上下浮動、閃爍；最後 1.5 秒淡出
        const sh = this.s.shards?.find((q) => vs[q.idx] === v);
        if (sh) {
          const life = sh.until - this.s.tick;
          const a = Math.min(1, life / (1.5 * TICKS_PER_SEC));
          const bob = Math.sin(now / 180 + v.x) * 6;
          const sz = 16 + 3 * Math.sin(now / 120);
          g.fillStyle(0x8aa8ff, 0.3 * a).fillCircle(vx, vy - 18 + bob, sz * 2.2);
          g.fillStyle(0xc8d8ff, 0.95 * a).fillPoints([new Phaser.Math.Vector2(vx, vy - 18 + bob - sz * 1.4), new Phaser.Math.Vector2(vx + sz * 0.7, vy - 18 + bob), new Phaser.Math.Vector2(vx, vy - 18 + bob + sz), new Phaser.Math.Vector2(vx - sz * 0.7, vy - 18 + bob)], true);
          g.fillStyle(0xffffff, a).fillCircle(vx - sz * 0.15, vy - 18 + bob - sz * 0.3, sz * 0.25);
        }
      }
      if (left > v.warnTicks) continue;
      const t = 1 - left / v.warnTicks; // 0 → 1
      g.fillStyle(C[1]!, 0.12 + 0.3 * t).fillCircle(vx, vy, vr);
      g.fillStyle(C[2]!, 0.1 + 0.35 * t * t).fillCircle(vx, vy, vr * (0.3 + 0.5 * t));
      g.lineStyle(3, C[3]!, 0.5 + 0.5 * t).strokeCircle(vx, vy, vr);
      g.lineStyle(2, C[4]!, 0.8).strokeCircle(vx, vy, vr * (1.6 - 0.6 * t));
      if (this.starMap) {
        // 星星從右上方的夜空落下：越接近落地越靠近、越亮（最後 0.5 秒才看得到）
        this.fallingStar(g, vx, vy, Math.max(0, (t - 0.5) / 0.5));
      }
    }
  }

  /** 從右上方夜空落下的星星（f：0 → 1，1＝落地）；墜星與守望者的召喚墜星共用 */
  private fallingStar(g: Phaser.GameObjects.Graphics, vx: number, vy: number, f: number): void {
    if (f <= 0) return;
    const d = (1 - f * f) * 560;
    const hx = vx + d * 0.55;
    const hy = vy - d;
    g.lineStyle(18, 0x6a86ff, 0.3 * f).lineBetween(hx, hy, hx + 110, hy - 200);
    g.lineStyle(8, 0xa8c0ff, 0.6 * f).lineBetween(hx, hy, hx + 80, hy - 145);
    g.lineStyle(3, 0xffffff, 0.95 * f).lineBetween(hx, hy, hx + 50, hy - 90);
    g.fillStyle(0x8aa8ff, 0.35 * f).fillCircle(hx, hy, 22 + 10 * f);
    g.fillStyle(0xffffff, f).fillCircle(hx, hy, 9 + 6 * f);
  }

  /** 墜星落地的爆開（白色閃光＋藍色衝擊環＋碎星） */
  private starImpact(vx: number, vy: number, r: number): void {
    sparks(this, vx, vy, 22, 'spark', 0xc8d8ff, 640);
    sparks(this, vx, vy - 16, 10, 'ember', 0x8aa8ff, 820);
    shockRing(this, vx, vy, 0x8aa8ff, r * 1.3, 380, 8);
    shockRing(this, vx, vy, 0xffffff, r * 0.8, 240, 4);
    const fl = this.add.circle(vx, vy, r * 1.1, 0xe0e8ff, 0.7).setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: fl, scale: 1.5, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => fl.destroy() });
  }

  /** 碎甲斬命中（第 26 輪）：敵人身上迸出 6～9 片紅褐盾片，旋轉、往外飛、落地淡出（純畫面） */
  private shatter(x: number, y: number, r: number): void {
    const n = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const g = this.add.graphics().setDepth(795);
      const sz = (9 + Math.random() * 8) * Math.max(0.8, r / 40);
      const col = i % 3 === 0 ? 0xffb09a : i % 3 === 1 ? 0xd04a32 : 0x8a2e1e;
      g.fillStyle(col, 1).fillTriangle(-sz, -sz * 0.6, sz * 0.9, -sz * 0.3, -sz * 0.2, sz);
      g.lineStyle(2, 0x2a0a00, 0.9).strokeTriangle(-sz, -sz * 0.6, sz * 0.9, -sz * 0.3, -sz * 0.2, sz);
      g.setPosition(x, y).setRotation(Math.random() * Math.PI * 2);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = r * (1.4 + Math.random() * 1.4);
      const ex = x + Math.cos(a) * d;
      const ey = y + Math.sin(a) * d * 0.55 + r * 0.8; // 往外飛、最後掉到腳邊
      this.tweens.add({ targets: g, x: ex, duration: 520, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: g, y: { from: y, to: ey }, duration: 520, ease: 'Back.easeIn' });
      this.tweens.add({ targets: g, rotation: g.rotation + (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4), duration: 520 });
      this.tweens.add({ targets: g, alpha: 0, delay: 620, duration: 380, onComplete: () => g.destroy() });
    }
    shockRing(this, x, y, 0xff6a4a, r * 1.8, 260, 5);
    floatNumber(this, x, y - r * 0.8, '破甲', { color: '#ff8a6a', size: 22 });
  }

  /** 影步（變化二）殘影（第 26 輪）：衝刺中每 45ms 在原地留一個紫色分身，0.35 秒淡出 */
  private shadowGhost(p: Unit, sp: Phaser.GameObjects.Image, now: number): void {
    const a = p.action;
    if (!a || a.kind !== 'skill' || now - this.ghostAt < 45) return;
    const sk = skillDef(this.s, a.id);
    if (!sk?.dash || !sk.hits.some((h) => h.status?.id === 'weak')) return;
    this.ghostAt = now;
    const gh = this.add.image(sp.x, sp.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(sp.scaleX, sp.scaleY).setFlipX(sp.flipX).setDepth(sp.depth - 0.5).setTint(0x7a4aff).setAlpha(0.5);
    this.tweens.add({ targets: gh, alpha: 0, scaleX: sp.scaleX * 1.08, duration: 350, ease: 'Cubic.easeOut', onComplete: () => gh.destroy() });
  }

  /** 法杖擋下攻擊（第 34 輪）：身邊一圈六角形星輝護盾亮起、碎成光點（純畫面） */
  /** 世界座標在不在畫面裡（含一點邊界；短命特效用，畫面外就不產生粒子） */
  private onScreen(x: number, y: number): boolean {
    const px = this.sx(x);
    const py = this.sy(y);
    return px > -80 && px < GAME_WIDTH + 80 && py > VIEW_TOP - 80 && py < VIEW_BOTTOM + 80;
  }

  /** 灼燒每跳一次：身上往上竄幾顆火星（第 35 輪；純畫面） */
  private emberPuff(x: number, y: number): void {
    const p = this.add.particles(x, y, 'ember', {
      speed: { min: 40, max: 110 }, angle: { min: 245, max: 295 }, gravityY: -120,
      scale: { start: 0.9, end: 0 }, lifespan: { min: 380, max: 700 }, blendMode: Phaser.BlendModes.ADD, emitting: false,
    });
    p.setDepth(800);
    p.explode(getSettings().lowFx ? 2 : 5, 0, 0);
    this.time.delayedCall(800, () => p.destroy());
  }

  /**
   * 時間凝滯（法杖變化二的格擋，第 35 輪）：地上浮出一面鐘——12 道刻度、兩根指針飛快倒轉後停住，再整面碎成冰藍光點。純畫面。
   */
  private timeClock(x: number, y: number, rUnits: number): void {
    const vx = this.sx(x);
    const vy = this.sy(y);
    const R = rUnits * this.k;
    const g = this.add.graphics().setDepth(689).setBlendMode(Phaser.BlendModes.ADD).setPosition(vx, vy);
    const col = 0xa8ecff;
    this.tweens.addCounter({ from: 0, to: 1, duration: 900, onUpdate: (tw) => {
      const t = tw.getValue() ?? 1;
      const grow = Math.min(1, t * 4);
      const rr = R * (0.6 + 0.4 * grow);
      g.clear();
      g.fillStyle(0x6ab8ff, 0.1 * grow).fillEllipse(0, 0, rr * 2, rr * 1.2);
      g.lineStyle(5, col, 0.85 * grow).strokeEllipse(0, 0, rr * 2, rr * 1.2).lineStyle(2, 0xffffff, 0.5 * grow).strokeEllipse(0, 0, rr * 1.75, rr * 1.05);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r0 = rr * (i % 3 === 0 ? 0.72 : 0.8);
        g.lineStyle(i % 3 === 0 ? 4 : 2, 0xe8fcff, 0.9 * grow).lineBetween(Math.cos(a) * r0, Math.sin(a) * r0 * 0.6, Math.cos(a) * rr * 0.9, Math.sin(a) * rr * 0.9 * 0.6);
      }
      // 指針：前 60% 飛快倒轉（減速），之後停在 12 點
      const spin = t < 0.6 ? (1 - t / 0.6) ** 2 * Math.PI * 6 : 0;
      const am = -Math.PI / 2 - spin;
      const ah = -Math.PI / 2 - spin / 12 - Math.PI / 6;
      g.lineStyle(5, 0xffffff, grow).lineBetween(0, 0, Math.cos(am) * rr * 0.68, Math.sin(am) * rr * 0.68 * 0.6);
      g.lineStyle(7, col, grow).lineBetween(0, 0, Math.cos(ah) * rr * 0.45, Math.sin(ah) * rr * 0.45 * 0.6);
      g.fillStyle(0xffffff, grow).fillCircle(0, 0, 7);
      g.setAlpha(t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25);
    }, onComplete: () => {
      g.destroy();
      sparks(this, vx, vy, 18, 'spark', col, 420);
    } });
    this.cameras.main.flash(80, 170, 220, 255);
    SFX.timeStop();
  }

  /**
   * 虛空奇點（法杖變化二的大招，第 35 輪）：中央一顆黑洞＋紫色吸積環，周圍的光點被吸進去。
   * 每段命中呼叫一次，同一次施放共用同一個黑洞（`voidFx` 存著，最後一段後 0.5 秒收掉）。純畫面。
   */
  private voidFx: { g: Phaser.GameObjects.Graphics; until: number; x: number; y: number; R: number; motes: { a: number; d: number; v: number }[] } | null = null;
  private voidHole(x: number, y: number, rUnits: number): void {
    const now = this.time.now;
    if (this.voidFx && this.voidFx.g.active) {
      const v = this.voidFx;
      v.until = now + 650;
      v.x = x;
      v.y = y;
      for (let i = 0; i < 4; i++) v.motes.push({ a: Math.random() * Math.PI * 2, d: 1, v: 0.9 + Math.random() * 0.8 });
      this.cameras.main.shake(50, 0.003);
      return;
    }
    const g = this.add.graphics().setDepth(691);
    const v = (this.voidFx = { g, until: now + 650, x, y, R: rUnits * this.k, motes: [] as { a: number; d: number; v: number }[] });
    for (let i = 0; i < 14; i++) v.motes.push({ a: Math.random() * Math.PI * 2, d: 0.4 + Math.random() * 0.6, v: 0.9 + Math.random() * 0.8 });
    let last = now;
    const tick = (): void => {
      if (!g.active) return;
      const t = this.time.now;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const fade = Math.max(0, Math.min(1, (v.until - t) / 300));
      if (fade <= 0) {
        g.destroy();
        if (this.voidFx === v) this.voidFx = null;
        sparks(this, this.sx(v.x), this.sy(v.y) - 30, 14, 'spark', 0xc89aff, 380);
        return;
      }
      const cx = this.sx(v.x);
      const cy = this.sy(v.y) - 30;
      const R = v.R;
      const core = R * 0.16 * (0.6 + 0.4 * fade);
      g.clear();
      // 外圈：被扭曲的淡紫色漩渦（三條旋臂）
      for (let arm = 0; arm < 3; arm++) {
        const pts: { x: number; y: number }[] = [];
        for (let q = 0; q <= 14; q++) {
          const f = q / 14;
          const a = t / 260 + arm * ((Math.PI * 2) / 3) + f * 3.2;
          const rr = core + (R * 0.85 - core) * f;
          pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.6 });
        }
        g.lineStyle(9, 0x8a5aff, 0.35 * fade).strokePoints(pts, false);
        g.lineStyle(3, 0xd8c0ff, 0.7 * fade).strokePoints(pts, false);
      }
      // 被吸進去的光點：越靠近越快
      for (const m of v.motes) {
        m.d -= dt * m.v * (1.3 - m.d);
        m.a += dt * (2.5 / Math.max(0.15, m.d));
        if (m.d <= 0.12) {
          m.d = 0.8 + Math.random() * 0.25;
          m.a = Math.random() * Math.PI * 2;
        }
        const mx = cx + Math.cos(m.a) * R * m.d;
        const my = cy + Math.sin(m.a) * R * m.d * 0.6;
        g.fillStyle(0xe8d8ff, fade * Math.min(1, m.d * 2)).fillCircle(mx, my, 3 + 3 * m.d);
      }
      // 吸積環＋黑洞本體（最後畫，蓋在最上面）
      g.lineStyle(8, 0xb070ff, 0.75 * fade).strokeEllipse(cx, cy, core * 3.2, core * 1.5);
      g.lineStyle(3, 0xffffff, 0.8 * fade).strokeEllipse(cx, cy, core * 2.9, core * 1.3);
      g.fillStyle(0x05010c, fade).fillCircle(cx, cy, core);
      g.lineStyle(2, 0xd8b0ff, 0.9 * fade).strokeCircle(cx, cy, core + 1);
      this.time.delayedCall(16, tick);
    };
    tick();
    SFX.voidOpen();
    shockRing(this, this.sx(x), this.sy(y) - 30, 0x8a5aff, v.R, 400, 6);
    this.cameras.main.shake(120, 0.005);
  }

  /**
   * 抉擇的痕跡（D-157，第 35 輪）：Boss 巢穴旁留下你選擇的結果——還：霧裡的小狼／母樹的白花／還在燒的燼心；
   * 取：斷掉的霧角石座／枯掉的荊棘／冷掉的黑岩。走近時說一句話（每次進地圖一次）。純畫面。
   */
  private choiceMarkSaid = false;
  /** 霧中小狼（D-157：霧語森林選了「還」）：半透明、跟在你身後，戰鬥時躲進霧裡（變淡）。純畫面 */
  private cub: { x: number; y: number; a: number; t: number; face: number; kind: 'cub' | 'flower' | 'wisp' | 'star' } | null = null;
  private drawCub(g: Phaser.GameObjects.Graphics, now: number): void {
    const c = this.cub;
    if (!c) return;
    const p = playerOf(this.s);
    const dt = Math.min(0.1, Math.max(0, (now - c.t) / 1000));
    c.t = now;
    const fl = Math.hypot(p.facingX, p.facingY) || 1;
    const fx = p.facingX / fl;
    const fy = p.facingY / fl;
    const tx = p.x - fx * UNIT * 1.1 + fy * UNIT * 0.5;
    const ty = p.y - fy * UNIT * 1.1 - fx * UNIT * 0.5;
    const d = Math.hypot(tx - c.x, ty - c.y);
    if (d > UNIT * 12) {
      c.x = tx;
      c.y = ty;
    } else if (d > UNIT * 0.3) {
      const k0 = Math.min(1, dt * (d > UNIT * 3 ? 5 : 2.5));
      if (Math.abs(tx - c.x) > 4) c.face = tx > c.x ? 1 : -1;
      c.x += (tx - c.x) * k0;
      c.y += (ty - c.y) * k0;
    }
    const fight = p.dead || enemiesOf(this.s).some((e) => e.mode === 'combat');
    c.a += ((fight ? 0.08 : 0.5) - c.a) * Math.min(1, dt * 3);
    const cx = this.sx(c.x);
    const cy = this.sy(c.y);
    if (cx < -60 || cx > GAME_WIDTH + 60 || cy < VIEW_TOP - 80 || cy > VIEW_BOTTOM + 60) return;
    const k = this.k * 1.7;
    const moving = d > UNIT * 0.4;
    if (c.kind !== 'cub') {
      // 荊棘谷＝母樹的白花精（浮著轉）、燼紅裂谷＝燼心的小火靈（跳動的火球）
      const bob = Math.sin(now / 400) * 6 * k;
      const hy = cy - 40 * k + bob;
      if (c.kind === 'star') {
        // 星隕高原＝回到夜空的那顆星留下的小星星：四芒星慢慢轉、拖一道淡藍光尾（D-158）
        const tw = 0.75 + 0.25 * Math.sin(now / 230);
        const rot = now / 1400;
        g.fillStyle(0x9fc8ff, c.a * 0.3 * tw).fillCircle(cx, hy, 26 * k);
        if (moving) g.fillStyle(0xbcd8ff, c.a * 0.35).fillEllipse(cx - c.face * 16 * k, hy + 3 * k, 26 * k, 6 * k);
        const al = Math.min(1, c.a * 1.9);
        for (let q = 0; q < 4; q++) {
          const an = rot + (q * Math.PI) / 2;
          const L = (q % 2 ? 13 : 20) * k * tw;
          const ox = Math.cos(an);
          const oy = Math.sin(an);
          g.fillStyle(0xeaf4ff, al).fillTriangle(cx + ox * L, hy + oy * L, cx - oy * 4 * k, hy + ox * 4 * k, cx + oy * 4 * k, hy - ox * 4 * k);
        }
        g.fillStyle(0xffffff, al).fillCircle(cx, hy, 4.5 * k);
      } else if (c.kind === 'flower') {
        g.fillStyle(0xffffff, c.a * 0.3).fillCircle(cx, hy, 18 * k);
        for (let q = 0; q < 5; q++) {
          const an = (q / 5) * Math.PI * 2 + now / 900;
          g.fillStyle(0xf8f4ff, c.a * 1.6 > 1 ? 1 : c.a * 1.6).fillEllipse(cx + Math.cos(an) * 7 * k, hy + Math.sin(an) * 6 * k, 10 * k, 8 * k);
        }
        g.fillStyle(0xffe08a, Math.min(1, c.a * 2)).fillCircle(cx, hy, 3.5 * k);
      } else {
        const beat = Math.max(0, Math.sin(now / 160)) ** 3;
        g.fillStyle(0xff8a3a, c.a * 0.35).fillCircle(cx, hy, (16 + 4 * beat) * k);
        g.fillStyle(0xff6a1a, Math.min(1, c.a * 1.8)).fillTriangle(cx - 7 * k, hy + 3 * k, cx + 7 * k, hy + 3 * k, cx + Math.sin(now / 120) * 3 * k, hy - 16 * k);
        g.fillStyle(0xff6a1a, Math.min(1, c.a * 1.8)).fillCircle(cx, hy + 2 * k, 7 * k);
        g.fillStyle(0xffd04a, Math.min(1, c.a * 2)).fillCircle(cx, hy + 2 * k, 3.5 * k);
      }
      g.fillStyle(0x000000, c.a * 0.3).fillEllipse(cx, cy, 20 * k, 6 * k);
      return;
    }
    const hop = moving ? Math.abs(Math.sin(now / 110)) * 5 * k : 0;
    const f = c.face;
    const a = c.a * (0.85 + 0.15 * Math.sin(now / 500));
    g.fillStyle(0xcfe4ff, a * 0.25).fillEllipse(cx, cy - 12 * k, 64 * k, 34 * k);
    g.fillStyle(0xd8e8ff, a).fillEllipse(cx, cy - 12 * k - hop, 30 * k, 20 * k);
    g.fillCircle(cx + f * 13 * k, cy - 24 * k - hop, 10 * k);
    g.fillTriangle(cx + f * 8 * k, cy - 30 * k - hop, cx + f * 10 * k, cy - 42 * k - hop, cx + f * 14 * k, cy - 31 * k - hop);
    g.fillTriangle(cx + f * 14 * k, cy - 31 * k - hop, cx + f * 18 * k, cy - 42 * k - hop, cx + f * 20 * k, cy - 28 * k - hop);
    const sw = Math.sin(now / (moving ? 90 : 300)) * 5 * k;
    g.lineStyle(5 * k, 0xd8e8ff, a).lineBetween(cx - f * 13 * k, cy - 14 * k - hop, cx - f * 24 * k, cy - 24 * k - hop + sw);
    g.fillStyle(0x6ab8ff, Math.min(1, a * 1.8)).fillCircle(cx + f * 16 * k, cy - 26 * k - hop, 1.8 * k);
  }
  private drawChoiceMark(g: Phaser.GameObjects.Graphics, now: number): void {
    if (!this.choiceMark) return;
    const { x, y, map, pick } = this.choiceMark;
    const cx = this.sx(x);
    const cy = this.sy(y);
    if (cx < -100 || cx > GAME_WIDTH + 100 || cy < VIEW_TOP - 140 || cy > VIEW_BOTTOM + 100) return;
    const k = this.k * 2.6;
    const t = now / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    g.fillStyle(0x000000, 0.3).fillEllipse(cx, cy + 4 * k, 70 * k, 18 * k);
    if (map === 'mistwood' && pick === 'spare') {
      // 霧裡的小狼：半透明、坐著、尾巴輕輕擺
      const a = 0.45 + 0.15 * pulse;
      g.fillStyle(0xcfe4ff, 0.18 * pulse).fillEllipse(cx, cy - 18 * k, 90 * k, 50 * k);
      g.fillStyle(0xd8e8ff, a).fillEllipse(cx, cy - 14 * k, 34 * k, 28 * k);
      g.fillCircle(cx + 6 * k, cy - 36 * k, 13 * k);
      g.fillTriangle(cx - 2 * k, cy - 44 * k, cx + 3 * k, cy - 58 * k, cx + 7 * k, cy - 46 * k);
      g.fillTriangle(cx + 8 * k, cy - 46 * k, cx + 14 * k, cy - 58 * k, cx + 17 * k, cy - 42 * k);
      const sw = Math.sin(t * 3) * 6 * k;
      g.lineStyle(6 * k, 0xd8e8ff, a).lineBetween(cx - 14 * k, cy - 6 * k, cx - 28 * k + sw, cy - 20 * k);
      g.fillStyle(0x6ab8ff, 0.9).fillCircle(cx + 10 * k, cy - 38 * k, 2 * k);
    } else if (map === 'mistwood') {
      // 斷掉的霧角留下的石座：灰石＋一截冷掉的角根
      g.fillStyle(0x4a4e58, 1).fillRoundedRect(cx - 22 * k, cy - 16 * k, 44 * k, 18 * k, 5 * k);
      g.fillStyle(0x8a8478, 1).fillTriangle(cx - 6 * k, cy - 16 * k, cx + 8 * k, cy - 16 * k, cx + 2 * k, cy - 34 * k);
      g.lineStyle(2 * k, 0x2a2c32, 1).lineBetween(cx - 2 * k, cy - 30 * k, cx + 4 * k, cy - 22 * k);
    } else if (map === 'thornvale' && pick === 'spare') {
      // 母樹的白花：三朵五瓣白花，花心淡金，微微發光
      for (let i = 0; i < 3; i++) {
        const fx = cx + (i - 1) * 20 * k;
        const fy = cy - (8 + (i % 2) * 10) * k;
        g.lineStyle(2 * k, 0x5a8a4a, 1).lineBetween(fx, fy, fx, cy);
        g.fillStyle(0xffffff, 0.12 + 0.12 * pulse).fillCircle(fx, fy, 16 * k);
        for (let q = 0; q < 5; q++) {
          const a = (q / 5) * Math.PI * 2 + t * 0.3;
          g.fillStyle(0xf8f4ff, 1).fillEllipse(fx + Math.cos(a) * 6 * k, fy + Math.sin(a) * 5 * k, 9 * k, 7 * k);
        }
        g.fillStyle(0xffe08a, 1).fillCircle(fx, fy, 3 * k);
      }
    } else if (map === 'thornvale') {
      // 根鬚斷掉的地方：枯掉的褐色荊棘
      g.lineStyle(3 * k, 0x6a4a2a, 1);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.45;
        g.lineBetween(cx, cy, cx + Math.cos(a) * 26 * k, cy + Math.sin(a) * 26 * k);
      }
      g.fillStyle(0x4a3220, 1).fillEllipse(cx, cy - 2 * k, 26 * k, 10 * k);
    } else if (map === 'emberrift' && pick === 'spare') {
      // 還在燒的燼心：熔岩裂縫裡跳動的橘色光
      const beat = Math.max(0, Math.sin(t * 4)) ** 4;
      g.fillStyle(0xff8a3a, 0.16 + 0.2 * beat).fillCircle(cx, cy - 16 * k, 34 * k);
      g.fillStyle(0x2a1a14, 1).fillRoundedRect(cx - 20 * k, cy - 30 * k, 40 * k, 32 * k, 8 * k);
      g.fillStyle(0xff6a1a, 0.9).fillCircle(cx, cy - 15 * k, (9 + 3 * beat) * k);
      g.fillStyle(0xffd04a, 1).fillCircle(cx, cy - 15 * k, (4 + 2 * beat) * k);
    } else if (map === 'starfall' && pick === 'spare') {
      // 星星回到夜空：地上一圈淡藍星環，上方一道細細的光柱一直通到畫面頂端（D-158）
      g.fillStyle(0x9fc8ff, 0.08 + 0.08 * pulse).fillRect(cx - 5 * k, cy - 260 * k, 10 * k, 260 * k);
      g.fillStyle(0xeaf4ff, 0.18 + 0.12 * pulse).fillRect(cx - 1.5 * k, cy - 260 * k, 3 * k, 260 * k);
      g.lineStyle(2 * k, 0x9fc8ff, 0.5 + 0.3 * pulse).strokeEllipse(cx, cy - 2 * k, 56 * k, 16 * k);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 0.5;
        g.fillStyle(0xeaf4ff, 0.6 + 0.4 * Math.sin(t * 3 + i)).fillCircle(cx + Math.cos(a) * 28 * k, cy - 2 * k + Math.sin(a) * 8 * k, 1.8 * k);
      }
    } else if (map === 'starfall') {
      // 被取走墜星核的地方：灰掉的晶簇，中間一個空的星形凹槽
      g.fillStyle(0x6a6e84, 1).fillTriangle(cx - 24 * k, cy, cx - 12 * k, cy - 34 * k, cx - 2 * k, cy);
      g.fillStyle(0x7a7e94, 1).fillTriangle(cx - 6 * k, cy, cx + 6 * k, cy - 44 * k, cx + 18 * k, cy);
      g.fillStyle(0x5e6276, 1).fillTriangle(cx + 12 * k, cy, cx + 22 * k, cy - 26 * k, cx + 30 * k, cy);
      g.lineStyle(1.5 * k, 0xa8acc0, 0.7).strokeTriangle(cx - 6 * k, cy, cx + 6 * k, cy - 44 * k, cx + 18 * k, cy);
      g.lineStyle(2 * k, 0x22242e, 1);
      for (let q = 0; q < 4; q++) {
        const an = -Math.PI / 2 + (q * Math.PI) / 2;
        g.lineBetween(cx + 6 * k, cy - 18 * k, cx + 6 * k + Math.cos(an) * 7 * k, cy - 18 * k + Math.sin(an) * 7 * k);
      }
    } else {
      // 冷掉的黑岩：沒有光的裂紋
      g.fillStyle(0x24201e, 1).fillRoundedRect(cx - 20 * k, cy - 30 * k, 40 * k, 32 * k, 8 * k);
      g.lineStyle(2 * k, 0x5a524c, 1).lineBetween(cx - 8 * k, cy - 24 * k, cx + 2 * k, cy - 12 * k).lineBetween(cx + 2 * k, cy - 12 * k, cx - 4 * k, cy - 2 * k);
    }
    if (!this.choiceMarkSaid && !this.bot) {
      const p = playerOf(this.s);
      if (Math.hypot(p.x - x, p.y - y) < UNIT * 2.5) {
        this.choiceMarkSaid = true;
        const line = CHOICE_ECHO[`${map}:${pick}`];
        if (line) floatNumber(this, cx, cy - 70 * k, line, { color: pick === 'spare' ? '#c8f0dc' : '#d8ccb8', size: 24 });
      }
    }
  }

  private hexShield(x: number, y: number): void {
    const cx = this.sx(x);
    const cy = this.sy(y) - 40;
    const g = this.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD).setPosition(cx, cy);
    const R = 78;
    const hex = (r: number) => Array.from({ length: 6 }, (_, i) => ({ x: Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * r, y: Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * r }));
    g.fillStyle(0xc89aff, 0.18).fillPoints(hex(R), true);
    g.lineStyle(5, 0xe0c8ff, 0.95).strokePoints(hex(R), true);
    g.lineStyle(2, 0xffffff, 0.6).strokePoints(hex(R * 0.7), true);
    for (const v of hex(R)) g.lineStyle(1.5, 0xc89aff, 0.6).lineBetween(0, 0, v.x, v.y);
    g.setScale(0.6);
    this.tweens.add({ targets: g, scale: 1.1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: g, alpha: 0, delay: 260, duration: 260, onComplete: () => g.destroy() });
    sparks(this, cx, cy, 16, 'spark', 0xe0c8ff, 520);
  }

  /** 法杖的閃現類位移（第 34 輪）：起點一圈紫光「消失」、路上星屑、終點白紫閃光「出現」（純畫面） */
  private blinkMark = '';
  private blinkFx(p: Unit, sp: Phaser.GameObjects.Image): void {
    const a = p.action;
    const cx = sp.x;
    const cy = sp.y - sp.displayHeight * 0.4;
    const appear = (): void => {
      const fl = this.add.circle(cx, cy, 20, 0xffffff, 0.85).setDepth(sp.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: fl, scale: 3, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => fl.destroy() });
      shockRing(this, cx, cy, 0xffffff, 60, 200, 4);
    };
    // 畫面幀數低、跳過位移結束那一幀時：動作結束就補「出現」
    if (this.blinkMark.endsWith(':s') && (!a || `${a.start}:s` !== this.blinkMark)) {
      this.blinkMark = this.blinkMark.replace(':s', ':e');
      appear();
    }
    if (!a || a.kind !== 'skill') return;
    const d = skillDef(this.s, a.id)?.dash;
    if (!d) return;
    const k = this.s.tick - a.start;
    if (k >= d.fromTick && this.blinkMark !== `${a.start}:s`) {
      if (this.blinkMark === `${a.start}:e`) return;
      this.blinkMark = `${a.start}:s`;
      shockRing(this, cx, cy, 0xc89aff, 70, 240, 6);
      sparks(this, cx, cy, 14, 'spark', 0xe0c8ff, 420);
      const fl = this.add.circle(cx, cy, 46, 0xd8c0ff, 0.6).setDepth(sp.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: fl, scale: 0.2, alpha: 0, duration: 220, onComplete: () => fl.destroy() });
      return;
    }
    if (k > d.fromTick && k < d.fromTick + d.ticks) sparks(this, cx, cy, 2, 'spark', 0xc89aff, 260);
    if (k >= d.fromTick + d.ticks && this.blinkMark === `${a.start}:s`) {
      this.blinkMark = `${a.start}:e`;
      appear();
    }
  }

  /** 直線大招蓄力中的瞄準線（破空斬月，第 26 輪）：前段跟著目標轉（淡金），鎖定後變白並閃爍，打出去前看得到範圍 */
  private drawUltAim(g: Phaser.GameObjects.Graphics, p: Unit, now: number): void {
    const a = p.action;
    if (!a || a.kind !== 'skill') return;
    const sk = skillDef(this.s, a.id);
    const h = sk?.hits[0];
    if (!sk?.aimTicks || !h) return;
    const k = this.s.tick - a.start;
    if (k > h.atTick) return;
    const hs = skillShape(this.s, a.id, h.shape);
    if (hs.type === 'circle' && h.ahead) {
      // 隕星術（D-155）：前方的落點圈，蓄力時跟著目標轉、鎖定後閃爍，內圈隨蓄力長大
      const cx = this.sx(p.x + (h.ahead * a.dirX) / 1000);
      const cy = this.sy(p.y + (h.ahead * a.dirY) / 1000);
      const R = hs.r * this.k;
      const locked = k >= sk.aimTicks;
      const prog = Math.min(1, k / h.atTick);
      const col = locked ? 0xffd0a0 : 0xc89aff;
      g.fillStyle(col, locked ? 0.1 + 0.12 * (Math.floor(now / 70) % 2) : 0.08).fillCircle(cx, cy, R);
      g.fillStyle(0xff8a3a, 0.22).fillCircle(cx, cy, R * prog);
      g.lineStyle(2.5, col, locked ? 0.95 : 0.6).strokeCircle(cx, cy, R);
      g.lineStyle(1.5, col, 0.5).lineBetween(cx - R * 0.3, cy, cx + R * 0.3, cy).lineBetween(cx, cy - R * 0.3, cx, cy + R * 0.3);
      return;
    }
    if (hs.type !== 'line') return;
    const ang = Math.atan2(a.dirY, a.dirX);
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    const locked = k >= sk.aimTicks;
    const prog = Math.min(1, k / h.atTick);
    const corner = (f: number, side: number) => ({ x: this.sx(p.x + c * hs.len * f - sn * side * hs.width / 2), y: this.sy(p.y + sn * hs.len * f + c * side * hs.width / 2) });
    const col = locked ? 0xffffff : 0xffe7a0;
    g.fillStyle(col, locked ? 0.1 + 0.12 * (Math.floor(now / 70) % 2) : 0.08).fillPoints([corner(0, -1), corner(1, -1), corner(1, 1), corner(0, 1)], true);
    g.fillStyle(col, locked ? 0.3 : 0.18).fillPoints([corner(0, -1), corner(prog, -1), corner(prog, 1), corner(0, 1)], true);
    g.lineStyle(2, col, locked ? 0.9 : 0.55).strokePoints([corner(0, -1), corner(1, -1), corner(1, 1), corner(0, 1)], true);
  }

  /** Boss 登場（第 23 輪）：上下黑邊＋世界壓暗＋名牌從左滑入，每場第一次交戰演一次 */
  private bossIntro(d: Unit): void {
    const def = ENEMIES[d.defId];
    if (!def) return;
    const wmb = worldMap(this.stageId) ?? WORLD_MAPS[0]!;
    const col = d.fury ? '#ff7a5a' : wmb.color;
    const sub = `${wmb.lord}${d.fury ? '・暴怒' : ''}${this.s.night ? '・深夜' : ''}`;
    SFX.warn(true);
    this.time.delayedCall(180, () => SFX.hitHeavy());
    this.hitStop = Math.max(this.hitStop, 200);
    const cam = this.cameras.main;
    cam.shake(260, 0.006);
    // 第 25 輪：不再推鏡頭（整個場景只有一台相機，HUD 會一起放大）；改成世界壓暗一下，HUD（depth ≥ 48）不受影響
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH + 40, GAME_HEIGHT + 40, 0x000000, 0).setDepth(47);
    this.tweens.add({ targets: dim, fillAlpha: 0.38, duration: 300, ease: 'Cubic.easeOut', yoyo: true, hold: 1300, onComplete: () => dim.destroy() });
    const H = 110;
    const bars = [this.add.rectangle(GAME_WIDTH / 2, -H / 2, GAME_WIDTH + 120, H, 0x000000, 1), this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT + H / 2, GAME_WIDTH + 120, H, 0x000000, 1)];
    bars.forEach((b, i) => {
      b.setDepth(880);
      this.tweens.add({ targets: b, y: i ? GAME_HEIGHT - H / 2 : H / 2, duration: 300, ease: 'Cubic.easeOut', yoyo: true, hold: 1500, onComplete: () => b.destroy() });
    });
    const line = this.add.rectangle(-GAME_WIDTH / 2, 430, GAME_WIDTH * 0.9, 4, Phaser.Display.Color.HexStringToColor(col).color, 0.9).setDepth(881);
    const name = this.add.text(-GAME_WIDTH / 2, 392, `${d.fury ? '暴怒的' : ''}${def.name}`, { fontFamily: TITLE_FONT, fontSize: '58px', color: col, stroke: '#000', strokeThickness: 8 }).setOrigin(0.5).setDepth(882);
    const subT = this.add.text(GAME_WIDTH * 1.5, 466, sub, { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: '#f4e6c0', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(882);
    [line, name].forEach((o) => this.tweens.add({ targets: o, x: GAME_WIDTH / 2, duration: 420, ease: 'Cubic.easeOut' }));
    this.tweens.add({ targets: subT, x: GAME_WIDTH / 2, duration: 420, delay: 120, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [line, name, subT], alpha: 0, delay: 1800, duration: 400, onComplete: () => [line, name, subT].forEach((o) => o.destroy()) });
    const bx = this.sx(d.x);
    const by = this.sy(d.y);
    shockRing(this, bx, by, Phaser.Display.Color.HexStringToColor(col).color, 220, 600, 8);
    sparks(this, bx, by, 24, 'ember', Phaser.Display.Color.HexStringToColor(col).color, 700);
  }

  /** 命中的那一刻在預告範圍裡長出荊棘（狼后／母樹，第 23 輪；純畫面、用 Math.random 不影響戰鬥） */
  private spawnThorns(t: Telegraph): void {
    const now = this.time.now;
    const pts: [number, number][] = [];
    const sh = t.shape;
    if (sh.type === 'ring') {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        const r = sh.rIn + (sh.rOut - sh.rIn) * (0.2 + Math.random() * 0.7);
        pts.push([t.ox + Math.cos(a) * r, t.oy + Math.sin(a) * r]);
      }
    } else if (sh.type === 'circle') {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = sh.r * Math.sqrt(0.08 + Math.random() * 0.9);
        pts.push([t.ox + Math.cos(a) * r, t.oy + Math.sin(a) * r]);
      }
    } else if (sh.type === 'line') {
      const n = 7;
      for (let i = 1; i <= n; i++) {
        const d = (sh.len * i) / (n + 0.5);
        const off = (Math.random() - 0.5) * sh.width * 0.7;
        const dx = t.dirX / 1000; // 預告方向是 1000 倍整數（引擎的 DIR）；第 26 輪修：以前直接乘，直線荊棘長在 1000 倍遠的地方
        const dy = t.dirY / 1000;
        pts.push([t.ox + dx * d - dy * off, t.oy + dy * d + dx * off]);
      }
    } else return;
    const big = sh.type !== 'line';
    pts.forEach(([x, y], i) => this.thornFx.push({ x, y, born: now + i * (big ? 12 : 30), size: (big ? 0.62 : 0.52) + Math.random() * 0.3, seed: Math.random() * 1000 }));
    if (this.thornFx.length > 120) this.thornFx.splice(0, this.thornFx.length - 120);
  }

  /** 狼后／母樹倒下：地上的荊棘全部提早枯萎，周圍再冒一圈枯枝與落葉 */
  private thornWither(x: number, y: number, queen: boolean): void {
    const now = this.time.now;
    for (const f of this.thornFx) f.wither = Math.min(f.wither ?? Infinity, now + Math.random() * 300);
    const n = queen ? 22 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = UNIT * (1.2 + Math.random() * (queen ? 2.6 : 1.6));
      this.thornFx.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, born: now - 400, size: 0.5 + Math.random() * 0.35, seed: Math.random() * 1000, wither: now + 200 + Math.random() * 500 });
    }
    // 落葉：褐色＋暗紫的碎片往外飄
    for (let i = 0; i < (queen ? 3 : 2); i++) this.time.delayedCall(250 + i * 220, () => {
      sparks(this, this.sx(x), this.sy(y), 18, 'ember', i % 2 ? 0x8a5a3a : 0x7a3a5a, 900);
      shockRing(this, this.sx(x), this.sy(y), 0x8a6a4a, (140 + i * 80) * this.k, 700, 5);
    });
  }

  /** 每幀畫地面荊棘：0.15 秒長出 → 停留 → 枯萎變褐、縮回地面 */
  private drawThorns(g: Phaser.GameObjects.Graphics, now: number): void {
    const s = this.s;
    if (this.thornPending.length) {
      this.thornPending = this.thornPending.filter((t) => {
        if (s.tick < t.hitTick) return true;
        if (METEOR_ATTACKS.has(t.attackId)) {
          const pl = playerOf(s);
          const r = t.shape.type === 'circle' ? t.shape.r : UNIT;
          this.starImpact(this.sx(t.ox), this.sy(t.oy), r * this.k);
          if (Math.hypot(pl.x - t.ox, pl.y - t.oy) < UNIT * 8) {
            this.cameras.main.shake(130, 0.005);
            SFX.hitHeavy();
          }
        } else if (LAVA_ATTACKS.has(t.attackId)) this.spawnLava(t);
        else this.spawnThorns(t);
        return false;
      });
    }
    if (!this.thornFx.length) return;
    const HOLD = 1300;
    const FADE = 500;
    const k = this.k;
    this.thornFx = this.thornFx.filter((f) => {
      const age = now - f.born;
      if (age < 0) return true;
      const wStart = f.wither ?? f.born + HOLD;
      const w = Math.max(0, Math.min(1, (now - wStart) / FADE));
      if (w >= 1) return false;
      const px = this.sx(f.x);
      const py = this.sy(f.y);
      if (px < -80 || px > GAME_WIDTH + 80 || py < -80 || py > VIEW_BOTTOM + 80) return true;
      const grow = Math.min(1, age / 150);
      const pop = grow < 1 ? grow : 1 + 0.12 * Math.max(0, 1 - (age - 150) / 200);
      const h = UNIT * f.size * k * pop * (1 - 0.6 * w);
      const base = h * 0.42;
      // 顏色：紫紅 → 枯褐
      const col = w > 0 ? lerpColor(0x6a2a4a, 0x5a4630, w) : 0x6a2a4a;
      const hi = w > 0 ? lerpColor(0xc0507a, 0x8a7050, w) : 0xc0507a;
      const al = 1 - w * 0.8;
      g.fillStyle(0x000000, 0.25 * al).fillEllipse(px, py + 2, base * 2.6, base * 0.8);
      for (let j = -1; j <= 1; j++) {
        const lean = j * 0.45 + Math.sin(f.seed + j) * 0.15;
        const hh = h * (j === 0 ? 1 : 0.7);
        const tx = px + Math.sin(lean) * hh;
        const ty = py - Math.cos(lean) * hh;
        const bx = px + j * base * 0.6;
        g.fillStyle(col, al).fillTriangle(bx - base * 0.35, py, bx + base * 0.35, py, tx, ty);
        g.fillStyle(hi, al * 0.9).fillTriangle(bx - base * 0.08, py - 1, bx + base * 0.12, py - 1, tx, ty);
      }
      // 剛長出來時刺尖的毒綠閃光
      if (age < 300 && w === 0) g.fillStyle(0xc8ff8a, 0.8 * (1 - age / 300)).fillCircle(px + Math.sin(f.seed) * 2, py - h, 3 + 4 * (1 - age / 300));
      return true;
    });
  }

  /** 霜旋（D-121）：腳下一圈結霜＋十幾根冰晶，1.5 秒後融化（純畫面，Math.random） */
  private spawnFrost(x: number, y: number, r: number): void {
    const now = this.time.now;
    this.frostFx.push({ x, y, born: now, size: r, seed: 0, ring: 1 });
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * Math.sqrt(0.1 + Math.random() * 0.85);
      this.frostFx.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, born: now + i * 10, size: 0.35 + Math.random() * 0.3, seed: Math.random() * 1000 });
    }
    if (this.frostFx.length > 90) this.frostFx.splice(0, this.frostFx.length - 90);
  }

  private drawFrost(g: Phaser.GameObjects.Graphics, now: number): void {
    if (!this.frostFx.length) return;
    const LIFE = 1500;
    const k = this.k;
    this.frostFx = this.frostFx.filter((f) => {
      const age = now - f.born;
      if (age < 0) return true;
      if (age > LIFE + 400) return false;
      const melt = Math.max(0, (age - LIFE) / 400);
      const px = this.sx(f.x);
      const py = this.sy(f.y);
      if (f.ring) {
        // 結霜圈：淡藍圓＋白色細邊，從中心擴開
        const grow = Math.min(1, age / 200);
        const R = f.size * k * grow;
        g.fillStyle(0xbff4ff, 0.16 * (1 - melt)).fillEllipse(px, py, R * 2, R * 1.4);
        g.lineStyle(2, 0xe8fcff, 0.45 * (1 - melt)).strokeEllipse(px, py, R * 2, R * 1.4);
        return true;
      }
      // 冰晶：細長的菱形，長出來時一閃
      const grow = Math.min(1, age / 120);
      const h = UNIT * f.size * k * grow * (1 - 0.7 * melt);
      const w = h * 0.28;
      const lean = Math.sin(f.seed) * 0.35;
      const tx = px + Math.sin(lean) * h;
      const ty = py - Math.cos(lean) * h;
      const al = 0.85 * (1 - melt);
      g.fillStyle(0x7ad8f0, al).fillTriangle(px - w, py, px + w, py, tx, ty);
      g.fillStyle(0xeafcff, al).fillTriangle(px - w * 0.2, py - 1, px + w * 0.4, py - 1, tx, ty);
      if (age < 260) g.fillStyle(0xffffff, 0.8 * (1 - age / 260)).fillCircle(tx, ty, 2 + 4 * (1 - age / 260));
      return true;
    });
  }

  /** 破空斬月（D-121）：一道白金月牙沿著劍氣方向飛出去 */
  private moonArc(x: number, y: number, ang: number, len: number, width: number): void {
    const R = width * this.k * 1.3;
    const g = this.add.graphics().setDepth(692).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0xfff2c0, 0.95).beginPath();
    g.arc(0, 0, R, -1.25, 1.25, false);
    g.arc(-R * 0.38, 0, R * 0.92, 1.1, -1.1, true);
    g.closePath().fillPath();
    g.fillStyle(0xffffff, 0.9).beginPath();
    g.arc(0, 0, R * 0.96, -0.8, 0.8, false);
    g.arc(-R * 0.2, 0, R * 0.9, 0.75, -0.75, true);
    g.closePath().fillPath();
    const px = this.sx(x);
    const py = this.sy(y);
    g.setPosition(px, py).setRotation(ang).setScale(0.6);
    const L = len * this.k;
    this.tweens.add({ targets: g, x: px + Math.cos(ang) * L, y: py + Math.sin(ang) * L, scale: 1.15, duration: 340, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: g, alpha: 0, delay: 200, duration: 260, onComplete: () => g.destroy() });
  }

  /** 裂地斬（D-112）：沿直線裂開的地面＋金色劍氣，從玩家往前一路炸開 */
  private groundSplit(x: number, y: number, ang: number, len: number, width: number): void {
    const px = this.sx(x);
    const py = this.sy(y);
    const L = len * this.k;
    const W = width * this.k;
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const g = this.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    // 劍氣：從窄到寬的楔形
    g.fillStyle(0xffd05a, 0.55).fillTriangle(px - cy * W * 0.15, py + cx * W * 0.15, px + cy * W * 0.15, py - cx * W * 0.15, px + cx * L, py + cy * L);
    g.fillStyle(0xfff4d0, 0.85).fillTriangle(px - cy * W * 0.05, py + cx * W * 0.05, px + cy * W * 0.05, py - cx * W * 0.05, px + cx * L * 0.95, py + cy * L * 0.95);
    // 地面裂痕：沿線左右抖動的折線
    g.lineStyle(3, 0xffa040, 0.9).beginPath().moveTo(px, py);
    for (let i = 1; i <= 8; i++) {
      const d = (L * i) / 8;
      const off = (i % 2 ? 1 : -1) * W * 0.25 * (0.5 + ((i * 37) % 10) / 20);
      g.lineTo(px + cx * d - cy * off, py + cy * d + cx * off);
    }
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 380, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    for (let i = 1; i <= 4; i++) {
      const d = (L * i) / 4;
      this.time.delayedCall(i * 35, () => sparks(this, px + cx * d, py + cy * d, 6, 'spark', 0xffd05a, 320));
    }
    this.cameras.main.shake(120, 0.006);
  }

  /** 長弓普攻（D-147）：箭從主角飛到目標（約 0.1 秒）＋細尾光 */
  private arrowShot(x0: number, y0: number, x1: number, y1: number, color: number): void {
    if (this.time.now - this.lastBowSfx > 60) {
      this.lastBowSfx = this.time.now;
      SFX.bowShot();
    }
    const ax = this.sx(x0);
    const ay = this.sy(y0) - 20;
    const bx = this.sx(x1);
    const by = this.sy(y1) - 20;
    const ang = Math.atan2(by - ay, bx - ax);
    const tail = this.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    tail.lineStyle(3, color, 0.7).lineBetween(ax, ay, bx, by);
    this.tweens.add({ targets: tail, alpha: 0, duration: 200, onComplete: () => tail.destroy() });
    const arrow = this.add.graphics().setDepth(691).setPosition(ax, ay).setRotation(ang);
    arrow.lineStyle(4, 0x8a6a40, 1).lineBetween(-34, 0, 8, 0);
    arrow.fillStyle(0xf4f8ff, 1).fillTriangle(16, 0, 4, -7, 4, 7);
    arrow.fillStyle(color, 1).fillTriangle(-34, 0, -44, -8, -30, 0).fillTriangle(-34, 0, -44, 8, -30, 0);
    this.tweens.add({ targets: arrow, x: bx, y: by, duration: 90, ease: 'Linear', onComplete: () => {
      arrow.destroy();
      sparks(this, bx, by, 5, 'spark', color, 220);
    } });
  }

  /** 法杖普攻（D-152）：發光的魔彈飛過去，身後拖一道光，命中時小爆開 */
  private magicBolt(x0: number, y0: number, x1: number, y1: number, color: number): void {
    if (this.time.now - this.lastBowSfx > 60) {
      this.lastBowSfx = this.time.now;
      SFX.magicBolt();
    }
    const ax = this.sx(x0);
    const ay = this.sy(y0) - 34;
    const bx = this.sx(x1);
    const by = this.sy(y1) - 20;
    const tail = this.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    const orb = this.add.graphics().setDepth(691).setBlendMode(Phaser.BlendModes.ADD).setPosition(ax, ay);
    orb.fillStyle(color, 0.35).fillCircle(0, 0, 18).fillStyle(color, 0.8).fillCircle(0, 0, 10).fillStyle(0xffffff, 1).fillCircle(0, 0, 5);
    this.tweens.addCounter({ from: 0, to: 1, duration: 130, onUpdate: (tw) => {
      const t = tw.getValue() ?? 1;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 18;
      orb.setPosition(x, y);
      tail.clear().lineStyle(6, color, 0.35).lineBetween(ax + (bx - ax) * Math.max(0, t - 0.4), ay + (by - ay) * Math.max(0, t - 0.4), x, y);
    }, onComplete: () => {
      orb.destroy();
      this.tweens.add({ targets: tail, alpha: 0, duration: 140, onComplete: () => tail.destroy() });
      sparks(this, bx, by, 7, 'spark', color, 260);
      shockRing(this, bx, by, color, 26, 180, 3);
    } });
  }

  /**
   * 法杖技能特效（D-152；資料驅動：依命中形狀與狀態畫）。
   * 直線＝飛出去的魔彈（灼燒＝火球、冰凍＝冰槍、中毒＝魂彈）、圓＝符文魔法陣爆開（大招單發＝隕星、多段＝流星）、
   * 環＝火環、扇形（不會出現在法杖，保底）＝刀光。blink：1＝瞬移落地（往前）、−1＝往後瞬移。
   */
  private staffFx(x: number, y: number, ang: number, hs: Shape, ult: boolean, single: boolean, blink: number, st?: string): void {
    const col = st === 'burn' ? 0xff8a3a : st === 'freeze' ? 0xa8ecff : st === 'poison' ? 0x9aff6a : st === 'weak' ? 0xb08aff : st === 'break' ? 0xffd05a : 0xc89aff;
    const vx = this.sx(x);
    const vy = this.sy(y);
    SFX.magicBlast();
    if (hs.type === 'line') {
      const L = hs.len * this.k;
      const ex = vx + Math.cos(ang) * L;
      const ey = vy + Math.sin(ang) * L * 0.92;
      const trail = this.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
      const orb = this.add.graphics().setDepth(692).setBlendMode(Phaser.BlendModes.ADD);
      const w = Math.max(14, hs.width * this.k * 0.5);
      if (st === 'freeze') {
        // 冰槍：細長的菱形
        orb.fillStyle(col, 0.5).fillTriangle(w * 2.4, 0, -w * 1.6, -w * 0.7, -w * 1.6, w * 0.7).fillStyle(0xffffff, 1).fillTriangle(w * 2, 0, -w, -w * 0.3, -w, w * 0.3);
      } else orb.fillStyle(col, 0.3).fillCircle(0, 0, w * 1.4).fillStyle(col, 0.85).fillCircle(0, 0, w * 0.8).fillStyle(0xffffff, 1).fillCircle(0, 0, w * 0.4);
      orb.setRotation(ang).setPosition(vx, vy - 30);
      this.tweens.addCounter({ from: 0, to: 1, duration: 200, onUpdate: (tw) => {
        const t = tw.getValue() ?? 1;
        const cx = vx + (ex - vx) * t;
        const cy = vy - 30 + (ey - vy) * t;
        orb.setPosition(cx, cy);
        trail.clear().lineStyle(w * 1.3, col, 0.25).lineBetween(vx, vy - 30, cx, cy).lineStyle(w * 0.4, 0xffffff, 0.5).lineBetween(vx + (cx - vx) * 0.5, vy - 30 + (cy - vy + 30) * 0.5, cx, cy);
        if (Math.random() < 0.5) sparks(this, cx, cy, 1, st === 'freeze' ? 'spark' : 'ember', col, 360);
      }, onComplete: () => {
        orb.destroy();
        this.tweens.add({ targets: trail, alpha: 0, duration: 260, onComplete: () => trail.destroy() });
        sparks(this, ex, ey - 30, 14, 'spark', col, 480);
        shockRing(this, ex, ey - 20, col, w * 3.2, 300, 6);
      } });
      if (hs.len >= UNIT * 7) {
        this.cameras.main.shake(90, 0.005);
        this.hitStop = Math.max(this.hitStop, 60);
      }
      return;
    }
    if (hs.type === 'ring') {
      // 火環：內外兩圈＋一圈火星
      shockRing(this, vx, vy, col, hs.rOut * this.k, 420, 12);
      shockRing(this, vx, vy, 0xffffff, hs.rIn * this.k, 300, 4);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = ((hs.rIn + hs.rOut) / 2) * this.k;
        sparks(this, vx + Math.cos(a) * r, vy + Math.sin(a) * r * 0.6, 2, 'ember', col, 520);
      }
      return;
    }
    if (hs.type === 'sector') {
      this.slash(x, y, ang, hs.r, hs.deg + 30, col, 8);
      return;
    }
    const R = hs.r * this.k;
    if (ult && single) {
      // 隕星術：夜空砸下一顆大隕星（星落的光柱＋墜星落地）
      this.starfall(x, y, hs.r);
      this.starImpact(vx, vy, R);
      // 落點留下燃燒的隕石坑 2.5 秒（純畫面）
      const cr = this.add.graphics().setDepth(5).setPosition(vx, vy);
      cr.fillStyle(0x1a0c06, 0.55).fillEllipse(0, 0, R * 1.5, R * 0.9);
      cr.fillStyle(0xff6a2a, 0.35).fillEllipse(0, 0, R * 0.9, R * 0.5);
      for (let i = 0; i < 7; i++) {
        const a0 = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
        const r1 = R * (0.55 + Math.random() * 0.25);
        cr.lineStyle(3, 0xffa040, 0.85).lineBetween(Math.cos(a0) * R * 0.25, Math.sin(a0) * R * 0.15, Math.cos(a0) * r1, Math.sin(a0) * r1 * 0.6);
      }
      this.tweens.add({ targets: cr, alpha: 0, delay: 1600, duration: 900, onComplete: () => cr.destroy() });
      for (let i = 0; i < 4; i++) this.time.delayedCall(300 + i * 450, () => sparks(this, vx + (Math.random() - 0.5) * R, vy + (Math.random() - 0.5) * R * 0.5, 4, 'ember', 0xff8a3a, 600));
      sparks(this, vx, vy, 26, 'ember', 0xff8a3a, 820);
      this.cameras.main.shake(260, 0.012);
      this.cameras.main.flash(140, 255, 230, 200);
      this.hitStop = Math.max(this.hitStop, 150);
      return;
    }
    if (ult && st === 'slow') {
      // 虛空奇點（第 35 輪）：黑洞＋被吸進去的光點
      this.voidHole(x, y, hs.r);
      return;
    }
    if (ult) {
      // 流星雨：每段在範圍裡隨機落一顆小流星
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * R * 0.8;
      const px = vx + Math.cos(a) * d;
      const py = vy + Math.sin(a) * d * 0.6;
      const g = this.add.graphics().setDepth(692).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.addCounter({ from: 0, to: 1, duration: 160, onUpdate: (tw) => {
        g.clear();
        this.fallingStar(g, px, py, tw.getValue() ?? 1);
      }, onComplete: () => {
        g.destroy();
        this.starImpact(px, py, R * 0.35);
      } });
      shockRing(this, vx, vy, st === 'slow' ? 0x8a6aff : 0xc89aff, R, 260, 4);
      this.cameras.main.shake(70, 0.004);
      return;
    }
    if (!single && st === 'slow') {
      // 雷暴：每段從天上劈下 2 道閃電（鋸齒線）落在範圍裡
      for (let j = 0; j < 2; j++) {
        const a0 = Math.random() * Math.PI * 2;
        const d0 = Math.random() * R * 0.85;
        const tx = vx + Math.cos(a0) * d0;
        const ty = vy + Math.sin(a0) * d0 * 0.6;
        const bolt = this.add.graphics().setDepth(700).setBlendMode(Phaser.BlendModes.ADD);
        const pts: { x: number; y: number }[] = [];
        for (let q = 0; q <= 6; q++) pts.push({ x: tx + (q === 6 ? 0 : (Math.random() - 0.5) * 34), y: ty - 320 + (320 * q) / 6 });
        bolt.lineStyle(9, 0x8ab0ff, 0.35).strokePoints(pts, false).lineStyle(3, 0xffffff, 1).strokePoints(pts, false);
        this.tweens.add({ targets: bolt, alpha: 0, duration: 180, onComplete: () => bolt.destroy() });
        sparks(this, tx, ty, 6, 'spark', 0xc8d8ff, 300);
        shockRing(this, tx, ty, 0x9fc0ff, 34, 200, 3);
      }
      this.cameras.main.shake(60, 0.003);
      return;
    }
    // 魔法陣：地上一圈符文＋往外炸開
    const g = this.add.graphics().setDepth(689).setBlendMode(Phaser.BlendModes.ADD).setPosition(vx, vy);
    g.lineStyle(4, col, 0.9).strokeEllipse(0, 0, R * 2, R * 1.2).lineStyle(2, 0xffffff, 0.6).strokeEllipse(0, 0, R * 1.6, R * 0.96);
    for (let i = 0; i < 6; i++) {
      const a1 = (i / 6) * Math.PI * 2;
      const a2 = a1 + (Math.PI * 2 * 2) / 6;
      g.lineStyle(2, col, 0.7).lineBetween(Math.cos(a1) * R * 0.8, Math.sin(a1) * R * 0.48, Math.cos(a2) * R * 0.8, Math.sin(a2) * R * 0.48);
    }
    this.tweens.add({ targets: g, alpha: 0, scaleX: 1.15, scaleY: 1.15, duration: 520, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
    shockRing(this, vx, vy, col, R * 1.1, 360, 9);
    sparks(this, vx, vy, 16, st === 'burn' ? 'ember' : 'spark', col, 520);
    if (st === 'freeze' && blink === 0 && single && R >= 4 * UNIT * this.k - 1) this.timeClock(x, y, hs.r); // 時間凝滯（4 格冰凍反擊）
    if (st === 'freeze') {
      this.spawnFrost(x, y, hs.r);
      this.cameras.main.flash(90, 190, 240, 255);
    }
    if (blink !== 0) {
      // 閃現：從起點到落點一道紫色殘光
      const back = blink > 0 ? -1 : 1;
      const L = 5 * UNIT * this.k;
      const t = this.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
      t.lineStyle(10, 0xc89aff, 0.35).lineBetween(vx, vy - 30, vx + Math.cos(ang) * L * back, vy - 30 + Math.sin(ang) * L * back);
      t.lineStyle(3, 0xffffff, 0.8).lineBetween(vx, vy - 30, vx + Math.cos(ang) * L * back, vy - 30 + Math.sin(ang) * L * back);
      this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
    }
    this.cameras.main.shake(90, 0.005);
  }

  /** 穿透箭／星河貫射（D-147）：一道沿直線的光箭——箭頭飛到底，身後留下發光的軌跡 */
  private arrowBeam(x: number, y: number, ang: number, len: number, width: number, color: number, heavy = false): void {
    SFX.bowShot();
    const px = this.sx(x);
    const py = this.sy(y) - 20;
    const L = len * this.k;
    const W = Math.max(10, width * this.k * (heavy ? 0.5 : 0.3));
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    const g = this.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(color, 0.35).fillTriangle(px - cy * W, py + cx * W, px + cy * W, py - cx * W, px + cx * L, py + cy * L);
    g.lineStyle(heavy ? 6 : 4, 0xffffff, 0.9).lineBetween(px, py, px + cx * L, py + cy * L);
    this.tweens.add({ targets: g, alpha: 0, duration: heavy ? 420 : 300, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    const head = this.add.graphics().setDepth(692).setPosition(px, py).setRotation(ang).setBlendMode(Phaser.BlendModes.ADD);
    const s = heavy ? 1.6 : 1.2;
    head.fillStyle(color, 0.6).fillCircle(0, 0, 18 * s);
    head.fillStyle(0xffffff, 1).fillTriangle(22 * s, 0, -8 * s, -9 * s, -8 * s, 9 * s);
    this.tweens.add({ targets: head, x: px + cx * L, y: py + cy * L, duration: heavy ? 160 : 120, ease: 'Cubic.easeOut', onComplete: () => {
      head.destroy();
      sparks(this, px + cx * L, py + cy * L, heavy ? 14 : 8, 'spark', color, 360);
    } });
    for (let i = 1; i <= 3; i++) this.time.delayedCall(i * 30, () => sparks(this, px + (cx * L * i) / 3, py + (cy * L * i) / 3, 4, 'spark', color, 260));
    if (heavy) this.cameras.main.shake(110, 0.005);
  }

  /** 長弓技能的畫面（D-147）：直線＝光箭、扇形＝一排扇形的箭（後躍射擊多一道往後的殘影）、圓＝四面射出 */
  private bowFx(x: number, y: number, ang: number, hs: Shape, ult: boolean, leap: boolean, brk: boolean, frost = false, st?: string): void {
    // 變化二的箭（D-149）：灼燒＝火箭、中毒＝綠毒箭、虛弱＝紫色殘月
    const elem = st === 'burn' ? 0xff8a3a : st === 'poison' ? 0xa8ff6a : st === 'weak' ? 0xc8a0ff : 0;
    if (hs.type === 'ring' || (ult && hs.type === 'circle')) {
      // 環形箭雨／流星箭雨（D-149）：箭從天上落進範圍
      this.arrowRain(x, y, hs.type === 'ring' ? hs.rIn : 0, hs.type === 'ring' ? hs.rOut : hs.r, ult ? 0xff9ae0 : 0x9fe0ff, ult ? 5 : 12, ult);
      return;
    }
    if (hs.type === 'line') {
      this.arrowBeam(x, y, ang, hs.len, hs.width, ult ? 0xff9ae0 : brk ? 0xff8a6a : elem || 0x9fe0ff, ult);
      if (st === 'burn') {
        // 燼火箭：沿著箭道留下一串火星
        for (let i = 1; i <= 5; i++) {
          const d = (hs.len * i) / 5;
          this.time.delayedCall(i * 22, () => sparks(this, this.sx(x + Math.cos(ang) * d), this.sy(y + Math.sin(ang) * d) - 20, 5, 'ember', 0xff9a3a, 520));
        }
      }
      if (ult && brk) {
        this.cameras.main.flash(120, 255, 180, 240);
        this.hitStop = Math.max(this.hitStop, 120);
      }
      return;
    }
    const r = hs.type === 'sector' || hs.type === 'circle' ? hs.r : UNIT * 3;
    const span = hs.type === 'sector' ? (hs.deg * Math.PI) / 180 : Math.PI * 2;
    const n = hs.type === 'sector' ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const a = hs.type === 'sector' ? ang - span / 2 + (span * i) / (n - 1) : ang + (span * i) / n;
      const ex = x + Math.cos(a) * r;
      const ey = y + Math.sin(a) * r;
      this.time.delayedCall(i * 12, () => this.arrowShot(x, y, ex, ey, elem || (frost ? 0xbff4ff : leap ? 0xc8f0a0 : 0x9fe0ff)));
    }
    if (st === 'poison' || st === 'weak') {
      // 蝕毒後躍＝前方一團綠色毒霧；殘月見切＝一道紫色弧月
      const fx = this.sx(x) + Math.cos(ang) * r * 0.6 * this.k;
      const fy = this.sy(y) + Math.sin(ang) * r * 0.6 * this.k;
      if (st === 'poison') {
        for (let i = 0; i < 5; i++) {
          const puff = this.add.circle(fx + (Math.random() - 0.5) * 60, fy + (Math.random() - 0.5) * 40, 18 + Math.random() * 14, 0x7ad04a, 0.45).setDepth(689);
          this.tweens.add({ targets: puff, scale: 2.2, alpha: 0, y: puff.y - 30, duration: 700 + i * 80, ease: 'Cubic.easeOut', onComplete: () => puff.destroy() });
        }
        sparks(this, fx, fy, 10, 'spark', 0xc8ff8a, 500);
      } else this.slash(x, y, ang, r, span * (180 / Math.PI) + 20, 0xc8a0ff, 9);
    }
    if (frost) {
      // 霜箭後躍（D-148）：前方一團寒氣
      const fx = this.sx(x) + Math.cos(ang) * r * 0.6 * this.k;
      const fy = this.sy(y) + Math.sin(ang) * r * 0.6 * this.k;
      shockRing(this, fx, fy, 0xbff4ff, r * 0.5 * this.k, 420, 8);
      sparks(this, fx, fy, 18, 'spark', 0xd8fbff, 600);
      this.cameras.main.flash(80, 190, 240, 255);
    }
    if (leap) {
      // 後躍：腳下一圈風壓
      shockRing(this, this.sx(x), this.sy(y), 0xc8f0a0, 70, 260, 5);
      sparks(this, this.sx(x), this.sy(y), 8, 'spark', 0xe0ffd0, 300);
    }
  }

  /** 箭雨（D-149）：n 支箭從右上的天空斜斜落進 rIn～rOut 的範圍，落地迸出小火花；大招版是粉紅的星箭、落地多一圈光 */
  private arrowRain(x: number, y: number, rIn: number, rOut: number, color: number, n: number, star: boolean): void {
    if (this.time.now - this.lastBowSfx > 60) {
      this.lastBowSfx = this.time.now;
      SFX.bowShot();
    }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = rIn + Math.sqrt(Math.random()) * (rOut - rIn);
      const tx = this.sx(x + Math.cos(a) * d);
      const ty = this.sy(y + Math.sin(a) * d);
      const g = this.add.graphics().setDepth(692).setBlendMode(Phaser.BlendModes.ADD);
      const H = 260 + Math.random() * 80;
      g.lineStyle(star ? 7 : 4, color, star ? 0.5 : 0.4).lineBetween(0, 0, 70, -H * 0.5);
      g.lineStyle(2, 0xffffff, 0.95).lineBetween(0, 0, 40, -H * 0.28);
      g.fillStyle(0xffffff, 1).fillCircle(0, 0, star ? 6 : 3.5);
      g.setPosition(tx + H * 0.25, ty - H * 0.9).setAlpha(0.2);
      this.tweens.add({ targets: g, x: tx, y: ty, alpha: 1, duration: 150 + i * 14, delay: i * 26, ease: 'Quad.easeIn', onComplete: () => {
        g.destroy();
        sparks(this, tx, ty, star ? 7 : 4, 'spark', color, 300);
        if (star) shockRing(this, tx, ty, color, 46, 260, 4);
      } });
    }
    if (rIn > 0) shockRing(this, this.sx(x), this.sy(y), color, rOut * this.k, 360, 3);
  }

  /** 星落一閃（D-112）：天上落下的光柱＋落地衝擊環 */
  private starfall(x: number, y: number, r: number): void {
    const px = this.sx(x);
    const py = this.sy(y);
    const g = this.add.graphics().setDepth(695).setBlendMode(Phaser.BlendModes.ADD);
    const H = 900;
    g.fillStyle(0xff7ad0, 0.35).fillRect(px - 46, py - H, 92, H);
    g.fillStyle(0xffe0f6, 0.8).fillRect(px - 14, py - H, 28, H);
    this.tweens.add({ targets: g, alpha: 0, duration: 420, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    shockRing(this, px, py, 0xff7ad0, r * this.k * 1.3, 520, 14);
    sparks(this, px, py, 28, 'spark', 0xffd0f0, 620);
    this.cameras.main.flash(120, 255, 200, 240);
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
    if (this.nightShade) {
      const pl = playerOf(this.s);
      this.nightShade.setPosition(this.sx(pl.x), this.sy(pl.y));
    }
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
    this.drawThorns(g, now);
    this.drawFrost(this.frostG.clear(), now);
    this.drawVents(this.frostG, now);
    // 地面掉落：金幣（金色閃光）、粉塵（藍點）、結晶（紫菱形）、藥水（紅瓶）；上下浮動
    for (const it of s.ground ?? []) {
      const ix = this.sx(it.x);
      if (ix < -60 || ix > GAME_WIDTH + 60) continue;
      const iy = this.sy(it.y) - 6 - 4 * Math.sin(now / 260 + it.id);
      if (iy < VIEW_TOP - 60 || iy > VIEW_BOTTOM + 200) continue; // 光柱往上 150
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
      if (c.nightOnly && !s.night) continue;
      const opened = !!s.chestsOpened?.includes(c.id);
      const d = Math.hypot(c.x - pl0.x, c.y - pl0.y) / UNIT;
      const a = opened ? 0.55 : c.nightOnly ? 1 : Math.max(0, Math.min(1, (CHEST_RULES.hintUnits - d) / 2.5));
      if (a <= 0) continue;
      const cx = this.sx(c.x);
      const cy = this.sy(c.y);
      const k = this.k * 1.4;
      if (c.nightOnly && !opened) {
        // 夜光寶箱：畫在暈影上面的藍色光柱＋光圈（遠處也看得到，D-108）
        const pulse = 0.5 + 0.5 * Math.sin(now / 260);
        top.fillStyle(0x7ab8ff, 0.12 + 0.08 * pulse).fillEllipse(cx, cy + 6 * k, 120 * k, 40 * k);
        top.fillStyle(0x9fd0ff, 0.1 + 0.06 * pulse).fillRect(cx - 10 * k, cy - 140 * k, 20 * k, 140 * k);
        top.lineStyle(2, 0xbfe0ff, 0.5 + 0.4 * pulse).strokeEllipse(cx, cy + 6 * k, 80 * k, 26 * k);
        top.fillStyle(0x34508a, 1).fillRoundedRect(cx - 26 * k, cy - 8 * k, 52 * k, 26 * k, 4 * k);
        top.fillStyle(0x5a86d0, 1).fillRoundedRect(cx - 28 * k, cy - 20 * k, 56 * k, 14 * k, 5 * k);
        top.fillStyle(0xe8f4ff, 1).fillRect(cx - 4 * k, cy - 10 * k, 8 * k, 10 * k);
        continue;
      }
      g.fillStyle(0x000000, 0.35 * a).fillEllipse(cx, cy + 16 * k, 60 * k, 14 * k);
      g.fillStyle(0x6a4020, a).fillRoundedRect(cx - 26 * k, cy - 8 * k, 52 * k, 26 * k, 4 * k);
      g.fillStyle(opened ? 0x2a1a0e : 0x8a5a2a, a).fillRoundedRect(cx - 28 * k, cy - (opened ? 26 : 20) * k, 56 * k, 14 * k, 5 * k);
      g.fillStyle(0xd8b050, a).fillRect(cx - 4 * k, cy - 10 * k, 8 * k, 10 * k);
      if (!opened && (now / 500) % 2 < 0.25) g.fillStyle(0xfff0c0, a).fillCircle(cx + 18 * k, cy - 18 * k, 3 * k);
    }
    this.drawChoiceMark(g, now);
    this.drawCub(g, now);
    // 前世的記憶（D-137）：紫色的光點在原地浮著，遠遠就看得到
    for (const mem of this.memLeft) {
      const cx = this.sx(mem.tx * UNIT + UNIT / 2);
      const cy = this.sy(mem.ty * UNIT + UNIT / 2);
      if (cx < -80 || cx > GAME_WIDTH + 80 || cy < -120 || cy > GAME_HEIGHT + 80) continue;
      const k = this.k * 2;
      const t = now / 1000;
      const bob = Math.sin(t * 2) * 6 * k;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      top.fillStyle(0x8a5ad0, 0.22 + 0.1 * pulse).fillEllipse(cx, cy + 8 * k, 90 * k, 28 * k);
      top.fillStyle(0xb08aff, 0.14 + 0.08 * pulse).fillRect(cx - 7 * k, cy - 130 * k, 14 * k, 130 * k);
      top.fillStyle(0xc89aff, 0.3 + 0.2 * pulse).fillCircle(cx, cy - 30 * k + bob, 20 * k);
      top.fillStyle(0xf4e8ff, 0.95).fillPoints([
        new Phaser.Math.Vector2(cx, cy - 48 * k + bob), new Phaser.Math.Vector2(cx + 11 * k, cy - 30 * k + bob),
        new Phaser.Math.Vector2(cx, cy - 12 * k + bob), new Phaser.Math.Vector2(cx - 11 * k, cy - 30 * k + bob),
      ], true);
      for (let j = 0; j < 3; j++) {
        const a = t * 1.6 + (j * Math.PI * 2) / 3;
        top.fillStyle(0xe0c8ff, 0.8).fillCircle(cx + Math.cos(a) * 26 * k, cy - 30 * k + bob + Math.sin(a) * 9 * k, 2.5 * k);
      }
    }
    // 營火：安全範圍淡圈＋木柴＋跳動的火焰與光暈
    let fi = 0;
    for (const c of STAGES[this.stageId]?.campfires ?? []) {
      const cx = this.sx(c.x);
      const cy = this.sy(c.y);
      const k = this.k * 1.5;
      const safeR = CAMPFIRE_RULES.safeUnits * UNIT * this.k;
      if (cx < -safeR || cx > GAME_WIDTH + safeR || cy < VIEW_TOP - safeR || cy > VIEW_BOTTOM + safeR) {
        this.glows[fi++]?.setVisible(false);
        continue;
      }
      this.glows[fi]?.setVisible(true);
      g.lineStyle(2, 0xffb060, 0.18).strokeCircle(cx, cy, CAMPFIRE_RULES.safeUnits * UNIT * this.k);
      const gl = this.glows[fi++];
      if (gl) gl.setPosition(cx, cy - 10 * k).setScale(((s.night ? 400 : 300) * k * (1 + 0.06 * Math.sin(now / 130))) / 128).setAlpha(0.85 + 0.15 * Math.sin(now / 170));
      g.fillStyle(0x3a2412, 1).fillRoundedRect(cx - 40 * k, cy + 4 * k, 80 * k, 14 * k, 6 * k);
      g.fillStyle(0x4a2e16, 1).fillRoundedRect(cx - 34 * k, cy - 4 * k, 68 * k, 13 * k, 6 * k);
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(now / (90 + i * 37) + i * 2);
        const fh = (46 - i * 12 + f * 6) * k;
        g.fillStyle(i === 0 ? 0xff6a20 : i === 1 ? 0xffa83a : 0xfff0a0, 0.95).fillEllipse(cx + f * 3 * k, cy - fh / 2, (36 - i * 10) * k, fh);
      }
      // 營火旁的旅商（D-116 行商，有存檔的大地圖才有）
      if (this.tracked) {
        drawMerchant(g, cx + 95 * k, cy + 10 * k, 120 * k, now + fi * 1300);
        // 這張地圖的燼牌對手坐在營火另一邊（D-129）
        const rival = opponentsAt(this.stageId).find((o) => o.map);
        if (rival) drawCardRival(g, rival.id, cx - 95 * k, cy + 10 * k, 110 * k, now + fi * 900);
      }
    }
    // 預告：淡底＋由內往外填滿的進度＋外框（紫＝附狀態、黃框＝可格擋、粗紅＝不可格擋）
    for (const t of s.telegraphs) {
      const prog = Math.min(1, (s.tick - t.startTick) / Math.max(1, t.hitTick - t.startTick));
      const owner = s.units.find((x) => x.id === t.ownerId);
      const atk = owner ? attacksOf(owner).find((q) => q.id === t.attackId) : undefined;
      const meteor = METEOR_ATTACKS.has(t.attackId);
      const col = meteor ? 0x8aa8ff : atk?.status ? 0xb060ff : 0xff3a3a;
      g.fillStyle(col, 0.14);
      this.shapePath(t.shape, t.ox, t.oy, t.dirX, t.dirY, g, true);
      g.fillStyle(col, 0.22 + prog * 0.25);
      this.shapePath(this.scaled(t.shape, Math.max(0.05, prog)), t.ox, t.oy, t.dirX, t.dirY, g, true);
      const blink = prog > 0.8 && Math.floor(now / 70) % 2 === 0;
      g.lineStyle(t.blockable ? 4 : 6, t.blockable ? 0xffd27a : blink ? 0xffffff : col, 0.95);
      this.shapePath(t.shape, t.ox, t.oy, t.dirX, t.dirY, g, false);
      // 深夜：外框再畫一次在暈影上面（depth 45），遠處的預告也看得清楚（D-103）
      if (s.night) {
        top.lineStyle(3, t.blockable ? 0xffd27a : blink ? 0xffffff : col, 0.9);
        this.shapePath(t.shape, t.ox, t.oy, t.dirX, t.dirY, top, false);
      }
      if (meteor) {
        // 召喚墜星：中央白色十字星閃爍，最後 45% 星星從夜空落下（畫在上層，暈影蓋不住）
        const vx = this.sx(t.ox);
        const vy = this.sy(t.oy);
        const tw = 10 + 4 * Math.sin(now / 90);
        g.fillStyle(0xffffff, 0.5 + 0.4 * prog).fillPoints([new Phaser.Math.Vector2(vx, vy - tw * 1.6), new Phaser.Math.Vector2(vx + tw * 0.4, vy), new Phaser.Math.Vector2(vx, vy + tw * 1.6), new Phaser.Math.Vector2(vx - tw * 0.4, vy)], true);
        g.fillPoints([new Phaser.Math.Vector2(vx - tw * 1.6, vy), new Phaser.Math.Vector2(vx, vy - tw * 0.4), new Phaser.Math.Vector2(vx + tw * 1.6, vy), new Phaser.Math.Vector2(vx, vy + tw * 0.4)], true);
        this.fallingStar(top, vx, vy, Math.max(0, (prog - 0.55) / 0.45));
      }
    }
    this.drawPaws(g, now);
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
      // 畫面外的單位不畫（大地圖上一百多隻怪，以前每幀都畫陰影／圈／血條，還送整張立繪進渲染）；巡邏怪照畫（仇恨圈很大＋腳印）
      const cullM = r * 5 + 80;
      if (!isP && !x.patrol && (px < -cullM || px > GAME_WIDTH + cullM || py < VIEW_TOP - cullM || py > VIEW_BOTTOM + cullM)) {
        if (sp?.visible) sp.setVisible(false);
        continue;
      }
      if (sp && !sp.visible) sp.setVisible(true);
      const winding = !isP && s.telegraphs.some((t) => t.ownerId === x.id);
      // 腳下：陰影＋陣營圈（RO 式）
      g.fillStyle(0x000000, 0.4).fillEllipse(px, py + r * 0.15, r * 2.4, r * 1.0);
      g.lineStyle(isP ? 3 : 2, isP ? 0x7dc8ff : winding ? 0xff5a5a : boss ? 0xffb0d0 : 0xd0d0e0, sp ? 0.75 : 1).strokeEllipse(px, py + r * 0.15, r * 2.3, r * 0.95);
      if (x.defId === 'thorn_mother') {
        // 荊棘母樹（D-107）：腳下一圈搖曳的荊棘根＋淡綠光（程式美術備援）
        g.fillStyle(0x6aff7a, 0.1 + 0.05 * Math.sin(now / 500)).fillEllipse(px, py + r * 0.15, r * 4.2, r * 1.8);
        for (let k = 0; k < 12; k++) {
          const an = (k / 12) * Math.PI * 2 + Math.sin(now / 900 + k) * 0.08;
          const cx0 = px + Math.cos(an) * r * 1.15;
          const cy0 = py + r * 0.15 + Math.sin(an) * r * 0.48;
          const len = r * (0.55 + 0.25 * ((k * 7) % 3)) * (1 + 0.08 * Math.sin(now / 300 + k * 1.7));
          const tx = cx0 + Math.cos(an) * len;
          const ty = cy0 + Math.sin(an) * len * 0.42 - len * 0.35;
          const nx = -Math.sin(an) * r * 0.12;
          const ny = Math.cos(an) * r * 0.05;
          g.fillStyle(k % 2 ? 0x2f5a2a : 0x3f7a34, 1).fillTriangle(cx0 - nx, cy0 - ny, cx0 + nx, cy0 + ny, tx, ty);
        }
      }
      if (x.patrol) this.drawPatroller(g, x, pos, px, py, now, playerU);
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
        else if (winding) sp.setTint(Math.floor(now / 90) % 2 ? 0xff9a9a : (cfg.tint ?? 0xffffff));
        else if (x.fury) sp.setTint(Math.floor(now / 500) % 2 ? 0xff6050 : 0xff8a70); // 暴怒版：紅色脈動
        else if (cfg.tint) sp.setTint(cfg.tint);
        else sp.clearTint();
        headY = sp.y - sp.displayHeight * 0.92;
        if (FLAME_MANE.has(x.defId) && !x.dead) {
          // 燼紅裂谷的狼（D-125）：背上搖曳的火焰鬃毛（染色立繪的程式加料，純畫面）
          const big = x.defId !== 'ember_wolf';
          for (let q = 0; q < (big ? 4 : 3); q++) {
            const fxp = sp.x + (q - (big ? 1.5 : 1)) * r * 0.42 * (sp.flipX ? -1 : 1);
            const fyp = sp.y - sp.displayHeight * (0.62 + 0.05 * Math.sin(q * 2.1));
            const hgt = r * (big ? 1.15 : 0.9) * (0.75 + 0.25 * Math.sin(now / 90 + q * 1.7 + x.id));
            const sway = Math.sin(now / 140 + q + x.id) * r * 0.12;
            top.fillStyle(0xff5a1a, 0.8).fillTriangle(fxp - r * 0.24, fyp, fxp + r * 0.24, fyp, fxp + sway, fyp - hgt);
            top.fillStyle(0xffc04a, 0.95).fillTriangle(fxp - r * 0.11, fyp, fxp + r * 0.11, fyp, fxp + sway * 0.6, fyp - hgt * 0.6);
          }
        }
        if (isP) {
          this.shadowGhost(x, sp, now);
          if (this.s.weapon === 'staff') this.blinkFx(x, sp);
          this.drawUltAim(g, x, now);
          if (this.s.weapon === 'bow' && !x.dead) {
            // 長弓（D-147）：主角身前一把長弓（程式畫的；拉弓時弦往後拉）
            const dir = sp.flipX ? -1 : 1;
            const bx = sp.x + dir * r * 0.7;
            const by = sp.y - sp.displayHeight * 0.48;
            const R = sp.displayHeight * 0.36;
            const pull = x.action && (x.action.kind === 'attack' || x.action.kind === 'skill') ? Math.min(1, (s.tick - x.action.start) / 6) * R * 0.35 : 0;
            const a0 = dir > 0 ? -1.1 : Math.PI - 1.1;
            top.lineStyle(7, 0x3a2410, 0.9).beginPath().arc(bx - dir * R * 0.55, by, R, dir > 0 ? -1.1 : Math.PI - 1.1, dir > 0 ? 1.1 : Math.PI + 1.1, false).strokePath();
            top.lineStyle(4, 0xb07a3a, 1).beginPath().arc(bx - dir * R * 0.55, by, R, a0, a0 + 2.2, false).strokePath();
            const tx = bx - dir * R * 0.55 + Math.cos(a0) * R;
            const ty1 = by + Math.sin(a0) * R;
            const ty2 = by - Math.sin(a0) * R;
            top.fillStyle(0xffd27a, 1).fillCircle(tx, ty1, 3.5).fillCircle(tx, ty2, 3.5);
            top.lineStyle(1.5, 0xf0f0e0, 0.9).beginPath().moveTo(tx, ty1).lineTo(tx - dir * pull, by).lineTo(tx, ty2).strokePath();
            // 弓身的金色描邊（遠看也認得出是弓）
            top.lineStyle(1.5, 0xffe0a0, 0.7).beginPath().arc(bx - dir * R * 0.55, by, R + 2.5, a0 + 0.15, a0 + 2.05, false).strokePath();
            if (pull > 0) {
              // 拉弓時搭著一支箭：箭尾在弦上、箭頭超出弓身；技能的箭頭會發光（顏色跟著招式的狀態）
              const sk = x.action?.kind === 'skill' ? skillDef(this.s, x.action.id) : undefined;
              const st0 = sk?.hits[0]?.status?.id ?? sk?.block?.counter.status?.id;
              const col = sk?.role === 'ult' ? 0xff9ae0 : st0 === 'burn' ? 0xff8a3a : st0 === 'poison' ? 0xa8ff6a : st0 === 'freeze' ? 0xbff4ff : st0 === 'weak' ? 0xc8a0ff : sk ? 0x9fe0ff : 0;
              const ax0 = tx - dir * pull;
              const ax1 = bx + dir * R * 0.55;
              top.lineStyle(3, 0x8a6a40, 1).lineBetween(ax0, by, ax1, by);
              top.fillStyle(0xf4f8ff, 1).fillTriangle(ax1 + dir * 10, by, ax1, by - 5, ax1, by + 5);
              if (col) {
                const gl = 0.5 + 0.5 * Math.sin(now / 60);
                top.fillStyle(col, 0.35 + 0.25 * gl).fillCircle(ax1 + dir * 4, by, (sk?.role === 'ult' ? 16 : 10) + 3 * gl);
              }
            }
          }
          if (this.s.weapon === 'staff' && !x.dead) {
            // 法杖（D-152）：主角身前一根木杖，頂端星晶會呼吸發光；施法時光變大、星晶旁轉一圈符文
            const dir = sp.flipX ? -1 : 1;
            const H = sp.displayHeight;
            const bx = sp.x + dir * r * 0.75;
            const by0 = sp.y - H * 0.12;
            const tx = bx + dir * H * 0.06;
            const ty = sp.y - H * 0.78;
            top.lineStyle(6, 0x3a2410, 0.95).lineBetween(bx, by0, tx, ty);
            top.lineStyle(2.5, 0xc08a48, 1).lineBetween(bx, by0, tx, ty);
            const act = x.action && (x.action.kind === 'attack' || x.action.kind === 'skill');
            const sk = x.action?.kind === 'skill' ? skillDef(this.s, x.action.id) : undefined;
            const st0 = sk?.hits[0]?.status?.id ?? sk?.block?.counter.status?.id;
            const col = sk?.role === 'ult' ? 0xffb07a : st0 === 'burn' ? 0xff8a3a : st0 === 'poison' ? 0xa8ff6a : st0 === 'freeze' ? 0xbff4ff : 0xc89aff;
            const gl = 0.5 + 0.5 * Math.sin(now / (act ? 50 : 260));
            const cr = H * 0.05;
            top.fillStyle(col, (act ? 0.45 : 0.22) + 0.2 * gl).fillCircle(tx, ty, cr * (act ? (sk?.role === 'ult' ? 3.4 : 2.4) : 1.7) + 2 * gl);
            top.fillStyle(0xe8d8ff, 1).fillTriangle(tx, ty - cr * 1.5, tx - cr * 0.8, ty, tx + cr * 0.8, ty).fillTriangle(tx, ty + cr * 1.2, tx - cr * 0.8, ty, tx + cr * 0.8, ty);
            top.fillStyle(0xffffff, 1).fillCircle(tx, ty, cr * 0.35);
            top.lineStyle(1.5, 0xffe0a0, 0.8).strokeCircle(tx - dir * cr * 0.2, ty + cr * 1.6, cr * 0.7);
            if (sk) {
              const rr = cr * (sk.role === 'ult' ? 4.2 : 3);
              const rot = now / 180;
              top.lineStyle(2, col, 0.75).strokeCircle(tx, ty, rr);
              for (let k = 0; k < 4; k++) {
                const aa = rot + (k * Math.PI) / 2;
                top.fillStyle(col, 0.9).fillCircle(tx + Math.cos(aa) * rr, ty + Math.sin(aa) * rr, 3);
              }
            }
          }
        }
      } else {
        g.fillStyle(isP ? (inv ? 0x9fd8ff : 0x4a8aff) : boss ? 0x8a3a6a : 0x6a6a7a, inv ? 0.6 : 1).fillCircle(px, py, r);
        g.lineStyle(3, 0xffffff, 0.9).lineBetween(px, py, px + (x.facingX / 1000) * r * 1.4, py + (x.facingY / 1000) * r * 1.4);
      }
      // 精英詞綴（D-113）：腳下雙圈（顏色＝詞綴），外圈慢慢轉
      if (x.affix && !x.dead) {
        const col = AFFIX_COLOR[x.affix];
        g.lineStyle(3, col, 0.9).strokeEllipse(px, py + r * 0.2, r * 2.6, r * 1.1);
        const rot = now / 400;
        g.lineStyle(4, col, 0.75);
        for (let q = 0; q < 4; q++) {
          const a0 = rot + (q * Math.PI) / 2;
          g.beginPath();
          for (let k = 0; k <= 6; k++) {
            const an = a0 + (k / 6) * 0.9;
            const ex = px + Math.cos(an) * r * 1.65;
            const ey = py + r * 0.2 + Math.sin(an) * r * 0.7;
            if (k === 0) g.moveTo(ex, ey);
            else g.lineTo(ex, ey);
          }
          g.strokePath();
        }
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
      if (isP && x.statuses.some((q) => q.id === 'poison' && q.until > s.tick)) top.fillStyle(0xb060ff, 1).fillCircle(px + r, headY + 10, 7);
      // 變化二的狀態（D-121）：冰凍＝淡藍冰殼、破甲＝紅色裂盾、虛弱＝灰紫向下箭頭
      if (!isP) {
        // 長弓變化二（D-149）：灼燒＝身上竄著小火苗、中毒＝往上冒的綠色泡泡
        if (x.statuses.some((q) => q.id === 'burn' && q.until > s.tick)) {
          const bodyH = Math.max(r, py - headY);
          // 第 35 輪：火苗後面一層會閃的橘光、火苗 3 → 5 根（星焰彈命中後一眼看得出「著火了」）
          top.fillStyle(0xff7a2a, 0.16 + 0.08 * Math.sin(now / 70 + x.id)).fillEllipse(px, py - bodyH * 0.45, bodyH * 1.1, bodyH * 1.2);
          for (let q = 0; q < 5; q++) {
            const fx1 = px + (q - 2) * bodyH * 0.15;
            const fy1 = py - bodyH * (0.28 + 0.12 * (q % 2));
            const hh = bodyH * (0.32 + 0.12 * Math.sin(now / 80 + q * 2 + x.id));
            const w0 = bodyH * 0.09;
            top.fillStyle(0xff6a1a, 0.8).fillTriangle(fx1 - w0, fy1, fx1 + w0, fy1, fx1 + Math.sin(now / 120 + q) * w0 * 0.6, fy1 - hh);
            top.fillStyle(0xffd04a, 0.95).fillTriangle(fx1 - w0 * 0.45, fy1, fx1 + w0 * 0.45, fy1, fx1, fy1 - hh * 0.55);
          }
        }
        if (x.statuses.some((q) => q.id === 'poison' && q.until > s.tick)) {
          for (let q = 0; q < 4; q++) {
            const t = ((now / 900 + q / 4 + x.id * 0.13) % 1);
            top.fillStyle(0x9aff5a, 0.8 * (1 - t)).fillCircle(px + Math.sin(q * 2.3 + x.id) * r * 0.6, py - Math.max(r, py - headY) * (0.3 + 0.6 * t), 4 + 4 * (1 - t));
          }
        }
        if (x.statuses.some((q) => q.id === 'freeze' && q.until > s.tick)) {
          top.fillStyle(0xbff4ff, 0.28).fillEllipse(px, py - r * 0.4, r * 2.6, r * 2.2);
          top.lineStyle(2, 0xe8fcff, 0.85).strokeEllipse(px, py - r * 0.4, r * 2.6, r * 2.2);
        }
        const brk = x.statuses.find((q) => q.id === 'break' && q.until > s.tick);
        if (brk && brk.until > (this.breakSeen.get(x.id) ?? -1)) {
          // 剛被破甲（或破甲被刷新）：身上迸出碎裂的盾片
          if ((this.breakSeen.get(x.id) ?? -1) < s.tick) this.shatter(px, py - r * 0.5, r);
          this.breakSeen.set(x.id, brk.until);
        }
        if (brk) {
          const bx = px - r - 4;
          const by = headY + 10;
          top.fillStyle(0xff5a3a, 1).fillTriangle(bx - 7, by - 7, bx + 7, by - 7, bx, by + 9);
          top.lineStyle(2, 0x2a0a00, 1).lineBetween(bx - 2, by - 7, bx + 2, by + 1);
        }
        if (x.statuses.some((q) => q.id === 'weak' && q.until > s.tick)) {
          const wx = px + r + 4;
          const wy = headY - 6;
          top.fillStyle(0xb08aff, 1).fillTriangle(wx - 6, wy, wx + 6, wy, wx, wy + 9);
          top.fillRect(wx - 2, wy - 7, 4, 7);
        }
      }
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
        const sk = skillDef(this.s, x.action.id);
        // 不動架勢（D-112）：完全不受傷的長窗口格擋 → 窗口內身上金色護罩
        if (sk?.block && sk.block.reducePct >= 100 && s.tick - x.action.start <= sk.block.windowTicks) {
          top.lineStyle(4, 0xffd27a, 0.6 + 0.3 * Math.sin(now / 60)).strokeCircle(px, py - r * 0.6, r * 1.9);
          top.fillStyle(0xffd27a, 0.12).fillCircle(px, py - r * 0.6, r * 1.9);
        }
        // 龍捲（D-112）：施放中可以全速移動的旋轉技能 → 腳下往上收窄的旋風
        if (sk && sk.role === 'aoe' && sk.moveFactor >= 1) {
          const k0 = s.tick - x.action.start;
          top.lineStyle(3, 0xbfe8ff, 0.7);
          for (let q = 0; q < 5; q++) {
            const rr = r * (2.6 - q * 0.38);
            const yy = py - q * r * 0.55;
            const a0 = k0 * 0.5 + q * 0.9;
            top.beginPath().arc(px, yy, rr, a0, a0 + Math.PI * 1.2).strokePath();
          }
        }
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
      if (px >= 0 && px <= GAME_WIDTH && py >= VIEW_TOP + 40 && py <= 960 + TALL) continue;
      const elite = e.tier === 'elite' || !!ENEMIES[e.defId]?.boss;
      // 有小地圖的大地圖：待機的一般怪只在小地圖上，箭頭只留給追過來的怪與精英／Boss（design/20 B6）
      if (this.mini && !elite && e.mode !== 'combat') continue;
      const cx = Math.max(M, Math.min(GAME_WIDTH - M, px));
      const cy = Math.max(VIEW_TOP + M, Math.min(960 + TALL, py));
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
      if (px >= 0 && px <= GAME_WIDTH && py >= VIEW_TOP + 40 && py <= 960 + TALL) continue;
      const cx = Math.max(24, Math.min(GAME_WIDTH - 24, px));
      const cy = Math.max(VIEW_TOP + 24, Math.min(950 + TALL, py));
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
      const pal = (worldMap(this.stageId) ?? WORLD_MAPS[0]!).palette;
      g.fillStyle(pal.mini, 1).fillRect(2, 2, w, h);
      if (a.solid) {
        const c = a.solid.cell * s;
        g.fillStyle(pal.miniSolid, 1);
        a.solid.rows.forEach((row, cy) => {
          for (let cx = 0; cx < row.length; cx++) if (row[cx] === '#') g.fillRect(2 + cx * c, 2 + cy * c, Math.max(1, c), Math.max(1, c));
        });
      }
      // 毒沼（D-114）：小地圖上的亮綠點
      for (const hz of activeHazards(this.s)) g.fillStyle(0x8adf4a, 0.9).fillCircle(2 + hz.x * s, 2 + hz.y * s, Math.max(2, hz.r * s));
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
      // 夜光寶箱（D-108）：深夜時在小地圖上閃藍光
      if (c.nightOnly) {
        if (s.night && !(s.chestsOpened ?? []).includes(c.id)) g.fillStyle(0x9fd0ff, 0.6 + 0.4 * Math.sin(now / 200)).fillRect(m.x + c.x * m.s - 3, m.y + c.y * m.s - 3, 6, 6);
        continue;
      }
      if ((s.chestsOpened ?? []).includes(c.id)) g.fillStyle(0x8a8070, 0.8).fillRect(m.x + c.x * m.s - 2, m.y + c.y * m.s - 2, 4, 4);
    }
    for (const mem of this.memLeft) g.fillStyle(0xd0a8ff, 0.6 + 0.4 * Math.sin(now / 300)).fillCircle(m.x + (mem.tx * UNIT + UNIT / 2) * m.s, m.y + (mem.ty * UNIT + UNIT / 2) * m.s, 3);
    let lastCol = -1;
    let lastAl = -1;
    for (const e of enemiesOf(s)) {
      const elite = e.tier === 'elite' || ENEMIES[e.defId]?.boss;
      if (e.defId === 'thorn_mother') {
        // 荊棘母樹：綠色小樹記號（D-107）
        const tx = m.x + e.x * m.s;
        const ty = m.y + e.y * m.s;
        g.fillStyle(e.mode === 'combat' ? 0xff5a4a : 0x6aff7a, 0.95).fillTriangle(tx, ty - 6, tx - 5, ty + 3, tx + 5, ty + 3);
        g.fillStyle(0x8a6a40, 1).fillRect(tx - 1, ty + 3, 2, 3);
        lastCol = -1;
        continue;
      }
      if (e.patrol) {
        // 巡邏的世界精英（D-117）：橘色箭頭，指向牠正在走的方向
        const tx = m.x + e.x * m.s;
        const ty = m.y + e.y * m.s;
        const a = Math.atan2(e.facingY, e.facingX);
        const pt = (an: number, rr: number) => ({ x: tx + Math.cos(a + an) * rr, y: ty + Math.sin(a + an) * rr });
        g.fillStyle(e.mode === 'combat' ? 0xff5a4a : 0xff8a5c, e.mode === 'dormant' ? 0.6 : 1).fillPoints([pt(0, 6), pt(2.5, 4.5), pt(Math.PI, 2), pt(-2.5, 4.5)], true);
        lastCol = -1;
        continue;
      }
      const col = e.mode === 'combat' ? 0xff5a4a : e.affix ? AFFIX_COLOR[e.affix] : elite ? 0xffa040 : 0xc06a6a;
      const al = e.mode === 'dormant' ? 0.5 : 0.95;
      // 手機效能（第 34 輪）：一般怪畫 4×4 方塊（圓要好幾個指令），顏色沒變就不重設 fillStyle
      if (col !== lastCol || al !== lastAl) {
        g.fillStyle(col, al);
        lastCol = col;
        lastAl = al;
      }
      if (elite) {
        g.fillCircle(m.x + e.x * m.s, m.y + e.y * m.s, 3.5);
        lastCol = -1;
      } else g.fillRect(m.x + e.x * m.s - 2, m.y + e.y * m.s - 2, 4, 4);
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
    if (this.tracked && (this.ptsLeft > 0 || this.bagSt.bag.some((x) => isUpgrade(this.bagSt, x)))) {
      g.fillStyle(0xff4a4a, 1).fillCircle(GAME_WIDTH - 22, 22, 9);
      g.lineStyle(2, 0xffffff, 0.9).strokeCircle(GAME_WIDTH - 22, 22, 9);
    }
    // 地圖怪關卡：附近沒有戰鬥中的怪時提示「點怪物開打」（D-073）
    const es = enemiesOf(s);
    const calm = es.length > 0 && !es.some((e) => e.mode === 'combat') && es.some((e) => e.mode === 'idle' || e.mode === 'dormant');
    this.hud.setText(`${s.prog ? `Lv ${s.prog.level}　` : ''}HP ${p.hp}/${p.maxHp}　MP ${p.mp}　${s.loot ? `${s.enhance?.level ? `武器 +${s.enhance.level}　` : ''}金 ${this.coinBase >= 0 ? this.coinBase + Math.max(0, (s.loot.gold ?? 0) - this.saved.coin) : s.loot.gold ?? 0}　粉塵 ${this.coinBase >= 0 ? this.dustBase + Math.max(0, (s.loot.dust ?? 0) - this.saved.dust) : s.loot.dust ?? 0}` : `敵人 ${es.length}`}　${clock(s.tick)}`);
    if (this.goal) {
      const st = STAGES[this.stageId]!;
      const bossDef = st.enemies.map((e) => ENEMIES[e.enemyId]).find((d) => d?.boss);
      const done = !!bossDef && (s.bossKills ?? []).includes(bossDef.id);
      // 已討伐：第二行顯示「下一個目標」（每 2 秒或狀態改變才重算，避免每幀讀存檔）
      const big = !!worldMap(this.stageId);
      if (done && big && (this.goalDone !== done || this.time.now - this.goalAt > 2000)) {
        this.goalAt = this.time.now;
        this.goalNext = nextGoal(this.stageId, loadRecord(this.stageId), s.prog?.level ?? 1, bossKillsOf(worldMap(this.stageId)?.next ?? ''));
      }
      this.goalDone = done;
      this.goal.setText(bossDef ? (done ? `✔ ${bossDef.name} 已討伐${big && this.goalNext ? `\n▶ ${this.goalNext}` : '・離開巢穴可再挑戰'}` : `目標：往北，打倒${bossDef.name}`) : '').setColor(done ? '#9fe8a0' : '#ffd27a');
    }
    const fires = STAGES[this.stageId]?.campfires ?? [];
    const atFire = fires.some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= CAMPFIRE_RULES.safeUnits * UNIT);
    const restTip = fires.length === 0 ? '' : atFire && (p.hp < p.maxHp || s.potions < playerDef(this.s).potion.carry) ? '點營火休息：HP 全滿・補藥水' : !atFire && p.hp * 2 < p.maxHp ? '打不過就退回營火（怪不追進來）' : '';
    this.calmText.setVisible(calm && !this.tipBusy && !this.hint).setText(calm ? restTip || (p.hp < p.maxHp ? '休息中・自動回血　準備好就點怪物開打' : '點怪物開打（一次拉一組）') : '').setAlpha(0.75 + 0.25 * Math.sin(this.time.now / 300));
    // Boss 大血條（畫面上方）
    // 地圖怪關卡：Boss 交戰中才顯示（在遠處待機時不擋畫面）
    const boss = enemiesOf(s).find((e) => ENEMIES[e.defId]?.boss && (!STAGES[this.stageId]?.mapAi || e.mode === 'combat'));
    this.goal?.setVisible(!boss);
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
      const cd = id === 'dodge' ? playerDef(this.s).dodge.cooldownTicks : skillDef(this.s, id)!.cooldownTicks;
      const left = Math.max(0, (p.ready[id] ?? 0) - s.tick);
      g.fillStyle(i === 4 ? 0x2a4a6a : 0x3a2a14, 0.95).fillCircle(x, y, R);
      g.lineStyle(3, left ? 0x555566 : i === 4 ? 0x9fd8ff : 0xffd27a, 1).strokeCircle(x, y, R);
      if (this.editing?.pick === i) g.lineStyle(5, 0x7dffb0, 0.6 + 0.4 * Math.sin(this.time.now / 120)).strokeCircle(x, y, R + 8);
      if (left > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / cd), false).fillPath();
      }
      this.btnText[i]!.setText(left > 0 ? `${(left / TICKS_PER_SEC).toFixed(1)}` : i === 4 ? '閃避' : skillDef(this.s, id)!.name);
    });
    // 大招：MP 環（滿 40 才亮）＋冷卻
    {
      const ult = skillDef(this.s, 'blade_storm')!;
      const need = ult.mp ?? 40;
      const { x, y } = this.btnPos(5);
      const R = this.btnR(5);
      const left = Math.max(0, (p.ready['blade_storm'] ?? 0) - s.tick);
      const ok = left === 0 && p.mp >= need;
      // 長弓第一次（D-147）：教「保持距離」
      if (this.s.weapon === 'bow' && !this.bot && !this.menu && enemiesOf(s).some((e) => e.mode === 'combat')) this.tipOnce('jg_tip_bow', '長弓：站遠一點射！狼貼過來就按「後躍射擊」拉開距離', '#c8f0a0');
      if (this.s.weapon === 'staff' && !this.bot && !this.menu && enemiesOf(s).some((e) => e.mode === 'combat')) this.tipOnce('jg_tip_staff', '法杖：狼貼過來先按「冰霜新星」凍住，再拉開距離放星焰彈', '#dcc0ff');
      if (ok && !this.bot && !this.menu) this.tipOnce('jg_tip_ult', `大招充滿了！按右下粉紅色「${ult.name}」`, '#ff9ae0');
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
      this.btnText[5]!.setText(left > 0 ? `${(left / TICKS_PER_SEC).toFixed(1)}` : ok ? skillDef(s, 'blade_storm')!.name.replace(/^(..)/, '$1\n') : `MP\n${p.mp}/${need}`);
      this.btnText[5]!.setColor(ok ? '#ffffff' : '#c890b0');
    }
    // 藥水：剩餘數量＋冷卻；血少於 40% 時閃爍提醒
    {
      const { x, y } = this.btnPos(6);
      const R = this.btnR(6);
      const pt = playerDef(this.s).potion;
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
      g.fillStyle(0xff7ad0, 1).fillRect(x0, 98, (w * p.mp) / playerDef(this.s).mp, 4);
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
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setDepth(75);
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
