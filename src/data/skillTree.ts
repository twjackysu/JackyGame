// 技能樹 v2（11-open-world §2.5 v2、D-049）：每位角色兩條分支，每條 6 個節點畫成一棵小樹。
//
//   第 1 層        A（1–3 級）
//   第 2 層   B（需 A1）   C（需 A2）
//   第 3 層        D（需 A2＋此分支 4 點）
//   第 4 層        E（需 D2＋此分支 7 點）
//   第 5 層        U（需 E＋此分支 10 點，2 點）← 分支 0：新的主動技能；分支 1：強力被動
//
// 技能點 = 等級 − 1 ＋ Boss 首殺（BOSS_POINT_KILLS）。學了的節點存在 GameState.tree[m]，
// 同一個 id 出現 n 次 = n 級（存檔格式與 v1 相容；v1 的舊 id 找不到 → 自動退點）。
import type { MemberId } from '../core/state/gameState';

export interface TreeEffect {
  hpPct?: number;
  atkPct?: number;
  defPct?: number;
  spd?: number;
  /** 開場 SP +N（每人） */
  startSp?: number;
  /** 開場星燼 +N（全隊共用，加總） */
  startEmber?: number;
}

export interface TreeRequire {
  /** 前置節點與最低等級 */
  nodes?: readonly (readonly [id: string, rank: number])[];
  /** 此分支已投入點數 */
  branchPoints?: number;
}

export interface TreeNode {
  id: string;
  hero: MemberId;
  branch: 0 | 1;
  /** 0–4（由上往下） */
  row: number;
  /** -1 左、0 中、1 右 */
  col: -1 | 0 | 1;
  name: string;
  /** 每級的效果（會乘上等級） */
  effect: TreeEffect;
  maxRank: number;
  /** 每級花費 */
  cost: number;
  requires: TreeRequire;
  /** 學會後解鎖的主動技能（engine SKILLS id） */
  skill?: string;
}

/** Boss 首殺 +1 技能點（旗標 kill_<id> 由戰鬥掉落時設定） */
export const BOSS_POINT_KILLS = ['boss_wolfking', 'boss_bellworm', 'boss_rourke_3', 'boss_valderan', 'boss_starfall'] as const;

type Spec = [name: string, effect: TreeEffect, maxRank?: number];
type BranchSpec = [title: string, a: Spec, b: Spec, c: Spec, d: Spec, e: Spec, u: Spec | { skill: string; name: string }];

