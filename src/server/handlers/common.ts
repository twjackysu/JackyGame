import { ApiError } from '../../net/protocol';
import type { AccountRow } from '../repos/types';
import type { Ctx } from '../router';

/** 拿帳號；第一次呼叫就建立（本機版沒有註冊流程） */
export async function ensureAccount(ctx: Ctx): Promise<AccountRow> {
  const a = await ctx.r.accounts.get(ctx.accountId);
  if (a) return a;
  const row: AccountRow = { id: ctx.accountId, displayName: '旅人', createdAt: ctx.clock.now() };
  await ctx.r.accounts.put(row);
  return row;
}

/** 拿自己的角色；別人的或不存在都回 not_found（不洩漏存在與否） */
export async function ownCharacter(ctx: Ctx, id: unknown) {
  if (typeof id !== 'string') throw new ApiError('bad_request', 'id');
  const c = await ctx.r.characters.get(id);
  if (!c || c.accountId !== ctx.accountId) throw new ApiError('not_found', 'character');
  return c;
}
