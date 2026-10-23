// 回合制戰鬥引擎（03 §3、09 §1–2）。純 TypeScript、事件導向、與 UI 無關。
// 每個 API 回傳新的 state（內部 structuredClone）與本次產生的事件列表。
import { ENEMIES, HEROES, type EnemyAttack, type EnemyDef } from '../../data/combatants';
import { mulberry32 } from '../rng';
import {
  MAX_EMBER,
  MAX_LAMPS,
  MAX_SP,
  START_EMBER,
  START_SP,
  damage,
  defenseMul,
  resonanceMul,
  statsAtLevel,
  type DefenseResult,
  type Element,
  type Telegraph,
  type Timing,
} from './formulas';
import { BASIC_ATTACK, ITEMS, SKILLS, type HeroId, type ItemId } from './skills';

export type Phase = 'playerCommand' | 'playerTiming' | 'enemyTelegraph' | 'victory' | 'defeat';

export interface UnitStatus {
  poison: number; // 剩餘回合
  umbra: number; // 受傷 +20%
  guarding: boolean;
  taunt: number;
  counterStance: boolean;
  weakRevealed: number;
  empowered: boolean; // 引路之光：下次攻擊 +30%
  howl: number; // 敵：ATK +20%
}

export interface Unit {
  side: 'hero' | 'enemy';
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  sp: number;
  element: Element;
  weak: Element[];
  resist: Element[];
  status: UnitStatus;
  lamps: number;
  breakGauge: number;
  breakMax: number;
  broken: boolean;
  downed: boolean;
  bossPhase: 1 | 2;
  actionsPerRound: number;
}

export interface ActorRef {
  side: 'hero' | 'enemy';
  index: number;
}

export interface Command {
  type: 'attack' | 'skill' | 'guard' | 'item';
  skillId?: string;
  itemId?: ItemId;
  target?: number; // 敵人 index（攻擊/技能）或我方 index（道具）
}

export interface PendingEnemyAction {
  enemy: number;
  attack: EnemyAttack;
  targets: number[];
  hits: number[];
}

export interface BattleState {
  round: number;
  heroes: Unit[];
  enemies: Unit[];
  ember: number;
  phase: Phase;
  actor: ActorRef | null;
  queue: ActorRef[];
  pendingCommand: Command | null;
  pendingEnemy: PendingEnemyAction | null;
  rngState: number;
  lampAtk: number;
  items: Partial<Record<ItemId, number>>;
  /** ambushed：被伏擊，第 1 輪我方不行動 */
  flags: { tutorialEmber?: boolean; guidingLight?: boolean; ambushed?: boolean };
  usedOnce: string[];
  /** 霧：判定窗口倍率 & 剩餘回合 */
  windowScale: number;
  fogRounds: number;
  telegraphLeadBonusMs: number;
  leadBonusRounds: number;
  /** 回溯用：最近一次敵方行動前的我方快照 */
  rewindSnapshot: { hp: number; downed: boolean; poison: number; umbra: number }[] | null;
}

export type BattleEvent =
  | { type: 'turnStart'; actor: ActorRef; round: number }
  | { type: 'command'; actor: ActorRef; command: Command }
  | { type: 'damage'; target: ActorRef; amount: number; timing?: Timing; weak: boolean; crit: boolean; source?: string }
  | { type: 'heal'; target: ActorRef; amount: number }
  | { type: 'lampPlaced'; target: number; count: number; total: number }
  | { type: 'resonance'; perTarget: { target: number; lamps: number; amount: number }[]; totalLamps: number }
  | { type: 'break'; target: number }
  | { type: 'statusApplied'; target: ActorRef; status: string; rounds?: number }
  | {
      type: 'telegraph';
      enemy: number;
      attack: string;
      telegraph: Telegraph;
      windUpMs: number;
      hits: number[];
      targets: number[];
      windowScale: number;
      leadBonusMs: number;
    }
  | { type: 'defense'; hit: number; result: DefenseResult }
  | { type: 'counter'; hero: number; enemy: number; amount: number }
  | { type: 'downed'; target: ActorRef }
  | { type: 'revived'; target: ActorRef; hp: number }
  | { type: 'phaseChange'; enemy: number; phase: 2 }
  | { type: 'ember'; delta: number; total: number }
  | { type: 'skip'; actor: ActorRef; reason: 'broken' | 'downed' }
  | { type: 'victory' }
  | { type: 'defeat' };

