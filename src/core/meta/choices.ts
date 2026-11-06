// 討伐後的抉擇（D-157）的規則部分（第 142 輪 V2，D-290）：誰能選、選了拿幾顆結晶。文字與演出留在 src/game/choices.ts。
// 伺服器 handler `story.choose` 與畫面用同一份；地圖清單和 core/meta/shop.ts 的 CHOICE_MAPS 一樣。
import { CHOICE_MAPS } from './shop';

export type ChoicePick = 'take' | 'spare';

/** 「取」馬上拿到幾顆結晶 */
export const CHOICE_CRYSTAL: Readonly<Record<(typeof CHOICE_MAPS)[number], number>> = { mistwood: 3, thornvale: 4, emberrift: 5, starfall: 6 };

export const isChoiceMap = (m: string): m is (typeof CHOICE_MAPS)[number] => (CHOICE_MAPS as readonly string[]).includes(m);

/** 讀已做的抉擇（壞資料、未知地圖、未知選項丟掉） */
export function cleanChoices(raw: unknown): Record<string, ChoicePick> {
  const out: Record<string, ChoicePick> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const m of CHOICE_MAPS) {
    const v = (raw as Record<string, unknown>)[m];
    if (v === 'take' || v === 'spare') out[m] = v;
  }
  return out;
}

/** 記下抉擇（已經選過的不會被改：抉擇只有一次） */
export function makeChoice(cur: Record<string, ChoicePick>, map: string, pick: ChoicePick): Record<string, ChoicePick> | null {
  if (!isChoiceMap(map) || cur[map]) return null;
  return { ...cur, [map]: pick };
}
