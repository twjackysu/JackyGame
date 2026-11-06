// game schema 的遷移規則（25 §2-5）：只建自己的表，絕不 DROP／ALTER 舊原型表或 dbo。
// 靜態檢查本機就跑；真的 SQL Server 檢查只在 CI 的 mssql job 跑（GAME_DB_TEST_CONNECTION）。
import { readdirSync, readFileSync } from 'node:fs';
import { sql, type Kysely } from 'kysely';
import { describe, expect, it } from 'vitest';
import { createKysely } from '../../src/server/db/mssql/MssqlDb';
import { MIGRATIONS, assertSchemaName, migrateToLatest } from '../../src/server/db/mssql/migrate';
import { OWN_TABLES } from '../../src/server/db/mssql/schema';
import { MSSQL_TEST } from './backends';

const LEGACY_TABLES = ['Battles', 'Pets', 'PetSkills', 'PetTalents', 'Players', 'Skills', 'Species', 'Talents'];

describe('遷移規則（靜態）', () => {
  const dir = 'src/server/db/mssql/migrations';
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  it('每個遷移檔都登記在 MIGRATIONS', () => {
    expect(files.map((f) => f.replace(/\.ts$/, '')).sort()).toEqual(Object.keys(MIGRATIONS).sort());
  });
  for (const f of files)
    it(`${f}：只動自己的表、不寫 dbo、不用原始 DROP／ALTER`, () => {
      const src = readFileSync(`${dir}/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of src.matchAll(/(?:createTable|dropTable|alterTable)\('(\w+)'\)/g)) expect(OWN_TABLES as readonly string[]).toContain(m[1]);
      for (const m of src.matchAll(/for \(const t of \[([^\]]*)\]\)/g)) for (const t of m[1]!.match(/'(\w+)'/g) ?? []) expect(OWN_TABLES as readonly string[]).toContain(t.slice(1, -1));
      expect(src).not.toMatch(/\bdbo\b/i);
      expect(src).not.toMatch(/sql`[^`]*\b(DROP|ALTER|TRUNCATE)\b/i);
      for (const t of LEGACY_TABLES) expect(OWN_TABLES as readonly string[]).not.toContain(t);
    });
  it('schema 名檢查：不准 dbo、不准奇怪字元', () => {
    expect(assertSchemaName('game')).toBe('game');
    expect(() => assertSchemaName('dbo')).toThrow();
    expect(() => assertSchemaName("game];DROP TABLE x;--")).toThrow();
  });
});

describe.runIf(!!MSSQL_TEST)('遷移規則（真的 SQL Server）', () => {
  it('舊原型表 game.Players 跑完遷移還在、資料沒變；重跑遷移是 no-op', async () => {
    const k = createKysely(MSSQL_TEST!) as unknown as Kysely<unknown>;
    try {
      await sql`IF SCHEMA_ID('game') IS NULL EXEC('CREATE SCHEMA game')`.execute(k);
      await sql`IF OBJECT_ID('game.Players') IS NULL EXEC('CREATE TABLE game.Players (Id int PRIMARY KEY, Name nvarchar(20))')`.execute(k);
      await sql`IF NOT EXISTS (SELECT 1 FROM game.Players WHERE Id = 1) INSERT INTO game.Players (Id, Name) VALUES (1, N'舊原型')`.execute(k);
      const r1 = await migrateToLatest(k);
      expect(r1.error).toBeUndefined();
      const r2 = await migrateToLatest(k);
      expect(r2.error).toBeUndefined();
      expect(r2.results ?? []).toEqual([]);
      const rows = await sql<{ Id: number; Name: string }>`SELECT Id, Name FROM game.Players`.execute(k);
      expect(rows.rows).toContainEqual({ Id: 1, Name: '舊原型' });
      const cols = await sql<{ name: string }>`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('game.Players') ORDER BY column_id`.execute(k);
      expect(cols.rows.map((c) => c.name)).toEqual(['Id', 'Name']);
      const ver = await sql<{ n: number }>`SELECT COUNT(*) AS n FROM game.kysely_migration`.execute(k);
      expect(ver.rows[0]!.n).toBe(Object.keys(MIGRATIONS).length);
    } finally {
      await k.destroy();
    }
  }, 60_000);
});