export interface Result {
  state: BattleState;
  events: BattleEvent[];
}

export interface CreateBattleOptions {
  party: { id: HeroId; level: number; hp?: number }[];
  enemies: string[];
  seed: number;
  flags?: { tutorialEmber?: boolean; guidingLight?: boolean; ambushed?: boolean };
  items?: Partial<Record<ItemId, number>>;
}

const freshStatus = (): UnitStatus => ({
  poison: 0, umbra: 0, guarding: false, taunt: 0, counterStance: false, weakRevealed: 0, empowered: false, howl: 0,
});

// ---------- RNG（狀態存在 state 內，確保可序列化與決定性） ----------
function rand(s: BattleState): number {
  const r = mulberry32(s.rngState);
  const v = r();
  s.rngState = (s.rngState + 0x6d2b79f5) >>> 0;
  return v;
}
const variance = (s: BattleState) => 0.95 + rand(s) * 0.1;

// ---------- 建立 ----------
export function createBattle(opts: CreateBattleOptions): Result {
  const heroes: Unit[] = opts.party.map((p) => {
    const def = HEROES[p.id];
    const st = statsAtLevel(def.base, p.level);
    return {
      side: 'hero', id: p.id, name: def.name, level: p.level, hp: p.hp ?? st.hp, maxHp: st.hp, atk: st.atk, def: st.def,
      spd: st.spd, sp: START_SP, element: def.attackElement, weak: [], resist: [], status: freshStatus(), lamps: 0,
      breakGauge: 0, breakMax: 0, broken: false, downed: (p.hp ?? st.hp) <= 0, bossPhase: 1, actionsPerRound: 1,
    };
  });
  const enemies: Unit[] = opts.enemies.map((id) => {
    const e: EnemyDef | undefined = ENEMIES[id];
    if (!e) throw new Error(`unknown enemy ${id}`);
    return {
      side: 'enemy', id, name: e.name, level: e.level, hp: e.hp, maxHp: e.hp, atk: e.atk, def: e.def, spd: e.spd, sp: 0,
      element: 'phys', weak: [...e.weak], resist: [...(e.resist ?? [])], status: freshStatus(), lamps: 0,
      breakGauge: e.breakMax, breakMax: e.breakMax, broken: false, downed: false, bossPhase: 1,
      actionsPerRound: e.actionsPerRound ?? 1,
    };
  });
  const lian = heroes.find((h) => h.id === 'lian');
  const state: BattleState = {
    round: 0, heroes, enemies, ember: opts.flags?.tutorialEmber ? MAX_EMBER : START_EMBER, phase: 'playerCommand',
    actor: null, queue: [], pendingCommand: null, pendingEnemy: null, rngState: opts.seed >>> 0,
    lampAtk: lian?.atk ?? 14, items: { ...(opts.items ?? {}) }, flags: { ...(opts.flags ?? {}) }, usedOnce: [],
    windowScale: 1, fogRounds: 0, telegraphLeadBonusMs: 0, leadBonusRounds: 0, rewindSnapshot: null,
  };
  const events: BattleEvent[] = [];
  nextActor(state, events);
  return { state, events };
}

// ---------- 小工具 ----------
export const unitAt = (s: BattleState, r: ActorRef): Unit => {
  const u = (r.side === 'hero' ? s.heroes : s.enemies)[r.index];
  if (!u) throw new Error('bad unit ref');
  return u;
};
export const totalLamps = (s: BattleState) => s.enemies.reduce((a, e) => a + (e.downed ? 0 : e.lamps), 0);
const alive = (u: Unit) => !u.downed && u.hp > 0;
const over = (s: BattleState) => s.phase === 'victory' || s.phase === 'defeat';

