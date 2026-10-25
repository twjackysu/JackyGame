// 即時戰鬥核心的型別（design/19 §2、D-063 P1）。純 TS、不依賴 Phaser。
// 座標一律是整數：1 遊戲單位 = 100（design/19 §2.1）；時間一律是 tick（30 ticks/秒）。

export const TICKS_PER_SEC = 30;
export const UNIT = 100;
/** 秒 → tick（四捨五入） */
export const sec = (s: number): number => Math.round(s * TICKS_PER_SEC);
/** 遊戲單位 → 整數座標 */
export const u = (n: number): number => Math.round(n * UNIT);

/** 判定形狀（以施放者位置為原點、施放方向為前方；尺寸是整數座標） */
export type Shape =
  | { type: 'circle'; r: number }
  | { type: 'sector'; r: number; deg: number }
  | { type: 'line'; len: number; width: number }
  | { type: 'ring'; rIn: number; rOut: number };

export type StatusId = 'break' | 'slow' | 'stun' | 'atkUp' | 'burn' | 'poison' | 'freeze' | 'weak' | 'shield';

/** 狀態規則（design/19 §2.10）：疊層上限；持續傷害每 30 ticks 結算一次 */
export const STATUS_RULES: Record<StatusId, { maxStacks: number; dot?: boolean }> = {
  break: { maxStacks: 1 }, slow: { maxStacks: 1 }, stun: { maxStacks: 1 }, atkUp: { maxStacks: 1 },
  burn: { maxStacks: 3, dot: true }, poison: { maxStacks: 5, dot: true },
  freeze: { maxStacks: 1 }, weak: { maxStacks: 1 }, shield: { maxStacks: 1 },
};

export interface StatusApply {
  id: StatusId;
  ticks: number;
  /** 持續傷害：每秒每層的傷害（施放者攻擊力 %）；護盾：吸收量（施放者攻擊力 %） */
  powerPct?: number;
}

/** 技能的一次命中（相對施放開始的 tick） */
export interface SkillHit {
  atTick: number;
  shape: Shape;
  /** 倍率（%） */
  mult: number;
  status?: StatusApply;
  /** 同一次施放中，同一個敵人最多被這一段打一次（衝鋒用） */
  oncePerTarget?: boolean;
}

/**
 * 技能定義（資料驅動；引擎不寫 switch(skillId)）。
 * 冷卻從施放開始計（design/20 A1）；同時只能一個主動技能；閃避可取消（不退冷卻）。
 */
export interface SkillDefinition {
  id: string;
  name: string;
  cooldownTicks: number;
  castTicks: number;
  /** 施放期間可移動的速度比例（0 ＝ 定在原地；旋風斬 0.7） */
  moveFactor: number;
  hits: SkillHit[];
  /** 位移：在 [fromTick, fromTick+ticks) 之間沿施放方向前進 distance（不穿牆） */
  dash?: { fromTick: number; ticks: number; distance: number };
  /** 格擋：施放後 [0, windowTicks] 內被「可格擋」攻擊命中 → 傷害 −reducePct% 並立即打出 counter */
  block?: { windowTicks: number; reducePct: number; counter: SkillHit };
  /** 大招才耗 MP（D-063） */
  mp?: number;
  /** 自動施放（AUTO）時的用途提示 */
  role: 'single' | 'aoe' | 'gap' | 'block' | 'ult';
  /** 施放前要多近（整數座標；沒有＝不限） */
  useRange?: number;
}

