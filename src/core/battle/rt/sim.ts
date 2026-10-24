// 控制器、無畫面模擬器與統計（design/19 §7、D-063 P2）。
// 控制器只讀 BattleState、回傳 BattleCommand；同種子＋同控制器＝同結果（stateHash 驗證）。
import { SKILLS, STAGES } from './data';
import { createBattle, dist, enemiesOf, inShape, playerOf, stateHash, step, type BattleSetup } from './engine';
import { AGGRO_RULES, CAMPFIRE_RULES, UNIT, type BattleCommand, type BattleState, type Telegraph } from './types';

export interface BattleController {
  readonly name: string;
  decide(s: BattleState): BattleCommand[];
}

/** 什麼都不按（只靠自動追擊與普攻） */
export class IdleController implements BattleController {
  readonly name = 'idle';
  decide(): BattleCommand[] {
    return [];
  }
}

/** 照輸入紀錄重播（tick → 指令） */
export class ScriptedTestController implements BattleController {
  readonly name = 'scripted';
  constructor(private log: Record<number, BattleCommand[]>) {}
  decide(s: BattleState): BattleCommand[] {
    return this.log[s.tick + 1] ?? [];
  }
}

export interface BotSkill {
  /** 看到預告後幾 tick 才反應（新手 18、普通 9、熟練 4；undefined ＝不閃） */
  reactTicks?: number;
  /** 會不會用格擋反擊去接可格擋的攻擊 */
  parries: boolean;
  /** 會不會放大招（劍刃風暴）；試玩鍵位還沒有大招，預設不放，報表另列 */
  ult?: boolean;
  /** HP 低於這個百分比就喝藥水（undefined＝不喝；試玩鍵位還沒有藥水） */
  potionAtPct?: number;
  /** 地圖怪關卡（D-073）：清完一組後，HP 回到這個百分比才點下一隻待機的怪（undefined＝馬上點） */
  restUntilPct?: number;
  /** 地圖怪關卡：挑「不會連帶拉到第二組」的怪（safestPull）；沒設＝直接點最近的 */
  safePull?: boolean;
  /** 有營火的地圖：沒在打的時候，藥水少於這個數就走回最近的營火休息補滿（undefined＝不回營火） */
  campfireBelowPotions?: number;
  /**
   * 地圖版：往這個點推進（例如 Boss 巢穴）。挑怪時只挑「不比自己離目標更遠」的待機怪（清路往前走），
   * 前面沒有怪了才照原本規則挑；沒設＝原本行為（只挑最近／最安全的）。
   */
  advanceTo?: { x: number; y: number };
}

export const BOT_PROFILES: Record<'auto' | 'novice' | 'normal' | 'expert', BotSkill> = {
  // AUTO：不保證閃避（design/19 §5：不用隱藏懲罰，只是策略保守）
  auto: { parries: false },
  novice: { reactTicks: 18, parries: false, restUntilPct: 60, safePull: true },
  normal: { reactTicks: 9, parries: true, restUntilPct: 80, safePull: true },
  expert: { reactTicks: 4, parries: true, restUntilPct: 85, safePull: true },
};

/** 會打到玩家目前位置、還沒結算的預告 */
function threats(s: BattleState): Telegraph[] {
  const p = playerOf(s);
  return s.telegraphs.filter((t) => t.hitTick > s.tick && inShape(t.shape, t.ox, t.oy, t.dirX, t.dirY, p.x, p.y, p.r + 10));
}

type U = BattleState['units'][number];
const sleepingOf = (s: BattleState): U[] => s.units.filter((e) => e.side === 'enemy' && !e.dead && (e.mode === 'idle' || e.mode === 'dormant'));

function nearestSleeping(s: BattleState): U | undefined {
  const p = playerOf(s);
  let best: U | undefined;
  for (const e of sleepingOf(s)) if (!best || dist(e.x, e.y, p.x, p.y) < dist(best.x, best.y, p.x, p.y)) best = e;
  return best;
}

/**
 * 拉怪判斷（像真人一樣「一次拉一組」）：點了 e 會一起醒的同伴（3 單位連鎖，同引擎 aggro）＝一組；
 * 在這組位置開打時，仇恨半徑內的其他待機怪＝會被連帶拉到的「第二組」。
 * 依（連帶隻數、這組隻數、距離）挑最安全的；全部都會連帶時仍挑連帶最少的。
 */