function gainEmber(s: BattleState, ev: BattleEvent[], delta: number) {
  const before = s.ember;
  s.ember = Math.max(0, Math.min(MAX_EMBER, s.ember + delta));
  if (s.ember !== before) ev.push({ type: 'ember', delta: s.ember - before, total: s.ember });
}

function checkEnd(s: BattleState, ev: BattleEvent[]): boolean {
  if (over(s)) return true;
  if (s.enemies.every((e) => !alive(e))) {
    s.phase = 'victory';
    s.pendingCommand = null;
    s.pendingEnemy = null;
    s.heroes.forEach((h, i) => {
      if (h.downed) {
        h.downed = false;
        h.hp = 1;
        ev.push({ type: 'revived', target: { side: 'hero', index: i }, hp: 1 });
      }
    });
    ev.push({ type: 'victory' });
    return true;
  }
  if (s.heroes.every((h) => !alive(h))) {
    s.phase = 'defeat';
    s.pendingCommand = null;
    s.pendingEnemy = null;
    ev.push({ type: 'defeat' });
    return true;
  }
  return false;
}

/** 對單位造成傷害（已算好數值），處理倒地、Boss 轉階段 */
function applyDamage(
  s: BattleState, ev: BattleEvent[], ref: ActorRef, amount: number,
  info: { timing?: Timing; weak?: boolean; crit?: boolean; source?: string } = {},
) {
  const u = unitAt(s, ref);
  if (!alive(u)) return;
  u.hp = Math.max(0, u.hp - amount);
  ev.push({ type: 'damage', target: ref, amount, timing: info.timing, weak: !!info.weak, crit: !!info.crit, source: info.source });
  if (u.hp <= 0) {
    u.downed = true;
    u.status.guarding = false;
    if (u.side === 'enemy') u.lamps = 0;
    ev.push({ type: 'downed', target: ref });
    return;
  }
  if (u.side === 'enemy' && u.bossPhase === 1 && u.hp <= u.maxHp * 0.5) {
    const def = ENEMIES[u.id];
    if (def?.attacks.some((a) => a.phase === 2)) {
      u.bossPhase = 2;
      ev.push({ type: 'phaseChange', enemy: ref.index, phase: 2 });
      if (def.traits?.includes('fogPhase2')) {
        s.windowScale = 0.7;
        s.fogRounds = 3;
      }
    }
  }
}

function reduceBreak(s: BattleState, ev: BattleEvent[], idx: number, amount: number) {
  const e = s.enemies[idx];
  if (!e || !alive(e) || e.broken) return;
  e.breakGauge = Math.max(0, e.breakGauge - amount);
  if (e.breakGauge === 0) {
    e.broken = true;
    ev.push({ type: 'break', target: idx });
    gainEmber(s, ev, 2);
  }
}

// ---------- 行動順序 ----------
function startRound(s: BattleState, ev: BattleEvent[]) {
  s.round += 1;
  if (s.round > 1) {
    for (const u of [...s.heroes, ...s.enemies]) {
      const st = u.status;
      st.taunt = Math.max(0, st.taunt - 1);
      st.umbra = Math.max(0, st.umbra - 1);
      st.weakRevealed = Math.max(0, st.weakRevealed - 1);
      st.howl = Math.max(0, st.howl - 1);
    }
    if (s.fogRounds > 0 && --s.fogRounds === 0) s.windowScale = 1;
    if (s.leadBonusRounds > 0 && --s.leadBonusRounds === 0) s.telegraphLeadBonusMs = 0;
  }
  const entries: { ref: ActorRef; spd: number; order: number }[] = [];
  s.heroes.forEach((h, i) => entries.push({ ref: { side: 'hero', index: i }, spd: h.spd, order: i }));
  s.enemies.forEach((e, i) => {
    for (let k = 0; k < e.actionsPerRound; k++) {
      entries.push({ ref: { side: 'enemy', index: i }, spd: e.spd / (k + 1), order: 10 + i + k * 0.5 });
    }
  });
  entries.sort((a, b) => b.spd - a.spd || a.order - b.order);
  const ambush = s.round === 1 && !!s.flags.ambushed;
  s.queue = entries.filter((e) => !(ambush && e.ref.side === 'hero')).map((e) => e.ref);
  void ev;
}

