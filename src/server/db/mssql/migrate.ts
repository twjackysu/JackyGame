// 遷移（25 §2-2）：Kysely Migrator，版本表放在 game.kysely_migration；schema 不存在才建（JackyAIStudio 的資料庫已經有小寫 game）。
import { Migrator, sql, type Kysely, type Migration, type MigrationResultSet } from 'kysely';
import * as m0001 from './migrations/0001_init';
import * as m0002 from './migrations/0002_market';
import * as m0003 from './migrations/0003_trade';
import * as m0004 from './migrations/0004_roster';
import * as m0005 from './migrations/0005_sold_index';

type Step = { up(db: Kysely<unknown>, schema: string): Promise<void>; down(db: Kysely<unknown>, schema: string): Promise<void> };
/** 依名稱排序執行；新增遷移就在這裡加一行（不用檔案系統掃描，打包成單一檔案也能跑） */
export const MIGRATIONS: Record<string, Step> = { '0001_init': m0001, '0002_market': m0002, '0003_trade': m0003, '0004_roster': m0004, '0005_sold_index': m0005 };

export function migrator(db: Kysely<unknown>, schema = 'game'): Migrator {
  const migrations: Record<string, Migration> = {};
  for (const [name, m] of Object.entries(MIGRATIONS)) migrations[name] = { up: (d) => m.up(d, schema), down: (d) => m.down(d, schema) };
  return new Migrator({ db, provider: { getMigrations: async () => migrations }, migrationTableSchema: schema });
}

/** schema 名只准英數與底線（會直接拼進 SQL） */
export function assertSchemaName(schema: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(schema) || schema.toLowerCase() === 'dbo') throw new Error(`bad schema ${schema}`);
  return schema;
}

export async function migrateToLatest(db: Kysely<unknown>, schema = 'game'): Promise<MigrationResultSet> {
  assertSchemaName(schema);
  // EXEC('…' + QUOTENAME(…)) 是語法錯誤（EXEC 只吃字串或變數），先組進變數再執行
  await sql`IF SCHEMA_ID(${schema}) IS NULL BEGIN DECLARE @ddl nvarchar(200) = N'CREATE SCHEMA ' + QUOTENAME(${schema}); EXEC(@ddl); END`.execute(db);
  return migrator(db, schema).migrateToLatest();
}
