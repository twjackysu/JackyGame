// 資料表列 → 回給客戶端的 View
import type { AccountView, CharacterView } from '../net/views';
import type { AccountRow, CharacterRow, Repos } from './repos/types';

export const accountView = (a: AccountRow): AccountView => ({ id: a.id, displayName: a.displayName, createdAt: a.createdAt, migrated: a.migratedAt !== undefined, ...(a.activeCharacterId ? { activeCharacterId: a.activeCharacterId } : {}) });

export async function characterView(r: Repos, c: CharacterRow): Promise<CharacterView> {
  const items = await r.items.listByOwner(c.id);
  return {
    id: c.id,
    slot: c.slot,
    name: c.name,
    weapon: c.weapon,
    level: c.level,
    xp: c.xp,
    wallet: await r.wallets.balances(c.id),
    stats: c.stats,
    skills: c.skills,
    variants: c.variants,
    bounty: c.bounty,
    shop: c.shop,
    maps: c.maps,
    items: items.map((i) => ({ id: i.id, location: i.location, pos: i.pos, bound: i.bound, gear: i.gear })),
  };
}
