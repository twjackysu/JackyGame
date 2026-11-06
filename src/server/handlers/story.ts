// 討伐後的抉擇（第 142 輪 V2，D-290）：要真的打倒過那張地圖的 Boss、每張地圖只能選一次；「取」的結晶由伺服器發。
// 抉擇存在角色的劇情旗標 jg_choices（和舊存檔同一個欄位，行商折扣 discountOf 也讀它）。
import { CHOICE_CRYSTAL, cleanChoices, isChoiceMap, makeChoice } from '../../core/meta/choices';
import { ApiError } from '../../net/protocol';
import type { HandlerTable } from '../router';
import { ownCharacter } from './common';
import { freshView } from './inv';

function choicesOf(raw: string | undefined): ReturnType<typeof cleanChoices> {
  try {
    return cleanChoices(JSON.parse(raw ?? '{}'));
  } catch {
    return {};
  }
}

export const storyHandlers: Pick<HandlerTable, 'story.choose'> = {
  'story.choose': async (ctx, p) => {
    const map = p?.map;
    const pick = p?.pick;
    if (typeof map !== 'string' || !isChoiceMap(map)) throw new ApiError('bad_request', 'map');
    if (pick !== 'take' && pick !== 'spare') throw new ApiError('bad_request', 'pick');
    const c = await ownCharacter(ctx, p?.characterId);
    if (!((c.maps[map]?.bossKills ?? 0) >= 1)) throw new ApiError('rejected', 'boss not defeated');
    const next = makeChoice(choicesOf(c.story.jg_choices), map, pick);
    if (!next) throw new ApiError('rejected', 'already chosen');
    await ctx.r.characters.save({ ...c, story: { ...c.story, jg_choices: JSON.stringify(next) } });
    const crystal = pick === 'take' ? CHOICE_CRYSTAL[map] : 0;
    if (crystal) await ctx.r.wallets.apply(c.id, 'crystal', crystal, 'story.choose', map);
    return { crystal, character: await freshView(ctx, c.id) };
  },
};
