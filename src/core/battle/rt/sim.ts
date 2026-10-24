// 控制器、無畫面模擬器與統計（design/19 §7、D-063 P2）。
// 控制器只讀 BattleState、回傳 BattleCommand；同種子＋同控制器＝同結果（stateHash 驗證）。
import { SKILLS } from './data';
import { createBattle, dist, enemiesOf, inShape, playerOf, stateHash, step, type BattleSetup } from './engine';
import type { BattleCommand, BattleState, Telegraph } from './types';

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
}

export const BOT_PROFILES: Record<'auto' | 'novice' | 'normal' | 'expert', BotSkill> = {
  // AUTO：不保證閃避（design/19 §5：不用隱藏懲罰，只是策略保守）
  auto: { parries: false },
  novice: { reactTicks: 18, parries: false },
  normal: { reactTicks: 9, parries: true },
  expert: { reactTicks: 4, parries: true },
};

/** 會打到玩家目前位置、還沒結算的預告 */
function threats(s: BattleState): Telegraph[] {
  const p = playerOf(s);
  return s.telegraphs.filter((t) => t.hitTick > s.tick && inShape(t.shape, t.ox, t.oy, t.dirX, t.dirY, p.x, p.y, p.r + 10));
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
