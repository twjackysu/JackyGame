// 隨機詞綴池（design/14 階段 1.3；生成在 src/server/loot.ts，階段 2.3）。
// 規則：
// - `group` 是互斥群組：同一件裝備不會出現兩條同群組的詞綴（例：ATK 固定值與 ATK% 不會同時出現）。
// - `slots` 限定可出現的部位；`minTier` 以上的稀有度才會抽到。
// - `range[tier]` 是該稀有度的數值範圍（含兩端，整數）；數值範圍會公開給玩家看。
// - 效果類（`kind: 'effect'`）要等階段 2.1 的效果觸發框架才會生效；在那之前只是資料。
import type { GearSlot, Tier } from './rules';

export type AffixKind = 'stat' | 'effect';

export interface AffixDef {
  id: string;
  /** 顯示格式，{v} 會換成數值 */
  text: string;
  kind: AffixKind;
  group: string;
  slots: readonly GearSlot[];
  minTier: Tier;
  /** 抽中權重（同一池內相對值） */
  weight: number;
  range: Partial<Record<Tier, readonly [number, number]>>;
}

const ALL: readonly GearSlot[] = ['weapon', 'armor', 'head', 'charm', 'core'];
const OFF: readonly GearSlot[] = ['weapon', 'charm', 'core'];
const DEF: readonly GearSlot[] = ['armor', 'head', 'charm'];

/** 數值隨稀有度成長：magic 為基準，rare ×1.4、epic ×1.8、legend ×2.2、divine ×2.2 */
function scale(lo: number, hi: number, from: Tier = 'magic'): Partial<Record<Tier, readonly [number, number]>> {
  const k: Record<Tier, number> = { common: 0, magic: 1, rare: 1.4, epic: 1.8, legend: 2.2, divine: 2.2 };
  const order: Tier[] = ['magic', 'rare', 'epic', 'legend', 'divine'];
  const out: Partial<Record<Tier, readonly [number, number]>> = {};
  for (const t of order.slice(order.indexOf(from))) out[t] = [Math.max(1, Math.round(lo * k[t])), Math.max(1, Math.round(hi * k[t]))];
  return out;
}

export const AFFIXES: readonly AffixDef[] = [
  // ---- 基礎數值 ----
  { id: 'atk_flat', text: 'ATK +{v}', kind: 'stat', group: 'atk', slots: OFF, minTier: 'magic', weight: 10, range: scale(3, 6) },
  { id: 'atk_pct', text: 'ATK +{v}%', kind: 'stat', group: 'atk', slots: OFF, minTier: 'rare', weight: 6, range: scale(4, 7, 'rare') },
  { id: 'hp_flat', text: 'HP +{v}', kind: 'stat', group: 'hp', slots: ALL, minTier: 'magic', weight: 10, range: scale(15, 30) },
  { id: 'hp_pct', text: 'HP +{v}%', kind: 'stat', group: 'hp', slots: DEF, minTier: 'rare', weight: 6, range: scale(4, 8, 'rare') },
  { id: 'def_flat', text: 'DEF +{v}', kind: 'stat', group: 'def', slots: DEF, minTier: 'magic', weight: 10, range: scale(2, 5) },
  { id: 'def_pct', text: 'DEF +{v}%', kind: 'stat', group: 'def', slots: ['armor', 'head'], minTier: 'rare', weight: 6, range: scale(5, 9, 'rare') },
  { id: 'spd_flat', text: 'SPD +{v}', kind: 'stat', group: 'spd', slots: ALL, minTier: 'magic', weight: 7, range: scale(1, 2) },
  // ---- 資源 ----
  { id: 'start_sp', text: '開場 SP +{v}', kind: 'stat', group: 'sp', slots: ['head', 'charm', 'core'], minTier: 'rare', weight: 4, range: { rare: [1, 1], epic: [1, 1], legend: [1, 2], divine: [1, 2] } },
  { id: 'start_ember', text: '開場星燼 +{v}', kind: 'stat', group: 'ember', slots: ['charm', 'core'], minTier: 'epic', weight: 3, range: { epic: [1, 1], legend: [1, 1], divine: [1, 2] } },
  // ---- 戰鬥效果（階段 2.1 才生效） ----
  { id: 'perfect_dmg', text: '完美時機傷害 +{v}%', kind: 'effect', group: 'perfect', slots: ['weapon', 'charm'], minTier: 'magic', weight: 6, range: scale(5, 9) },
  { id: 'window_pct', text: '判定窗口 +{v}%', kind: 'effect', group: 'window', slots: ['head', 'charm'], minTier: 'rare', weight: 4, range: scale(3, 5, 'rare') },
  { id: 'mark_dmg', text: '燈印引爆傷害 +{v}%', kind: 'effect', group: 'mark', slots: ['weapon', 'core'], minTier: 'magic', weight: 6, range: scale(6, 10) },
  { id: 'resonance_dmg', text: '共鳴傷害 +{v}%', kind: 'effect', group: 'resonance', slots: ['weapon', 'core', 'charm'], minTier: 'rare', weight: 5, range: scale(6, 10, 'rare') },
  { id: 'break_dmg', text: '破防值累積 +{v}%', kind: 'effect', group: 'break', slots: ['weapon', 'charm'], minTier: 'magic', weight: 6, range: scale(6, 12) },
  { id: 'weak_dmg', text: '弱點傷害 +{v}%', kind: 'effect', group: 'weak', slots: OFF, minTier: 'rare', weight: 5, range: scale(5, 9, 'rare') },
  { id: 'boss_dmg', text: '對 Boss 傷害 +{v}%', kind: 'effect', group: 'boss', slots: ['weapon', 'core'], minTier: 'epic', weight: 3, range: scale(4, 6, 'epic') },
  { id: 'dmg_taken', text: '受到傷害 -{v}%', kind: 'effect', group: 'guard', slots: ['armor', 'head'], minTier: 'rare', weight: 5, range: scale(3, 5, 'rare') },
  { id: 'block_heal', text: '完美防守時回復 {v}% HP', kind: 'effect', group: 'block', slots: ['armor', 'charm'], minTier: 'rare', weight: 4, range: scale(2, 4, 'rare') },
  { id: 'heal_up', text: '受到治療 +{v}%', kind: 'effect', group: 'heal', slots: DEF, minTier: 'magic', weight: 5, range: scale(6, 10) },
  // ---- 探索／刷寶 ----
  { id: 'gold_find', text: '金幣獲得 +{v}%', kind: 'effect', group: 'gold', slots: ['head', 'charm'], minTier: 'magic', weight: 5, range: scale(5, 10) },
  { id: 'xp_gain', text: '經驗獲得 +{v}%', kind: 'effect', group: 'xp', slots: ['head', 'charm'], minTier: 'magic', weight: 5, range: scale(4, 8) },
];

export const AFFIX_BY_ID: Record<string, AffixDef> = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));
