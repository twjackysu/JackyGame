// 即時戰鬥試玩場景（除錯入口：?debug&scene=RtBattle&stage=forest_entry；D-063／D-065，design/20 §B8 P1）。
// Phaser 只負責畫 BattleState 與收輸入 → BattleCommand；戰鬥結果全部由 src/core/battle/rt 決定（D-062）。
import { onlineLoot } from '../onlineLoot';
import Phaser from 'phaser';
import { cdText, hudLine, textColor } from '../hudText';
import { SFX } from '../../audio/sfx';
import { SKILLS, STAGES } from '../../core/battle/rt/data';
import { activeHazards, attacksOf, createBattle, enemiesOf, isSolidAt, playerDef, playerOf, setBossFury, setGearBonus, setSkillMods, setSkillVariants, skillDef, skillShape, step, ventLeft, xpToNext } from '../../core/battle/rt/engine';
import { RARITY_COLOR, genGear, type RtGear } from '../../core/battle/rt/gear';
import { bonusOf, isUpgrade, openRtBagPanel, type BagState } from '../ui/rtBagPanel';
import { openRtShopPanel } from '../ui/rtShopPanel';
import { openMarketPanel } from '../ui/marketPanel';
import { openTradePanel } from '../ui/tradePanel';
import { openWarehousePanel } from '../ui/warehousePanel';
import { warehouseOps, type WarehouseOps, type WarehousePage } from '../warehouseOps';
import { tradeOps, type TradeOps, type TradePage } from '../tradeOps';
import { BannerSystem } from '../rt/BannerSystem';
import { AFFIX_COLOR, drawMinimap } from '../rt/MinimapSystem';
import { marketOps, type MarketOps, type MarketPage } from '../marketOps';
import { coinOf, spendCoin } from '../rtShop';
import { cardSummary, grantCard, openEmberCardPanel, syncChestCards } from '../ui/emberCardPanel';
import { addWithAutoSalvage } from '../rtBag';
import { gearIcon } from '../fx/gearIcons';
import { skillModsOf } from '../rtBag';
import { BOT_PROFILES, PlayerBot, summarize } from '../../core/battle/rt/sim';
import type { BattleCommand, BattleState, Shape, Unit } from '../../core/battle/rt/types';
import { CAMPFIRE_RULES, CHEST_RULES, ELITE_AFFIXES, TICKS_PER_SEC, UNIT, aggroUnitsOf } from '../../core/battle/rt/types';

/** 精英詞綴顏色（D-113）：迅捷青、堅韌綠、狂暴紅 */
/** 命中時會在地上長出荊棘的招式（第 23 輪） */
const THORN_ATTACKS = new Set(['queen_lance', 'queen_lance2', 'queen_roots', 'queen_bloom', 'mother_lance', 'mother_roots']);
/** 背上畫火焰鬃毛的怪（D-125） */
const FLAME_MANE = new Set(['ember_wolf', 'obsidian_alpha', 'magma_stalker']);
/** 荊棘谷的狼（第 40 輪）：背上一排荊棘刺（「棘背狼」名副其實），染色立繪的程式加料 */
const THORN_BACK: Readonly<Record<string, number>> = { thorn_wolf: 0x4a1f38, thorn_stalker: 0x5a1f1a, night_thorn_alpha: 0x2a1a4a };
/** 星隕高原的狼（第 40 輪）：染色立繪身上加會閃的星痕；彗星巡者拖彗尾、星蝕狼背上一輪日蝕 */
/** 精英／Boss 撞牆暈眩，每次進圖用置中大字講幾次（D-238），之後在牠頭上小字 */
const STUN_BIG_TIMES = 2;
const STUN_BIG_BOSS = 3;
const CALM_TAUGHT_LV = 2; // D-244：新玩家 Lv2 起底部字條不再教「點怪物開打」
const LOW_HP_TIP_MS = 8000; // D-242：老玩家低血「打不過就退回營火」每次只講 8 秒
const LOW_HP_TIP_GAP_MS = 45000; // D-245：講過之後 45 秒內再低血（血量在一半上下來回）不重講
const STAR_MARKS = new Set(['star_wolf', 'astral_alpha', 'comet_stalker', 'eclipse_wolf']);

/** 大招鍵的字（第 46 輪）：四個字以上才拆兩行（「隕星術」以前會拆成「隕星／術」） */
export function ultLabel(name: string): string {
  return name.length >= 4 ? name.replace(/^(..)/, '$1\n') : name;
}

import { cellIndex, findPath, gridOf } from '../../core/battle/rt/path';
import { ENEMIES } from '../../core/battle/rt/data';
import { eliteFighting, gateSealed } from '../gateRules';
import { gearName, heroKey, loadWeapon, nextWeapon, saveWeapon, weaponSetup, WEAPON_NAME } from '../weapon';
import { makeTestWorldStage } from '../../core/battle/rt/maps/testWorld';
import { WORLD_MAPS, worldMap, prevMap, FINALE_MAP } from '../worldMaps';
import { GAME_HEIGHT, GAME_WIDTH, TALL } from '../config';
import { BTN_COUNT, JOY_INDEX, buttonPos, buttonR, clampPos, fireRowLayout, inStickZone, keyBadge, BTN_ACTIONS, loadControls, saveControls, swapSlots, type RtControls } from '../rtControls';
import { openRtControlsPanel } from '../ui/rtControlsPanel';
import { bountyKill, cleanBounties } from '../rtBounty';
import { cleanRanks, cleanVariants, mergeMods, rankMods, skillPoints, usedPoints } from '../rtSkills';
import { openRtSkillPanel } from '../ui/rtSkillPanel';
import { InputSystem } from '../rt/InputSystem';
import { captureLegacy, legacyOp } from '../../client/legacyOps';
import { characterCache } from '../../client/characterCache';
import { BOUNTY_LABEL, bountyBoardText, stageEnemyIds } from '../rt/BountyBoard';
import type { BountyDoneView, LootDropView } from '../../net/views';
import { EMPTY_SNAP, FURY_UNLOCK, cleanBag, fmtSec, furyUnlocked, loadRecord, nightUnlocked, mergeRun, recordBoss, saveRecord, spend, mapOpen, nextGoal, levelTip, bossKillsOf, frontierAfter, returnIntro, nightIntro, walletOf, type RtRecord, type RunSnap } from '../rtRecord';
import { TITLE_FONT, UI_FONT, bannerBusy, bigText, floatNumber, pinBanner, reserveBanner, setBannerAvoid, shockRing, sparks } from '../fx/feel';
import { Ambient } from '../fx/ambient';
import { NightLight, fireGlowTexture, nightShadeTexture, type LightSpot } from '../fx/nightLight';
import { loadFinaleStats, playFinale, playPrologue, prologueSeen } from '../ui/finale';
import { choiceOf, loadChoices, makeChoice, saveChoices, shopDiscountPct, SPARE_DISCOUNT, type BossChoice, type ChoicePick } from '../choices';
import { openChoice } from '../ui/choicePanel';
import { claimThanks, ENCOUNTER_RADIUS, ESCORT_RADIUS, ESCORT_SCARED_TILES, encountersOf, leftMapsExcept, loadEncounters, markMetThisVisit, meet, openEncounters, pendingThanks, saveEncounters, type Encounter } from '../encounters';
import { openWeaponPick, weaponChosen } from '../ui/weaponPick';
import { OffscreenArrows } from '../rt/offscreenArrows';
import { buildMemoryBook } from '../ui/memoryBook';
import { cardOps, shopOps } from '../shopOps';
import { coreBurstCue, queenBloomCue, ventEruptCue } from '../fx/bossCues';
import { loadMemories, MEMORIES, MEMORY_RADIUS, memoriesOf, recall, saveMemories, type Memory } from '../memories';
import { getSettings, updateSettings } from '../settings';
import { RangedFx } from '../fx/rangedFx';
import { FieldFx } from '../fx/fieldFx';
import { makeGround } from '../rt/ground';
import { Companion } from '../fx/companion';
import { drawChoiceMarkArt, drawGateArt } from '../fx/landmarks';
import { eliteFall } from '../fx/eliteFall';
import { DashFx } from '../fx/dashFx';
import { drawStorm, type StormView } from '../fx/stormFx';
import { GroundHazards, LAVA_ATTACKS, METEOR_ATTACKS } from '../fx/groundHazards';
import { drawCardRival, drawMerchant } from '../fx/merchant';
import { drawEncounterNpc } from '../fx/encounterNpc';
import { CachedDraw, type DrawBox } from '../fx/cachedDraw';
import { DiscLayer } from '../rt/uiDisc';

// D-332：小貼圖的範圍（腳底為原點的設計單位；第 154 輪把每個人物每種樣子 10 秒內畫過的範圍量出來，再留 6～16 的邊）
const MER_BOX: DrawBox = { l: -60, t: -106, r: 48, b: 14 };
const RIVAL_BOX: DrawBox = { l: -64, t: -124, r: 46, b: 14 };
const NPC_BOX: DrawBox = { l: -95, t: -106, r: 70, b: 24 };
const NPC_CACHE_MAX = 4;
import { tipMs, wrapTip, zoneHintBreak, hintRepeats } from '../ui/tipText';
import { APP_HIDDEN, clickBackButton, pressBack, setBackHandler } from '../backButton';
import { PEEK_IN, PEEK_TOTAL, peekBlocked, peekFocus, peekWeight } from '../cameraPeek';
import { fightKeep, hiddenEliteBannerY } from '../fx/bannerStack';
import { chapterLabel, chapterSeen, markChapterSeen, playChapterCard, postGameEndLabel } from '../ui/chapterCard';
import { CARDS as EMBER_CARDS, CHEST_CARDS, opponentsAt } from '../../core/cards/emberCards';
import { drawRankAura } from '../fx/rankAura';
import { pveRankAura, refreshRank } from '../rankCache';
import { pvpOps } from '../pvpOps';

const STEP_MS = 1000 / TICKS_PER_SEC;
/** 兩則教學提示之間至少安靜多久（D-176） */
const TIP_GAP_MS = 2500;
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
/** 主角在可視區的垂直位置（偏上，留空間給下方操作鍵） */
const FOCUS_Y = 0.42;
/** 鏡頭可以往地圖上緣外多捲的世界單位（第 63 輪） */
const TOP_EXTRA = 150;
/** 第一次提示／回營火說明的高度（第 38 輪，D-163）：以前寫死 700＝正好蓋在主角身上（主角在 VIEW_TOP＋可視高×0.42：844 高的手機約 718），
 *  黃框格擋提示一出來就把正在打你的狼蓋住。改排在主角下方 250，下排操作鍵上面。 */
const TIP_Y = Math.round(Math.min(VIEW_TOP + (GAME_HEIGHT - VIEW_TOP) * FOCUS_Y + 250, GAME_HEIGHT - 545)); // 360×640（高 1280）不壓到 MP 球；第 72 輪 470→545：兩行提示（巡守、大招充滿）的下緣以前壓到大招鍵
/** 立繪對應（D-067；沒有圖就退回程式圓形） */
const SPRITE: Record<string, { key: string; h: number; flip: boolean; tint?: number }> = {
  swordsman: { key: 'hero_lian', h: 3.6, flip: true },
  wolf: { key: 'enemy_mist_wolf', h: 2.9, flip: true },
  wolf_pup: { key: 'enemy_mist_wolf', h: 2.9, flip: true, tint: 0xc8e0ff },
  alpha_wolf: { key: 'enemy_mist_wolf', h: 2.8, flip: true, tint: 0xffb080 },
  shade_wolf: { key: 'enemy_mist_wolf', h: 3.0, flip: true, tint: 0xa88aff },
  thorn_shooter: { key: 'enemy_thorn_shroom', h: 2.9, flip: false },
  thorn_mother: { key: 'enemy_thorn_mother', h: 2.6, flip: false },
  wolf_king: { key: 'enemy_boss_wolfking', h: 3.0, flip: false },
  // 荊棘谷（D-114）：棘背狼、棘冠狼后、荊棘巡獵者用 AI 圖（R-013～R-015），其他先用現有立繪染色
  thorn_wolf: { key: 'enemy_thorn_wolf', h: 2.9, flip: true },
  thorn_queen: { key: 'enemy_boss_thornqueen', h: 3.2, flip: false },
  night_thorn_alpha: { key: 'enemy_mist_wolf', h: 3.0, flip: true, tint: 0xc890ff },
  thorn_stalker: { key: 'enemy_thorn_stalker', h: 3.1, flip: true },
  mist_warden: { key: 'enemy_mist_wolf', h: 3.0, flip: true, tint: 0x7ae8d8 },
  // 燼紅裂谷（D-125）：史萊姆與岩王用 AI 圖（R-016、R-017；沒有圖時退回 fx/emberArt.ts 的程式美術），其他先用現有立繪染色
  slag_slime: { key: 'enemy_slag_slime', h: 2.2, flip: false },
  ember_wolf: { key: 'enemy_mist_wolf', h: 2.9, flip: true, tint: 0xffa070 },
  ember_shroom: { key: 'enemy_thorn_shroom', h: 2.9, flip: false, tint: 0xffb080 },
  obsidian_alpha: { key: 'enemy_mist_wolf', h: 3.0, flip: true, tint: 0x9a8aa8 },
  ember_colossus: { key: 'enemy_ember_colossus', h: 3.0, flip: true },
  magma_stalker: { key: 'enemy_mist_wolf', h: 3.1, flip: true, tint: 0xff6a3a },
  // 星隕高原（D-138）：守望者與魔像是程式美術（fx/starArt.ts），其他先用現有立繪染色
  star_wolf: { key: 'enemy_mist_wolf', h: 2.9, flip: true, tint: 0x9ab8ff },
  star_shroom: { key: 'enemy_thorn_shroom', h: 2.9, flip: false, tint: 0x90a0ff },
  crystal_golem: { key: 'enemy_crystal_golem', h: 2.4, flip: false },
  astral_alpha: { key: 'enemy_mist_wolf', h: 3.0, flip: true, tint: 0xe0d0ff },
  star_sentinel: { key: 'enemy_star_sentinel', h: 3.1, flip: true },
  comet_stalker: { key: 'enemy_mist_wolf', h: 3.1, flip: true, tint: 0xc8e0ff },
  eclipse_wolf: { key: 'enemy_mist_wolf', h: 3.1, flip: true, tint: 0x7a5aff },
};
const HINT_KEY = 'jg_rt_hint_seen';
/**
 * 第 68 輪：每次進圖都可能重講的說明，只講前 times 次（`key` 記次數，呼叫一次算一次）；讀不到 localStorage 就照講。
 * 用在深夜說明（每張圖前 2 次進深夜）、隱藏精英的連殺提示（每張圖前 3 次）。
 */
function timesDue(key: string, times: number): boolean {
  try {
    const n = Number(localStorage.getItem(key) ?? 0) || 0;
    if (n >= times) return false;
    localStorage.setItem(key, String(n + 1));
  } catch {
    /* 無痕模式等：照講 */
  }
  return true;
}
/** 巡邏怪的仇恨圈／視線顏色（D-117） */
const PATROL_COLOR: Record<string, number> = { thorn_stalker: 0xff8a5c, shade_wolf: 0xa88aff, mist_warden: 0x6ae8d0, magma_stalker: 0xff5a2a, comet_stalker: 0x8ab0ff, eclipse_wolf: 0x9a7aff };
/** 懸賞名稱：兩張地圖共用（D-114，棘背狼算野狼、狼后算狼王） */
const fx0 = (x: Unit): number => x.facingX / 1000;
const fy0 = (x: Unit): number => x.facingY / 1000;

/** 掉落物名稱（寶箱內容顯示用） */
const LOOT_NAMES: Record<string, string> = Object.fromEntries([['gold', '金幣'], ['dust', '粉塵'], ['crystal', '結晶'], ['potion', '藥水']]);

export class RtBattleScene extends Phaser.Scene {
  private s!: BattleState;
  private stageId = 'forest_entry';
  private seed = 1;
  private acc = 0;
  private g!: Phaser.GameObjects.Graphics;
  /** 段位光環（每幀從 rankCache 讀；沒到荊棘段位＝null） */
  private get rankAura(): ReturnType<typeof pveRankAura> {
    return pveRankAura();
  }
  private ui!: Phaser.GameObjects.Graphics;
  private evIdx = 0;
  private k = 0.4;
  /** 上次說明「跑出巢穴 Boss 回滿」的時間（D-185） */
  private leashToldAt = -1e9;
  private gateShutToldAt = -1e9;
  /** 每個地區上次報名稱的時間（D-185：60 秒內不重報） */
  private zoneSeenAt = new Map<string, number>();
  /** 第 94 輪（D-236）：這次進圖已經講過說明（第二行）的地區——再走進來只報地名 */
  private zoneHinted = new Set<string>();
  /** 往下一張地圖的光門（D-186）：打倒這張圖的 Boss 後出現在巢穴北邊，走進去就換地圖 */
  /** 這趟進地圖的出生點（回程光門放在它南邊） */
  private spawnAt = { x: 0, y: 0 };
  /** 首次討伐後的光門在等哪個面板關掉（抉擇／通關演出）才出現 */
  private gateWaits: '' | 'choice' | 'finale' = '';
  /** 第 85 輪（D-219）：鏡頭「看一眼」畫面外剛亮起的光門（世界座標＋開始時間），null＝沒有 */
  private camPeek: { x: number; y: number; at: number; id?: number; share?: number } | null = null;
  /** 走進光門的時間（-1＝沒在過場）、這次是不是從光門過來的 */
  private warpAt = -1;
  /** 第 56 輪：經光門抵達＝從回程門走出來（主角從光柱裡降下、淡入），-1＝沒有 */
  private arriveAt = -1;
  private via = '';
  /** 這次是從上次休息的營火出發（D-230） */
  private resumed = false;
  /** 位移招殘影／法杖閃現（第 151 輪拆出去） */
  private readonly dash = new DashFx(this, () => this.s);
  /** 畫面外的箭頭與距離字（fx 拆出去，第 151 輪） */
  private readonly offArrows = new OffscreenArrows({
    scene: this,
    viewTop: VIEW_TOP,
    s: () => this.s,
    now: () => this.time.now,
    k: () => this.k,
    sx: (x) => this.sx(x),
    sy: (y) => this.sy(y),
    goalBounds: () => (this.goal?.visible && this.goal.text ? this.goal.getBounds() : this.bossTxt?.visible ? this.bossTxt.getBounds() : null),
    bountyBounds: () => (this.bountyTxt?.visible && this.bountyTxt.text ? this.bountyTxt.getBounds() : null),
    mini: () => this.mini,
    btnPos: (i) => this.btnPos(i),
    btnR: (i) => this.btnR(i),
    zoneTexts: () => this.zoneTexts,
    clearOfHudPanels: (x, y, ax, w) => this.clearOfHudPanels(x, y, ax, w),
    gates: () => this.gates,
    menuOpen: () => !!this.menu,
  });
  private gates: { x: number; y: number; to: string; label: Phaser.GameObjects.Text; armed: boolean; back: boolean; revealAt?: number }[] = [];
  private ox = 0;
  private oy = 0;
  /** 輸入（Q5：搖桿、鍵盤、累積的指令） */
  private readonly inp = new InputSystem();
  private btnText: Phaser.GameObjects.Text[] = [];
  private discs!: DiscLayer;
  /** 桌機（沒有觸控）在按鈕右上角標快捷鍵（D-265） */
  private keyBadges: (Phaser.GameObjects.Text | null)[] = [];
  private joyBadge: Phaser.GameObjects.Text | null = null;
  private bot: PlayerBot | null = null;
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
  private ringG!: Phaser.GameObjects.Graphics;
  /** 靜態地面（只畫一次，每幀只移動位置）；大地圖切成多塊材質（手機 GPU 單張上限常是 4096px） */
  private ground!: Phaser.GameObjects.Container;
  private calmText!: Phaser.GameObjects.Text;
  /** 上一 tick 的座標（60 FPS 插值用） */
  private prev = new Map<number, { x: number; y: number }>();
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  /** 點地移動的路徑預覽（世界座標）；玩家換格或目的地改變才重算 */
  private pathPreview: { key: string; pts: [number, number][] } | null = null;
  /** 點了營火：走到旁邊就自動休息 */
  private flashUntil = new Map<number, number>();
  /** 命中停頓（hit-stop）剩餘毫秒：期間不推進模擬 */
  private hitStop = 0;
  /** Boss 倒下的慢動作（第 29 輪）：剩餘毫秒，期間戰鬥以 0.3 倍速前進 */
  private slowMs = 0;
  /** 鏡頭（世界座標，鏡頭中心） */
  private camX = 0;
  private drawnOnce = false;
  private camY = 0;
  private dotNum = new Map<number, { t: Phaser.GameObjects.Text; at: number; sum: number; skill: string }>();
  /** 霧中小狼等小跟班（第 150 輪拆出去） */
  private readonly cub = new Companion({ k: () => this.k, sx: (x) => this.sx(x), sy: (y) => this.sy(y), viewTop: VIEW_TOP, viewBottom: VIEW_BOTTOM });
  /** 共用小特效（第 150 輪拆出去） */
  private readonly ffx = new FieldFx(this, { k: () => this.k, sx: (x) => this.sx(x), sy: (y) => this.sy(y) });
  /** 地上的荊棘／熔岩／冰晶（第 150 輪拆出去） */
  private readonly hz = new GroundHazards(this, { k: () => this.k, sx: (x) => this.sx(x), sy: (y) => this.sy(y), ffx: this.ffx, viewBottom: VIEW_BOTTOM });
  /** 遠程武器的技能特效（第 150 輪拆出去） */
  private readonly rfx = new RangedFx(this, {
    k: () => this.k,
    sx: (x) => this.sx(x),
    sy: (y) => this.sy(y),
    hitStop: (ms) => {
      this.hitStop = Math.max(this.hitStop, ms);
    },
    viewTop: VIEW_TOP,
    slash: (x, y, ang, r, deg, color, width) => this.ffx.slash(x, y, ang, r, deg, color, width),
    starImpact: (vx, vy, r) => this.ffx.starImpact(vx, vy, r),
    fallingStar: (g, vx, vy, f) => this.ffx.fallingStar(g, vx, vy, f),
    spawnFrost: (x, y, r) => this.hz.spawnFrost(x, y, r),
  });
  private hint: Phaser.GameObjects.Container | null = null;
  /** 已播過特效的技能段（`施放 tick:段`） */
  private fxDone = new Set<string>();
  /** 選單開著＝暫停 */
  private menu: Phaser.GameObjects.Container | null = null;
  /** 面板開著時被藏起來的置中大字（面板關掉再放回來） */
  private readonly banners = new BannerSystem();
  private botName: string | null = null;
  private lastWarnTick = -1;
  private blinkHinted = new Set<string>();
  /** 精英撞牆暈眩的置中大字這次進圖已經講過幾次（D-238） */
  private stunBig = 0;
  /** Boss 撞牆暈眩的置中大字這次進圖講過幾次 */
  private stunBoss = 0;
  /** 玩家有沒有主動點過怪／按過技能（刷怪關 30 秒沒動作就提示） */
  private engaged = false;
  /** 精英／Boss 邊緣箭頭的距離字（物件池） */
  /** 營火光暈（預先烘好的放射漸層，ADD 混色；每幀只改位置與縮放） */
  private glows: Phaser.GameObjects.Image[] = [];
  /** 營火旁的旅商／燼牌對手、路上的相遇人物畫成小貼圖（D-332，每秒重畫 24 次；以前每幀上千筆 Graphics 指令） */
  private fireCache: { mer: CachedDraw; rival: CachedDraw }[] = [];
  private npcCache: CachedDraw[] = [];
  /** 大地圖目標列（沒有就 null） */
  private goal: Phaser.GameObjects.Text | null = null;
  /** Boss 大血條下的名稱＋剩餘％（第 52 輪：以前血條沒有名字，打起來不知道在打誰、還剩多少） */
  private bossTxt: Phaser.GameObjects.Text | null = null;
  private goalDone = false;
  /** HUD 的金幣＝錢包（上次存檔時）＋這場還沒存的（D-116 行商之後金幣是能花的錢） */
  private coinBase = -1;
  private leftFire = false;
  /** true＝先不跳一次性提示：開場大字（y 760）還在、或上一個提示還沒消失（用場景時鐘，和 bigText 補間同步） */
  private tipBusy = false;
  /** 上一則教學提示消失後先安靜一下（D-176：新存檔前 20 秒以前連續四則提示、每則只隔 0.2 秒） */
  private tipCalmUntil = 0;
  /** 第 78 輪：燼紅裂谷首次討伐後等著播通關演出（星隕高原等「番外　完」卡）——教學小字先不講（以前「大招充滿了！」在結語和演出之間冒出來，馬上被演出蓋掉） */
  private storySoon = false;
  /** 第幾次開場（場景重啟後舊的開場回呼作廢） */
  private openRun = 0;
  private nightRun = 0;
  /** 幕名卡播到什麼時候（這之前不出地區名稱與前世的記憶） */
  private chapterUntil = 0;
  /** 上一則「稀有裝備！」大字出現的時間（番外收尾卡等它淡掉） */
  private rareAt = -1e9;
  private holdRun = 0;
  /** 誰最後把 tipBusy 設成 true（第 61 輪）：舊的放行計時／destroy 回呼只有在還是自己的時候才放行，不會把開場大字的「忙」解掉 */
  private busyRun = 0;
  /** 討伐後「首次討伐！…」那則字（抉擇面板等它出現一陣子再開，第 76 輪） */
  private slainSub: Phaser.GameObjects.Text | null = null;
  private slainSubAt = 0;
  private choiceWait = 0;
  /** 正在顯示的教學小字（第 76 輪：升級數值要用那個位置時讓它晚一點重講） */
  private liveTip: { t: Phaser.GameObjects.Text; key: string; text: string; color: string } | null = null;
  /** 討伐大字（「暴怒的○○倒下了！…」）還在畫面上的時間，解鎖公告等它淡出 */
  private slainUntil = 0;
  /** 第 65 輪：Boss 第二階段大字（「狼后怒放・荊棘綻放！」）顯示期間，深夜說明／公告大字先排隊，不疊在上面 */
  private phaseUntil = 0;
  /** Boss 第二階段大字還在（第 88 輪，D-226）：升級的數值小字等它淡出再出 */
  private phaseBannerUntil = 0;
  private nightTip?: Phaser.GameObjects.Text;
  /** 第 56 輪：剛經光門抵達，回程門的字晚一點才淡入（不然一落地就貼在主角旁邊） */
  private gateLabelFrom = 0;
  /** 荊棘巡獵者的腳印（D-117，純畫面）：世界座標＋朝向＋留下的時間 */
  private paws: { x: number; y: number; a: number; t: number; side: number }[] = [];
  /** 每隻巡邏怪上一個腳印的位置（unit id → 位置） */
  private pawLast = new Map<number, { x: number; y: number; side: number }>();
  private tipsDone = new Set<string>();
  private fireHinted = false;
  /** 前 3 次進大地圖才顯示的引導 */
  private newbie = false;
  /** 第 67 輪：打倒過第一隻 Boss（霧角狼王）的老玩家——閒下來時不再一直顯示「點怪物開打」 */
  private veteran = false;
  /** 第 97 輪（D-242）：這次「血不到一半、不在營火」從什麼時候開始（老玩家「打不過就退回營火」只講 8 秒） */
  private lowHpAt = 0;
  private lowTipAt = -Infinity;
  private dustBase = 0;
  private goalAt = 0;
  private goalNext = '';
  private gateAhead = '';
  /** 這張圖以前就打倒過 Boss（舊玩家回來）：目標字條改寫「下一個目標」，不再寫「打倒○○」（第 58 輪） */
  private goalBefore = false;
  /** 霜旋（D-121）的冰晶與結霜圈畫在這層 */
  private frostG!: Phaser.GameObjects.Graphics;
  private stormLo!: Phaser.GameObjects.Graphics;
  private stormHi!: Phaser.GameObjects.Graphics;
  private stormView: StormView | null = null;

  /** 碎甲（D-121 演出收尾，第 26 輪）：每隻怪上一次看到的破甲結束 tick；變大＝剛被破甲 → 盾片碎裂 */
  private breakSeen = new Map<number, number>();
  /** 影步殘影（第 26 輪）：上一次留下分身的時間 */
  private bountyTxt: Phaser.GameObjects.Text | null = null;
  /** 還沒點的技能點（☰ 紅點用；升級與改動時更新） */
  private ptsLeft = 0;
  /** 目前所在地區（StageDefinition.zones）；換區時顯示名稱 */
  private zoneName: string | null = null;
  /** 上方的記憶卡／回禮卡（第 52 輪）：還在的時候地區名稱先不出，等卡片淡掉再出（以前地區名稱與危險說明被卡片整個蓋住） */
  private topCard: Phaser.GameObjects.Container | null = null;
  /** 正在顯示的地區名稱／地區說明（Boss 登場時收掉，D-184） */
  private zoneTexts: Phaser.GameObjects.Text[] = [];
  /** 開場說明框出現的時間（第 52 輪） */
  private hintAt = 0;
  /** 這場已經提示過隱藏精英 */
  private streakHinted = false;
  /** 這場已經提示過 Boss 弱點 */
  private bossMemo = false;
  /** 已經提示過「有點熟悉」的寶箱 */
  private chestHinted = new Set<string>();
  /** 前世的記憶（D-137）：這張圖還沒想起來的記憶點 */
  private memLeft: Memory[] = [];
  /** 走到了、但開場大字還在 → 先記著，大字收掉再想起（第 61 輪：星隕高原從光門抵達，記憶卡和開場大字同時出現） */
  private memQ: Memory | null = null;
  /** 「這個地方似乎有點熟悉……」還在畫面上到這個時間（D-239：記憶卡等它淡掉再出） */
  private chestHintUntil = 0;
  /** 剛想起「和 Boss 攻略提示同一件事」的記憶的時間（D-240） */
  private memTipAt = -1e9;
  /** Boss 攻略提示講的就是瞬移（星隕高原）時，提示在畫面上的時段；這段時間第一次瞬移不另跳大字（D-241） */
  private tipBlinkFrom = 0;
  private tipBlinkUntil = 0;
  /** 第一次瞬移大字出現的時間（D-241：之後 8 秒內攻略提示不再講同一件事） */
  private blinkSaidAt = -1e9;
  /** 倒下後在營火旁醒來的那幾秒（第 61 輪）：不報地區名稱、不出「似乎有點熟悉」，只留「在營火旁醒來」 */
  private reviveUntil = 0;
  /** 開場大字佔著 tipBusy 時的 busyRun（-1＝沒有） */
  private introRun = -1;
  /** 路上的相遇（D-159）：還沒選的、選了「助」等著道謝的 */
  private encOpen: Encounter[] = [];
  private encThanks: Encounter[] = [];
  /** 這次已經道謝過的：還站在原地（高興的樣子、沒有氣泡），下次進地圖就不在了 */
  private encDone: Encounter[] = [];
  /** 第 69 輪：選「取」的人留在原地（垂頭喪氣、沒有氣泡）；選「助」的慢慢走開、淡出（以前一選完人就當場消失） */
  private encStay: Encounter[] = [];
  private encLeave: { e: Encounter; born: number; dir: number; sad?: boolean }[] = [];
  private encLeaveG?: Phaser.GameObjects.Graphics;
  /** 護送中（D-160）：跟在玩家身後的相遇人物（世界座標）；送到目的地就道謝。純畫面 */
  private escort: { e: Encounter; x: number; y: number; t: number; scared?: boolean; check?: number } | null = null;
  /** 相遇人物畫在哪（世界座標；護送送到之後留在目的地） */
  private encAt = new Map<string, { x: number; y: number }>();
  /** 小地圖（場地比畫面大很多時才有）：畫面座標與每世界單位的像素 */
  private mini: { x: number; y: number; w: number; h: number; s: number } | null = null;
  private idleHinted = false;

