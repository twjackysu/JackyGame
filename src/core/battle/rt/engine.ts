// 即時戰鬥引擎（design/19 §2、D-063 P1）：固定 30 ticks/秒、整數座標、種子亂數、事件依 (tick, 處理順序, id) 固定排序。
// 不依賴 Phaser；畫面層只能送 BattleCommand、讀 BattleState。
import { AFFIX_ATTACKS, ARENA_CHARGE, DODGE_REFUND_PCT, ENEMIES, STAGES, WEAPONS, variantB } from './data';
import { autoPick, cleanAutoSkills } from './auto';
import { BLESS_RULES, EFFECT_IDS, EFFECTS, blessNeed, effectDef, mergeEffectMods, tryVariantId, type EffectBurst, type EffectDef } from './effects';
import { pvpCc, pvpDamage, pvpMaxHp } from './pvp';
import { HIDDEN_GROUP, killXp, RIOT_GROUP, rollEnemyLoot, type LootContext } from './loot';
import type { Action, AreaAttack, EliteAffix, BattleCommand, BattleEvent, BattleState, EnemyDefinition, GroundItem, LootId, PlayerCtl, PlayerDefinition, Shape, SkillDefinition, SkillHit, SkillMod, SpawnGroup, StageDefinition, StageHazard, StageVent, StatusApply, StatusId, Unit } from './types';
import { AGGRO_RULES, aggroUnitsOf, CAMPFIRE_RULES, CHEST_RULES, GUARD_PCT_PER_POINT, ELITE_AFFIX_IDS, ELITE_AFFIXES, LOOT_RULES, MAP_AI_LIMITS, RESPAWN_MIN_PLAYER_UNITS, SKILL_MOD_CAPS, STATUS_RULES, TICKS_PER_SEC, UNIT } from './types';
import { cellIndex, clearLine, flowField, gridOf, nextWaypoint } from './path';
import { cosStep, evenStep, inSectorAngle, randStep, sinStep, xpCurve } from '../../fixedMath';

// ---------------- 亂數（xorshift32，狀態存在 BattleState，可序列化） ----------------
export function nextRand(s: BattleState): number {
  let x = s.rngState | 0 || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rngState = x >>> 0;
  return (x >>> 0) / 4294967296;
}

/** 掉落專用亂數（獨立狀態，不動戰鬥的 rngState） */
function lootRand(s: BattleState): number {
  let x = (s.lootRng ?? 0) | 0 || 0x85ebca6b;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.lootRng = x >>> 0;
  return (x >>> 0) / 4294967296;
}

// ---------------- 幾何 ----------------
const DIR = 1000;
function norm(dx: number, dy: number): [number, number] {
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return [0, DIR];
  return [Math.round((dx / d) * DIR), Math.round((dy / d) * DIR)];
}
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);

/** 點（半徑 pr）是否在形狀內；原點 (ox,oy)、方向 (dirX,dirY)（×1000） */
export function inShape(sh: Shape, ox: number, oy: number, dirX: number, dirY: number, px: number, py: number, pr: number): boolean {
  const vx = px - ox;
  const vy = py - oy;
  const d = Math.sqrt(vx * vx + vy * vy);
  const fx = dirX / DIR;
  const fy = dirY / DIR;
  switch (sh.type) {
    case 'circle':
      return d <= sh.r + pr;
    case 'ring':
      return d + pr >= sh.rIn && d - pr <= sh.rOut;
    case 'sector': {
      if (d > sh.r + pr) return false;
      if (d <= pr) return true;
      // 把目標半徑換算成角度寬容（貼邊也算中）；不用反三角函式（D-280）
      return inSectorAngle(vx, vy, d, fx, fy, sh.deg, pr);
    }
    case 'line': {
      const t = vx * fx + vy * fy;
      if (t < -pr || t > sh.len + pr) return false;
      const perp = Math.abs(vx * fy - vy * fx);
      return perp <= sh.width / 2 + pr;
    }
  }
}

// ---------------- 建立 ----------------
const speedPerTick = (speed: number): number => Math.round((speed * UNIT) / TICKS_PER_SEC);

function makeEnemy(s: BattleState, def: EnemyDefinition, x: number, y: number): Unit {
  return {
    id: s.nextId++, side: 'enemy', defId: def.id, x, y, r: def.radius, hp: def.hp, maxHp: def.hp, atk: def.atk, def: def.def,
    speedPerTick: speedPerTick(def.speed), dead: false, facingX: 0, facingY: DIR, action: null, statuses: [], ready: {},
    nextAttackTick: 0, invulnUntil: -1, hitstunUntil: -1, hitstunImmuneUntil: -1, targetId: null, phase: 1,
    nextSummonTick: Number.MAX_SAFE_INTEGER, mp: 0,
  };
}

export interface BattleSetup {
  stageId: string;
  seed: number;
  player?: PlayerDefinition;
  /** 裝備等加成（之後由裝備系統提供） */
  bonus?: { hp?: number; atk?: number; def?: number; critRate?: number };
  /** 攜帶的藥水數（預設 PlayerDefinition.potion.carry；之後由背包提供） */
  potions?: number;
  /** 裝備的技能修正（D-094） */
  skillMods?: Record<string, SkillMod>;
  /** 技能變化（D-112）：改用 SKILL_VARIANTS 版本的技能 id */
  skillVariants?: string[];
  /** 武器（D-147／152）：'bow'＝長弓、'staff'＝法杖；沒有＝劍士 */
  weapon?: 'bow' | 'staff';
  /** 自動施放的技能欄（P1，D-342）；沒有＝全部手動（測試、Bot、PvP 都不給） */
  autoSkills?: readonly string[];
  /** 深夜模式（需要 StageDefinition.night，D-103） */
  night?: boolean;
  /** 燼火祝福（P2，D-343；需要 StageDefinition.bless）。沒給＝沒有祝福（測試、Bot、PvP 預設都不給） */
  bless?: boolean;
  /**
   * 裝備上的獨特效果 id（P3，D-354；效果池 effects.ts）：這場永久擁有，和祝福用同一套結算。
   * 不認得的 id 會被丟掉；競技場不給（獨特效果在 PvP 不生效）。
   */
  effects?: readonly string[];
  /** 等級與目前經驗（需要 StageDefinition.progression；預設 1／0） */
  level?: number;
  xp?: number;
}

/**
 * 從 level 升到 level+1 需要的經驗（D-090：Lv10 累計約 1 萬）。
 * 第一次升級特別快（D-165：60→40＝約 8 隻狼，新玩家約 1 分多鐘就看到第一次升級與技能點）
 */
export function xpToNext(level: number): number {
  if (level <= 1) return 40;
  return xpCurve(level);
}

export function createBattle(setup: BattleSetup): BattleState {
  const stage = STAGES[setup.stageId];
  if (!stage) throw new Error(`unknown stage ${setup.stageId}`);
  const pd = setup.player ?? WEAPONS[setup.weapon ?? 'sword'].player;
  const s: BattleState = {
    tick: 0, rngState: (setup.seed >>> 0) || 1, units: [], telegraphs: [], events: [], nextId: 1, arena: stage.arena,
    stageId: stage.id, outcome: 'running', timeLimitTicks: stage.timeLimitTicks, manualMove: null,
    potions: setup.potions ?? pd.potion.carry,
  };
  // 打散初始種子
  for (let i = 0; i < 4; i++) nextRand(s);
  if (setup.weapon) s.weapon = setup.weapon; // D-147／152
  if (stage.loot) {
    s.lootRng = ((setup.seed ^ 0x5bd1e995) >>> 0) || 1;
    s.ground = [];
    s.loot = {};
    s.lootSeq = 0;
  }
  const b = setup.bonus ?? {};
  s.units.push({
    id: s.nextId++, side: 'player', defId: pd.id, x: stage.player.x, y: stage.player.y, r: pd.radius,
    hp: pd.hp + (b.hp ?? 0), maxHp: pd.hp + (b.hp ?? 0), atk: pd.atk + (b.atk ?? 0), def: pd.def + (b.def ?? 0),
    speedPerTick: speedPerTick(pd.speed), dead: false, facingX: 0, facingY: -DIR, action: null, statuses: [], ready: {},
    nextAttackTick: 0, invulnUntil: -1, hitstunUntil: -1, hitstunImmuneUntil: -1, targetId: null, phase: 1,
    nextSummonTick: Number.MAX_SAFE_INTEGER, mp: Math.min(pd.mp, pd.mpStart),
  });
  if (setup.skillMods && Object.keys(setup.skillMods).length) s.skillMods = setup.skillMods;
  setSkillVariants(s, setup.skillVariants ?? []);
  if (setup.autoSkills) setAutoSkills(s, setup.autoSkills);
  if (stage.progression) {
    const p = s.units[0]!;
    const lv = Math.max(1, Math.min(stage.progression.maxLevel, Math.floor(setup.level ?? 1)));
    s.prog = { level: lv, xp: Math.max(0, Math.floor(setup.xp ?? 0)), baseHp: p.maxHp, baseAtk: p.atk };
    applyLevel(s, p);
    p.hp = p.maxHp;
  }
  if (setup.night && stage.night) s.night = true;
  if (setup.bless && stage.bless) {
    s.bless = { rng: ((setup.seed ^ 0x2545f491) >>> 0) || 1, meter: 0, taken: [], rerolls: BLESS_RULES.rerolls };
    for (let i = 0; i < 8; i++) blessRand(s); // 打散初始種子（相鄰的種子第一手不會都一樣）
  }
  const perm = [...new Set(setup.effects ?? [])].filter((id) => !stage.pvp && Object.prototype.hasOwnProperty.call(EFFECTS, id));
  if (perm.length) {
    s.bless ??= { rng: 1, meter: 0, taken: [], rerolls: 0, off: true };
    s.bless.perm = perm;
    applyBless(s);
  }
  stage.enemies.forEach((_, i) => s.units.push(makeFixed(s, stage, i)));
  for (const g of stage.spawnGroups ?? []) {
    if (g.nightOnly && !s.night) continue;
    // 開場：等角度排在半徑 60% 的圓上（不用亂數，方便擺關卡）；石頭上的會被推出去
    for (let k = 0; k < g.maxAlive; k++) {
      const a = evenStep(k, g.maxAlive);
      const r = g.maxAlive === 1 ? 0 : g.spawnRadius * 0.6;
      s.units.push(spawnFromGroup(s, g, g.cx + Math.round(cosStep(a) * r), g.cy + Math.round(sinStep(a) * r)));
    }
  }
  if (stage.pvp) {
    // PvP 競技場：主角 HP ×3（addPlayer 加進來的玩家同樣處理）
    s.pvp = true;
    const p = s.units[0]!;
    p.hp = p.maxHp = pvpMaxHp(p.maxHp);
  }
  return s;
}

function makeFixed(s: BattleState, stage: StageDefinition, idx: number): Unit {
  const e = stage.enemies[idx]!;
  const def = ENEMIES[e.enemyId];
  if (!def) throw new Error(`unknown enemy ${e.enemyId}`);
  const m = makeEnemy(s, def, e.x, e.y);
  if (e.hpPct) m.hp = m.maxHp = Math.round((m.maxHp * (100 + e.hpPct)) / 100);
  if (e.atkPct) m.atk = Math.round((m.atk * (100 + e.atkPct)) / 100);
  if (stage.mapAi) {
    m.mode = 'idle';
    m.tier = e.tier ?? (def.boss ? 'boss' : 'normal');
    m.homeX = e.x;
    m.homeY = e.y;
    m.engagedTick = s.tick;
  }
  if (stage.bossZone?.respawnTicks) m.fixedIdx = idx;
  const fury = stage.bossZone?.fury;
  if (fury && s.bossFury && def.boss) {
    m.fury = true;
    m.hp = m.maxHp = Math.round((m.maxHp * (100 + fury.hpPct)) / 100);
    m.atk = Math.round((m.atk * (100 + fury.atkPct)) / 100);
  }
  return m;
}

/**
 * 開／關暴怒版 Boss（D-099）。Boss 正在巢穴待機而且滿血 → 立刻換成新版本；
 * 交戰中或已倒下 → 下一次出現才生效。關卡沒有 bossZone.fury 就不做事。回傳是否立刻換掉。
 */
export function setBossFury(s: BattleState, on: boolean): boolean {
  const stage = STAGES[s.stageId];
  if (!stage?.bossZone?.fury) return false;
  if (on) s.bossFury = true;
  else delete s.bossFury;
  const i = s.units.findIndex((u) => !u.dead && u.fixedIdx !== undefined && !!ENEMIES[u.defId]?.boss && u.mode === 'idle' && u.hp >= u.maxHp && !!u.fury !== on);
  if (i < 0) return false;
  const old = s.units[i]!;
  const m = makeFixed(s, stage, old.fixedIdx!);
  s.units.splice(i, 1, m);
  s.telegraphs = s.telegraphs.filter((t) => t.ownerId !== old.id);
  for (const x of s.units) if (x.summonedBy === old.id) x.dead = true;
  emit(s, { tick: s.tick, type: 'fury', id: m.id, old: old.id, on });
  return true;
}

/** Boss 再挑戰：時間到而且玩家在巢穴外 → Boss 回到原位（新單位，舊屍體移除） */
function processBossRespawn(s: BattleState): void {
  const br = s.bossRespawn;
  if (!br || s.tick < br.at) return;
  const stage = STAGES[s.stageId]!;
  const z = stage.bossZone!;
  const p = playerOf(s);
  if (dist(p.x, p.y, z.x, z.y) <= z.r) return;
  s.bossRespawn = undefined;
  const gone = s.units.findIndex((u) => u.dead && u.fixedIdx === br.idx);
  if (gone >= 0) s.units.splice(gone, 1);
  const m = makeFixed(s, stage, br.idx);
  s.units.push(m);
  emit(s, { tick: s.tick, type: 'respawn', id: m.id, group: 'boss' });
}

function spawnFromGroup(s: BattleState, g: SpawnGroup, x: number, y: number): Unit {
  const def = ENEMIES[g.enemyId];
  if (!def) throw new Error(`unknown enemy ${g.enemyId}`);
  const m = makeEnemy(s, def, x, y);
  const ramp = rampPct(s);
  const nt = s.night ? STAGES[s.stageId]?.night : undefined;
  const hpPct = ramp + (g.hpPct ?? 0) + (nt?.hpPct ?? 0);
  const atkPct = ramp + (g.atkPct ?? 0) + (nt?.atkPct ?? 0);
  if (hpPct) m.hp = m.maxHp = Math.round((m.maxHp * (100 + hpPct)) / 100);
  if (atkPct) m.atk = Math.round((m.atk * (100 + atkPct)) / 100);
  clampArena(s, m);
  if (s.arena.solid) {
    pushOutSolid(s.arena.solid, m);
    // 抽到厚荊棘深處推不出來（荊棘谷 D-114）：改在重生點中心出生（不用亂數，推得出來的情況完全不變）
    if (isSolidAt(s.arena.solid, m.x, m.y)) {
      m.x = g.cx;
      m.y = g.cy;
      pushOutSolid(s.arena.solid, m);
    }
  }
  m.mode = 'idle';
  m.tier = g.tier ?? (def.boss ? 'boss' : 'normal');
  if (g.aggroUnits !== undefined) m.aggroUnits = g.aggroUnits;
  if (g.patrol?.length) {
    m.patrol = g.patrol;
    m.patrolIdx = 0;
  }
  if (m.tier === 'elite') rollAffix(s, m);
  m.homeX = m.x;
  m.homeY = m.y;
  m.engagedTick = s.tick;
  m.groupId = g.id;
  return m;
}

