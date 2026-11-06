// migrate.legacy：第一次啟動把舊的 localStorage 存檔轉成帳號 1／角色 1（只有本機版接受，線上版不能匯入離線存檔：26-security）
import { ApiError } from '../../net/protocol';
import type { HandlerTable } from '../router';
import { fromLegacy, isLegacyEmpty } from '../legacy';
import { createCharacter } from './build';
import { ensureAccount } from './common';

export const migrateHandlers: Pick<HandlerTable, 'migrate.legacy'> = {
  'migrate.legacy': async (ctx, p) => {
    if (!ctx.local) throw new ApiError('rejected', 'legacy import is local only');
    const snap = p?.snapshot;
    if (!snap || typeof snap !== 'object' || Object.values(snap).some((v) => typeof v !== 'string')) throw new ApiError('bad_request', 'snapshot');
    const acc = await ensureAccount(ctx);
    const existing = await ctx.r.characters.listByAccount(ctx.accountId);
    if (acc.migratedAt !== undefined || existing.length) {
      const c = existing[0];
      return { migrated: false, characterId: c?.id ?? '', items: c ? (await ctx.r.items.listByOwner(c.id)).length : 0, wallet: c ? await ctx.r.wallets.balances(c.id) : { coin: 0, dust: 0, crystal: 0 }, skipped: [] };
    }
    const L = fromLegacy(snap);
    const items = [
      ...Object.entries(L.equip).map(([slot, g]) => ({ location: `equip:${slot}`, pos: 0, bound: false, gear: g })),
      ...L.bag.map((g, i) => ({ location: 'bag', pos: i, bound: false, gear: g })),
    ];
    const c = await createCharacter(ctx, { slot: 0, name: '旅人', weapon: L.weapon, level: L.level, xp: L.xp, stats: L.stats, skills: L.skills, variants: L.variants, bounty: L.bounty, shop: L.shop, maps: L.maps, story: L.story, items, wallet: L.wallet }, 'migrate');
    await ctx.r.accounts.put({ ...acc, migratedAt: ctx.clock.now() });
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'migrate.legacy', detail: JSON.stringify({ empty: isLegacyEmpty(snap), keys: Object.keys(snap).length, items: items.length, skipped: L.skipped }), at: ctx.clock.now() });
    return { migrated: true, characterId: c.id, items: items.length, wallet: L.wallet, skipped: L.skipped };
  },
};
