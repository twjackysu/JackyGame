// 技能樹（純邏輯）。資料：src/data/skillTree.ts（v2：多等級節點、前置節點、分支點數門檻）。
import { BOSS_POINT_CHAPTER, BOSS_POINT_KILLS, TREE, TREE_BY_ID, effectText, type TreeEffect, type TreeNode } from '../../data/skillTree';
import type { GameState, MemberId } from './gameState';

/** 已學的節點（同 id 重複 = 等級）；找不到的舊 id（v1）自動忽略 → 等於退點 */
export function learned(s: GameState, m: MemberId): string[] {
  return (s.tree?.[m] ?? []).filter((id) => TREE_BY_ID[id]?.hero === m);
}

export function rankOf(s: GameState, m: MemberId, id: string): number {
  return learned(s, m).filter((x) => x === id).length;
}

/** Boss 首殺給的額外點數 */
export function bossPoints(s: GameState): number {
  return BOSS_POINT_KILLS.filter((b) => !!s.flags[`kill_${b}`] || !!s.flags[BOSS_POINT_CHAPTER[b]]).length;
}

/** 技能點總數 = 等級 − 1 ＋ Boss 首殺 */
export function pointsTotal(s: GameState, m: MemberId): number {
  if (!s.members[m]) return 0;
  return Math.max(0, (s.members[m]?.level ?? 1) - 1) + bossPoints(s);
}

export function pointsSpent(s: GameState, m: MemberId): number {
  return learned(s, m).reduce((n, id) => n + (TREE_BY_ID[id]?.cost ?? 0), 0);
}

export function pointsLeft(s: GameState, m: MemberId): number {
  return pointsTotal(s, m) - pointsSpent(s, m);
}

/** 某分支已投入點數 */
export function branchPoints(s: GameState, m: MemberId, branch: 0 | 1): number {
  return learned(s, m).reduce((n, id) => n + (TREE_BY_ID[id]?.branch === branch ? TREE_BY_ID[id]!.cost : 0), 0);
}

export type LearnBlock = 'ok' | 'maxed' | 'locked' | 'points' | 'wrong';

/** 還缺什麼（給 UI 顯示）：「需要：劍勢 Lv2／此分支 4 點（目前 1）」；沒缺回傳空字串 */
export function missingText(s: GameState, m: MemberId, n: TreeNode): string {
  const parts: string[] = [];
  for (const [id, r] of n.requires.nodes ?? []) {
    if (rankOf(s, m, id) < r) {
      const p = TREE_BY_ID[id];
      parts.push(`${p?.name ?? id}${(p?.maxRank ?? 1) > 1 ? ` Lv${r}` : ''}`);
    }
  }
  const need = n.requires.branchPoints ?? 0;
  const have = branchPoints(s, m, n.branch);
  if (have < need) parts.push(`此分支 ${need} 點（目前 ${have}）`);
  return parts.length ? `需要：${parts.join('／')}` : '';
}

export function learnState(s: GameState, m: MemberId, id: string): LearnBlock {
  const n = TREE_BY_ID[id];
  if (!n || n.hero !== m || !s.members[m]) return 'wrong';
  if (rankOf(s, m, id) >= n.maxRank) return 'maxed';
  if (missingText(s, m, n)) return 'locked';
  if (pointsLeft(s, m) < n.cost) return 'points';
  return 'ok';
}

/** 學一級 */
export function learn(s: GameState, m: MemberId, id: string): boolean {
  if (learnState(s, m, id) !== 'ok') return false;
  s.tree = { ...(s.tree ?? {}) };
  s.tree[m] = [...learned(s, m), id];
  return true;
}

/** 重置花費：營火免費，其他地方每點 15 金 */
export const RESET_GOLD_PER_POINT = 15;
export function resetCost(s: GameState, m: MemberId, atCamp: boolean): number {
  return atCamp ? 0 : pointsSpent(s, m) * RESET_GOLD_PER_POINT;
}

/** 全部重置。atCamp=false 時要付金幣，錢不夠回傳 false */
export function resetTree(s: GameState, m: MemberId, atCamp = true): boolean {
  if (!s.tree) return true;
  const cost = resetCost(s, m, atCamp);
  if (s.gold < cost) return false;
  s.gold -= cost;
  s.tree = { ...s.tree, [m]: [] };
  return true;
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

/** 技能樹解鎖的主動技能 */
export function treeSkills(s: GameState, m: MemberId): string[] {
  return [...new Set(learned(s, m).map((id) => TREE_BY_ID[id]?.skill).filter((x): x is string => !!x))];
}

export function treeFor(m: MemberId): TreeNode[] {
  return TREE.filter((n) => n.hero === m);
}

/** 節點說明（目前等級 → 下一級） */
export function nodeDesc(n: TreeNode, rank: number): string {
  if (n.skill) return '主動技能';
  if (n.maxRank === 1) return effectText(n.effect);
  return effectText(n.effect, Math.max(1, rank));
}