/** 目前的壓力加成（%）：每滿 1 分鐘 +rampPctPerMin */
const rampPct = (s: BattleState): number => (STAGES[s.stageId]?.rampPctPerMin ?? 0) * Math.floor(s.tick / (60 * TICKS_PER_SEC));

function groupOf(s: BattleState, id: string): SpawnGroup | undefined {
  return STAGES[s.stageId]?.spawnGroups?.find((g) => g.id === id);
}

function queueRespawn(s: BattleState, groupId: string): void {
  const g = groupOf(s, groupId);
  if (!g || g.respawnTicks <= 0) return;
  (s.respawnAt ??= {})[groupId] = [...(s.respawnAt[groupId] ?? []), s.tick + g.respawnTicks];
}

/** 到期的重生：玩家夠遠才生（不然每秒再試）；同時把這組已倒下的單位從清單移掉（長時間刷怪不讓陣列一直變大） */
function processRespawns(s: BattleState): void {
  if (!s.respawnAt) return;
  const p = playerOf(s);
  for (const id of Object.keys(s.respawnAt).sort()) {
    const due = s.respawnAt[id]!;
    const g = groupOf(s, id)!;
    while (due.length && due[0]! <= s.tick) {
    if (dist(p.x, p.y, g.cx, g.cy) < RESPAWN_MIN_PLAYER_UNITS * UNIT) {
      for (let k = 0; k < due.length && due[k]! <= s.tick; k++) due[k] = s.tick + TICKS_PER_SEC;
      break;
    }
    due.shift();
    const a = randStep(nextRand(s));
    const r = Math.sqrt(nextRand(s)) * g.spawnRadius;
    const m = spawnFromGroup(s, g, g.cx + Math.round(cosStep(a) * r), g.cy + Math.round(sinStep(a) * r));
    const gone = s.units.findIndex((u) => u.dead && u.groupId === id);
    if (gone >= 0) s.units.splice(gone, 1);
    s.units.push(m);
    emit(s, { tick: s.tick, type: 'respawn', id: m.id, group: id });
    }
  }
}

// ---------------- 掉落與自動撿取（design/20 B5 最小版本） ----------------
function rollDrops(s: BattleState, e: Unit): void {
  // 擲骰規則在 loot.ts（伺服器 loot.claim 共用）；這裡只負責丟到地上
  const ctx: LootContext = { stageId: s.stageId, defId: e.defId, night: !!s.night, fury: !!e.fury, affix: !!e.affix, firstKill: !(s.bossKills ?? []).includes(e.defId) };
  if (e.groupId) ctx.groupId = e.groupId;
  if (e.fixedIdx !== undefined) ctx.fixedIdx = e.fixedIdx;
  rollEnemyLoot(ctx, () => lootRand(s), (kind, amount, rarity, uq) => {
    const a = randStep(lootRand(s));
    const r = (0.3 + lootRand(s) * 0.5) * UNIT;
    const it: GroundItem = { id: (s.lootSeq = (s.lootSeq ?? 0) + 1), kind, amount, x: e.x + Math.round(cosStep(a) * r), y: e.y + Math.round(sinStep(a) * r), tick: s.tick };
    if (rarity) it.rarity = rarity;
    if (uq) it.uq = uq;
    it.x = Math.min(s.arena.w - 20, Math.max(20, it.x));
    it.y = Math.min(s.arena.h - 20, Math.max(20, it.y));
    s.ground!.push(it);
    emit(s, { tick: s.tick, type: 'drop', item: it.id, kind, amount, ...(rarity ? { rarity } : {}), ...(uq ? { uq } : {}) });
  });
}

/** 走近 2.5 單位自動撿起；藥水滿了就留在地上；放太久消失 */
function processPickup(s: BattleState): void {
  if (!s.ground?.length) return;
  const p = playerOf(s);
  const carry = playerDef(s, p).potion.carry;
  s.ground = s.ground.filter((it) => {
    if (s.tick - it.tick > LOOT_RULES.expireTicks) return false;
    if (p.dead || s.tick - it.tick < LOOT_RULES.pickupDelayTicks || dist(p.x, p.y, it.x, it.y) > LOOT_RULES.pickupUnits * UNIT) return true;
    if (it.kind === 'potion') {
      const c = ctlOf(s, p);
      if (c.potions >= carry) return true;
      c.potions = Math.min(carry, c.potions + it.amount);
    }
    if (it.kind === 'gear') {
      (s.gearGot ??= []).push({ id: it.id, rarity: it.rarity ?? 1, ilvl: it.amount });
      s.loot!.gear = (s.loot!.gear ?? 0) + 1;
      emit(s, { tick: s.tick, type: 'pickup', item: it.id, kind: it.kind, amount: it.amount, rarity: it.rarity ?? 1, ...(it.uq ? { uq: it.uq } : {}) });
      return false;
    }
    s.loot![it.kind] = (s.loot![it.kind] ?? 0) + it.amount;
    emit(s, { tick: s.tick, type: 'pickup', item: it.id, kind: it.kind, amount: it.amount });
    if (it.kind === 'dust' || it.kind === 'crystal') lootEnhance(s, p);
    return false;
  });
}

/** 玩家周圍 units 單位、8 個方向（從亂數方向開始轉）找第一個不是障礙物、也不在營火圈內的點 */
function ringSpot(s: BattleState, p: Unit, units: number): { x: number; y: number } | null {
  const start = Math.floor(nextRand(s) * 8);
  for (let k = 0; k < 8; k++) {
    const a = evenStep(start + k, 8);
    const x = p.x + Math.round(cosStep(a) * units * UNIT);
    const y = p.y + Math.round(sinStep(a) * units * UNIT);
    if (x < UNIT || y < UNIT || x > s.arena.w - UNIT || y > s.arena.h - UNIT) continue;
    if (s.arena.solid && isSolidAt(s.arena.solid, x, y)) continue;
    if (campfireNear(s, x, y, CAMPFIRE_RULES.safeUnits)) continue;
    return { x, y };
  }
  return null;
}

/** 隱藏精英：連殺到門檻就在附近冒出來（醒著）；打倒後重新計數 */

/** 精英詞綴（D-113）：只有設了 eliteAffixes 的關卡、會移動的精英才抽（用掉落亂數，不動戰鬥亂數） */
function rollAffix(s: BattleState, m: Unit): void {
  const ea = STAGES[s.stageId]?.eliteAffixes;
  if (!ea || s.lootRng === undefined || (ENEMIES[m.defId]?.speed ?? 0) <= 0) return;
  lootRand(s); // 相近種子的第一個值很接近：先丟一個打散
  if (lootRand(s) * 100 >= ea.chancePct) return;
  applyAffix(m, ELITE_AFFIX_IDS[Math.floor(lootRand(s) * ELITE_AFFIX_IDS.length)]!);
}

export function applyAffix(m: Unit, a: EliteAffix): void {
  const d = ELITE_AFFIXES[a];
  m.affix = a;
  if (d.hpPct) m.hp = m.maxHp = Math.round((m.maxHp * (100 + d.hpPct)) / 100);
  if (d.speedPct) m.speedPerTick = Math.round((m.speedPerTick * (100 + d.speedPct)) / 100);
}
function processHiddenElite(s: BattleState): void {
  const st = STAGES[s.stageId];
  const h = st?.hiddenElite;
  if (!h || (s.streak ?? 0) < h.streak) return;
  if (s.units.some((x) => x.groupId === HIDDEN_GROUP && !x.dead)) return;
  const p = playerOf(s);
  const z = st.bossZone;
  if (p.dead || inSafeZone(s, p) || (z && dist(p.x, p.y, z.x, z.y) <= z.r) || s.tick % TICKS_PER_SEC !== 0) return;
  const at = ringSpot(s, p, 7);
  if (!at) return;
  s.streak = 0;
  s.units = s.units.filter((x) => !(x.groupId === HIDDEN_GROUP && x.dead));
  const m = makeEnemy(s, ENEMIES[h.enemyId]!, at.x, at.y);
  if (h.hpPct) m.hp = m.maxHp = Math.round((m.maxHp * (100 + h.hpPct)) / 100);
  if (h.atkPct) m.atk = Math.round((m.atk * (100 + h.atkPct)) / 100);
  clampArena(s, m);
  m.tier = 'elite';
  rollAffix(s, m);
  m.homeX = m.x;
  m.homeY = m.y;
  m.groupId = HIDDEN_GROUP;
  m.mode = 'combat';
  m.engagedTick = s.tick;
  m.aggroTick = s.tick;
  m.nextAttackTick = s.tick + 2 * TICKS_PER_SEC;
  s.units.push(m);
  emit(s, { tick: s.tick, type: 'hiddenElite', id: m.id });
}

/** 狼群暴動：排程、生成（醒著、直接追玩家）、追丟就散去 */
function processRiot(s: BattleState): void {
  const st = STAGES[s.stageId];
  const r = st?.riot;
  if (!r) return;
  const roll = (a: [number, number]) => a[0] + Math.floor(nextRand(s) * (a[1] - a[0] + 1));
  if (s.riotAt === undefined) s.riotAt = s.tick + roll(r.everyTicks);
  const p = playerOf(s);
  // 散去：追丟（返回／待機）的暴動怪直接移除（屍體留著，下次暴動前清掉）
  if (s.tick % TICKS_PER_SEC === 0) {
    s.units = s.units.filter((x) => {
      if (x.groupId !== RIOT_GROUP || x.dead || x.mode === 'combat') return true;
      if (p.targetId === x.id) p.targetId = null;
      return false;
    });
  }
  if (s.tick < s.riotAt) return;
  const z = st.bossZone;
  const busy = p.dead || inSafeZone(s, p) || (z && dist(p.x, p.y, z.x, z.y) <= z.r) || s.units.some((x) => x.groupId === RIOT_GROUP && !x.dead);
  if (busy) {
    s.riotAt = s.tick + 5 * TICKS_PER_SEC;
    return;
  }
  const at = ringSpot(s, p, 10);
  s.riotAt = s.tick + roll(r.everyTicks);
  if (!at) return;
  s.units = s.units.filter((x) => !(x.groupId === RIOT_GROUP && x.dead));
  const n = roll(r.count);
  const elite = !!r.eliteId && nextRand(s) * 100 < (r.eliteChance ?? 0);
  for (let i = 0; i < n; i++) {
    const def = ENEMIES[elite && i === 0 ? r.eliteId! : r.enemyId]!;
    const a = evenStep(i, n);
    // 第 160 輪：散開的位置如果落在障礙物裡（荊棘牆很厚時推不出來，怪會卡在牆裡），就生在中心點（ringSpot 保證是空地）
    let mx = at.x + Math.round(cosStep(a) * 1.5 * UNIT);
    let my = at.y + Math.round(sinStep(a) * 1.5 * UNIT);
    if (s.arena.solid && isSolidAt(s.arena.solid, mx, my)) [mx, my] = [at.x, at.y];
    const m = makeEnemy(s, def, mx, my);
    if (r.hpPct) m.hp = m.maxHp = Math.round((m.maxHp * (100 + r.hpPct)) / 100);
    clampArena(s, m);
    m.tier = elite && i === 0 ? 'elite' : 'normal';
    m.homeX = m.x;
    m.homeY = m.y;
    m.groupId = RIOT_GROUP;
    m.mode = 'combat';
    m.engagedTick = s.tick;
    m.aggroTick = s.tick;
    m.nextAttackTick = s.tick + 2 * TICKS_PER_SEC; // 衝過來的路上不出手
    s.units.push(m);
  }
  emit(s, { tick: s.tick, type: 'riot', count: n, elite, x: at.x, y: at.y });
}

/** 隱藏寶箱：走近自動打開（不用亂數）；藥水補到攜帶上限，其餘直接入帳 */
function processChests(s: BattleState): void {
  const list = STAGES[s.stageId]?.chests;
  if (!list?.length || !s.loot) return;
  const p = playerOf(s);
  if (p.dead) return;
  for (const c of list) {
    if ((c.nightOnly && !s.night) || s.chestsOpened?.includes(c.id) || dist(p.x, p.y, c.x, c.y) > CHEST_RULES.openUnits * UNIT) continue;
    (s.chestsOpened ??= []).push(c.id);
    for (const k of Object.keys(c.loot).sort() as LootId[]) {
      const n = c.loot[k] ?? 0;
      if (k === 'potion') ctlOf(s, p).potions = Math.min(playerDef(s, p).potion.carry, ctlOf(s, p).potions + n);
      s.loot[k] = (s.loot[k] ?? 0) + n;
    }
    emit(s, { tick: s.tick, type: 'chest', chest: c.id, loot: { ...c.loot } });
    lootEnhance(s, p);
  }
}

/** 撿材料就變強（試玩，lootEnhance） */
function lootEnhance(s: BattleState, p: Unit): void {
  const rule = STAGES[s.stageId]?.lootEnhance;
  if (!rule) return;
  const e = (s.enhance ??= { level: 0, baseAtk: s.prog?.baseAtk ?? p.atk });
  const pts = (s.loot!.dust ?? 0) + 5 * (s.loot!.crystal ?? 0);
  const lv = Math.min(rule.maxLevel, Math.floor(pts / rule.dustPerLevel));
  if (lv <= e.level) return;
  e.level = lv;
  recomputeAtk(s, p);
  emit(s, { tick: s.tick, type: 'enhance', level: lv, atk: p.atk });
}

/** 攻擊力＝基礎 ×（100 ＋ 等級加成 ＋ 撿材料強化加成）%（沒有等級時與舊算法相同） */
function recomputeAtk(s: BattleState, p: Unit): void {
  const st = STAGES[s.stageId];
  const base = s.prog?.baseAtk ?? s.enhance?.baseAtk ?? p.atk;
  const lvPct = s.prog && st?.progression ? st.progression.atkPctPerLevel * (s.prog.level - 1) : 0;
  const enPct = s.enhance && st?.lootEnhance ? st.lootEnhance.atkPctPerLevel * s.enhance.level : 0;
  p.atk = Math.round((base * (100 + lvPct + enPct)) / 100);
}