export function pullRisk(s: BattleState, e: U): { group: number; extra: number } {
  const sleeping = sleepingOf(s);
  const group = new Set<U>([e]);
  const queue = [e];
  while (queue.length) {
    const g = queue.pop()!;
    for (const o of sleeping) if (!group.has(o) && dist(o.x, o.y, g.x, g.y) <= 3 * UNIT) {
      group.add(o);
      queue.push(o);
    }
  }
  // 第二組：在這組位置開打、或走過去的路上（直線近似），會進入其仇恨半徑的其他待機怪
  const p = playerOf(s);
  let extra = 0;
  for (const o of sleeping) {
    if (group.has(o)) continue;
    const r = AGGRO_RULES[o.tier ?? 'normal'].aggro * UNIT + p.r;
    if (segDist(o.x, o.y, p.x, p.y, e.x, e.y) <= r) {
      extra++;
      continue;
    }
    for (const g of group) if (dist(o.x, o.y, g.x, g.y) <= r) {
      extra++;
      break;
    }
  }
  return { group: group.size, extra };
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2));
  return dist(px, py, ax + t * vx, ay + t * vy);
}

export function safestPull(s: BattleState, advanceTo?: { x: number; y: number }): U | undefined {
  const p = playerOf(s);
  let best: U | undefined;
  let key: [number, number, number] | undefined;
  let pool = sleepingOf(s);
  if (advanceTo) {
    const ahead = pool.filter((e) => dist(e.x, e.y, advanceTo.x, advanceTo.y) <= dist(p.x, p.y, advanceTo.x, advanceTo.y) + 2 * UNIT);
    if (ahead.length) pool = ahead;
  }
  for (const e of pool) {
    const r = pullRisk(s, e);
    const k: [number, number, number] = [r.extra, r.group, dist(e.x, e.y, p.x, p.y)];
    if (!key || k[0] < key[0] || (k[0] === key[0] && (k[1] < key[1] || (k[1] === key[1] && k[2] < key[2])))) {
      best = e;
      key = k;
    }
  }
  return best;
}

/**
 * 基礎玩家 Bot：自動追擊＋依情況放技能；看到預告（過了反應時間）就閃避或格擋。
 * 閃避方向：離開預告原點（直線攻擊改往側面）。
 */
