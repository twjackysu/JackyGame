// 技能樹（E4 v1，11-open-world §2.5；D-044）：每位角色兩條分支 × 4 階的被動節點。
// 技能點 = 等級 − 1（每升一級 +1），學了的節點存在 GameState.tree；隨時可以免費重置。
// 效果先只做「數值％、速度、開場 SP、開場星燼」，引擎與平衡都好控制；主動技能仍由劇情解鎖。
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

export interface TreeNode {
  id: string;
  hero: MemberId;
  branch: 0 | 1;
  tier: 1 | 2 | 3 | 4;
  name: string;
  desc: string;
  cost: number;
  effect: TreeEffect;
}

type Spec = [name: string, effect: TreeEffect];
const BRANCHES: Record<MemberId, [string, string, Spec[], Spec[]]> = {
  lian: ['燈火', '守夜', [
    ['剪燈芯', { atkPct: 6 }], ['熾燈', { atkPct: 8 }], ['星燼親和', { startEmber: 1 }], ['長明之焰', { atkPct: 12 }],
  ], [
    ['夜行者', { spd: 1 }], ['堅韌', { hpPct: 10 }], ['不熄的燈', { startSp: 1 }], ['守燈人', { defPct: 15, hpPct: 8 }],
  ]],
  serin: ['破陣', '守誓', [
    ['劍勢', { atkPct: 6 }], ['疾步', { spd: 1 }], ['破陣之心', { atkPct: 10 }], ['騎士的鋒芒', { atkPct: 12, startSp: 1 }],
  ], [
    ['盾架', { defPct: 8 }], ['鍛鍊', { hpPct: 10 }], ['誓言', { defPct: 12 }], ['不倒的旗', { hpPct: 15, defPct: 8 }],
  ]],
  rourke: ['老兵', '牌桌', [
    ['厚皮', { hpPct: 10 }], ['鐵壁', { defPct: 10 }], ['戰場直覺', { startSp: 1 }], ['不死老兵', { hpPct: 15, defPct: 10 }],
  ], [
    ['手氣', { atkPct: 6 }], ['讀牌', { spd: 1 }], ['底牌', { startEmber: 1 }], ['梭哈', { atkPct: 14 }],
  ]],
  io: ['歌聲', '星語', [
    ['輕聲', { spd: 1 }], ['迴響', { startSp: 1 }], ['和聲', { hpPct: 12 }], ['星之歌', { startEmber: 1, spd: 1 }],
  ], [
    ['漣漪', { atkPct: 8 }], ['潮汐', { atkPct: 8 }], ['霧之守護', { defPct: 12 }], ['深海', { atkPct: 14 }],
  ]],
  liora: ['爆破', '發明', [
    ['火藥配方', { atkPct: 8 }], ['引信', { spd: 1 }], ['大火力', { atkPct: 10 }], ['連鎖爆破', { atkPct: 14 }],
  ], [
    ['護目鏡', { defPct: 8 }], ['工具腰帶', { startSp: 1 }], ['備用零件', { hpPct: 12 }], ['靈光一閃', { startEmber: 1, startSp: 1 }],
  ]],
};

function effectText(e: TreeEffect): string {
  const p: string[] = [];
  if (e.atkPct) p.push(`攻擊 +${e.atkPct}%`);
  if (e.defPct) p.push(`防禦 +${e.defPct}%`);
  if (e.hpPct) p.push(`HP +${e.hpPct}%`);
  if (e.spd) p.push(`速度 +${e.spd}`);
  if (e.startSp) p.push(`開場 SP +${e.startSp}`);
  if (e.startEmber) p.push(`開場星燼 +${e.startEmber}`);
  return p.join('、');
}

export const TREE: TreeNode[] = (Object.keys(BRANCHES) as MemberId[]).flatMap((hero) => {
  const [, , a, b] = BRANCHES[hero];
  return [a, b].flatMap((specs, branch) => specs.map(([name, effect], i): TreeNode => ({
    id: `${hero}_${branch}_${i + 1}`, hero, branch: branch as 0 | 1, tier: (i + 1) as 1 | 2 | 3 | 4, name,
    desc: effectText(effect), cost: i === 3 ? 2 : 1, effect,
  })));
});

export const TREE_BY_ID: Record<string, TreeNode> = Object.fromEntries(TREE.map((n) => [n.id, n]));

export function branchName(hero: MemberId, branch: 0 | 1): string {
  return BRANCHES[hero][branch];
}