/** 依等級重算最大 HP 與攻擊；HP 補上增加的量 */
function applyLevel(s: BattleState, p: Unit): void {
  const rule = STAGES[s.stageId]?.progression;
  if (!rule || !s.prog) return;
  const before = p.maxHp;
  p.maxHp = Math.round((s.prog.baseHp * (100 + rule.hpPctPerLevel * (s.prog.level - 1))) / 100);
  if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + Math.max(0, p.maxHp - before));
  recomputeAtk(s, p);
}

/**
 * 戰鬥中換裝（D-091）：把裝備加成換成新的（相對於角色定義的基礎值），等級與強化加成照常疊上。
 * HP 比例維持不變。需要 progression（有 prog 才知道基礎值）。
 */
export function setGearBonus(s: BattleState, bonus: { hp: number; atk: number; def: number }): void {
  if (!s.prog) return;
  const p = s.units[0]!;
  const pd = playerDef(s);
  const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
  s.prog.baseHp = pd.hp + bonus.hp;
  s.prog.baseAtk = pd.atk + bonus.atk;
  if (s.enhance) s.enhance.baseAtk = s.prog.baseAtk;
  p.def = pd.def + bonus.def;
  applyLevel(s, p);
  if (!p.dead) p.hp = Math.max(1, Math.min(p.maxHp, Math.round(p.maxHp * ratio)));
}

/** 這場戰鬥實際用的技能定義（有選技能變化就用變化版，D-112） */
export function skillDef(s: BattleState, id: string, p?: Unit): SkillDefinition | undefined {
  const c = p ? ctlOf(s, p) : s;
  const v = c.skillVariants;
  // 武器表（D-152）：技能欄同一組 id，招式整組換掉；變化（D-112／148）、變化二（D-121／149）
  const w = WEAPONS[c.weapon ?? 'sword'];
  // 競技場的第 3 欄沿用原本的位移招（D-350）：換成不位移的招後三把武器一面倒
  if (s.pvp && id === 'charge') return ARENA_CHARGE[c.weapon ?? 'sword'][!v ? 0 : v.includes(id) ? 1 : v.includes(variantB(id)) ? 2 : 0];
  // 燼火祝福「試招」（P2）：這趟暫時改用變化打法，蓋過玩家平常選的（只有主角）
  const bv = c === s ? s.bless?.vars?.[id] : undefined;
  if (bv) return (bv === 1 ? w.variants[id] : w.variantsB[id]) ?? w.skills[id];
  if (!v) return w.skills[id];
  return (v.includes(id) ? w.variants[id] : v.includes(variantB(id)) ? w.variantsB[id] : undefined) ?? w.skills[id];
}

/** 主角是不是正在放技能（施放中改打法／技能修正要等這一招打完，RF-01） */
const castingSkill = (s: BattleState): boolean => s.units[0]?.action?.kind === 'skill' || !!s.units[0]?.casts?.length;

/**
 * 換技能變化；正在施放的技能照舊打完（下一次施放才換）。
 * 第 156 輪（D-339，RF-01）：以前註解這樣寫，實際上立刻換——命中表每個 tick 重新取、動作結束時間卻是舊招的，
 * 出手後切成施放比較久的打法，整招就沒有傷害。現在施放中先記在 `pendingSkill`，這一招結束後的下一個 tick 才套用。
 */
export function setSkillVariants(s: BattleState, ids: readonly string[]): void {
  const v = ids.filter((id) => WEAPONS.sword.variants[id] || (id.endsWith(':b') && WEAPONS.sword.variantsB[id.slice(0, -2)])).sort();
  if (castingSkill(s)) {
    (s.pendingSkill ??= {}).variants = v;
    return;
  }
  if (v.length) s.skillVariants = v;
  else delete s.skillVariants;
}

/**
 * 戰鬥中換裝：更新裝備帶來的獨特效果（P3，D-354；同 BattleSetup.effects）。
 * 技能修正類的效果在施放中一樣等這一招打完才套（applyBless 的規則）；競技場不生效。
 */
export function setEffects(s: BattleState, ids: readonly string[]): void {
  const perm = [...new Set(ids)].filter((id) => !s.pvp && Object.prototype.hasOwnProperty.call(EFFECTS, id));
  if (!perm.length) {
    if (!s.bless?.perm) return;
    if (s.bless.off) {
      delete s.bless; // 只為了裝備效果才有的：整個拿掉，回到和沒有效果時一樣的狀態
      return;
    }
    delete s.bless.perm;
  } else {
    s.bless ??= { rng: 1, meter: 0, taken: [], rerolls: 0, off: true };
    s.bless.perm = perm;
  }
  applyBless(s);
}

/** 戰鬥中換裝／點技能時更新技能修正（D-094）；施放中一樣等這一招打完（傷害、範圍、冷卻都不會中途變） */
export function setSkillMods(s: BattleState, mods: Record<string, SkillMod>): void {
  if (castingSkill(s)) {
    (s.pendingSkill ??= {}).mods = mods;
    return;
  }
  if (Object.keys(mods).length) s.skillMods = mods;
  else delete s.skillMods;
  if (s.bless) applyBless(s);
}

// ---------------- 燼火祝福（P2，D-343；效果資料在 effects.ts） ----------------
function blessRand(s: BattleState): number {
  let x = s.bless!.rng;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  s.bless!.rng = x || 1;
  return x / 0x100000000;
}

/** 主角身上的祝福效果（沒有祝福＝空的；不配置新陣列的常見路徑） */
const NO_EFFECTS: readonly EffectDef[] = [];
function blessEffects(s: BattleState): readonly EffectDef[] {
  const b = s.bless;
  if (!b || (b.taken.length === 0 && !b.perm)) return NO_EFFECTS;
  const out: EffectDef[] = [];
  for (const id of b.perm ?? []) {
    const d = effectDef(id, s.weapon ?? 'sword');
    if (d) out.push(d);
  }
  for (const id of b.taken) {
    const d = effectDef(id, s.weapon ?? 'sword');
    if (d && !b.perm?.includes(id)) out.push(d);
  }
  return out;
}

/** 把已選的祝福套到技能上（技能修正、試招）；施放中不套（等這一招打完，同 RF-01） */
function applyBless(s: BattleState): void {
  const b = s.bless!;
  if (castingSkill(s)) {
    b.fresh = true;
    return;
  }
  delete b.fresh;
  const fx = blessEffects(s);
  const mods = mergeEffectMods(s.skillMods, fx);
  if (mods && mods !== s.skillMods) b.mods = mods;
  else delete b.mods;
  let vars: Record<string, 1 | 2> | undefined;
  for (const e of fx) if (e.variant) (vars ??= {})[e.variant.skill] = e.variant.idx;
  if (vars) b.vars = vars;
  else delete b.vars;
}

/** 玩家平常選的打法是第幾種（0＝原招） */
const chosenIdx = (s: BattleState, id: string): 0 | 1 | 2 => (s.skillVariants?.includes(id) ? 1 : s.skillVariants?.includes(variantB(id)) ? 2 : 0);

/**
 * 抽三張：不重複、不出現已經有的；「試招」每次最多一張，而且只出玩家現在沒在用的打法、同一欄一趟只試一種。
 * avoid＝重抽時盡量不要再出現的（上一手的三張）。
 */
function rollBlessOffer(s: BattleState, avoid: readonly string[] = []): string[] {
  const b = s.bless!;
  const w = WEAPONS[s.weapon ?? 'sword'];
  const ok = (id: string): boolean => !b.taken.includes(id) && !b.perm?.includes(id);
  const fixed = EFFECT_IDS.filter((id) => ok(id) && (!effectDef(id)!.weapons || effectDef(id)!.weapons!.includes(w.id)));
  const tries: string[] = [];
  for (const skill of Object.keys(w.skills)) {
    if (b.taken.some((id) => id.startsWith(`try:${skill}:`))) continue;
    for (const k of [1, 2] as const) if ((k === 1 ? w.variants : w.variantsB)[skill] && chosenIdx(s, skill) !== k) tries.push(tryVariantId(skill, k));
  }
  const pickFrom = (pool: string[]): string | undefined => {
    if (!pool.length) return undefined;
    const fresh = pool.filter((id) => !avoid.includes(id));
    const from = fresh.length ? fresh : pool;
    const id = from[Math.floor(blessRand(s) * from.length)]!;
    pool.splice(pool.indexOf(id), 1);
    return id;
  };
  const out: string[] = [];
  const wantTry = tries.length > 0 && blessRand(s) < 0.6;
  if (wantTry) out.push(pickFrom(tries)!);
  while (out.length < BLESS_RULES.choices) {
    const id = pickFrom(fixed);
    if (!id) break;
    out.push(id);
  }
  // 固定效果快拿完了：用「試招」補（不同欄）
  while (out.length < BLESS_RULES.choices && tries.length) {
    const id = pickFrom(tries)!;
    const skill = id.split(':')[1];
    if (!out.some((o) => o.startsWith(`try:${skill}:`))) out.push(id);
  }
  return out;
}

/** 計量滿了就出三選一（已經有一手在等、或這趟拿滿了就不出） */
function maybeBlessOffer(s: BattleState): void {
  const b = s.bless!;
  if (b.off || b.offer || b.taken.length >= BLESS_RULES.max || b.meter < blessNeed(b.taken.length)) return;
  const ids = rollBlessOffer(s);
  if (!ids.length) return;
  b.offer = ids;
  emit(s, { tick: s.tick, type: 'blessOffer', ids });
}

/** 玩家的選擇（只有在等選的時候有效） */
function blessCommand(s: BattleState, c: { pick?: number; reroll?: boolean }): void {
  const b = s.bless;
  if (!b?.offer) return;
  if (c.reroll) {
    if (b.rerolls <= 0) return;
    b.rerolls--;
    const ids = rollBlessOffer(s, b.offer);
    if (ids.length) {
      b.offer = ids;
      emit(s, { tick: s.tick, type: 'blessOffer', ids });
    }
    return;
  }
  const id = typeof c.pick === 'number' ? b.offer[c.pick] : undefined;
  if (!id) return;
  b.meter = Math.max(0, b.meter - blessNeed(b.taken.length));
  b.taken.push(id);
  delete b.offer;
  emit(s, { tick: s.tick, type: 'blessPick', id });
  applyBless(s);
  maybeBlessOffer(s);
}

/** 回營火休息或倒下：祝福清空（計量也歸零、重抽次數補回） */
function clearBless(s: BattleState, reason: 'rest' | 'down'): void {
  const b = s.bless;
  if (!b || (b.taken.length === 0 && b.meter === 0 && !b.offer)) return;
  const count = b.taken.length;
  s.bless = { rng: b.rng, meter: 0, taken: [], rerolls: BLESS_RULES.rerolls };
  if (b.perm) {
    // 裝備的獨特效果留著（技能修正重新套一次）
    s.bless.perm = b.perm;
    applyBless(s);
  }
  emit(s, { tick: s.tick, type: 'blessClear', reason, count });
}

let burstDepth = 0;
/**
 * 祝福的範圍追加傷害（燼爆、召雷、綻光、殘影、震盾共用）：只波及交戰中的敵人（不會把旁邊睡著的怪炸醒）。
 * 事件帶實際半徑，畫面照它畫圈。skip＝不打這一隻（綻光只波及「其他」敵人）。
 */
function blessBurst(s: BattleState, p: Unit, x: number, y: number, k: EffectBurst, id: string, skip?: Unit): void {
  emit(s, { tick: s.tick, type: 'blessProc', id, x, y, r: k.r });
  burstDepth++;
  for (const o of enemiesOf(s)) {
    if (o === skip || o.dead || (o.mode && o.mode !== 'combat') || dist(o.x, o.y, x, y) > k.r + o.r) continue;
    dealDamage(s, p, o, k.mult, 'skill', id);
    if (k.status && !o.dead) addStatus(s, o, k.status, p);
  }
  burstDepth--;
}

/** 主角打倒敵人：累積計量、觸發擊殺效果（爆炸可以連鎖，最多四層） */
function blessKill(s: BattleState, p: Unit, dead: Unit): void {
  const b = s.bless!;
  if (!dead.summonedBy && !b.off) b.meter += dead.tier === 'boss' ? 5 : dead.tier === 'elite' ? 2 : 1;
  for (const e of blessEffects(s)) {
    const k = e.onKill;
    if (!k) continue;
    if (k.healPct && !p.dead && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round((p.maxHp * k.healPct) / 100)));
    if (k.burst && burstDepth < 4) blessBurst(s, p, dead.x, dead.y, k.burst, e.id);
  }
  if (burstDepth === 0) maybeBlessOffer(s);
}

/** 切換自動施放的技能欄（P1，D-342）：馬上生效（只影響「下一招要不要自己放」，不動正在放的招） */
export function setAutoSkills(s: BattleState, ids: readonly string[]): void {
  const v = cleanAutoSkills(ids);
  if (v.length) s.autoSkills = v;
  else delete s.autoSkills;
}

/** 玩家現在「選的」打法（含施放中還沒套用的）：面板顯示用 */
export function chosenVariants(s: BattleState): string[] {
  return s.pendingSkill?.variants ?? s.skillVariants ?? [];
}

/** 這一招打完了：把施放中改的打法／技能修正套上去 */
function flushPendingSkill(s: BattleState): void {
  const pd = s.pendingSkill;
  if (!pd || castingSkill(s)) return;
  delete s.pendingSkill;
  if (pd.mods) setSkillMods(s, pd.mods);
  if (pd.variants) setSkillVariants(s, pd.variants);
}

/** 打倒怪物得經驗；滿了就升級（一次可能連升） */
function gainXp(s: BattleState, dst: Unit): void {
  const st = STAGES[s.stageId];
  const rule = st?.progression;
  if (!rule || !s.prog || dst.summonedBy) return;
  // 經驗值規則在 loot.ts（伺服器 loot.claim 共用）
  s.prog.xp += killXp({ stageId: s.stageId, defId: dst.defId, ...(dst.groupId ? { groupId: dst.groupId } : {}), ...(dst.fixedIdx !== undefined ? { fixedIdx: dst.fixedIdx } : {}) });
  const p = s.units[0]!;
  while (s.prog.level < rule.maxLevel && s.prog.xp >= xpToNext(s.prog.level)) {
    s.prog.xp -= xpToNext(s.prog.level);
    s.prog.level++;
    applyLevel(s, p);
    emit(s, { tick: s.tick, type: 'levelUp', level: s.prog.level, maxHp: p.maxHp, atk: p.atk });
  }
}

/** 還有沒有會重生的怪（刷怪地圖不會因清空而勝利） */
const pendingRespawn = (s: BattleState): boolean => !!s.respawnAt && Object.values(s.respawnAt).some((d) => d.length > 0);

