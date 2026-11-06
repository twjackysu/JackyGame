// 0002：拍賣所（第 142 輪 V4 先行，24 §4.1、25 §3）。規則同 0001：只 CREATE 自己的表；絕不碰舊原型表與 dbo。
import { sql, type Kysely } from 'kysely';

const T = (t: string) => sql.raw(t);

export async function up(db: Kysely<unknown>, schema: string): Promise<void> {
  const s = db.schema.withSchema(schema);
  await s
    .createTable('MarketListing')
    .addColumn('Id', T('nvarchar(64)'), (c) => c.primaryKey())
    .addColumn('SellerAccountId', T('nvarchar(64)'), (c) => c.notNull())
    .addColumn('SellerCharacterId', T('nvarchar(64)'), (c) => c.notNull())
    .addColumn('ItemId', T('nvarchar(64)'), (c) => c.notNull())
    .addColumn('Price', T('bigint'), (c) => c.notNull().check(sql`[Price] > 0`))
    .addColumn('Status', T('varchar(12)'), (c) => c.notNull())
    .addColumn('Slot', T('varchar(16)'), (c) => c.notNull())
    .addColumn('Rarity', T('tinyint'), (c) => c.notNull())
    .addColumn('Ilvl', T('int'), (c) => c.notNull())
    /** 物品快照與賣家名字（JSON） */
    .addColumn('Data', T('nvarchar(max)'), (c) => c.notNull().check(sql`ISJSON([Data]) = 1`))
    .addColumn('CreatedAt', T('bigint'), (c) => c.notNull())
    .addColumn('ExpiresAt', T('bigint'), (c) => c.notNull())
    .addColumn('ClosedAt', T('bigint'))
    .addColumn('BuyerCharacterId', T('nvarchar(64)'))
    .addColumn('Version', T('int'), (c) => c.notNull())
    .execute();
  await s.createIndex('IX_MarketListing_Search').on('MarketListing').columns(['Status', 'Slot', 'Rarity', 'Price']).execute();
  await s.createIndex('IX_MarketListing_Seller').on('MarketListing').columns(['SellerCharacterId', 'CreatedAt']).execute();
}

export async function down(db: Kysely<unknown>, schema: string): Promise<void> {
  for (const t of ['MarketListing']) await db.schema.withSchema(schema).dropTable(t).ifExists().execute();
}
