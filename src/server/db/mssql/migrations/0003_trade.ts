// 0003：面對面交易（託管，F3，第 144 輪，24 §4.2、25 §3）。規則同 0001：只 CREATE 自己的表；絕不碰舊原型表與 dbo。
import { sql, type Kysely } from 'kysely';

const T = (t: string) => sql.raw(t);

export async function up(db: Kysely<unknown>, schema: string): Promise<void> {
  const s = db.schema.withSchema(schema);
  await s
    .createTable('Trade')
    .addColumn('Id', T('nvarchar(64)'), (c) => c.primaryKey())
    .addColumn('ACharacterId', T('nvarchar(64)'), (c) => c.notNull())
    .addColumn('BCharacterId', T('nvarchar(64)'), (c) => c.notNull())
    .addColumn('Status', T('varchar(12)'), (c) => c.notNull())
    /** 雙方帳號與名字、狀態機（JSON） */
    .addColumn('Data', T('nvarchar(max)'), (c) => c.notNull().check(sql`ISJSON([Data]) = 1`))
    .addColumn('CreatedAt', T('bigint'), (c) => c.notNull())
    .addColumn('ExpiresAt', T('bigint'), (c) => c.notNull())
    .addColumn('Version', T('int'), (c) => c.notNull())
    .execute();
  await s.createIndex('IX_Trade_A').on('Trade').columns(['ACharacterId', 'CreatedAt']).execute();
  await s.createIndex('IX_Trade_B').on('Trade').columns(['BCharacterId', 'CreatedAt']).execute();
}

export async function down(db: Kysely<unknown>, schema: string): Promise<void> {
  for (const t of ['Trade']) await db.schema.withSchema(schema).dropTable(t).ifExists().execute();
}