/** 敵人的範圍攻擊（預告出現時位置與方向即固定；design/19 §2.6） */
export interface AreaAttack {
  id: string;
  shape: Shape;
  warningTicks: number;
  /** 命中後收招的 tick 數 */
  recoverTicks: number;
  /** 倍率（%） */
  damageMultiplier: number;
  cooldownTicks: number;
  /** 目標在這個距離內才會出這招 */
  triggerRange: number;
  /** 可被格擋反擊擋下（地面火焰、環形震波不行） */
  blockable: boolean;
  /** 衝鋒：預告後沿直線衝 len，期間碰到就算命中；撞牆暈眩 */
  charge?: { ticks: number; wallStunTicks: number };
  status?: StatusApply;
  /** 只有第二階段才用 */
  phase2Only?: boolean;
  /** 權重（同時可用時挑選） */
  weight: number;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  /** 移動速度（遊戲單位/秒） */
  speed: number;
  radius: number;
  attacks: AreaAttack[];
  /** 掉落（只在開 loot 的關卡生效）：金幣範圍＋各種東西的機率（%）與數量 */
  drops?: { gold: [number, number]; items?: { id: LootId; chance: number; count?: [number, number] }[] };
  boss?: {
    /** HP 比例 ≤ 此值進入第二階段（%） */
    phase2AtPct: number;
    /** 第二階段攻擊冷卻倍率（攻速 +15% → 0.87） */
    phase2CooldownPct: number;
    summon?: { enemyId: string; count: number; everyTicks: number };
  };
  /** 受擊硬直（小怪 0.1～0.2s；Boss 0） */
  hitstunTicks: number;
}

export interface PlayerDefinition {
  id: string;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  radius: number;
  attackIntervalTicks: number;
  attackRange: number;
  attackWindupTicks: number;
  attackRecoverTicks: number;
  critRate: number;
  critDmg: number;
  /** MP 上限（D-065 ②：100） */
  mp: number;
  /** 開場 MP（之後接地圖時改成延續上一場） */
  mpStart: number;
  /** MP 回復（D-065 ②）：每次造成直接傷害／受到傷害／格擋成功 */
  mpGain: { deal: number; hurt: number; block: number };
  /** HP 藥水（design/20 B：30% 最大 HP、冷卻 15 秒、攜帶 20、獨立按鍵；瞬間生效、不打斷動作） */
  potion: { healPct: number; cooldownTicks: number; carry: number };
  skills: string[];
  dodge: { distance: number; ticks: number; invulnFrom: number; invulnTo: number; cooldownTicks: number };
}

export interface Status {
  id: StatusId;
  until: number;
  stacks: number;
  /** 持續傷害：每層每秒的傷害；護盾：剩餘吸收量 */
  value: number;
  srcId: number;
  /** 下一次持續傷害結算的 tick */
  next: number;
}

export type ActionKind = 'attack' | 'skill' | 'dodge' | 'enemyAttack' | 'charge';

export interface Action {
  kind: ActionKind;
  id: string;
  start: number;
  end: number;
  /** 施放方向（單位向量 ×1000 的整數） */
  dirX: number;
  dirY: number;
  /** 預告固定的原點 */
  ox: number;
  oy: number;
  /** 衝鋒／技能內已命中過的對象 */
  hitIds?: number[];
  /** 格擋已觸發 */
  blocked?: boolean;
  targetId?: number;
}

export interface Unit {
  id: number;
  side: 'player' | 'enemy';
  defId: string;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speedPerTick: number;
  dead: boolean;
  facingX: number;
  facingY: number;
  action: Action | null;
  statuses: Status[];
  /** 技能 id → 可再施放的 tick */
  ready: Record<string, number>;
  nextAttackTick: number;
  invulnUntil: number;
  hitstunUntil: number;
  hitstunImmuneUntil: number;
  targetId: number | null;
  phase: 1 | 2;
  nextSummonTick: number;
  mp: number;
  /** 地圖怪（D-072）；undefined＝一般戰鬥行為 */
  /** dormant＝離玩家太遠的待機怪，整個不跑 AI、不參與分離（design/20 B1） */
  mode?: 'dormant' | 'idle' | 'combat' | 'returning';
  /** Boss 召喚出來的（召喚者 id）；Boss 重置時一起消失 */
  summonedBy?: number;
  /** 由哪個重生點生出來的（SpawnGroup，design/20 B1） */
  groupId?: string;
  /** 固定敵人在 StageDefinition.enemies 的索引（Boss 再挑戰重生用） */
  fixedIdx?: number;
  /** 進入戰鬥的 tick（同時追擊上限的排隊順序：先醒的先打） */
  aggroTick?: number;
  tier?: AggroTier;
  homeX?: number;
  homeY?: number;
  /** 最後一次「在仇恨範圍內或有交手」的 tick */
  engagedTick?: number;
}