function nextActor(s: BattleState, ev: BattleEvent[]) {
  s.pendingCommand = null;
  s.pendingEnemy = null;
  for (let guard = 0; guard < 500; guard++) {
    if (checkEnd(s, ev)) return;
    if (s.queue.length === 0) startRound(s, ev);
    const ref = s.queue.shift()!;
    const u = unitAt(s, ref);
    if (!alive(u)) continue;
    s.actor = ref;
    ev.push({ type: 'turnStart', actor: ref, round: s.round });
    if (ref.side === 'hero') {
      u.sp = Math.min(MAX_SP, u.sp + 1);
      u.status.guarding = false;
      if (u.id === 'rourke') u.status.counterStance = false;
      if (u.status.poison > 0) {
        u.status.poison -= 1;
        applyDamage(s, ev, ref, Math.max(1, Math.round(u.maxHp * 0.05)), { source: 'poison' });
        if (checkEnd(s, ev)) return;
        if (!alive(u)) continue;
      }
      s.phase = 'playerCommand';
      return;
    }
    // 敵方回合開始：燈印灼傷
    if (u.lamps > 0) {
      const amt = damage({
        atk: s.lampAtk, def: u.def, skillMul: 0.15 * u.lamps, weak: u.weak.includes('fire'), resist: u.resist.includes('fire'),
        broken: u.broken, variance: 1,
      });
      applyDamage(s, ev, ref, amt, { weak: u.weak.includes('fire'), source: 'burn' });
      if (checkEnd(s, ev)) return;
      if (!alive(u)) continue;
    }
    if (u.broken) {
      u.broken = false;
      u.breakGauge = u.breakMax;
      ev.push({ type: 'skip', actor: ref, reason: 'broken' });
      continue;
    }
    if (enemyChooseAction(s, ev, ref.index)) return;
  }
}

/** 回傳 true 表示進入 enemyTelegraph；false 表示做了不需防守的行動（嚎叫） */
function enemyChooseAction(s: BattleState, ev: BattleEvent[], idx: number): boolean {
  const e = s.enemies[idx]!;
  const def = ENEMIES[e.id]!;
  if (def.traits?.includes('howl') && e.status.howl === 0 && rand(s) < 0.15) {
    e.status.howl = 3;
    ev.push({ type: 'statusApplied', target: { side: 'enemy', index: idx }, status: 'howl', rounds: 3 });
    return false;
  }
  const pool = def.attacks.filter((a) => !a.phase || a.phase <= e.bossPhase);
  const totalW = pool.reduce((a, b) => a + b.weight, 0);
  let r = rand(s) * totalW;
  let attack = pool[0]!;
  for (const a of pool) {
    r -= a.weight;
    if (r < 0) {
      attack = a;
      break;
    }
  }
  const living = s.heroes.map((h, i) => ({ h, i })).filter((x) => alive(x.h));
  let targets: number[];
  if (attack.aoe) targets = living.map((x) => x.i);
  else {
    const taunter = living.find((x) => x.h.status.taunt > 0);
    if (taunter) targets = [taunter.i];
    else {
      const ws = living.map((x) => 1 + 0.5 * (1 - x.h.hp / x.h.maxHp));
      let t = rand(s) * ws.reduce((a, b) => a + b, 0);
      let pickI = living[0]!.i;
      for (let k = 0; k < living.length; k++) {
        t -= ws[k]!;
        if (t < 0) {
          pickI = living[k]!.i;
          break;
        }
      }
      targets = [pickI];
    }
  }
  const hits = attack.hits ?? [0];
  s.pendingEnemy = { enemy: idx, attack, targets, hits };
  s.phase = 'enemyTelegraph';
  ev.push({
    type: 'telegraph', enemy: idx, attack: attack.id, telegraph: attack.telegraph, windUpMs: attack.windUpMs, hits, targets,
    windowScale: s.windowScale, leadBonusMs: s.telegraphLeadBonusMs,
  });
  return true;
}

