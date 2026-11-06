// account.get／export／import（設定裡的「匯出／匯入存檔」）
import { ApiError } from '../../net/protocol';
import type { CharacterView, ExportBlob, WeaponView } from '../../net/views';
import type { HandlerTable } from '../router';
import { accountView, characterView } from '../views';
import { createCharacter, deleteCharacter } from './build';
import { ensureAccount } from './common';

export const EXPORT_VERSION = 1;
const MAX_CHARACTERS = 3;
const MAX_ITEMS = 200;

export const accountHandlers: Pick<HandlerTable, 'account.get' | 'account.export' | 'account.import'> = {
  'account.get': async (ctx) => accountView(await ensureAccount(ctx)),

  'account.export': async (ctx) => {
    const acc = await ensureAccount(ctx);
    const chars: (CharacterView & { story: Record<string, string> })[] = [];
    for (const c of await ctx.r.characters.listByAccount(ctx.accountId)) chars.push({ ...(await characterView(ctx.r, c)), story: c.story });
    const blob: ExportBlob = { format: 'jackygame-save', version: EXPORT_VERSION, exportedAt: ctx.clock.now(), data: { account: [accountView(acc)], characters: chars } };
    return blob;
  },

  'account.import': async (ctx, p) => {
    if (!ctx.local) throw new ApiError('rejected', 'import is local only');
    const b = p?.blob;
    if (!b || b.format !== 'jackygame-save' || b.version !== EXPORT_VERSION || !b.data || !Array.isArray(b.data.characters)) throw new ApiError('bad_request', 'not a save file');
    const chars = b.data.characters as Partial<CharacterView & { story: Record<string, string> }>[];
    if (chars.length > MAX_CHARACTERS) throw new ApiError('bad_request', 'too many characters');
    const acc = await ensureAccount(ctx);
    for (const c of await ctx.r.characters.listByAccount(ctx.accountId)) await deleteCharacter(ctx, c.id);
    const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
    const rec = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    for (const [i, c] of chars.entries()) {
      const items = (Array.isArray(c.items) ? c.items : []).slice(0, MAX_ITEMS).filter((it) => it && typeof it.location === 'string' && it.gear && typeof it.gear === 'object');
      const w = rec(c.wallet) as Record<string, unknown>;
      await createCharacter(
        ctx,
        {
          slot: i,
          name: typeof c.name === 'string' ? c.name.slice(0, 16) : '旅人',
          weapon: (['sword', 'bow', 'staff'] as WeaponView[]).includes(c.weapon as WeaponView) ? (c.weapon as WeaponView) : 'sword',
          level: Math.max(1, num(c.level, 1)),
          xp: num(c.xp),
          stats: rec(c.stats) as Record<string, number>,
          skills: c.skills ?? null,
          variants: c.variants ?? null,
          bounty: c.bounty ?? null,
          shop: c.shop ?? null,
          maps: rec(c.maps) as CharacterView['maps'],
          story: rec(c.story) as Record<string, string>,
          items: items.map((it) => ({ location: it.location, pos: num(it.pos), bound: !!it.bound, gear: it.gear })),
          wallet: { coin: num(w.coin), dust: num(w.dust), crystal: num(w.crystal) },
        },
        'import',
      );
    }
    await ctx.r.audit.add({ accountId: ctx.accountId, action: 'account.import', detail: JSON.stringify({ characters: chars.length, exportedAt: b.exportedAt }), at: ctx.clock.now() });
    return accountView(acc);
  },
};