export type AggroTier = 'normal' | 'elite' | 'boss';
/** design/20 B1：仇恨半徑、最大追擊（距原位，單位）、脫戰等待（秒） */
export const AGGRO_RULES: Record<AggroTier, { aggro: number; chase: number; waitSec: number }> = {
  normal: { aggro: 5, chase: 12, waitSec: 3 },
  elite: { aggro: 7, chase: 16, waitSec: 5 },
  boss: { aggro: 10, chase: 40, waitSec: 8 },
};

/**
 * 地圖怪的效能與公平上限（design/20 B1）：
 * - 同時追擊玩家最多 8 隻，多出來的在外圈等（先醒的先打），有空位才補上。
 * - 離玩家超過 24 單位（約可視範圍高度 12 單位的 2 倍）的待機怪進入沉睡，完全不跑 AI。
 */
export const MAP_AI_LIMITS = { maxChasers: 8, dormantUnits: 24, queueHoldUnits: 6, dormantCheckEvery: 10 } as const;

export interface Telegraph {
  ownerId: number;
  attackId: string;
  shape: Shape;
  ox: number;
  oy: number;
  dirX: number;
  dirY: number;
  /** 命中的 tick */
  hitTick: number;
  startTick: number;
  blockable: boolean;
}

export type BattleEvent =
  | { tick: number; type: 'damage'; src: number; dst: number; amount: number; crit: boolean; origin: 'normal' | 'skill' | 'counter' | 'enemy' | 'dot'; skill: string; absorbed?: number }
  | { tick: number; type: 'death'; id: number }
  | { tick: number; type: 'respawn'; id: number; group: string }
  | { tick: number; type: 'hiddenElite'; id: number }
  | { tick: number; type: 'riot'; count: number; elite: boolean; x: number; y: number }
  | { tick: number; type: 'chest'; chest: string; loot: Partial<Record<LootId, number>> }
  | { tick: number; type: 'rest'; id: number; campfire: string }
  | { tick: number; type: 'drop'; item: number; kind: LootId; amount: number; rarity?: 1 | 2 | 3 }
  | { tick: number; type: 'pickup'; item: number; kind: LootId; amount: number; rarity?: 1 | 2 | 3 }
  | { tick: number; type: 'enhance'; level: number; atk: number }
  | { tick: number; type: 'levelUp'; level: number; maxHp: number; atk: number }
  | { tick: number; type: 'ramp'; minute: number; pct: number }
  /** 單位直接移除（Boss 重置時召喚物消失） */
  | { tick: number; type: 'despawn'; id: number }
  | { tick: number; type: 'revive'; id: number; campfire: string }
  | { tick: number; type: 'telegraph'; owner: number; attack: string }
  | { tick: number; type: 'dodge'; id: number }
  | { tick: number; type: 'dodged'; id: number; attack: string }
  | { tick: number; type: 'block'; id: number; attack: string }
  | { tick: number; type: 'cast'; id: number; skill: string }
  | { tick: number; type: 'phase2'; id: number }
  | { tick: number; type: 'summon'; id: number; count: number }
  | { tick: number; type: 'wallStun'; id: number }
  | { tick: number; type: 'potion'; id: number; heal: number; left: number }
  /** 地圖怪（D-072）：發現玩家進入戰鬥／脫戰返回／回到原位回滿 */
  | { tick: number; type: 'aggro'; id: number }
  | { tick: number; type: 'leash'; id: number }
  | { tick: number; type: 'reset'; id: number }
  /** 自然恢復（D-073）：脫戰 5 秒後每秒回 2% */
  | { tick: number; type: 'regen'; id: number; heal: number };

