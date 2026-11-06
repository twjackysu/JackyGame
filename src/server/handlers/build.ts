// 建立／刪除角色的共用流程（遷移、匯入都用）
import type { RtGear } from '../../core/battle/rt/gear';
import type { CurrencyId, MapProgressView, WeaponView } from '../../net/views';
import { CURRENCIES, type CharacterRow } from '../repos/types';
import type { Ctx } from '../router';

export interface CharacterSeed {
  slot: number;
  name: string;
  weapon: WeaponView;
  level: number;
  xp: number;
  stats: Record<string, number>;
  skills: unknown;
  variants: unknown;
  bounty: unknown;
  shop: unknown;
  maps: Record<string, MapProgressView>;
  story: Record<string, string>;
  items: { location: string; pos: number; bound: boolean; gear: RtGear | Record<string, unknown> }[];
  wallet: Record<CurrencyId, number>;
  /** 競技場段位分（匯入存檔時帶回來；沒有就是起始分） */
  pvpRating?: number;
}

export async function createCharacter(ctx: Ctx, seed: CharacterSeed, reason: string): Promise<CharacterRow> {
  const now = ctx.clock.now();
  const c = await ctx.r.characters.save({
    id: ctx.ids.next('chr'),
    accountId: ctx.accountId,
    slot: seed.slot,
    name: seed.name,
    weapon: seed.weapon,
    level: seed.level,
    xp: seed.xp,
    stats: seed.stats,
    skills: seed.skills,
    variants: seed.variants,
    bounty: seed.bounty,
    shop: seed.shop,
    maps: seed.maps,
    story: seed.story,
    ...(seed.pvpRating === undefined ? {} : { pvpRating: seed.pvpRating }),
    createdAt: now,
    version: 0,
  });
  for (const it of seed.items) await ctx.r.items.save({ id: ctx.ids.next('itm'), ownerId: c.id, location: it.location, pos: it.pos, bound: it.bound, gear: it.gear as Record<string, unknown>, createdAt: now, version: 0 });
  for (const cur of CURRENCIES) if (seed.wallet[cur] > 0) await ctx.r.wallets.apply(c.id, cur, seed.wallet[cur], reason);
  return c;
}

export async function deleteCharacter(ctx: Ctx, id: string): Promise<void> {
  for (const it of await ctx.r.items.listByOwner(id)) await ctx.r.items.delete(it.id);
  await ctx.r.wallets.deleteCharacter(id);
  await ctx.r.characters.delete(id);
}