export const playerOf = (s: BattleState, pid = 0): Unit => (pid === 0 ? s.units[0]! : s.units.find((u) => u.side === 'player' && u.pid === pid)!);
/** 隊伍（Q6）：沒設＝照 side */
export const teamOf = (u: Unit): number => u.team ?? (u.side === 'player' ? 0 : 1);
export const hostile = (a: Unit, b: Unit): boolean => teamOf(a) !== teamOf(b);
/** 這個玩家的控制狀態（pid 0＝BattleState 本身） */
export function ctlOf(s: BattleState, p: Unit): PlayerCtl {
  const pid = p.pid ?? 0;
  return pid === 0 ? s : s.others![pid - 1]!;
}
/**
 * 加一個玩家（Q6）：放在主角旁邊；team 不給＝跟主角同隊（協力），給不同的數字＝敵對（PvP）。
 * 沒給 weapon＝複製主角（同武器、同等級、同裝備數值）；給了 weapon＝那把武器的基礎數值＋bonus（PvP 的配裝由呼叫端換算好傳進來）。
 * 技能變化／修正各玩家自己的（PlayerCtl）；等級經驗（s.prog）仍只算主角。
 */
export function addPlayer(
  s: BattleState,
  o: { team?: number; dx?: number; dy?: number; potions?: number; weapon?: 'sword' | 'bow' | 'staff'; bonus?: { hp?: number; atk?: number; def?: number }; skillVariants?: string[]; skillMods?: Record<string, SkillMod> } = {},
): Unit {
  const p0 = s.units[0]!;
  const pid = (s.others?.length ?? 0) + 1;
  const ctl: PlayerCtl = { manualMove: null, potions: 0 };
  const own = o.weapon !== undefined;
  if (own && o.weapon !== 'sword') ctl.weapon = o.weapon;
  else if (!own && s.weapon) ctl.weapon = s.weapon;
  const vs = o.skillVariants ?? (own ? undefined : s.skillVariants);
  if (vs?.length) ctl.skillVariants = [...vs].sort();
  const mods = o.skillMods ?? (own ? undefined : s.skillMods);
  if (mods && Object.keys(mods).length) ctl.skillMods = mods;
  const pd = WEAPONS[ctl.weapon ?? 'sword'].player;
  ctl.potions = o.potions ?? pd.potion.carry;
  const b = o.bonus ?? {};
  const stats = own
    ? { r: pd.radius, hp: pd.hp + (b.hp ?? 0), maxHp: pd.hp + (b.hp ?? 0), atk: pd.atk + (b.atk ?? 0), def: pd.def + (b.def ?? 0), speedPerTick: speedPerTick(pd.speed), mp: Math.min(pd.mp, pd.mpStart), defId: pd.id }
    : { hp: p0.maxHp };
  const u: Unit = {
    ...p0, ...stats, id: s.nextId++, pid, team: o.team ?? teamOf(p0), x: p0.x + (o.dx ?? 2 * p0.r + 20), y: p0.y + (o.dy ?? 0),
    dead: false, action: null, statuses: [], ready: {}, targetId: null, invulnUntil: -1, hitstunUntil: -1, hitstunImmuneUntil: -1, nextAttackTick: 0,
  };
  if (s.pvp && own) u.hp = u.maxHp = pvpMaxHp(u.maxHp);
  clampArena(s, u);
  s.units.push(u);
  (s.others ??= []).push(ctl);
  return u;
}

/** 所有玩家（單人＝只有主角；不配置新陣列） */
const SOLO: Unit[] = [];
export function playersOf(s: BattleState): readonly Unit[] {
  if (!s.others?.length) {
    SOLO[0] = s.units[0]!;
    return SOLO;
  }
  return s.units.filter((u) => u.side === 'player');
}
/** 怪要對付誰（Q6）：單人＝主角；多人＝最近的、活著的敵對玩家（同距離取 id 小的） */
function enemyTargetOf(s: BattleState, e: Unit): Unit {
  if (!s.others?.length) return s.units[0]!;
  let best: Unit | undefined;
  let bd = Infinity;
  for (const u of s.units) {
    if (u.side !== 'player' || u.dead || !hostile(e, u)) continue;
    const d = dist(e.x, e.y, u.x, u.y);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return best ?? s.units[0]!;
}
export const enemiesOf = (s: BattleState): Unit[] => s.units.filter((x) => x.side === 'enemy' && !x.dead);
/** 這個玩家的對手：活著、敵對的單位（PvP 時包含對方玩家） */
export const foesOf = (s: BattleState, p: Unit): Unit[] => s.units.filter((x) => !x.dead && x !== p && hostile(p, x));
const unitById = (s: BattleState, id: number | null | undefined): Unit | undefined => (id == null ? undefined : s.units.find((x) => x.id === id));
const has = (x: Unit, id: StatusId, tick: number): boolean => x.statuses.some((st) => st.id === id && st.until > tick);
/** 暈眩或冰凍：不能移動與攻擊 */
const disabled = (x: Unit, tick: number): boolean => has(x, 'stun', tick) || has(x, 'freeze', tick);

/** 上狀態：同一種刷新時間；可疊層的（燃燒、中毒）加一層；冰凍對 Boss 改成緩速；護盾總量 ≤ 最大 HP 50% */
export function addStatus(s: BattleState, x: Unit, st: StatusApply, src?: Unit): void {
  let id = st.id;
  if (id === 'freeze' && ENEMIES[x.defId]?.boss) id = 'slow';
  let ticks = st.ticks;
  // PvP：玩家被控時間減半、15 秒內連續被控遞減到免疫（pvp.ts）
  if (s.pvp && x.side === 'player' && (id === 'stun' || id === 'freeze' || id === 'slow')) {
    const r = pvpCc(ticks, s.tick, x.ccMemo);
    x.ccMemo = r.memo;
    if (r.ticks <= 0) return;
    ticks = r.ticks;
  }
  const until = s.tick + ticks;
  const rule = STATUS_RULES[id];
  const power = src && st.powerPct ? Math.max(1, Math.round((src.atk * st.powerPct) / 100)) : 0;
  const cur = x.statuses.find((q) => q.id === id);
  if (id === 'shield') {
    const cap = Math.floor(x.maxHp / 2);
    if (cur) {
      cur.value = Math.min(cap, cur.value + power);
      cur.until = Math.max(cur.until, until);
    } else x.statuses.push({ id, until, stacks: 1, value: Math.min(cap, power), srcId: src?.id ?? 0, next: 0 });
    return;
  }
  if (cur) {
    cur.until = Math.max(cur.until, until); // 不疊加的取最長
    if (rule.dot) {
      cur.stacks = Math.min(rule.maxStacks, cur.stacks + 1);
      cur.value = Math.max(cur.value, power);
    }
  } else x.statuses.push({ id, until, stacks: 1, value: power, srcId: src?.id ?? 0, next: s.tick + TICKS_PER_SEC });
}

/** 地形危害（D-114）：每秒檢查一次，玩家在毒沼裡就疊一層中毒（不看防禦、無敵時不疊） */
/** 這一場實際生效的地形危害（深夜擴散／深夜限定，D-115）；畫面也用這個畫 */
export function activeHazards(s: Pick<BattleState, 'stageId' | 'night'>): StageHazard[] {
  const hz = STAGES[s.stageId]?.hazards ?? [];
  return hz.filter((h) => !h.nightOnly || s.night).map((h) => (s.night && h.nightR ? { ...h, r: h.nightR } : h));
}

function processHazards(s: BattleState): void {
  if (!STAGES[s.stageId]?.hazards?.length || s.tick % TICKS_PER_SEC !== 0) return;
  const hz = activeHazards(s);
  const p = playerOf(s);
  if (p.dead || p.invulnUntil >= s.tick) return;
  const h = hz.find((z) => dist(p.x, p.y, z.x, z.y) <= z.r);
  if (!h) return;
  const dmg = Math.max(1, Math.round((p.maxHp * h.pct) / 100));
  addStatus(s, p, { id: 'poison', ticks: 3 * TICKS_PER_SEC, powerPct: 100 }, { ...p, atk: dmg, id: p.id });
  emit(s, { tick: s.tick, type: 'hazard', id: p.id });
}

/** 噴發口（D-125）：距離下一次噴發還有幾 tick（0＝這個 tick 噴發）；畫面預告也用這個 */
export function ventLeft(tick: number, v: StageVent, night?: boolean): number {
  const per = night && v.nightEveryTicks ? v.nightEveryTicks : v.everyTicks;
  const t = (tick + (v.offsetTicks ?? 0)) % per;
  return t === 0 ? 0 : per - t;
}

function processVents(s: BattleState): void {
  const vs = STAGES[s.stageId]?.vents;
  if (!vs?.length || s.tick === 0) return;
  const p = playerOf(s);
  vs.forEach((v, idx) => {
    if (ventLeft(s.tick, v, s.night) !== 0) return;
    emit(s, { tick: s.tick, type: 'vent', idx, x: v.x, y: v.y, r: v.r });
    for (const x of s.units) {
      if (x.dead || dist(x.x, x.y, v.x, v.y) > v.r + x.r * 0.5) continue;
      if (x.side === 'player' && x.invulnUntil >= s.tick) continue;
      if (x.side === 'enemy' && (ENEMIES[x.defId]?.boss || (x.mode !== undefined && x.mode !== 'combat'))) continue; // 只燒追著你的怪（引怪踩噴口），待機的不會被燒光
      applyHp(s, p, x, Math.max(1, Math.round((x.maxHp * v.pct) / 100)), false, 'dot', 'vent');
    }
    if (v.shard) s.shards = [...(s.shards ?? []).filter((sh) => sh.idx !== idx), { idx, until: s.tick + v.shard.ticks }];
  });
  if (s.shards?.length) pickShards(s, vs, p);
}

/** 星光碎片（D-141）：落星留下的碎片，玩家走到 1 格內撿起來回 MP 與 HP；過期就消失。撿的那一刻落地的那顆不算（要等下一個 tick） */
function pickShards(s: BattleState, vs: readonly StageVent[], p: Unit): void {
  s.shards = s.shards!.filter((sh) => {
    if (sh.until <= s.tick) return false;
    const v = vs[sh.idx];
    if (!v?.shard) return false;
    if (sh.until - v.shard.ticks >= s.tick) return true; // 剛落地的這個 tick 還不能撿
    if (p.dead || dist(p.x, p.y, v.x, v.y) > UNIT + p.r) return true;
    const heal = Math.min(p.maxHp - p.hp, Math.round((p.maxHp * v.shard.healPct) / 100));
    p.hp += heal;
    gainMp(s, p, v.shard.mp);
    emit(s, { tick: s.tick, type: 'shard', idx: sh.idx, x: v.x, y: v.y, mp: v.shard.mp, heal });
    return false;
  });
}

/** 持續傷害（每 30 ticks；不吃暴擊與加算池、不觸發其他效果） */
function tickDots(s: BattleState, x: Unit): void {
  for (const st of x.statuses) {
    if (!STATUS_RULES[st.id].dot || s.tick < st.next || st.until <= s.tick || x.dead) continue;
    st.next += TICKS_PER_SEC;
    const amount = Math.max(1, st.value * st.stacks);
    const src = unitById(s, st.srcId) ?? x;
    applyHp(s, src, x, amount, false, 'dot', st.id);
  }
}

function emit(s: BattleState, e: BattleEvent): void {
  s.events.push(e);
}

// ---------------- 傷害（design/18 §1.5：單一加算池 +150%、防禦倍率、暴擊乘區） ----------------
export function computeDamage(atk: number, mult: number, pool: number, def: number, critMul: number): number {
  const base = (atk * mult) / 100;
  const bonus = 1 + Math.min(Math.max(0, pool), 1.5);
  const defMul = 100 / (100 + Math.max(0, def));
  return Math.max(1, Math.round(base * bonus * defMul * critMul));
}

/** 目前武器的玩家定義（D-147：長弓；沒設＝劍士，舊關卡結果完全不變） */
export function playerDef(s?: Pick<BattleState, 'weapon' | 'others'>, p?: Unit): PlayerDefinition {
  const w = p?.pid ? s?.others?.[p.pid - 1]?.weapon : s?.weapon;
  return WEAPONS[w ?? 'sword'].player;
}
/** 這個玩家的技能修正（沒給玩家＝主角） */
const modsOf = (s: BattleState, p?: Unit): Record<string, SkillMod> | undefined => (p?.pid ? ctlOf(s, p).skillMods : (s.bless?.mods ?? s.skillMods));

function dealDamage(s: BattleState, src: Unit, dst: Unit, mult: number, origin: 'normal' | 'skill' | 'counter' | 'enemy', skill: string, reducePct = 0): number {
  if (dst.dead) return 0;
  if (dst.mode === 'returning') return 0; // 脫戰返回中不吃傷害（D-072）
  if (dst.mode === 'idle' || dst.mode === 'dormant') aggro(s, dst); // 被打到就醒
  if (dst.mode) dst.engagedTick = s.tick;
  if (src.mode) src.engagedTick = s.tick;
  if (src.side === 'player') ctlOf(s, src).lastCombatTick = s.tick;
  if (dst.side === 'player') ctlOf(s, dst).lastCombatTick = s.tick;
  if (dst.invulnUntil >= s.tick) {
    // D-365：自己翻滾閃過敵人的攻擊 → 回 MP、閃避冷卻退一半（每次翻滾一次；復活的無敵不算；競技場不給）
    const act = dst.action;
    if (dst.side === 'player' && src.side === 'enemy' && !s.pvp && act?.kind === 'dodge' && !act.paid) {
      act.paid = true;
      const mp = playerDef(s, dst).mpGain.dodge;
      gainMp(s, dst, mp);
      const left = (dst.ready['dodge'] ?? 0) - s.tick;
      if (left > 0) dst.ready['dodge'] = s.tick + Math.floor((left * (100 - DODGE_REFUND_PCT)) / 100);
      emit(s, { tick: s.tick, type: 'dodged', id: dst.id, attack: skill, mp });
    } else emit(s, { tick: s.tick, type: 'dodged', id: dst.id, attack: skill });
    return 0;
  }
  let pool = 0;
  if (has(dst, 'break', s.tick)) pool += 0.3;
  const atk = has(src, 'atkUp', s.tick) ? Math.round(src.atk * 1.15) : src.atk;
  let critMul = 1;
  let crit = false;
  if (src.side === 'player') {
    const pd = playerDef(s, src);
    if (nextRand(s) * 100 < pd.critRate) {
      crit = true;
      critMul = pd.critDmg / 100;
    }
    // 祝福「閃避後下一擊必暴」（P2）：亂數照擲（不動戰鬥亂數的順序），結果改成暴擊
    const b = src.pid ? undefined : s.bless;
    if (b?.critUntil !== undefined) {
      if (b.critUntil >= s.tick && !crit) {
        crit = true;
        critMul = pd.critDmg / 100;
      }
      delete b.critUntil;
    }
  }
  // 祝福「斬首」（P2）：對殘血的敵人直接傷害加成
  const bfx = s.bless && src.side === 'player' && !src.pid && dst.side === 'enemy' ? blessEffects(s) : NO_EFFECTS;
  let executed = '';
  for (const e of bfx) {
    if (e.execute && dst.hp * 100 < dst.maxHp * e.execute.belowPct) {
      mult = Math.round((mult * (100 + e.execute.dmgPct)) / 100);
      executed = e.id;
    }
  }
  let amount = computeDamage(atk, mult, pool, dst.def, critMul);
  if (has(src, 'weak', s.tick)) amount = Math.max(1, Math.round(amount * 0.8)); // 虛弱：造成傷害 −20%
  if (reducePct > 0) amount = Math.max(1, Math.round((amount * (100 - reducePct)) / 100));
  if (s.pvp && src.side === 'player' && dst.side === 'player') amount = pvpDamage(amount, ctlOf(s, src).weapon ?? 'sword', ctlOf(s, dst).weapon ?? 'sword');
  applyHp(s, src, dst, amount, crit, origin, skill);
  if (bfx.length) {
    // 斬首收掉敵人時給一個記號（畫面演出用）；綻光：暴擊在目標處炸開（炸開、燼爆的傷害不再觸發）
    if (executed && dst.dead) emit(s, { tick: s.tick, type: 'blessProc', id: executed, x: dst.x, y: dst.y });
    if (crit && burstDepth === 0) for (const e of bfx) if (e.onCrit) blessBurst(s, src, dst.x, dst.y, e.onCrit.burst, e.id, dst);
  }
  // 受擊硬直（小怪；Boss 0）＋1 秒硬直免疫
  if (dst.side === 'enemy' && !dst.dead) {
    const def = ENEMIES[dst.defId]!;
    if (def.hitstunTicks > 0 && s.tick >= dst.hitstunImmuneUntil) {
      dst.hitstunUntil = s.tick + def.hitstunTicks;
      dst.hitstunImmuneUntil = s.tick + TICKS_PER_SEC;
    }
  }
  return amount;
}

/** 玩家回 MP（上限 PlayerDefinition.mp） */
function gainMp(s: BattleState, p: Unit, n: number): void {
  if (p.side !== 'player' || p.dead || n <= 0) return;
  p.mp = Math.min(playerDef(s, p).mp, p.mp + n);
}

/** 扣血（先扣護盾）、記事件、處理死亡 */
function applyHp(s: BattleState, src: Unit, dst: Unit, amount: number, crit: boolean, origin: 'normal' | 'skill' | 'counter' | 'enemy' | 'dot', skill: string): void {
  let absorbed = 0;
  const sh = dst.statuses.find((q) => q.id === 'shield' && q.until > s.tick && q.value > 0);
  if (sh) {
    absorbed = Math.min(sh.value, amount);
    sh.value -= absorbed;
  }
  dst.hp = Math.max(0, dst.hp - (amount - absorbed));
  if (origin !== 'dot') {
    if (src.side === 'player' && dst.side === 'enemy') gainMp(s, src, playerDef(s, src).mpGain.deal);
    if (dst.side === 'player' && amount > absorbed) gainMp(s, dst, playerDef(s, dst).mpGain.hurt);
  }
  emit(s, { tick: s.tick, type: 'damage', src: src.id, dst: dst.id, amount, crit, origin, skill, ...(absorbed ? { absorbed } : {}) });
  if (dst.hp <= 0 && !dst.dead) {
    dst.dead = true;
    dst.action = null;
    delete dst.casts;
    s.telegraphs = s.telegraphs.filter((t) => t.ownerId !== dst.id);
    emit(s, { tick: s.tick, type: 'death', id: dst.id });
    if (dst.groupId) queueRespawn(s, dst.groupId);
    if (dst.side === 'enemy' && STAGES[s.stageId]?.hiddenElite && dst.tier === 'normal' && !dst.summonedBy) s.streak = (s.streak ?? 0) + 1;
    if (s.ground && dst.side === 'enemy' && !dst.summonedBy) rollDrops(s, dst);
    if (s.prog && dst.side === 'enemy') gainXp(s, dst);
    if (s.bless && dst.side === 'enemy' && src.side === 'player' && !src.pid) blessKill(s, src, dst);
    if (dst.mode && ENEMIES[dst.defId]?.boss && !(s.bossKills ??= []).includes(dst.defId)) s.bossKills.push(dst.defId);
    if (dst.fury) s.furyKills = (s.furyKills ?? 0) + 1;
    const rt = STAGES[s.stageId]?.bossZone?.respawnTicks;
    if (rt && dst.fixedIdx !== undefined) s.bossRespawn = { idx: dst.fixedIdx, at: s.tick + rt };
  }
}

// ---------------- 移動 ----------------
function clampArena(s: BattleState, x: Unit): boolean {
  const nx = Math.min(s.arena.w - x.r, Math.max(x.r, x.x));
  const ny = Math.min(s.arena.h - x.r, Math.max(x.r, x.y));
  let hit = nx !== x.x || ny !== x.y;
  x.x = nx;
  x.y = ny;
  if (s.arena.solid && pushOutSolid(s.arena.solid, x)) {
    hit = true;
    // 推出障礙物後再夾一次外牆（障礙物貼牆時）
    x.x = Math.min(s.arena.w - x.r, Math.max(x.r, x.x));
    x.y = Math.min(s.arena.h - x.r, Math.max(x.r, x.y));
  }
  return hit;
}

/** 這個座標所在的格子是不是障礙物 */
export function isSolidAt(solid: NonNullable<BattleState['arena']['solid']>, px: number, py: number): boolean {
  const cx = Math.floor(px / solid.cell);
  const cy = Math.floor(py / solid.cell);
  return solid.rows[cy]?.[cx] === '#';
}

/** 圓形對障礙物格：推到最近的格子邊外（整數座標、固定掃描順序，確定性） */
function pushOutSolid(solid: NonNullable<BattleState['arena']['solid']>, u: Unit): boolean {
  const c = solid.cell;
  let moved = false;
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    const x0 = Math.floor((u.x - u.r) / c);
    const x1 = Math.floor((u.x + u.r) / c);
    const y0 = Math.floor((u.y - u.r) / c);
    const y1 = Math.floor((u.y + u.r) / c);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (solid.rows[cy]?.[cx] !== '#') continue;
        const left = cx * c;
        const top = cy * c;
        const qx = Math.min(left + c, Math.max(left, u.x));
        const qy = Math.min(top + c, Math.max(top, u.y));
        const dx = u.x - qx;
        const dy = u.y - qy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= u.r * u.r) continue;
        if (d2 === 0) {
          // 圓心在格子裡：往最短的那一邊推出去
          // 只考慮鄰格不是障礙物的那幾邊（厚樹林裡往旁邊推只會推進另一棵樹；D-086）；四邊都堵住才照舊
          const outs = [u.x - left + u.r, left + c - u.x + u.r, u.y - top + u.r, top + c - u.y + u.r];
          const open = [solid.rows[cy]?.[cx - 1], solid.rows[cy]?.[cx + 1], solid.rows[cy - 1]?.[cx], solid.rows[cy + 1]?.[cx]].map((ch) => ch !== undefined && ch !== '#');
          const m = open.some(Boolean) ? Math.min(...outs.filter((_, i) => open[i])) : Math.min(...outs);
          const pick = (i: number) => m === outs[i] && (open[i] || !open.some(Boolean));
          if (pick(0)) u.x = left - u.r;
          else if (pick(1)) u.x = left + c + u.r;
          else if (pick(2)) u.y = top - u.r;
          else u.y = top + c + u.r;
        } else {
          const d = Math.sqrt(d2);
          const push = u.r - d + 1;
          u.x += Math.round((dx / d) * push);
          u.y += Math.round((dy / d) * push);
        }
        any = true;
        moved = true;
      }
    }
    if (!any) break;
  }
  return moved;
}

