# 25 Azure 後端：Node.js＋TypeScript、共用 JackyAIStudio 的 Azure SQL（`Game` schema）

> 2026-11-06 Jacky：「好像真的要先搞後端，不然邏輯都暴露在 client 端；雲端優先 Azure、次要 AWS、最差 GCP。」「Azure Database 想跟 JackyAIStudio 共用，game 的都放在 `Game` schema（暫定 `dbo` 都是 JackyAIStudio 的）。」決策 D-278。
> 架構原則沿用 `24-online-architecture.md`（本機權威伺服器＋Repository）；這份規定**雲端怎麼落地**。現階段開發迴圈只寫程式、測試、IaC，**不建立任何雲端資源**（要 Jacky 的訂閱與權限）。

## 1. 選擇
| 項目 | 選擇 | 理由 |
|---|---|---|
| 後端語言 | **Node.js 22＋TypeScript** | 伺服器要跑**同一份**確定性引擎 `src/core` 重跑 PvP 指令紀錄、擲掉落；換 .NET 就要維護兩份引擎，一有差異驗證就對不上 |
| 運算 | **Azure Container Apps**（consumption） | 支援 WebSocket（即時 PvP）、可縮到 0、有每月免費額度；Docker 映像之後要搬 AWS（ECS／App Runner）也不用改程式 |
| 資料庫 | **與 JackyAIStudio 共用的 Azure SQL Database**，遊戲資料全在 **`Game` schema** | Jacky 指定；不多開一台資料庫的成本 |
| 資料存取 | **Kysely**＋`MssqlDialect`（tedious） | 型別安全的 SQL builder、`withSchema('Game')`、內建 Migrator 可以把版本表放在 `Game` schema；不用 ORM 的魔法，交易／鎖寫得清楚 |
| 登入 | Microsoft Entra External ID（之後；先做 `DevAuth`） | Azure 原生，可接 Google／Apple 登入 |
| 機密 | Container App 用 **Managed Identity** 連 Azure SQL（Entra 驗證，不放密碼） | 沒有連線字串外洩的風險 |
| 前端 | 照舊 GitHub Pages | 不用動 |

## 2. 與 JackyAIStudio 共用資料庫的規則（重要）
1. **權限隔離**：遊戲伺服器用自己的資料庫使用者（Container App 的 Managed Identity 對應的 contained user），**只對 `Game` schema 有權限**：
   ```sql
   CREATE SCHEMA Game AUTHORIZATION dbo;
   CREATE USER [jackygame-api] FROM EXTERNAL PROVIDER;      -- Container App 的 Managed Identity 名稱
   GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::Game TO [jackygame-api];
   DENY  SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO [jackygame-api];
   -- 建表／遷移用另一個身分（GitHub Actions 的部署身分），只在部署時用：
   GRANT CREATE TABLE TO [jackygame-deploy]; GRANT ALTER ON SCHEMA::Game TO [jackygame-deploy];
   ```
   這樣遊戲就算被打穿，也碰不到 JackyAIStudio 的 `dbo` 資料。
2. **遷移各管各的**：JackyAIStudio 的 EF Core 只管 `dbo`（`__EFMigrationsHistory`）；遊戲用 Kysely Migrator，版本表放 **`Game.kysely_migration`**（`migrationTableSchema: 'Game'`）。雙方都不准建立或修改對方 schema 的物件。**JackyAIStudio 的 EF migration 不能出現 `Game` schema 的東西**（反之亦然）。
3. **命名**：表名 PascalCase 單數（`Game.Account`、`Game.Item`、`Game.MarketListing`…），跟 EF 慣例一致，Jacky 用 SSMS／Azure Data Studio 看起來順。
4. **資源互搶**：同一顆資料庫的運算額度共用。若 JackyAIStudio 用 serverless（自動暫停），遊戲流量會讓它一直醒著 → 費用上升；這點寫進 FOR_JACKY 讓他確認。查詢一律走索引、批次寫入、不做全表掃描；拍賣搜尋要有複合索引。
5. **之後要拆開**：因為全部在 `Game` schema、權限也是 schema 級，搬到獨立資料庫只要 `bacpac` 匯出該 schema 或用遷移重建＋搬資料，程式只改連線設定。