/** 玩家（或 Bot）的輸入：一個 tick 可以送多個 */
export type BattleCommand =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'stop' }
  | { type: 'skill'; id: string }
  | { type: 'dodge'; dx: number; dy: number }
  | { type: 'target'; id: number }
  | { type: 'potion' }
  /** 點地移動（D-071）：A* 走到該點；搖桿一動或點敵人就取消 */
  | { type: 'moveTo'; x: number; y: number }
  /** 在營火旁休息（design/20 B4）：HP 全滿、補藥水、設復活點；附近有戰鬥中的怪時無效 */
  | { type: 'rest' };

export interface Arena {
  /** 可走範圍（整數座標，0..w、0..h），邊界即牆 */
  w: number;
  h: number;
  /**
   * 障礙物格（design/21 §3 第 1 步，可選）：每格邊長 `cell`（整數座標），`rows[y][x] === '#'` 不可通行。
   * 單位會被推出障礙物並沿邊滑動；衝鋒撞到障礙物也算撞牆。
   */
  solid?: { cell: number; rows: readonly string[] };
}

/**
 * 重生點（design/20 B1、design/21 §2）：在 (cx, cy) 半徑 spawnRadius 內維持 maxAlive 隻 enemyId；
 * 死掉後 respawnTicks 才補一隻（玩家太近時延後，不會在眼前憑空冒出來）。respawnTicks 為 0＝不重生（Boss）。
 */
export interface SpawnGroup {
  id: string;
  enemyId: string;
  cx: number;
  cy: number;
  spawnRadius: number;
  maxAlive: number;
  respawnTicks: number;
  tier?: AggroTier;
  /** 區域難度：這組怪 HP／攻擊 +這麼多 %（深處比入口強；可與 rampPctPerMin 相加）。沒設＝0 */
  hpPct?: number;
  atkPct?: number;
  /** 區域獎勵：這組怪掉的金幣與粉塵數量 +這麼多 %（不多抽亂數，掉不掉照舊）。沒設＝0 */
  lootPct?: number;
}
/** 營火（design/20 B4）：怪不追進安全範圍（追進來就脫戰回家）、休息回滿、死亡在最後休息的營火復活 */
export interface Campfire {
  id: string;
  x: number;
  y: number;
}
export const CAMPFIRE_RULES = { safeUnits: 4, restUnits: 1.8, reviveInvulnTicks: 3 * 30 } as const;

/** 隱藏寶箱（design/20 C2「遊戲記憶」1）：走近 CHEST_RULES.openUnits 自動打開，內容直接入帳（需要 loot） */
export interface Chest {
  id: string;
  x: number;
  y: number;
  loot: Partial<Record<LootId, number>>;
}
/** openUnits：打開距離；hintUnits：畫面開始淡淡顯示、提示「有點熟悉」的距離（核心不讀） */
export const CHEST_RULES = { openUnits: 1.3, hintUnits: 6 } as const;

/** 地面掉落（design/20 B5 的最小版本）：金幣、強化粉塵、強化結晶、HP 藥水 */
export type LootId = 'gold' | 'dust' | 'crystal' | 'potion' | 'gear';
export interface GroundItem {
  id: number;
  kind: LootId;
  amount: number;
  x: number;
  y: number;
  /** 掉下來的 tick（0.3 秒後才能撿，看得到掉落） */
  tick: number;
  /** 裝備（kind 'gear'）：稀有度；amount＝物品等級 */
  rarity?: 1 | 2 | 3;
}
/** 自動撿取半徑 2.5 單位（design/20 B5）；地上放 120 秒消失 */
export const LOOT_RULES = { pickupUnits: 2.5, pickupDelayTicks: 9, expireTicks: 120 * 30 } as const;

/** 重生時玩家離重生點至少這麼遠（單位）；不夠遠就每秒再檢查一次 */
export const RESPAWN_MIN_PLAYER_UNITS = 9;