function moveDir(s: BattleState, x: Unit, dirX: number, dirY: number, factor = 1): boolean {
  let sp = x.speedPerTick * factor;
  if (has(x, 'slow', s.tick)) sp *= 0.6;
  x.x += Math.round((dirX / DIR) * sp);
  x.y += Math.round((dirY / DIR) * sp);
  return clampArena(s, x);
}

function moveToward(s: BattleState, x: Unit, tx: number, ty: number, stopAt: number, factor = 1): void {
  const d = dist(x.x, x.y, tx, ty);
  if (d <= stopAt) return;
  const [fx, fy] = norm(tx - x.x, ty - x.y);
  x.facingX = fx;
  x.facingY = fy;
  const sp = x.speedPerTick * factor * (has(x, 'slow', s.tick) ? 0.6 : 1);
  if (d - stopAt < sp) {
    // 不要衝過頭
    const k = (d - stopAt) / d;
    x.x += Math.round((tx - x.x) * k);
    x.y += Math.round((ty - x.y) * k);
    clampArena(s, x);
    return;
  }
  moveDir(s, x, fx, fy, factor);
}

/**
 * 追向目標（D-071）：沒有障礙物時＝moveToward（舊行為完全不變）；
 * 有障礙物而且直線被擋 → 走 A* 路徑的下一個點（繞過石頭），到目標附近才停。
 */
function navToward(s: BattleState, x: Unit, tx: number, ty: number, stopAt: number, factor = 1): void {
  const g = gridOf(s.arena);
  if (!g || dist(x.x, x.y, tx, ty) <= stopAt) {
    moveToward(s, x, tx, ty, stopAt, factor);
    return;
  }
  const wp = nextWaypoint(g, x.x, x.y, tx, ty, Math.round(x.r * 0.8));
  if (!wp || (wp[0] === tx && wp[1] === ty)) moveToward(s, x, tx, ty, stopAt, factor);
  else moveToward(s, x, wp[0], wp[1], 0, factor);
}

/** 遠程（非衝鋒）攻擊需要視線；沒有障礙物時永遠 true */
function hasSight(s: BattleState, a: Unit, b: Unit): boolean {
  const g = gridOf(s.arena);
  return !g || clearLine(g, a.x, a.y, b.x, b.y, 0);
}

function face(x: Unit, t: Unit): void {
  const [fx, fy] = norm(t.x - x.x, t.y - x.y);
  x.facingX = fx;
  x.facingY = fy;
}

/** 簡單分離（依 id 順序，確定性）：Boss 不被推；閃避中的玩家可以穿過敵人 */
function separate(s: BattleState): void {
  const alive = s.units.filter((x) => !x.dead && x.mode !== 'dormant');
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i]!;
      const b = alive[j]!;
      if ((a.action?.kind === 'dodge') || (b.action?.kind === 'dodge')) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      const overlap = a.r + b.r - d;
      if (overlap <= 0) continue;
      const [nx, ny] = d === 0 ? [DIR, 0] : norm(b.x - a.x, b.y - a.y);
      // Boss 與不會動的（荊棘母樹 speed 0，D-107）推不動
      const heavyA = !!ENEMIES[a.defId]?.boss || ENEMIES[a.defId]?.speed === 0;
      const heavyB = !!ENEMIES[b.defId]?.boss || ENEMIES[b.defId]?.speed === 0;
      const pa = heavyA ? 0 : heavyB ? 1 : 0.5;
      const pb = heavyB ? 0 : heavyA ? 1 : 0.5;
      a.x -= Math.round((nx / DIR) * overlap * pa);
      a.y -= Math.round((ny / DIR) * overlap * pa);
      b.x += Math.round((nx / DIR) * overlap * pb);
      b.y += Math.round((ny / DIR) * overlap * pb);
      clampArena(s, a);
      clampArena(s, b);
    }
  }
}

