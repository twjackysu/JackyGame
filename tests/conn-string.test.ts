// ADO.NET 連線字串解析（25 §4.5）
import { describe, expect, it } from 'vitest';
import { parseConnectionString, redact } from '../src/server/db/mssql/connString';

describe('parseConnectionString', () => {
  it('Azure SQL 帳密（Azure 入口網站複製的格式）', () => {
    const t = parseConnectionString('Server=tcp:jacky.database.windows.net,1433;Initial Catalog=JackyAIStudio;Persist Security Info=False;User ID=game_api;Password={p@ss;w0rd}}x};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;');
    expect(t).toMatchObject({ driver: 'tedious', server: 'jacky.database.windows.net', port: 1433, database: 'JackyAIStudio', auth: { type: 'sql', user: 'game_api', password: 'p@ss;w0rd}x' }, encrypt: true, trustServerCertificate: false, connectTimeoutMs: 30000 });
  });
  it('Managed Identity（不含密碼）', () => {
    expect(parseConnectionString('Server=jacky.database.windows.net; Database=X; Authentication=Active Directory Managed Identity; User Id=abc-123').auth).toEqual({ type: 'managed-identity', clientId: 'abc-123' });
    expect(parseConnectionString('Server=a;Authentication="Active Directory Default"').auth).toEqual({ type: 'default' });
  });
  it('LocalDB → msnodesqlv8；本機容器 → 不驗證憑證', () => {
    const l = parseConnectionString('Server=(localdb)\\MSSQLLocalDB;Database=JackyGameDev;Trusted_Connection=True;');
    expect(l).toMatchObject({ driver: 'msnodesqlv8', server: '(localdb)\\MSSQLLocalDB', auth: { type: 'windows' } });
    expect(parseConnectionString('Data Source=localhost,1433;User Id=sa;Password=Pa55w0rd!;TrustServerCertificate=True;Encrypt=False')).toMatchObject({ server: 'localhost', port: 1433, encrypt: false, trustServerCertificate: true });
  });
  it('缺 Server 會丟錯；redact 遮密碼', () => {
    expect(() => parseConnectionString('Database=x')).toThrow();
    expect(redact('Server=a;Password={x;y};User=b')).toBe('Server=a;Password=***;User=b');
    expect(redact('Server=a;pwd=secret')).toBe('Server=a;pwd=***');
  });
});