// ---------- 我方指令 ----------
export interface AvailableCommand {
  type: Command['type'];
  skillId?: string;
  itemId?: ItemId;
  name: string;
  costSp?: number;
  costEmber?: number;
  usable: boolean;
  count?: number;
}

export function currentHero(s: BattleState): Unit | null {
  return s.actor?.side === 'hero' ? unitAt(s, s.actor) : null;
}

function skillUsable(s: BattleState, hero: Unit, skillId: string): boolean {
  const sk = SKILLS[skillId];
  if (!sk || sk.hero !== hero.id) return false;
  if (sk.unlockFlag && !s.flags[sk.unlockFlag]) return false;
  if ((sk.costSp ?? 0) > hero.sp) return false;
  if ((sk.costEmber ?? 0) > s.ember) return false;
  if (sk.oncePerBattle && s.usedOnce.includes(sk.id)) return false;
  if (sk.id === 'lamp_mark' && totalLamps(s) >= MAX_LAMPS) return false;
  if (sk.id === 'resonance' && totalLamps(s) === 0) return false;
  if (sk.id === 'rewind' && !s.rewindSnapshot) return false;
  if (sk.id === 'silence' && !s.enemies.some((e) => alive(e) && e.status.howl > 0)) return false;
  return true;
}

export function availableCommands(s: BattleState): AvailableCommand[] {
  const hero = currentHero(s);
  if (!hero || s.phase !== 'playerCommand') return [];
  const out: AvailableCommand[] = [{ type: 'attack', name: BASIC_ATTACK[hero.id as HeroId].name, usable: true }];
  for (const sk of Object.values(SKILLS)) {
    if (sk.hero !== hero.id) continue;
    if (sk.unlockFlag && !s.flags[sk.unlockFlag]) continue;
    out.push({
      type: 'skill', skillId: sk.id, name: sk.name, costSp: sk.costSp, costEmber: sk.costEmber, usable: skillUsable(s, hero, sk.id),
    });
  }
  for (const id of Object.keys(ITEMS) as ItemId[]) {
    const n = s.items[id];
    if (n === undefined) continue;
    out.push({ type: 'item', itemId: id, name: ITEMS[id].name, count: n, usable: n > 0 });
  }
  out.push({ type: 'guard', name: '防禦', usable: true });
  return out;
}

function firstAliveEnemy(s: BattleState): number {
  return s.enemies.findIndex(alive);
}