const BRANCHES: Record<MemberId, [BranchSpec, BranchSpec]> = {
  lian: [
    ['燈火', ['剪燈芯', { atkPct: 3 }, 3], ['星燼親和', { startEmber: 1 }, 1], ['熾燈', { atkPct: 4 }, 2], ['長明之焰', { atkPct: 3 }, 3], ['燈火相傳', { startSp: 1, atkPct: 5 }], { skill: 'thousand_lamps', name: '千燈共鳴' }],
    ['守夜', ['堅韌', { hpPct: 4 }, 3], ['夜行者', { spd: 1 }, 2], ['守燈人', { defPct: 5 }, 2], ['不熄的燈', { hpPct: 3, defPct: 3 }, 3], ['守夜人之心', { startSp: 1, hpPct: 8 }], ['長夜守望', { defPct: 12, hpPct: 12, startEmber: 1 }]],
  ],
  serin: [
    ['破陣', ['劍勢', { atkPct: 3 }, 3], ['疾步', { spd: 1 }, 2], ['破陣之心', { atkPct: 4 }, 2], ['鋒芒', { atkPct: 3 }, 3], ['騎士的覺悟', { startSp: 1, atkPct: 5 }], { skill: 'dawn_flash', name: '破曉一閃' }],
    ['守誓', ['盾架', { defPct: 4 }, 3], ['鍛鍊', { hpPct: 5 }, 2], ['誓言', { defPct: 5 }, 2], ['不屈', { hpPct: 3, defPct: 3 }, 3], ['守護者', { startSp: 1, defPct: 6 }], ['不倒的旗', { hpPct: 15, defPct: 10, startEmber: 1 }]],
  ],
  rourke: [
    ['牌桌', ['手氣', { atkPct: 3 }, 3], ['讀牌', { spd: 1 }, 2], ['底牌', { startEmber: 1 }, 1], ['加注', { atkPct: 4 }, 3], ['莊家', { startSp: 1, atkPct: 5 }], { skill: 'all_in', name: '梭哈' }],
    ['老兵', ['厚皮', { hpPct: 4 }, 3], ['鐵壁', { defPct: 5 }, 2], ['戰場直覺', { startSp: 1 }, 1], ['硬骨頭', { hpPct: 3, defPct: 3 }, 3], ['老兵不死', { defPct: 8, hpPct: 8 }], ['傭兵之魂', { hpPct: 15, defPct: 10, startEmber: 1 }]],
  ],
  io: [
    ['歌聲', ['輕聲', { hpPct: 4 }, 3], ['迴響', { startSp: 1 }, 1], ['和聲', { spd: 1 }, 2], ['共鳴之喉', { hpPct: 3, defPct: 3 }, 3], ['星之歌', { startEmber: 1, spd: 1 }], { skill: 'star_lullaby', name: '星之搖籃曲' }],
    ['星語', ['漣漪', { atkPct: 3 }, 3], ['潮汐', { atkPct: 4 }, 2], ['霧之守護', { defPct: 5 }, 2], ['深海', { atkPct: 3 }, 3], ['星辰低語', { startSp: 1, atkPct: 5 }], ['海與星', { atkPct: 12, spd: 1, startEmber: 1 }]],
  ],
  liora: [
    ['爆破', ['火藥配方', { atkPct: 3 }, 3], ['引信', { spd: 1 }, 2], ['大火力', { atkPct: 4 }, 2], ['高爆', { atkPct: 3 }, 3], ['點火天才', { startSp: 1, atkPct: 5 }], { skill: 'chain_blast', name: '連鎖大爆破' }],
    ['發明', ['護目鏡', { defPct: 4 }, 3], ['工具腰帶', { startSp: 1 }, 1], ['備用零件', { hpPct: 5 }, 2], ['改良', { hpPct: 3, defPct: 3 }, 3], ['靈光一閃', { startEmber: 1, startSp: 1 }], ['天才發明家', { atkPct: 10, defPct: 8, hpPct: 8, startEmber: 1 }]],
  ],
};

export function effectText(e: TreeEffect, rank = 1): string {
  const p: string[] = [];
  if (e.atkPct) p.push(`攻擊 +${e.atkPct * rank}%`);
  if (e.defPct) p.push(`防禦 +${e.defPct * rank}%`);
  if (e.hpPct) p.push(`HP +${e.hpPct * rank}%`);
  if (e.spd) p.push(`速度 +${e.spd * rank}`);
  if (e.startSp) p.push(`開場 SP +${e.startSp * rank}`);
  if (e.startEmber) p.push(`開場星燼 +${e.startEmber * rank}`);
  return p.join('、');
}

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'u'] as const;
const LAYOUT: { row: number; col: -1 | 0 | 1 }[] = [
  { row: 0, col: 0 }, { row: 1, col: -1 }, { row: 1, col: 1 }, { row: 2, col: 0 }, { row: 3, col: 0 }, { row: 4, col: 0 },
];

export const TREE: TreeNode[] = (Object.keys(BRANCHES) as MemberId[]).flatMap((hero) =>
  BRANCHES[hero].flatMap(([, ...specs], branch) => {
    const id = (k: number) => `${hero}_${branch}${LETTERS[k]}`;
    const reqs: TreeRequire[] = [
      {},
      { nodes: [[id(0), 1]] },
      { nodes: [[id(0), 2]] },
      { nodes: [[id(0), 2]], branchPoints: 4 },
      { nodes: [[id(3), 2]], branchPoints: 7 },
      { nodes: [[id(4), 1]], branchPoints: 10 },
    ];
    return specs.map((sp, k): TreeNode => {
      const base = { id: id(k), hero, branch: branch as 0 | 1, ...LAYOUT[k]!, requires: reqs[k]! };
      if (!Array.isArray(sp)) return { ...base, name: sp.name, effect: {}, maxRank: 1, cost: 2, skill: sp.skill };
      const [name, effect, maxRank = 1] = sp;
      return { ...base, name, effect, maxRank, cost: k === 5 ? 2 : 1 };
    });
  }),
);

export const TREE_BY_ID: Record<string, TreeNode> = Object.fromEntries(TREE.map((n) => [n.id, n]));

export function branchName(hero: MemberId, branch: 0 | 1): string {
  return BRANCHES[hero][branch][0];
}
