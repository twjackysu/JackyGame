// 0005：拍賣所「最近成交」索引（第 154 輪，D-333）。逛逛時每頁最多查 8 組最近成交（market.browse refs），
// listSold 是 Status='sold'＋Slot＋Rarity 篩完照 ClosedAt 由新到舊取前 12 筆 → 索引照這個順序，不用排序整堆成交紀錄。
// 規則同 0001：只在 game schema 的自己的表上建索引；不碰舊原型 8 張表與 dbo；down 只拿掉自己加的索引。
import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>, schema: string): Promise<void> {
  await db.schema.withSchema(schema).createIndex('IX_MarketListing_Sold').on('MarketListing').columns(['Status', 'Slot', 'Rarity', 'ClosedAt desc']).execute();
}

export async function down(db: Kysely<unknown>, schema: string): Promise<void> {
  // SQL Server 的 DROP INDEX 索引名不能加 schema（withSchema 會加）→ 只在表名上帶 schema
  await db.schema.dropIndex('IX_MarketListing_Sold').on(`${schema}.MarketListing`).execute();
}
