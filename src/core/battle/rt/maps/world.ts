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
