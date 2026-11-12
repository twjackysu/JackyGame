// SQL Server／Azure SQL 版資料庫（D-278，25 §3）：Kysely＋MssqlDialect（tedious），所有表在 game schema。
// 實作和 DocDb 同一份 Repos 介面，tests/server-contract 同一組測試在 CI 對它跑（service container）。
// 交易：SERIALIZABLE；死結（1205）自動重試 3 次。
import { Kysely, MssqlDialect, type Transaction } from 'kysely';
import * as Tarn from 'tarn';
import * as Tedious from 'tedious';
import { ApiError } from '../../../net/protocol';
import type { CurrencyId } from '../../../net/views';
import { CURRENCIES, type AccountRow, type CharacterRow, type Db, type ItemRow, type LedgerRow, type ListingRow, type Repos, type TradeRow } from '../../repos/types';
import { parseConnectionString, type DbTarget } from './connString';
import { assertSchemaName, migrateToLatest } from './migrate';
import type { GameDb } from './schema';

const num = (v: number | string | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

export function tediousConfig(t: DbTarget): Tedious.ConnectionConfiguration {
  if (t.driver !== 'tedious') throw new Error('LocalDB 需要 msnodesqlv8（之後的 server/ 套件提供）；CI 與雲端用 tedious');
  const authentication: Tedious.ConnectionAuthentication =
    t.auth.type === 'sql'
      ? { type: 'default', options: { userName: t.auth.user, password: t.auth.password } }
      : t.auth.type === 'managed-identity'
        ? { type: 'azure-active-directory-msi-app-service', options: { clientId: t.auth.clientId } }
        : t.auth.type === 'default'
          ? { type: 'azure-active-directory-default', options: {} }
          : (() => {
              throw new Error('Windows 整合驗證需要 msnodesqlv8');
            })();
  return {
    server: t.server,
    authentication,
    options: { database: t.database, port: t.port ?? 1433, encrypt: t.encrypt, trustServerCertificate: t.trustServerCertificate, connectTimeout: t.connectTimeoutMs ?? 15000, useUTC: true },
  };
}

export function createKysely(connectionString: string, max = 10): Kysely<GameDb> {
  const cfg = tediousConfig(parseConnectionString(connectionString));
  return new Kysely<GameDb>({
    dialect: new MssqlDialect({
      tarn: { ...Tarn, options: { min: 0, max } },
      tedious: { ...Tedious, connectionFactory: () => new Tedious.Connection(cfg) },
    }),
  });
}

type Trx = Transaction<GameDb>;

function charRow(r: GameDb['Character'] extends infer T ? { [K in keyof T]: unknown } : never): CharacterRow {
  const d = JSON.parse(String(r.Data)) as Pick<CharacterRow, 'stats' | 'skills' | 'variants' | 'bounty' | 'shop' | 'maps' | 'story' | 'pvpMatch' | 'pvpRating' | 'pvpHistory' | 'pvpStreak' | 'pvpWinDay' | 'pvpSeason' | 'pveBattle' | 'marketSeenAt'>;
  return { id: String(r.Id), accountId: String(r.AccountId), slot: num(r.Slot as number), name: String(r.Name), weapon: r.Weapon as CharacterRow['weapon'], level: num(r.Level as number), xp: num(r.Xp as number), ...d, createdAt: num(r.CreatedAt as number), version: num(r.Version as number) };
}
function itemRow(r: { [K in keyof GameDb['Item']]: unknown }): ItemRow {
  return { id: String(r.Id), ownerId: String(r.OwnerId), location: String(r.Location), pos: num(r.Pos as number), bound: !!r.Bound, gear: JSON.parse(String(r.Data)) as Record<string, unknown>, createdAt: num(r.CreatedAt as number), version: num(r.Version as number) };
}

function listingRow(r: { [K in keyof GameDb['MarketListing']]: unknown }): ListingRow {
  const d = JSON.parse(String(r.Data)) as { gear: Record<string, unknown>; sellerName: string };
  const out: ListingRow = {
    id: String(r.Id),
    sellerAccountId: String(r.SellerAccountId),
    sellerCharacterId: String(r.SellerCharacterId),
    sellerName: d.sellerName,
    itemId: String(r.ItemId),
    price: num(r.Price as number),
    status: r.Status as ListingRow['status'],
    slot: String(r.Slot),
    rarity: num(r.Rarity as number),
    ilvl: num(r.Ilvl as number),
    gear: d.gear,
    createdAt: num(r.CreatedAt as number),
    expiresAt: num(r.ExpiresAt as number),
    version: num(r.Version as number),
  };
  if (r.ClosedAt !== null && r.ClosedAt !== undefined) out.closedAt = num(r.ClosedAt as number);
  if (r.BuyerCharacterId !== null && r.BuyerCharacterId !== undefined) out.buyerCharacterId = String(r.BuyerCharacterId);
  return out;
}

function tradeRow(r: { [K in keyof GameDb['Trade']]: unknown }): TradeRow {
  const d = JSON.parse(String(r.Data)) as Pick<TradeRow, 'aAccountId' | 'aName' | 'bAccountId' | 'bName' | 'state'>;
  return { id: String(r.Id), aCharacterId: String(r.ACharacterId), bCharacterId: String(r.BCharacterId), ...d, createdAt: num(r.CreatedAt as number), expiresAt: num(r.ExpiresAt as number), version: num(r.Version as number) };
}

function reposOf(t: Trx, now: () => number): Repos {
  return {
    accounts: {
      get: async (id) => {
        const r = await t.selectFrom('Account').selectAll().where('Id', '=', id).executeTakeFirst();
        if (!r) return undefined;
        const out: AccountRow = { id: r.Id, displayName: r.DisplayName, createdAt: num(r.CreatedAt) };
        if (r.MigratedAt !== null) out.migratedAt = num(r.MigratedAt);
        if (r.ActiveCharacterId !== null) out.activeCharacterId = r.ActiveCharacterId;
        return out;
      },
      put: async (row) => {
        const v = { DisplayName: row.displayName, CreatedAt: row.createdAt, MigratedAt: row.migratedAt ?? null, ActiveCharacterId: row.activeCharacterId ?? null };
        const u = await t.updateTable('Account').set(v).where('Id', '=', row.id).executeTakeFirst();
        if (!Number(u.numUpdatedRows)) await t.insertInto('Account').values({ Id: row.id, ...v }).execute();
      },
    },
    characters: {
      get: async (id) => {
        const r = await t.selectFrom('Character').selectAll().where('Id', '=', id).executeTakeFirst();
        return r ? charRow(r) : undefined;
      },
      listByAccount: async (a) => (await t.selectFrom('Character').selectAll().where('AccountId', '=', a).orderBy('Slot').execute()).map(charRow),
      save: async (row) => {
        const v = { AccountId: row.accountId, Slot: row.slot, Name: row.name, Weapon: row.weapon, Level: row.level, Xp: row.xp, Data: JSON.stringify({ stats: row.stats, skills: row.skills, variants: row.variants, bounty: row.bounty, shop: row.shop, maps: row.maps, story: row.story, pvpMatch: row.pvpMatch, pvpRating: row.pvpRating, pvpHistory: row.pvpHistory, pvpStreak: row.pvpStreak, pvpWinDay: row.pvpWinDay, pvpSeason: row.pvpSeason, pveBattle: row.pveBattle, marketSeenAt: row.marketSeenAt }), CreatedAt: row.createdAt };
        const cur = await t.selectFrom('Character').select('Version').where('Id', '=', row.id).executeTakeFirst();
        if (!cur) {
          await t.insertInto('Character').values({ Id: row.id, ...v, Version: row.version }).execute();
          return { ...row };
        }
        const u = await t.updateTable('Character').set({ ...v, Version: row.version + 1 }).where('Id', '=', row.id).where('Version', '=', row.version).executeTakeFirst();
        if (!Number(u.numUpdatedRows)) throw new ApiError('conflict', `characters ${row.id} version ${row.version} != ${cur.Version}`);
        return { ...row, version: row.version + 1 };
      },
      delete: async (id) => {
        await t.deleteFrom('Character').where('Id', '=', id).execute();
      },
    },
    items: {
      get: async (id) => {
        const r = await t.selectFrom('Item').selectAll().where('Id', '=', id).executeTakeFirst();
        return r ? itemRow(r) : undefined;
      },
      listByOwner: async (o) => (await t.selectFrom('Item').selectAll().where('OwnerId', '=', o).orderBy('Location').orderBy('Pos').execute()).map(itemRow),
      save: async (row) => {
        const v = { OwnerId: row.ownerId, Location: row.location, Pos: row.pos, Bound: row.bound, Data: JSON.stringify(row.gear), CreatedAt: row.createdAt };
        const cur = await t.selectFrom('Item').select('Version').where('Id', '=', row.id).executeTakeFirst();
        if (!cur) {
          await t.insertInto('Item').values({ Id: row.id, ...v, Version: row.version }).execute();
          return { ...row };
        }
        const u = await t.updateTable('Item').set({ ...v, Version: row.version + 1 }).where('Id', '=', row.id).where('Version', '=', row.version).executeTakeFirst();
        if (!Number(u.numUpdatedRows)) throw new ApiError('conflict', `items ${row.id} version ${row.version} != ${cur.Version}`);
        return { ...row, version: row.version + 1 };
      },
      delete: async (id) => {
        await t.deleteFrom('Item').where('Id', '=', id).execute();
      },
    },
    wallets: {
      balances: async (c) => {
        const out = { coin: 0, dust: 0, crystal: 0 } as Record<CurrencyId, number>;
        for (const r of await t.selectFrom('Wallet').select(['Currency', 'Balance']).where('CharacterId', '=', c).execute()) if ((CURRENCIES as string[]).includes(r.Currency)) out[r.Currency as CurrencyId] = num(r.Balance);
        return out;
      },
      apply: async (c, cur, delta, reason, refId) => {
        if (!Number.isSafeInteger(delta)) throw new ApiError('bad_request', 'delta must be an integer');
        const w = await t.selectFrom('Wallet').select(['Balance', 'Version']).where('CharacterId', '=', c).where('Currency', '=', cur).executeTakeFirst();
        const balance = num(w?.Balance) + delta;
        if (balance < 0) throw new ApiError('rejected', `not enough ${cur}`);
        if (w) await t.updateTable('Wallet').set({ Balance: balance, Version: num(w.Version) + 1 }).where('CharacterId', '=', c).where('Currency', '=', cur).execute();
        else await t.insertInto('Wallet').values({ CharacterId: c, Currency: cur, Balance: balance, Version: 1 }).execute();
        await t.insertInto('LedgerEntry').values({ CharacterId: c, Currency: cur, Delta: delta, BalanceAfter: balance, Reason: reason, RefId: refId ?? null, At: now() }).execute();
        return balance;
      },
      // 每日對帳（D-334）：LedgerEntry 沒有 At 索引，一天一次全表掃描先接受；量大再加遷移
      activeSince: async (at, limit) => (await t.selectFrom('LedgerEntry').select('CharacterId').distinct().where('At', '>=', at).orderBy('CharacterId').offset(0).fetch(limit).execute()).map((r) => r.CharacterId),
      ledger: async (c) =>
        (await t.selectFrom('LedgerEntry').selectAll().where('CharacterId', '=', c).orderBy('Id').execute()).map((r): LedgerRow => {
          const out: LedgerRow = { id: String(r.Id), characterId: r.CharacterId, currency: r.Currency as CurrencyId, delta: num(r.Delta), balanceAfter: num(r.BalanceAfter), reason: r.Reason, at: num(r.At) };
          if (r.RefId !== null) out.refId = r.RefId;
          return out;
        }),
      deleteCharacter: async (c) => {
        await t.deleteFrom('Wallet').where('CharacterId', '=', c).execute();
        await t.deleteFrom('LedgerEntry').where('CharacterId', '=', c).execute();
      },
    },
    requests: {
      get: async (id) => {
        const r = await t.selectFrom('RequestLog').selectAll().where('Id', '=', id).executeTakeFirst();
        return r ? { id: r.Id, method: r.Method, response: r.Response, at: num(r.At) } : undefined;
      },
      put: async (row) => {
        await t.insertInto('RequestLog').values({ Id: row.id, Method: row.method, Response: row.response, At: row.at }).execute();
      },
      prune: async (before) => {
        await t.deleteFrom('RequestLog').where('At', '<', before).execute();
      },
    },
    audit: {
      add: async (row) => {
        await t.insertInto('AuditLog').values({ AccountId: row.accountId, Action: row.action, Detail: row.detail, At: row.at }).execute();
      },
      recent: async (a, limit) => {
        const n = Math.floor(limit);
        if (!(n > 0)) return [];
        const rows = await t.selectFrom('AuditLog').select(['AccountId', 'Action', 'Detail', 'At']).where('AccountId', '=', a).orderBy('At', 'desc').orderBy('Id', 'desc').offset(0).fetch(n).execute();
        return rows.map((r) => ({ accountId: r.AccountId, action: r.Action, detail: r.Detail, at: Number(r.At) }));
      },
    },
    listings: {
      get: async (id) => {
        const r = await t.selectFrom('MarketListing').selectAll().where('Id', '=', id).executeTakeFirst();
        return r ? listingRow(r) : undefined;
      },
      save: async (row) => {
        const v = {
          SellerAccountId: row.sellerAccountId,
          SellerCharacterId: row.sellerCharacterId,
          ItemId: row.itemId,
          Price: row.price,
          Status: row.status,
          Slot: row.slot,
          Rarity: row.rarity,
          Ilvl: row.ilvl,
          Data: JSON.stringify({ gear: row.gear, sellerName: row.sellerName }),
          CreatedAt: row.createdAt,
          ExpiresAt: row.expiresAt,
          ClosedAt: row.closedAt ?? null,
          BuyerCharacterId: row.buyerCharacterId ?? null,
        };
        const cur = await t.selectFrom('MarketListing').select('Version').where('Id', '=', row.id).executeTakeFirst();
        if (!cur) {
          await t.insertInto('MarketListing').values({ Id: row.id, ...v, Version: row.version }).execute();
          return { ...row };
        }
        const u = await t.updateTable('MarketListing').set({ ...v, Version: row.version + 1 }).where('Id', '=', row.id).where('Version', '=', row.version).executeTakeFirst();
        if (!Number(u.numUpdatedRows)) throw new ApiError('conflict', `listings ${row.id} version ${row.version} != ${cur.Version}`);
        return { ...row, version: row.version + 1 };
      },
      listOpen: async (q) => {
        let s = t.selectFrom('MarketListing').selectAll().where('Status', '=', 'open').where('ExpiresAt', '>', q.aliveAt);
        if (q.slot !== undefined) s = s.where('Slot', '=', q.slot);
        if (q.rarity !== undefined) s = s.where('Rarity', '=', q.rarity);
        if (q.excludeAccountId !== undefined) s = s.where('SellerAccountId', '<>', q.excludeAccountId);
        const rows = await s.orderBy('Price').orderBy('CreatedAt').orderBy('Id').offset(q.offset).fetch(q.limit).execute();
        return rows.map(listingRow);
      },
      listBySeller: async (c, limit) => (await t.selectFrom('MarketListing').selectAll().where('SellerCharacterId', '=', c).orderBy('CreatedAt', 'desc').orderBy('Id', 'desc').offset(0).fetch(limit).execute()).map(listingRow),
      // 最近成交（第 153 輪）：索引 IX_MarketListing_Sold（Status, Slot, Rarity, ClosedAt desc，遷移 0005，第 154 輪）
      listSold: async (q) =>
        (await t.selectFrom('MarketListing').selectAll().where('Status', '=', 'sold').where('Slot', '=', q.slot).where('Rarity', '=', q.rarity).orderBy('ClosedAt', 'desc').orderBy('Id', 'desc').offset(0).fetch(q.limit).execute()).map(listingRow),
    },
    trades: {
      get: async (id) => {
        const r = await t.selectFrom('Trade').selectAll().where('Id', '=', id).executeTakeFirst();
        return r ? tradeRow(r) : undefined;
      },
      save: async (row) => {
        const v = {
          ACharacterId: row.aCharacterId,
          BCharacterId: row.bCharacterId,
          Status: row.state.status,
          Data: JSON.stringify({ aAccountId: row.aAccountId, aName: row.aName, bAccountId: row.bAccountId, bName: row.bName, state: row.state }),
          CreatedAt: row.createdAt,
          ExpiresAt: row.expiresAt,
        };
        const cur = await t.selectFrom('Trade').select('Version').where('Id', '=', row.id).executeTakeFirst();
        if (!cur) {
          await t.insertInto('Trade').values({ Id: row.id, ...v, Version: row.version }).execute();
          return { ...row };
        }
        const u = await t.updateTable('Trade').set({ ...v, Version: row.version + 1 }).where('Id', '=', row.id).where('Version', '=', row.version).executeTakeFirst();
        if (!Number(u.numUpdatedRows)) throw new ApiError('conflict', `trades ${row.id} version ${row.version} != ${cur.Version}`);
        return { ...row, version: row.version + 1 };
      },
      listByCharacter: async (c, limit) =>
        (await t.selectFrom('Trade').selectAll().where((e) => e.or([e('ACharacterId', '=', c), e('BCharacterId', '=', c)])).orderBy('CreatedAt', 'desc').orderBy('Id', 'desc').offset(0).fetch(limit).execute()).map(tradeRow),
    },
  };
}

const isDeadlock = (e: unknown): boolean => (e as { number?: number })?.number === 1205 || /deadlock/i.test(String((e as Error)?.message));

export class MssqlDb implements Db {
  private constructor(
    readonly k: Kysely<GameDb>,
    private readonly now: () => number,
  ) {}

  /** 開啟並跑遷移（到最新）；schema 預設 game */
  static async open(connectionString: string, now: () => number, schema = 'game', opts: { migrate?: boolean } = {}): Promise<MssqlDb> {
    assertSchemaName(schema);
    const k = createKysely(connectionString);
    if (opts.migrate !== false) {
      const r = await migrateToLatest(k as unknown as Kysely<unknown>, schema);
      if (r.error) throw r.error;
    }
    return new MssqlDb(k.withSchema(schema), now);
  }

  async tx<T>(fn: (r: Repos) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.k
          .transaction()
          .setIsolationLevel('serializable')
          .execute((t) => fn(reposOf(t, this.now)));
      } catch (e) {
        if (attempt < 3 && isDeadlock(e)) continue;
        throw e;
      }
    }
  }

  async close(): Promise<void> {
    await this.k.destroy();
  }
}
