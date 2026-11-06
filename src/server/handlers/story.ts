// 討伐後的抉擇（第 142 輪 V2，D-290）：要真的打倒過那張地圖的 Boss、每張地圖只能選一次；「取」的結晶由伺服器發。
// 抉擇存在角色的劇情旗標 jg_choices（和舊存檔同一個欄位，行商折扣 discountOf 也讀它）。
import { CHOICE_CRYSTAL, cleanChoices, isChoiceMap, makeChoice } from '../../core/meta/choices';
import { ENCOUNTER_REWARDS, claimThanks, cleanEncounters, meet, type EncounterReward } from '../../core/meta/encounters';
import { worldStageOpen } from '../../core/battle/rt/maps/world';
import type { CharacterRow } from '../repos/types';
import type { Ctx } from '../router';
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

function encountersOf(raw: string | undefined): ReturnType<typeof cleanEncounters> {
  try {
    return cleanEncounters(JSON.parse(raw ?? '{}'));
  } catch {
    return {};
  }
}

function encounterParam(v: unknown): string {
  if (typeof v !== 'string' || !Object.hasOwn(ENCOUNTER_REWARDS, v)) throw new ApiError('bad_request', 'encounterId');
  return v;
}

async function payEncounter(ctx: Ctx, c: CharacterRow, r: EncounterReward, reason: string, ref: string): Promise<{ coin: number; crystal: number }> {
  const coin = r.coin ?? 0;
  const crystal = r.crystal ?? 0;
  if (coin) await ctx.r.wallets.apply(c.id, 'coin', coin, reason, ref);
  if (crystal) await ctx.r.wallets.apply(c.id, 'crystal', crystal, reason, ref);
  return { coin, crystal };
}

export const storyHandlers: Pick<HandlerTable, 'story.choose' | 'story.meet' | 'story.thanks'> = {
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

  // 路上的相遇（第 147 輪）：每個相遇只能選一次；「取」的獎勵由伺服器發；那張地圖要已經開放
  'story.meet': async (ctx, p) => {
    const id = encounterParam(p?.encounterId);
    const pick = p?.pick;
    if (pick !== 'take' && pick !== 'spare') throw new ApiError('bad_request', 'pick');
    const c = await ownCharacter(ctx, p?.characterId);
    const def = ENCOUNTER_REWARDS[id]!;
    if (!worldStageOpen(def.map, c.maps)) throw new ApiError('rejected', 'locked');
    const next = meet(encountersOf(c.story.jg_encounters), id, pick);
    if (!next) throw new ApiError('rejected', 'already met');
    await ctx.r.characters.save({ ...c, story: { ...c.story, jg_encounters: JSON.stringify(next) } });
    const got = pick === 'take' ? await payEncounter(ctx, c, def.take, 'story.meet', id) : { coin: 0, crystal: 0 };
    return { ...got, character: await freshView(ctx, c.id) };
  },

  // 回禮：選過「助」、還沒拿過的才給（「下次回來」只有畫面知道，伺服器只保證一次）
  'story.thanks': async (ctx, p) => {
    const id = encounterParam(p?.encounterId);
    const c = await ownCharacter(ctx, p?.characterId);
    const next = claimThanks(encountersOf(c.story.jg_encounters), id);
    if (!next) throw new ApiError('rejected', 'no thanks');
    await ctx.r.characters.save({ ...c, story: { ...c.story, jg_encounters: JSON.stringify(next) } });
    const got = await payEncounter(ctx, c, ENCOUNTER_REWARDS[id]!.thanks, 'story.thanks', id);
    return { ...got, character: await freshView(ctx, c.id) };
  },
};
