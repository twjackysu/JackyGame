import type { HandlerTable } from '../router';
import { characterView } from '../views';
import { ownCharacter } from './common';

export const characterHandlers: Pick<HandlerTable, 'character.list' | 'character.get'> = {
  'character.list': async (ctx) => Promise.all((await ctx.r.characters.listByAccount(ctx.accountId)).map((c) => characterView(ctx.r, c))),
  'character.get': async (ctx, p) => characterView(ctx.r, await ownCharacter(ctx, p?.id)),
};
