// 即時戰鬥引擎（design/19 §2、D-063 P1）：固定 30 ticks/秒、整數座標、種子亂數、事件依 (tick, 處理順序, id) 固定排序。
// 不依賴 Phaser；畫面層只能送 BattleCommand、讀 BattleState。
import { ENEMIES, SKILLS, SWORDSMAN, STAGES } from './data';
import type { Action, AreaAttack, BattleCommand, BattleEvent, BattleState, EnemyDefinition, LootId, PlayerDefinition, Shape, SkillHit, SpawnGroup, StageDefinition, StatusApply, StatusId, Unit } from './types';
import { AGGRO_RULES, CAMPFIRE_RULES, CHEST_RULES, LOOT_RULES, MAP_AI_LIMITS, RESPAWN_MIN_PLAYER_UNITS, STATUS_RULES, TICKS_PER_SEC, UNIT } from './types';
import { cellIndex, clearLine, flowField, gridOf, nextWaypoint } from './path';

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
      const cos = (vx * fx + vy * fy) / d;
      // 把目標半徑換算成角度寬容（貼邊也算中）
      const half = (sh.deg / 2) * (Math.PI / 180) + Math.asin(Math.min(1, pr / d));
      return cos >= Math.cos(Math.min(Math.PI, half));
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
}

export function createBattle(setup: BattleSetup): BattleState {
  const stage = STAGES[setup.stageId];
  if (!stage) throw new Error(`unknown stage ${setup.stageId}`);
  const pd = setup.player ?? SWORDSMAN;
  const s: BattleState = {
    tick: 0, rngState: (setup.seed >>> 0) || 1, units: [], telegraphs: [], events: [], nextId: 1, arena: stage.arena,
    stageId: stage.id, outcome: 'running', timeLimitTicks: stage.timeLimitTicks, manualMove: null,
    potions: setup.potions ?? pd.potion.carry,
  };
  // 打散初始種子
  for (let i = 0; i < 4; i++) nextRand(s);
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
  stage.enemies.forEach((_, i) => s.units.push(makeFixed(s, stage, i)));
  for (const g of stage.spawnGroups ?? []) {
    // 開場：等角度排在半徑 60% 的圓上（不用亂數，方便擺關卡）；石頭上的會被推出去
    for (let k = 0; k < g.maxAlive; k++) {
      const a = (k / g.maxAlive) * Math.PI * 2;
      const r = g.maxAlive === 1 ? 0 : g.spawnRadius * 0.6;
      s.units.push(spawnFromGroup(s, g, g.cx + Math.round(Math.cos(a) * r), g.cy + Math.round(Math.sin(a) * r)));
    }
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
  return m;
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
  const hpPct = ramp + (g.hpPct ?? 0);
  const atkPct = ramp + (g.atkPct ?? 0);
  if (hpPct) m.hp = m.maxHp = Math.round((m.maxHp * (100 + hpPct)) / 100);
  if (atkPct) m.atk = Math.round((m.atk * (100 + atkPct)) / 100);
  clampArena(s, m);
  if (s.arena.solid) pushOutSolid(s.arena.solid, m);
  m.mode = 'idle';
  m.tier = g.tier ?? (def.boss ? 'boss' : 'normal');
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
    const a = nextRand(s) * Math.PI * 2;
    const r = Math.sqrt(nextRand(s)) * g.spawnRadius;
    const m = spawnFromGroup(s, g, g.cx + Math.round(Math.cos(a) * r), g.cy + Math.round(Math.sin(a) * r));
    const gone = s.units.findIndex((u) => u.dead && u.groupId === id);
    if (gone >= 0) s.units.splice(gone, 1);
    s.units.push(m);
    emit(s, { tick: s.tick, type: 'respawn', id: m.id, group: id });
    }
  }
}

