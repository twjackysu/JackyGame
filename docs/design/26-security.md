# 26 資安與防作弊（線上版）

> 2026-11-06 Jacky：「要顧好資安，敏感邏輯都寫在後端，避免 client 端作弊。DB 用 connection string，之後我換；測試先用 LocalDB，之後換成 JackyAIStudio 的 SQL DB。」決策 D-279。
> 範圍：線上版（`build:online`＋`server/`）。離線版只有玩家自己的存檔，作弊只影響自己，不在這份的防護範圍。

## 1. 基本立場
1. **客戶端是敵人**：任何從客戶端來的東西（參數、時間、座標、戰鬥結果、物品資料）都可能是假的。伺服器只接受「意圖」，自己算結果。
2. **不靠藏程式碼**：repo 是公開的（GPL），伺服器原始碼本來就看得到。安全來自「伺服器說了算」，不是混淆。
3. **秘密只在伺服器的環境變數**：connection string、簽章金鑰從來不進 git、不進客戶端 bundle。

## 2. 哪些邏輯只能在後端
| 類別 | 只在後端 | 客戶端只做 |
|---|---|---|
| 經濟 | 金幣／材料增減、商店價格與庫存、買賣、手續費 | 顯示價格、送「我要買第 N 件」 |
| 物品 | 產生物品（id、詞綴、數值）、掉落擲骰、強化成敗、拆解 | 顯示 |
| 角色 | 經驗、升級、技能點、裝備穿脫的合法性 | 送「我要穿這件」 |
| 交易 | 拍賣上架／購買、託管交易的鎖定與交換 | 送意圖、輪詢／訂閱狀態 |
| PvP | 對手配對、種子、勝負判定（重跑指令紀錄）、積分 | 本機跑戰鬥給玩家看、上傳指令紀錄 |
| 時間 | 冷卻、每日重置、掛單到期 | 顯示倒數 |
- **上線版 bundle 不含 `src/server`、掉落表、商店權重**：`build:online` 用 `import.meta.env.VITE_ONLINE` 條件切掉 `LocalTransport` 與 `src/server`；CI 測試掃描 `dist-online/` 不得出現 `GameServer`、`rollLoot` 等符號。（程式碼公開不是問題，但不打包可以減少誤用與包大小。）

## 3. 防作弊細節
### 3.1 PvE（戰鬥在客戶端跑，掉落在伺服器擲）
- `battle.start(mapId)` → 伺服器發 `battleId`＋種子＋`engineVersion`，記下開始時間與角色當下的數值快照。
- `loot.claim(battleId, killSeq, enemyDefId)`：伺服器檢查——這張圖有這種怪、距開戰時間夠長（擊殺數÷時間不超過人類上限，每分鐘 48 隻、開場可先 14 隻）、`killSeq` 遞增不重複、同一 battle 掉落次數上限 → 通過才用**伺服器的亂數**擲掉落。
- **抽查重跑**：伺服器可以要求上傳該場的指令紀錄（壓縮後幾 KB），用同一版引擎重跑；擊殺數對不上就作廢該場掉落並記 `AuditLog`。可疑帳號（擊殺率前 1%）自動抽查。
### 3.2 PvP
- 非同步：勝負只看伺服器重跑結果；`engineVersion` 不同直接拒收。指令紀錄長度、每 tick 指令數設上限。
- 即時：`BattleRoom` 在伺服器跑；客戶端送的移動向量正規化、技能 id 必須是角色擁有的、冷卻由伺服器判斷。
### 3.3 交易
- 一律在資料庫交易裡、鎖住相關列（`UPDLOCK, HOLDLOCK` 或 `SERIALIZABLE`），扣款用 `UPDATE … WHERE Balance >= @price`，影響 0 列＝失敗回滾。
- `Item.RowVer`（rowversion）樂觀鎖：物品同時被兩個動作改，後到的失敗。
- 帳本（`LedgerEntry`）每天對帳：`Wallet` 餘額必須等於帳本加總，不符就告警。
- 綁定物品不能上架、不能交易（伺服器檢查，不靠 UI）。
### 3.4 離線存檔不能帶進線上
- 離線版的存檔可以被任意修改，所以**線上帳號從新開始**；`account.import` 只在離線版存在，線上版伺服器沒有這個 handler（測試確認路由表沒有它）。

## 4. 一般 Web 安全
| 項目 | 做法 |
|---|---|
| 輸入驗證 | 每個 handler 都有 schema（valibot 或 zod），不合格直接 400；字串長度、數字範圍、陣列長度都設上限 |
| SQL injection | 只用 Kysely 的參數化查詢；禁止 `sql.raw` 拼使用者輸入（ESLint 規則＋審查） |
| 驗證身分 | Entra External ID 的 JWT：驗簽章、`iss`、`aud`、`exp`；`accountId` 一律從 token 取，**不收客戶端傳來的 accountId** |
| 授權 | 每個操作檢查資源屬於這個帳號（物品、角色、掛單）；寫成共用的 `assertOwns()` |
| 頻率限制 | 每帳號、每 IP：一般 API 每秒 10 次、交易類每秒 2 次；WebSocket 每秒訊息數與單則大小（例如 16KB）上限，超過斷線 |
| 冪等 | `Game.RequestLog (AccountId, RequestId)` 主鍵；重送回傳上次結果 |
| 傳輸 | 只走 HTTPS／WSS；CORS 只允許 GitHub Pages 網域與 Capacitor 的 origin |
| 錯誤訊息 | 對外只給錯誤代碼，不回 stack trace、SQL 錯誤 |
| 稽核 | 金錢、物品、交易、PvP 結果都寫 `AuditLog`（誰、何時、前後值、requestId） |
| 相依套件 | CI 跑 `npm audit --omit=dev`（高風險就失敗）；Dependabot |
| 最小權限 | 資料庫身分只對 `game` schema 有權限（25 §2），執行期身分不能建表 |

## 5. 秘密與設定
- 伺服器所有設定走環境變數，`server/.env.example` 只放範例、**`.env` 列入 `.gitignore`**：
  - `GAME_DB_CONNECTION_STRING`：**ADO.NET 格式**（跟 JackyAIStudio 用的一樣，Jacky 可以直接複製）。
  - `GAME_DB_SCHEMA`（預設 `Game`）、`AUTH_MODE`（`dev`／`entra`）、`ENTRA_TENANT_ID`、`ENTRA_AUDIENCE`、`ALLOWED_ORIGINS`。
- 雲端：Container App 的 secret 或 Key Vault 參照，不寫進 Bicep 參數檔。
- CI 的 SQL Server 容器密碼只在 workflow 內產生，不是真實環境的密碼。
- **檢查**：CI 加 secret 掃描（gitleaks），測試確保 `dist/`、`dist-online/` 裡沒有 `Password=`、`connection` 字樣。