export class PlayerBot implements BattleController {
  readonly name: string;
  constructor(private prof: BotSkill, name: string) {
    this.name = name;
  }
  decide(s: BattleState): BattleCommand[] {
    const p = playerOf(s);
    const out: BattleCommand[] = [];
    const ready = (id: string) => (p.ready[id] ?? 0) <= s.tick + 1;
    const busy = !!p.action && p.action.kind !== 'attack';
    // 地圖怪：沒有戰鬥中的怪時，休息到 restUntilPct 再點下一隻待機的怪（D-073）
    const es0 = s.units.filter((e) => e.side === 'enemy' && !e.dead);
    const sleeping = (e: (typeof es0)[number]) => e.mode === 'idle' || e.mode === 'dormant';
    const fires = STAGES[s.stageId]?.campfires ?? [];
    if (fires.length && this.prof.campfireBelowPotions !== undefined && s.potions < this.prof.campfireBelowPotions && !es0.some((e) => e.mode === 'combat')) {
      let c = fires[0]!;
      for (const f of fires) if (dist(f.x, f.y, p.x, p.y) < dist(c.x, c.y, p.x, p.y)) c = f;
      if (dist(c.x, c.y, p.x, p.y) <= CAMPFIRE_RULES.restUnits * UNIT - 10) return [{ type: 'rest' }];
      if (!s.moveGoal || s.moveGoal.x !== c.x || s.moveGoal.y !== c.y + UNIT) return [{ type: 'moveTo', x: c.x, y: c.y + UNIT }];
      return [];
    }
    if (es0.length && !es0.some((e) => e.mode === 'combat') && es0.some(sleeping)) {
      const want = this.prof.restUntilPct ?? 0;
      const tgt = s.units.find((e) => e.id === p.targetId);
      if (p.hp * 100 >= p.maxHp * want && (!tgt || tgt.dead || !sleeping(tgt))) {
        const best = this.prof.safePull ? safestPull(s, this.prof.advanceTo) : nearestSleeping(s);
        if (best) return [{ type: 'target', id: best.id }];
      }
      if (p.hp * 100 < p.maxHp * want) return [{ type: 'stop' }];
    }
    // 0. 藥水（瞬間、不打斷動作）
    if (this.prof.potionAtPct !== undefined && s.potions > 0 && ready('potion') && p.hp * 100 < p.maxHp * this.prof.potionAtPct) out.push({ type: 'potion' });
    // 1. 迴避
    if (this.prof.reactTicks !== undefined) {
      const seen = threats(s).filter((t) => s.tick + 1 - t.startTick >= this.prof.reactTicks!);
      const t = seen.sort((a, b) => a.hitTick - b.hitTick)[0];
      if (t) {
        const left = t.hitTick - (s.tick + 1);
        const parryOk = this.prof.parries && t.blockable && ready('parry') && !busy && left <= 6 && left >= 0;
        if (parryOk) return [{ type: 'skill', id: 'parry' }];
        let dx = p.x - t.ox;
        let dy = p.y - t.oy;
        if (t.shape.type === 'line' || t.shape.type === 'sector') {
          // 往預告方向的側面離開
          const sx = -t.dirY;
          const sy = t.dirX;
          const side = (p.x - t.ox) * sx + (p.y - t.oy) * sy >= 0 ? 1 : -1;
          dx = sx * side;
          dy = sy * side;
        } else if (t.shape.type === 'ring') {
          // 環形震波：貼近中心比較安全
          dx = t.ox - p.x;
          dy = t.oy - p.y;
        }
        // 閃避的無敵是第 1～6 tick：等到快打到才按（衝鋒要等它真的衝過來）
        const charge = t.attackId.includes('charge');
        if (ready('dodge') && left <= (charge ? 2 : 4)) return [{ type: 'dodge', dx, dy }];
        if (ready('dodge') && !charge) return out;
        // 閃避還在冷卻：用走的離開（技能施放中走不動就算了）
        if (!busy) return [{ type: 'move', dx, dy }];
      }
    }
    if (busy) return out;
    // 2. 技能
    const es = enemiesOf(s);
    if (es.length === 0) return out;
    const near = es.filter((e) => dist(p.x, p.y, e.x, e.y) <= (SKILLS.whirlwind!.useRange ?? 0) + e.r);
    const tgt = es.find((e) => e.id === p.targetId) ?? es.slice().sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y))[0]!;
    const d = dist(p.x, p.y, tgt.x, tgt.y);
    const ult = SKILLS.blade_storm!;
    const ultNear = es.filter((e) => dist(p.x, p.y, e.x, e.y) <= (ult.useRange ?? 0) + e.r);
    const bossNear = ultNear.some((e) => e.maxHp >= 2000);
    if (this.prof.ult && ready('blade_storm') && p.mp >= (ult.mp ?? 0) && (ultNear.length >= 3 || bossNear)) out.push({ type: 'skill', id: 'blade_storm' });
    else if (near.length >= 2 && ready('whirlwind')) out.push({ type: 'skill', id: 'whirlwind' });
    else if (d <= (SKILLS.heavy_slash!.useRange ?? 0) + tgt.r && ready('heavy_slash')) out.push({ type: 'skill', id: 'heavy_slash' });
    else if (d > 250 && d <= (SKILLS.charge!.useRange ?? 0) && ready('charge')) out.push({ type: 'skill', id: 'charge' });
    else if (near.length >= 1 && ready('whirlwind') && es.length === 1) out.push({ type: 'skill', id: 'whirlwind' });
    return out;
  }
}

export interface BattleResult {
  victory: boolean;
  outcome: BattleState['outcome'];
  durationTicks: number;
  totalDamage: number;
  damageTaken: number;
  deaths: number;
  kills: number;
  dodges: number;
  dodgedHits: number;
  blocks: number;
  casts: Record<string, number>;
  /** 玩家造成傷害的來源（普攻／技能／反擊／持續傷害），design/20 C3 目標：普攻 35～45%、技能 45～55% */
  damageBy: { normal: number; skill: number; counter: number; dot: number };
  potionsUsed: number;
  hpLeftPct: number;
  stateHash: string;
}