export function chooseCommand(state: BattleState, cmd: Command): Result {
  const s = structuredClone(state);
  const ev: BattleEvent[] = [];
  const hero = currentHero(s);
  if (s.phase !== 'playerCommand' || !hero || !s.actor) throw new Error(`chooseCommand in phase ${s.phase}`);
  const actor = s.actor;
  const c: Command = { ...cmd };
  if (c.type === 'attack' || (c.type === 'skill' && SKILLS[c.skillId ?? '']?.targeting === 'enemy')) {
    if (c.target === undefined || !s.enemies[c.target] || !alive(s.enemies[c.target]!)) c.target = firstAliveEnemy(s);
  }
  ev.push({ type: 'command', actor, command: c });

  if (c.type === 'guard') {
    hero.status.guarding = true;
    hero.sp = Math.min(MAX_SP, hero.sp + 1);
    gainEmber(s, ev, 1);
    ev.push({ type: 'statusApplied', target: actor, status: 'guarding' });
    nextActor(s, ev);
    return { state: s, events: ev };
  }
  if (c.type === 'item') {
    const id = c.itemId;
    if (!id || !(s.items[id]! > 0)) throw new Error('item unavailable');
    s.items[id] = s.items[id]! - 1;
    if (id === 'blast_bottle') {
      s.enemies.forEach((e, i) => {
        if (!alive(e)) return;
        const weak = e.weak.includes('fire');
        const mul = weak ? 1.5 : e.resist.includes('fire') ? 0.5 : 1;
        applyDamage(s, ev, { side: 'enemy', index: i }, Math.round(ITEMS.blast_bottle.blastDmg * mul), { weak, source: 'item' });
      });
      nextActor(s, ev);
      return { state: s, events: ev };
    }
    const tIdx = c.target ?? actor.index;
    const t = s.heroes[tIdx];
    if (!t) throw new Error('bad item target');
    if (id === 'potion_s' && alive(t)) {
      const amt = Math.min(ITEMS.potion_s.healHp, t.maxHp - t.hp);
      t.hp += amt;
      ev.push({ type: 'heal', target: { side: 'hero', index: tIdx }, amount: amt });
    } else if (id === 'lamp_oil') {
      t.sp = Math.min(MAX_SP, t.sp + ITEMS.lamp_oil.restoreSp);
    }
    nextActor(s, ev);
    return { state: s, events: ev };
  }
  if (c.type === 'attack') {
    s.pendingCommand = c;
    s.phase = 'playerTiming';
    return { state: s, events: ev };
  }
  // skill
  const sk = SKILLS[c.skillId ?? ''];
  if (!sk || !skillUsable(s, hero, sk.id)) throw new Error(`skill ${c.skillId} not usable`);
  hero.sp -= sk.costSp ?? 0;
  if (sk.costEmber) gainEmber(s, ev, -sk.costEmber);
  if (sk.oncePerBattle) s.usedOnce.push(sk.id);
  if (sk.timing) {
    s.pendingCommand = c;
    s.phase = 'playerTiming';
    return { state: s, events: ev };
  }
  applyInstantSkill(s, ev, hero, actor, sk.id, c.target);
  if (!checkEnd(s, ev)) nextActor(s, ev);
  return { state: s, events: ev };
}

function applyInstantSkill(s: BattleState, ev: BattleEvent[], hero: Unit, actor: ActorRef, id: string, target?: number) {
  switch (id) {
    case 'taunt':
      hero.status.taunt = 2;
      ev.push({ type: 'statusApplied', target: actor, status: 'taunt', rounds: 2 });
      break;
    case 'counter_stance':
      hero.status.counterStance = true;
      ev.push({ type: 'statusApplied', target: actor, status: 'counterStance' });
      break;
    case 'veteran_instinct':
      s.telegraphLeadBonusMs = 200;
      s.leadBonusRounds = 2;
      ev.push({ type: 'statusApplied', target: actor, status: 'veteranInstinct', rounds: 2 });
      break;
    case 'guiding_light':
      s.enemies.forEach((e, i) => {
        if (!alive(e)) return;
        e.status.weakRevealed = 2;
        ev.push({ type: 'statusApplied', target: { side: 'enemy', index: i }, status: 'weakRevealed', rounds: 2 });
      });
      s.heroes.forEach((h, i) => {
        if (i !== actor.index && alive(h)) h.status.empowered = true;
      });
      break;
    case 'silence': {
      const idx = target !== undefined && s.enemies[target]?.status.howl ? target : s.enemies.findIndex((e) => e.status.howl > 0);
      const e = s.enemies[idx];
      if (e) {
        e.status.howl = 0;
        ev.push({ type: 'statusApplied', target: { side: 'enemy', index: idx }, status: 'silenced' });
      }
      break;
    }
    case 'rewind': {
      const snap = s.rewindSnapshot;
      if (!snap) break;
      s.heroes.forEach((h, i) => {
        const p = snap[i];
        if (!p) return;
        const ref: ActorRef = { side: 'hero', index: i };
        if (h.downed && !p.downed) {
          h.downed = false;
          ev.push({ type: 'revived', target: ref, hp: p.hp });
        }
        if (p.hp > h.hp) {
          ev.push({ type: 'heal', target: ref, amount: p.hp - h.hp });
          h.hp = p.hp;
        }
        h.status.poison = Math.min(h.status.poison, p.poison);
        h.status.umbra = Math.min(h.status.umbra, p.umbra);
      });
      s.rewindSnapshot = null;
      break;
    }
  }
}