// ---------------- 掉落與自動撿取（design/20 B5 最小版本） ----------------
function rollDrops(s: BattleState, e: Unit): void {
  const d = ENEMIES[e.defId]?.drops;
  if (!d) return;
  const st = STAGES[s.stageId];
  const bonus = !e.groupId ? 0 : e.groupId === RIOT_GROUP ? (st?.riot?.lootPct ?? 0) : e.groupId === HIDDEN_GROUP ? (st?.hiddenElite?.lootPct ?? 0) : (st?.spawnGroups?.find((g) => g.id === e.groupId)?.lootPct ?? 0);
  const range = (r: [number, number]) => r[0] + Math.floor(lootRand(s) * (r[1] - r[0] + 1));
  const more = (n: number) => (bonus ? Math.round((n * (100 + bonus)) / 100) : n);
  const put = (kind: LootId, amount: number) => {
    if (amount <= 0) return;
    const a = lootRand(s) * Math.PI * 2;
    const r = (0.3 + lootRand(s) * 0.5) * UNIT;
    const it = { id: (s.lootSeq = (s.lootSeq ?? 0) + 1), kind, amount, x: e.x + Math.round(Math.cos(a) * r), y: e.y + Math.round(Math.sin(a) * r), tick: s.tick };
    it.x = Math.min(s.arena.w - 20, Math.max(20, it.x));
    it.y = Math.min(s.arena.h - 20, Math.max(20, it.y));
    s.ground!.push(it);
    emit(s, { tick: s.tick, type: 'drop', item: it.id, kind, amount });
  };
  put('gold', more(range(d.gold)));
  for (const i of d.items ?? []) {
    if (lootRand(s) * 100 >= i.chance) continue;
    const n = i.count ? range(i.count) : 1;
    put(i.id, i.id === 'dust' ? more(n) : n);
  }
}