export interface StageDefinition {
  id: string;
  name: string;
  arena: Arena;
  player: { x: number; y: number };
  /** 固定敵人；hpPct／atkPct＝這隻 HP／攻擊 +%（地圖上的 Boss 想比試玩關耐打時用，不必改 ENEMIES） */
  enemies: { enemyId: string; x: number; y: number; tier?: AggroTier; hpPct?: number; atkPct?: number }[];
  /**
   * 地圖怪行為（D-072，design/20 B1）：敵人一開始待機，玩家進入仇恨半徑（且看得到）才進戰鬥，
   * 追太遠或太久沒交手就返回原位回滿。沒設＝舊行為（一開場全部衝過來）。
   */
  mapAi?: boolean;
  /**
   * Boss 區域（需要 mapAi，design/21 §2）：玩家離開這個圓（世界座標）Boss 就脫戰回家，
   * 回到原位時整場重置（回滿、回第一階段、召喚物消失）。倒下在營火醒來也會重置。
   * respawnTicks：Boss 被打倒後至少過這麼久、而且玩家在區域外，Boss 就回到巢穴（離開再進來可再挑戰；design/20 B2）。沒設＝不重生。
   */
  bossZone?: { x: number; y: number; r: number; respawnTicks?: number };
  /** 開啟地面掉落與自動撿取（用獨立亂數，不影響戰鬥結果） */
  loot?: boolean;
  /**
   * 試玩用的「撿材料就變強」（需要 loot）：每撿 dustPerLevel 粉塵（結晶算 5 個）武器自動強化 +1，
   * 每級攻擊 +atkPctPerLevel%，最多 maxLevel。只在這一場有效，不碰主線存檔。
   */
  lootEnhance?: { dustPerLevel: number; maxLevel: number; atkPctPerLevel: number };
  /**
   * 經驗值與等級（P4，D-090）：打倒怪物得經驗（`xp[enemyId]`，重生點的 hpPct 加成也加在經驗上；召喚物不給），
   * 升級立刻生效：最大 HP、攻擊各 +每級 %（HP 同時補上增加的量）。等級與經驗由 BattleSetup 帶入、畫面層存檔。
   */
  progression?: { xp: Record<string, number>; maxLevel: number; hpPctPerLevel: number; atkPctPerLevel: number };
  /**
   * 裝備掉落（P4-2，D-091；需要 loot）：怪物 id → 機率 %（乘上掉落加成）、物品等級（重生點每 +25% HP 再 +1）、
   * 稀有度權重 [普通, 精良, 稀有]、掉幾次。撿到記在 `BattleState.gearGot`，實際數值由 `gear.ts` 用種子產生。
   */
  gearDrops?: Record<string, { chance: number; ilvl: number; rarity: [number, number, number]; count?: number; /** 這場第一次打倒時第一件保底稀有（Boss 用） */ firstRare?: boolean }>;
  /** 刷怪關的壓力曲線：每過 1 分鐘，之後重生的怪 HP 與攻擊 +這麼多 %（每分鐘發一次 ramp 事件） */
  rampPctPerMin?: number;
  /**
   * 狼群暴動（design/20 B2 地圖事件，需要 mapAi）：每隔 everyTicks（範圍內隨機）在玩家周圍約 10 單位外冒出一群醒著的怪，
   * eliteChance% 機率混一隻精英；掉落 +lootPct%；追丟了就散去（不留在地圖上）。玩家在營火或 Boss 區域內時延後。
   */
  riot?: { everyTicks: [number, number]; count: [number, number]; enemyId: string; eliteId?: string; eliteChance?: number; hpPct?: number; lootPct?: number };
  /**
   * 隱藏精英（design/20 C2-3「知道出現條件就能主動觸發」）：不倒下連續打倒 streak 隻普通怪 → 附近冒出一隻醒著的精英
   * （hpPct 加成、掉落 +lootPct%）；打倒或倒下後重新計數。玩家在營火或 Boss 區域內時等出來再生。
   */
  hiddenElite?: { streak: number; enemyId: string; hpPct?: number; atkPct?: number; lootPct?: number };
  /** 隱藏寶箱（需要 loot） */
  chests?: Chest[];
  /** 營火（需要 mapAi） */
  campfires?: Campfire[];
  /** 倒下時在營火復活（不掉裝、不扣經驗；design/20 B4），不算失敗；沒設＝倒下就失敗 */
  reviveAtCampfire?: boolean;
  /** 重生點（需要 mapAi）；有可重生的重生點時不會因清空而勝利（刷怪地圖），由時間或出口結束 */
  spawnGroups?: SpawnGroup[];
  /** 自然恢復（D-073，D-065：脫戰 5 秒後每秒 2%）；預設跟 mapAi 一樣 */
  regen?: boolean;
  /** 超過這麼多 tick 算失敗（防無限戰鬥） */
  timeLimitTicks: number;
  /** 畫面設定（核心不讀）：畫面橫向看得到幾個世界單位；沒設＝1050（約 10.5 格，D-067） */
  viewUnits?: number;
  /** 畫面設定（核心不讀）：開場大字說明；沒設＝刷怪關用預設的「怪物會重生…」 */
  intro?: string;
  /** 畫面設定（核心不讀）：地區（世界座標矩形）；玩家走進新地區時畫面顯示地區名稱 */
  zones?: StageZone[];
}

