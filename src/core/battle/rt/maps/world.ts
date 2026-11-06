// 四張大地圖的關卡定義產生器（第 146 輪，D-307）：畫面層（worldMaps.ts）進場時才產生、登記到 STAGES；
// 伺服器（loot.claim 檢查「這張圖有沒有這隻怪」）沒有畫面層，用 stageDef 一樣懶產生、登記（同一份 STAGES，產生一次）。
import { STAGES } from '../data';
import type { StageDefinition } from '../types';
import { makeEmberriftStage } from './emberrift';
import { makeMistwoodStage } from './mistwood';
import { makeStarfallStage } from './starfall';
import { makeThornvaleStage } from './thornvale';

export const WORLD_STAGE_MAKERS: Readonly<Record<string, () => StageDefinition>> = {
  mistwood: makeMistwoodStage,
  thornvale: makeThornvaleStage,
  emberrift: makeEmberriftStage,
  starfall: makeStarfallStage,
};

/** 關卡定義：已登記的直接用；大地圖第一次用到才產生 */
export function stageDef(id: string): StageDefinition | undefined {
  if (Object.prototype.hasOwnProperty.call(STAGES, id)) return STAGES[id];
  const mk = Object.prototype.hasOwnProperty.call(WORLD_STAGE_MAKERS, id) ? WORLD_STAGE_MAKERS[id] : undefined;
  return mk ? (STAGES[id] = mk()) : undefined;
}

/** 大地圖的順序（D-114／D-124）：第一張一開始就開；之後每張要先打倒前一張圖的 Boss 一次。和畫面層 worldMaps 的 next 一樣（測試對照） */
export const WORLD_ORDER: readonly string[] = ['mistwood', 'thornvale', 'emberrift', 'starfall'];

type MapProg = Readonly<Record<string, { bossKills?: number; furyKills?: number } | undefined>>;

/** 這張圖開了沒（不是大地圖的關卡一律算開；伺服器 battle.start 檢查用） */
export function worldStageOpen(id: string, maps: MapProg): boolean {
  const i = WORLD_ORDER.indexOf(id);
  if (i <= 0) return true;
  return (maps[WORLD_ORDER[i - 1]!]?.bossKills ?? 0) >= 1;
}

/** 深夜開了沒（D-103／畫面層 nightUnlocked）：這張圖打倒過暴怒版 Boss */
export function worldNightOpen(id: string, maps: MapProg): boolean {
  return (maps[id]?.furyKills ?? 0) >= 1;
}

/** Boss 暴怒解鎖（D-099／D-247）：先打倒那隻 Boss 一次，而且等級 ≥ 8 或討伐 3 次。畫面層 rtRecord 的 furyUnlocked 也用這份 */
export const FURY_UNLOCK = { level: 8, kills: 3 } as const;
export function furyOpenBy(bossKills: number, level: number): boolean {
  return bossKills >= 1 && (level >= FURY_UNLOCK.level || bossKills >= FURY_UNLOCK.kills);
}