export function resolveTiming(state: BattleState, timing: Timing): Result {
  const s = structuredClone(state);
  const ev: BattleEvent[] = [];
  const c = s.pendingCommand;
  const hero = currentHero(s);
  if (s.phase !== 'playerTiming' || !c || !hero || !s.actor) throw new Error(`resolveTiming in phase ${s.phase}`);
  const empowered = hero.status.empowered ? 1.3 : 1;
  let emberEarned = false;

  const hitEnemy = (idx: number, mul: number, elem: Element[], noEmber: boolean): { weak: boolean; amount: number } => {
    const e = s.enemies[idx]!;
    const weak = elem.some((el) => e.weak.includes(el));
    const resist = !weak && elem.every((el) => e.resist.includes(el));
    const amount = damage({
      atk: hero.atk, def: e.def, skillMul: mul * empowered, timing, weak, resist, broken: e.broken, variance: variance(s),
    });
    applyDamage(s, ev, { side: 'enemy', index: idx }, amount, { timing, weak, crit: timing === 'perfect' });
    if (weak) reduceBreak(s, ev, idx, 10 + (timing === 'perfect' ? 5 : 0));
    if (!noEmber && (weak || timing === 'perfect')) emberEarned = true;
    return { weak, amount };
  };

  if (c.type === 'attack') {
    const basic = BASIC_ATTACK[hero.id as HeroId];
    const targets = basic.all ? s.enemies.map((_, i) => i).filter((i) => alive(s.enemies[i]!)) : [c.target ?? firstAliveEnemy(s)];
    for (const t of targets) if (t >= 0 && alive(s.enemies[t]!)) hitEnemy(t, basic.mul, [hero.element], false);
    hero.status.empowered = false;
  } else if (c.skillId === 'lamp_mark') {
    const t = c.target ?? firstAliveEnemy(s);
    const e = s.enemies[t];
    if (e && alive(e)) {
      const want = timing === 'perfect' ? 2 : 1;
      const n = Math.min(want, MAX_LAMPS - totalLamps(s));
      if (n > 0) {
        e.lamps += n;
        s.lampAtk = hero.atk;
        ev.push({ type: 'lampPlaced', target: t, count: n, total: totalLamps(s) });
      }
    }
  } else if (c.skillId === 'resonance') {
    const N = totalLamps(s);
    const per: { target: number; lamps: number; amount: number }[] = [];
    const snapshot = s.enemies.map((e) => (alive(e) ? e.lamps : 0));
    s.enemies.forEach((e) => (e.lamps = 0));
    snapshot.forEach((n, i) => {
      if (n <= 0) return;
      const r = hitEnemy(i, resonanceMul(n, N), ['fire', 'light'], true);
      per.push({ target: i, lamps: n, amount: r.amount });
    });
    ev.push({ type: 'resonance', perTarget: per, totalLamps: N });
  } else if (c.skillId === 'glimmer_song') {
    const pct = timing === 'perfect' ? 0.3 : 0.2;
    s.heroes.forEach((h, i) => {
      const ref: ActorRef = { side: 'hero', index: i };
      if (h.downed) {
        h.downed = false;
        h.hp = Math.max(1, Math.round(h.maxHp * 0.2));
        ev.push({ type: 'revived', target: ref, hp: h.hp });
      } else {
        const amt = Math.min(Math.round(h.maxHp * pct), h.maxHp - h.hp);
        h.hp += amt;
        ev.push({ type: 'heal', target: ref, amount: amt });
      }
    });
  }
  if (emberEarned) gainEmber(s, ev, 1);
  if (!checkEnd(s, ev)) nextActor(s, ev);
  return { state: s, events: ev };
}

