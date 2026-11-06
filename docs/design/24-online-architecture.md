# 24 線上化架構：單機模擬線上版（交易、PvP 為主）

> 2026-11-06 Jacky：「日後可能變成線上版，方向要朝能**交易**和能 **PvP** 為主；整體架構先用單機模擬線上版，設計方向是之後**只要換掉資料庫或後端 server** 就能上線。」決策 D-277（取代 D-276 裡「預設協力 lockstep」的那段）。
> 這份是架構規格；里程碑與排程在 `23-v2-roadmap.md`。

## 1. 核心想法
**遊戲裡現在就有一台「伺服器」，只是它跑在手機裡。**

```
┌──────────── 客戶端（Phaser，只負責畫面與輸入）────────────┐
│ Scenes / UI ──► GameClient（型別化 API：market.list、trade.offer、pvp.join…）│
└──────────────────────────────┬──────────────────────────────┘
                               │ Transport（只傳 JSON 訊息）
        ┌──────────────────────┴───────────────────────┐
        │ 現在：LocalTransport（同一個程式內，         │ 之後：WsTransport / HttpTransport
        │   序列化＋可模擬延遲、掉包）                  │   （連到真的伺服器）
        └──────────────────────┬───────────────────────┘
┌──────────────────────────────┴──────────────────────────────┐
│ GameServer（權威：所有會改資料的事都在這裡決定）              │
│  handlers：auth / character / inventory / shop / enhance /   │
│            market / trade / pvp / battle                      │
│  使用 src/core（戰鬥引擎、core/meta 規則），不 import Phaser   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Repository 介面（AccountRepo、CharacterRepo、ItemRepo、
                               │ WalletRepo、MarketRepo、TradeRepo、PvpRepo、AuditRepo）
        ┌──────────────────────┴───────────────────────┐
        │ 現在：LocalDb（IndexedDB；測試用 MemoryDb）   │ 之後：Azure SQL（`Game` schema，25 號文件）
        └───────────────────────────────────────────────┘
```

**換成線上版要做的事（目標清單，越短越好）**：
1. 把 `src/server/` 原封不動放到 Node（它本來就不碰 DOM／Phaser）。
2. 寫一份 SQL 版的 Repository（介面不變，測試套件共用）——已定案：Kysely＋Azure SQL，與 JackyAIStudio 共用資料庫、遊戲資料全在 `Game` schema（D-278，`25-azure-backend.md`）。
3. 寫 `WsTransport`（客戶端）與 WebSocket 入口（伺服器端）。
4. 把 `LocalAuth` 換成真的登入。
5. 「模擬玩家」（§5）關掉，換成真人。

**遊戲其他地方不用改**——這就是驗收標準。`tests/server-contract/` 的同一組測試要能對 `MemoryDb`、`LocalDb` 跑（之後也對 SQL 跑）。

## 2. 四條鐵律（程式碼審查時逐條看）
1. **客戶端不准直接改資料**：`src/game/**`、`src/audio/**` 不准碰 `localStorage`／`indexedDB`，也不准自己算掉落、扣錢、加經驗；只能 `client.call('xxx', …)`，用回傳結果更新畫面。（測試掃描擋）
2. **邊界只傳 JSON**：`LocalTransport` 每則訊息都 `JSON.stringify` → `parse`，客戶端拿不到伺服器物件的參考；這樣「本機能動、上線壞掉」的情況會在本機就先壞。
3. **伺服器說了算**：物品 id、金幣、掉落亂數、強化成敗、PvP 勝負都由伺服器產生；客戶端送的是「意圖」（我要買第 3 件、我要強化這把），不是「結果」。
4. **每個寫入請求都帶 `requestId`（冪等）**：網路重送時不會買兩次；伺服器記住最近的 requestId → 回傳上次結果。

## 3. 資料模型（線上版直接變成資料表）
| 實體 | 欄位重點 | 備註 |
|---|---|---|
| `Account` | `id`、`createdAt`、`displayName` | 本機就一個帳號（`LocalAuth`）；模擬玩家各有帳號 |
| `Character` | `id`、`accountId`、`slot`、`name`、`weapon`、`level`、`xp`、`skillPoints`、`skills`、`maps`（各地圖進度） | 多角色 F1 |
| `Item` | `id`（伺服器發的 UUID）、`ownerId`＋`location`（`bag`／`equip:<slot>`／`warehouse`／`market:<listingId>`／`trade:<tradeId>`）、`defSeed`、`rarity`、`ilvl`、`affixes`、`enh`、`bound`、`version` | **一件物品同一時間只在一個位置**，移動就是改 location；`version` 做樂觀鎖 |
| `Wallet` ＋ `LedgerEntry` | 金幣、燼塵、晶石；每筆異動寫一行帳（`delta`、`reason`、`refId`） | **複式記帳**：餘額＝帳本加總，交易對帳、查作弊都靠它 |
| `MarketListing` | `id`、`sellerId`、`itemId`、`price`、`fee`、`expiresAt`、`status` | 拍賣所 |
| `Trade` | `id`、`a`、`b`、`offerA`、`offerB`、`lockedA/B`、`confirmedA/B`、`status` | 面對面交易（託管） |
| `PvpProfile` | `characterId`、`rating`（Elo）、`wins`、`losses`、`season` | |
| `PvpMatch` | `id`、`players`、`seed`、`inputs`（指令紀錄）、`resultHash`、`winner` | 確定性引擎 → 存種子＋指令就能完整重播、也能事後驗證 |
| `AuditLog` | 誰、什麼時候、做了什麼、前後值 | 線上版客服與防作弊 |

