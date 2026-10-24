// 技能樹（純邏輯）。資料：src/data/skillTree.ts。
import { TREE, TREE_BY_ID, type TreeEffect } from '../../data/skillTree';
import type { GameState, MemberId } from './gameState';

export function learned(s: GameState, m: MemberId): string[] {
  return s.tree?.[m] ?? [];
}

/** 技能點總數 = 等級 − 1 */
export function pointsTotal(s: GameState, m: MemberId): number {
  return Math.max(0, (s.members[m]?.level ?? 1) - 1);
}

export function pointsLeft(s: GameState, m: MemberId): number {
  return pointsTotal(s, m) - learned(s, m).reduce((n, id) => n + (TREE_BY_ID[id]?.cost ?? 0), 0);
}

export type LearnBlock = 'ok' | 'learned' | 'locked' | 'points' | 'wrong';

export function learnState(s: GameState, m: MemberId, id: string): LearnBlock {
  const n = TREE_BY_ID[id];
  if (!n || n.hero !== m || !s.members[m]) return 'wrong';
  const have = learned(s, m);
  if (have.includes(id)) return 'learned';
  if (n.tier > 1 && !have.includes(`${m}_${n.branch}_${n.tier - 1}`)) return 'locked';
  if (pointsLeft(s, m) < n.cost) return 'points';
  return 'ok';
}

export function learn(s: GameState, m: MemberId, id: string): boolean {
  if (learnState(s, m, id) !== 'ok') return false;
  s.tree = { ...(s.tree ?? {}) };
  s.tree[m] = [...learned(s, m), id];
  return true;
}

/** 全部重置（免費） */
export function resetTree(s: GameState, m: MemberId): void {
  if (!s.tree) return;
  s.tree = { ...s.tree, [m]: [] };
}

export function treeEffect(s: GameState, m: MemberId): Required<TreeEffect> {
  const out = { hpPct: 0, atkPct: 0, defPct: 0, spd: 0, startSp: 0, startEmber: 0 };
  for (const id of learned(s, m)) {
    const e = TREE_BY_ID[id]?.effect;
    if (!e) continue;
    for (const k of Object.keys(out) as (keyof TreeEffect)[]) out[k] += e[k] ?? 0;
  }
  return out;
}

export function treeFor(m: MemberId) {
  return TREE.filter((n) => n.hero === m);
}
