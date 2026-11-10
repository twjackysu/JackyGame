// 技能自動施放（第三期 P1，D-342）：每個技能欄可以切「自動／手動」。
// 自動的時機與目標在這裡決定（core、確定性、不用亂數）；畫面層只切開關、不決定放不放。
// 閃避與格擋反擊永遠手動（吃技巧的部分不自動化）。
import { ctlOf, dist, enemiesOf, foesOf, inShape, playerDef, skillDef, skillShape } from './engine';
import { UNIT, type BattleState, type SkillDefinition, type Unit } from './types';

const DIR = 1000;

/** 可以切成自動的技能欄（依判斷的優先順序：大招 → 範圍 → 單體 → 位移） */
export const AUTO_SKILL_IDS: readonly string[] = ['blade_storm', 'whirlwind', 'heavy_slash', 'charge'];
/** 預設：兩個輸出技自動；位移技（會把人帶走）與大招（要留給 Boss）預設手動，可以自己開 */
export const AUTO_SKILL_DEFAULT: readonly string[] = ['heavy_slash', 'whirlwind'];

/** 讀進來的設定一律檢查；不是陣列（舊存檔沒有這一欄）＝預設 */
export function cleanAutoSkills(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...AUTO_SKILL_DEFAULT];
  return AUTO_SKILL_IDS.filter((id) => raw.includes(id));
}

/** 這一招放下去的時間內，會不會有敵人的預告打在玩家現在站的位置（有＝玩家該走位，不要把他定住） */
function threatened(s: BattleState, p: Unit, withinTicks: number): boolean {
  for (const t of s.telegraphs) {
    if (t.ownerId === p.id || t.hitTick <= s.tick || t.hitTick > s.tick + withinTicks) continue;
    if (inShape(t.shape, t.ox, t.oy, t.dirX, t.dirY, p.x, p.y, p.r)) return true;
  }
  return false;
}

/** 朝 (dx, dy) 放這一招會打到幾隻（任何一段打得到就算）；big＝打得到精英／Boss；tgt＝打得到目前目標 */
function hitsToward(s: BattleState, p: Unit, id: string, sk: SkillDefinition, foes: readonly Unit[], dx: number, dy: number, targetId: number | null): { n: number; big: boolean; tgt: boolean } {
  const len = Math.sqrt(dx * dx + dy * dy);
  const dirX = len === 0 ? p.facingX : Math.round((dx * DIR) / len);
  const dirY = len === 0 ? p.facingY : Math.round((dy * DIR) / len);
  let n = 0;
  let big = false;
  let tgt = false;
  for (const e of foes) {
    for (const h of sk.hits) {
      const ox = h.ahead ? p.x + Math.round((dirX * h.ahead) / DIR) : p.x;
      const oy = h.ahead ? p.y + Math.round((dirY * h.ahead) / DIR) : p.y;
      if (!inShape(skillShape(s, id, h.shape, p), ox, oy, dirX, dirY, e.x, e.y, e.r)) continue;
      n++;
      if (e.tier === 'elite' || e.tier === 'boss' || e.maxHp >= 2000) big = true;
      if (e.id === targetId) tgt = true;
      break;
    }
  }
  return { n, big, tgt };
}

const directional = (sk: SkillDefinition): boolean => sk.hits.some((h) => h.shape.type === 'sector' || h.shape.type === 'line' || !!h.ahead);

/**
 * 這個 tick 要不要自動放一招、朝誰放。回傳 null＝不放。
 * 規則（和通關 Bot 同一套想法，但多了「挑方向」與「不搶走位」）：
 * - 只對「交戰中」的敵人放（不會自己把睡著的怪打醒）；沒人打得到就不放（不對空放）
 * - 普攻出手前不放（不吃掉那一下普攻）；命中後可以接技能取消後搖
 * - 玩家正在手動走位：只放可以邊走邊放的招（不把人定住）
 * - 玩家站在快要落下的預告裡：不放會定住的招（讓他走／閃）
 * - 有方向的招（扇形／直線）：從目前目標與附近敵人裡挑打到最多隻的方向；同分用目前目標
 * - 範圍技要 2 隻以上（或附近只剩這一隻、或打得到精英／Boss）；大招要 3 隻以上或打得到精英／Boss
 * - 位移技：往前衝的等目標在 2.5 格外、衝得到的距離內才放；往後跳的等敵人貼近才放
 */
export function autoPick(s: BattleState, p: Unit): { id: string; aim?: Unit } | null {
  const ctl = ctlOf(s, p);
  const on = ctl.autoSkills;
  if (!on?.length || p.dead) return null;
  const a = p.action;
  if (a) {
    if (a.kind !== 'attack') return null;
    if (s.tick - a.start <= playerDef(s, p).attackWindupTicks) return null;
  }
  let foes: Unit[] | null = null;
  const moving = !!ctl.manualMove || !!ctl.moveGoal;
  for (const id of AUTO_SKILL_IDS) {
    if (!on.includes(id) || (p.ready[id] ?? 0) > s.tick) continue;
    const sk = skillDef(s, id, p);
    if (!sk || sk.block || (sk.mp && p.mp < sk.mp)) continue;
    const rooted = sk.moveFactor === 0 || !!sk.dash;
    if (moving && rooted) continue;
    foes ??= (s.others?.length ? foesOf(s, p) : enemiesOf(s)).filter((e) => !e.mode || e.mode === 'combat');
    if (foes.length === 0) return null;
    if (sk.moveFactor < 0.5 && threatened(s, p, sk.castTicks + 3)) continue;
    const cur = foes.find((e) => e.id === p.targetId);
    if (sk.dash) {
      // 位移技看距離，不看形狀（打點在位移之後）
      const t = cur ?? nearest(p, foes);
      const d = dist(p.x, p.y, t.x, t.y);
      const reach = sk.useRange ?? 0;
      if (sk.dash.distance > 0 ? d > 2.5 * UNIT && d <= reach : d <= reach + t.r) return { id, aim: t };
      continue;
    }
    // 候選方向：目前目標優先，其次是射程內的敵人（最多 8 隻，依 units 順序＝確定性）
    const reach = (sk.useRange ?? 0) + 2 * UNIT;
    const cands: Unit[] = cur ? [cur] : [];
    if (directional(sk) && !sk.aimTicks) {
      for (const e of foes) {
        if (cands.length >= 8) break;
        if (e !== cur && dist(p.x, p.y, e.x, e.y) <= reach + e.r) cands.push(e);
      }
    } else if (!cur) cands.push(nearest(p, foes));
    let best: { n: number; big: boolean; tgt: boolean } | null = null;
    let aim: Unit | undefined;
    for (const c of cands) {
      const r = hitsToward(s, p, id, sk, foes, c.x - p.x, c.y - p.y, p.targetId);
      if (!best || r.n > best.n) {
        best = r;
        aim = c;
      }
    }
    if (!best || best.n === 0) continue;
    let ok: boolean;
    if (sk.role === 'ult') ok = best.n >= 3 || best.big;
    else if (sk.role === 'aoe') {
      let around = 0;
      for (const e of foes) if (dist(p.x, p.y, e.x, e.y) <= 2 * reach) around++;
      ok = best.n >= 2 || best.big || best.n >= around;
    } else ok = true;
    if (ok) return { id, aim };
  }
  return null;
}

function nearest(p: Unit, foes: readonly Unit[]): Unit {
  let best = foes[0]!;
  let bd = Infinity;
  for (const e of foes) {
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}