- 現在的 `jg_rt_<map>` 等存檔在第一次啟動時**遷移**成「帳號 1／角色 1」的資料（遷移前先備份，D-276 Q2 的要求不變）。
- 時間一律由伺服器給（`Clock` 介面；本機用 `Date.now()`，測試用假時鐘）。

## 4. 交易
### 4.1 拍賣所（主要）
- 上架：`market.list(itemId, price)` → 物品 location 改成 `market:<id>`，收上架費（金幣回收，防通膨）。
- 購買：`market.buy(listingId, requestId)` → **同一個資料庫交易**裡：檢查掛單仍有效、扣買家錢、加賣家錢（扣手續費 5%）、物品換主人、寫帳本與稽核。任何一步失敗全部回滾。
- 搜尋：部位、稀有度、ilvl、詞綴、價格排序；分頁。
- 掛單 48 小時（遊戲內時間）過期退回。
### 4.2 面對面交易（託管）
- 雙方各放物品／金幣 → 各自「鎖定」→ 任一方再改內容就解除雙方鎖定 → 雙方都「確認」才在一個資料庫交易裡交換。防「最後一秒偷換」。
- 本機：對象是模擬玩家（§5）或自己的另一個角色（倉庫之外的另一條路）。
### 4.3 防弊與經濟
- **綁定**：Boss 神裝、劇情獎勵 `bound: true` 不能交易（保留刷寶動機）；一般掉落可交易。
- 金幣來源（打怪、賣 NPC）與回收（手續費、上架費、強化、行商）每天由模擬器報表檢查（`npm run sim:economy`），目標是物價不無限上漲。
- 每個帳號每天上架數量上限。

## 5. 模擬玩家（讓單機「感覺像線上」）
- `src/server/sim/`：伺服器裡跑 20～50 個**模擬玩家**（固定種子、有名字、有職業偏好、有等級成長曲線）。伺服器每次被呼叫時，依照經過的時間補跑他們的行為（離線也能用，不用常駐計時器）：
  - 上架他們「刷到」的裝備、用合理價格（參考近期成交價＋隨機）買走玩家的掛單。
  - 帶著自己的配裝參加 PvP 天梯，成為玩家的對手。
- 線上版把模擬玩家關掉（或保留當「機器人填充」）。**模擬玩家只能透過和真人一樣的 handler 行動**，不能直接改資料庫——這也順便測試了 API。

## 6. PvP
### 6.1 引擎要支援的事
- 單位多一個 `team`（不只 player／enemy）；技能命中判斷改成「打敵對隊伍」；Boss 機制在 PvP 關閉。
- **PvP 數值正規化**：PvP 場地內 HP ×3、所有傷害 ×0.5、控制效果時間減半、同一目標控制遞減（避免一套控到死）；裝備差距用「ilvl 壓縮」縮小（例如 ilvl 差 10 只差 3）。數值寫在 `src/core/battle/rt/pvp.ts`，用模擬器跑三武器互打勝率，目標每組合 40～60%。
- 競技場地圖：小而有掩體（一張 24×24 的 `maps/arena.ts`）。
### 6.2 兩種模式
1. **非同步天梯（本機現在就能玩）**：對手是模擬玩家或之後真人的「配裝快照」，由 `PlayerBot` 操作。伺服器開 `PvpMatch`（給種子），客戶端在本機跑引擎、送出**自己的指令紀錄**，伺服器**用同一份引擎重跑一次**驗證勝負（確定性引擎的好處：結果做不了假）。勝負更新 Elo。
2. **即時對戰（架構就緒，本機以兩個客戶端測）**：伺服器上的 `BattleRoom` 每 tick 收雙方指令、跑 `step`、廣播快照／差量；客戶端做本地預測與修正。本機驗收：`tests/pvp-realtime.test.ts` 兩個 `GameClient` 透過 `LocalTransport`（模擬 80ms 延遲、2% 掉包）打完一場，雙方畫面狀態收斂、伺服器 hash 為準。
- 不做 lockstep 當 PvP 主路線：PvP 要防作弊，伺服器權威較安全（D-277）。lockstep 留給之後的協力副本。
### 6.3 PvP 獎勵
- 賽季積分 → 段位稱號、外觀（光環顏色），**不給數值**，避免 PvP 變成付費或刷到碾壓。

## 7. PvE 怎麼辦
- 為了手感，PvE 戰鬥**仍在客戶端跑引擎**（零延遲）。但「戰利品」改成向伺服器申請：開打時 `battle.start(mapId)` 拿 `battleId`＋種子；打倒怪時 `loot.claim(battleId, killSeq)`，伺服器用自己的亂數擲掉落。
- 線上版的防作弊：伺服器可以要客戶端上傳那段戰鬥的指令紀錄抽查重跑（確定性），或限制每分鐘掉落上限。本機版先做速率檢查＋留好 `inputs` 欄位。

## 8. 程式目錄
```
src/
  core/            純規則（已存在）＋ core/meta（D-276 Q3：商店、強化、掉落、技能點的純函式）
  server/          GameServer、handlers/、sim/（模擬玩家）、repos/（介面）、db/memory、db/local（IndexedDB）
  net/             protocol.ts（訊息型別＋版本）、Transport 介面、LocalTransport、（之後）WsTransport
  client/          GameClient（型別化呼叫、重送、requestId、離線佇列）、狀態快取（給 UI 讀）
  game/            Phaser 畫面（只依賴 client/ 與 core 的唯讀型別）
```
- ESLint 邊界（D-276 Q8）：`game` 不准 import `server`／`db`；`server` 不准 import `phaser`／`game`／`client`；`core` 只准 import `core`。

## 9. 不在這期做
- 真的伺服器、帳號註冊、付款（違反離線與不付費）。
- 聊天、公會、好友（之後線上版再說；protocol 先保留 `social.*` 命名空間）。
