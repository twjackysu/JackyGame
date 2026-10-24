// 即時戰鬥引擎（design/19 §2、D-063 P1）：固定 30 ticks/秒、整數座標、種子亂數、事件依 (tick, 處理順序, id) 固定排序。
// 不依賴 Phaser；畫面層只能送 BattleCommand、讀 BattleState。
import { ENEMIES, SKILLS, SWORDSMAN, STAGES } from './data';
import type { Action, AreaAttack, BattleCommand, BattleEvent, BattleState, EnemyDefinition, PlayerDefinition, Shape, SkillHit, StatusApply, StatusId, Unit } from './types';
import { STATUS_RULES, TICKS_PER_SEC, UNIT } from './types';

// ---------------- 亂數（xorshift32，狀態存在 BattleState，可序列化） ----------------
export function nextRand(s: BattleState): number {
  let x = s.rngState | 0 || 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rngState = x >>> 0;
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
  const b = setup.bonus ?? {};
  s.units.push({
    id: s.nextId++, side: 'player', defId: pd.id, x: stage.player.x, y: stage.player.y, r: pd.radius,
    hp: pd.hp + (b.hp ?? 0), maxHp: pd.hp + (b.hp ?? 0), atk: pd.atk + (b.atk ?? 0), def: pd.def + (b.def ?? 0),
    speedPerTick: speedPerTick(pd.speed), dead: false, facingX: 0, facingY: -DIR, action: null, statuses: [], ready: {},
    nextAttackTick: 0, invulnUntil: -1, hitstunUntil: -1, hitstunImmuneUntil: -1, targetId: null, phase: 1,
    nextSummonTick: Number.MAX_SAFE_INTEGER, mp: Math.min(pd.mp, pd.mpStart),
  });
  for (const e of stage.enemies) {
    const def = ENEMIES[e.enemyId];
    if (!def) throw new Error(`unknown enemy ${e.enemyId}`);
    s.units.push(makeEnemy(s, def, e.x, e.y));
  }
  return s;
}

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
  }
}

// ---------------- 移動 ----------------
function clampArena(s: BattleState, x: Unit): boolean {
  const nx = Math.min(s.arena.w - x.r, Math.max(x.r, x.x));
  const ny = Math.min(s.arena.h - x.r, Math.max(x.r, x.y));
  const hit = nx !== x.x || ny !== x.y;
  x.x = nx;
  x.y = ny;
  return hit;
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

function face(x: Unit, t: Unit): void {
  const [fx, fy] = norm(t.x - x.x, t.y - x.y);
  x.facingX = fx;
  x.facingY = fy;
}

/** 簡單分離（依 id 順序，確定性）：Boss 不被推；閃避中的玩家可以穿過敵人 */
function separate(s: BattleState): void {
  const alive = s.units.filter((x) => !x.dead);
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
  if (t && !t.dead) return t;
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
    if (c.type === 'move') s.manualMove = c.dx === 0 && c.dy === 0 ? null : { dx: c.dx, dy: c.dy };
    else if (c.type === 'stop') s.manualMove = null;
    else if (c.type === 'target') p.targetId = c.id;
    else if (c.type === 'skill') startSkill(s, p, c.id);
    else if (c.type === 'dodge') startDodge(s, p, c.dx, c.dy);
    else if (c.type === 'potion') drinkPotion(s, p);
  }
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
        } else {
          const t = currentTarget(s, p);
          if (t) moveToward(s, p, t.x, t.y, p.r + t.r, sk.moveFactor);
        }
      }
      for (const h of sk.hits) if (h.atTick === k) resolveSkillHit(s, p, a, h, a.id, 'skill');
    } else if (a.kind === 'attack') {
      // 手動移動可以取消普攻後搖（命中前取消就沒打到）
      if (s.manualMove && k > pd.attackWindupTicks) p.action = null;
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
  const t = currentTarget(s, p);
  if (!t) return;
  const reach = pd.attackRange + p.r + t.r;
  const d = dist(p.x, p.y, t.x, t.y);
  if (d > reach) {
    moveToward(s, p, t.x, t.y, reach - 10);
    return;
  }
  face(p, t);
  if (s.tick >= p.nextAttackTick) {
    p.nextAttackTick = s.tick + pd.attackIntervalTicks; // 放技能不重置普攻冷卻
    p.action = { kind: 'attack', id: 'attack', start: s.tick, end: s.tick + pd.attackWindupTicks + pd.attackRecoverTicks, dirX: p.facingX, dirY: p.facingY, ox: p.x, oy: p.y, targetId: t.id };
  }
}

// ---------------- 敵人 ----------------
function pickAttack(s: BattleState, e: Unit, def: EnemyDefinition, d: number, target: Unit): AreaAttack | undefined {
  const ok = def.attacks.filter((a) => (!a.phase2Only || e.phase === 2) && (e.ready[a.id] ?? 0) <= s.tick && d <= a.triggerRange + target.r);
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
        s.units.push(m);
      }
      emit(s, { tick: s.tick, type: 'summon', id: e.id, count: sm.count });
    }
  }
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
  moveToward(s, e, p.x, p.y, Math.max(e.r + p.r, closest * 0.85));
}

// ---------------- 主迴圈 ----------------
/** 推進一個 tick。順序固定：輸入 → 玩家 → 敵人（id 順序）→ 分離 → 狀態到期 → 勝負 */
export function step(s: BattleState, cmds: readonly BattleCommand[] = []): void {
  if (s.outcome !== 'running') return;
  s.tick++;
  applyCommands(s, cmds);
  updatePlayer(s);
  for (const e of s.units) if (e.side === 'enemy' && !e.dead) updateEnemy(s, e);
  separate(s);
  for (const x of s.units) if (x.statuses.length && !x.dead) tickDots(s, x);
  for (const x of s.units) if (x.statuses.length) x.statuses = x.statuses.filter((st) => st.until > s.tick);
  const p = playerOf(s);
  if (p.dead) s.outcome = 'defeat';
  else if (enemiesOf(s).length === 0) s.outcome = 'victory';
  else if (s.tick >= s.timeLimitTicks) s.outcome = 'timeout';
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
  mix(s.events.length);
  mix(s.potions);
  return (h >>> 0).toString(16).padStart(8, '0');
}
