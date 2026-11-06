// migrate.legacy：第一次啟動把舊的 localStorage 存檔轉成帳號 1／角色 1（只有本機版接受，線上版不能匯入離線存檔：26-security）
import { ApiError } from '../../net/protocol';
import type { HandlerTable } from '../router';
import { fromLegacy, isLegacyEmpty } from '../legacy';
import { createCharacter } from './build';
import { ensureAccount } from './common';
import { CURRENCIES } from '../repos/types';
import { characterView } from '../views';
import type { RtGear } from '../../core/battle/rt/gear';

export const migrateHandlers: Pick<HandlerTable, 'migrate.legacy' | 'migrate.sync'> = {
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

  // 過渡期（D-285）：舊 key 還是真實來源（戰鬥中撿到的東西 V5 才走 loot.claim）。面板呼叫伺服器之前先把舊 key 的現況同步上來，
  // 伺服器照規則處理後，客戶端再用 legacyMirror 寫回舊 key。只有本機版接受；物品照 uid 對應，保留原本的 itemId。
  'migrate.sync': async (ctx, p) => {
    if (!ctx.local) throw new ApiError('rejected', 'legacy sync is local only');
    const snap = p?.snapshot;
    if (!snap || typeof snap !== 'object' || Object.values(snap).some((v) => typeof v !== 'string')) throw new ApiError('bad_request', 'snapshot');
    const c0 = (await ctx.r.characters.listByAccount(ctx.accountId)).sort((a, b) => a.slot - b.slot)[0];
    if (!c0) throw new ApiError('not_found', 'character');
    const L = fromLegacy(snap);
    const want: { location: string; pos: number; gear: RtGear }[] = [
      ...Object.entries(L.equip).map(([slot, g]) => ({ location: `equip:${slot}`, pos: 0, gear: g })),
      ...L.bag.map((g, i) => ({ location: 'bag', pos: i, gear: g })),
    ];
    const rows = await ctx.r.items.listByOwner(c0.id);
    const byUid = new Map(rows.filter((r) => r.location === 'bag' || r.location.startsWith('equip:')).map((r) => [String(r.gear.uid), r]));
    const now = ctx.clock.now();
    for (const w of want) {
      const row = byUid.get(w.gear.uid);
      byUid.delete(w.gear.uid);
      const gear = w.gear as unknown as Record<string, unknown>;
      if (!row) await ctx.r.items.save({ id: ctx.ids.next('itm'), ownerId: c0.id, location: w.location, pos: w.pos, bound: false, gear, createdAt: now, version: 0 });
      else if (row.location !== w.location || row.pos !== w.pos || JSON.stringify(row.gear) !== JSON.stringify(gear)) await ctx.r.items.save({ ...row, location: w.location, pos: w.pos, gear });
    }
    for (const r of byUid.values()) await ctx.r.items.delete(r.id);
    const bal = await ctx.r.wallets.balances(c0.id);
    for (const cur of CURRENCIES) if (L.wallet[cur] !== bal[cur]) await ctx.r.wallets.apply(c0.id, cur, L.wallet[cur] - bal[cur], 'sync');
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const next = { ...c0, weapon: L.weapon, level: L.level, xp: L.xp, stats: L.stats, skills: L.skills, variants: L.variants, bounty: L.bounty, shop: L.shop, maps: L.maps, story: L.story };
    const c = same(next, c0) ? c0 : await ctx.r.characters.save(next);
    return characterView(ctx.r, c);
  },
};