/** 走近 2.5 單位自動撿起；藥水滿了就留在地上；放太久消失 */
function processPickup(s: BattleState): void {
  if (!s.ground?.length) return;
  const p = playerOf(s);
  const carry = playerDef().potion.carry;
  s.ground = s.ground.filter((it) => {
    if (s.tick - it.tick > LOOT_RULES.expireTicks) return false;
    if (p.dead || s.tick - it.tick < LOOT_RULES.pickupDelayTicks || dist(p.x, p.y, it.x, it.y) > LOOT_RULES.pickupUnits * UNIT) return true;
    if (it.kind === 'potion') {
      if (s.potions >= carry) return true;
      s.potions = Math.min(carry, s.potions + it.amount);
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
    const a = ((start + k) / 8) * Math.PI * 2;
    const x = p.x + Math.round(Math.cos(a) * units * UNIT);
    const y = p.y + Math.round(Math.sin(a) * units * UNIT);
    if (x < UNIT || y < UNIT || x > s.arena.w - UNIT || y > s.arena.h - UNIT) continue;
    if (s.arena.solid && isSolidAt(s.arena.solid, x, y)) continue;
    if (campfireNear(s, x, y, CAMPFIRE_RULES.safeUnits)) continue;
    return { x, y };
  }
  return null;
}

/** 隱藏精英：連殺到門檻就在附近冒出來（醒著）；打倒後重新計數 */
const HIDDEN_GROUP = 'hidden';
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
const RIOT_GROUP = 'riot';
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
    const a = (i / n) * Math.PI * 2;
    const m = makeEnemy(s, def, at.x + Math.round(Math.cos(a) * 1.5 * UNIT), at.y + Math.round(Math.sin(a) * 1.5 * UNIT));
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
    if (s.chestsOpened?.includes(c.id) || dist(p.x, p.y, c.x, c.y) > CHEST_RULES.openUnits * UNIT) continue;
    (s.chestsOpened ??= []).push(c.id);
    for (const k of Object.keys(c.loot).sort() as LootId[]) {
      const n = c.loot[k] ?? 0;
      if (k === 'potion') s.potions = Math.min(playerDef().potion.carry, s.potions + n);
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
  const e = (s.enhance ??= { level: 0, baseAtk: p.atk });
  const pts = (s.loot!.dust ?? 0) + 5 * (s.loot!.crystal ?? 0);
  const lv = Math.min(rule.maxLevel, Math.floor(pts / rule.dustPerLevel));
  if (lv <= e.level) return;
  e.level = lv;
  p.atk = Math.round((e.baseAtk * (100 + rule.atkPctPerLevel * lv)) / 100);
  emit(s, { tick: s.tick, type: 'enhance', level: lv, atk: p.atk });
}

/** 還有沒有會重生的怪（刷怪地圖不會因清空而勝利） */
const pendingRespawn = (s: BattleState): boolean => !!s.respawnAt && Object.values(s.respawnAt).some((d) => d.length > 0);

export const playerOf = (s: BattleState): Unit => s.units[0]!;
export const enemiesOf = (s: BattleState): Unit[] => s.units.filter((x) => x.side === 'enemy' && !x.dead);
const unitById = (s: BattleState, id: number | null | undefined): Unit | undefined => (id == null ? undefined : s.units.find((x) => x.id === id));
const has = (x: Unit, id: StatusId, tick: number): boolean => x.statuses.some((st) => st.id === id && st.until > tick);
/** 暈眩或冰凍：不能移動與攻擊 */
const disabled = (x: Unit, tick: number): boolean => has(x, 'stun', tick) || has(x, 'freeze', tick);

/** 上狀態：同一種刷新時間；可疊層的（燃燒、中毒）加一層；冰凍對 Boss 改成緩速；護盾總量 ≤ 最大 HP 50% */
export function addStatus(s: BattleState, x: Unit, st: StatusApply, src?: Unit): void {
  let id = st.id;
  if (id === 'freeze' && ENEMIES[x.defId]?.boss) id = 'slow';
  const until = s.tick + st.ticks;
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

function playerDef(): PlayerDefinition {
  return SWORDSMAN;
}

function dealDamage(s: BattleState, src: Unit, dst: Unit, mult: number, origin: 'normal' | 'skill' | 'counter' | 'enemy', skill: string, reducePct = 0): number {
  if (dst.dead) return 0;
  if (dst.mode === 'returning') return 0; // 脫戰返回中不吃傷害（D-072）
  if (dst.mode === 'idle' || dst.mode === 'dormant') aggro(s, dst); // 被打到就醒
  if (dst.mode) dst.engagedTick = s.tick;
  if (src.mode) src.engagedTick = s.tick;
  if (src.side === 'player' || dst.side === 'player') s.lastCombatTick = s.tick;
  if (dst.invulnUntil >= s.tick) {
    emit(s, { tick: s.tick, type: 'dodged', id: dst.id, attack: skill });
    return 0;
  }
  let pool = 0;
  if (has(dst, 'break', s.tick)) pool += 0.3;
  const atk = has(src, 'atkUp', s.tick) ? Math.round(src.atk * 1.15) : src.atk;
  let critMul = 1;
  let crit = false;
  if (src.side === 'player') {
    const pd = playerDef();
    if (nextRand(s) * 100 < pd.critRate) {
      crit = true;
      critMul = pd.critDmg / 100;
    }
  }
  let amount = computeDamage(atk, mult, pool, dst.def, critMul);
  if (has(src, 'weak', s.tick)) amount = Math.max(1, Math.round(amount * 0.8)); // 虛弱：造成傷害 −20%
  if (reducePct > 0) amount = Math.max(1, Math.round((amount * (100 - reducePct)) / 100));
  applyHp(s, src, dst, amount, crit, origin, skill);
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
function gainMp(p: Unit, n: number): void {
  if (p.side !== 'player' || p.dead || n <= 0) return;
  p.mp = Math.min(playerDef().mp, p.mp + n);
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
    if (src.side === 'player' && dst.side === 'enemy') gainMp(src, playerDef().mpGain.deal);
    if (dst.side === 'player' && amount > absorbed) gainMp(dst, playerDef().mpGain.hurt);
  }
  emit(s, { tick: s.tick, type: 'damage', src: src.id, dst: dst.id, amount, crit, origin, skill, ...(absorbed ? { absorbed } : {}) });
  if (dst.hp <= 0 && !dst.dead) {
    dst.dead = true;
    dst.action = null;
    s.telegraphs = s.telegraphs.filter((t) => t.ownerId !== dst.id);
    emit(s, { tick: s.tick, type: 'death', id: dst.id });
    if (dst.groupId) queueRespawn(s, dst.groupId);
    if (dst.side === 'enemy' && STAGES[s.stageId]?.hiddenElite && dst.tier === 'normal' && !dst.summonedBy) s.streak = (s.streak ?? 0) + 1;
    if (s.ground && dst.side === 'enemy' && !dst.summonedBy) rollDrops(s, dst);
    if (dst.mode && ENEMIES[dst.defId]?.boss && !(s.bossKills ??= []).includes(dst.defId)) s.bossKills.push(dst.defId);
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
      const heavyA = !!ENEMIES[a.defId]?.boss;
      const heavyB = !!ENEMIES[b.defId]?.boss;
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
  for (const e of enemiesOf(s)) {
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

function startSkill(s: BattleState, p: Unit, id: string): boolean {
  const sk = SKILLS[id];
  if (!sk || p.dead || disabled(p, s.tick)) return false;
  if ((p.ready[id] ?? 0) > s.tick) return false;
  if (sk.mp && p.mp < sk.mp) return false;
  if (p.action && p.action.kind !== 'attack') return false; // 同時只能一個主動技能
  const t = currentTarget(s, p);
  if (t) face(p, t);
  p.ready[id] = s.tick + sk.cooldownTicks; // 冷卻從施放開始計
  if (sk.mp) p.mp -= sk.mp;
  p.action = { kind: 'skill', id, start: s.tick, end: s.tick + sk.castTicks, dirX: p.facingX, dirY: p.facingY, ox: p.x, oy: p.y, hitIds: [], targetId: t?.id };
  emit(s, { tick: s.tick, type: 'cast', id: p.id, skill: id });
  return true;
}

function startDodge(s: BattleState, p: Unit, dx: number, dy: number): boolean {
  const pd = playerDef();
  if (p.dead || disabled(p, s.tick) || (p.ready['dodge'] ?? 0) > s.tick) return false;
  // 格擋有效窗口內不能用閃避取消
  const a = p.action;
  if (a?.kind === 'skill' && SKILLS[a.id]?.block && s.tick - a.start <= SKILLS[a.id]!.block!.windowTicks) return false;
  const [fx, fy] = dx === 0 && dy === 0 ? [-p.facingX, -p.facingY] : norm(dx, dy);
  p.ready['dodge'] = s.tick + pd.dodge.cooldownTicks;
  p.action = { kind: 'dodge', id: 'dodge', start: s.tick, end: s.tick + pd.dodge.ticks, dirX: fx, dirY: fy, ox: p.x, oy: p.y };
  p.invulnUntil = s.tick + pd.dodge.invulnTo;
  emit(s, { tick: s.tick, type: 'dodge', id: p.id });
  return true;
}

function applyCommands(s: BattleState, cmds: readonly BattleCommand[]): void {
  const p = playerOf(s);
  s.manualMove = null;
  for (const c of cmds) {
    if (c.type === 'move') {
      s.manualMove = c.dx === 0 && c.dy === 0 ? null : { dx: c.dx, dy: c.dy };
      if (s.manualMove) s.moveGoal = null;
    }
    else if (c.type === 'stop') s.manualMove = null;
    else if (c.type === 'target') {
      p.targetId = c.id;
      s.moveGoal = null;
    } else if (c.type === 'moveTo') setMoveGoal(s, c.x, c.y);
    else if (c.type === 'skill') startSkill(s, p, c.id);
    else if (c.type === 'dodge') startDodge(s, p, c.dx, c.dy);
    else if (c.type === 'potion') drinkPotion(s, p);
    else if (c.type === 'rest') restAtCampfire(s, p);
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
  s.potions = Math.max(s.potions, playerDef().potion.carry);
  s.campfireId = c.id;
  s.moveGoal = null;
  emit(s, { tick: s.tick, type: 'rest', id: p.id, campfire: c.id });
  return true;
}

/** 倒下 → 在最後休息的營火復活：HP 全滿、3 秒無敵，戰鬥中的怪全部脫戰回家 */
function reviveAtCampfire(s: BattleState, p: Unit): boolean {
  const fires = campfiresOf(s);
  if (!STAGES[s.stageId]?.reviveAtCampfire || !fires.length) return false;
  const c = fires.find((f) => f.id === s.campfireId) ?? fires[0]!;
  p.dead = false;
  p.hp = p.maxHp;
  p.statuses = [];
  p.action = null;
  p.targetId = null;
  p.x = c.x;
  p.y = c.y + UNIT;
  clampArena(s, p);
  p.invulnUntil = s.tick + CAMPFIRE_RULES.reviveInvulnTicks;
  s.moveGoal = null;
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
  return true;
}

/** 點地移動：夾在場地內；點到石頭上就忽略（D-071） */
function setMoveGoal(s: BattleState, x: number, y: number): void {
  const p = playerOf(s);
  const gx = Math.min(s.arena.w - p.r, Math.max(p.r, Math.round(x)));
  const gy = Math.min(s.arena.h - p.r, Math.max(p.r, Math.round(y)));
  if (s.arena.solid && isSolidAt(s.arena.solid, gx, gy)) return;
  const g = gridOf(s.arena);
  if (g && flowField(g, cellIndex(g, gx, gy))[cellIndex(g, p.x, p.y)]! < 0) return; // 走不到
  // 最多走 10 秒（被怪擋住到不了時，自動恢復追擊）
  s.moveGoal = { x: gx, y: gy, until: s.tick + 10 * TICKS_PER_SEC };
}

/** 喝藥水：瞬間回復、不打斷動作；滿血、沒藥、冷卻中、倒下或暈眩時無效 */
function drinkPotion(s: BattleState, p: Unit): boolean {
  const pt = playerDef().potion;
  if (p.dead || disabled(p, s.tick) || s.potions <= 0 || p.hp >= p.maxHp) return false;
  if ((p.ready['potion'] ?? 0) > s.tick) return false;
  const heal = Math.min(p.maxHp - p.hp, Math.round((p.maxHp * pt.healPct) / 100));
  p.hp += heal;
  s.potions--;
  p.ready['potion'] = s.tick + pt.cooldownTicks;
  emit(s, { tick: s.tick, type: 'potion', id: p.id, heal, left: s.potions });
  return true;
}

function resolveSkillHit(s: BattleState, p: Unit, a: Action, h: SkillHit, skillId: string, origin: 'skill' | 'counter'): void {
  for (const e of enemiesOf(s)) {
    if (h.oncePerTarget && a.hitIds?.includes(e.id)) continue;
    if (!inShape(h.shape, p.x, p.y, a.dirX, a.dirY, e.x, e.y, e.r)) continue;
    a.hitIds?.push(e.id);
    dealDamage(s, p, e, h.mult, origin, skillId);
    if (h.status && !e.dead) addStatus(s, e, h.status, p);
  }
}

function updatePlayer(s: BattleState): void {
  const p = playerOf(s);
  if (p.dead || disabled(p, s.tick)) return;
  const pd = playerDef();
  const a = p.action;
  if (a) {
    const k = s.tick - a.start;
    if (a.kind === 'dodge') {
      const step = Math.round(pd.dodge.distance / pd.dodge.ticks);
      p.x += Math.round((a.dirX / DIR) * step);
      p.y += Math.round((a.dirY / DIR) * step);
      clampArena(s, p);
    } else if (a.kind === 'skill') {
      const sk = SKILLS[a.id]!;
      if (sk.dash && k >= sk.dash.fromTick && k < sk.dash.fromTick + sk.dash.ticks) {
        const step = Math.round(sk.dash.distance / sk.dash.ticks);
        p.x += Math.round((a.dirX / DIR) * step);
        p.y += Math.round((a.dirY / DIR) * step);
        clampArena(s, p);
      } else if (sk.moveFactor > 0) {
        if (s.manualMove) {
          const [fx, fy] = norm(s.manualMove.dx, s.manualMove.dy);
          moveDir(s, p, fx, fy, sk.moveFactor);
        } else if (s.moveGoal) navToward(s, p, s.moveGoal.x, s.moveGoal.y, 0, sk.moveFactor);
        else {
          const t = currentTarget(s, p);
          if (t) navToward(s, p, t.x, t.y, p.r + t.r, sk.moveFactor);
        }
      }
      for (const h of sk.hits) if (h.atTick === k) resolveSkillHit(s, p, a, h, a.id, 'skill');
    } else if (a.kind === 'attack') {
      // 手動移動可以取消普攻後搖（命中前取消就沒打到）
      if ((s.manualMove || s.moveGoal) && k > pd.attackWindupTicks) p.action = null;
      else if (k === pd.attackWindupTicks) {
        const t = unitById(s, a.targetId);
        if (t && !t.dead && dist(p.x, p.y, t.x, t.y) <= pd.attackRange + p.r + t.r + 30) dealDamage(s, p, t, 100, 'normal', 'attack');
      }
    }
    if (p.action && s.tick >= p.action.end) p.action = null;
    if (p.action) return;
  }
  // 沒有動作：手動移動優先（暫停自動追擊；design/19 方案 A）
  if (s.manualMove) {
    const [fx, fy] = norm(s.manualMove.dx, s.manualMove.dy);
    p.facingX = fx;
    p.facingY = fy;
    moveDir(s, p, fx, fy);
    return;
  }
  // 點地移動中：走到目的地（期間不自動追擊），到了就恢復自動追擊
  if (s.moveGoal) {
    if (dist(p.x, p.y, s.moveGoal.x, s.moveGoal.y) <= 12 || s.tick >= s.moveGoal.until) s.moveGoal = null;
    else {
      navToward(s, p, s.moveGoal.x, s.moveGoal.y, 0);
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
  const hx = e.homeX ?? e.x;
  const hy = e.homeY ?? e.y;
  if (e.mode === 'idle') {
    if (!p.dead && (s.tick + e.id) % 6 === 0 && !inSafeZone(s, p) && dist(e.x, e.y, p.x, p.y) <= rule.aggro * UNIT + p.r && hasSight(s, e, p)) aggro(s, e);
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
  // 戰鬥中：在仇恨範圍內就算還在交手
  if (dist(e.x, e.y, p.x, p.y) <= rule.aggro * UNIT + p.r) e.engagedTick = s.tick;
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

function pickAttack(s: BattleState, e: Unit, def: EnemyDefinition, d: number, target: Unit): AreaAttack | undefined {
  const sight = hasSight(s, e, target);
  // 隔著石頭不能射擊（衝鋒例外：隔石衝鋒會撞上石頭暈眩，是可利用的弱點）
  const ok = def.attacks.filter((a) => (!a.phase2Only || e.phase === 2) && (e.ready[a.id] ?? 0) <= s.tick && d <= a.triggerRange + target.r && (sight || !!a.charge));
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
  const sk = a?.kind === 'skill' ? SKILLS[a.id] : undefined;
  if (a && sk?.block && atk.blockable && !a.blocked && s.tick - a.start <= sk.block.windowTicks) {
    a.blocked = true;
    emit(s, { tick: s.tick, type: 'block', id: p.id, attack: atk.id });
    gainMp(p, playerDef().mpGain.block);
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

function updateEnemy(s: BattleState, e: Unit): void {
  const def = ENEMIES[e.defId]!;
  const p = playerOf(s);
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
  if (disabled(e, s.tick)) return;
  const a = e.action;
  if (a) {
    const atk = def.attacks.find((x) => x.id === a.id)!;
    const hitTick = a.start + atk.warningTicks;
    if (a.kind === 'enemyAttack' && s.tick === hitTick) {
      s.telegraphs = s.telegraphs.filter((t) => !(t.ownerId === e.id && t.hitTick === hitTick));
      if (atk.charge) {
        a.kind = 'charge';
        a.end = s.tick + atk.charge.ticks + atk.recoverTicks;
      } else if (!p.dead && inShape(atk.shape, a.ox, a.oy, a.dirX, a.dirY, p.x, p.y, p.r)) enemyHit(s, e, atk, p);
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
    if (e.action && s.tick >= e.action.end) e.action = null;
    return;
  }
  if (s.tick < e.hitstunUntil || p.dead) return;
  const d = dist(e.x, e.y, p.x, p.y);
  // 決策每 6 ticks 一次（依 id 錯開）
  if ((s.tick + e.id) % 6 === 0 && s.tick >= e.nextAttackTick) {
    const atk = pickAttack(s, e, def, d, p);
    if (atk) {
      face(e, p);
      const cd = e.phase === 2 && def.boss ? Math.round((atk.cooldownTicks * def.boss.phase2CooldownPct) / 100) : atk.cooldownTicks;
      e.ready[atk.id] = s.tick + cd;
      e.nextAttackTick = s.tick + atk.warningTicks + atk.recoverTicks + (atk.charge?.ticks ?? 0);
      e.action = { kind: 'enemyAttack', id: atk.id, start: s.tick, end: s.tick + atk.warningTicks + atk.recoverTicks, dirX: e.facingX, dirY: e.facingY, ox: e.x, oy: e.y, hitIds: [] };
      s.telegraphs.push({ ownerId: e.id, attackId: atk.id, shape: atk.shape, ox: e.x, oy: e.y, dirX: e.facingX, dirY: e.facingY, hitTick: s.tick + atk.warningTicks, startTick: s.tick, blockable: atk.blockable });
      emit(s, { tick: s.tick, type: 'telegraph', owner: e.id, attack: atk.id });
      return;
    }
  }
  const closest = Math.min(...def.attacks.filter((x) => !x.phase2Only || e.phase === 2).map((x) => x.triggerRange));
  navToward(s, e, p.x, p.y, Math.max(e.r + p.r, closest * 0.85));
}

// ---------------- 主迴圈 ----------------
/** 推進一個 tick。順序固定：輸入 → 玩家 → 敵人（id 順序）→ 分離 → 狀態到期 → 勝負 */
export function step(s: BattleState, cmds: readonly BattleCommand[] = []): void {
  if (s.outcome !== 'running') return;
  s.tick++;
  applyCommands(s, cmds);
  updatePlayer(s);
  const p0 = playerOf(s);
  for (const e of s.units) {
    if (e.side !== 'enemy' || e.dead) continue;
    if (e.mode === 'idle' || e.mode === 'dormant') updateDormancy(s, e, p0);
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
  const p = playerOf(s);
  naturalRegen(s, p);
  if (p.dead && !reviveAtCampfire(s, p)) s.outcome = 'defeat';
  else if (enemiesOf(s).length === 0 && !pendingRespawn(s)) s.outcome = 'victory';
  else if (s.tick >= s.timeLimitTicks) s.outcome = 'timeout';
}

/** 自然恢復（D-073）：只在開 regen（預設＝mapAi）的關卡；沒有戰鬥中的怪、且 5 秒沒受傷也沒出手 → 每秒回 2% */
const REGEN = { afterTicks: 5 * TICKS_PER_SEC, everyTicks: TICKS_PER_SEC, pct: 2 };
function naturalRegen(s: BattleState, p: Unit): void {
  const st = STAGES[s.stageId];
  if (!st || !(st.regen ?? st.mapAi) || p.dead || p.hp >= p.maxHp) return;
  if (s.tick - (s.lastCombatTick ?? 0) < REGEN.afterTicks) return;
  if (s.units.some((e) => e.side === 'enemy' && !e.dead && e.mode === 'combat')) return;
  if ((s.tick - (s.lastCombatTick ?? 0)) % REGEN.everyTicks !== 0) return;
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
  if (s.campfireId || s.revives) {
    // 只有用到營火時才加入
    mix(s.revives ?? 0);
    for (const ch of s.campfireId ?? '') mix(ch.charCodeAt(0));
  }
  if (s.respawnAt) {
    // 只有用到重生點時才加入（舊紀錄的雜湊不變）
    for (const id of Object.keys(s.respawnAt).sort()) for (const t of s.respawnAt[id]!) mix(t);
  }
  mix(s.events.length);
  mix(s.potions);
  return (h >>> 0).toString(16).padStart(8, '0');
}