/** 從事件流算出結果（MetricsCollector 的單場版本） */
export function summarize(s: BattleState): BattleResult {
  const p = playerOf(s);
  let totalDamage = 0;
  let damageTaken = 0;
  let kills = 0;
  let dodges = 0;
  let dodgedHits = 0;
  let blocks = 0;
  const casts: Record<string, number> = {};
  const damageBy = { normal: 0, skill: 0, counter: 0, dot: 0 };
  let potionsUsed = 0;
  for (const e of s.events) {
    if (e.type === 'damage') {
      if (e.src === p.id) {
        totalDamage += e.amount;
        if (e.origin !== 'enemy') damageBy[e.origin] += e.amount;
      }
      if (e.dst === p.id) damageTaken += e.amount;
    } else if (e.type === 'death' && e.id !== p.id) kills++;
    else if (e.type === 'dodge') dodges++;
    else if (e.type === 'dodged') dodgedHits++;
    else if (e.type === 'block') blocks++;
    else if (e.type === 'potion') potionsUsed++;
    else if (e.type === 'cast') casts[e.skill] = (casts[e.skill] ?? 0) + 1;
  }
  return {
    victory: s.outcome === 'victory', outcome: s.outcome, durationTicks: s.tick, totalDamage, damageTaken,
    deaths: p.dead ? 1 : 0, kills, dodges, dodgedHits, blocks, casts, damageBy, potionsUsed, hpLeftPct: Math.round((p.hp / p.maxHp) * 100), stateHash: stateHash(s),
  };
}

/** 跑完一場（無畫面） */
export function simulateBattle(setup: BattleSetup, controller: BattleController): BattleResult {
  const s = createBattle(setup);
  while (s.outcome === 'running') step(s, controller.decide(s));
  return summarize(s);
}

export interface BatchStats {
  runs: number;
  winRate: number;
  durationSec: { p50: number; p90: number; p99: number };
  avgDps: number;
  avgDamageTaken: number;
  avgHpLeftPct: number;
  avgDodges: number;
  avgBlocks: number;
  avgPotions: number;
  /** 傷害來源占比（%，所有場次加總後計算） */
  damageShare: { normal: number; skill: number; counter: number; dot: number };
}

const pct = (sorted: number[], q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;

function share(rs: BattleResult[]): BatchStats['damageShare'] {
  const t = { normal: 0, skill: 0, counter: 0, dot: 0 };
  for (const r of rs) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += r.damageBy[k];
  const sum = t.normal + t.skill + t.counter + t.dot || 1;
  const q = (n: number) => Math.round((n / sum) * 1000) / 10;
  return { normal: q(t.normal), skill: q(t.skill), counter: q(t.counter), dot: q(t.dot) };
}

/** 批量模擬（MetricsCollector）：種子 seed0..seed0+runs-1 */
export function batch(stageId: string, makeController: () => BattleController, runs: number, seed0 = 1, bonus?: BattleSetup['bonus']): BatchStats {
  const rs: BattleResult[] = [];
  for (let i = 0; i < runs; i++) rs.push(simulateBattle({ stageId, seed: seed0 + i, bonus }, makeController()));
  const dur = rs.map((r) => r.durationTicks / 30).sort((a, b) => a - b);
  const avg = (f: (r: BattleResult) => number) => Math.round((rs.reduce((n, r) => n + f(r), 0) / rs.length) * 10) / 10;
  return {
    runs,
    winRate: Math.round((rs.filter((r) => r.victory).length / runs) * 1000) / 10,
    durationSec: { p50: Math.round(pct(dur, 0.5) * 10) / 10, p90: Math.round(pct(dur, 0.9) * 10) / 10, p99: Math.round(pct(dur, 0.99) * 10) / 10 },
    avgDps: avg((r) => r.totalDamage / (r.durationTicks / 30)),
    avgDamageTaken: avg((r) => r.damageTaken),
    avgHpLeftPct: avg((r) => r.hpLeftPct),
    avgDodges: avg((r) => r.dodges),
    avgBlocks: avg((r) => r.blocks),
    avgPotions: avg((r) => r.potionsUsed),
    damageShare: share(rs),
  };
}
