// 0001：建立第二期 V1 的表（25 §3）。規則（25 §2-5）：只 CREATE 自己的表；絕不 DROP／ALTER 別人的表（舊原型 8 張、dbo 全部）。
// down 只刪這個遷移自己建的表。
import { sql, type Kysely } from 'kysely';

/** 型別直接寫 SQL Server 的寫法（Kysely 的型別清單沒有 nvarchar／tinyint） */
const T = (t: string) => sql.raw(t);

export async function up(db: Kysely<unknown>, schema: string): Promise<void> {
  const s = db.schema.withSchema(schema);
  await s
    .createTable('Account')
    .addColumn('Id', T('nvarchar(64)'), (c) => c.primaryKey())
    .addColumn('DisplayName', T('nvarchar(32)'), (c) => c.notNull())
    .addColumn('CreatedAt', T('bigint'), (c) => c.notNull())
    .addColumn('MigratedAt', T('bigint'))
    .execute();
  await s
    .createTable('Character')
    .addColumn('Id', T('nvarchar(64)'), (c) => c.primaryKey())
    .addColumn('AccountId', T('nvarchar(64)'), (c) => c.notNull())
    .addColumn('Slot', T('tinyint'), (c) => c.notNull())
    .addColumn('Name', T('nvarchar(32)'), (c) => c.notNull())
    .addColumn('Weapon', T('varchar(8)'), (c) => c.notNull())
    .addColumn('Level', T('int'), (c) => c.notNull())
    .addColumn('Xp', T('int'), (c) => c.notNull())
    .addColumn('Data', T('nvarchar(max)'), (c) => c.notNull().check(sql`ISJSON([Data]) = 1`))
    .addColumn('CreatedAt', T('bigint'), (c) => c.notNull())
    .addColumn('Version', T('int'), (c) => c.notNull())
    .addUniqueConstraint('UQ_Character_Account_Slot', ['AccountId', 'Slot'])
    .execute();
  await s
    .createTable('Item')
    .addColumn('Id', T('nvarchar(64)'), (c) => c.primaryKey())
    .addColumn('OwnerId', T('nvarchar(64)'), (c) => c.notNull())
    .addColumn('Location', T('varchar(48)'), (c) => c.notNull())
    .addColumn('Pos', T('int'), (c) => c.notNull())
    .addColumn('Bound', T('bit'), (c) => c.notNull())
    .addColumn('Data', T('nvarchar(max)'), (c) => c.notNull().check(sql`ISJSON([Data]) = 1`))
    .addColumn('CreatedAt', T('bigint'), (c) => c.notNull())
    .addColumn('Version', T('int'), (c) => c.notNull())
    .execute();
  await s.createIndex('IX_Item_Owner_Location').on('Item').columns(['OwnerId', 'Location', 'Pos']).execute();
  await s
    .createTable('Wallet')
    .addColumn('CharacterId', T('nvarchar(64)'), (c) => c.notNull())
    .addColumn('Currency', T('varchar(8)'), (c) => c.notNull())
    .addColumn('Balance', T('bigint'), (c) => c.notNull().check(sql`[Balance] >= 0`))
    .addColumn('Version', T('int'), (c) => c.notNull())
    .addPrimaryKeyConstraint('PK_Wallet', ['CharacterId', 'Currency'])
    .execute();
  await s
    .createTable('LedgerEntry')
    .addColumn('Id', T('bigint'), (c) => c.identity().primaryKey())
    .addColumn('CharacterId', T('nvarchar(64)'), (c) => c.notNull())
    .addColumn('Currency', T('varchar(8)'), (c) => c.notNull())
    .addColumn('Delta', T('bigint'), (c) => c.notNull())
    .addColumn('BalanceAfter', T('bigint'), (c) => c.notNull())
    .addColumn('Reason', T('varchar(32)'), (c) => c.notNull())
    .addColumn('RefId', T('nvarchar(64)'))
    .addColumn('At', T('bigint'), (c) => c.notNull())
    .execute();
  await s.createIndex('IX_LedgerEntry_Character').on('LedgerEntry').columns(['CharacterId', 'Id']).execute();
  await s
    .createTable('RequestLog')
    .addColumn('Id', T('nvarchar(160)'), (c) => c.primaryKey())
    .addColumn('Method', T('varchar(48)'), (c) => c.notNull())
    .addColumn('Response', T('nvarchar(max)'), (c) => c.notNull())
    .addColumn('At', T('bigint'), (c) => c.notNull())
    .execute();
  await s.createIndex('IX_RequestLog_At').on('RequestLog').column('At').execute();
  await s
    .createTable('AuditLog')
    .addColumn('Id', T('bigint'), (c) => c.identity().primaryKey())
    .addColumn('AccountId', T('nvarchar(64)'), (c) => c.notNull())
    .addColumn('Action', T('varchar(48)'), (c) => c.notNull())
    .addColumn('Detail', T('nvarchar(max)'), (c) => c.notNull())
    .addColumn('At', T('bigint'), (c) => c.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>, schema: string): Promise<void> {
  for (const t of ['AuditLog', 'RequestLog', 'LedgerEntry', 'Wallet', 'Item', 'Character', 'Account']) await db.schema.withSchema(schema).dropTable(t).ifExists().execute();
}
