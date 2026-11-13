/**
 * 燼紅裂谷岩壁上的熔岩裂紋要畫成哪一種（第 191 輪）。純函式：ground.ts 照著畫，測試守比例。
 * 以前四成的岩石各有一道橫貫整顆、亮黃色的直線：岩壁鋪滿畫面時變成一片橘色亂線，
 * 比主角、怪、火系技能、掉落都搶眼。現在大部分是短而暗的餘燼縫，只有少數幾顆是亮的。
 */
export type EmberCrack = 'none' | 'dim' | 'hot';

/** 有裂紋的岩石比例（以前 0.4） */
export const EMBER_CRACK_CHANCE = 0.24;
/** 其中亮的那種佔全部岩石的比例 */
export const EMBER_HOT_CHANCE = 0.045;
/** 裂紋半長相對岩石半徑（以前 0.7＝橫貫整顆） */
export const EMBER_CRACK_HALF = { dim: 0.4, hot: 0.55 } as const;

/** h＝這一格的 0～1 雜湊 */
export function emberCrack(h: number): EmberCrack {
  if (h < EMBER_HOT_CHANCE) return 'hot';
  return h < EMBER_CRACK_CHANCE ? 'dim' : 'none';
}