// ---------------- 玩家 ----------------
function nearestEnemy(s: BattleState, p: Unit): Unit | undefined {
  let best: Unit | undefined;
  let bd = Infinity;
  for (const e of s.units) {
    if (e.dead || e === p || !hostile(p, e)) continue; // 不配置新陣列（V1 Q4）；多人時敵對的玩家也算（Q6）
    // 地圖怪（D-072／D-073）：自動追擊只找戰鬥中的怪；待機的要玩家點它（或技能打到）才開打，
    // 清完一組就停下來（自然恢復），不會自己走去拉下一群
    if (e.mode && e.mode !== 'combat') continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function currentTarget(s: BattleState, p: Unit): Unit | undefined {
  const t = unitById(s, p.targetId);
  if (t && !t.dead && t.mode !== 'returning') return t;
  const n = nearestEnemy(s, p);
  p.targetId = n?.id ?? null;
  return n;
}

function startSkill(s: BattleState, p: Unit, id: string, aim?: Unit): boolean {
  const sk = skillDef(s, id, p);
  if (!sk || p.dead || disabled(p, s.tick)) return false;
  if ((p.ready[id] ?? 0) > s.tick) return false;
  if (sk.mp && p.mp < sk.mp) return false;
  // D-348（Jacky：「技能應該可以重複施展，兩個都有效果、不會彼此中斷」）：已經有一招在放時，新的一招疊上去各自打完。
  // 位移技不能疊（一次只能往一個方向衝）；閃避中不能放。
  const stack = p.action?.kind === 'skill';
  if (p.action && p.action.kind !== 'attack' && !(stack && !sk.dash)) return false;
  if (p.action?.id === id || p.casts?.some((c) => c.id === id)) return false;
  const t = aim ?? currentTarget(s, p);
  if (t && !stack) face(p, t);
  const cdPct = Math.min(SKILL_MOD_CAPS.cdPct, Math.max(0, modsOf(s, p)?.[id]?.cdPct ?? 0));
  p.ready[id] = s.tick + (cdPct ? Math.round((sk.cooldownTicks * (100 - cdPct)) / 100) : sk.cooldownTicks); // 冷卻從施放開始計
  if (sk.mp) p.mp -= sk.mp;
  // 疊放的招有自己的方向（朝它的目標），不改主角的面向——正在放的那一招方向不受影響
  const [sdx, sdy] = stack && t ? norm(t.x - p.x, t.y - p.y) : [p.facingX, p.facingY];
  const act: Action = { kind: 'skill', id, start: s.tick, end: s.tick + sk.castTicks, dirX: sdx, dirY: sdy, ox: p.x, oy: p.y, hitIds: [], targetId: t?.id };
  if (stack) (p.casts ??= []).push(act);
  else p.action = act;
  emit(s, aim ? { tick: s.tick, type: 'cast', id: p.id, skill: id, auto: true } : { tick: s.tick, type: 'cast', id: p.id, skill: id });
  if (sk.guard) {
    // 攻守一體（D-345）：護盾在施放的瞬間就有（不看時機）；同一層護盾取大、不疊加
    const amount = guardAmount(s, id, p);
    const until = s.tick + sk.guard.ticks;
    const cur = p.statuses.find((q) => q.id === 'shield');
    if (cur) {
      cur.value = Math.max(cur.until > s.tick ? cur.value : 0, amount);
      cur.until = Math.max(cur.until, until);
    } else p.statuses.push({ id: 'shield', until, stacks: 1, value: amount, srcId: p.id, next: 0 });
    emit(s, { tick: s.tick, type: 'guard', id: p.id, skill: id, amount, ticks: sk.guard.ticks });
    if (s.bless && !p.pid) for (const e of blessEffects(s)) if (e.onGuard) blessBurst(s, p, p.x, p.y, e.onGuard.burst, e.id);
  }
  return true;
}

function startDodge(s: BattleState, p: Unit, dx: number, dy: number): boolean {
  const pd = playerDef(s, p);
  if (p.dead || disabled(p, s.tick) || (p.ready['dodge'] ?? 0) > s.tick) return false;
  // 格擋有效窗口內不能用閃避取消
  const a = p.action;
  if (a?.kind === 'skill' && skillDef(s, a.id, p)?.block && s.tick - a.start <= blockWindow(s, a.id, p)) return false;
  const [fx, fy] = dx === 0 && dy === 0 ? [-p.facingX, -p.facingY] : norm(dx, dy);
  p.ready['dodge'] = s.tick + pd.dodge.cooldownTicks;
  p.action = { kind: 'dodge', id: 'dodge', start: s.tick, end: s.tick + pd.dodge.ticks, dirX: fx, dirY: fy, ox: p.x, oy: p.y };
  p.invulnUntil = s.tick + pd.dodge.invulnTo;
  emit(s, { tick: s.tick, type: 'dodge', id: p.id });
  if (s.bless && !p.pid) {
    // 先炸殘影、再給「下一擊必暴」（不然殘影的第一下會把必暴用掉）
    const fx = blessEffects(s);
    for (const e of fx) if (e.onDodge?.burst) blessBurst(s, p, p.x, p.y, e.onDodge.burst, e.id);
    for (const e of fx) if (e.onDodge?.critTicks) s.bless.critUntil = s.tick + e.onDodge.critTicks;
  }
  return true;
}

function applyCommands(s: BattleState, cmds: readonly BattleCommand[]): void {
  s.manualMove = null;
  for (const o of s.others ?? []) o.manualMove = null;
  for (const c of cmds) {
    const p = playerOf(s, c.pid ?? 0);
    if (!p) continue;
    const ctl = ctlOf(s, p);
    if (c.type === 'move') {
      ctl.manualMove = c.dx === 0 && c.dy === 0 ? null : { dx: c.dx, dy: c.dy };
      if (ctl.manualMove) ctl.moveGoal = null;
    }
    else if (c.type === 'stop') ctl.manualMove = null;
    else if (c.type === 'target') {
      p.targetId = c.id;
      ctl.moveGoal = null;
    } else if (c.type === 'moveTo') setMoveGoal(s, p, c.x, c.y);
    else if (c.type === 'skill') startSkill(s, p, c.id);
    else if (c.type === 'dodge') startDodge(s, p, c.dx, c.dy);
    else if (c.type === 'potion') drinkPotion(s, p);
    else if (c.type === 'rest') restAtCampfire(s, p);
    else if (c.type === 'bless' && !c.pid) blessCommand(s, c);
  }
}

// ---------------- 營火（design/20 B4） ----------------
const campfiresOf = (s: BattleState) => STAGES[s.stageId]?.campfires ?? [];

function campfireNear(s: BattleState, x: number, y: number, units: number) {
  return campfiresOf(s).find((c) => dist(c.x, c.y, x, y) <= units * UNIT);
}

/** 玩家在營火安全範圍內：怪不追進來、也不會在這裡被吵醒 */
const inSafeZone = (s: BattleState, p: Unit): boolean => !!campfireNear(s, p.x, p.y, CAMPFIRE_RULES.safeUnits);

function restAtCampfire(s: BattleState, p: Unit): boolean {
  const c = campfireNear(s, p.x, p.y, CAMPFIRE_RULES.restUnits);
  if (!c || p.dead || s.units.some((e) => e.side === 'enemy' && !e.dead && e.mode === 'combat')) return false;
  p.hp = p.maxHp;
  p.statuses = [];
  const ctl = ctlOf(s, p);
  ctl.potions = Math.max(ctl.potions, playerDef(s, p).potion.carry);
  ctl.campfireId = c.id;
  ctl.moveGoal = null;
  emit(s, { tick: s.tick, type: 'rest', id: p.id, campfire: c.id });
  if (!p.pid) clearBless(s, 'rest');
  return true;
}

/** 倒下 → 在最後休息的營火復活：HP 全滿、3 秒無敵，戰鬥中的怪全部脫戰回家 */
function reviveAtCampfire(s: BattleState, p: Unit): boolean {
  const fires = campfiresOf(s);
  if (!STAGES[s.stageId]?.reviveAtCampfire || !fires.length) return false;
  const ctl = ctlOf(s, p);
  const c = fires.find((f) => f.id === ctl.campfireId) ?? fires[0]!;
  p.dead = false;
  p.hp = p.maxHp;
  p.statuses = [];
  p.action = null;
  p.targetId = null;
  // 第 88 輪（D-225）：醒來也補藥水（和休息一樣補到攜帶上限）。以前藥水喝光倒下 → 醒來 0 瓶，要自己再點火堆才補，
  // 新手常直接走回去又倒一次；休息本來就免費，這一步只是多餘的操作
  ctl.potions = Math.max(ctl.potions, playerDef(s, p).potion.carry);
  p.x = c.x;
  p.y = c.y + UNIT;
  clampArena(s, p);
  p.invulnUntil = s.tick + CAMPFIRE_RULES.reviveInvulnTicks;
  ctl.moveGoal = null;
  s.revives = (s.revives ?? 0) + 1;
  if (s.streak) s.streak = 0;
  for (const e of s.units) {
    if (e.side !== 'enemy' || e.dead || e.mode !== 'combat') continue;
    e.mode = 'returning';
    e.action = null;
    e.statuses = [];
  }
  s.telegraphs = [];
  emit(s, { tick: s.tick, type: 'revive', id: p.id, campfire: c.id });
  if (!p.pid) clearBless(s, 'down');
  return true;
}

/** 點地移動：夾在場地內；點到石頭上就忽略（D-071） */
function setMoveGoal(s: BattleState, p: Unit, x: number, y: number): void {
  const gx = Math.min(s.arena.w - p.r, Math.max(p.r, Math.round(x)));
  const gy = Math.min(s.arena.h - p.r, Math.max(p.r, Math.round(y)));
  if (s.arena.solid && isSolidAt(s.arena.solid, gx, gy)) return;
  const g = gridOf(s.arena);
  if (g && flowField(g, cellIndex(g, gx, gy))[cellIndex(g, p.x, p.y)]! < 0) return; // 走不到
  // 最多走 10 秒（被怪擋住到不了時，自動恢復追擊）
  ctlOf(s, p).moveGoal = { x: gx, y: gy, until: s.tick + 10 * TICKS_PER_SEC };
}

/** 喝藥水：瞬間回復、不打斷動作；滿血、沒藥、冷卻中、倒下或暈眩時無效 */
function drinkPotion(s: BattleState, p: Unit): boolean {
  const pt = playerDef(s, p).potion;
  const ctl = ctlOf(s, p);
  if (p.dead || disabled(p, s.tick) || ctl.potions <= 0 || p.hp >= p.maxHp) return false;
  if ((p.ready['potion'] ?? 0) > s.tick) return false;
  const heal = Math.min(p.maxHp - p.hp, Math.round((p.maxHp * pt.healPct) / 100));
  p.hp += heal;
  ctl.potions--;
  p.ready['potion'] = s.tick + pt.cooldownTicks;
  emit(s, { tick: s.tick, type: 'potion', id: p.id, heal, left: ctl.potions });
  return true;
}

/** 套上範圍修正後的技能形狀（areaPct；沒有修正就回傳原物件） */
export function skillShape(s: BattleState, skillId: string, shape: Shape, p?: Unit): Shape {
  const m = modsOf(s, p)?.[skillId];
  // D-346：第 3 欄換成不位移的招後，「位移距離」修正（技能點、舊裝備）在沒有位移的招上併進範圍（合計照範圍上限截斷）
  const dist = m?.distPct && !skillDef(s, skillId, p)?.dash ? Math.max(0, m.distPct) : 0;
  const pct = Math.min(SKILL_MOD_CAPS.areaPct, Math.max(0, m?.areaPct ?? 0) + dist);
  if (!pct) return shape;
  const k = (n: number) => Math.round((n * (100 + pct)) / 100);
  switch (shape.type) {
    case 'circle':
      return { type: 'circle', r: k(shape.r) };
    case 'sector':
      return { type: 'sector', r: k(shape.r), deg: shape.deg };
    case 'line':
      return { type: 'line', len: k(shape.len), width: shape.width };
    case 'ring':
      return { type: 'ring', rIn: shape.rIn, rOut: k(shape.rOut) };
  }
}

/** 攻守一體的護盾量（D-345）：最大 HP × hpPct%，技能修正的 blockTicks 每點再 +5%；上限最大 HP 的一半 */
export function guardAmount(s: BattleState, skillId: string, p: Unit): number {
  const g = skillDef(s, skillId, p)?.guard;
  if (!g) return 0;
  const pts = Math.min(SKILL_MOD_CAPS.blockTicks, Math.max(0, Math.floor(modsOf(s, p)?.[skillId]?.blockTicks ?? 0)));
  return Math.min(Math.floor(p.maxHp / 2), Math.floor((p.maxHp * g.hpPct * (100 + GUARD_PCT_PER_POINT * pts)) / 10000));
}

/** 格擋有效窗口（ticks），含裝備的 blockTicks */
export function blockWindow(s: BattleState, skillId: string, p?: Unit): number {
  const b = skillDef(s, skillId, p)?.block;
  if (!b) return -1;
  return b.windowTicks + Math.min(SKILL_MOD_CAPS.blockTicks, Math.max(0, Math.floor(modsOf(s, p)?.[skillId]?.blockTicks ?? 0)));
}

/** 位移技能的總距離（含 distPct） */
export function dashDistance(s: BattleState, skillId: string, p?: Unit): number {
  const d = skillDef(s, skillId, p)?.dash;
  if (!d) return 0;
  const pct = Math.min(SKILL_MOD_CAPS.distPct, Math.max(0, modsOf(s, p)?.[skillId]?.distPct ?? 0));
  return pct ? Math.round((d.distance * (100 + pct)) / 100) : d.distance;
}

function resolveSkillHit(s: BattleState, p: Unit, a: Action, h: SkillHit, skillId: string, origin: 'skill' | 'counter'): void {
  const shape = skillShape(s, skillId, h.shape, p);
  for (const e of s.others?.length ? foesOf(s, p) : enemiesOf(s)) {
    if (h.oncePerTarget && a.hitIds?.includes(e.id)) continue;
    if (!inShape(shape, h.ahead ? p.x + Math.round((a.dirX * h.ahead) / DIR) : p.x, h.ahead ? p.y + Math.round((a.dirY * h.ahead) / DIR) : p.y, a.dirX, a.dirY, e.x, e.y, e.r)) continue;
    a.hitIds?.push(e.id);
    const dmgPct = modsOf(s, p)?.[skillId]?.dmgPct ?? 0;
    const mult = dmgPct ? Math.round((h.mult * (100 + dmgPct)) / 100) : h.mult;
    dealDamage(s, p, e, mult, origin, skillId);
    if (h.status && !e.dead) addStatus(s, e, h.status, p);
    // 祝福：技能命中的追加效果（P2；反擊不算）
    if (s.bless && !p.pid && origin === 'skill') {
      for (const fx of blessEffects(s)) {
        const k = fx.onSkillHit;
        if (!k || (k.skill && k.skill !== skillId) || e.dead) continue;
        if (k.status) addStatus(s, e, k.status, p);
        if (k.echoPct) {
          emit(s, { tick: s.tick, type: 'blessProc', id: fx.id, x: e.x, y: e.y });
          dealDamage(s, p, e, Math.max(1, Math.round((mult * k.echoPct) / 100)), 'skill', fx.id);
        }
      }
    }
  }
}

/** 施放中自己走位的最低速度比例（D-347）：原本會定住的招（moveFactor 0）也能用這個速度走 */
export const MOVE_CAST_FACTOR = 0.6;

/**
 * 邊走邊打（D-347，Jacky：「移動的時候不能攻擊或放技能很怪」）：玩家自己在走（搖桿／點地）時，普攻冷卻好了、
 * 射程內有對象就照樣出手，不停下來、不追過去。對象＝目前鎖定的（在射程內）否則射程內最近的「交戰中」敵人——不會把路過的睡著的怪打醒。
 */
function moveAttack(s: BattleState, p: Unit, pd: PlayerDefinition): void {
  if (s.pvp || s.tick < p.nextAttackTick) return;
  let t = unitById(s, p.targetId);
  const inReach = (e: Unit): boolean => dist(p.x, p.y, e.x, e.y) <= pd.attackRange + p.r + e.r;
  if (!t || t.dead || t.mode === 'returning' || !inReach(t)) {
    t = undefined;
    let bd = Infinity;
    for (const e of s.others?.length ? foesOf(s, p) : enemiesOf(s)) {
      if (e.dead || (e.mode && e.mode !== 'combat') || !inReach(e)) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < bd) {
        bd = d;
        t = e;
      }
    }
  }
  if (!t) return;
  const [fx, fy] = norm(t.x - p.x, t.y - p.y);
  p.nextAttackTick = s.tick + pd.attackIntervalTicks;
  p.action = { kind: 'attack', id: 'attack', start: s.tick, end: s.tick + pd.attackWindupTicks + pd.attackRecoverTicks, dirX: fx, dirY: fy, ox: p.x, oy: p.y, targetId: t.id };
}

function updatePlayer(s: BattleState, p: Unit = playerOf(s)): void {
  if (p.dead || disabled(p, s.tick)) return;
  const ctl = ctlOf(s, p);
  const pd = playerDef(s, p);
  // 疊放中的技能（D-348）：各自照時間打自己的每一段，不管主角現在在做什麼（走路、普攻、放別招、閃避）
  if (p.casts?.length) {
    for (const c of p.casts) {
      const sk = skillDef(s, c.id, p);
      if (!sk) continue;
      const k = s.tick - c.start;
      if (sk.aimTicks && k < sk.aimTicks) {
        const t = unitById(s, c.targetId);
        if (t && !t.dead) [c.dirX, c.dirY] = norm(t.x - p.x, t.y - p.y);
      }
      for (const h of sk.hits) if (h.atTick === k) resolveSkillHit(s, p, c, h, c.id, 'skill');
    }
    p.casts = p.casts.filter((c) => s.tick < c.end);
    if (!p.casts.length) delete p.casts;
  }
  const a = p.action;
  if (a) {
    const k = s.tick - a.start;
    if (a.kind === 'dodge') {
      const step = Math.round(pd.dodge.distance / pd.dodge.ticks);
      p.x += Math.round((a.dirX / DIR) * step);
      p.y += Math.round((a.dirY / DIR) * step);
      clampArena(s, p);
    } else if (a.kind === 'skill') {
      const sk = skillDef(s, a.id, p)!;
      if (sk.dash && k >= sk.dash.fromTick && k < sk.dash.fromTick + sk.dash.ticks) {
        const step = Math.round(dashDistance(s, a.id, p) / sk.dash.ticks);
        p.x += Math.round((a.dirX / DIR) * step);
        p.y += Math.round((a.dirY / DIR) * step);
        clampArena(s, p);
      } else if (ctl.manualMove) {
        // D-347：施放中一律可以自己走（原本會定住的招用 MOVE_CAST_FACTOR 的速度）；方向在施放時就鎖定，走位不會改變打的方向
        const [fx, fy] = norm(ctl.manualMove.dx, ctl.manualMove.dy);
        moveDir(s, p, fx, fy, Math.max(sk.moveFactor, MOVE_CAST_FACTOR));
      } else if (ctl.moveGoal) navToward(s, p, ctl.moveGoal.x, ctl.moveGoal.y, 0, Math.max(sk.moveFactor, MOVE_CAST_FACTOR));
      else if (sk.moveFactor > 0) {
        // 施放中自動貼近目標：近戰照舊貼上去；遠程（長弓／法杖）已經在普攻射程內就不再靠近（D-349，Jacky：「到攻擊範圍內就不用再靠近了」）
        const t = currentTarget(s, p);
        if (t) {
          const ranged = !s.pvp && pd.attackRange >= 3 * UNIT; // 競技場先照舊（遠程不貼近會讓三武器互打一面倒，等平衡一起調）
          const stop = ranged ? pd.attackRange + p.r + t.r - 10 : p.r + t.r;
          if (!ranged || dist(p.x, p.y, t.x, t.y) > stop) navToward(s, p, t.x, t.y, stop, sk.moveFactor);
        }
      }
      if (sk.aimTicks && k < sk.aimTicks) {
        const t = currentTarget(s, p);
        if (t) {
          face(p, t);
          a.dirX = p.facingX;
          a.dirY = p.facingY;
        }
      }
      for (const h of sk.hits) if (h.atTick === k) resolveSkillHit(s, p, a, h, a.id, 'skill');
    } else if (a.kind === 'attack') {
      // D-347：普攻不再把人定住——出手前後都可以邊走邊打（以前出手前走不動、命中後移動只能取消後搖）
      // 競技場先維持舊規則（出手前走不動、命中後移動取消後搖）：邊退邊射會讓遠程一面倒，等平衡一起調
      if (s.pvp) {
        if ((ctl.manualMove || ctl.moveGoal) && k > pd.attackWindupTicks) p.action = null;
      } else if (ctl.manualMove) {
        const [fx, fy] = norm(ctl.manualMove.dx, ctl.manualMove.dy);
        moveDir(s, p, fx, fy);
      } else if (ctl.moveGoal) {
        if (dist(p.x, p.y, ctl.moveGoal.x, ctl.moveGoal.y) <= 12 || s.tick >= ctl.moveGoal.until) ctl.moveGoal = null;
        else navToward(s, p, ctl.moveGoal.x, ctl.moveGoal.y, 0);
      }
      if (p.action && k === pd.attackWindupTicks) {
        const t = unitById(s, a.targetId);
        if (t && !t.dead && dist(p.x, p.y, t.x, t.y) <= pd.attackRange + p.r + t.r + 30) {
          const dealt = dealDamage(s, p, t, 100, 'normal', 'attack');
          // 祝福：普攻命中的追加效果（P2）
          if (dealt > 0 && s.bless && !p.pid) {
            for (const fx of blessEffects(s)) {
              const k = fx.onAttack;
              if (!k) continue;
              if (k.status && !t.dead) addStatus(s, t, k.status, p);
              // 每第 n 下（拿到這個祝福之後才開始數；清空祝福時一起歸零）
              if (k.every && (s.bless.hits = (s.bless.hits ?? 0) + 1) % k.every.n === 0) blessBurst(s, p, t.x, t.y, k.every.burst, fx.id);
            }
          }
        }
      }
    }
    if (p.action && s.tick >= p.action.end) p.action = null;
    if (p.action) return;
  }
  // 沒有動作：手動移動優先（暫停自動追擊；design/19 方案 A）
  if (ctl.manualMove) {
    const [fx, fy] = norm(ctl.manualMove.dx, ctl.manualMove.dy);
    p.facingX = fx;
    p.facingY = fy;
    moveDir(s, p, fx, fy);
    moveAttack(s, p, pd); // D-347：邊走邊打
    return;
  }
  // 點地移動中：走到目的地（期間不自動追擊），到了就恢復自動追擊
  if (ctl.moveGoal) {
    if (dist(p.x, p.y, ctl.moveGoal.x, ctl.moveGoal.y) <= 12 || s.tick >= ctl.moveGoal.until) ctl.moveGoal = null;
    else {
      navToward(s, p, ctl.moveGoal.x, ctl.moveGoal.y, 0);
      moveAttack(s, p, pd);
      return;
    }
  }
  const t = currentTarget(s, p);
  if (!t) return;
  const reach = pd.attackRange + p.r + t.r;
  const d = dist(p.x, p.y, t.x, t.y);
  if (d > reach) {
    navToward(s, p, t.x, t.y, reach - 10);
    return;
  }
  face(p, t);
  if (s.tick >= p.nextAttackTick) {
    p.nextAttackTick = s.tick + pd.attackIntervalTicks; // 放技能不重置普攻冷卻
    p.action = { kind: 'attack', id: 'attack', start: s.tick, end: s.tick + pd.attackWindupTicks + pd.attackRecoverTicks, dirX: p.facingX, dirY: p.facingY, ox: p.x, oy: p.y, targetId: t.id };
  }
}

// ---------------- 敵人 ----------------
// ---------------- 地圖怪：待機／戰鬥／返回（D-072，design/20 B1） ----------------
function aggro(s: BattleState, e: Unit): void {
  if (e.mode !== 'idle' && e.mode !== 'dormant') return;
  e.mode = 'combat';
  e.engagedTick = s.tick;
  e.aggroTick = s.tick;
  e.nextAttackTick = Math.max(e.nextAttackTick, s.tick + 15); // 發現後 0.5 秒才出手
  emit(s, { tick: s.tick, type: 'aggro', id: e.id });
  // 同伴連鎖：附近 3 單位內待機的一起醒（狼群）
  for (const o of s.units) if (o.side === 'enemy' && !o.dead && (o.mode === 'idle' || o.mode === 'dormant') && dist(o.x, o.y, e.x, e.y) <= 3 * UNIT) aggro(s, o);
}

/** 回傳 true＝這個 tick 由地圖行為處理完（不跑戰鬥 AI） */
function mapAi(s: BattleState, e: Unit, p: Unit): boolean {
  const rule = AGGRO_RULES[e.tier ?? 'normal'];
  const aggroR = aggroUnitsOf(e);
  const hx = e.homeX ?? e.x;
  const hy = e.homeY ?? e.y;
  if (e.mode === 'idle') {
    if (!p.dead && (s.tick + e.id) % 6 === 0 && !inSafeZone(s, p) && dist(e.x, e.y, p.x, p.y) <= aggroR * UNIT + p.r && hasSight(s, e, p)) aggro(s, e);
    if (e.mode === 'idle' && e.patrol) patrolStep(s, e);
    return e.mode === 'idle';
  }
  if (e.mode === 'returning') {
    if (dist(e.x, e.y, hx, hy) <= 20) {
      e.mode = 'idle';
      e.hp = e.maxHp;
      e.statuses = [];
      if (ENEMIES[e.defId]?.boss) resetBoss(s, e);
      emit(s, { tick: s.tick, type: 'reset', id: e.id });
    } else navToward(s, e, hx, hy, 0, 1.3);
    return true;
  }
  // Boss 區域：玩家跑出去 → Boss 回家（回到原位時整場重置）
  const zone = STAGES[s.stageId]?.bossZone;
  if (zone && ENEMIES[e.defId]?.boss && !e.action && dist(p.x, p.y, zone.x, zone.y) > zone.r) {
    e.mode = 'returning';
    e.statuses = [];
    s.telegraphs = s.telegraphs.filter((t) => t.ownerId !== e.id);
    emit(s, { tick: s.tick, type: 'leash', id: e.id });
    return true;
  }
  // 巡邏怪不進 Boss 地盤（D-117）：玩家跑進 Boss 區域就放棄（避免巡獵者和 Boss 一起夾擊）
  if (zone && e.patrol && !e.action && dist(p.x, p.y, zone.x, zone.y) <= zone.r) {
    e.mode = 'returning';
    e.statuses = [];
    s.telegraphs = s.telegraphs.filter((t) => t.ownerId !== e.id);
    emit(s, { tick: s.tick, type: 'leash', id: e.id });
    return true;
  }
  // 戰鬥中：在仇恨範圍內就算還在交手
  if (dist(e.x, e.y, p.x, p.y) <= aggroR * UNIT + p.r) e.engagedTick = s.tick;
  const tooFar = dist(e.x, e.y, hx, hy) > rule.chase * UNIT;
  const bored = s.tick - (e.engagedTick ?? s.tick) > rule.waitSec * TICKS_PER_SEC;
  if (!e.action && (tooFar || bored || p.dead || inSafeZone(s, p))) {
    e.mode = 'returning';
    e.statuses = [];
    s.telegraphs = s.telegraphs.filter((t) => t.ownerId !== e.id);
    emit(s, { tick: s.tick, type: 'leash', id: e.id });
    return true;
  }
  // 同時追擊上限：排在 8 隻之後的在外圈等，不出手（正在出招的先把招出完）
  if (!e.action && queuedBehind(s, e)) {
    e.engagedTick = s.tick; // 排隊不算脫戰
    face(e, p);
    if (!disabled(e, s.tick) && dist(e.x, e.y, p.x, p.y) > MAP_AI_LIMITS.queueHoldUnits * UNIT) navToward(s, e, p.x, p.y, MAP_AI_LIMITS.queueHoldUnits * UNIT);
    return true;
  }
  return false;
}

/** 巡邏（D-117）：慢走到下一個點，到了換下一個；家跟著走（脫戰回到離開路徑的地方） */
const PATROL = { factor: 0.5, arriveUnits: 0.4 };
function patrolStep(s: BattleState, e: Unit): void {
  const path = e.patrol!;
  let i = (e.patrolIdx ?? 0) % path.length;
  if (dist(e.x, e.y, path[i]!.x, path[i]!.y) <= PATROL.arriveUnits * UNIT) {
    i = (i + 1) % path.length;
    e.patrolIdx = i;
  }
  const wp = path[i]!;
  navToward(s, e, wp.x, wp.y, 0, PATROL.factor);
  e.homeX = e.x;
  e.homeY = e.y;
}

/** Boss 整場重置（design/20 B1）：回第一階段、冷卻與召喚計時歸零、召喚物消失 */
function resetBoss(s: BattleState, b: Unit): void {
  b.phase = 1;
  b.ready = {};
  b.action = null;
  b.nextAttackTick = s.tick + 15;
  b.nextSummonTick = Number.MAX_SAFE_INTEGER;
  for (let i = s.units.length - 1; i >= 0; i--) {
    const m = s.units[i]!;
    if (m.summonedBy !== b.id) continue;
    s.units.splice(i, 1);
    s.telegraphs = s.telegraphs.filter((t) => t.ownerId !== m.id);
    if (!m.dead) emit(s, { tick: s.tick, type: 'despawn', id: m.id });
  }
}

/** 戰鬥中、比自己先醒（同 tick 比 id）的怪已經有 maxChasers 隻 → 排隊 */
function queuedBehind(s: BattleState, e: Unit): boolean {
  const at = e.aggroTick ?? 0;
  let ahead = 0;
  for (const o of s.units) {
    if (o === e || o.side !== 'enemy' || o.dead || o.mode !== 'combat') continue;
    const ot = o.aggroTick ?? 0;
    if (ot < at || (ot === at && o.id < e.id)) if (++ahead >= MAP_AI_LIMITS.maxChasers) return true;
  }
  return false;
}

/** 沉睡判定（每 10 ticks 依 id 錯開）：待機怪離玩家超過 24 單位就沉睡，回到範圍內變回待機 */
function updateDormancy(s: BattleState, e: Unit, p: Unit): void {
  if ((s.tick + e.id) % MAP_AI_LIMITS.dormantCheckEvery !== 0) return;
  if (e.mode !== 'idle' && e.mode !== 'dormant') return;
  const far = dist(e.x, e.y, p.x, p.y) > MAP_AI_LIMITS.dormantUnits * UNIT;
  e.mode = far ? 'dormant' : 'idle';
}

/** 這隻怪能用的招式：原本的＋精英詞綴專屬招（D-118）；合併結果快取起來，不每 tick 配置 */
const attackCache = new Map<string, readonly AreaAttack[]>();
export function attacksOf(e: { defId: string; affix?: EliteAffix }): readonly AreaAttack[] {
  const def = ENEMIES[e.defId];
  if (!def) return [];
  if (!e.affix) return def.attacks;
  const key = `${e.defId}|${e.affix}`;
  let v = attackCache.get(key);
  if (!v) attackCache.set(key, (v = [...def.attacks, ...AFFIX_ATTACKS[e.affix]]));
  return v;
}

function pickAttack(s: BattleState, e: Unit, def: EnemyDefinition, d: number, target: Unit): AreaAttack | undefined {
  const sight = hasSight(s, e, target);
  // 隔著石頭不能射擊（衝鋒例外：隔石衝鋒會撞上石頭暈眩，是可利用的弱點）
  const ok = (e.affix ? attacksOf(e) : def.attacks).filter((a) => a.weight > 0 && (!a.furyOnly || !!e.fury) && (!a.phase2Only || e.phase === 2) && (e.ready[a.id] ?? 0) <= s.tick && d <= a.triggerRange + target.r && (sight || !!a.charge));
  if (ok.length === 0) return undefined;
  const total = ok.reduce((n, a) => n + a.weight, 0);
  let r = nextRand(s) * total;
  for (const a of ok) {
    r -= a.weight;
    if (r < 0) return a;
  }
  return ok[ok.length - 1];
}

function enemyHit(s: BattleState, e: Unit, atk: AreaAttack, p: Unit): void {
  // 格擋反擊：窗口內、可格擋 → 減傷並立即反擊
  const a = p.action;
  const sk = a?.kind === 'skill' ? skillDef(s, a.id, p) : undefined;
  if (a && sk?.block && atk.blockable && !a.blocked && s.tick - a.start <= blockWindow(s, a.id, p)) {
    a.blocked = true;
    emit(s, { tick: s.tick, type: 'block', id: p.id, attack: atk.id });
    gainMp(s, p, playerDef(s, p).mpGain.block);
    dealDamage(s, e, p, atk.damageMultiplier, 'enemy', atk.id, sk.block.reducePct);
    face(p, e);
    a.dirX = p.facingX;
    a.dirY = p.facingY;
    resolveSkillHit(s, p, a, sk.block.counter, a.id, 'counter');
    return;
  }
  dealDamage(s, e, p, atk.damageMultiplier, 'enemy', atk.id);
  if (atk.status && !p.dead && p.invulnUntil < s.tick) addStatus(s, p, atk.status, e);
}

function startEnemyAttack(s: BattleState, e: Unit, def: EnemyDefinition, atk: AreaAttack, p: Unit): void {
  if (atk.blink) {
    // 霧中瞬移（D-105）：閃到玩家背後（玩家面向的反方向）；落點是樹就留在原地
    const fromX = e.x;
    const fromY = e.y;
    const nx = p.x - Math.round((p.facingX / DIR) * atk.blink.behind);
    const ny = p.y - Math.round((p.facingY / DIR) * atk.blink.behind);
    const solid = s.arena.solid;
    if (!solid || !isSolidAt(solid, nx, ny)) {
      e.x = nx;
      e.y = ny;
      clampArena(s, e);
      emit(s, { tick: s.tick, type: 'blink', id: e.id, fromX, fromY });
    }
  }
  face(e, p);
  let cd = e.phase === 2 && def.boss ? Math.round((atk.cooldownTicks * def.boss.phase2CooldownPct) / 100) : atk.cooldownTicks;
  if (e.fury) cd = Math.round((cd * (100 - (STAGES[s.stageId]?.bossZone?.fury?.cdPct ?? 0))) / 100);
  if (e.affix) cd = Math.round((cd * (100 - (ELITE_AFFIXES[e.affix].cdPct ?? 0))) / 100);
  e.ready[atk.id] = s.tick + cd;
  e.nextAttackTick = s.tick + atk.warningTicks + atk.recoverTicks + (atk.charge?.ticks ?? 0);
  const ox = atk.atTarget ? p.x : e.x;
  const oy = atk.atTarget ? p.y : e.y;
  e.action = { kind: 'enemyAttack', id: atk.id, start: s.tick, end: s.tick + atk.warningTicks + atk.recoverTicks, dirX: e.facingX, dirY: e.facingY, ox, oy, hitIds: [] };
  s.telegraphs.push({ ownerId: e.id, attackId: atk.id, shape: atk.shape, ox, oy, dirX: e.facingX, dirY: e.facingY, hitTick: s.tick + atk.warningTicks, startTick: s.tick, blockable: atk.blockable });
  emit(s, { tick: s.tick, type: 'telegraph', owner: e.id, attack: atk.id });
}

/** 召喚墜星（第 31 輪）：落點裡追著你的一般怪也會被砸（算玩家的擊殺，跟噴發口一樣）；Boss 與待機的怪不算 */
function splashEnemies(s: BattleState, e: Unit, atk: AreaAttack, ox: number, oy: number, p: Unit): void {
  for (const x of s.units) {
    if (x.dead || x.side !== 'enemy' || x.id === e.id || ENEMIES[x.defId]?.boss) continue;
    if (x.mode !== undefined && x.mode !== 'combat') continue;
    if (!inShape(atk.shape, ox, oy, 0, 0, x.x, x.y, x.r * 0.5)) continue;
    applyHp(s, p, x, Math.max(1, Math.round((x.maxHp * atk.hitsEnemiesPct!) / 100)), false, 'dot', 'vent');
  }
}

function updateEnemy(s: BattleState, e: Unit): void {
  const def = ENEMIES[e.defId]!;
  const p = enemyTargetOf(s, e);
  // Boss 階段與召喚
  if (def.boss) {
    if (e.phase === 1 && e.hp * 100 <= e.maxHp * def.boss.phase2AtPct) {
      e.phase = 2;
      emit(s, { tick: s.tick, type: 'phase2', id: e.id });
      if (def.boss.summon) e.nextSummonTick = s.tick + 30;
    }
    if (def.boss.summon && s.tick >= e.nextSummonTick && !e.action) {
      const sm = def.boss.summon;
      e.nextSummonTick = s.tick + sm.everyTicks;
      const minion = ENEMIES[sm.enemyId]!;
      for (let k = 0; k < sm.count; k++) {
        const m = makeEnemy(s, minion, e.x + (k % 2 === 0 ? -1 : 1) * 160, e.y - 60);
        clampArena(s, m);
        m.nextAttackTick = s.tick + 30;
        if (e.mode) {
          // 地圖上的 Boss：召喚物直接進戰鬥、家在 Boss 原位，Boss 重置時消失
          m.summonedBy = e.id;
          m.mode = 'combat';
          m.tier = 'normal';
          m.homeX = e.homeX;
          m.homeY = e.homeY;
          m.engagedTick = s.tick;
          m.aggroTick = s.tick;
        }
        s.units.push(m);
      }
      emit(s, { tick: s.tick, type: 'summon', id: e.id, count: sm.count });
    }
  }
  if (e.mode && mapAi(s, e, p)) return;
  if (disabled(e, s.tick)) {
    // 蓄力中被暈／凍住＝這一招被打斷（第 167 輪）。以前直接 return：命中的那個 tick 被跳過，
    // 招式不會命中，但預告永遠留在場上（地上一塊填滿的紅色範圍、怪一直是蓄力中的樣子），直到牠死掉或脫戰。
    const w = e.action;
    if (w?.kind === 'enemyAttack' && s.telegraphs.some((t) => t.ownerId === e.id)) {
      s.telegraphs = s.telegraphs.filter((t) => t.ownerId !== e.id);
      e.action = null;
      emit(s, { tick: s.tick, type: 'interrupt', id: e.id, attack: w.id });
    }
    return;
  }
  const a = e.action;
  if (a) {
    const atk = attacksOf(e).find((x) => x.id === a.id)!;
    const hitTick = a.start + atk.warningTicks;
    if (a.kind === 'enemyAttack' && s.tick === hitTick) {
      s.telegraphs = s.telegraphs.filter((t) => !(t.ownerId === e.id && t.hitTick === hitTick));
      if (atk.charge) {
        a.kind = 'charge';
        a.end = s.tick + atk.charge.ticks + atk.recoverTicks;
      } else if (!s.others?.length) {
        if (!p.dead && inShape(atk.shape, a.ox, a.oy, a.dirX, a.dirY, p.x, p.y, p.r)) enemyHit(s, e, atk, p);
      } else for (const u of playersOf(s)) if (!u.dead && hostile(e, u) && inShape(atk.shape, a.ox, a.oy, a.dirX, a.dirY, u.x, u.y, u.r)) enemyHit(s, e, atk, u);
      if (atk.hitsEnemiesPct) splashEnemies(s, e, atk, a.ox, a.oy, p);
    }
    if (a.kind === 'charge' && atk.charge && atk.shape.type === 'line') {
      const k = s.tick - hitTick;
      if (k < atk.charge.ticks) {
        const step = Math.round(atk.shape.len / atk.charge.ticks);
        e.x += Math.round((a.dirX / DIR) * step);
        e.y += Math.round((a.dirY / DIR) * step);
        const wall = clampArena(s, e);
        // 只打預告範圍內的人（預告出現時位置固定，不偷偷追蹤）
        if (!a.hitIds?.includes(p.id) && !p.dead && dist(e.x, e.y, p.x, p.y) <= e.r + p.r + 20 && inShape(atk.shape, a.ox, a.oy, a.dirX, a.dirY, p.x, p.y, p.r)) {
          a.hitIds = [...(a.hitIds ?? []), p.id];
          enemyHit(s, e, atk, p);
        }
        if (wall) {
          // 弱點：衝鋒撞牆暈眩
          addStatus(s, e, { id: 'stun', ticks: atk.charge.wallStunTicks });
          emit(s, { tick: s.tick, type: 'wallStun', id: e.id });
          e.action = null;
          return;
        }
      }
    }
    if (e.action && s.tick >= e.action.end) {
      e.action = null;
      // 暴怒版接招（D-105）：例如衝完立刻回頭再衝一次
      const next = (e.fury || atk.followAlways) && atk.followUp && !p.dead ? attacksOf(e).find((x) => x.id === atk.followUp) : undefined;
      if (next) startEnemyAttack(s, e, def, next, p);
    }
    return;
  }
  if (s.tick < e.hitstunUntil || p.dead) return;
  const d = dist(e.x, e.y, p.x, p.y);
  // 決策每 6 ticks 一次（依 id 錯開）
  if ((s.tick + e.id) % 6 === 0 && s.tick >= e.nextAttackTick) {
    const atk = pickAttack(s, e, def, d, p);
    if (atk) {
      startEnemyAttack(s, e, def, atk, p);
      return;
    }
  }
  const closest = Math.min(...def.attacks.filter((x) => x.weight > 0 && !x.furyOnly && (!x.phase2Only || e.phase === 2)).map((x) => x.triggerRange));
  navToward(s, e, p.x, p.y, Math.max(e.r + p.r, closest * 0.85));
}

// ---------------- 主迴圈 ----------------
/** 推進一個 tick。順序固定：輸入 → 玩家 → 敵人（id 順序）→ 分離 → 狀態到期 → 勝負 */
export function step(s: BattleState, cmds: readonly BattleCommand[] = []): void {
  if (s.outcome !== 'running') return;
  s.tick++;
  if (s.pendingSkill) flushPendingSkill(s);
  if (s.bless?.fresh) applyBless(s);
  applyCommands(s, cmds);
  // 自動施放（P1）：排在玩家指令之後——這個 tick 玩家自己按了技能／閃避，就照玩家的
  for (const p of playersOf(s)) {
    if (!ctlOf(s, p).autoSkills) continue;
    const pick = autoPick(s, p);
    if (pick) startSkill(s, p, pick.id, pick.aim ?? currentTarget(s, p));
  }
  for (const p of playersOf(s)) updatePlayer(s, p);
  for (const e of s.units) {
    if (e.side !== 'enemy' || e.dead) continue;
    if (e.mode === 'idle' || e.mode === 'dormant') updateDormancy(s, e, enemyTargetOf(s, e));
    if (e.mode !== 'dormant') updateEnemy(s, e);
  }
  separate(s);
  for (const x of s.units) if (x.statuses.length && !x.dead) tickDots(s, x);
  for (const x of s.units) if (x.statuses.length) x.statuses = x.statuses.filter((st) => st.until > s.tick);
  const rpm = STAGES[s.stageId]?.rampPctPerMin;
  if (rpm && s.tick % (60 * TICKS_PER_SEC) === 0) emit(s, { tick: s.tick, type: 'ramp', minute: s.tick / (60 * TICKS_PER_SEC), pct: rampPct(s) });
  processRespawns(s);
  processBossRespawn(s);
  processRiot(s);
  processHiddenElite(s);
  processPickup(s);
  processChests(s);
  processHazards(s);
  processVents(s);
  let down = 0;
  const ps = playersOf(s);
  for (const p of ps) {
    naturalRegen(s, p);
    if (p.dead && !reviveAtCampfire(s, p)) down++;
  }
  if (down === ps.length) s.outcome = 'defeat';
  else if (s.pvp) {
    // PvP：主角那隊全倒＝敗、其他隊全倒＝勝
    const me = teamOf(s.units[0]!);
    const alive = (mine: boolean) => ps.some((u) => !u.dead && (teamOf(u) === me) === mine);
    if (!alive(true)) s.outcome = 'defeat';
    else if (!alive(false)) s.outcome = 'victory';
    else if (s.tick >= s.timeLimitTicks) s.outcome = 'timeout';
  }
  else if (!s.units.some((x) => x.side === 'enemy' && !x.dead) && !pendingRespawn(s)) s.outcome = 'victory';
  else if (s.tick >= s.timeLimitTicks) s.outcome = 'timeout';
}

/** 自然恢復（D-073）：只在開 regen（預設＝mapAi）的關卡；沒有戰鬥中的怪、且 5 秒沒受傷也沒出手 → 每秒回 2% */
const REGEN = { afterTicks: 5 * TICKS_PER_SEC, everyTicks: TICKS_PER_SEC, pct: 2 };
function naturalRegen(s: BattleState, p: Unit): void {
  const st = STAGES[s.stageId];
  if (!st || !(st.regen ?? st.mapAi) || p.dead || p.hp >= p.maxHp) return;
  const last = ctlOf(s, p).lastCombatTick ?? 0;
  if (s.tick - last < REGEN.afterTicks) return;
  if (s.units.some((e) => e.side === 'enemy' && !e.dead && e.mode === 'combat')) return;
  if ((s.tick - last) % REGEN.everyTicks !== 0) return;
  const heal = Math.min(p.maxHp - p.hp, Math.max(1, Math.round((p.maxHp * REGEN.pct) / 100)));
  p.hp += heal;
  emit(s, { tick: s.tick, type: 'regen', id: p.id, heal });
}

/** 狀態雜湊（FNV-1a 32 位元）：驗證同種子同輸入結果完全一致 */
export function stateHash(s: BattleState): string {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    let v = Math.round(n) | 0;
    for (let i = 0; i < 4; i++) {
      h ^= v & 0xff;
      h = Math.imul(h, 0x01000193);
      v >>>= 8;
    }
  };
  mix(s.tick);
  mix(s.rngState);
  for (const id of s.skillVariants ?? []) for (let i = 0; i < id.length; i++) mix(id.charCodeAt(i));
  for (const x of s.units) {
    mix(x.id);
    mix(x.x);
    mix(x.y);
    mix(x.hp);
    mix(x.mp);
    mix(x.dead ? 1 : 0);
  }
  if (s.moveGoal) {
    // 只有用到點地移動時才加入（舊紀錄的雜湊不變）
    mix(s.moveGoal.x);
    mix(s.moveGoal.y);
  }
  if (s.night) mix(7);
  if (s.bossFury || s.furyKills) {
    // 只有用到暴怒版時才加入
    mix(1 + (s.furyKills ?? 0));
  }
  if (s.campfireId || s.revives) {
    // 只有用到營火時才加入
    mix(s.revives ?? 0);
    for (const ch of s.campfireId ?? '') mix(ch.charCodeAt(0));
  }
  if (s.respawnAt) {
    // 只有用到重生點時才加入（舊紀錄的雜湊不變）
    for (const id of Object.keys(s.respawnAt).sort()) for (const t of s.respawnAt[id]!) mix(t);
  }
  if (s.prog) {
    // 只有開啟等級時才加入（舊紀錄的雜湊不變）
    mix(s.prog.level);
    mix(s.prog.xp);
  }
  if (s.bless) {
    // 只有開祝福時才加入
    mix(s.bless.meter);
    if (s.bless.hits) mix(s.bless.hits);
    for (const id of s.bless.perm ?? []) for (let i = 0; i < id.length; i++) mix(id.charCodeAt(i) + 7);
    for (const id of s.bless.taken) for (let i = 0; i < id.length; i++) mix(id.charCodeAt(i));
  }
  mix(s.events.length);
  mix(s.potions);
  return (h >>> 0).toString(16).padStart(8, '0');
}
