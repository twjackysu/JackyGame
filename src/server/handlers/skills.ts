// 技能點（第 141 輪 V2）：加點、選打法、重置。點數由伺服器依等級算（core/meta/skills.ts），客戶端只說「點哪個」。
import { addRank, cleanRanks, cleanVariants, setVariant } from '../../core/meta/skills';
import { ApiError } from '../../net/protocol';
import type { HandlerTable } from '../router';
import { ownCharacter } from './common';
import { freshView, idParam } from './inv';

export const skillsHandlers: Pick<HandlerTable, 'skills.add' | 'skills.variant' | 'skills.reset'> = {
  'skills.add': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const r = cleanRanks(c.skills, c.level);
    const n = addRank(r, idParam(p?.skill, 'skill'), c.level);
    if (!n) throw new ApiError('rejected', 'cannot add');
    await ctx.r.characters.save({ ...c, skills: n, variants: cleanVariants(c.variants, n) });
    return freshView(ctx, c.id);
  },

  'skills.variant': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    const idx = p?.idx;
    if (idx !== 0 && idx !== 1 && idx !== 2) throw new ApiError('bad_request', 'idx');
    const r = cleanRanks(c.skills, c.level);
    const v = setVariant(cleanVariants(c.variants, r), idParam(p?.skill, 'skill'), idx, r, c.weapon);
    if (!v) throw new ApiError('rejected', 'cannot pick');
    await ctx.r.characters.save({ ...c, skills: r, variants: v });
    return freshView(ctx, c.id);
  },

  'skills.reset': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.characterId);
    await ctx.r.characters.save({ ...c, skills: {}, variants: [] });
    return freshView(ctx, c.id);
  },
};