export interface StageZone {
  name: string;
  /** 畫面設定：地區名稱下方的小字提示（例如「危險：狼群首領出沒」）；danger＝用紅色 */
  hint?: string;
  danger?: boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BattleState {
  tick: number;
  rngState: number;
  units: Unit[];
  telegraphs: Telegraph[];
  events: BattleEvent[];
  nextId: number;
  arena: Arena;
  stageId: string;
  /** 'running' | 勝 | 敗 | 超時 */
  outcome: 'running' | 'victory' | 'defeat' | 'timeout';
  timeLimitTicks: number;
  /** 玩家這個 tick 有沒有手動移動（有就暫停自動追擊；design/19 方案 A） */
  manualMove: { dx: number; dy: number } | null;
  /** 點地移動的目的地（D-071）；null＝沒有 */
  moveGoal?: { x: number; y: number; until: number } | null;
  /** 玩家最後一次受傷或出手的 tick（自然恢復用，D-073） */
  lastCombatTick?: number;
  /** 剩餘 HP 藥水 */
  potions: number;
  /** 最後休息的營火（復活點）；沒有＝第一個營火 */
  campfireId?: string;
  /** 掉落用的獨立亂數狀態（不動 rngState，開不開掉落戰鬥結果都一樣） */
  lootRng?: number;
  /** 地上的掉落物 */
  ground?: GroundItem[];
  /** 掉落物流水號 */
  lootSeq?: number;
  /** 裝備帶來的技能修正（D-094）：技能 id → 冷卻 −%、傷害 +%；沒有＝不變 */
  skillMods?: Record<string, { cdPct?: number; dmgPct?: number }>;
  /** 等級與經驗（progression）；base＝等級與強化加成前的數值 */
  prog?: { level: number; xp: number; baseHp: number; baseAtk: number };
  /** 這場的武器強化等級（lootEnhance）與強化前的攻擊力 */
  enhance?: { level: number; baseAtk: number };
  /** 這場撿到的裝備（掉落物 id、稀有度、物品等級）；畫面層用種子產生實際數值 */
  gearGot?: { id: number; rarity: 1 | 2 | 3; ilvl: number }[];
  /** 這場撿到的東西 */
  loot?: Partial<Record<LootId, number>>;
  /** 這場打倒過的 Boss（defId，首殺劇情旗標用） */
  bossKills?: string[];
  /** 隱藏精英的連殺計數（hiddenElite） */
  streak?: number;
  /** 下一次狼群暴動的 tick（riot；第一個 tick 排定） */
  riotAt?: number;
  /** 打開過的寶箱 id */
  chestsOpened?: string[];
  /** 在營火復活的次數 */
  revives?: number;
  /** Boss 再挑戰（bossZone.respawnTicks）：倒下的固定 Boss 索引與最早可重生的 tick；玩家在巢穴外才生 */
  bossRespawn?: { idx: number; at: number };
  /** 重生排程：重生點 id → 到期 tick（遞增排序） */
  respawnAt?: Record<string, number[]>;
}
