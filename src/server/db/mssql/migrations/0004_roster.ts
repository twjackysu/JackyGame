// 0004：多角色（F1，第 145 輪，D-302）。Account 加「目前角色」欄（這是遊戲自己 0001 建的表）；倉庫物品沿用 Item（OwnerId＝wh:<帳號>）。
// 規則同 0001：絕不碰舊原型 8 張表與 dbo；down 只拿掉自己加的欄。
import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>, schema: string): Promise<void> {
  await db.schema.withSchema(schema).alterTable('Account').addColumn('ActiveCharacterId', sql.raw('nvarchar(64)')).execute();
}

export async function down(db: Kysely<unknown>, schema: string): Promise<void> {
  await db.schema.withSchema(schema).alterTable('Account').dropColumn('ActiveCharacterId').execute();
}
