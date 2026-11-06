// 角色（F1 多角色，D-302）：list／get／create／delete／select。角色欄 3 個、名字伺服器檢查、刪除有限制。
import { cleanName, deleteBlocker, freeSlot, isWeapon, CHARACTER_SLOTS } from '../../core/meta/roster';
import { ApiError } from '../../net/protocol';
import type { HandlerTable } from '../router';
import { accountView, characterView } from '../views';
import { createCharacter, deleteCharacter } from './build';
import { activeCharacter, ensureAccount, ownCharacter } from './common';

export const characterHandlers: Pick<HandlerTable, 'character.list' | 'character.get' | 'character.create' | 'character.delete' | 'character.select'> = {
  'character.list': async (ctx) => Promise.all((await ctx.r.characters.listByAccount(ctx.accountId)).map((c) => characterView(ctx.r, c))),
  'character.get': async (ctx, p) => characterView(ctx.r, await ownCharacter(ctx, p?.id)),

  'character.create': async (ctx, p) => {
    const name = cleanName(p?.name);
    if (!name) throw new ApiError('bad_request', 'name');
    if (!isWeapon(p?.weapon)) throw new ApiError('bad_request', 'weapon');
    const acc = await ensureAccount(ctx);
    const list = await ctx.r.characters.listByAccount(ctx.accountId);
    const slot = freeSlot(list.map((c) => c.slot));
    if (slot < 0 || list.length >= CHARACTER_SLOTS) throw new ApiError('rejected', 'no free slot');
    const c = await createCharacter(ctx, { slot, name, weapon: p.weapon, level: 1, xp: 0, stats: {}, skills: null, variants: null, bounty: null, shop: null, maps: {}, story: {}, items: [], wallet: { coin: 0, dust: 0, crystal: 0 } }, 'create');
    // 第一個角色自動成為目前角色
    if (!list.length) await ctx.r.accounts.put({ ...acc, activeCharacterId: c.id });
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'character.create', detail: JSON.stringify({ id: c.id, slot, weapon: c.weapon }), at: ctx.clock.now() });
    return characterView(ctx.r, c);
  },

  'character.delete': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.id);
    const acc = await ensureAccount(ctx);
    const list = await ctx.r.characters.listByAccount(ctx.accountId);
    const active = await activeCharacter(ctx, acc, list);
    const items = await ctx.r.items.listByOwner(c.id);
    const why = deleteBlocker({ isActive: active?.id === c.id, count: list.length, escrowItems: items.filter((i) => i.location.startsWith('market:') || i.location.startsWith('trade:')).length });
    if (why) throw new ApiError('rejected', why);
    await deleteCharacter(ctx, c.id);
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'character.delete', detail: JSON.stringify({ id: c.id, level: c.level, items: items.length }), at: ctx.clock.now() });
    return accountView(acc);
  },

  'character.select': async (ctx, p) => {
    const c = await ownCharacter(ctx, p?.id);
    const acc = await ensureAccount(ctx);
    if (acc.activeCharacterId !== c.id) await ctx.r.accounts.put({ ...acc, activeCharacterId: c.id });
    return characterView(ctx.r, c);
  },
};