  constructor() {
    super('RtBattle');
  }

  init(data: { stage?: string; seed?: number; bot?: string; via?: string }): void {
    this.via = data.via ?? '';
    this.warpAt = -1;
    this.chapterUntil = 0; this.rareAt = -1e9; this.slainUntil = 0;
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
    // 第 63 輪：記住上次玩的大地圖，標題那顆按鈕會亮金框＋▶
    if (wm && !this.bot) {
      try {
        localStorage.setItem('jg_last_map', wm.id);
      } catch {
        /* 無痕模式等：略過 */
      }
    }
    this.ventHit.clear();
    this.ventKills = 0;
  }

  create(): void {
    refreshRank(() => pvpOps.ladder());
    // Bot 示範也帶著玩家的等級與裝備（只讀、不存）
    const big = !!STAGES[this.stageId]?.bossZone && !!STAGES[this.stageId]?.spawnGroups?.length && !!worldMap(this.stageId);
    const rec0 = this.tracked || big ? loadRecord(this.stageId) : {};
    this.bagSt = this.tracked || big ? cleanBag(rec0) : { bag: [], equip: {} };
    this.runSalt = (((rec0.runs ?? 0) + 1) * 2654435761 + this.seed * 40503) >>> 0;
    this.s = createBattle({ stageId: this.stageId, seed: this.seed, level: rec0.level, xp: rec0.xp, bonus: this.tracked || big ? bonusOf(this.bagSt) : undefined, skillMods: this.tracked ? mergeMods(skillModsOf(this.bagSt), rankMods(cleanRanks(rec0.skills, rec0.level ?? 1))) : big ? skillModsOf(this.bagSt) : undefined, skillVariants: this.tracked ? cleanVariants(rec0.variants, cleanRanks(rec0.skills, rec0.level ?? 1)) : undefined, night: this.tracked && !!rec0.night && nightUnlocked(rec0), weapon: this.tracked || worldMap(this.stageId) ? weaponSetup(loadWeapon()) : undefined });
    if (this.tracked && !this.bot) onlineLoot.start(this.stageId, !!this.s.night, loadWeapon(), (done, defId, drops) => this.onlineBounty(done, defId, drops));
    this.ctl = loadControls();
    this.saved = EMPTY_SNAP;
    this.bossTimed = false;
    this.editing = null;
    if (this.tracked) {
      // 正式大地圖（D-087）：沒有時間限制（核心的 timeLimitTicks 只給模擬器用）；開過的寶箱下次是空箱
      this.s.timeLimitTicks = 24 * 3600 * TICKS_PER_SEC;
      const rec = loadRecord(this.stageId);
      const valid = new Set((STAGES[this.stageId]?.chests ?? []).filter((c) => !c.nightOnly).map((c) => c.id));
      // 線上版（第 147 輪）：開過哪些寶箱以伺服器的地圖進度為準（loot.chest 記的；角色快取上一場就有）
      const srvChests = import.meta.env.VITE_SERVER_URL ? characterCache.get()?.maps[this.stageId]?.chests : undefined;
      const opened = (srvChests ?? rec.chests ?? []).filter((id) => valid.has(id));
      if (opened.length) this.s.chestsOpened = [...opened];
      // 暴怒狼王（D-099）：上次選了而且已解鎖 → 這次進森林的狼王就是暴怒版
      if (rec.fury && furyUnlocked(rec, this.s.prog?.level ?? 1)) setBossFury(this.s, true);
      this.saved = { ...EMPTY_SNAP, chests: [...opened] };
      saveRecord(this.stageId, { ...rec, runs: (rec.runs ?? 0) + 1 });
      const onHide = (): void => {
        if (document.visibilityState === 'hidden') this.persist();
      };
      document.addEventListener('visibilitychange', onHide);
      const onAppHide = (): void => this.persist(); // 第 80 輪：Android App 縮到背景（D-212）
      window.addEventListener(APP_HIDDEN, onAppHide);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.persist();
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener(APP_HIDDEN, onAppHide);
      });
    }
    this.acc = 0;
    this.evIdx = 0;
    this.ended = false;
    this.inp.reset();
    // 全螢幕面板（行囊、行商、技能點、☰…）開著時藏起置中大字（D-176，同 D-172 的抉擇面板）
    this.banners.reset();
    this.events.off('postupdate', this.menuBanners, this);
    this.events.on('postupdate', this.menuBanners, this);
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
    { const p0 = playerOf(this.s); this.cub.clear(); if (loadChoices()[this.stageId] === 'spare') this.spawnCub(p0.x - UNIT, p0.y + UNIT); }
    { const bz = STAGES[this.stageId]?.bossZone; const cp = loadChoices()[this.stageId]; this.choiceMark = bz && cp && this.tracked ? { x: bz.x + UNIT * 1.6, y: bz.y + UNIT * 1.2, map: this.stageId, pick: cp } : null; }
    this.zoneName = null;
    this.zoneSeenAt.clear();
    this.zoneHinted.clear();
    this.leashToldAt = -1e9;
    this.gateShutToldAt = -1e9;
    this.gates = [];
    this.gateWaits = '';
    this.camPeek = null;
    this.offArrows.reset();
    { const p0 = playerOf(this.s); this.spawnAt = { x: p0.x, y: p0.y }; }
    this.setupGate();
    this.resumed = this.resumeAtFire();
    this.arriveAt = -1;
    // 第 56 輪：走光門過來的，就站在這張圖的回程門前（像剛從門裡走出來），不是憑空出現在營火旁
    if (this.via === 'gate') {
      const bg = this.gates.find((q) => q.back);
      const p0 = playerOf(this.s);
      if (bg && !p0.dead) {
        // 從門往出生點（營火）那側走出 1.9 格：站在門裡或門南會被石柱、門楣蓋住，而且太貼地圖下緣。
        // 回程門可能在出生點的東／西／北（setupGate 的備選），所以沿「門→出生點」的方向算，不寫死往北
        const dx = this.spawnAt.x - bg.x;
        const dy = this.spawnAt.y - bg.y;
        const d = Math.hypot(dx, dy) || 1;
        const t = Math.min(1, (UNIT * 1.9) / d);
        p0.x = bg.x + dx * t;
        p0.y = bg.y + dy * t;
        bg.armed = false; // 要先離開 2 格才會再觸發
        this.arriveAt = this.time.now;
        this.time.delayedCall(260, () => {
          if (!this.scene.isActive()) return;
          const pp = playerOf(this.s);
          shockRing(this, this.sx(bg.x), this.sy(bg.y), 0xffe8c0, 200, 700, 6);
          shockRing(this, this.sx(pp.x), this.sy(pp.y), 0xd8f8ff, 150, 600, 5);
          sparks(this, this.sx(pp.x), this.sy(pp.y) - 50 * this.k, 18, 'spark', 0xfff4d8, 600);
        });
      }
    } else if (this.via === 'gateBack' && !playerOf(this.s).dead) {
      // 從回程門回來（gateBack）：回到營火旁（光門在巢穴，可能有 Boss），一樣從光裡降下，不要憑空出現
      this.arriveAt = this.time.now;
      this.time.delayedCall(260, () => {
        if (!this.scene.isActive()) return;
        const pp = playerOf(this.s);
        shockRing(this, this.sx(pp.x), this.sy(pp.y), 0xffe8c0, 170, 650, 5);
        sparks(this, this.sx(pp.x), this.sy(pp.y) - 50 * this.k, 16, 'spark', 0xfff4d8, 600);
      });
    }
    this.topCard = null;
    this.zoneTexts = [];
    this.chestHinted = new Set();
    this.bossMemo = false;
    this.cameras.main.setZoom(1); // 保險：舊版 Boss 登場會推鏡頭
    this.blinkHinted = new Set(); // 場景重開不會重跑欄位初始值
    this.stunBig = 0;
    this.stunBoss = 0;
    this.rareQueue = [];
    this.salvageQ = { n: 0, dust: 0, name: '' };
    this.afterFinale = [];
    this.introText = null;
    this.introStr = '';
    this.streakHinted = false;
    const p0 = playerOf(this.s);
    this.camX = p0.x;
    this.camY = p0.y;
    this.updateCamera(1);
    this.drawnOnce = false;
    // 地圖外（鏡頭往下多捲、讓主角不被按鈕擋住時看得到）用這張圖的密林／岩壁底色，看起來像牆延伸出去，不是黑洞（第 39 輪）
    this.cameras.main.setBackgroundColor(worldMap(this.stageId)?.palette.under ?? 0x0b1410);
    this.cameras.main.resetFX();
    if (this.via) {
      const [r, g, b] = this.via === 'gateBack' ? [255, 236, 210] : [215, 245, 255];
      this.cameras.main.fadeIn(700, r, g, b);
    }
    this.gateLabelFrom = this.via ? this.time.now + 1400 : 0;
    this.ground = makeGround(this, this.s, this.stageId, this.k, VIEW_BOTTOM - VIEW_TOP);
    this.glows = (STAGES[this.stageId]?.campfires ?? []).map(() => this.add.image(0, 0, fireGlowTexture(this)).setBlendMode(Phaser.BlendModes.ADD));
    // D-332：要排在 this.g 底下（同 depth 0、先加進場景）
    this.fireCache = this.tracked ? (STAGES[this.stageId]?.campfires ?? []).map(() => ({ mer: new CachedDraw(this, this.k * 1.5 * 1.2, MER_BOX), rival: new CachedDraw(this, this.k * 1.5 * 1.1, RIVAL_BOX) })) : [];
    this.npcCache = this.tracked && !this.bot ? Array.from({ length: NPC_CACHE_MAX }, () => new CachedDraw(this, this.k * 2.1, NPC_BOX)) : [];
    this.g = this.add.graphics();
    this.frostG = this.add.graphics().setDepth(9); // 霜旋的冰晶（在單位底下、地面之上）
    this.top = this.add.graphics().setDepth(45);
    // 劍刃風暴持續的旋風（第 70 輪，D-202）：地上光圈在單位底下、刀刃與氣流在單位之上（ADD）
    this.stormLo = this.add.graphics().setDepth(9.6).setBlendMode(Phaser.BlendModes.ADD);
    this.stormHi = this.add.graphics().setDepth(41).setBlendMode(Phaser.BlendModes.ADD);
    this.stormView = null;
    this.ringG = this.add.graphics().setDepth(46); // 巢穴邊界（D-185）：要蓋過樹冠與霧
    this.ui = this.add.graphics().setDepth(50);
    this.discs = new DiscLayer(this, 49.5); // 按鈕底（第 154 輪）：在 ui 畫筆底下，冷卻扇形／MP 環畫在它上面
    // 頂部標題列（蓋在世界之上；底部漸層避免硬切）
    const hdr = this.add.graphics().setDepth(48);
    hdr.fillStyle(0x0b1410, 0.94).fillRect(0, 0, GAME_WIDTH, VIEW_TOP);
    for (let i = 0; i < 12; i++) hdr.fillStyle(0x0b1410, 0.6 * (1 - i / 12)).fillRect(0, VIEW_TOP + i * 2, GAME_WIDTH, 2);
    // 深夜（D-103）：整個畫面壓暗、偏藍
    // 第 152 輪（A3）：一般畫質改成動態光照（主角＋營火＋閃光擦出黑幕）；省電畫質照舊用靜態暗角圖
    this.nightLight = this.s.night && !getSettings().lowFx ? new NightLight(this, GAME_WIDTH, GAME_HEIGHT, 42) : null;
    this.nightShade = this.s.night && !this.nightLight ? this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, nightShadeTexture(this)).setDisplaySize(3200, 3200).setDepth(42) : null;
    // 環境粒子（第 27 輪）：大地圖才有；光塵／螢火蟲、花瓣孢子、火星灰燼
    const amb = worldMap(this.stageId);
    this.ambient = amb ? new Ambient(this, amb.decor, getSettings().lowFx, !!this.s.night, { x: 0, y: VIEW_TOP, w: GAME_WIDTH, h: VIEW_BOTTOM - VIEW_TOP }) : null;
    this.add.text(GAME_WIDTH / 2, 40, this.tracked || worldMap(this.stageId) ? `${STAGES[this.stageId]!.name}${this.s.night ? '・深夜' : ''}` : `即時戰鬥試玩・${STAGES[this.stageId]!.name}`, { fontFamily: TITLE_FONT, fontSize: '30px', color: '#ffd27a' }).setOrigin(0.5).setDepth(49);
    this.calmText = this.add.text(GAME_WIDTH / 2 - 50, 850, '', { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#ffd27a', stroke: '#000', strokeThickness: 4, backgroundColor: '#00000088' }).setPadding(14, 6, 14, 6).setOrigin(0.5).setDepth(65);
    this.hud = this.add.text(GAME_WIDTH / 2, 82, '', { fontFamily: UI_FONT, fontSize: '18px', color: '#c8d0f0' }).setOrigin(0.5).setDepth(49);
    // 大地圖（有 Boss 又有重生點）：HUD 下方的目標列
    const stG = STAGES[this.stageId];
    if (this.s.night && this.tracked && STAGES[this.stageId]?.chests?.some((c) => c.nightOnly)) {
      // 第 59 輪：以前用固定 3.2／5.6 秒，和開場大字、幕名卡、記憶卡疊成四層 → 排隊，等開場那些都收掉才一則一則出（nightTipsRun）
      const tips: [string, string][] = [['深夜：遠處的藍色光柱是夜光寶箱\n（每次進深夜都會補滿）', '#bfe0ff']];
      // 深夜的山谷（D-115）：毒沼擴散＋多兩灘
      if (STAGES[this.stageId]?.hazards?.some((h) => h.nightOnly || h.nightR)) tips.push(['深夜的毒沼擴散了\n荊棘坡與迴廊也冒出新的毒沼', '#a8f08a']);
      // 深夜的裂谷（D-125）：噴發口更頻繁＋熔核巡者
      // 深夜的高原（D-138）：星星落得更頻繁
      // 深夜的森林（第 41 輪）：以前只說寶箱，沒提霧影狼巡邏
      if (STAGES[this.stageId]?.spawnGroups?.some((gr) => gr.nightOnly && gr.enemyId === 'shade_wolf')) tips.push(['深夜的森林有「霧影狼」在巡邏\n別走進牠面前的扇形視線', '#c8a8ff']);
      if (STAGES[this.stageId]?.vents?.some((v) => v.nightEveryTicks)) tips.push(this.starMap ? ['深夜的星星落得更頻繁\n晶簇林有「星蝕狼」在巡邏', '#c8d8ff'] : ['深夜的熔岩口噴得更頻繁\n熔渣坡有「熔核巡者」在巡邏', '#ffb36a']);
      // 第 68 輪：深夜說明（寶箱、毒沼擴散、巡邏怪）每張圖只講前 2 次進深夜；老玩家每次開遊戲都被講一輪太囉嗦
      if (!this.bot && timesDue(`jg_night_tips_${this.stageId}`, 2)) this.nightTipsRun(tips, ++this.nightRun, 3200);
    }
    // 營地懸賞（D-109）：小地圖下方小字，完成自動領獎
    this.bountyTxt = this.tracked ? this.add.text(10, VIEW_TOP + 212, '', { fontFamily: UI_FONT, fontSize: '17px', color: '#e8dcc0', backgroundColor: 'rgba(0,0,0,0.5)', lineSpacing: 2 }).setPadding(8, 4, 8, 4).setOrigin(0, 0).setDepth(49) : null;
    this.refreshBounty();
    this.ptsLeft = this.tracked ? this.skillPointsLeft() : 0;
    this.goalDone = false; this.goalAt = 0; this.goalNext = ''; this.goalBefore = false;
    this.coinBase = this.tracked ? coinOf(loadRecord(this.stageId)) : -1;
    this.leftFire = false;
    this.fireHinted = false;
    // 第 66 輪：打倒過這張圖的 Boss 就不算新手（以前通關後從回程門回霧語森林，runs 還不到 3，Lv16 老玩家又被教一次營火）
    const recN = loadRecord(this.stageId);
    this.newbie = this.tracked && (recN.runs ?? 0) <= 3 && !recN.bossKills;
    // 第 67 輪：打倒過這張圖 Boss 的老玩家不再每次開遊戲進圖都被教一次「熔岩口噴發／星星砸下來了／毒沼」
    // （兩個旗標都是場景欄位、不重設＝新玩家每次開遊戲說一次，維持原樣）
    if (this.tracked && recN.bossKills) {
      this.ventHinted = true;
      this.hazardHinted = true;
    }
    this.veteran = this.tracked && bossKillsOf(WORLD_MAPS[0]!.id) > 0;
    this.dustBase = this.tracked ? walletOf(loadRecord(this.stageId)).dust : 0;
    this.hz.reset();
    this.breakSeen.clear(); this.dash.reset();
    // 第 46 輪：95 會壓在 MP 條（96～104）與經驗條（104～110）上，往下挪到 Boss 血條的位置（打 Boss 時目標字條本來就藏起來）
    this.goal = stG?.bossZone && stG.spawnGroups?.length ? this.add.text(GAME_WIDTH / 2, 114, '', { fontFamily: UI_FONT, fontSize: '20px', fontStyle: '700', color: '#ffd27a', backgroundColor: 'rgba(0,0,0,0.55)', align: 'center', lineSpacing: 4 }).setPadding(12, 3, 12, 3).setOrigin(0.5, 0).setDepth(49) : null;
    this.bossTxt = this.add.text(GAME_WIDTH / 2, 136, '', { fontFamily: UI_FONT, fontSize: '19px', fontStyle: '700', color: '#ffd0e4', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(49).setVisible(false);
    this.makeButtons();
    this.makeMinimap();
    this.makeFireBtn();
    this.menu = null;
    // 第 80 輪（D-212）：Android 返回鍵／返回手勢＝關掉最上層面板，沒有面板就開暫停選單（以前直接關掉 App）
    setBackHandler(this, () => {
      if (this.editing) this.endEdit();
      else if (this.warpAt >= 0) { /* 光門過場中 */ }
      else if (this.menu) {
        // 面板自己處理返回（燼牌對局中要按兩次，D-229）；沒處理才點它的返回類按鈕
        const own = this.menu.getData?.('back') as (() => boolean) | undefined;
        if (!own?.()) clickBackButton([this.menu]);
      }
      else if (!this.ended) { SFX.uiTap(); this.toggleMenu(); }
      return 'handled';
    });
    // 第 120 輪（D-266）：桌機 Esc＝返回鍵（關最上層面板／開暫停選單）；操作設定等新按鍵時 Esc 是「取消」，讓給面板
    this.input.keyboard?.off('keydown-ESC');
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.menu?.getData?.('keyWait')) return;
      pressBack();
    });
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
    this.tipCalmUntil = 0;
    this.storySoon = false;
    this.paws = [];
    this.pawLast.clear();
    { const en = loadEncounters(); const on = this.tracked && !this.bot; if (on) leftMapsExcept(this.stageId); this.encOpen = on ? openEncounters(en, this.stageId) : []; this.encThanks = on ? pendingThanks(en, this.stageId) : []; this.encDone = []; this.encStay = []; this.encLeave = []; this.escort = null; this.encAt.clear(); }
    { this.memQ = null; this.chestHintUntil = 0; this.memTipAt = -1e9; this.tipBlinkFrom = 0; this.tipBlinkUntil = 0; this.blinkSaidAt = -1e9; this.introRun = -1; this.reviveUntil = 0; const have = loadMemories(); this.memLeft = this.tracked && !this.bot ? memoriesOf(this.stageId).filter((m) => !have.includes(m.id)) : []; }
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
    // 第 120 輪（D-263）：桌機拖著搖桿把滑鼠移出畫面才放開，Phaser 只發 pointerupoutside → 以前主角會一直走
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.bindKeys();
    (window as unknown as { __rt?: unknown }).__rt = { state: () => this.s, result: () => summarize(this.s), send: (c: BattleCommand) => this.inp.push(c) };
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
    this.inp.bindKeys(this.input.keyboard, this.ctl);
  }

  private makeButtons(): void {
    for (const t of this.btnText) t.destroy();
    const names = [...this.ctl.order.map((id) => ((this.s ? skillDef(this.s, id) : undefined) ?? SKILLS[id])!.name), '閃避', '大招', '藥水'];
    const sc = this.ctl.scale;
    this.btnText = names.map((n, i) => {
      const { x, y } = this.btnPos(i);
      return this.add.text(x, y, n, { fontFamily: UI_FONT, fontSize: `${Math.round((i === 4 ? 22 : i === 6 ? 17 : 20) * sc)}px`, fontStyle: '700', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(60);
    });
    // 桌機快捷鍵小標（D-265）：成果發表多半用電腦開，以前只有進「操作設定」才知道 WASD／1～4／空白
    for (const t of this.keyBadges) t?.destroy();
    this.keyBadges = [];
    if (!this.sys.game.device.input.touch) {
      this.keyBadges = BTN_ACTIONS.map((a, i) => {
        const k = keyBadge(this.ctl.keys[a]);
        if (!k) return null;
        const { x, y } = this.badgePos(i);
        return this.add.text(x, y, k, { fontFamily: UI_FONT, fontSize: `${Math.round(15 * sc)}px`, fontStyle: '700', color: '#1a0f08', backgroundColor: '#e8dcc0', align: 'center' }).setOrigin(0.5).setPadding(5, 1, 5, 1).setDepth(61).setAlpha(0.85);
      });
    }
    this.joyBadge?.destroy();
    this.joyBadge = null;
    if (!this.sys.game.device.input.touch) {
      const mv = (['up', 'left', 'down', 'right'] as const).map((a) => keyBadge(this.ctl.keys[a]));
      const label = mv.join('') === 'WASD' ? 'WASD 移動' : mv.every(Boolean) ? `${mv.join(' ')} 移動` : '';
      if (label) this.joyBadge = this.add.text(0, 0, label, { fontFamily: UI_FONT, fontSize: `${Math.round(15 * sc)}px`, fontStyle: '700', color: '#1a0f08', backgroundColor: '#e8dcc0' }).setOrigin(0.5, 0).setPadding(6, 1, 6, 1).setDepth(61).setAlpha(0.7);
    }
  }
  private badgePos(i: number): { x: number; y: number } {
    const b = this.btnPos(i);
    const r = this.btnR(i) * 0.72;
    return { x: b.x + r, y: b.y - r };
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
        if (i < 4) this.inp.push({ type: 'skill', id: this.slotSkill(i) });
        else if (i === 4) this.inp.push({ type: 'dodge', dx: this.inp.stick?.dx ?? 0, dy: this.inp.stick?.dy ?? 0 });
        else if (i === 5) this.inp.push({ type: 'skill', id: 'blade_storm' });
        else this.inp.push({ type: 'potion' });
        SFX.uiTap();
        return;
      }
    }
    // 點小地圖＝走到那裡（A* 尋路）
    const m = this.mini;
    if (m && !this.bot && p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h) {
      const goal = this.freeNear(Math.round((p.x - m.x) / m.s), Math.round((p.y - m.y) / m.s));
      if (goal) this.inp.push({ type: 'moveTo', x: goal[0], y: goal[1] });
      this.inp.restOnArrive = false;
      SFX.uiTap();
      return;
    }
    if (m && p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h) return;
    if (inStickZone(this.ctl, p.x, p.y)) {
      this.inp.stickStart(p);
      return;
    }
    // 點敵人＝鎖定
    const wx = (p.x - this.ox) / this.k;
    const wy = (p.y - this.oy) / this.k;
    // 點營火＝走過去休息（design/20 B4）
    const fire = (STAGES[this.stageId]?.campfires ?? []).find((c) => Math.hypot(c.x - wx, c.y - wy) <= UNIT * 0.9);
    if (fire && !this.bot) {
      this.inp.push({ type: 'moveTo', x: fire.x, y: fire.y + UNIT });
      this.inp.restOnArrive = true;
      this.tapMarker(p.x, p.y);
      return;
    }
    const hit = enemiesOf(this.s).find((e) => Math.hypot(e.x - wx, e.y - wy) <= e.r + 60);
    if (hit) {
      this.inp.push({ type: 'target', id: hit.id });
      this.inp.restOnArrive = false;
      this.engaged = true;
      return;
    }
    // 點地＝走過去（A* 繞石頭；D-071）；搖桿一動或點敵人就取消
    if (p.y > VIEW_TOP && !this.bot) {
      this.inp.push({ type: 'moveTo', x: Math.round(wx), y: Math.round(wy) });
      this.inp.restOnArrive = false;
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
    this.inp.stickMove(p);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.editing) return this.editUp();
    this.inp.stickEnd(p);
  }

  private commands(): BattleCommand[] {
    if (this.bot) return this.bot.decide(this.s);
    return this.inp.commands(
      (i) => this.slotSkill(i),
      () => {
        const pl = playerOf(this.s);
        return (STAGES[this.stageId]?.campfires ?? []).some((c) => Math.hypot(c.x - pl.x, c.y - pl.y) <= CAMPFIRE_RULES.restUnits * UNIT);
      },
    );
  }

  // ---------- 主迴圈 ----------
  update(_t: number, delta: number): void {
    if (this.editing) {
      this.draw();
      return;
    }
    if (this.warpAt >= 0) {
      this.draw();
      this.warpPose();
      return;
    }
    if (this.ended || this.menu) {
      // 第 81 輪：序章／選武器在第一幀前就打開，以前地圖從沒畫過——序章淡出、幕名卡、選武器背後是地圖左上角的空樹林（沒有主角、營火），選完才跳過去
      if (!this.drawnOnce) {
        this.drawnOnce = true;
        this.ambient?.update(0, this.ox, this.oy);
        this.draw();
      }
      return;
    }
    this.drawnOnce = true;
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
    if (this.arriveAt >= 0) this.arrivePose();
    this.idleHint();
    this.zoneBanner();
    this.updateFireBtn();
    this.chestHint();
    this.memoryCheck();
    this.encounterCheck();
    this.gateCheck();
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
    const base = loadRecord(this.stageId);
    const rec = mergeRun(base, this.saved, now);
    if (import.meta.env.VITE_SERVER_URL) {
      // 線上版（第 148 輪，NEXT #2）：錢包、等級是伺服器的（舊 key 只是快取，loot.claim 回來時寫回）；
      // 本機撿的金幣／粉塵／結晶、本機算的經驗不算進去——以前會暫時多算到下一次寫回，燼牌、行商面板看到的錢比伺服器多
      rec.coin = base.coin;
      rec.dust = base.dust;
      rec.crystal = base.crystal;
    } else if (this.s.prog) {
      rec.level = this.s.prog.level;
      rec.xp = this.s.prog.xp;
    }
    if (this.s.campfireId) rec.fire = this.s.campfireId; // D-230
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
      (r, v, intent) => {
        // V2（D-285）：伺服器照同一份規則處理「意圖」，做完寫回舊 key；畫面先照舊存檔
        const before = captureLegacy();
        saveRecord(this.stageId, { ...loadRecord(this.stageId), skills: r, variants: v });
        void legacyOp(
          before,
          ['skills'],
          (c, me) =>
            intent.kind === 'add' ? c.call('skills.add', { characterId: me.id, skill: intent.skill }) : intent.kind === 'variant' ? c.call('skills.variant', { characterId: me.id, skill: intent.skill, idx: intent.idx }) : c.call('skills.reset', { characterId: me.id }),
          (v) => v,
        );
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
    // 線上版（第 147 輪）：懸賞由伺服器計數，看角色快取
    const oc = import.meta.env.VITE_SERVER_URL ? characterCache.get() : null;
    const st = cleanBounties(oc ? oc.bounty : loadRecord(this.stageId).bounty);
    // 懸賞三張地圖共用：這張地圖打不到的目標標「別圖」（文字規則在 rt/BountyBoard.ts）
    this.bountyTxt.setText(bountyBoardText(st.list, stageEnemyIds(STAGES[this.stageId])));
  }

  private bountyKill(defId: string): void {
    if (!this.tracked) return;
    // 線上版（第 147 輪）：計數與獎勵由伺服器的 loot.claim 做，結果回來時 onlineBounty 公告
    if (import.meta.env.VITE_SERVER_URL) return;
    const rec = loadRecord(this.stageId);
    const st = cleanBounties(rec.bounty);
    const r = bountyKill(st, defId);
    if (r.st === st) return;
    let out: RtRecord = { ...rec, bounty: r.st };
    for (const b of r.completed) out = spend(out, -b.reward.dust, -b.reward.crystal) ?? out;
    this.announceBounty(r.completed, defId);
    saveRecord(this.stageId, out);
    this.dustBase = walletOf(out).dust;
    this.refreshBounty();
    if (r.completed.length && this.bountyTxt) this.tweens.add({ targets: this.bountyTxt, scale: 1.12, duration: 160, yoyo: true });
  }

  /** 線上版：伺服器的角色回來了（loot.claim／寶箱／相遇）：舊 key 已經換成伺服器的行囊與錢包 → 重讀；懸賞完成與掉落的裝備公告 */
  private onlineBounty(done: readonly BountyDoneView[], defId: string, drops: readonly LootDropView[] = []): void {
    if (!this.scene.isActive()) return;
    // 面板開著時不換（面板自己拿著一份；關掉後下一次回來再換）
    if (!this.menu) {
      const rec = loadRecord(this.stageId);
      this.bagSt = cleanBag(rec);
      setGearBonus(this.s, bonusOf(this.bagSt));
      setSkillMods(this.s, this.allMods(this.bagSt));
    }
    const p = playerOf(this.s);
    // 伺服器擲的金幣／粉塵／結晶（第 151 輪）：本機撿到的不飄字了，改飄伺服器給的（跟 HUD 一致）
    drops.forEach((d, i) => {
      if (d.kind === 'gold' || d.kind === 'dust' || d.kind === 'crystal') this.time.delayedCall(i * 120, () => this.scene.isActive() && this.pickupFloat(d.kind, d.amount));
    });
    drops.forEach((d, i) => {
      if (d.kind !== 'gear' || !d.itemId) return;
      const it = characterCache.get()?.items.find((x) => x.id === d.itemId);
      const g = it?.gear as RtGear | undefined;
      if (!g) return;
      const r = (d.rarity ?? 1) as 1 | 2 | 3;
      const col = `#${RARITY_COLOR[r].toString(16).padStart(6, '0')}`;
      this.time.delayedCall(i * 300, () => floatNumber(this, this.sx(p.x), this.sy(p.y) - 110, gearName(g), { color: col, size: r >= 3 ? 30 : 24 }));
    });
    this.announceBounty(done, defId);
    this.refreshBounty();
    if (done.length && this.bountyTxt) this.tweens.add({ targets: this.bountyTxt, scale: 1.12, duration: 160, yoyo: true });
  }

  /** 撿到金幣／粉塵／結晶／藥水的小字（離線：本機撿到時；線上：伺服器 loot.claim 回來時） */
  private pickupFloat(kind: string, amount: number): void {
    const p = playerOf(this.s);
    const L: [string, string] =
      kind === 'gold' ? [`+${amount} 金`, '#ffd27a'] : kind === 'dust' ? [`粉塵 +${amount}`, '#9fd8ff'] : kind === 'crystal' ? [`結晶 +${amount}`, '#d0a0ff'] : [`藥水 +${amount}`, '#7dffb0'];
    floatNumber(this, this.sx(p.x) + 40, this.sy(p.y) - 70, L[0], { color: L[1], size: kind === 'gold' ? 22 : 24 });
    if (kind !== 'gold') SFX.itemGet();
  }

  private announceBounty(done: readonly BountyDoneView[], defId: string): void {
    done.forEach((b, i) => {
      // 第 43 輪：以前一律寫懸賞池的原名（在燼紅裂谷打完燼芯菇卻顯示「荊棘射手」）→ 用這張圖剛打倒的那種；精英類照懸賞板寫「首領級精英」
      const name = b.target === 'alpha_wolf' ? BOUNTY_LABEL.alpha_wolf! : ENEMIES[defId]?.name ?? ENEMIES[b.target]?.name ?? b.target;
      const got = [b.reward.dust ? `粉塵 +${b.reward.dust}` : '', b.reward.crystal ? `結晶 +${b.reward.crystal}` : ''].filter(Boolean).join('・');
      this.time.delayedCall(600 + i * 1400, () => {
        SFX.itemGet();
        bigText(this, GAME_WIDTH / 2, 430, `懸賞完成！${name} ×${b.need}\n${got}`, '#ffe08a', 36, 1200);
      });
    });
  }

  // ---------- 裝備（D-091） ----------
  /** 撿到裝備：用種子產生數值、放進行囊、立刻存檔；稀有以上大字 */
  /** 等著合成一則「稀有裝備！」大字的（250ms 內撿到的） */
  private rareQueue: { name: string; night: boolean; col: string }[] = [];
  /** 250ms 內自動分解的普通裝（合成一則） */
  private salvageQ = { n: 0, dust: 0, name: '' };

  private gotGear(itemId: number, rarity: 1 | 2 | 3, ilvl: number): void {
    if (!this.tracked) return;
    // 線上版（第 147 輪）：裝備由伺服器擲（loot.claim），本機擲的不放進行囊；伺服器的回來時 onlineSynced 公告
    if (import.meta.env.VITE_SERVER_URL) return;
    const p = playerOf(this.s);
    const g = genGear((Math.imul(this.runSalt, 31) + itemId * 2246822519) >>> 0, rarity, ilvl, { night: !!this.s.night, region: this.stageId });
    // 行囊滿了：自動分解最差的普通裝（D-100）；連普通裝都沒有才提示整理
    const r = addWithAutoSalvage(this.bagSt, g);
    if (!r) {
      floatNumber(this, this.sx(p.x), this.sy(p.y) - 110, '行囊滿了！（☰ → 行囊整理）', { color: '#ff9a8a', size: 24 });
      this.tipOnce('jg_tip_bagfull', '行囊滿了，裝備撿不起來！\n☰ → 行囊：把用不到的精良／稀有分解換粉塵', '#ff9a8a');
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
      // 第 41 輪：Boss 一次掉好幾件時合成一則（以前每件一行、疊成一團）；第一次說明規則
      const sq = this.salvageQ;
      if (!sq.n)
        this.time.delayedCall(250, () => {
          const q = this.salvageQ;
          const pp = playerOf(this.s);
          floatNumber(this, this.sx(pp.x), this.sy(pp.y) - 150, q.n > 1 ? `行囊滿・自動分解普通裝 ×${q.n}　+${q.dust} 粉塵` : `行囊滿・自動分解 ${q.name} +${q.dust} 粉塵`, { color: '#c8c0a8', size: 22 });
          this.salvageQ = { n: 0, dust: 0, name: '' };
        });
      this.salvageQ = { n: sq.n + 1, dust: sq.dust + r.dust, name: gearName(r.salvaged) };
      this.tipSoon('jg_tip_salvage', '行囊滿了（60 件）：之後撿到裝備\n會自動分解最差的普通裝換粉塵', '#d8d0b8');
      if (r.salvaged.uid === g.uid) return;
    }
    // 第 66 輪：真的放進行囊才教「去換上」（以前行囊滿撿不起來，5 秒後還說「撿到裝備了！」）
    this.time.delayedCall(900, () => this.tipSoon('jg_tip_gear', '撿到裝備了！☰「行囊」或營火旁可以換上', '#9fe8a0'));
    const col = `#${RARITY_COLOR[rarity].toString(16).padStart(6, '0')}`;
    // 撿到的裝備圖示從主角頭上飄起來（D-101）
    const icon = this.add.container(this.sx(p.x), this.sy(p.y) - 70, gearIcon(this, 0, 0, g.slot, rarity, rarity >= 3 ? 64 : 48)).setDepth(70);
    this.tweens.add({ targets: icon, y: icon.y - 90, duration: 900, ease: 'Cubic.Out' });
    this.tweens.add({ targets: icon, alpha: 0, delay: 700, duration: 400, onComplete: () => icon.destroy(true) });
    if (rarity >= 3) {
      SFX.perfect();
      // 同一刻撿到好幾件稀有（Boss 掉落）合成一則大字（第 39 輪：以前兩則「稀有裝備！」上下疊在一起）
      const q = this.rareQueue;
      q.push({ name: gearName(g), night: !!g.night, col });
      if (q.length === 1) {
        const flush = (): void => {
          // 幕名卡（含「番外　完」）播放中：等卡片收起再出，不然稀有大字壓在卡片上（第 58 輪）
          if (this.scene.isActive() && this.time.now < this.chapterUntil) { this.time.delayedCall(this.chapterUntil - this.time.now + 100, flush); return; }
          const list = this.rareQueue.splice(0);
          if (!list.length || !this.scene.isActive()) return;
          this.rareAt = this.time.now;
          const f = list[0]!;
          const head = f.night ? '深夜的稀有！' : '稀有裝備！';
          const pair = list.slice(0, 2).map((x) => x.name).join('／'); // 名稱自己可能有「・霧語」，用斜線分開；兩件最長 27 字 → 縮字放得進 720
          // 第 77 輪：patient——360×640 主角下方被地區說明佔住時，以前照原位 560 整塊蓋住主角（荊棘谷討伐後撿到稀有）；稍等一下沒關係
          // 第 76 輪：兩件以上改 ≤30px、兩件名稱排同一行（3 行 44px 在 360×640 主角下方放不下、整塊蓋住主角）
          bigText(this, GAME_WIDTH / 2, 560, `${list.length > 1 ? head.replace('！', ` ×${list.length}！`) : head}\n${list.length > 1 ? [pair, ...list.slice(2, 3).map((x) => x.name)].join('\n') : f.name}`, f.night ? '#b8a8ff' : f.col, list.length > 1 ? Math.min(30, Math.floor(680 / pair.length)) : 44, 1200 + 400 * (Math.min(3, list.length) - 1), true);
        };
        this.time.delayedCall(250, flush);
      }
    } else {
      SFX.confirm();
      floatNumber(this, this.sx(p.x), this.sy(p.y) - 120, gearName(g), { color: col, size: rarity === 2 ? 28 : 24 });
    }
    // 第 38 輪：以前這裡還有一則「撿到裝備了！☰ → 行囊」大字（每場一次），和上面的 tipOnce 同時出現、疊成兩行重複的字 → 只留 tipOnce（忙的時候下一件再提示）
  }
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
      this.inp.stick = null;
      this.openBag(false);
    });
    this.fireBtn = b;
    // 營火行商（D-116）
    const sb = this.add.text(GAME_WIDTH / 2 + 125, 960 + TALL, '行商', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: '#1a0f08', backgroundColor: '#9fe8a0' }).setOrigin(0.5).setPadding(20, 10, 20, 10).setDepth(62).setVisible(false).setInteractive({ useHandCursor: true });
    sb.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (this.menu || this.editing || this.ended) return;
      SFX.uiTap();
      this.inp.stick = null;
      this.openShop();
    });
    this.shopBtn = sb;
    // 燼牌捷徑（D-129）：營火旁直接找人打牌（在地對手坐在營火另一邊）
    const cb = this.add.text(88, 960 + TALL, '燼牌', { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#1a0f08', backgroundColor: '#ffb36a' }).setOrigin(0.5).setPadding(16, 10, 16, 10).setDepth(62).setVisible(false).setInteractive({ useHandCursor: true });
    cb.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (this.menu || this.editing || this.ended) return;
      SFX.uiTap();
      this.inp.stick = null;
      this.persist();
      this.openCards(true);
    });
    this.cardBtn = cb;
    this.placeFireBtns();
  }
  private cardBtn: Phaser.GameObjects.Text | null = null;

  /** 營火捷徑避開技能鍵／搖桿（第 43 輪：左手模式、按鈕放大時以前會蓋在技能鍵上） */
  private placeFireBtns(): void {
    const row = [this.cardBtn, this.fireBtn, this.shopBtn];
    if (row.some((t) => !t || !t.active)) return;
    const ts = row as Phaser.GameObjects.Text[];
    const PREF = [88, GAME_WIDTH / 2 - 95, GAME_WIDTH / 2 + 125];
    // 「行囊・強化 ▲」比較寬：用加了 ▲ 的寬度排，免得之後變寬又撞到
    const wide = [ts[0]!.width, ts[1]!.width + 30, ts[2]!.width];
    const lay = fireRowLayout(this.ctl, ts.map((_, i) => ({ w: wide[i]!, x: PREF[i]! })), 960 + TALL, Math.max(...ts.map((t) => t.height)));
    ts.forEach((t, i) => t.setPosition(Math.round(lay.xs[i]!), lay.y));
  }

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
        level: (import.meta.env.VITE_SERVER_URL ? characterCache.get()?.level : undefined) ?? this.s.prog?.level ?? 1,
        region: this.stageId,
        onCards: () => this.openCards(),
        onMarket: this.tracked ? () => this.openMarket() : undefined,
        onTrade: this.tracked ? () => this.openTrade() : undefined,
        onWarehouse: this.tracked ? () => this.openWarehouse() : undefined,
        // V2（D-285）：價格、庫存、扣款都伺服器算，結果寫回舊 key 後場景重讀
        server: !this.tracked ? undefined : async (intent) => {
          this.persist();
          const res = await shopOps.deal(intent, this.stageId);
          if (!res || !this.scene.isActive()) return null;
          const rec = loadRecord(this.stageId);
          this.bagSt = cleanBag(rec);
          this.coinBase = coinOf(rec);
          this.dustBase = walletOf(rec).dust;
          setGearBonus(this.s, bonusOf(this.bagSt));
          setSkillMods(this.s, this.allMods(this.bagSt));
          return true;
        },
      },
      () => {
        this.menu?.destroy();
        this.menu = null;
        this.acc = 0;
      },
    );
  }

  /** 拍賣所（V4）：從行商面板進來，離開回到行商。每個動作都由伺服器做，寫回舊 key 後場景重讀行囊與金幣 */
  private openMarket(): void {
    this.persist();
    this.menu?.destroy();
    const reload = () => {
      if (!this.scene.isActive()) return;
      const rec = loadRecord(this.stageId);
      this.bagSt = cleanBag(rec);
      this.coinBase = coinOf(rec);
      this.dustBase = walletOf(rec).dust;
      setGearBonus(this.s, bonusOf(this.bagSt));
      setSkillMods(this.s, this.allMods(this.bagSt));
    };
    const wrap = <A extends unknown[]>(f: (...a: A) => Promise<MarketPage | null>) => async (...a: A) => {
      const r = await f(...a);
      if (r) reload();
      return r;
    };
    const ops: MarketOps = { view: wrap(marketOps.view), list: wrap(marketOps.list), cancel: wrap(marketOps.cancel), buy: wrap(marketOps.buy), history: marketOps.history };
    this.menu = openMarketPanel(this, { ops, bag: () => this.bagSt, coin: () => coinOf(loadRecord(this.stageId)), coinBefore: coinOf(loadRecord(this.stageId)) }, () => this.openShop());
  }

  /** 面對面交易（F3）：從行商面板進來，離開回到行商；每個動作由伺服器做、寫回舊 key 後場景重讀行囊與金幣 */
  private openTrade(): void {
    this.persist();
    this.menu?.destroy();
    const reload = () => {
      if (!this.scene.isActive()) return;
      const rec = loadRecord(this.stageId);
      this.bagSt = cleanBag(rec);
      this.coinBase = coinOf(rec);
      setGearBonus(this.s, bonusOf(this.bagSt));
    };
    const ops = Object.fromEntries(Object.entries(tradeOps).map(([k, f]) => [k, async (...a: unknown[]) => {
      const r = await (f as (...x: unknown[]) => Promise<TradePage | null>)(...a);
      if (r) reload();
      return r;
    }])) as TradeOps;
    this.menu = openTradePanel(this, ops, () => this.openShop());
  }

  /** 帳號共用倉庫（F1，D-302）：從行商面板進來，離開回到行商；放進／拿出由伺服器做、寫回舊 key 後場景重讀行囊 */
  private openWarehouse(): void {
    this.persist();
    this.menu?.destroy();
    const wrap = (f: (...a: string[]) => Promise<WarehousePage | null>) => async (...a: string[]) => {
      const r = await f(...a);
      if (r && this.scene.isActive()) {
        this.bagSt = cleanBag(loadRecord(this.stageId));
        setGearBonus(this.s, bonusOf(this.bagSt));
      }
      return r;
    };
    const ops: WarehouseOps = { view: wrap(warehouseOps.view), put: wrap(warehouseOps.put), take: wrap(warehouseOps.take) };
    this.menu = openWarehousePanel(this, ops, () => this.openShop());
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
        // 第 107 輪：面板已關（回行商／回營火）→ 等面板都關掉再講，最多等 2 分鐘
        announce: (text, color) => this.announce(text, color, 0, 120000),
        // V2（D-289）：下注局的賭注、種子、勝負、獎金都由伺服器決定；結果寫回舊 key 後場景重讀金幣
        server: !this.tracked
          ? undefined
          : {
              start: async (opponentId) => {
                this.persist();
                const r = await cardOps.start(opponentId);
                if (this.scene.isActive()) this.coinBase = coinOf(loadRecord(this.stageId));
                return r;
              },
              finish: async (matchId, moves) => {
                const r = await cardOps.finish(matchId, moves);
                if (this.scene.isActive()) this.coinBase = coinOf(loadRecord(this.stageId));
                return r;
              },
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
    else if (this.leftFire && !this.fireHinted && !this.menu && this.newbie && !this.tipBusy && this.time.now >= this.chapterUntil && this.time.now >= this.reviveUntil) {
      // 第 87 輪：倒下醒來那一刻不講（以前「在營火旁醒來」「休息・HP 全滿」和這兩行說明同時出、疊在主角身上），醒來 3.5 秒後再說
      this.fireHinted = true;
      // 說明期間先收起下面的「點怪物開打」（第 42 輪：兩行字疊在一起）
      // 第 61 輪：開場大字還在（tipBusy）就先等；以前這則一收掉就把 tipBusy 解開，「長弓：站遠一點射！」直接疊在開場大字上
      const run = ++this.busyRun;
      this.tipBusy = true;
      bigText(this, GAME_WIDTH / 2, TIP_Y, '回到營火：點火堆＝休息回滿・補藥水\n「行囊・強化」換裝／強化　「行商」用金幣買賣', '#ffe0a0', 26, 2600).once('destroy', () => { if (this.scene.isActive() && run === this.busyRun) this.tipBusy = false; });
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
        const lv = (import.meta.env.VITE_SERVER_URL ? characterCache.get()?.level : undefined) ?? this.s.prog?.level;
        return `${lv !== undefined ? `Lv ${lv}　` : ''}攻擊 ${p.atk}　HP ${p.maxHp}　防禦 ${p.def}`;
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
        bw: this.bw,
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
        // V2（D-285）：穿脫、分解送給伺服器（畫面先照舊存檔；伺服器結果不同就以伺服器為準寫回）
        shadow: !this.tracked
          ? undefined
          : (intent, apply) => {
              this.persist();
              const before = captureLegacy();
              apply();
              void legacyOp(
                before,
                ['items', 'wallet'],
                async (c, me) => {
                  const itemOf = (uid: string) => {
                    const it = me.items.find((i) => i.gear.uid === uid);
                    if (!it) throw new Error('item not synced');
                    return it.id;
                  };
                  if (intent.kind === 'unequip') return c.call('inventory.unequip', { characterId: me.id, slot: intent.slot });
                  if (intent.kind === 'salvage') return (await c.call('inventory.salvage', { characterId: me.id, itemId: itemOf(intent.uid) })).character;
                  let v = me;
                  for (const uid of intent.uids) v = await c.call('inventory.equip', { characterId: me.id, itemId: itemOf(uid) });
                  return v;
                },
                (v) => v,
              ).then((v) => {
                if (!v || !this.scene.isActive()) return;
                // 可能以伺服器為準寫回了 → 場景重讀行囊（沒分歧時讀到的和現在一樣）
                const rec = loadRecord(this.stageId);
                this.bagSt = cleanBag(rec);
                this.dustBase = walletOf(rec).dust;
                setGearBonus(this.s, bonusOf(this.bagSt));
                setSkillMods(this.s, this.allMods(this.bagSt));
              });
            },
        // V2（D-285）：強化的擲骰與扣材料只在伺服器；結果寫回舊 key 後場景重讀行囊（面板關了也一樣）
        roll: !this.tracked ? undefined : async (g) => {
          this.persist();
          const res = await legacyOp(
            captureLegacy(),
            ['items', 'wallet'],
            async (c, me) => {
              const it = me.items.find((i) => i.gear.uid === g.uid);
              if (!it) throw new Error('item not synced');
              return c.call('enhance.do', { characterId: me.id, itemId: it.id });
            },
            (r) => r.character,
            true,
          );
          if (!res || !this.scene.isActive()) return null;
          const rec = loadRecord(this.stageId);
          this.bagSt = cleanBag(rec);
          this.dustBase = walletOf(rec).dust;
          setGearBonus(this.s, bonusOf(this.bagSt));
          setSkillMods(this.s, this.allMods(this.bagSt));
          const it = res.character.items.find((i) => i.gear.uid === g.uid);
          return { ok: res.ok, gear: (it?.gear as unknown as RtGear | undefined) ?? g };
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
    this.inp.stick = null;
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
    this.placeFireBtns();
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
      const kb = this.badgePos(e.drag);
      this.keyBadges[e.drag]?.setPosition(kb.x, kb.y);
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
  private nightLight: NightLight | null = null;
  private readonly fireSpots: LightSpot[] = [];
  /** 深夜光照（A3）：主角用插值後的位置；營火與傳送門只算畫面內的（傳送門交戰中封住時光暗一點） */
  private drawNightLight(): void {
    const pl = playerOf(this.s);
    const pos = this.lerpPos(pl);
    const k15 = this.k * 1.5;
    const fireR = 480 * k15;
    const spots = this.fireSpots;
    spots.length = 0;
    for (const c of STAGES[this.stageId]?.campfires ?? []) {
      const cx = this.sx(c.x);
      const cy = this.sy(c.y) - 10 * k15;
      if (cx < -fireR || cx > GAME_WIDTH + fireR || cy < VIEW_TOP - fireR || cy > VIEW_BOTTOM + fireR) continue;
      spots.push({ x: cx, y: cy, r: fireR, a: 0.96, flicker: true });
    }
    let shut: boolean | undefined; // 交戰中門封住（和 drawGate 同一條件；畫面內有門才算）
    for (const gt of this.gates) {
      const gk = this.k * (gt.back ? 1.7 : 2.2);
      const r = 170 * gk;
      const cx = this.sx(gt.x);
      const cy = this.sy(gt.y) - 40 * gk;
      if (cx < -r || cx > GAME_WIDTH + r || cy < VIEW_TOP - r || cy > VIEW_BOTTOM + r) continue;
      spots.push({ x: cx, y: cy, r, a: !gt.back && (shut ??= this.bossEngaged()) ? 0.35 : 0.75, flicker: false });
    }
    this.nightLight!.update(this.time.now, this.sx(pos.x), this.sy(pos.y), spots);
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
      if (fury && r.rec.furyKills === 1 && STAGES[this.stageId]?.night) this.time.delayedCall(4600, () => this.announce(`解鎖：深夜的${this.mw}！\n☰ 暫停選單・怪更兇、掉得更好`, '#9fb8ff'));
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
      if (r.first && this.stageId === FINALE_MAP && !this.bot) { this.storySoon = true; later(5000, () => this.showFinale()); }
      // 番外（通關後的挑戰地圖）第一次討伐 → 選完抉擇播「番外　完」幕名卡，給最後一個 Boss 一個收尾（第 58 輪）
      if (r.first && worldMap(this.stageId)?.postGame && !this.bot) { this.storySoon = true; later(4600, () => this.postGameEnd()); }
      // 第 76 輪：4 行縮成 2 行（4 行在 360×640 上下都放不下、整塊蓋主角約 3 秒；2 行放得進主角下方）
      const opened = (): void => void bigText(this, GAME_WIDTH / 2, 600, `新地圖開放：${nx?.name}！${nx?.recLevel ? `（建議 Lv${nx.recLevel}）` : ''}\n走進巢穴北邊的光門・☰ 也能直接前往`, '#a8f08a', 30, 3000, true); // 第 77 輪：patient（主角下方被教學小字佔住時不照原位蓋主角）
      // 通關那張圖：新地圖開放（星隕高原）等通關演出看完才出，以前會在演出（depth 2000）底下播完、玩家看不到（第 39 輪）
      if (r.first && nx) {
        // 光門等抉擇／通關演出結束才亮（第 55 輪：以前討伐當下就出現，等面板的 4～5 秒內走進去會跳過抉擇或結局）
        if (this.stageId === FINALE_MAP && !this.bot) this.gateWaits = 'finale';
        else if (pending) this.gateWaits = 'choice';
        else this.revealGate();
        if (this.stageId === FINALE_MAP && !this.bot) this.afterFinale.push(opened);
        else later(4600, opened);
      }
      if (r.rec.bossKills === FURY_UNLOCK.kills && (this.s.prog?.level ?? 1) < FURY_UNLOCK.level && STAGES[this.stageId]?.bossZone?.fury) later(4600, () => this.furyUnlockedToast());
      this.persist();
    }
    const timed = !this.bossTimed;
    this.bossTimed = true;
    this.time.delayedCall(300, () => bigText(this, GAME_WIDTH / 2, 440, `${name} 討伐！`, '#ffd27a', 60, 1800));
    const again = STAGES[this.stageId]?.bossZone?.respawnTicks ? '離開巢穴一會兒，牠會再回來' : '可以繼續刷怪，或從 ☰ 離開';
    const head = first ? (worldMap(this.stageId)?.firstKill ?? '首次討伐！') : fury ? `暴怒的${this.bw}倒下了！看看掉了什麼` : best ? `最快紀錄！${fmtSec(sec)}` : '再次討伐！';
    // 第 76 輪：3 行→2 行（本次秒數接在第二行），且 patient：360×640 稀有大字佔住主角下方時等它淡出，不再整塊蓋住主角
    const shortSec = sec >= 60 ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : fmtSec(sec); // 第二行最長 23 字 × 30px
    const sub = `${head}\n${again}${timed && !best && this.tracked ? `・本次 ${shortSec}` : ''}`;
    this.slainUntil = this.time.now + 1900 + 180 + 2600;
    this.slainSub = null;
    this.slainSubAt = 0;
    this.choiceWait = 0;
    this.time.delayedCall(1900, () => { this.slainSub = bigText(this, GAME_WIDTH / 2, 540, sub, '#f4e6c0', 30, 2600, true); });
  }

  /** 番外收尾：電影黑條＋「番外　完」＋依抉擇一句話；只播一次（jg_chapter_<id>_end） */
  private postGameEnd(): void {
    const key = `${this.stageId}_end`;
    if (!this.scene.isActive() || this.ended || chapterSeen(key)) { this.storySoon = false; return; }
    if (this.menu || this.editing || this.rareQueue.length || this.time.now - this.rareAt < 2200) {
      this.time.delayedCall(1500, () => this.postGameEnd());
      return;
    }
    this.storySoon = false;
    const lab = postGameEndLabel(this.stageId, loadChoices()[this.stageId]);
    if (!lab) return;
    markChapterSeen(key);
    if (this.hint) this.dismissHint();
    this.chapterUntil = this.time.now + 3200;
    playChapterCard(this, lab, Math.round(VIEW_TOP + (VIEW_BOTTOM - VIEW_TOP) * 0.24), VIEW_TOP, VIEW_BOTTOM);
    SFX.itemGet();
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
    // 第 76 輪：「首次討伐！…」可能在排隊（等稀有大字讓出主角下方）→ 讓它至少顯示 2.2 秒再開抉擇面板（最多多等約 4 秒）
    const sb = this.slainSub;
    if (sb?.active && this.choiceWait < 14) {
      if (sb.alpha > 0.5 && !this.slainSubAt) this.slainSubAt = this.time.now;
      if (!this.slainSubAt || this.time.now - this.slainSubAt < 2200) {
        this.choiceWait++;
        this.time.delayedCall(300, () => this.showChoice(ch));
        return;
      }
    }
    if (this.hint) this.dismissHint();
    if (this.liveTip?.t.active) this.yieldTip(this.liveTip); // 面板會把教學小字藏起來 → 關掉後再講
    this.menu = openChoice(this, ch, (pick) => {
      this.menu = null;
      this.acc = 0;
      // V2（D-290）：快照一定要在存抉擇之前拿（不然伺服器會以為已經選過）
      if (this.tracked) this.persist();
      const before = this.tracked ? captureLegacy() : null;
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
        if (before) {
          // 畫面照舊先存（玩家看到的不變）→ 伺服器檢查（打倒過 Boss、只能選一次）並發結晶，不同就以伺服器為準
          const map = this.stageId;
          void legacyOp(before, ['wallet'], (cl, me) => cl.call('story.choose', { characterId: me.id, map, pick }), (x) => x.character);
        }
      }
      const p = playerOf(this.s);
      if (pick === 'spare' && !this.cub.active) {
        // 選了「還」：小跟班當場從巢穴（Boss 倒下的地方）出來，不用等下次進地圖
        const bz = STAGES[this.stageId]?.bossZone;
        const ox = bz && Math.hypot(bz.x - p.x, bz.y - p.y) < UNIT * 10 ? bz.x : p.x + UNIT * 3;
        const oy = bz && Math.hypot(bz.x - p.x, bz.y - p.y) < UNIT * 10 ? bz.y : p.y - UNIT * 3;
        if (this.spawnCub(ox, oy)) sparks(this, this.sx(ox), this.sy(oy), 18, 'spark', 0xa8f0c8, 480);
      }
      shockRing(this, this.sx(p.x), this.sy(p.y), pick === 'take' ? 0xffb35a : 0x7dd8b0, 260, 700, 8);
      sparks(this, this.sx(p.x), this.sy(p.y), 26, pick === 'take' ? 'ember' : 'spark', pick === 'take' ? 0xffd27a : 0xa8f0c8, 520);
      const extra = pick === 'take' ? `\n+${ch.take.crystal} 結晶` : `\n行商的裝備 −${c ? shopDiscountPct(c) : SPARE_DISCOUNT}%`;
      // 第 77 輪：以前 3 行 30px（高 147），360×640 主角下方差幾 px 放不下 → 照原位整塊蓋住主角；改成結語一行（最長 22 字 26px ≈ 572 寬）＋後果一行
      bigText(this, GAME_WIDTH / 2, 560, `${ch[pick].after}${extra}`, pick === 'take' ? '#ffd27a' : '#a8f0c8', 26, 2600, true); // 第 78 輪 patient：稀有裝備大字佔住主角下方時等它（以前照原位整塊蓋主角）
      this.tipCalmUntil = Math.max(this.tipCalmUntil, this.time.now + 2800); // 第 78 輪：結語還在時教學小字（例如「大招充滿了！」）先等，不疊在結語上
      if (this.gateWaits === 'choice') this.revealGate();
      const q = this.afterChoice;
      this.afterChoice = [];
      q.forEach((fn, i) => this.time.delayedCall(3600 + i * 3200, fn));
    });
  }

  /** 開場：地圖說明大字＋操作說明框（序章播完才跑） */
  private opening(): void {
    // 第一次踏進這張大地圖：先播幕名卡（D-187），播完才出地圖說明
    const lab = !this.bot && this.tracked && !chapterSeen(this.stageId) ? chapterLabel(this.stageId) : null;
    if (lab) {
      markChapterSeen(this.stageId);
      this.introStr = STAGES[this.stageId]?.intro ?? ''; // D-221：幕名卡播完才出開場大字，這段時間走進的地區也算
      this.tipBusy = true;
      this.busyRun++;
      this.chapterUntil = this.time.now + 3000;
      const ms = playChapterCard(this, lab, Math.round(VIEW_TOP + (VIEW_BOTTOM - VIEW_TOP) * 0.24), VIEW_TOP, VIEW_BOTTOM);
      const run0 = this.openRun;
      this.time.delayedCall(ms - 450, () => { if (run0 === this.openRun && this.scene.isActive()) this.opening(); });
      return;
    }
    const run = ++this.openRun;
    // 刷怪關的開場說明（怪會重生、營火是安全區）
    const st0 = STAGES[this.stageId];
    this.tipBusy = false;
    if (st0?.intro || st0?.spawnGroups?.length) {
      // 開場大字 0.4 秒出現、約 3.4 秒消失；操作說明框與提示（y 700）等大字**真的消失**才出（第 37 輪：
      // 以前用固定 3.8 秒計時，掉幀時大字的淡出 tween 比計時慢，「黃框＝可以格擋」會疊在大字上）。6 秒保底。
      this.tipBusy = true;
      const own = ++this.busyRun;
      this.introRun = own;
      const after = (): void => {
        if (run !== this.openRun || !this.tipBusy || own !== this.busyRun) return;
        this.tipBusy = false;
        if (!this.bot) this.showHint();
      };
      // 第 44 輪：這張圖的 Boss 打倒過的老存檔不再播第一次的教學，改成「歡迎回到○○！」＋下一個目標
      // 第 59 輪：從 ☰ 切到深夜重新進入，開場不再說「歡迎回到○○！」（人根本沒離開），改成點出深夜
      const back0 = this.tracked && worldMap(this.stageId) ? returnIntro(this.stageId, loadRecord(this.stageId), this.s.prog?.level ?? 1, bossKillsOf(worldMap(this.stageId)?.next ?? ''), frontierAfter(this.stageId)) : null;
      const back = back0 && this.s.night ? nightIntro(back0, STAGES[this.stageId]!.name) : back0;
      // 選過「助」、這次會來道謝的人（以前只能剛好走過去才發現）→ 開場大字多一行提醒
      const wait = this.encThanks.length ? '\n✦ 你幫過的人在老地方等你' : '';
      const intro0 = (back ?? st0.intro ?? '怪物會重生・5 分鐘能打倒幾隻？\n打不過就退回營火（怪不追進來）') + wait;
      // D-230：從上次休息的營火出發時說一聲（不然以為存檔跑掉了）；已經三行以上就不加
      const intro = this.resumed && intro0.split('\n').length < 3 ? `${intro0}\n（從上次休息的營火出發）` : intro0;
      const nl = intro.split('\n').length; // 三行以上往上挪、四行字小一號（不壓到下方 MP 鍵）
      this.introStr = intro;
      this.time.delayedCall(400, () => (this.introText = bigText(this, GAME_WIDTH / 2, 760 - Math.max(0, nl - 2) * 14, intro, '#ffd27a', nl >= 4 ? 28 : 30, tipMs(intro, 2600))).once('destroy', () => { if (run === this.openRun && this.scene.isActive()) this.time.delayedCall(200, after); }));
      this.time.delayedCall(6000, after);
    } else if (!this.bot) this.showHint();
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
    this.storySoon = false;
    this.fireBtn?.setVisible(false);
    this.shopBtn?.setVisible(false);
    this.cardBtn?.setVisible(false);
    this.menu = playFinale(this, loadFinaleStats(), () => {
      this.menu = null;
      this.acc = 0;
      bigText(this, GAME_WIDTH / 2, 560, '地上的戰利品別忘了撿！', '#f4e6c0', 32, 1800);
      if (this.gateWaits === 'finale') this.revealGate();
      const q = this.afterFinale.splice(0);
      q.forEach((fn, i) => this.time.delayedCall(2400 + i * 3200, fn));
    });
  }

  /** 星隕高原的狼（第 40 輪，純畫面）：身上幾顆會閃的四芒星痕；彗星巡者身後拖三道彗尾；星蝕狼背上一輪黑日＋紫色日冕 */
  /**
   * 燼芯菇／星芒菇（第 41 輪，仿 D-166）：以前只是荊棘菇染色。
   * 燼芯菇：傘蓋上三顆發亮的燼斑＋往上飄的火星；星芒菇：傘蓋上輪流閃的小星＋慢慢飄起的星塵。純畫面。
   */
  private drawShroomMarks(top: Phaser.GameObjects.Graphics, x: Unit, sp: Phaser.GameObjects.Image, r: number, now: number): void {
    const ember = x.defId === 'ember_shroom';
    const capY = sp.y - sp.displayHeight * 0.74;
    if (!ember) top.fillStyle(0x6a8aff, 0.1 + 0.06 * Math.sin(now / 500 + x.id)).fillCircle(sp.x, capY, r * 1.1);
    const spots: [number, number][] = [[-0.42, 0.02], [0.08, -0.12], [0.46, 0.06]];
    spots.forEach(([ox, oy], q) => {
      const sx = sp.x + ox * r;
      const sy = capY + oy * r;
      const tw = 0.5 + 0.5 * Math.sin(now / (ember ? 170 : 240) + q * 2.1 + x.id);
      if (ember) {
        top.fillStyle(0xff5a1a, 0.4 + 0.3 * tw).fillCircle(sx, sy, r * 0.32);
        top.fillStyle(0xffe080, 0.8 + 0.2 * tw).fillCircle(sx, sy, r * 0.16);
      } else if (tw > 0.25) {
        const a = r * 0.5 * tw;
        top.fillStyle(0x8ab0ff, 0.35 * tw).fillCircle(sx, sy, a * 0.6);
        top.fillStyle(0xe8eeff, 0.9 * tw);
        top.fillTriangle(sx - a, sy, sx + a, sy, sx, sy - a * 0.22).fillTriangle(sx - a, sy, sx + a, sy, sx, sy + a * 0.22);
        top.fillTriangle(sx, sy - a, sx, sy + a, sx - a * 0.22, sy).fillTriangle(sx, sy - a, sx, sy + a, sx + a * 0.22, sy);
      }
    });
    // 往上飄的火星／星塵
    for (let q = 0; q < 3; q++) {
      const t = (now / (ember ? 900 : 1600) + q / 3 + x.id * 0.137) % 1;
      const mx = sp.x + Math.sin(t * 6 + q * 2 + x.id) * r * 0.35 + (q - 1) * r * 0.25;
      const my = capY - r * 0.3 - t * r * (ember ? 1.8 : 1.4);
      top.fillStyle(ember ? (q % 2 ? 0xffc04a : 0xff6a2a) : 0xc8d8ff, (1 - t) * 0.9).fillCircle(mx, my, r * (ember ? 0.11 : 0.1) * (1.2 - t * 0.5));
    }
  }

  /**
   * 霧語森林的首領狼／霧影狼（第 41 輪，仿 D-166）：
   * 首領狼：胸前三道發白的舊爪痕；霧影狼（深夜巡邏）：身後往上飄散的紫黑影子＋額頭一點發亮的紫光。純畫面。
   */
  private drawWolfMarks(top: Phaser.GameObjects.Graphics, x: Unit, sp: Phaser.GameObjects.Image, r: number, now: number): void {
    const dir = sp.flipX ? -1 : 1;
    const H = sp.displayHeight;
    if (x.defId === 'alpha_wolf') {
      top.lineStyle(Math.max(2, r * 0.09), 0xfff0d8, 0.85);
      for (let q = 0; q < 3; q++) {
        const bx = sp.x - dir * r * (0.05 + q * 0.2);
        const by = sp.y - H * 0.4;
        top.lineBetween(bx + dir * r * 0.18, by - r * 0.32, bx - dir * r * 0.12, by + r * 0.3);
      }
      return;
    }
    // 霧影狼：影子從背後一團一團往上飄、變淡
    for (let q = 0; q < 5; q++) {
      const t = (now / 1300 + q / 5 + x.id * 0.21) % 1;
      const wx = sp.x - dir * r * (0.6 + t * 0.9) + Math.sin(t * 7 + q) * r * 0.15;
      const wy = sp.y - H * (0.45 + t * 0.45);
      top.fillStyle(q % 2 ? 0x2a1a4a : 0x6a4aaa, (1 - t) * 0.45).fillCircle(wx, wy, r * (0.38 - t * 0.18));
    }
    const ex = sp.x + dir * r * 0.95;
    const ey = sp.y - H * 0.66;
    const pulse = 0.6 + 0.4 * Math.sin(now / 300 + x.id);
    top.fillStyle(0xc8a8ff, 0.35 * pulse).fillCircle(ex, ey, r * 0.22);
    top.fillStyle(0xf0e8ff, 0.95).fillCircle(ex, ey, r * 0.08);
  }

  private drawStarMarks(top: Phaser.GameObjects.Graphics, x: Unit, sp: Phaser.GameObjects.Image, r: number, now: number): void {
    const dir = sp.flipX ? -1 : 1;
    const bodyY = sp.y - sp.displayHeight * 0.45;
    if (x.defId === 'comet_stalker') {
      // 彗尾：從背後往後拖、末端變細變淡，跟著呼吸伸縮
      for (let q = 0; q < 3; q++) {
        const len = r * (2.2 + q * 0.5) * (0.85 + 0.15 * Math.sin(now / 160 + q * 1.3 + x.id));
        const oy = (q - 1) * r * 0.22;
        const bx = sp.x - dir * r * 0.4;
        const by = bodyY + oy;
        top.fillStyle(q === 1 ? 0xe8f0ff : 0x8ab0ff, q === 1 ? 0.55 : 0.32);
        top.fillTriangle(bx, by - r * 0.16, bx, by + r * 0.16, bx - dir * len, by + oy * 0.6);
      }
    }
    if (x.defId === 'eclipse_wolf') {
      // 日蝕：背上一輪黑日，外圈紫色日冕慢慢呼吸
      // 放在尾巴上方（不和頭上的血條疊在一起）
      const ex = sp.x - dir * r * 0.75;
      const ey = sp.y - sp.displayHeight * 0.8;
      const er = r * 0.52;
      const pulse = 0.5 + 0.5 * Math.sin(now / 260 + x.id);
      top.fillStyle(0x9a7aff, 0.18 + 0.14 * pulse).fillCircle(ex, ey, er * (1.7 + 0.25 * pulse));
      top.fillStyle(0xd8c8ff, 0.5 + 0.3 * pulse).fillCircle(ex, ey, er * 1.12);
      top.fillStyle(0x0a0618, 1).fillCircle(ex, ey, er);
    }
    // 星痕：固定位置的四芒小星，輪流閃
    const n = x.defId === 'star_wolf' ? 3 : 4;
    for (let q = 0; q < n; q++) {
      const tw = Math.sin(now / 220 + q * 2.3 + x.id * 0.7);
      if (tw < 0.1) continue;
      const sx0 = sp.x + dir * (q - (n - 1) / 2) * r * 0.48;
      const sy0 = bodyY - r * (0.25 + 0.18 * ((q * 5) % 3));
      const L = r * 0.26 * tw;
      const w = L * 0.28;
      top.fillStyle(0xffffff, 0.9 * tw);
      top.fillTriangle(sx0 - w, sy0, sx0 + w, sy0, sx0, sy0 - L).fillTriangle(sx0 - w, sy0, sx0 + w, sy0, sx0, sy0 + L);
      top.fillTriangle(sx0, sy0 - w, sx0, sy0 + w, sx0 - L, sy0).fillTriangle(sx0, sy0 - w, sx0, sy0 + w, sx0 + L, sy0);
    }
  }

  /** 第一次遇到 Boss 的前世攻略提示（每張圖不同，worldMaps.bossTip） */
  private bossTipText(): string {
    return worldMap(this.stageId)?.bossTip ?? '（記得……牠衝鋒撞到樹或石頭會暈！）';
  }

  /** 通關演出看完才出的提示（新地圖開放：星隕高原） */
  private afterFinale: (() => void)[] = [];
  /** 開場大字（D-221：地區說明和它重複時不講） */
  private introText: Phaser.GameObjects.Text | null = null;
  private introStr = '';
  /** 開場大字已排定（0.4 秒後出）或還在畫面上 */
  private introLive(): boolean {
    return !!this.introStr && (this.introText === null || this.introText.active);
  }

  /** 隱藏精英的「遊戲記憶」提示：第一次連殺到門檻的 2/3 時出現一次 */
  private streakHint(): void {
    const h = STAGES[this.stageId]?.hiddenElite;
    if (!h || this.streakHinted || this.bot || (this.s.streak ?? 0) < Math.ceil((h.streak * 2) / 3)) return;
    // 第 87 輪：已經到門檻（首領下一秒就出現）或首領已經在場上 → 不再預告，不然「會被引出來」和「現身！」疊在一起
    if ((this.s.streak ?? 0) >= h.streak || this.s.units.some((u) => u.groupId === 'hidden' && !u.dead)) { this.streakHinted = true; return; }
    // 打 Boss 時先不提（第 45 輪：燼紅裂谷打岩王打到一半跳出「首領會被引出來」，和 Boss 提示同一個高度）
    if (enemiesOf(this.s).some((e) => ENEMIES[e.defId]?.boss && e.mode === 'combat')) return;
    this.streakHinted = true;
    // 第 68 輪：老玩家每次開遊戲連殺到一半都被提醒一次 → 每張圖只提醒前 3 次
    if (!timesDue(`jg_streak_hint_${this.stageId}`, 3)) return;
    bigText(this, GAME_WIDTH / 2, 600, '（記得……不倒下一直打下去，首領會被引出來……）', '#d8c8ff', 26, 2200);
  }

  /** 前世的記憶（D-137）：走到記憶點旁邊 → 想起一段事、拿結晶（不暫停戰鬥） */
  private memoryCheck(): void {
    if ((!this.memLeft.length && !this.memQ) || this.time.now < this.chapterUntil) return; // 幕名卡播完再想起（不然兩張卡疊在一起）
    const p = playerOf(this.s);
    if (p.dead) return;
    if (!this.memQ) {
      const i = this.memLeft.findIndex((m) => Math.hypot(m.tx * UNIT + UNIT / 2 - p.x, m.ty * UNIT + UNIT / 2 - p.y) < MEMORY_RADIUS * UNIT);
      if (i < 0) return;
      this.memQ = this.memLeft.splice(i, 1)[0]!;
    }
    if (this.tipBusy && this.introRun === this.busyRun) return; // 開場大字還在：等它收掉（已經記下來，走開也會想起）
    // 第 68 輪：星隕高原的記憶點就在守望者巢穴邊，記憶卡以前蓋在 Boss 登場名字上 → Boss 開打、抉擇面板、討伐大字期間先記著，打完再想起
    // （還沒開打但站在 Boss 發現範圍附近也先等：不然記憶卡和登場名字同一刻出現）
    // 第 79 輪：星隕高原選完「還」0.5 秒就跳記憶卡（＋相機閃紫光），結語只露 1 秒 → 結語期間、等「番外　完」卡時也先記著
    // 第 96 輪（D-239）：星隕高原出生點旁有寶箱也有記憶點，「似乎有點熟悉」和記憶卡同一刻出現 → 等那行字淡掉再想起
    if (this.menu || this.topCard?.active || this.storySoon || this.time.now < this.chestHintUntil || this.time.now < this.tipCalmUntil || this.time.now < this.slainUntil || this.time.now < this.reviveUntil || enemiesOf(this.s).some((e) => ENEMIES[e.defId]?.boss && (e.mode === 'combat' || Math.hypot(e.x - p.x, e.y - p.y) < (aggroUnitsOf(e) + 3) * UNIT))) return;
    // 第 86 輪（D-222）：被狼群圍著時跳記憶卡，兩行字要邊打邊讀、傷害數字鑽到卡片底下 → 身邊 7 格內的小怪也打完再想起（已經記下來，不會漏）
    if (peekBlocked(enemiesOf(this.s), p.x, p.y, UNIT * 7)) return;
    const mem = this.memQ;
    this.memQ = null;
    const r = recall(loadMemories(), mem.id);
    if (!r) return;
    if (mem.bossTip) this.memTipAt = this.time.now;
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
    // 第 49 輪：640 寬會蓋住左上的小地圖與懸賞板 → 544 寬、往右挪、字小 2px（左緣 ≈ 160，一行 21 字不斷行，小地圖／懸賞板右緣約 120～130；回禮卡同）
    const CW = 544;
    const c = this.add.container(GAME_WIDTH - 16 - CW / 2, 300).setDepth(940).setAlpha(0);
    const body = this.add.text(0, 6, mem.lines, { fontFamily: TITLE_FONT, fontSize: '25px', color: '#f0e6ff', align: 'center', lineSpacing: 10, wordWrap: { width: CW - 36, useAdvancedWrap: true } }).setOrigin(0.5, 0);
    const h = body.height + 120;
    const bg = this.add.graphics();
    bg.fillStyle(0x140a22, 0.9).fillRoundedRect(-CW / 2, -56, CW, h, 18);
    bg.lineStyle(2, 0xc89aff, 0.9).strokeRoundedRect(-CW / 2, -56, CW, h, 18);
    const head = this.add.text(0, -32, `✦ 前世的記憶　${r.ids.length}/${MEMORIES.length}`, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#c8a0ff' }).setOrigin(0.5);
    const gain = this.add.text(0, h - 80, `+${r.crystal} 結晶${r.all ? '　——所有的記憶都想起來了！' : ''}`, { fontFamily: UI_FONT, fontSize: '22px', color: r.all ? '#ffd27a' : '#a8e8ff' }).setOrigin(0.5);
    c.add([bg, head, body, gain]);
    this.topCard = c;
    this.hideBountyUnder(c, CW);
    this.hideHintUnder(c);
    this.clearZoneTexts(); // 第 57 輪：星隕高原開場記憶卡蓋在「— 高原營地 —」上，字從卡片底下露出半截
    this.tweens.add({ targets: c, alpha: 1, y: 290, duration: 500, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: r.all ? 8000 : 6000, duration: 700, onComplete: () => c.destroy() });
    reserveBanner(this, 290 - 56 + h / 2, h, (r.all ? 8000 : 6000) + 500); // 第 79 輪：之後出的置中大字（寶箱…）排開，不壓在卡片上
    if (r.all) this.time.delayedCall(600, () => bigText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, '前世的記憶　全部想起來了', '#d8b0ff', 40, 2200));
  }

  /** 路上的相遇（D-159）：走到旁邊（附近沒有在打的怪）→ 還沒選的跳抉擇面板；選了「助」的 → 這次進地圖來道謝、給回禮 */
  private encounterCheck(): void {
    if (!this.encOpen.length && !this.encThanks.length && !this.escort) return;
    if (this.menu || this.editing || this.ended) return;
    const p = playerOf(this.s);
    if (p.dead || enemiesOf(this.s).some((e) => e.mode === 'combat')) return;
    // 第 79 輪：記憶卡和回禮卡同一個位置（星隕高原信差就在記憶點旁，兩張卡疊在一起）→ 上方卡片還在就先等
    const cardUp = !!this.topCard?.active;
    const es = this.escort;
    if (!cardUp && es?.e.escort && Math.hypot(es.e.escort.tx * UNIT + UNIT / 2 - es.x, es.e.escort.ty * UNIT + UNIT / 2 - es.y) < ESCORT_RADIUS * UNIT) {
      // 送到了：當場道謝，人留在目的地
      this.escort = null;
      this.encAt.set(es.e.id, { x: es.x, y: es.y });
      this.encDone.push(es.e);
      this.giveThanks(es.e);
      return;
    }
    const near = (e: Encounter): boolean => Math.hypot(e.tx * UNIT + UNIT / 2 - p.x, e.ty * UNIT + UNIT / 2 - p.y) < ENCOUNTER_RADIUS * UNIT;
    const th = cardUp ? undefined : this.encThanks.find(near);
    if (th) {
      this.encThanks = this.encThanks.filter((e) => e !== th);
      this.encDone.push(th);
      this.giveThanks(th);
      return;
    }
    const e = this.encOpen.find(near);
    if (!e) return;
    if (this.hint) this.dismissHint();
    if (this.liveTip?.t.active) this.yieldTip(this.liveTip);
    this.menu = openChoice(this, e, (pick) => {
      this.menu = null;
      this.acc = 0;
      this.encOpen = this.encOpen.filter((x) => x !== e);
      const c = meet(loadEncounters(), e.id, pick);
      if (!c) return;
      saveEncounters(c);
      onlineLoot.meet(e.id, pick, loadWeapon());
      if (pick === 'spare' && !e.escort) markMetThisVisit(e.id, this.stageId); // 護送的人半路場景重開就照舊在原地等（不然要離開地圖才找得到她）
      const x = this.sx(e.tx * UNIT + UNIT / 2);
      const y = this.sy(e.ty * UNIT + UNIT / 2);
      let extra = '';
      if (pick === 'take') {
        let rec: RtRecord | null = loadRecord(this.stageId);
        if (e.take.coin) rec = rec && spendCoin(rec, -e.take.coin);
        if (e.take.crystal) rec = rec && spend(rec, 0, -e.take.crystal);
        if (rec) saveRecord(this.stageId, rec);
        this.persist(); // 讓畫面上方的金幣跟著更新
        SFX.itemGet();
        extra = `\n${e.take.coin ? `+${e.take.coin} 金` : ''}${e.take.crystal ? `+${e.take.crystal} 結晶` : ''}`;
        sparks(this, x, y, 22, 'ember', 0xffd27a, 480);
        // 台詞寫他走了的（盜賊、朝聖者）：慢慢走開、不跳（第 70 輪，D-202）；其他留在原地
        if (e.takeLeaves) this.encLeave.push({ e, born: this.time.now, dir: e.tx * UNIT + UNIT / 2 >= p.x ? 1 : -1, sad: true });
        else this.encStay.push(e);
      } else if (e.escort) {
        extra = `\n（她會跟在你身後——帶她到${e.escort.place}）`;
        this.escort = { e, x: e.tx * UNIT + UNIT / 2, y: e.ty * UNIT + UNIT / 2, t: this.time.now };
        sparks(this, x, y, 26, 'spark', 0xa8f0c8, 520);
      } else {
        extra = '\n（下次回到這裡，也許會有人記得你）';
        sparks(this, x, y, 26, 'spark', 0xa8f0c8, 520);
        shockRing(this, x, y, 0x7dd8b0, 220, 700, 6);
        // 往離主角遠的那一側走開
        this.encLeave.push({ e, born: this.time.now, dir: e.npc === 'mule' || e.npc === 'hunter' || e.tx * UNIT + UNIT / 2 >= p.x ? 1 : -1 }); // 騾子頭朝右只往右走；少年獵人往東邊的營火走
      }
      // 第 78 輪（D-210）：以前 wrapTip 成 2 行＋後果＝3 行 28px，360×640 主角下方放不下 → 照原位蓋主角；改成結語一行（≤ 22 字 26px）＋後果一行
      bigText(this, GAME_WIDTH / 2, 560, `${e[pick].after}${extra}`, pick === 'take' ? '#ffd27a' : '#a8f0c8', 26, 3000, true);
      this.tipCalmUntil = Math.max(this.tipCalmUntil, this.time.now + 3200);
    }, { kicker: '相遇', spareTag: '助' });
  }

  /** 相遇的回禮（D-159）：上方一張綠色的卡（和前世的記憶同一種排法），拿金幣／結晶 */
  private giveThanks(e: Encounter): void {
    const c0 = claimThanks(loadEncounters(), e.id);
    if (!c0) return;
    saveEncounters(c0);
    onlineLoot.thanks(e.id, loadWeapon());
    let rec: RtRecord | null = loadRecord(this.stageId);
    if (e.thanks.coin) rec = rec && spendCoin(rec, -e.thanks.coin);
    if (e.thanks.crystal) rec = rec && spend(rec, 0, -e.thanks.crystal);
    if (rec) saveRecord(this.stageId, rec);
    this.persist();
    SFX.perfect();
    const at = this.encAt.get(e.id);
    const x = this.sx(at?.x ?? e.tx * UNIT + UNIT / 2);
    const y = this.sy(at?.y ?? e.ty * UNIT + UNIT / 2);
    sparks(this, x, y, 30, 'spark', 0xa8f0c8, 480);
    shockRing(this, x, y, 0x7dd8b0, 220, 700, 6);
    // 第 49 輪：640 寬會蓋住左上的小地圖與懸賞板 7 秒 → 544 寬、往右挪、字小 2px（左緣 ≈ 160，一行 21 字不斷行，小地圖／懸賞板右緣約 120～130）
    const CW = 544;
    const c = this.add.container(GAME_WIDTH - 16 - CW / 2, 300).setDepth(940).setAlpha(0);
    const body = this.add.text(0, 6, e.thanks.lines, { fontFamily: TITLE_FONT, fontSize: '24px', color: '#e8fff0', align: 'center', lineSpacing: 10, wordWrap: { width: CW - 36, useAdvancedWrap: true } }).setOrigin(0.5, 0);
    const h = body.height + 120;
    const bg = this.add.graphics();
    bg.fillStyle(0x0a1a14, 0.98).fillRoundedRect(-CW / 2, -56, CW, h, 18); // 第 48 輪：0.92 時底下的地區名稱（「毒沼」）透出來
    bg.lineStyle(2, 0x7dd8b0, 0.9).strokeRoundedRect(-CW / 2, -56, CW, h, 18);
    const head = this.add.text(0, -32, `✦ 回禮・${e.title}`, { fontFamily: UI_FONT, fontSize: '24px', fontStyle: '700', color: '#a8f0c8' }).setOrigin(0.5);
    const gain = this.add.text(0, h - 80, [e.thanks.coin ? `+${e.thanks.coin} 金` : '', e.thanks.crystal ? `+${e.thanks.crystal} 結晶` : ''].filter(Boolean).join('　'), { fontFamily: UI_FONT, fontSize: '22px', color: '#ffd27a' }).setOrigin(0.5);
    c.add([bg, head, body, gain]);
    this.topCard = c;
    this.hideBountyUnder(c, CW);
    this.hideHintUnder(c);
    this.clearZoneTexts(); // 第 57 輪：星隕高原開場記憶卡蓋在「— 高原營地 —」上，字從卡片底下露出半截
    this.tweens.add({ targets: c, alpha: 1, y: 290, duration: 500, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 7000, duration: 700, onComplete: () => c.destroy() });
    // 第 79 輪：荊棘谷盜賊回禮卡旁 2 格就是隱藏寶箱，「找到隱藏寶箱！」「藥水 ×5…」直接蓋在卡上 → 卡片範圍登記成佔用中
    reserveBanner(this, 290 - 56 + h / 2, h, 7500);
  }

  /** 護送中（D-160）：人跟在玩家身後（和小同伴同一種追法，慢一點）；目的地畫一圈呼吸的綠光 */
  private drawEscort(g: Phaser.GameObjects.Graphics, now: number): void {
    const es = this.escort;
    if (!es?.e.escort) return;
    const p = playerOf(this.s);
    const dt = Math.min(0.1, Math.max(0, (now - es.t) / 1000));
    es.t = now;
    const fl = Math.hypot(p.facingX, p.facingY) || 1;
    const tx = p.x - (p.facingX / fl) * UNIT * 1.4 - (p.facingY / fl) * UNIT * 0.4;
    const ty = p.y - (p.facingY / fl) * UNIT * 1.4 + (p.facingX / fl) * UNIT * 0.4;
    // 第 40 輪：附近有在打的怪就停下來縮著（不跟進戰場），打完再跟上；每 0.25 秒檢查一次
    if (!es.check || now - es.check > 250) {
      es.check = now;
      es.scared = enemiesOf(this.s).some((e) => e.mode === 'combat' && Math.hypot(e.x - es.x, e.y - es.y) < UNIT * ESCORT_SCARED_TILES);
    }
    const d = Math.hypot(tx - es.x, ty - es.y);
    if (es.scared) {
      // 停在原地
    } else if (d > UNIT * 14) {
      es.x = tx;
      es.y = ty;
    } else if (d > UNIT * 0.3) {
      const k0 = Math.min(1, dt * (d > UNIT * 3 ? 3 : 1.8));
      es.x += (tx - es.x) * k0;
      es.y += (ty - es.y) * k0;
    }
    const dx = this.sx(es.e.escort.tx * UNIT + UNIT / 2);
    const dy = this.sy(es.e.escort.ty * UNIT + UNIT / 2);
    if (dx > -200 && dx < GAME_WIDTH + 200 && dy > VIEW_TOP - 200 && dy < VIEW_BOTTOM + 200) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 320);
      const r = ESCORT_RADIUS * UNIT * this.k;
      g.fillStyle(0x7dd8b0, 0.06 + 0.06 * pulse).fillEllipse(dx, dy, r * 2, r * 1.1);
      g.lineStyle(3, 0xa8f0c8, 0.35 + 0.35 * pulse).strokeEllipse(dx, dy, r * 2, r * 1.1);
    }
    const cx = this.sx(es.x);
    const cy = this.sy(es.y);
    if (cx < -120 || cx > GAME_WIDTH + 120 || cy < VIEW_TOP - 160 || cy > VIEW_BOTTOM + 80) return;
    drawEncounterNpc(g, es.e.npc, cx, cy, this.k * 2.1, now, !es.scared);
    if (es.scared) {
      // 害怕：頭上紅色「！」氣泡（和相遇的氣泡同一種形狀）
      const hy = cy - 125 * this.k * 2.1 + Math.sin(now / 120) * 3;
      g.fillStyle(0x5a2a2a, 0.9).fillRoundedRect(cx - 26, hy - 18, 52, 36, 12);
      g.fillTriangle(cx - 6, hy + 16, cx + 6, hy + 16, cx, hy + 26);
      g.fillStyle(0xff9a8a, 1).fillRect(cx - 3, hy - 11, 6, 15).fillCircle(cx, hy + 9, 3.2);
    }
  }

  /** 畫相遇的人（D-159）：還沒選＝遇到麻煩的樣子；等著道謝＝高興的樣子。純畫面、畫面外不畫 */
  private drawEncounters(g: Phaser.GameObjects.Graphics, now: number): void {
    this.drawEscort(g, now);
    this.drawEncLeave(now);
    let ni = 0;
    for (const [list, happy, bubble] of [[this.encOpen, false, true], [this.encThanks, true, true], [this.encDone, true, false], [this.encStay, false, false]] as const) {
      for (const e of list) {
        const at = this.encAt.get(e.id);
        const cx = this.sx(at?.x ?? e.tx * UNIT + UNIT / 2);
        const cy = this.sy(at?.y ?? e.ty * UNIT + UNIT / 2);
        if (cx < -120 || cx > GAME_WIDTH + 120 || cy < VIEW_TOP - 160 || cy > VIEW_BOTTOM + 80) continue;
        // D-332：畫進小貼圖；同時看得到的超過 NPC_CACHE_MAX 個（不會發生）才退回直接畫
        const nc = this.npcCache[ni++];
        if (nc) nc.show(cx, cy, now, `${e.id}:${happy}`, (cg, fx, fy, t) => drawEncounterNpc(cg, e.npc, fx, fy, this.k * 2.1, t, happy));
        else drawEncounterNpc(g, e.npc, cx, cy, this.k * 2.1, now, happy);
        if (!bubble) continue;
        // 頭上的提示：還沒選＝白色「…」氣泡；等著道謝＝綠色「！」
        const b = Math.sin(now / 300) * 4;
        const hy = cy - 125 * this.k * 2.1 + b;
        g.fillStyle(happy ? 0x2a5a44 : 0x2a2a34, 0.9).fillRoundedRect(cx - 26, hy - 18, 52, 36, 12);
        g.fillTriangle(cx - 6, hy + 16, cx + 6, hy + 16, cx, hy + 26);
        if (happy) {
          g.fillStyle(0xa8f0c8, 1).fillRect(cx - 3, hy - 11, 6, 15).fillCircle(cx, hy + 9, 3.2);
        } else {
          for (let i = -1; i <= 1; i++) g.fillStyle(0xf0f0f0, 0.5 + 0.5 * Math.max(0, Math.sin(now / 220 - i))).fillCircle(cx + i * 12, hy, 4);
        }
      }
    }
    for (; ni < this.npcCache.length; ni++) this.npcCache[ni]!.hide();
  }

  /** 選「助」之後的人／騾子：一跳一跳往旁邊走開 2.6 秒，後半段淡出（純畫面，第 69 輪） */
  private drawEncLeave(now: number): void {
    if (!this.encLeave.length && !this.encLeaveG) return;
    if (!this.encLeaveG || !this.encLeaveG.scene) this.encLeaveG = this.add.graphics().setDepth(this.g.depth);
    const lg = this.encLeaveG.clear();
    this.encLeave = this.encLeave.filter((l) => now - l.born < 2600);
    let alpha = 1;
    for (const l of this.encLeave) {
      const t = (now - l.born) / 1000;
      const walk = Math.max(0, t - 0.5); // 先站 0.5 秒（火花／光圈），再走
      const wx = l.e.tx * UNIT + UNIT / 2 + l.dir * UNIT * (l.sad ? 0.8 : 1.4) * walk;
      // 選「取」走開的：一拐一拐（左右晃、不跳）
      const hop = l.sad ? 0 : Math.abs(Math.sin(walk * 9)) * 6 * this.k;
      const sway = l.sad ? Math.sin(walk * 5) * 3 * this.k : 0;
      drawEncounterNpc(lg, l.e.npc, this.sx(wx) + sway, this.sy(l.e.ty * UNIT + UNIT / 2) - hop, this.k * 2.1, now, !l.sad, true);
      alpha = Math.min(alpha, t < 1.3 ? 1 : Math.max(0, 1 - (t - 1.3) / 1.3));
    }
    lg.setAlpha(alpha);
  }

  /** ☰「前世的記憶」（D-137）：重讀想起來的記憶；沒想起來的只寫在哪張地圖 */
  private openMemoryBook(): void {
    this.menu?.destroy();
    this.menu = buildMemoryBook(this, () => {
      this.menu?.destroy();
      this.menu = null;
      this.toggleMenu();
    });
  }

  /** 隱藏寶箱附近第一次靠近：「這個地方似乎有點熟悉……」（design/20 C2，只提示不指路） */
  private chestHint(): void {
    const list = STAGES[this.stageId]?.chests;
    if (!list?.length || this.bot) return;
    // 第 56 輪：荊棘谷出生點旁就有一個寶箱 → 幕名卡／開場說明還在播時先不提示（不然三組字疊在一起），播完再說
    if (this.tipBusy || this.time.now < this.chapterUntil || this.topCard?.active || this.time.now < this.reviveUntil) return;
    // 第 68 輪：巢穴邊的寶箱（星隕高原）提示以前和 Boss 登場名字疊在一起 → Boss 開打期間不提示
    if (enemiesOf(this.s).some((e) => ENEMIES[e.defId]?.boss && e.mode === 'combat')) return;
    // 第 93 輪（D-234）：和巡邏精英纏鬥中也先不提示（星隕高原彗星巡者打到一半跳「似乎有點熟悉」）
    if (this.eliteEngaged()) return;
    const p = playerOf(this.s);
    for (const c of list) {
      if (c.nightOnly || this.chestHinted.has(c.id) || this.s.chestsOpened?.includes(c.id)) continue;
      if (Math.hypot(c.x - p.x, c.y - p.y) > CHEST_RULES.hintUnits * UNIT) continue;
      this.chestHinted.add(c.id);
      // 畫面正中間常是主角頭上（回程門的字也在那）→ 往上挪一點，並佔位讓其他置中大字避開
      const hy = GAME_HEIGHT / 2 - 190;
      reserveBanner(this, hy, 50, 3200);
      this.chestHintUntil = this.time.now + 3200;
      const t = this.add.text(GAME_WIDTH / 2, hy, '這個地方似乎有點熟悉……', { fontFamily: UI_FONT, fontSize: '26px', fontStyle: 'italic', color: '#d8c8ff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(66).setAlpha(0);
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
    if (this.time.now < this.reviveUntil) {
      // 第 61 輪：醒來的營地不用再報一次（以前地區名稱、地區說明、「似乎有點熟悉」、「在營火旁醒來」四行字一起出）
      this.zoneName = z.name;
      this.zoneSeenAt.set(z.name, this.time.now);
      return;
    }
    // 第 102 輪（D-250）：新存檔序章後的選武器面板開著時，地區名稱「— 南營地 —」已經跳出來（面板只是把它藏起來），
    // 選完武器幕名卡「第一幕　霧語森林」一出，兩組字疊在同一塊 → 面板開著時先不報，等幕名卡播完才報
    if (this.topCard?.active || this.menu?.active || this.time.now < this.chapterUntil) return;
    // 第 92 輪（D-233）：打 Boss 時在巢穴邊跨區（霧語森林狼王巢穴就在兩區交界）→ 60 秒後又報一次「危險：狼群首領出沒…」，
    // 兩行紅字蓋在打鬥中間。Boss 已被打掉血＝正在打，玩家知道自己在哪，只記下這區、不報。
    if (this.bossEngaged() || this.eliteEngaged()) {
      this.zoneName = z.name;
      this.zoneSeenAt.set(z.name, this.time.now);
      return;
    }
    // 第 52 輪：走進第二個地區時開場說明框還在（荊棘谷 8 秒就進毒沼）→ 說明框、地區名稱、地區說明、「見切射擊！」四組字同時擠在上半部。
    // 已經走到下一區＝學會走路了，直接收起說明框，地區名稱照原本位置。開場那一區（zoneName 還是 null）不收。
    // 但霧語森林南營地走 6 格就出去了：說明框至少留 3 秒（兩行字讀得完；不到 3 秒照舊整組往下挪）
    if (this.zoneName !== null && this.hint?.active && this.time.now - this.hintAt >= 3000) this.dismissHint();
    this.zoneName = z.name;
    // 第 54 輪（D-185）：在兩區交界來回（打一打退回營火、追怪又走回來）每跨一次就跳一次大字，很吵 → 同一區 60 秒內不再報
    const seen = this.zoneSeenAt.get(z.name);
    this.zoneSeenAt.set(z.name, this.time.now);
    if (seen !== undefined && this.time.now - seen < 60000) return;
    // 第 42 輪：往下挪 55（以前 180 和畫面上緣的箭頭距離字「55m」擠在同一行）
    // 第 48 輪：開場說明框（y 198～302）還在時整組往下挪，以前地區名稱和「綠色毒沼…」壓在說明框底下
    const dy = this.hint?.active ? 100 : 0;
    const t = this.add.text(GAME_WIDTH / 2, 245 + dy, `— ${z.name} —`, { fontFamily: TITLE_FONT, fontSize: '40px', color: '#f4e6c0', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(66).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 235 + dy, duration: 500, ease: 'Cubic.Out', hold: 1400, yoyo: true, onComplete: () => t.destroy() });
    this.zoneTexts = [t];
    if (!z.hint) return;
    // 第 94 輪（D-236）：打 Boss 打不過退回營火、隔一分多鐘再走進巢穴，以前又跳一次「霧角狼王的地盤／跑出巢穴牠會回去回滿」→ 說明每次進圖只講一次
    if (this.zoneHinted.has(z.name)) return;
    this.zoneHinted.add(z.name);
    // 第 86 輪（D-221）：開場大字還在、而且講的是同一件事（「咬傷會中毒」）→ 地區說明不再講一次，只報地名
    if (this.introLive() && hintRepeats(z.hint, this.introStr)) return;
    // 第 73 輪：危險說明（紅字）壓在噴發中的熔岩口／毒沼上很難讀 → 加半透明黑底（像目標字條），四張圖共用
    const h = this.add.text(GAME_WIDTH / 2, 292 + dy, z.hint, { fontFamily: TITLE_FONT, fontSize: '26px', color: z.danger ? '#ff8a7a' : '#d8e8ff', stroke: '#000', strokeThickness: 5, align: 'center', ...(z.danger ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}) }).setOrigin(0.5).setDepth(66).setAlpha(0);
    if (z.danger) h.setPadding(12, 4, 12, 4);
    // 第 61 輪：長的地區說明（「危險：狼群首領出沒・東邊有荊棘母樹・西側有巡守巡邏」）比兩側小地圖之間還寬，左端壓在小地圖上
    // → 在最靠近中間的「・」換行，兩行字從地區名稱下方往下排
    let hy = 284 + dy;
    const mmR = this.mini ? this.mini.x + this.mini.w + 10 : 12;
    if (h.width > GAME_WIDTH - mmR * 2) {
      const cut = zoneHintBreak(z.hint);
      if (cut) {
        h.setText(cut).setOrigin(0.5, 0);
        hy = 266 + dy;
        h.y = hy + 8;
      }
    }
    this.tweens.add({ targets: h, alpha: 1, y: hy, duration: 500, delay: 250, ease: 'Cubic.Out', hold: 1900, yoyo: true, onComplete: () => h.destroy() });
    this.zoneTexts.push(h);
    if (z.danger && !this.bot) SFX.uiTap();
  }

  /** 地圖怪關卡：開場 30 秒都沒點怪也沒按技能 → 提示「點狼開打」並在最近的怪身上打光圈 */
  private idleHint(): void {
    if (this.idleHinted || this.bot || this.engaged || this.veteran) return; // 第 67 輪：老玩家不教「點一下怪物」
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
    const p0 = this.lerpPos(playerOf(this.s));
    let p = p0;
    let peekW = 0;
    let peekGy = 0;
    if (this.camPeek) {
      const w = this.menu || this.warpAt >= 0 ? 0 : peekWeight(this.time.now - this.camPeek.at);
      if (this.time.now - this.camPeek.at >= PEEK_TOTAL) this.camPeek = null;
      else {
        // 跟著單位（Boss 登場時牠會往主角走）；單位不見了就看最後的位置
        if (this.camPeek.id !== undefined) {
          const u = this.s.units.find((q) => q.id === this.camPeek!.id && !q.dead);
          if (u) { const lp = this.lerpPos(u); this.camPeek.x = lp.x; this.camPeek.y = lp.y; }
        }
        p = peekFocus(p0.x, p0.y, this.camPeek.x, this.camPeek.y, w, this.camPeek.share);
        peekW = w;
        peekGy = this.camPeek.y;
      }
    }
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
    // 第 63 輪：Boss 巢穴都在地圖北緣，以前鏡頭夾在上緣，打 Boss 時主角和 Boss 擠在 HUD／Boss 血條底下 → 上緣也多捲 150（外面接漸層）
    else {
      // 看一眼時上緣夾限跟著權重平滑放開：門在地圖北緣、平常鏡頭已經夾住捲不上去 → 放到門在 HUD 下方約 340 的位置
      const lo = -m - TOP_EXTRA;
      const lim = lo - peekW * Math.max(0, lo - (peekGy - 340 / this.k));
      topY = Math.max(lim, Math.min(a.h + m + viewH * 0.3 - viewH, topY));
    }
    this.ox = -left * this.k;
    this.oy = VIEW_TOP - topY * this.k;
    const hy = this.sy(p0.y);
    // 第 90 輪：交戰中的 Boss 在主角上方 → 那一帶（Boss 本身＋腳下的紅圈預告）也不排大字（D-231）
    const boss = this.s.units.find((u) => u.tier === 'boss' && !u.dead && u.mode === 'combat');
    // 第 94 輪（D-235）：沒有 Boss 時，正在纏鬥的巡邏精英（掉血、12 格內，同 eliteFighting）也一樣——狼群暴動、隱藏首領的大字以前直接蓋在牠身上
    const foe = boss ?? this.s.units.find((u) => u.tier === 'elite' && !u.dead && u.mode === 'combat' && u.hp < u.maxHp && !ENEMIES[u.defId]?.boss && Math.hypot(u.x - p0.x, u.y - p0.y) <= 12 * UNIT);
    // 第 91 輪：Boss 在主角下方（守望者瞬移到背後）→ 主角腳下到 Boss 腳下 40 這一帶也不壓（stackY 先試排到 Boss 腳下）
    const keep = fightKeep(hy, foe ? this.sy(foe.y) : null, VIEW_TOP, VIEW_BOTTOM, !!boss);
    setBannerAvoid(this, [hy - 110, hy + 30], keep);
  }

  /**
   * 從上次休息的營火出發（第 89 輪，D-230）：手機上關掉 App 再開、或從標題回來，以前一律回到南邊出生點，
   * 要再走 3～5 分鐘才回到剛剛打到的地方。走光門抵達（via gate）照舊站在回程門前；回程門的位置仍以出生點算。
   */
  private resumeAtFire(): boolean {
    if (!this.tracked || this.bot || this.via === 'gate') return false;
    const fires = STAGES[this.stageId]?.campfires ?? [];
    const id = loadRecord(this.stageId).fire;
    const f = fires.find((c) => c.id === id);
    if (!f || f === fires[0]) return false;
    const at = this.freeNear(f.x, f.y + UNIT * 1.6) ?? this.freeNear(f.x + UNIT * 1.6, f.y);
    if (!at) return false;
    const p0 = playerOf(this.s);
    p0.x = at[0];
    p0.y = at[1];
    this.s.campfireId = f.id; // 倒下也在這裡醒來
    return true;
  }

  /** 離開森林前先把紀錄寫好 */
  private leave(fn: () => void): void {
    this.persist();
    fn();
  }

  /** 手上的金幣＝存檔裡的＋這次撿到還沒存的（HUD 與暫停選單共用，第 51 輪：以前暫停選單只讀存檔，會比 HUD 少） */
  private coinNow(): number {
    return this.coinBase + Math.max(0, (this.s.loot?.gold ?? 0) - this.saved.coin);
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
      `懸賞完成 ${cleanBounties(rec.bounty).done} 張・手上金幣 ${(import.meta.env.VITE_SERVER_URL ? characterCache.wallet('coin') : null) ?? (this.coinBase >= 0 ? this.coinNow() : coinOf(rec))}（營火行商）`,
    ];
    { const chs = choiceOf(this.stageId); const cp = loadChoices()[this.stageId]; if (chs && cp) lines.push(`你的抉擇：${chs.short[cp]}${cp === 'take' ? '' : `（行商 −${shopDiscountPct(loadChoices())}%）`}`); }
    { const en = loadEncounters(); for (const e of encountersOf(this.stageId)) { const v = en[e.id]; if (v) lines.push(`路上的相遇：${e.short[v === 'thanked' ? 'spare' : v]}${v === 'spare' ? '（對方會來道謝）' : v === 'thanked' ? '（收到回禮了）' : ''}`); } }
    if (memoriesOf(this.stageId).length) { const mh = loadMemories(); lines.push(`前世的記憶：這裡 ${memoriesOf(this.stageId).filter((m) => mh.includes(m.id)).length}/${memoriesOf(this.stageId).length}・全部 ${mh.length}/${MEMORIES.length}`); }
    const cs = cardSummary();
    if (cs.played || cs.have) lines.push(`營火燼牌 ${cs.won} 勝 / ${cs.played} 場・收集 ${cs.have}/${cs.total} 張`);
    const tip = worldMap(this.stageId) ? levelTip(this.stageId, rec, this.s.prog?.level ?? 1) : null;
    if (tip) lines.unshift(tip);
    if (worldMap(this.stageId)) lines.unshift(`▶ 下一個目標：${nextGoal(this.stageId, rec, this.s.prog?.level ?? 1, bossKillsOf(worldMap(this.stageId)?.next ?? ''), frontierAfter(this.stageId))}`);
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
    this.announce(`解鎖：${this.bw}暴怒！\n☰ 暫停選單可以開啟・掉落更好`, '#ff7a5a');
  }

  /** 暫停選單的「狼王暴怒」開關（D-099）：沒解鎖時顯示條件 */
  private furyButton(mk: (y: number, label: string, fn: () => void, hi?: boolean) => void, items: Phaser.GameObjects.GameObject[], y: number): void {
    const rec = loadRecord(this.stageId);
    const lv = this.s.prog?.level ?? 1;
    if (!furyUnlocked(rec, lv)) {
      items.push(this.add.text(0, y, (rec.bossKills ?? 0) < 1 ? `🔒 ${this.bw}暴怒（先打倒${this.bw}一次）` : `🔒 ${this.bw}暴怒（Lv${FURY_UNLOCK.level} 或討伐 ${FURY_UNLOCK.kills} 次解鎖）`, { fontFamily: UI_FONT, fontSize: '22px', color: '#9a8a7a', backgroundColor: '#2a2018' }).setOrigin(0.5).setPadding(18, 12, 18, 12));
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

  /** 手機震動（Android 支援；iOS Safari 沒有 vibrate 就略過）。Bot 示範不震（第 80 輪 D-212 抽出來） */
  private buzz(pattern: number | number[]): void {
    if (this.bot || !getSettings().vibrate) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* 不支援 */
    }
  }

  private toggleMenu(): void {
    if (this.hint) this.dismissHint(); // 說明框不要壓在暫停選單上
    this.fireBtn?.setVisible(false); // 營火按鈕不要從選單底下透出來（關掉後下一幀會再顯示）
    this.shopBtn?.setVisible(false);
    this.cardBtn?.setVisible(false);
    for (const gt of this.gates) gt.label.setVisible(false); // 第 60 輪：門上的「▼ 回荊棘谷」從選單遮罩底下透出來（暫停時不會重畫）
    if (this.menu) {
      this.menu.destroy();
      this.menu = null;
      this.acc = 0;
      return;
    }
    if (this.ended) return;
    this.inp.stick = null;
    // 開場說明等還在畫面上的大字（depth 950）收掉，免得疊在選單上
    for (const o of [...this.children.list]) if (o instanceof Phaser.GameObjects.Text && o.depth === 950) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    // 第 47 輪：0.7 時長螢幕下方的紀錄字疊在透出來的技能鍵上，看起來很亂 → 0.84
    const items: Phaser.GameObjects.GameObject[] = [this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.84).setInteractive()];
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
    // 第 73 輪：遊戲中也能調音量（以前只能回標題的設定，手機外放太大聲只能關掉）
    const volLabel = (): string => `音量 ${getSettings().sfx || getSettings().bgm ? `${Math.round(getSettings().volume * 100)}%` : '關'}`;
    mk(-350, volLabel(), () => {
      const v = getSettings().volume;
      const order = [1, 0.75, 0.5, 0.25];
      updateSettings({ volume: order[(order.indexOf(v) + 1) % order.length] ?? 1 });
      volTxt.setText(volLabel());
    }, false, 235);
    const volTxt = items[items.length - 1] as Phaser.GameObjects.Text;
    const ctlBtn = (y: number, x = 0) => mk(y, '操作設定', () => {
      this.menu?.destroy();
      this.menu = null;
      this.menu = openRtControlsPanel(this, this.ctl, (c, edit) => {
        this.ctl = c;
        saveControls(c);
        this.makeButtons();
        this.placeFireBtns();
        this.bindKeys();
        this.menu?.destroy();
        this.menu = null;
        if (edit) this.startEdit();
        else this.toggleMenu();
      }, (id) => ((this.s ? skillDef(this.s, id) : undefined) ?? SKILLS[id])?.name ?? id);
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
      // 第 41 輪：換地圖＋回標題排成兩欄（以前一顆一列，360×640 下面的紀錄被切掉）
      const nav: { label: string; fn: () => void }[] = [];
      if (!this.botName && worldMap(this.stageId)) {
        WORLD_MAPS.forEach((m, i) => {
          if (m.id === this.stageId || !mapOpen(m.id)) return;
          nav.push({ label: `${i ? '前往' : '回'}${m.name}`, fn: () => this.leave(() => this.scene.start('RtBattle', { stage: m.id, bot: '' })) });
        });
      }
      nav.push({ label: '回標題', fn: () => this.leave(() => this.scene.start('Title')) });
      nav.forEach((b, i) => {
        const last = i === nav.length - 1 && nav.length % 2 === 1;
        mk(y + Math.floor(i / 2) * 80, b.label, b.fn, false, last ? 0 : i % 2 ? 170 : -170);
      });
      y += Math.ceil(nav.length / 2) * 80;
      const rt = this.recordText(y);
      items.push(rt);
      // 紀錄太長超出畫面：先縮字，再把整個選單往上推（標題最多推到離頂端 60）
      const room = () => GAME_HEIGHT / 2 - 12 - (y + rt.height);
      if (room() < 0) rt.setFontSize(18).setLineSpacing(4);
      const shift = Math.max(0, Math.min(GAME_HEIGHT / 2 - 440 - 60, -room()));
      this.menu = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - shift, items).setDepth(960);
      (items[0] as Phaser.GameObjects.Rectangle).setY(shift);
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
    if (this.hint?.active) return;
    // 第 57 輪：星隕高原出生點就有記憶光點，記憶卡和說明框同時出現、說明框從卡片底下露出來 → 卡片收起再出
    if (this.topCard?.active) {
      this.time.delayedCall(700, () => this.showHint());
      return;
    }
    // 第 23 輪縮成兩行：紅框、黃框、大招、裝備改成第一次遇到時才提示（tipOnce）
    const lines = ['左下拖曳走路・放開＝自動追擊＋普攻', '點怪物開打・右下：技能與閃避'];
    // 第 46 輪：以前 600 寬、置中在 y 300，蓋到左上小地圖右半與懸賞板第一行 → 窄一點、往右挪、往上挪（小地圖右緣約 120、懸賞板從 VIEW_TOP＋212 開始）
    const bg = this.add.rectangle(0, 0, 500, 104, 0x000000, 0.72).setStrokeStyle(2, 0xffd27a, 0.8);
    const t = this.add.text(0, 0, lines.join('\n'), { fontFamily: UI_FONT, fontSize: '24px', color: '#ffffff', align: 'center', lineSpacing: 10 }).setOrigin(0.5);
    this.hint = this.add.container(GAME_WIDTH / 2 + 50, 250, [bg, t]).setDepth(70);
    this.hintAt = this.time.now;
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
    // 第 93 輪（D-234）：已經和巡邏精英打過（被牠從背後發現、直接開打）→「在巡邏——別走進牠的範圍」是過時的教學，打完牠回去巡邏時才跳很怪 → 直接記成看過
    if (!patrolling && x.mode === 'combat' && !this.bot) this.tipSilently('jg_tip_stalker');
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

  /** 深夜的說明（第 59 輪）：開場大字、幕名卡、上方卡片、暫停中都先等；一則出完 2.6 秒再下一則，最多等 20 秒就放棄 */
  private nightTipsRun(tips: [string, string][], run: number, wait: number, waited = 0): void {
    this.time.delayedCall(wait, () => {
      if (run !== this.nightRun || !this.scene.isActive() || !tips.length) return;
      const busy = this.tipBusy || this.time.now < this.chapterUntil || this.time.now < this.phaseUntil || !!this.topCard?.active || !!this.menu?.active || this.s.outcome !== 'running';
      if (busy) {
        if (waited < 20000) this.nightTipsRun(tips, run, 400, waited + 400);
        return;
      }
      const [text, color] = tips[0]!;
      this.nightTip = bigText(this, GAME_WIDTH / 2, 600, text, color, 30, 2200);
      this.holdTips(this.nightTip);
      this.nightTipsRun(tips.slice(1), run, 2600, waited);
    });
  }

  /** 公告大字顯示期間擋住 tipOnce 的教學小字（第 60 輪：「撿到裝備了！」和「解鎖：深夜的山谷！」上下貼在一起） */
  private holdTips(t: Phaser.GameObjects.Text): void {
    this.tipBusy = true;
    const run = ++this.holdRun;
    const own = ++this.busyRun;
    let freed = false;
    const free = (): void => {
      if (freed || !this.scene.isActive() || run !== this.holdRun || own !== this.busyRun) return;
      freed = true;
      this.tipBusy = false;
      this.tipCalmUntil = this.time.now + TIP_GAP_MS;
    };
    this.time.delayedCall(4500, free);
    t.once('destroy', () => this.time.delayedCall(200, free));
  }

  /** 討伐後的解鎖公告（第 60 輪）：等稀有裝備大字、教學小字、幕名卡、上方卡片、面板都收掉才出，最多等 12 秒 */
  private announce(text: string, color: string, waited = 0, maxWait = 12000): void {
    if (!this.scene.isActive() || this.ended) return;
    const busy = this.tipBusy || this.time.now < this.chapterUntil || this.time.now < this.slainUntil || this.time.now < this.phaseUntil || !!this.topCard?.active || !!this.menu?.active || this.rareQueue.length > 0 || this.time.now - this.rareAt < 2200;
    if (busy && waited < maxWait) {
      this.time.delayedCall(400, () => this.announce(text, color, waited + 400, maxWait));
      return;
    }
    // 第 77 輪：patient——同一刻重講的教學小字佔住主角下方時，以前照原位 600 蓋住主角（360×640 荊棘谷「新地圖開放」）
    this.holdTips(bigText(this, GAME_WIDTH / 2, 600, text, color, 34, 2600, true));
  }

  /** 面板／調整按鈕位置時藏起會透出來的字（Q5：邏輯在 rt/BannerSystem.ts） */
  private menuBanners(): void {
    this.banners.update({
      menuActive: !!this.menu?.active,
      editing: !!this.editing,
      hint: this.hint ?? undefined,
      topCard: this.topCard,
      calmText: this.calmText,
      children: this.children.list,
      zoneTexts: this.zoneTexts,
      hud: (t) => this.offArrows.labels.includes(t) || t === this.offArrows.gateArrow || t === this.bountyTxt,
    });
  }

  /** @returns 這則提示是否已經處理掉（剛顯示、以前看過、或 Bot 示範）；false＝現在太忙，呼叫端可以等一下再試 */
  /** 教學已經不需要講了（玩家已經遇過）→ 不顯示、直接記成看過 */
  private tipSilently(key: string): void {
    if (this.tipsDone.has(key)) return;
    this.tipsDone.add(key);
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* 私密模式：只記在記憶體 */
    }
  }

  private tipOnce(key: string, text: string, color: string): boolean {
    // Bot 示範不提示、也不記成「看過了」（第 42 輪：以前先看 Bot 示範，格擋／撿裝備的教學就被 Bot 用掉了）
    if (this.bot || this.tipsDone.has(key)) return true;
    if (this.hint || this.tipBusy || this.menu || this.storySoon || this.time.now < this.tipCalmUntil || this.time.now < this.slainUntil) return false; // 第 78 輪：討伐大字期間也不講（「大招充滿了！」以前在抉擇面板開的前一刻冒出來） // 第 76 輪：面板開著（大字被藏起）不講，等關掉
    this.tipsDone.add(key); // 記在記憶體：大招提示每幀都會呼叫，不要每幀讀 localStorage
    try {
      if (localStorage.getItem(key)) return true;
      localStorage.setItem(key, '1');
    } catch {
      return true;
    }
    this.tipBusy = true;
    const own = ++this.busyRun;
    // 等大字真的消失才放下一則（第 37 輪：固定 2.2 秒計時在掉幀時比淡出 tween 快，兩則會疊在一起）；4 秒保底
    let freed = false;
    const free = (): void => {
      if (!freed && own === this.busyRun) {
        this.tipBusy = false;
        this.tipCalmUntil = this.time.now + TIP_GAP_MS;
      }
      freed = true;
    };
    this.time.delayedCall(4000, free);
    const tt = bigText(this, GAME_WIDTH / 2, TIP_Y, wrapTip(text), color, 30, 1600);
    this.liveTip = { t: tt, key, text, color };
    tt.once('destroy', () => { if (this.liveTip?.t === tt) this.liveTip = null; if (this.scene.isActive()) this.time.delayedCall(200, free); });
    return true;
  }

  /** 教學小字先讓位（淡掉），1.7 秒後再講一次（第 76 輪：360×640 撿裝備＋升級同一秒，數值小字找不到不蓋主角的空位） */
  private yieldTip(lt: { t: Phaser.GameObjects.Text; key: string; text: string; color: string }): void {
    this.liveTip = null;
    this.tweens.killTweensOf(lt.t);
    this.tweens.add({ targets: lt.t, alpha: 0, duration: 140, onComplete: () => lt.t.destroy() });
    this.tipsDone.delete(lt.key);
    try {
      localStorage.removeItem(lt.key);
    } catch {
      /* 存不了就算了 */
    }
    this.time.delayedCall(1700, () => this.tipSoon(lt.key, lt.text, lt.color));
  }

  /** 只會發生一次的事件（撿到第一件裝備）的提示：太忙就每 1.5 秒再試，最多 8 次 */
  private tipSoon(key: string, text: string, color: string, tries = 8): void {
    if (this.tipOnce(key, text, color) || tries <= 1) return;
    this.time.delayedCall(1500, () => this.tipSoon(key, text, color, tries - 1));
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
          this.rfx.magicBolt(src.x, src.y, d.x, d.y, e.crit ? 0xffd05a : 0xc89aff);
          this.knock(d.id, d.x - src.x, d.y - src.y, 7);
        } else if (src && src.side === 'player' && e.origin === 'normal' && this.s.weapon === 'bow') {
          // 長弓普攻（D-147）：一支箭飛過去
          this.rfx.arrowShot(src.x, src.y, d.x, d.y, e.crit ? 0xffd05a : 0xd8f0ff);
          this.knock(d.id, d.x - src.x, d.y - src.y, 6);
        } else if (src && src.side === 'player' && e.origin === 'normal') {
          this.ffx.slash(src.x, src.y, Math.atan2(d.y - src.y, d.x - src.x), 150, 110, e.crit ? 0xffd05a : 0xffffff, 5);
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
        floatNumber(this, this.sx(d.x), this.sy(d.y) - 30, `${e.amount}${e.crit ? '!' : ''}`, { color: toPlayer ? '#ff8a8a' : e.crit ? '#ffd05a' : e.origin === 'counter' ? '#7dffb0' : e.skill === 'burn' ? '#ffa850' : e.skill === 'poison' ? '#b8ff7a' : '#ffffff', size: e.crit || e.origin === 'counter' ? 34 : e.origin === 'dot' ? 22 : !toPlayer && e.origin === 'skill' && skillDef(this.s, e.skill)?.role === 'ult' ? 30 : 26, tier: toPlayer || e.origin === 'dot' ? undefined : e.origin === 'skill' && skillDef(this.s, e.skill)?.role === 'ult' ? 'ult' : e.crit ? 'crit' : undefined });
        if (!toPlayer && e.origin !== 'dot') {
          SFX.hitLight();
          sparks(this, this.sx(d.x), this.sy(d.y), 6, 'spark', 0xffffff, 260);
        }
        if (toPlayer) {
          this.cameras.main.shake(90, 0.004);
          // Android／部分瀏覽器支援震動；iOS Safari 不支援就略過
          if (e.amount > (e.absorbed ?? 0)) this.buzz(e.amount >= d.maxHp * 0.12 ? 60 : 25);
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
        // 第 65 輪：畫面上緣外（HUD 後面）的怪發現你時，紅「!」以前浮在 HUD 字上 → 只畫在戰場範圍內的
        // 第 66 輪：也不壓在地區名稱大字上（以前偶爾疊一瞬間）
        const ax = d ? this.sx(d.x) : 0;
        const ay = d ? this.sy(d.y) - 60 : 0;
        const onZone = this.zoneTexts.some((z) => z.active && z.alpha > 0.05 && z.getBounds().contains(ax, ay));
        // 第 68 輪：怪躲在左上小地圖／懸賞板底下時，紅「!」以前浮在小地圖和懸賞字上 → 不畫
        if (d && ay > VIEW_TOP + 20 && !onZone && !this.overHudPanel(ax, ay)) floatNumber(this, ax, ay, '!', { color: '#ff5a5a', size: 40 });
        // 巡邏的精英發現你（D-117）：橘色衝擊環＋警告音＋「被發現了！」
        if (d?.patrol && !this.bot) {
          // 第 73 輪：巡邏精英在畫面上緣外發現你時，「被發現了！」以前浮在 HUD（等級／HP 那行）上 → 夾回戰場範圍內（目標字條下面），衝擊環只在看得到時畫
          if (ay > VIEW_TOP) shockRing(this, this.sx(d.x), this.sy(d.y), 0xff8a5c, 60, 260, 5);
          SFX.warn(false);
          const fx = Math.max(90, Math.min(GAME_WIDTH - 90, this.sx(d.x)));
          // 第 84 輪：浮字會往上飄 70px，夾在 VIEW_TOP+110 還是會飄進上緣的目標字條（360×640 深夜裂谷）→ 也要在字條底下 90px 以下
          const gbot = this.goal?.visible && this.goal.text ? this.goal.getBounds().bottom : 0;
          const fy = Math.max(VIEW_TOP + 110, gbot + 90, this.sy(d.y) - 130);
          floatNumber(this, fx, fy, '被發現了！', { color: '#ffb07a', size: 30 });
        }
        if (d?.affix) this.time.delayedCall(250, () => floatNumber(this, this.sx(d.x), this.sy(d.y) - 90, `${ELITE_AFFIXES[d.affix!].name}！`, { color: `#${AFFIX_COLOR[d.affix!].toString(16).padStart(6, '0')}`, size: 32 }));
        // 遊戲記憶（design/20 C2-2）：地圖上第一次遇到 Boss → 內心提示弱點（只提示，不加傷害）
        if (d && ENEMIES[d.defId]?.boss && STAGES[this.stageId]?.spawnGroups?.length && !this.bossMemo) {
          this.bossMemo = true;
          this.bossIntro(d);
          // 第 63 輪：等級還不夠就碰上 Boss（新存檔 Lv2 直奔狼王要打兩分多鐘）→ 攻略提示多一行建議等級
          const wm = worldMap(this.stageId);
          const lv = this.s.prog?.level ?? 1;
          // 第 73 輪：建議等級搬到 Boss 血條字（`建議 LvN`），這裡只留一句短的，提示最多兩～三行不蓋主角
          // 第 96 輪（D-240）：霧語森林新存檔第 170 秒想起「狼王衝鋒撞上岩壁會暈」，6 秒後攻略提示又講一次 → 30 秒內想起過同一件事就只留練功那行
          // 第 111 輪（D-259）：這張圖的 Boss 已討伐 3 次以上（暴怒解鎖的次數）＝老手，每次進圖不再重講攻略，只留練功那行
          const echo = this.time.now - this.memTipAt < 30000 || (this.tracked && bossKillsOf(this.stageId) >= FURY_UNLOCK.kills);
          const low = !!wm && lv < wm.bossLv;
          const tip = echo ? (low ? '（打不過就先回去練功）' : '') : `${wrapTip(this.bossTipText())}${low ? '\n打不過就先回去練功' : ''}`;
          // 第 64 輪：放在主角腳下（TIP_Y），以前 y 600 正好蓋在 Boss 和牠的第一個紅圈預告上
          // 第 96 輪（D-241）：守望者開打 0.5 秒就瞬移，「化成星光——小心背後！」和 1 秒後的攻略提示「會瞬移到背後」講同一件事
          // → 提示會講瞬移時：提示出現前先瞬移就跳大字、提示改只留練功那行；提示在畫面上時瞬移就不另跳大字
          const blinkTip = !echo && /瞬移/.test(this.bossTipText());
          if (blinkTip) { this.tipBlinkFrom = this.time.now + 2100; this.tipBlinkUntil = this.tipBlinkFrom + tipMs(tip); }
          this.time.delayedCall(2100, () => {
            const t = blinkTip && this.time.now - this.blinkSaidAt < 8000 ? (low ? '（打不過就先回去練功）' : '') : tip;
            if (t) bigText(this, GAME_WIDTH / 2, TIP_Y, t, '#d8c8ff', 28, tipMs(t));
          });
        }
      } else if (e.type === 'leash') {
        const d = u(e.id);
        if (d) floatNumber(this, this.sx(d.x), this.sy(d.y) - 60, '脫戰', { color: '#c8d0f0', size: 22 });
        // 第 54 輪（D-185）：Boss 因為玩家跑出巢穴而回家 → 講清楚為什麼（8 秒內只講一次）
        if (d && ENEMIES[d.defId]?.boss && !this.bot && this.time.now > this.leashToldAt + 8000) {
          const bz = STAGES[this.stageId]?.bossZone;
          const pl = playerOf(this.s);
          if (bz && !pl.dead && Math.hypot(pl.x - bz.x, pl.y - bz.y) > bz.r && !(STAGES[this.stageId]?.campfires ?? []).some((c) => Math.hypot(pl.x - c.x, pl.y - c.y) < UNIT * 6)) {
            this.leashToldAt = this.time.now;
            bigText(this, GAME_WIDTH / 2, TIP_Y, `跑出巢穴的紅圈了——\n${ENEMIES[d.defId]?.name ?? 'Boss'}回巢穴回滿！`, '#ff9a7a', 30, 2200);
          }
        }
      } else if (e.type === 'reset') {
        const d = u(e.id);
        if (d) floatNumber(this, this.sx(d.x), this.sy(d.y) - 50, '回滿', { color: '#7dffb0', size: 22 });
      } else if (e.type === 'dodge') SFX.dodge();
      else if (e.type === 'block') {
        SFX.parry();
        this.buzz(18); // 第 80 輪：格擋成功輕震一下（D-212）
        this.hitStop = Math.max(this.hitStop, 110);
        const p = playerOf(this.s);
        shockRing(this, this.sx(p.x), this.sy(p.y), 0x7dffb0, 90, 300, 6);
        // 反擊的形狀跟著選的變化走（第 25 輪修：以前一律畫原招的扇形）
        const pd = skillDef(this.s, 'parry');
        const cs0 = pd?.block?.counter.shape;
        const cs = cs0 && skillShape(this.s, 'parry', cs0);
        const ang = Math.atan2(p.facingY, p.facingX);
        if (this.s.weapon === 'staff') this.ffx.hexShield(p.x, p.y);
        else {
          // 第 71 輪：劍／弓擋下的瞬間，面前迸出一朵白金星芒＋火花（以前凍結看只有綠圈和字，「鏘」的感覺不夠）
          const bx = this.sx(p.x) + Math.cos(ang) * 46;
          const by = this.sy(p.y) - 34 + Math.sin(ang) * 46;
          const st = this.add.graphics().setDepth(702).setBlendMode(Phaser.BlendModes.ADD).setPosition(bx, by);
          for (let q = 0; q < 8; q++) {
            const a = (q / 8) * Math.PI * 2 + 0.2;
            const L = q % 2 ? 34 : 64;
            st.lineStyle(q % 2 ? 3 : 5, 0xfff2c0, 0.95).lineBetween(Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * L, Math.sin(a) * L);
          }
          st.fillStyle(0xffffff, 1).fillCircle(0, 0, 12).fillStyle(0xffe08a, 0.45).fillCircle(0, 0, 26);
          this.tweens.add({ targets: st, scale: 1.5, alpha: 0, angle: 20, delay: 90, duration: 300, ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
          sparks(this, bx, by, 16, 'spark', 0xffe08a, 420);
          this.cameras.main.shake(90, 0.005);
        }
        if (cs && this.s.weapon === 'staff') this.rfx.staffFx(p.x, p.y, ang, cs, false, true, 0, pd?.block?.counter.status?.id); // 法杖：屏障炸開／鏡像光束（D-152）
        else if (cs && this.s.weapon === 'bow' && cs.type !== 'line') this.rfx.bowFx(p.x, p.y, ang, cs, false, false, false, false, pd?.block?.counter.status?.id); // 流光見切（D-148）：四面射出；殘月見切（D-149）：紫色扇形
        else if (cs?.type === 'sector') this.ffx.slash(p.x, p.y, ang, cs.r, cs.deg + 30, 0x7dffb0, 10);
        else if (cs?.type === 'circle') {
          this.spin(p.x, p.y, cs.r, 0xffd27a, (this.time.now / 90) % (Math.PI * 2));
          shockRing(this, this.sx(p.x), this.sy(p.y), 0xffd27a, cs.r * this.k * 1.1, 380, 8);
        } else if (cs?.type === 'line') {
          // 迴光一閃（D-121）：擋下的瞬間一道白金劍氣直射出去；長弓的見切射擊是一支金色重箭（D-147）
          if (this.s.weapon === 'bow') this.rfx.arrowBeam(p.x, p.y, ang, cs.len, cs.width, 0xffe08a, true);
          else this.ffx.groundSplit(p.x, p.y, ang, cs.len, cs.width);
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
          this.nightLight?.flash(this.sx(d.x), this.sy(d.y), (ENEMIES[d.defId]?.boss ? 520 : 220) * this.k * 1.5, ENEMIES[d.defId]?.boss ? 1400 : 420);
          this.hitStop = Math.max(this.hitStop, ENEMIES[d.defId]?.boss ? 260 : 90);
          this.killSprite(d.id);
          this.bountyKill(d.defId);
          if (this.tracked && !this.bot) onlineLoot.kill(d);
          if (this.ventHit.get(d.id) === e.tick) this.ventKill(d.x, d.y);
          this.ventHit.delete(d.id);
          if (d.defId === 'thorn_queen' || d.defId === 'thorn_mother') this.hz.thornWither(d.x, d.y, d.defId === 'thorn_queen');
          if (ENEMIES[d.defId]?.boss && !this.bot) {
            this.buzz([50, 40, 90]); // 第 80 輪：Boss 倒下震兩下（D-212）
            const rec = this.tracked ? loadRecord(this.stageId) : {};
            const long = d.fury ? !rec.furyKills : !rec.bossKills;
            this.bossRays(this.sx(d.x), this.sy(d.y), Phaser.Display.Color.HexStringToColor(worldMap(this.stageId)?.color ?? '#ffd27a').color, long);
          }
          if (ENEMIES[d.defId]?.boss && STAGES[this.stageId]?.spawnGroups?.length) this.bossSlain(`${d.fury ? '暴怒的' : ''}${ENEMIES[d.defId]!.name}`, !!d.fury);
          else eliteFall(this, d.defId, this.sx(d.x), this.sy(d.y), ENEMIES[d.defId]?.name ?? ''); // 精英／巡守倒下的演出（fx/eliteFall）
        }
      } else if (e.type === 'phase2') {
        const [t2, c2] = worldMap(this.stageId)?.phase2 ?? WORLD_MAPS[0]!.phase2;
        // 已經是暴怒的 Boss 再喊「狼王暴怒！」很怪（第 46 輪）：改說牠徹底失控
        bigText(this, GAME_WIDTH / 2, 520, u(e.id)?.fury ? `${this.bw}徹底失控了！` : t2, c2, 52, 700);
        this.phaseUntil = this.time.now + 3200;
        this.phaseBannerUntil = this.time.now + 950;
        this.tipCalmUntil = Math.max(this.tipCalmUntil, this.phaseUntil);
        // 剛好正在顯示的深夜說明讓位（同一秒出現時三層大字疊成一疊）
        const nt = this.nightTip;
        if (nt?.active) { this.tweens.killTweensOf(nt); this.tweens.add({ targets: nt, alpha: 0, duration: 160, onComplete: () => nt.destroy() }); }
      }
      else if (e.type === 'wallStun') {
        // 第 60 輪：熔渣史萊姆、詞綴小怪一撞牆就跳置中大字，燼紅裂谷幾秒一次、蓋在別的公告上 → 大字只給 Boss／精英，其他在怪頭上小字
        const w = u(e.id);
        // D-238：星隕高原精英多、幾秒一次「撞牆暈眩！」置中大字太吵 → 精英撞牆每次進圖只用大字講 2 次，之後在牠頭上大一點的小字
        // 第 96 輪：狼后一場撞牆 5～8 次也一樣 → Boss 每次進圖大字 3 次，之後頭上小字（Boss 身體大，字放高一點）
        const boss = !w || !!ENEMIES[w.defId]?.boss;
        const elite = !!w && !boss && w.tier === 'elite';
        const n = boss ? this.stunBoss : elite ? this.stunBig : -1;
        if (!w || (boss && n < STUN_BIG_BOSS) || (elite && n < STUN_BIG_TIMES)) {
          if (boss) this.stunBoss++;
          else this.stunBig++;
          bigText(this, GAME_WIDTH / 2, 520, '撞牆暈眩！趁現在！', '#ffd27a', 40, 700);
        } else floatNumber(this, this.sx(w.x), this.sy(w.y) - (boss ? 170 : 90), n >= 0 ? '暈眩！趁現在！' : '暈眩！', { color: '#ffd27a', size: boss ? 34 : n >= 0 ? 30 : 24 });
      }
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
          // D-241：攻略提示正在講瞬移就不另跳大字
          if (this.time.now < this.tipBlinkFrom || this.time.now >= this.tipBlinkUntil) {
            this.blinkSaidAt = this.time.now;
            bigText(this, GAME_WIDTH / 2, 520, wd ? '巡守隱入霧中——小心背後！' : wmb.blink[0], wd ? '#9af0e0' : wmb.blink[1], 38, 900);
          }
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
          this.nightLight?.flash(this.sx(p.x), this.sy(p.y), 900 * this.k * 1.5, 700);
          sparks(this, this.sx(p.x), this.sy(p.y), 26, 'ember', 0xff9ae0, 520);
          bigText(this, GAME_WIDTH / 2, 460, `${skillDef(this.s, 'blade_storm')!.name}！`, '#ff9ae0', 54, 700);
        } else {
          SFX.blip();
          // 深夜：一般技能出手時身邊亮一下（法杖的魔法、劍氣、箭光）
          const p = u(e.id) ?? playerOf(this.s);
          this.nightLight?.flash(this.sx(p.x), this.sy(p.y), 360 * this.k * 1.5, 320);
        }
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
          if (tg0?.blockable) this.tipOnce('jg_tip_block', `黃框＝可以格擋！敵人打到前按「${skillDef(this.s, 'parry')?.name ?? '格擋反擊'}」`, '#ffe08a');
          // 墜星類畫成藍白色（D-177）：不要拿它講「紅色範圍」，等第一次真的紅圈再說
          else if (!METEOR_ATTACKS.has(e.attack)) this.tipOnce('jg_tip_tele', '紅色範圍填滿就命中——走出去！', '#ff9a8a');
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
          if (tg) this.hz.queue(tg);
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
          if (tg) this.hz.queue(tg);
        }
        // 荊棘綻放（D-114）：狼后腳下冒出綠色孢子＋第一次提示跑出圈外
        if (e.attack === 'colossus_core_burst') {
          // 暴怒岩王的熔心爆發（第 26 輪）：胸口熔心亮起＋大圈警告
          const o = u(e.owner);
          coreBurstCue(this, o ? { x: this.sx(o.x), y: this.sy(o.y) } : null, this.k);
        }
        if (e.attack === 'queen_bloom') {
          const o = u(e.owner);
          if (o) queenBloomCue(this, this.sx(o.x), this.sy(o.y), this.k);
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
          this.ffx.starImpact(vx, vy, e.r * this.k);
        } else if (Math.hypot(pl.x - e.x, pl.y - e.y) < UNIT * 14) ventEruptCue(this, vx, vy, e.r * this.k);
        if (near) {
          this.cameras.main.shake(110, 0.004);
          SFX.hitHeavy();
        }
        // 開場大字還在時先不說（第 45 輪：星隕高原開場 4 秒內就砸第一顆星，兩段大字疊在一起）；下一次噴發再說
        // 第 61 輪：上方的記憶卡還在也先不說（y 470 剛好貼在卡片下緣）
        // 第 77 輪：Boss 剛倒下（討伐大字）／第二階段大字／抉擇面板期間也先不說——岩王巢穴旁就有熔岩口，討伐那一刻會冒出噴發說明
        // 第 78 輪（D-210）：Boss 戰打到一半也先不說——傳到巢穴打岩王時，說明 2 行大字整塊壓在 Boss 和主角身上，接著就是討伐大字
        const bossFight = enemiesOf(this.s).some((u) => u.tier === 'boss' && !u.dead && u.mode === 'combat');
        if (!this.ventHinted && near && !bossFight && !this.storySoon && this.time.now >= this.tipCalmUntil && !this.bot && !this.tipBusy && !this.topCard?.active && !this.menu?.active && this.time.now >= this.slainUntil && this.time.now >= this.phaseUntil && this.time.now >= this.chapterUntil) {
          this.ventHinted = true;
          const vt = this.starMap
            ? bigText(this, GAME_WIDTH / 2, 470, '星星砸下來了！地上出現藍圈就快走開\n（閃避可以躲・把追你的怪引過來砸）', '#c8d8ff', 30, 1800)
            : bigText(this, GAME_WIDTH / 2, 470, '熔岩口噴發！地上發亮就快走開\n（閃避可以躲・把追你的怪引過來燒）', '#ffb36a', 30, 1800);
          // 第 77 輪：深夜說明／教學小字等它講完（以前深夜高原 18 秒時和「深夜的星星落得更頻繁…」同一刻出，兩則 2 行疊滿畫面中段）
          this.holdTips(vt);
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
        // 線上版（第 151 輪）：金幣／粉塵／結晶是伺服器擲的（loot.claim 回來時在 onlineBounty 飄字）；本機撿到的數字不準、被拒時更不該飄
        if (import.meta.env.VITE_SERVER_URL && this.tracked && !this.bot && e.kind !== 'potion') continue;
        this.pickupFloat(e.kind, e.amount);
      } else if (e.type === 'levelUp') {
        if (this.tracked) this.ptsLeft = this.skillPointsLeft();
        // 升級（D-090）：金色光柱＋大字＋數值浮字，立刻存檔
        const p = playerOf(this.s);
        this.nightLight?.flash(this.sx(p.x), this.sy(p.y), 700 * this.k * 1.5, 1200); // 深夜：升級光柱照亮四周
        if (this.tracked && e.level === FURY_UNLOCK.level && STAGES[this.stageId]?.bossZone?.fury && (loadRecord(this.stageId).bossKills ?? 0) >= 1 && (loadRecord(this.stageId).bossKills ?? 0) < FURY_UNLOCK.kills) this.furyUnlockedToast(); // D-247：還沒打倒過這張圖的 Boss 不算解鎖
        SFX.perfect();
        this.cameras.main.flash(180, 255, 230, 160);
        const col = this.add.rectangle(this.sx(p.x), this.sy(p.y) - 200, 90, 420, 0xffe08a, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(44);
        this.tweens.add({ targets: col, scaleX: 0.1, alpha: 0, duration: 900, ease: 'Cubic.In', onComplete: () => col.destroy() });
        // 第 50 輪：以前「技能點 +1」和標題同一個 54px 大字（兩行很擠），主角頭上的「HP・攻擊」飄字剛好被第二行蓋住 → 標題一行大字＋數值／技能點一則小字（置中大字會自動錯開，D-162）
        bigText(this, GAME_WIDTH / 2, 430, `等級提升！Lv ${e.level}`, '#ffe08a', 54, 1000);
        // 第 51 輪：數值小字改排在主角腳下（360×640 時主角在畫面 y≈580，以前小字剛好蓋住主角頭上的傷害數字 1.3 秒）；x 偏 1px＝固定位置、不排隊
        const showStat = (): void => {
          const q = playerOf(this.s);
          const stat = bigText(this, GAME_WIDTH / 2 + 1, Math.max(560, Math.min(this.sy(q.y) + 130, GAME_HEIGHT - 520)), `HP ${e.maxHp}・攻擊 ${e.atk}${this.tracked ? '\n技能點 +1（☰ → 技能點）' : ''}`, '#fff2c8', 30, 1300);
          // 第 76 輪：360×640 撿裝備＋升級同一秒，數值小字以前整塊蓋在「撿到裝備了！」教學上 → 讓開正在顯示的大字＋登記佔用
          pinBanner(this, stat, 1500);
          const lt = this.liveTip;
          if (lt && lt.t.active && Math.abs(lt.t.y - stat.y) < (lt.t.height + stat.height) / 2 + 16) this.yieldTip(lt);
        };
        // 第 88 輪（D-226）：打 Boss 打到第二階段的同一下剛好升級，數值小字（固定位置）整塊蓋在「狼王暴怒！」上 → 等暴怒大字淡出再出
        const wait = this.phaseBannerUntil - this.time.now;
        if (wait > 0) this.time.delayedCall(wait, showStat);
        else showStat();
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
        // 第 87 輪：首領從主角上方衝過來時，固定在 420／490 的兩行大字正好蓋住牠衝刺的路線（360×640 看不到首領長什麼樣）→ 改排在主角下方
        const yb = hiddenEliteBannerY(d ? this.sy(d.y) : null, this.sy(playerOf(this.s).y), this.scale.height);
        const y0 = yb !== 420 && bannerBusy(this, yb, 130) ? 420 : yb; // 主角下方被別的大字佔著就照舊（不排隊，警告不能晚出）
        // 兩行合成一塊：分開出的時候第二行會被別的提示推到第一行上面（順序顛倒）
        bigText(this, GAME_WIDTH / 2, y0, `隱藏的${ENEMIES[d?.defId ?? '']?.name ?? '首領'}現身！\n比一般的強很多・掉落三倍`, '#ffa040', 38, 1900);
        if (d) shockRing(this, this.sx(d.x), this.sy(d.y), 0xffa040, 180, 650, 8);
      } else if (e.type === 'riot') {
        SFX.warn(true);
        this.cameras.main.shake(260, 0.006);
        bigText(this, GAME_WIDTH / 2, 420, e.elite ? '狼群暴動！首領也來了！' : '狼群暴動！', '#ff7a5a', 50, 1200);
        this.time.delayedCall(700, () => bigText(this, GAME_WIDTH / 2, 490, `${e.count} 隻狼衝過來了・打倒掉落加倍`, '#ffd27a', 28, 1400));
        shockRing(this, this.sx(e.x), this.sy(e.y), 0xff5a3a, 200, 700, 8);
      } else if (e.type === 'chest') {
        // 線上版：夜光寶箱出去再進來 5 分鐘內伺服器不給（D-313）→ 說清楚，不然 HUD 沒加錢像是 bug
        if (this.tracked && !this.bot) onlineLoot.chest(e.chest, () => {
            if (this.scene.isActive()) this.announce('夜光寶箱的光還沒恢復・這次沒有東西（約 5 分鐘後再來）', '#bfe0ff');
          });
        const c = STAGES[this.stageId]?.chests?.find((q) => q.id === e.chest);
        const x = c ? this.sx(c.x) : GAME_WIDTH / 2;
        const y = c ? this.sy(c.y) : 600;
        this.nightLight?.flash(x, y, 420 * this.k * 1.5, 1600); // 深夜：寶箱打開的光
        SFX.perfect();
        SFX.itemGet();
        this.cameras.main.flash(120, 255, 230, 160);
        shockRing(this, x, y, 0xffd27a, 160, 520, 7);
        sparks(this, x, y - 20, 30, 'ember', 0xffe08a, 620);
        const got = Object.entries(e.loot).map(([k, n]) => `${LOOT_NAMES[k] ?? k} ×${n}`).join('　');
        const head = bigText(this, GAME_WIDTH / 2, 390, c?.nightOnly ? '夜光寶箱！' : '找到隱藏寶箱！', c?.nightOnly ? '#bfe0ff' : '#ffd27a', 46, 1000);
        // 第 88 輪（D-227）：標題被別的東西（記憶卡、大字）推到主角下方時，內容以前還是排在原位 446 → 「結晶 ×3…」跑到「夜光寶箱！」上面，順序顛倒 → 內容跟著標題排
        const below = (dy: number, y0: number): number => (head.active && Math.abs(head.y - 390) > 1 ? head.y + dy : y0);
        this.time.delayedCall(500, () => bigText(this, GAME_WIDTH / 2, below(56, 446), got, '#f4e6c0', 30, 1400));
        // 寶箱裡的燼牌（D-131）：第一次拿到才出字
        const card = this.tracked ? CHEST_CARDS[e.chest] : undefined;
        if (card && grantCard(card)) this.time.delayedCall(1300, () => bigText(this, GAME_WIDTH / 2, below(110, 500), `＋燼牌「${EMBER_CARDS[card]?.name ?? card}」\n營火行商的「燼牌」可以用`, '#ffb36a', 28, 1800));
      } else if (e.type === 'rest') {
        const p = playerOf(this.s);
        SFX.itemGet();
        shockRing(this, this.sx(p.x), this.sy(p.y), 0xffb060, 120, 500, 6);
        // 第 87 輪：倒下醒來時已經 HP 全滿、有「在營火旁醒來」大字 → 不再浮「休息・HP 全滿」
        if (this.time.now >= this.reviveUntil) bigText(this, this.sx(p.x), this.sy(p.y) - 90, '休息・HP 全滿', '#ffd27a', 32, 600);
      } else if (e.type === 'revive') {
        const p = playerOf(this.s);
        // 倒下→黑幕 1 秒淡入（像真的昏過去再醒來），再出字
        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.reviveUntil = this.time.now + 3500;
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

  /** 旋轉刀環（旋風斬／劍刃風暴） */
  private spin(wx: number, wy: number, wr: number, color: number, start: number): void {
    for (let i = 0; i < 2; i++) this.ffx.slash(wx, wy, start + i * Math.PI, wr, 160, color, 7);
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
        this.rfx.bowFx(p.x, p.y, ang, hs, sk.role === 'ult', !!sk.dash, h.status?.id === 'break', h.status?.id === 'freeze', h.status?.id);
        return;
      }
      if (this.s.weapon === 'staff') {
        this.rfx.staffFx(p.x + ((h.ahead ?? 0) * a.dirX) / 1000, p.y + ((h.ahead ?? 0) * a.dirY) / 1000, ang, hs, sk.role === 'ult', sk.hits.length === 1, sk.dash ? Math.sign(sk.dash.distance) * (k >= sk.dash.fromTick + sk.dash.ticks ? 1 : 0) : 0, h.status?.id);
        return;
      }
      if (sk.dash) {
        // 衝鋒：身後殘影線
        const g = this.add.graphics().setDepth(690).setBlendMode(Phaser.BlendModes.ADD);
        const L = 90 * this.k;
        const px = this.sx(p.x);
        const py = this.sy(p.y);
        const dc = h.status?.id === 'weak' ? 0xc0a0ff : 0x9fd8ff;
        // 第 71 輪：衝鋒多一道身後的風壓尾（寬的淡光＋亮芯），以前只有三條細線
        const L2 = L * 3.2;
        g.fillStyle(dc, 0.22).fillTriangle(px - Math.sin(ang) * 30, py + Math.cos(ang) * 30, px + Math.sin(ang) * 30, py - Math.cos(ang) * 30, px - Math.cos(ang) * L2, py - Math.sin(ang) * L2);
        g.fillStyle(0xffffff, 0.35).fillTriangle(px - Math.sin(ang) * 10, py + Math.cos(ang) * 10, px + Math.sin(ang) * 10, py - Math.cos(ang) * 10, px - Math.cos(ang) * L2 * 0.7, py - Math.sin(ang) * L2 * 0.7);
        for (let j = -2; j <= 2; j++) {
          g.lineStyle(4 - Math.abs(j), dc, 0.85).lineBetween(px - Math.sin(ang) * j * 14, py + Math.cos(ang) * j * 14, px - Math.cos(ang) * L * (1.4 - Math.abs(j) * 0.2) - Math.sin(ang) * j * 14, py - Math.sin(ang) * L * (1.4 - Math.abs(j) * 0.2) + Math.cos(ang) * j * 14);
        }
        if (i === 0) {
          sparks(this, px, py, 8, 'spark', 0xd8f0ff, 320);
          shockRing(this, px, py, dc, 60, 220, 5);
        }
        this.tweens.add({ targets: g, alpha: 0, duration: 320, onComplete: () => g.destroy() });
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
        this.ffx.slash(p.x, p.y, ang, hs.r, hs.deg + 30, big ? 0xffd05a : 0x9fd8ff, big ? 10 : 7);
        if (big) this.cameras.main.shake(80, 0.004);
      } else if (hs.type === 'line') {
        this.ffx.groundSplit(p.x, p.y, ang, hs.len, hs.width);
      }
      // 星落一閃（D-112）：單發大招 → 天上落下一道光柱
      if (sk.role === 'ult' && sk.hits.length === 1 && hs.type !== 'line') this.rfx.starfall(p.x, p.y, hs.type === 'circle' ? hs.r : UNIT * 3);
      // 變化二（D-121）：帶狀態的招式多一層顏色——霜旋寒氣、碎甲／斬月紅色碎光、影步紫色殘影
      const st = h.status?.id;
      if (st === 'freeze') {
        this.hz.spawnFrost(p.x, p.y, hs.type === 'circle' ? hs.r : UNIT * 2);
        shockRing(this, this.sx(p.x), this.sy(p.y), 0xbff4ff, (hs.type === 'circle' ? hs.r : UNIT * 2) * this.k * 1.15, 520, 10);
        sparks(this, this.sx(p.x), this.sy(p.y), 26, 'spark', 0xd8fbff, 700);
        this.cameras.main.flash(90, 190, 240, 255);
      } else if (st === 'break' && big) {
        const fx = this.sx(p.x) + Math.cos(ang) * UNIT * 1.4 * this.k;
        const fy = this.sy(p.y) + Math.sin(ang) * UNIT * 1.4 * this.k;
        sparks(this, fx, fy, sk.role === 'ult' ? 30 : 16, 'ember', 0xff6a4a, 560);
        if (hs.type === 'sector' && sk.role !== 'ult') {
          // 第 72 輪：碎甲斬命中以前只有一道細金弧＋幾點火星 → 疊一道寬的赤紅月牙、前方裂甲衝擊環、短頓幀
          this.ffx.slash(p.x, p.y, ang, hs.r * 1.12, hs.deg + 44, 0xff5a3a, 16);
          shockRing(this, fx, fy, 0xff8a5a, UNIT * 1.6 * this.k, 300, 7);
          sparks(this, fx, fy, 10, 'spark', 0xffd0b0, 420);
          this.cameras.main.shake(110, 0.006);
          this.hitStop = Math.max(this.hitStop, 60);
        }
        if (sk.role === 'ult') {
          if (hs.type === 'line') this.ffx.moonArc(p.x, p.y, ang, hs.len, hs.width);
          this.cameras.main.shake(220, 0.01);
          this.hitStop = Math.max(this.hitStop, 120);
        }
      } else if (st === 'weak') sparks(this, this.sx(p.x), this.sy(p.y), 8, 'ember', 0xb08aff, 360);
    });
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
        this.ffx.fallingStar(g, vx, vy, Math.max(0, (t - 0.5) / 0.5));
      }
    }
  }

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
   * 抉擇的痕跡（D-157，第 35 輪）：Boss 巢穴旁留下你選擇的結果——還：霧裡的小狼／母樹的白花／還在燒的燼心；
   * 取：斷掉的霧角石座／枯掉的荊棘／冷掉的黑岩。走近時說一句話（每次進地圖一次）。純畫面。
   */
  private choiceMarkSaid = false;
  /** 「還」的小跟班（D-158）：重進地圖時在主角旁；剛選完「還」就從 Boss 倒下的地方飛過來（D-190）。畫法在 fx/companion.ts */
  private spawnCub(x: number, y: number): boolean {
    if (!this.tracked || this.bot) return false;
    return this.cub.spawn(this.stageId, x, y, this.time.now);
  }
  /**
   * 巢穴邊界（第 54 輪，D-185）：Boss 交戰中、玩家走到巢穴外圈（> 55% 半徑）時，地上浮出紅色虛線圈，越靠近邊越亮。
   * 以前只有進巢穴那一刻的地區說明，打到一半被擊退或追小狼跑出去，Boss 就默默回家回滿，新玩家看不出為什麼。
   */
  private drawBossRing(g: Phaser.GameObjects.Graphics, now: number): void {
    const bz = STAGES[this.stageId]?.bossZone;
    if (!bz || this.bot) return;
    const p = playerOf(this.s);
    if (p.dead || !enemiesOf(this.s).some((e) => ENEMIES[e.defId]?.boss && e.mode === 'combat')) return;
    const near = Math.hypot(p.x - bz.x, p.y - bz.y) / bz.r;
    const a = Math.min(1, (near - 0.55) / 0.25);
    if (a <= 0) return;
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    const n = Math.max(48, Math.round((bz.r * this.k) / 9));
    const drift = (now / 4000) % 1;
    for (let i = 0; i < n; i += 2) {
      const a0 = ((i + drift * 2) / n) * Math.PI * 2;
      const a1 = ((i + 1 + drift * 2) / n) * Math.PI * 2;
      // 第 64 輪：巢穴圓圈超出地圖的那段（北緣外的漸層裡）不畫——以前會在黑暗裡飄著一段段紅線
      const wx0 = bz.x + Math.cos(a0) * bz.r;
      const wy0 = bz.y + Math.sin(a0) * bz.r;
      if (wx0 < 0 || wy0 < 0 || wx0 > this.s.arena.w || wy0 > this.s.arena.h) continue;
      const x0 = this.sx(wx0);
      const y0 = this.sy(wy0);
      if (x0 < -40 || x0 > GAME_WIDTH + 40 || y0 < VIEW_TOP - 40 || y0 > VIEW_BOTTOM + 40) continue;
      const x1 = this.sx(bz.x + Math.cos(a1) * bz.r);
      const y1 = this.sy(bz.y + Math.sin(a1) * bz.r);
      g.lineStyle(16, 0xff3a2a, 0.2 * a * (0.6 + 0.4 * pulse)).lineBetween(x0, y0, x1, y1);
      g.lineStyle(5, 0xff6a4a, (0.55 + 0.35 * pulse) * a).lineBetween(x0, y0, x1, y1);
    }
  }

  private drawChoiceMark(g: Phaser.GameObjects.Graphics, now: number): void {
    if (!this.choiceMark) return;
    const { x, y, map, pick } = this.choiceMark;
    const cx = this.sx(x);
    const cy = this.sy(y);
    if (cx < -100 || cx > GAME_WIDTH + 100 || cy < VIEW_TOP - 140 || cy > VIEW_BOTTOM + 100) return;
    const k = this.k * 2.6;
    drawChoiceMarkArt(g, cx, cy, k, map, pick, now / 1000);
    // 第 68 輪：痕跡就在巢穴旁，走過去常常正好驚動 Boss → 那句話以前浮在 Boss 登場名字上；Boss 開打期間先不說，脫戰或討伐後再走近才說
    if (!this.choiceMarkSaid && !this.bot && !enemiesOf(this.s).some((e) => ENEMIES[e.defId]?.boss && e.mode === 'combat')) {
      const p = playerOf(this.s);
      if (Math.hypot(p.x - x, p.y - y) < UNIT * 2.5) {
        this.choiceMarkSaid = true;
        const line = CHOICE_ECHO[`${map}:${pick}`];
        if (line) floatNumber(this, cx, cy - 70 * k, line, { color: pick === 'spare' ? '#c8f0dc' : '#d8ccb8', size: 24 });
      }
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
  /**
   * 上方的記憶卡／回禮卡會蓋住懸賞板較長的那行（「荊棘母樹 0/1（別圖）」右緣約 225，卡片左緣 160），
   * 字被切一半很難看 → 卡片在的時候懸賞板先淡出，卡片消失再回來（第 53 輪，D-184）
   */
  /** 收掉正在顯示的地區名稱＋說明（Boss 登場、上方卡片出現時） */
  private clearZoneTexts(): void {
    for (const z of this.zoneTexts) {
      if (!z.active) continue;
      this.tweens.killTweensOf(z);
      this.tweens.add({ targets: z, alpha: 0, duration: 180, onComplete: () => z.destroy() });
    }
    this.zoneTexts = [];
  }

  /** 上方卡片出現時開場說明框先淡出，卡片消失再回來（第 57 輪） */
  private hideHintUnder(c: Phaser.GameObjects.Container): void {
    const h = this.hint;
    if (!h?.active) return;
    this.tweens.add({ targets: h, alpha: 0, duration: 200 });
    c.once('destroy', () => { if (h.active && this.hint === h) this.tweens.add({ targets: h, alpha: 1, duration: 300 }); });
  }

  private hideBountyUnder(c: Phaser.GameObjects.Container, cw: number): void {
    const bt = this.bountyTxt;
    if (!bt?.visible || !bt.text) return;
    if (bt.getBounds().right <= GAME_WIDTH - 16 - cw) return;
    this.tweens.add({ targets: bt, alpha: 0, duration: 250 });
    c.once('destroy', () => { if (bt.active) this.tweens.add({ targets: bt, alpha: 1, duration: 300 }); });
  }

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
    // 第 43 輪：整組往下挪 70（以前名字壓在左上角懸賞板的字上，懸賞板到 y≈425）
    const IY = 70;
    // 走進 Boss 巢穴那一刻地區名稱（「— 熔心王座 —」＋說明）也剛好出來，兩行字壓在 Boss 身上、和登場名字搶 → 先收掉（D-184）
    this.clearZoneTexts();
    // 名字＋稱號這一塊（y 約 420～556）在淡出前不讓其他置中大字（大招名、升級…）壓上來（D-184）
    reserveBanner(this, 488 + IY - 70, 150, 1800);
    const line = this.add.rectangle(-GAME_WIDTH / 2, 430 + IY, GAME_WIDTH * 0.9, 4, Phaser.Display.Color.HexStringToColor(col).color, 0.9).setDepth(881);
    const name = this.add.text(-GAME_WIDTH / 2, 392 + IY, `${d.fury ? '暴怒的' : ''}${def.name}`, { fontFamily: TITLE_FONT, fontSize: '58px', color: col, stroke: '#000', strokeThickness: 8 }).setOrigin(0.5).setDepth(882);
    const subT = this.add.text(GAME_WIDTH * 1.5, 466 + IY, sub, { fontFamily: UI_FONT, fontSize: '26px', fontStyle: '700', color: '#f4e6c0', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(882);
    [line, name].forEach((o) => this.tweens.add({ targets: o, x: GAME_WIDTH / 2, duration: 420, ease: 'Cubic.easeOut' }));
    this.tweens.add({ targets: subT, x: GAME_WIDTH / 2, duration: 420, delay: 120, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [line, name, subT], alpha: 0, delay: 1800, duration: 400, onComplete: () => [line, name, subT].forEach((o) => o.destroy()) });
    const burst = (): void => {
      if (!this.scene.isActive()) return;
      const bx = this.sx(d.x);
      const by = this.sy(d.y);
      shockRing(this, bx, by, Phaser.Display.Color.HexStringToColor(col).color, 220, 600, 8);
      sparks(this, bx, by, 24, 'ember', Phaser.Display.Color.HexStringToColor(col).color, 700);
    };
    // 第 85 輪（D-219）：360×640 星骸守望者在約 9.6 公尺外就醒，登場名字出來時牠還在畫面上緣外（只看到「9m」箭頭）
    // → 牠在畫面外就把鏡頭往牠帶一半（主角和 Boss 同框），衝擊環等鏡頭到了才放
    const by0 = this.sy(d.y);
    const bx0 = this.sx(d.x);
    if (!this.bot && (by0 < VIEW_TOP + 140 || by0 > VIEW_BOTTOM - 200 || bx0 < 40 || bx0 > GAME_WIDTH - 40)) {
      this.camPeek = { x: d.x, y: d.y, at: this.time.now, id: d.id, share: 0.5 };
      this.time.delayedCall(PEEK_IN, burst);
    } else burst();
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
    if (!cfg) return null;
    // 主角：有拿目前武器的立繪（ART_REQUESTS R-019：hero_sword／hero_bow／hero_staff）就用它，沒有才退回提燈的 hero_lian
    const key = x.side === 'player' ? heroKey(loadWeapon(), (k) => this.textures.exists(k)) : cfg.key;
    if (!this.textures.exists(key)) return null;
    let sp = this.sprites.get(x.id);
    if (!sp) {
      sp = this.add.image(0, 0, key).setOrigin(0.5, 0.92);
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
    if (this.nightLight) this.drawNightLight();
    const g = this.g.clear();
    const top = this.top.clear();
    const s = this.s;
    const now = this.time.now;
    this.ground.setPosition(this.ox, this.oy);
    // 畫面外的地面塊不送進渲染
    for (const im of this.ground.list as Phaser.GameObjects.Image[]) {
      const x = this.ox + im.x;
      const y = this.oy + im.y;
      im.setVisible(x < GAME_WIDTH && x + im.displayWidth > 0 && y < VIEW_BOTTOM && y + im.displayHeight > 0);
    }
    this.hz.drawThorns(g, now, this.s);
    this.hz.drawFrost(this.frostG.clear(), now);
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
    this.drawBossRing(this.ringG.clear(), now);
    this.drawGate(this.ringG, now);
    // 每幀共用同一個 view（不配置），只更新會變的縮放
    const sv = (this.stormView ??= { lo: this.stormLo, hi: this.stormHi, k: this.k, viewTop: VIEW_TOP, sx: (x) => this.sx(x), sy: (y) => this.sy(y) });
    sv.k = this.k;
    drawStorm(sv, this.s, now);
    this.drawEncounters(g, now);
    this.cub.draw(g, now, this.s);
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
        this.fireCache[fi]?.mer.hide();
        this.fireCache[fi]?.rival.hide();
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
      // （fi 在上面拿光暈時已經 +1，這一堆營火是 fi - 1）
      const fc = this.fireCache[fi - 1];
      if (this.tracked && fc) {
        const off = fi * 1300;
        fc.mer.show(cx + 95 * k, cy + 10 * k, now, 'm', (cg, fx, fy, t) => drawMerchant(cg, fx, fy, 120 * k, t + off));
        // 這張地圖的燼牌對手坐在營火另一邊（D-129）
        const rival = opponentsAt(this.stageId).find((o) => o.map);
        const offR = fi * 900;
        if (rival) fc.rival.show(cx - 95 * k, cy + 10 * k, now, rival.id, (cg, fx, fy, t) => drawCardRival(cg, rival.id, fx, fy, 110 * k, t + offR));
        else fc.rival.hide();
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
        this.ffx.fallingStar(top, vx, vy, Math.max(0, (prog - 0.55) / 0.45));
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
      // 競技場段位光環（第 149 輪，D-318）：荊棘段位以上，冒險時腳下也有（只是外觀）
      if (isP && this.rankAura) drawRankAura(g, this.rankAura, px, py + r * 0.15, r, now);
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
        if (STAR_MARKS.has(x.defId) && !x.dead) this.drawStarMarks(top, x, sp, r, now);
        if ((x.defId === 'ember_shroom' || x.defId === 'star_shroom') && !x.dead) this.drawShroomMarks(top, x, sp, r, now);
        if ((x.defId === 'alpha_wolf' || x.defId === 'shade_wolf') && !x.dead) this.drawWolfMarks(top, x, sp, r, now);
        const thorn = THORN_BACK[x.defId];
        if (thorn !== undefined && !x.dead) {
          // 背上一排往後彎的荊棘刺：深色刺身＋亮色刺尖，呼吸時微微起伏
          const dir = sp.flipX ? -1 : 1;
          const n = x.defId === 'thorn_wolf' ? 4 : 5;
          for (let q = 0; q < n; q++) {
            const bx = sp.x + dir * (0.3 - q * 0.3) * r;
            const by = sp.y - sp.displayHeight * (0.6 + 0.04 * Math.sin(q * 1.9)) + Math.sin(now / 380 + x.id) * r * 0.03;
            const h = r * (0.8 + 0.25 * ((q * 3) % 2)) * (q === 0 || q === n - 1 ? 0.75 : 1);
            const tipX = bx - dir * h * 0.45;
            const tipY = by - h;
            top.fillStyle(thorn, 1).fillTriangle(bx - r * 0.16, by, bx + r * 0.16, by, tipX, tipY);
            top.fillStyle(0xff7ab0, 0.95).fillTriangle(tipX - dir * 1, tipY, tipX + (bx - tipX) * 0.28 - r * 0.04, tipY + (by - tipY) * 0.28, tipX + (bx - tipX) * 0.28 + r * 0.04, tipY + (by - tipY) * 0.28);
          }
        }
        if (isP) {
          this.dash.shadowGhost(x, sp, now);
          if (this.s.weapon === 'staff') this.dash.blinkFx(x, sp);
          this.drawUltAim(g, x, now);
          if (this.s.weapon === 'bow' && !x.dead) {
            // 長弓（D-147）：主角身前一把長弓（程式畫的；拉弓時弦往後拉）
            const dir = sp.flipX ? -1 : 1;
            const bx = sp.x + dir * r * 0.7;
            const by = sp.y - sp.displayHeight * 0.48;
            const R = sp.displayHeight * 0.36;
            const pull = x.action && (x.action.kind === 'attack' || x.action.kind === 'skill') ? Math.min(1, (s.tick - x.action.start) / 6) * R * 0.35 : 0;
            const a0 = dir > 0 ? -1.1 : Math.PI - 1.1;
            // 主角圖本身已經拿著弓（hero_bow，R-019）：不畫程式弓，只在拉弓時讓圖上的箭尖發光
            const art = sp.texture.key === 'hero_bow';
            const tx = bx - dir * R * 0.55 + Math.cos(a0) * R;
            const ty1 = by + Math.sin(a0) * R;
            const ty2 = by - Math.sin(a0) * R;
            if (!art) {
              top.lineStyle(7, 0x3a2410, 0.9).beginPath().arc(bx - dir * R * 0.55, by, R, dir > 0 ? -1.1 : Math.PI - 1.1, dir > 0 ? 1.1 : Math.PI + 1.1, false).strokePath();
              top.lineStyle(4, 0xb07a3a, 1).beginPath().arc(bx - dir * R * 0.55, by, R, a0, a0 + 2.2, false).strokePath();
              top.fillStyle(0xffd27a, 1).fillCircle(tx, ty1, 3.5).fillCircle(tx, ty2, 3.5);
              top.lineStyle(1.5, 0xf0f0e0, 0.9).beginPath().moveTo(tx, ty1).lineTo(tx - dir * pull, by).lineTo(tx, ty2).strokePath();
              // 弓身的金色描邊（遠看也認得出是弓）
              top.lineStyle(1.5, 0xffe0a0, 0.7).beginPath().arc(bx - dir * R * 0.55, by, R + 2.5, a0 + 0.15, a0 + 2.05, false).strokePath();
            }
            if (pull > 0) {
              // 拉弓時搭著一支箭：箭尾在弦上、箭頭超出弓身；技能的箭頭會發光（顏色跟著招式的狀態）
              const sk = x.action?.kind === 'skill' ? skillDef(this.s, x.action.id) : undefined;
              const st0 = sk?.hits[0]?.status?.id ?? sk?.block?.counter.status?.id;
              const col = sk?.role === 'ult' ? 0xff9ae0 : st0 === 'burn' ? 0xff8a3a : st0 === 'poison' ? 0xa8ff6a : st0 === 'freeze' ? 0xbff4ff : st0 === 'weak' ? 0xc8a0ff : sk ? 0x9fe0ff : 0;
              const ax0 = tx - dir * pull;
              // 有圖時箭尖在圖的右緣（材質座標 x≈1.0、y≈0.385；origin 是 0.5／0.92）
              const ax1 = art ? sp.x + dir * sp.displayWidth * 0.48 : bx + dir * R * 0.55;
              const ay = art ? sp.y - sp.displayHeight * 0.535 : by;
              if (!art) {
                top.lineStyle(3, 0x8a6a40, 1).lineBetween(ax0, by, ax1, by);
                top.fillStyle(0xf4f8ff, 1).fillTriangle(ax1 + dir * 10, by, ax1, by - 5, ax1, by + 5);
              }
              if (col) {
                const gl = 0.5 + 0.5 * Math.sin(now / 60);
                top.fillStyle(col, 0.35 + 0.25 * gl).fillCircle(ax1 + dir * 4, ay, (sk?.role === 'ult' ? 16 : 10) + 3 * gl);
              }
            }
          }
          if (this.s.weapon === 'staff' && !x.dead) {
            // 法杖（D-152）：主角身前一根木杖，頂端星晶會呼吸發光；施法時光變大、星晶旁轉一圈符文
            const dir = sp.flipX ? -1 : 1;
            const H = sp.displayHeight;
            const bx = sp.x + dir * r * 0.75;
            const by0 = sp.y - H * 0.12;
            // 主角圖本身已經拿著法杖（hero_staff，R-019）：不畫程式木杖，光暈與符文改繞著圖上的星晶（材質座標 0.89／0.15；origin 0.5／0.92）
            const art = sp.texture.key === 'hero_staff';
            const tx = art ? sp.x + dir * sp.displayWidth * 0.39 : bx + dir * H * 0.06;
            const ty = art ? sp.y - H * 0.77 : sp.y - H * 0.78;
            if (!art) {
              top.lineStyle(6, 0x3a2410, 0.95).lineBetween(bx, by0, tx, ty);
              top.lineStyle(2.5, 0xc08a48, 1).lineBetween(bx, by0, tx, ty);
            }
            const act = x.action && (x.action.kind === 'attack' || x.action.kind === 'skill');
            const sk = x.action?.kind === 'skill' ? skillDef(this.s, x.action.id) : undefined;
            const st0 = sk?.hits[0]?.status?.id ?? sk?.block?.counter.status?.id;
            const col = sk?.role === 'ult' ? 0xffb07a : st0 === 'burn' ? 0xff8a3a : st0 === 'poison' ? 0xa8ff6a : st0 === 'freeze' ? 0xbff4ff : 0xc89aff;
            const gl = 0.5 + 0.5 * Math.sin(now / (act ? 50 : 260));
            const cr = H * 0.05;
            top.fillStyle(col, (act ? 0.45 : 0.22) + 0.2 * gl).fillCircle(tx, ty, cr * (act ? (sk?.role === 'ult' ? 3.4 : 2.4) : 1.7) + 2 * gl);
            if (!art) {
              top.fillStyle(0xe8d8ff, 1).fillTriangle(tx, ty - cr * 1.5, tx - cr * 0.8, ty, tx + cr * 0.8, ty).fillTriangle(tx, ty + cr * 1.2, tx - cr * 0.8, ty, tx + cr * 0.8, ty);
              top.fillStyle(0xffffff, 1).fillCircle(tx, ty, cr * 0.35);
              top.lineStyle(1.5, 0xffe0a0, 0.8).strokeCircle(tx - dir * cr * 0.2, ty + cr * 1.6, cr * 0.7);
            }
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
          if ((this.breakSeen.get(x.id) ?? -1) < s.tick) this.ffx.shatter(px, py - r * 0.5, r);
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
        if (sk && sk.role === 'aoe' && sk.moveFactor >= 1 && s.weapon === 'bow') {
          // 迴旋箭陣（第 71 輪）：繞身轉的光箭環（以前借用劍的龍捲線＋一大塊平平的藍圈）
          const k0 = s.tick - x.action.start;
          const R = (sk.hits[0]?.shape.type === 'circle' ? sk.hits[0].shape.r : UNIT * 3) * this.k * 0.62;
          const cy = py - r * 0.4;
          top.lineStyle(10, 0x9fe0ff, 0.12).strokeCircle(px, cy, R);
          top.lineStyle(2, 0xd8f4ff, 0.5).strokeCircle(px, cy, R);
          for (let q = 0; q < 8; q++) {
            const a = k0 * 0.28 + (q * Math.PI) / 4;
            const ax = px + Math.cos(a) * R;
            const ay = cy + Math.sin(a) * R * 0.8;
            const tx = -Math.sin(a);
            const ty = Math.cos(a) * 0.8;
            top.lineStyle(5, 0x9fe0ff, 0.35).lineBetween(ax, ay, ax - tx * 46, ay - ty * 46);
            top.lineStyle(2, 0xffffff, 0.9).lineBetween(ax, ay, ax - tx * 26, ay - ty * 26);
            top.fillStyle(0xffffff, 1).fillTriangle(ax + tx * 12, ay + ty * 12, ax - ty * 6, ay + tx * 6, ax + ty * 6, ay - tx * 6);
          }
        } else if (sk && sk.role === 'aoe' && sk.moveFactor >= 1) {
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
        // 劍的圓形大招（劍刃風暴／星落一閃）由 drawStorm 畫，不再蓋一層平平的藍
        const stormed = !!sk && s.weapon !== 'bow' && h?.shape.type === 'circle' && !h.ahead && (sk.role === 'ult' ? s.weapon !== 'staff' || (sk.hits.length >= 4 && !h.status) : s.weapon !== 'staff' && !sk.dash && sk.moveFactor < 1 && sk.hits.length >= 3);
        // 第 71 輪：法杖的持續範圍招染成元素色（灼熱領域＝橘、雷暴＝紫），邊緣冒電弧；以前一律平平的藍
        const elem = s.weapon === 'staff' && sk?.role === 'aoe' && sk.hits.length >= 2 ? h?.status?.id : undefined;
        if (h && elem === 'slow' && h.shape.type === 'circle') {
          const hs2 = skillShape(this.s, x.action.id, h.shape);
          const R = hs2.type === 'circle' ? hs2.r * this.k : 0;
          const cy0 = py;
          for (let q = 0; q < 4; q++) {
            const a0 = Math.random() * Math.PI * 2;
            const pts: { x: number; y: number }[] = [];
            for (let z = 0; z <= 4; z++) {
              const a = a0 + z * 0.12;
              const rr = R * (0.94 + Math.random() * 0.12);
              pts.push({ x: px + Math.cos(a) * rr, y: cy0 + Math.sin(a) * rr });
            }
            top.lineStyle(5, 0x9a8aff, 0.3).strokePoints(pts, false).lineStyle(2, 0xf0ecff, 0.9).strokePoints(pts, false);
          }
          top.lineStyle(3, 0xb8a8ff, 0.45).strokeCircle(px, cy0, R);
        }
        // 第 71 輪：蓄力型的單發圓（霜旋、冰霜新星）蓄力中＝寒氣從外圈往內收、冰晶繞圈（以前只有平平的藍圈）
        const frostCharge = !!h && sk?.role === 'aoe' && sk.hits.length === 1 && h.shape.type === 'circle' && h.status?.id === 'freeze' && h.atTick >= 8;
        if (frostCharge && h && h.shape.type === 'circle') {
          const fs = skillShape(this.s, x.action.id, h.shape);
          const R = (fs.type === 'circle' ? fs.r : h.shape.r) * this.k;
          const t = Math.min(1, (s.tick - x.action.start) / h.atTick);
          const rr = R * (1 - 0.55 * t);
          top.lineStyle(8, 0xbff4ff, 0.18 + 0.3 * t).strokeCircle(px, py, rr);
          top.lineStyle(2, 0xffffff, 0.5 + 0.4 * t).strokeCircle(px, py, rr);
          for (let q = 0; q < 10; q++) {
            const a = (q / 10) * Math.PI * 2 - t * 2.4;
            const sx0 = px + Math.cos(a) * rr;
            const sy0 = py + Math.sin(a) * rr;
            top.fillStyle(0xe8fcff, 0.85).fillTriangle(sx0 + Math.cos(a) * 10, sy0 + Math.sin(a) * 10, sx0 - Math.sin(a) * 4, sy0 + Math.cos(a) * 4, sx0 + Math.sin(a) * 4, sy0 - Math.cos(a) * 4);
          }
        }
        if (h && !stormed) {
          // 環形箭雨：以前一大片 0.2 的藍甜甜圈蓋掉整個畫面 → 淡一點＋內外兩圈細線
          const bowRing = s.weapon === 'bow' && h.shape.type === 'ring';
          if (bowRing && h.shape.type === 'ring') {
            top.lineStyle(2, 0xbfe8ff, 0.55).strokeCircle(px, py, h.shape.rOut * this.k).strokeCircle(px, py, h.shape.rIn * this.k);
          }
          // 第 72 輪：法杖的毒系直線（蝕魂彈）以前是一條平平的藍白長方形 → 淡毒綠＋中間一條會流動的亮綠細線
          const venom = s.weapon === 'staff' && h.shape.type === 'line' && h.status?.id === 'poison' && sk?.role !== 'ult';
          if (venom && h.shape.type === 'line') {
            const vs = skillShape(this.s, x.action.id, h.shape);
            const L = (vs.type === 'line' ? vs.len : h.shape.len) * this.k;
            const dx = x.action.dirX / 1000;
            const dy = x.action.dirY / 1000;
            const t = Math.min(1, (s.tick - x.action.start) / Math.max(1, h.atTick));
            top.lineStyle(6, 0x9aff6a, 0.22).lineBetween(px, py, px + dx * L * t, py + dy * L * t);
            top.lineStyle(2, 0xe8ffd0, 0.85).lineBetween(px, py, px + dx * L * t, py + dy * L * t);
            for (let q = 0; q < 5; q++) {
              const f = ((q / 5 + s.tick * 0.07) % 1) * t;
              top.fillStyle(0xc8ff9a, 0.8).fillCircle(px + dx * L * f - dy * Math.sin(q * 2.1) * 8, py + dy * L * f + dx * Math.sin(q * 2.1) * 8, 2.5);
            }
          }
          g.fillStyle(venom ? 0x6ad04a : elem === 'burn' ? 0xff8a3a : elem === 'slow' ? 0x9a8aff : frostCharge ? 0xbff4ff : 0x7dc8ff, elem || bowRing || frostCharge || venom ? 0.1 : s.weapon === 'bow' && sk?.role === 'aoe' && sk.moveFactor >= 1 ? 0.07 : 0.2);
          this.shapePath(skillShape(this.s, x.action.id, h.shape), pos.x, pos.y, x.action.dirX, x.action.dirY, g, true);
        }
      }
    }
    this.offArrows.draw(top);
    this.drawUi();
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

  /** 第 68 輪：(x, y) 在左上小地圖或懸賞板上（含一點邊距）→ 浮字不要畫在那裡 */
  /** 距離字（寬約 w、中心 (x, y)）壓到左上小地圖或懸賞板 → 挪到箭頭 ax 的右邊（第 84 輪） */
  private clearOfHudPanels(x: number, y: number, ax: number, w = 48): number {
    const boxes: { l: number; t: number; r: number; b: number }[] = [];
    const m = this.mini;
    if (m) boxes.push({ l: m.x, t: m.y, r: m.x + m.w, b: m.y + m.h });
    const bt = this.bountyTxt;
    if (bt?.visible && bt.text) { const r = bt.getBounds(); boxes.push({ l: r.left, t: r.top, r: r.right, b: r.bottom }); }
    for (const q of boxes) if (x - w / 2 < q.r + 4 && x + w / 2 > q.l && y + 11 > q.t && y - 11 < q.b) return Math.max(x, q.r + 4 + w / 2, ax + 22 + w / 2);
    return x;
  }

  private overHudPanel(x: number, y: number): boolean {
    const m = this.mini;
    if (m && x < m.x + m.w + 24 && y > m.y - 24 && y < m.y + m.h + 70) return true;
    const b = this.bountyTxt;
    // 浮字會往上飄約 50px → 板子下面 70px 內也算
    if (b?.visible && b.text) { const r = b.getBounds(); if (x < r.right + 24 && y > r.top - 24 && y < r.bottom + 70) return true; }
    return false;
  }

  /**
   * 光門（D-186）：
   * - 往下一張：這張圖有下一張、下一張已開放（＝這張的 Boss 打倒過）才放；巢穴中心往北 55% 半徑的空地。
   * - 回上一張：有上一張的地圖，在出生點南邊 2.5 格放一座（像從那邊走過來的路口）。
   * 每座門要等玩家先離開它 2 格才會觸發（剛換完地圖、站在上面讀檔不會一進場就被傳走）。
   */
  private setupGate(): void {
    if (this.bot || !this.tracked) return;
    const p = playerOf(this.s);
    const add = (to: string, at: [number, number] | null, back: boolean): void => {
      const m = worldMap(to);
      if (!m || !at || this.gates.some((q) => q.to === to)) return;
      const label = this.add.text(0, 0, back ? `▼ 回${m.name}` : `▲ 前往${m.name}`, { fontFamily: TITLE_FONT, fontSize: '24px', color: back ? '#ffe8c0' : '#d8f8ff', stroke: '#0a1a2a', strokeThickness: 5 }).setOrigin(0.5, 1).setDepth(46).setVisible(false);
      this.gates.push({ x: at[0], y: at[1], to, label, back, armed: Math.hypot(p.x - at[0], p.y - at[1]) > UNIT * 2 });
    };
    const nx = worldMap(this.stageId)?.next;
    const bz = STAGES[this.stageId]?.bossZone;
    if (nx && bz && mapOpen(nx)) add(nx, this.freeNear(bz.x, bz.y - bz.r * 0.55) ?? this.freeNear(bz.x, bz.y - bz.r * 0.3), false);
    const pv = prevMap(this.stageId);
    if (pv && !this.gates.some((q) => q.back)) {
      // 出生點南邊優先（像從那邊走過來的路口），太靠地圖邊或是石頭就換東／西／北；四周都要是空地（門不能半截卡在牆裡）
      const { x, y } = this.spawnAt;
      const sol = this.s.arena.solid;
      const ok = (px: number, py: number): boolean => px > UNIT * 1.5 && py > UNIT * 1.5 && px < this.s.arena.w - UNIT * 1.5 && py < this.s.arena.h - UNIT * 1.5
        && (!sol || [[0, 0], [UNIT * 0.6, 0], [-UNIT * 0.6, 0], [0, UNIT * 0.4], [0, -UNIT * 0.4]].every(([dx, dy]) => !isSolidAt(sol, px + dx!, py + dy!)));
      const spot = ([[0, 2.2], [2.4, 0], [-2.4, 0], [0, -2.4], [2, 2], [-2, 2]] as const).map(([dx, dy]) => [x + dx * UNIT, y + dy * UNIT] as [number, number]).find(([px, py]) => ok(px, py));
      add(pv.id, spot ?? null, true);
    }
  }

  /** 首次討伐後光門亮起：門的位置一圈光環＋火花（畫面外由 drawOffscreen 的青色箭頭指過去） */
  private revealGate(): void {
    this.gateWaits = '';
    this.setupGate();
    const gt = this.gates.find((q) => !q.back);
    if (!gt) return;
    gt.revealAt = this.time.now;
    const go = (): void => {
      if (!this.scene.isActive()) return;
      shockRing(this, this.sx(gt.x), this.sy(gt.y), 0x9fe8ff, 220, 900, 6);
      sparks(this, this.sx(gt.x), this.sy(gt.y) - 60 * this.k, 22, 'spark', 0xd8f8ff, 600);
    };
    // 第 85 輪（D-219）：360×640 門在主角北邊約 9 公尺、剛好在畫面外，以前亮起的光環畫在畫面外、玩家只看到一個箭頭
    // → 門在畫面外（而且不太遠）就把鏡頭帶過去看它亮、再回到主角；光環等鏡頭到了才放（特效是畫面座標）
    // 第 86 輪（D-220）：通關演出按「繼續冒險」回來時，身邊常常還有被 Boss 戰拖來的小怪在打你
    // → 交戰中不把鏡頭帶走（看不到自己在掉血），先只放音效＋箭頭，等身邊安靜了（最多 12 秒）再帶去看門
    const p = playerOf(this.s);
    if (this.gateOffView(gt) && Math.hypot(gt.x - p.x, gt.y - p.y) < UNIT * 18) {
      if (this.peekCalm()) {
        this.peekGate(gt, go);
        return;
      }
      SFX.itemGet();
      this.waitPeekGate(gt, go, this.time.now + 12000);
      return;
    }
    SFX.itemGet();
    go();
    this.time.delayedCall(450, go);
  }

  private gateOffView(gt: { x: number; y: number }): boolean {
    const cy = this.sy(gt.y);
    const cx = this.sx(gt.x);
    return cy < VIEW_TOP + 140 || cy > VIEW_BOTTOM - 200 || cx < 40 || cx > GAME_WIDTH - 40;
  }

  /** 身邊 9 格內沒有交戰中的敵人、沒有面板、主角活著 → 可以把鏡頭帶走一下 */
  private peekCalm(): boolean {
    const p = playerOf(this.s);
    return !p.dead && !this.menu && !peekBlocked(enemiesOf(this.s), p.x, p.y, UNIT * 9);
  }

  private peekGate(gt: { x: number; y: number }, go: () => void, sfx = true): void {
    this.camPeek = { x: gt.x, y: gt.y, at: this.time.now };
    this.time.delayedCall(PEEK_IN, () => { if (this.scene.isActive() && sfx) SFX.itemGet(); go(); });
    this.time.delayedCall(PEEK_IN + 450, go);
  }

  private waitPeekGate(gt: { x: number; y: number }, go: () => void, until: number): void {
    this.time.delayedCall(600, () => {
      if (!this.scene.isActive() || this.ended || !this.gates.includes(gt as never)) return;
      if (!this.gateOffView(gt)) { go(); return; } // 打一打自己走到看得到門的地方了：直接放光環
      const p = playerOf(this.s);
      if (Math.hypot(gt.x - p.x, gt.y - p.y) >= UNIT * 18) return; // 走遠了：交給箭頭
      if (this.peekCalm() && !this.camPeek) { this.peekGate(gt, go, false); return; }
      if (this.time.now < until) this.waitPeekGate(gt, go, until);
    });
  }

  private drawGate(g: Phaser.GameObjects.Graphics, now: number): void {
    // 第 63 輪：再挑戰 Boss 時往下一張圖的門就在巢穴裡，門上的字蓋在 Boss 身上 → Boss 交戰中先不寫（門照畫）
    const bossFight = this.gates.some((q) => !q.back) && enemiesOf(this.s).some((e) => ENEMIES[e.defId]?.boss && e.mode === 'combat');
    const shut = bossFight && this.bossEngaged();
    for (const gt of this.gates) {
      const sealed = shut && !gt.back; // D-218：交戰中門封住＝光暗下來、變灰
      const cx = this.sx(gt.x);
      const cy = this.sy(gt.y);
      const vis = !(cx < -120 || cx > GAME_WIDTH + 120 || cy < VIEW_TOP - 260 || cy > VIEW_BOTTOM + 120);
      if (!vis) {
        gt.label.setVisible(false);
        continue;
      }
      const k = this.k * (gt.back ? 1.7 : 2.2);
      drawGateArt(g, cx, cy, k, !!gt.back, sealed, now / 1000);
      // 字在石柱頂上；太靠上會壓到 HUD／Boss 血條（y 170 以內）就先不寫
      let ly = cy - 98 * k;
      // 第 55 輪：回程門就在出生點旁，門上的字常和畫面中間的「點怪物開打」字條疊在一起 → 字往上讓開
      const ct = this.calmText;
      if (ct?.visible && ct.text) {
        const top = ct.y - ct.height / 2;
        if (Math.abs(cx - ct.x) < (ct.width + gt.label.width) / 2 && ly > top - 16 && ly - gt.label.height < ct.y + ct.height / 2) ly = top - 16; // 第 62 輪：4 → 16，兩行字貼太近
      }
      // 第 58 輪：右下技能鍵蓋住門上的字（390×844 燼紅裂谷出生點的「▼ 回荊棘谷」）→ 字往左移到按鈕群外面
      let lx = cx;
      const lw = gt.label.width;
      const lh = gt.label.height;
      // 第 63 輪：往左讓開後可能又壓到已經檢查過的按鈕（荊棘谷 360×640 的「▼ 回霧語森林」被重斬蓋住）→ 重檢到沒有再移動
      for (let pass = 0, moved = true; moved && pass < 4; pass++) {
        moved = false;
        for (let i = 0; i < 7; i++) {
          const b = this.btnPos(i);
          const r = this.btnR(i) + 6;
          const nx = Phaser.Math.Clamp(b.x, lx - lw / 2, lx + lw / 2);
          const ny = Phaser.Math.Clamp(b.y, ly - lh, ly);
          if (Math.hypot(b.x - nx, b.y - ny) < r && b.x - r - lw / 2 < lx) {
            lx = b.x - r - lw / 2;
            moved = true;
          }
        }
      }
      lx = Math.max(lx, lw / 2 + 8);
      // 第 56 輪：幕名卡播放中、剛經光門抵達的 1.4 秒內先不寫，之後 0.5 秒淡入
      const from = Math.max(this.gateLabelFrom, this.chapterUntil);
      const la = Phaser.Math.Clamp((this.time.now - from) / 500, 0, 1);
      gt.label.setPosition(lx, ly).setAlpha(la).setVisible(!this.menu && ly - 30 > 170 && la > 0 && !(bossFight && !gt.back));
    }
  }

  /** Boss 交戰中、而且已經被打掉血（D-218：往前的光門封住）。只是從牠旁邊跑過去（滿血）門照常能走——巢穴是死路、Boss 重生後光門在牠背後 */
  private bossEngaged(): boolean {
    return gateSealed(enemiesOf(this.s).map((e) => ({ dead: e.dead, hp: e.hp, maxHp: e.maxHp, mode: e.mode, boss: !!ENEMIES[e.defId]?.boss })));
  }

  /** 第 93 輪（D-234）：巡邏精英交戰中被打掉血、在 12 格內（跨區不報地名用） */
  private eliteEngaged(): boolean {
    const p = playerOf(this.s);
    return eliteFighting(enemiesOf(this.s).map((e) => ({ dead: e.dead, hp: e.hp, maxHp: e.maxHp, mode: e.mode, elite: e.tier === 'elite', boss: !!ENEMIES[e.defId]?.boss, dist: Math.hypot(e.x - p.x, e.y - p.y) / UNIT })));
  }

  /** 走進光門（沒開面板）→ 存檔後換地圖。Boss 交戰中只要還沒開打（牠滿血）也可以走（和 ☰ 直接前往一樣，等於脫離戰鬥）；打掉血之後封住，免得追打／衝鋒踩到門被傳走（D-218） */

  private gateCheck(): void {
    if (!this.gates.length || this.menu || this.editing || this.ended) return;
    const p = playerOf(this.s);
    if (p.dead) return;
    for (const gt of this.gates) {
      const d = Math.hypot(p.x - gt.x, p.y - gt.y);
      // 第 84 輪（D-218）：再挑戰 Boss 時往前的門就在巢穴裡，追打／衝鋒／閃避踩到門會被傳走（暴怒戰白打）→ Boss 交戰中先封住，
      // 而且要先離門 2 格再回來才會觸發（不然 Boss 倒下那一刻站在門上就直接被傳走）
      if (!gt.back && this.bossEngaged()) {
        gt.armed = false;
        // 故意走進去想離開的人：講一句為什麼沒反應（10 秒一次，浮字不佔教學小字）
        if (d < UNIT * 0.9 && !this.bot && this.time.now > this.gateShutToldAt + 10000) {
          this.gateShutToldAt = this.time.now;
          floatNumber(this, this.sx(p.x), this.sy(p.y) - 120, 'Boss 戰中光門封住了・☰ 可直接前往', { color: '#bfd0e8', size: 22 });
        }
        continue;
      }
      if (!gt.armed) {
        if (d > UNIT * 2) gt.armed = true;
        continue;
      }
      if (d > UNIT * 0.9) continue;
      this.warpGate(gt); // 過場中 update 不再呼叫 gateCheck，門留著繼續畫
      return;
    }
  }

  /**
   * 走進光門的過場（第 55 輪）：以前是 0.26 秒閃白就直接換場景，像切 bug。
   * 現在 0.75 秒：戰鬥停住、門爆一圈光、主角往上化進光柱、整個畫面淡成青白，下一張圖從青白淡入。
   */
  private warpGate(gt: { x: number; y: number; to: string; back: boolean }): void {
    this.warpAt = this.time.now;
    SFX.itemGet();
    for (const z of this.zoneTexts) if (z.active) this.tweens.add({ targets: z, alpha: 0, duration: 160 });
    const col = gt.back ? 0xffd8a8 : 0x9fe8ff;
    const gx = this.sx(gt.x);
    const gy = this.sy(gt.y);
    shockRing(this, gx, gy, col, 260, 700, 8);
    sparks(this, gx, gy - 60 * this.k, 30, 'spark', 0xffffff, 700);
    const [r, g, b] = gt.back ? [255, 236, 210] : [215, 245, 255];
    this.time.delayedCall(180, () => this.cameras.main.fadeOut(520, r, g, b));
    this.persist();
    this.time.delayedCall(760, () => this.leave(() => this.scene.start('RtBattle', { stage: gt.to, bot: '', via: gt.back ? 'gateBack' : 'gate' })));
  }

  /** 過場中：主角往上飄、變細、淡掉（draw() 每幀會把精靈放回原位，所以畫完再改） */
  private warpPose(): void {
    const sp = this.sprites.get(playerOf(this.s).id);
    if (!sp) return;
    const k = Math.min(1, (this.time.now - this.warpAt) / 600);
    sp.y -= 70 * k * k;
    sp.setAlpha(1 - k * 0.9);
    sp.scaleX *= 1 - 0.6 * k;
  }

  /** 經光門抵達（第 56 輪）：主角從門上的光柱降下、由細變寬、淡入（warpPose 倒過來） */
  private arrivePose(): void {
    const k = (this.time.now - this.arriveAt) / 700;
    if (k >= 1 || k < 0) {
      this.arriveAt = -1;
      return;
    }
    const sp = this.sprites.get(playerOf(this.s).id);
    if (!sp) return;
    const r = 1 - k;
    sp.y -= 70 * r * r;
    sp.setAlpha(0.1 + 0.9 * k);
    sp.scaleX *= 0.4 + 0.6 * k;
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

  private drawUi(): void {
    const g = this.ui.clear();
    const s = this.s;
    const p = playerOf(s);
    drawMinimap(g, { mini: this.mini, s: this.s, now: this.time.now, stageId: this.stageId, ox: this.ox, oy: this.oy, k: this.k, viewTop: VIEW_TOP, viewBottom: VIEW_BOTTOM, gates: this.gates, memLeft: this.memLeft });
    // ☰ 上的小紅點：行囊裡有比身上好的裝備（D-093）
    if (this.tracked && (this.ptsLeft > 0 || this.bagSt.bag.some((x) => isUpgrade(this.bagSt, x)))) {
      g.fillStyle(0xff4a4a, 1).fillCircle(GAME_WIDTH - 22, 22, 9);
      g.lineStyle(2, 0xffffff, 0.9).strokeCircle(GAME_WIDTH - 22, 22, 9);
    }
    // 地圖怪關卡：附近沒有戰鬥中的怪時提示「點怪物開打」（D-073）
    const es = enemiesOf(s);
    const calm = !this.bot && es.length > 0 && !es.some((e) => e.mode === 'combat') && es.some((e) => e.mode === 'idle' || e.mode === 'dormant');
    // 線上版（第 147 輪）：等級／金幣／粉塵讀伺服器的角色（loot.claim 由伺服器擲，本機算的不準）；離線版建置時這段整個拿掉
    const oc = import.meta.env.VITE_SERVER_URL ? characterCache.get() : null;
    const lv = oc ? oc.level : s.prog?.level;
    const loot = s.loot
      ? {
          enh: s.enhance?.level ?? 0,
          coin: oc ? (oc.wallet.coin ?? 0) : this.coinBase >= 0 ? this.coinNow() : s.loot.gold ?? 0,
          dust: oc ? (oc.wallet.dust ?? 0) : this.coinBase >= 0 ? this.dustBase + Math.max(0, (s.loot.dust ?? 0) - this.saved.dust) : s.loot.dust ?? 0,
        }
      : undefined;
    this.hud.setText(hudLine({ ...(lv !== undefined ? { lv } : {}), hp: p.hp, maxHp: p.maxHp, mp: p.mp, ...(loot ? { loot } : {}), enemies: es.length, tick: s.tick }));
    if (this.goal) {
      const st = STAGES[this.stageId]!;
      const bossDef = st.enemies.map((e) => ENEMIES[e.enemyId]).find((d) => d?.boss);
      const done = !!bossDef && (s.bossKills ?? []).includes(bossDef.id);
      // 已討伐：第二行顯示「下一個目標」（每 2 秒或狀態改變才重算，避免每幀讀存檔）
      const big = !!worldMap(this.stageId);
      if (big && (this.goalDone !== done || this.time.now - this.goalAt > 2000)) {
        this.goalAt = this.time.now;
        const rec0 = loadRecord(this.stageId);
        this.goalBefore = (rec0.bossKills ?? 0) > 0;
        this.goalNext = nextGoal(this.stageId, loadRecord(this.stageId), s.prog?.level ?? 1, bossKillsOf(worldMap(this.stageId)?.next ?? ''), frontierAfter(this.stageId));
      }
      this.goalDone = done;
      // 第 57 輪：光門還沒亮（等抉擇／通關演出）時不寫下一個目標——通關那張圖的「▶ 前往星隕高原」會在演出前就爆雷
      // 以前打倒過、光門已經開著（第 55 輪）：舊玩家回來時目標字條也提光門，不只說「往北打狼王」
      const fwd = this.gates.find((q) => !q.back);
      this.gateAhead = fwd ? worldMap(fwd.to)?.name ?? '' : '';
      this.goal.setText(bossDef ? (done ? `✔ ${bossDef.name} 已討伐${this.gateWaits ? '' : big && this.goalNext ? `\n▶ ${this.goalNext}` : '・離開巢穴可再挑戰'}` : this.goalBefore && this.goalNext ? `${this.gateAhead ? `光門通往${this.gateAhead}・` : ''}${bossDef.name}可以再挑戰\n▶ ${this.goalNext}` : this.gateAhead ? `目標：打倒${bossDef.name}・光門通往${this.gateAhead}` : `目標：往北，打倒${bossDef.name}`) : '');
      textColor(this.goal, done ? '#9fe8a0' : '#ffd27a');
    }
    const fires = STAGES[this.stageId]?.campfires ?? [];
    const atFire = fires.some((c) => Math.hypot(c.x - p.x, c.y - p.y) <= CAMPFIRE_RULES.safeUnits * UNIT);
    // 第 97 輪（D-242）：老玩家低血走回營火的路上字條會一直閃 30 秒 → 每次低血只講 8 秒（新玩家照舊一直提醒）
    const lowHp = !atFire && p.hp * 2 < p.maxHp;
    if (!lowHp) this.lowHpAt = 0;
    else if (!this.lowHpAt) {
      this.lowHpAt = this.time.now;
      // 第 98 輪（D-245）：星隕高原撿星光碎片回血，血量在一半上下來回，每次跌破都重講 8 秒（200 秒裡 36 秒）→ 講過 45 秒內不重講
      if (this.time.now - this.lowTipAt >= LOW_HP_TIP_GAP_MS) this.lowTipAt = this.time.now;
    }
    const lowTip = lowHp && (!this.veteran || this.time.now - this.lowTipAt < LOW_HP_TIP_MS);
    const restTip = fires.length === 0 ? '' : atFire && (p.hp < p.maxHp || s.potions < playerDef(this.s).potion.carry) ? '點營火休息：HP 全滿・補藥水' : lowTip ? '打不過就退回營火（怪不追進來）' : '';
    // 第 56 輪：長螢幕（390×844）主角在畫面較下面，固定 y 850 的字條會蓋在主角頭上 → 至少在主角腳下 95
    if (calm) this.calmText.y = Phaser.Math.Clamp(this.sy(p.y) + 95, 850, VIEW_BOTTOM - 60);
    // 第 97 輪（D-244）：新玩家升到 Lv2（打倒幾隻狼）就學會點怪物開打了，不再一直閃「準備好就點怪物開打」
    const taught = this.veteran || (s.prog?.level ?? 1) >= CALM_TAUGHT_LV;
    const calmMsg = calm ? restTip || (taught ? (p.hp < p.maxHp ? '休息中・自動回血' : '') : p.hp < p.maxHp ? '休息中・自動回血　準備好就點怪物開打' : '點怪物開打（一次拉一組）') : '';
    // 第 63 輪：討伐大字期間不寫「打不過就退回營火」；第 67 輪：沒字就整條藏起（字條有底色）
    this.calmText.setVisible(!!calmMsg && !this.tipBusy && !this.hint && !this.menu?.active && this.time.now >= this.slainUntil).setText(calmMsg).setAlpha(0.75 + 0.25 * Math.sin(this.time.now / 300));
    // 第 71 輪：窄螢幕（360×640）字條右端「開打」壓到大招鍵 → 碰到任何按鈕就在全形空白處換成兩行
    if (calmMsg.includes('　') && this.calmText.visible) {
      const cb = this.calmText.getBounds();
      for (let i = 0; i <= 6; i++) {
        const b = this.btnPos(i);
        const r = this.btnR(i) + 6;
        if (b.x - r < cb.right && b.x + r > cb.left && b.y - r < cb.bottom && b.y + r > cb.top) {
          this.calmText.setText(calmMsg.replace('　', '\n')).setAlign('center');
          break;
        }
      }
    }
    // Boss 大血條（畫面上方）
    // 地圖怪關卡：Boss 交戰中才顯示（在遠處待機時不擋畫面）
    const boss = enemiesOf(s).find((e) => ENEMIES[e.defId]?.boss && (!STAGES[this.stageId]?.mapAi || e.mode === 'combat'));
    this.goal?.setVisible(!boss);
    if (this.bossTxt) {
      this.bossTxt.setVisible(!!boss && !this.menu?.active);
      // 第 73 輪：等級不夠的建議等級從攻略提示（三行，360×640 疊上別的提示會蓋住主角）搬到 Boss 血條字的後面，打的時候一直看得到
      const wmB = boss ? worldMap(this.stageId) : undefined;
      const lowLv = !!wmB && !boss?.fury && (this.s.prog?.level ?? 1) < wmB.bossLv ? `　建議 Lv${wmB.bossLv}` : '';
      if (boss) this.bossTxt.setText(`${boss.fury ? '暴怒的' : ''}${ENEMIES[boss.defId]?.name ?? ''}　${Math.max(1, Math.ceil((boss.hp / boss.maxHp) * 100))}%${lowLv}`);
      if (boss) textColor(this.bossTxt, boss.phase === 2 ? '#ffb09a' : '#ffd0e4');
    }
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
    this.joyBadge?.setPosition(this.JOY.x, Math.min(this.JOY.y + this.JOY.r + 8, GAME_HEIGHT - 28));
    this.discs.show(7, this.JOY.x, this.JOY.y, { r: this.JOY.r, fill: 0xffffff, fillA: 0.08, lw: 2, stroke: 0xffffff, strokeA: 0.3 });
    if (this.inp.stick) {
      g.fillStyle(0xffffff, 0.15).fillCircle(this.inp.stick.bx, this.inp.stick.by, this.JOY.r);
      g.fillStyle(0xffd27a, 0.7).fillCircle(this.inp.stick.bx + (this.inp.stick.dx / 1000) * 50, this.inp.stick.by + (this.inp.stick.dy / 1000) * 50, 34);
    }
    // 技能鍵（冷卻遮罩）
    const ids: string[] = [...this.ctl.order, 'dodge'];
    ids.forEach((id, i) => {
      const { x, y } = this.btnPos(i);
      const R = this.btnR(i);
      const cd = id === 'dodge' ? playerDef(this.s).dodge.cooldownTicks : skillDef(this.s, id)!.cooldownTicks;
      const left = Math.max(0, (p.ready[id] ?? 0) - s.tick);
      this.discs.show(i, x, y, { r: R, fill: i === 4 ? 0x2a4a6a : 0x3a2a14, fillA: 0.95, lw: 3, stroke: left ? 0x555566 : i === 4 ? 0x9fd8ff : 0xffd27a, strokeA: 1 });
      if (this.editing?.pick === i) g.lineStyle(5, 0x7dffb0, 0.6 + 0.4 * Math.sin(this.time.now / 120)).strokeCircle(x, y, R + 8);
      if (left > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / cd), false).fillPath();
      }
      // 冷卻中也留著招式名（第 45 輪：以前冷卻時只剩數字，新手打一陣子五顆鍵全是「4.8」「2.3」，記不住哪顆是哪招）
      const nm = i === 4 ? '閃避' : skillDef(this.s, id)!.name;
      const bt = this.btnText[i]!;
      bt.setText(left > 0 ? `${nm}\n${cdText(left)}` : nm);
      const bc = left > 0 ? '#a8a090' : '#ffffff';
      textColor(bt, bc);
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
      this.discs.show(5, x, y, { r: R, fill: ok ? 0x5a1a3a : 0x2a1420, fillA: 0.95, lw: 5, stroke: 0x333344, strokeA: 1 });
      g.lineStyle(5, ok ? 0xff7ad0 : 0xa0507a, 1);
      g.beginPath().arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.mp / need), false).strokePath();
      if (ok) g.lineStyle(3, 0xffd0f0, 0.4 + 0.4 * Math.sin(now / 120)).strokeCircle(x, y, R + 6 + 3 * Math.sin(now / 160));
      if (left > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / ult.cooldownTicks), false).fillPath();
      }
      this.btnText[5]!.setText(left > 0 ? cdText(left) : ok ? ultLabel(skillDef(s, 'blade_storm')!.name) : `MP\n${p.mp}/${need}`);
      textColor(this.btnText[5]!, ok ? '#ffffff' : '#c890b0');
    }
    // 藥水：剩餘數量＋冷卻；血少於 40% 時閃爍提醒
    {
      const { x, y } = this.btnPos(6);
      const R = this.btnR(6);
      const pt = playerDef(this.s).potion;
      const left = Math.max(0, (p.ready['potion'] ?? 0) - s.tick);
      const low = p.hp < p.maxHp * 0.4 && left === 0 && s.potions > 0;
      this.discs.show(6, x, y, { r: R, fill: 0x3a1414, fillA: 0.95, lw: 3, stroke: left || !s.potions ? 0x555566 : low && Math.floor(this.time.now / 250) % 2 ? 0xffffff : 0xff6a6a, strokeA: 1 });
      if (left > 0) {
        g.fillStyle(0x000000, 0.6);
        g.slice(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / pt.cooldownTicks), false).fillPath();
      }
      // 第 59 輪：冷卻中以前只剩一個數字「5」，看不出還剩幾瓶 → 秒數＋瓶數
      this.btnText[6]!.setText(left > 0 ? `${Math.ceil(left / TICKS_PER_SEC)} 秒\n×${s.potions}` : `藥水\n×${s.potions}`);
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