// ---------- 敵方攻擊結算 ----------
export function resolveDefense(state: BattleState, results: DefenseResult[]): Result {
  const s = structuredClone(state);
  const ev: BattleEvent[] = [];
  const p = s.pendingEnemy;
  if (s.phase !== 'enemyTelegraph' || !p) throw new Error(`resolveDefense in phase ${s.phase}`);
  const e = s.enemies[p.enemy]!;
  const atk = p.attack;
  s.rewindSnapshot = s.heroes.map((h) => ({ hp: h.hp, downed: h.downed, poison: h.status.poison, umbra: h.status.umbra }));
  let anyPerfect = false;
  let anyFail = false;
  let anySuccess = false;
  p.hits.forEach((_, hi) => {
    const r: DefenseResult = results[hi] ?? 'fail';
    ev.push({ type: 'defense', hit: hi, result: r });
    if (r === 'perfect') anyPerfect = true;
    if (r === 'fail') anyFail = true;
    else anySuccess = true;
    const mul = defenseMul(atk.telegraph, r);
    for (const ti of p.targets) {
      const h = s.heroes[ti]!;
      if (!alive(h)) continue;
      if (mul > 0) {
        const base = damage({
          atk: e.atk * (e.status.howl > 0 ? 1.2 : 1), def: h.def, skillMul: atk.mul, guarding: h.status.guarding, variance: variance(s),
        });
        const amount = Math.max(1, Math.round(base * mul * (h.status.umbra > 0 ? 1.2 : 1)));
        applyDamage(s, ev, { side: 'hero', index: ti }, amount, { source: atk.id });
      }
    }
    // 反擊（白光格擋）
    if (atk.telegraph === 'white' && r !== 'fail' && alive(e)) {
      const ti = p.targets[0]!;
      const h = s.heroes[ti]!;
      const stance = h.status.counterStance;
      if (alive(h) && (r === 'perfect' || stance)) {
        const amount = damage({ atk: h.atk, def: e.def, skillMul: stance ? 1.0 : 0.5, broken: e.broken, variance: variance(s) });
        applyDamage(s, ev, { side: 'enemy', index: p.enemy }, amount, { source: 'counter' });
        ev.push({ type: 'counter', hero: ti, enemy: p.enemy, amount });
      }
    }
  });
  if (anyFail && atk.status) {
    for (const ti of p.targets) {
      const h = s.heroes[ti]!;
      if (!alive(h)) continue;
      h.status[atk.status] = 3;
      ev.push({ type: 'statusApplied', target: { side: 'hero', index: ti }, status: atk.status, rounds: 3 });
    }
  }
  if (anyPerfect) gainEmber(s, ev, 1);
  if (anySuccess && atk.id === 'charge' && ENEMIES[e.id]?.traits?.includes('wallCrash')) reduceBreak(s, ev, p.enemy, 20);
  if (!checkEnd(s, ev)) nextActor(s, ev);
  return { state: s, events: ev };
}

/**
 * 公開的推進：一般情況下 chooseCommand/resolveTiming/resolveDefense 會自動推進到下一位行動者。
 * 若 UI 需要手動跳過目前行動者（例如逾時），可呼叫此函式。
 */
export function advance(state: BattleState): Result {
  const s = structuredClone(state);
  const ev: BattleEvent[] = [];
  if (!over(s)) nextActor(s, ev);
  return { state: s, events: ev };
}