## 3. 資料表（Azure SQL）
對應 24 §3 的實體。重點型別：
| 表 | 重點 |
|---|---|
| `Game.Account` | `Id uniqueidentifier`、`ExternalId nvarchar(128)`（Entra sub，unique）、`DisplayName`、`CreatedAt datetime2` |
| `Game.Character` | `Id`、`AccountId`（FK）、`Slot tinyint`（unique (AccountId, Slot)）、`Weapon`、`Level`、`Xp`、`Data nvarchar(max)`（技能、各地圖進度等 JSON，`ISJSON` check） |
| `Game.Item` | `Id uniqueidentifier`、`OwnerAccountId`、`Location varchar(48)`、`Rarity`、`Ilvl`、`Enh`、`Bound bit`、`Data nvarchar(max)`（詞綴 JSON）、**`RowVer rowversion`**（樂觀鎖）；索引 (OwnerAccountId, Location) |
| `Game.Wallet` / `Game.LedgerEntry` | `LedgerEntry`：`Id bigint identity`、`AccountId`、`Currency`、`Delta bigint`、`Reason`、`RefId`、`At`；`Wallet` 存餘額快取，與帳本在同一交易更新 |
| `Game.MarketListing` | `Id`、`SellerAccountId`、`ItemId`（unique where Status='open'）、`Price bigint`、`Status`、`ExpiresAt`；搜尋索引 (Status, Slot, Rarity, Price) |
| `Game.Trade` | 託管交易狀態機；`RowVer rowversion` |
| `Game.PvpProfile` / `Game.PvpMatch` | `Rating int`；`PvpMatch.Inputs varbinary(max)`（壓縮後的指令紀錄）、`Seed`、`ResultHash` |
| `Game.RequestLog` | `(AccountId, RequestId)` primary key、`Response nvarchar(max)`、`At`——冪等；定期清 7 天前的 |
| `Game.AuditLog` | 誰、何時、動作、前後值 |
- **交易一律用 `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` 或 `UPDLOCK, HOLDLOCK` 鎖住要改的列**，例如拍賣購買：鎖掛單 → 檢查 open → 扣款（`UPDATE Wallet ... WHERE Balance >= @p`，影響 0 列就失敗）→ 轉移物品 → 寫帳本 → commit。
- 時間欄位一律 UTC `datetime2`，顯示時才轉 Asia/Taipei。

## 4. 程式結構
```
src/server/            權威伺服器（D-277，平台中立：不 import Node 專屬模組以外的 DOM／Phaser）
  repos/               介面（不變）
  db/memory/           測試、離線
  db/local/            IndexedDB（離線版遊戲）
  db/mssql/            Kysely 實作（新）＋ migrations/（新，0001_init.ts…）
server/                Node 進入點（新，獨立 package.json 或 npm workspace）
  main.ts              HTTP（健康檢查、REST）＋ ws（WebSocket）→ GameServer
  auth/                DevAuth（開發用）、EntraAuth（驗 JWT）
  Dockerfile
infra/                 Bicep（新）：Container Apps 環境＋App、Log Analytics、Managed Identity、ACR；**資料庫是既有的，只用 parameter 傳伺服器名與資料庫名**
.github/workflows/deploy-server.yml   build 映像 → ACR → 跑 migration → 更新 Container App；**沒有設定 `AZURE_CLIENT_ID` 等 secret 時整個 job skip**
```
- 客戶端兩種 build：`npm run build`（離線版，內含本機伺服器，跟現在一樣）；`npm run build:online`（`VITE_SERVER_URL`，用 `WsTransport`，**不打包 `src/server`**——用 `import.meta.env` 條件＋測試檢查 bundle 裡沒有 server 的程式碼）。上線版客戶端就看不到規則。
- 測試：
  - 契約測試（24 §1）多跑一份 **MssqlRepo**：本機沙盒沒有 SQL Server → 這份只在 CI 跑，GitHub Actions 用 service container `mcr.microsoft.com/mssql/server:2022-latest`；本機只跑 Memory／Local。
  - `server/` 整合測試：起 `main.ts`（Memory repo）→ 兩個 `WsTransport` client 交易一筆、打一場 PvP。

## 5. 時程調整（併入 23 §5）
| 里程碑 | 加入的後端工作 |
|---|---|
| V2（11/7–11/8） | `db/mssql` Kysely 實作＋`0001_init` 遷移（建 `Game` schema 的表）＋CI mssql 契約測試 |
| V4（11/9–11/10） | 交易相關的 SQL 鎖與交易（拍賣購買、託管交換），CI 跑並發測試（同一掛單兩人同時買只有一人成功） |
| V6（11/11–11/12） | `server/main.ts`＋`WsTransport`＋`build:online`、`Dockerfile`、`infra/*.bicep`、`deploy-server.yml`（無 secret 時 skip）、`docs/DEPLOY_AZURE.md` 一步一步的部署手冊 |
- 為了塞進後端，**對戰重播（F5）與美術 A3～A6 降到範圍保護**，拆場景停在 < 4,000 行即可。

## 6. Jacky 要做的（部署時；寫在 FOR_JACKY 與 `docs/DEPLOY_AZURE.md`）
1. 確認 JackyAIStudio 的 Azure SQL 方案（serverless／DTU／免費方案）與流量餘裕。
2. 在資料庫跑 §2 的 SQL（建 `Game` schema、兩個身分與權限）。
3. 建資源群組、用 `az deployment group create -f infra/main.bicep` 建 Container Apps 等（或讓 workflow 建）。
4. 在 Entra 建 GitHub Actions 用的 federated credential（OIDC），把 `AZURE_CLIENT_ID`／`AZURE_TENANT_ID`／`AZURE_SUBSCRIPTION_ID`／`SQL_SERVER`／`SQL_DATABASE` 設成 repo secrets。
5. （之後）建 Entra External ID 租用戶、註冊 App、設定 Google／Apple 登入。
