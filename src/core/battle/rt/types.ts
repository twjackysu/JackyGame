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
  role: 'single' | 'aoe' | 'gap' | 'block';
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
  mp: number;
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
}

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
  | { tick: number; type: 'telegraph'; owner: number; attack: string }
  | { tick: number; type: 'dodge'; id: number }
  | { tick: number; type: 'dodged'; id: number; attack: string }
  | { tick: number; type: 'block'; id: number; attack: string }
  | { tick: number; type: 'cast'; id: number; skill: string }
  | { tick: number; type: 'phase2'; id: number }
  | { tick: number; type: 'summon'; id: number; count: number }
  | { tick: number; type: 'wallStun'; id: number };

/** 玩家（或 Bot）的輸入：一個 tick 可以送多個 */
export type BattleCommand =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'stop' }
  | { type: 'skill'; id: string }
  | { type: 'dodge'; dx: number; dy: number }
  | { type: 'target'; id: number };

export interface Arena {
  /** 可走範圍（整數座標，0..w、0..h），邊界即牆 */
  w: number;
  h: number;
}

export interface StageDefinition {
  id: string;
  name: string;
  arena: Arena;
  player: { x: number; y: number };
  enemies: { enemyId: string; x: number; y: number }[];
  /** 超過這麼多 tick 算失敗（防無限戰鬥） */
  timeLimitTicks: number;
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
}
