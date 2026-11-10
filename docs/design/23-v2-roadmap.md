# 23 第二期路線圖（11/6 → ~~11/13~~ 11/30）：單機模擬線上版（交易、PvP）、程式品質、美術

> **2026-11-10 更新（D-336）**：最終版期限延到 **2026-11-30 12:00（台北）**，11/10 起進入第三期「品質優先」（時程在 `docs/PLAN.md`、評估在 `27-quality-review.md`）。本文件的 V1～V6 已完成的不重做；V7（凍結與發表）改成 **11/27 12:00 起凍結、11/30 12:00 最終版**。下面出現的 11/12、11/13 都已作廢。

> 2026-11-06 Jacky：「產品做得不錯，想繼續進度。新目標到 2026/11/13，自行列新功能 PLAN 或美術改進和 Code 品質改進計畫（時間或空間複雜度，或是方便之後變成線上多人連線版的架構寫法），一樣留 FOR_JACKY 給 feedback。」決策 D-276。
> **11/6 追加（D-277）**：日後可能線上化，方向以**交易**與 **PvP** 為主；先用**單機模擬線上版**（遊戲內建一台本機伺服器＋本機資料庫），之後只換資料庫或後端就能上線。架構規格見 **`24-online-architecture.md`**，本文件的 Q2／Q6／Q7、F 系列、里程碑已照它改寫。
> **11/6 再追加（D-278）**：後端定案 **Node.js＋TypeScript、Azure Container Apps、與 JackyAIStudio 共用 Azure SQL（遊戲全在既有的 `game` schema）**，規格 `25-azure-backend.md`、資安 `26-security.md`（D-279）；V2／V4／V6 加入後端工作，重播與美術降級。
> 每一輪選工作時以本文件的里程碑 V1～V7 為主線；`docs/NEXT.md` 是逐輪待辦。**main 永遠要能 build、能從新遊戲玩到通關**；任何重構都不能讓玩家看到的行為變差。

## 0. 原則
1. **先打地基、再加功能**：先做「不改玩法」的重構與本機伺服器骨架，交易、PvP、多角色才蓋得上去。
2. **單機模擬線上版**（D-277）：客戶端 → `GameClient` → `LocalTransport`（只傳 JSON）→ `GameServer`（權威）→ Repository → `LocalDb`。上線時只換 Transport 與 Repository 實作。專案仍完全離線、不架伺服器、不付費。
3. **重構要可驗證**：每一步都要有 vitest、通關機器人（`npm run playthrough`）和固定種子 `stateHash` 回歸；伺服器 handler 要有契約測試（同一組測試跑 MemoryDb 與 LocalDb）；畫面層的拆分要附前後截圖。
4. **品質優先於數量**：時間不夠時照 §6 的順序砍。

## 1. 現況盤點（11/6，第 138 輪後）
| 項目 | 現況 | 問題 |
|---|---|---|
| 核心 `src/core/battle/rt/` | 純 TS、30 ticks/秒、xorshift32、`step(state, cmds)`、`stateHash` | 很好的基礎。但 `playerOf(s) = s.units[0]`（84 處假設單人）；`engine.ts` 的扇形命中與重生圍圈用 `Math.asin`／`Math.cos`／`Math.sin`（不同 JS 引擎結果可能差最後一位：伺服器用 Node 重跑客戶端的 PvP 指令紀錄驗證時會對不上） |
| 畫面 `RtBattleScene.ts` | **6,495 行**、約 325 個方法 | 上帝物件：鏡頭、HUD、置中大字、特效、輸入、相遇、面板入口、存檔全混在一起，改一處容易牽動別處 |
| 規則放在畫面層 | `src/game/rtShop.ts`、`rtBag.ts`、`rtSkills.ts`、`rtBounty.ts`、`choices.ts`、`encounters.ts` | 掉落／買賣／強化／技能點是「會改存檔的規則」，連線版要在伺服器跑，不能留在 Phaser 那邊 |
| 存檔 | 13 個檔案直接呼叫 `localStorage`（約 50 處），key 散在各處（`jg_rt_<map>`、`jg_weapon`、`jg_prologue_seen`…） | 沒有統一 schema 版本與遷移；不能換成雲端存檔；玩家無法備份 |
| 效能熱點 | `separate()` 每 tick 對全圖活著的單位做 O(n²)；`enemiesOf()` 每次 `filter` 配新陣列；`nearestEnemy` 每次掃全部 | 地圖怪多＋暴動時最吃；中階手機 60fps 的餘裕 |
| 美術 | 14 張 AI 圖；**星隕高原的守望者與魔像是程式美術**；後兩張圖的狼都是霧狼圖染色；行商與相遇 NPC 是程式繪製 | 額度：GPT 0、Gemini 3 |

## 2. 程式品質（Q 系列）

### Q1 確定性加固（V1）
- `engine.ts` 的 `Math.asin`／`Math.sin`／`Math.cos` 改成整數查表（`src/core/fixedMath.ts`：360 或 1024 等分的 sin 表 ×10000，`isqrt` 整數平方根）。`Math.sqrt` 對 IEEE 是精確的，可以保留，但統一包成 `dist()`。
- 測試 `tests/core-purity.test.ts`：掃 `src/core/**`，禁止 `Math.random`、`Math.sin|cos|tan|asin|acos|atan2|exp|pow|log`、`Date`、`performance`、`localStorage`、`window`、`phaser` import。
- 回歸：固定 10 個種子 × 3 武器 × 4 地圖跑 3,000 tick 的 `stateHash` 寫成快照（`tests/rt-golden-hash.test.ts`）。**之後改平衡會變 hash 是正常的**，更新快照時在 commit 寫「hash 快照更新：原因」。

### Q2 本機伺服器骨架＋資料層（V1，取代原本的 SaveStore 方案）
- 照 24 §8 建 `src/net/`（`protocol.ts`、`Transport`、`LocalTransport`：每則訊息 JSON 來回、可設延遲／掉包）、`src/server/`（`GameServer`、handler 路由、`requestId` 冪等快取、`Clock`）、`src/server/repos/`（介面）、`src/server/db/memory`、`src/server/db/local`（IndexedDB；不支援時退回 localStorage 版 KV）、`src/client/GameClient.ts`（型別化 `call`、逾時重送、同一個 requestId）。
- 資料模型照 24 §3（Account／Character／Item／Wallet＋Ledger…）。**舊存檔遷移**：第一次啟動把 `jg_rt_<map>`、`jg_weapon` 等轉成帳號 1／角色 1，轉之前備份到 `jg_backup_<時間>`；遷移有測試（舊格式樣本 → 新資料 → 數值一樣）。
- `src/game/**` 的 `localStorage` 逐檔改成呼叫 `GameClient`（設定、提示看過沒這種純客戶端偏好可以留在 `ClientPrefs`，一樣集中一個檔案）。最後加掃描測試擋 `src/game` 直接用 `localStorage`／`indexedDB`。
- 玩家看得到的：設定裡「匯出／匯入存檔」（伺服器 `account.export`／`account.import`）。
- 驗收：`tests/server-contract/*.test.ts` 同時跑 MemoryDb 與 LocalDb（fake-indexeddb）；通關機器人照舊能通關。

### Q3 規則移到核心 `src/core/meta/`（V2）
- 把「會改存檔的規則」改成純函式：`rollLoot(rng, ctx)`、`buy(state, offer)`、`sell`、`enhance(rng, item)`、`spendSkillPoint`、`applyChoice`… 輸入舊狀態、回傳新狀態＋事件，**不碰 Phaser、不碰資料庫**。由伺服器 handler 呼叫它們、再寫進 Repository；畫面層只看結果。
- 亂數一律傳入 `Rng`（不用全域）。這樣伺服器可以照同一份程式驗證「這次強化真的成功嗎」，防作弊。
- 驗收：`src/game/rt*.ts` 裡沒有規則運算，只剩 UI 綁定；現有 `rt-shop`／`rt-enhance` 等測試改測 core 版本仍全過。

### Q4 效能（V1～V2）
| 熱點 | 現在 | 改成 | 預期 |
|---|---|---|---|
| `separate()` | O(n²) 全圖兩兩比對 | 均勻格子空間雜湊（格寬＝最大直徑），只比相鄰 9 格；**依 id 順序處理保持確定性** | n=80 時從 3,160 對降到約 n×常數 |
| `enemiesOf()`／`units.filter` | 每次配新陣列 | `BattleState` 維護 `alive` 索引（死亡／生成時更新），或傳 callback 迭代 | 每 tick 0 次配置 |
| `nearestEnemy` 等最近搜尋 | 掃全部 | 用同一份空間雜湊 | — |
| 畫面每幀 | 已有 `textColor`／`cdText`（D-217） | 再掃一次每幀 `new`／字串拼接／`Graphics.clear()` 重畫；靜態圖層改 `RenderTexture` 快取 | GC 停頓少 |
- 量測：`tests/rt-perf.test.ts`（無頭跑暴動場景 9,000 tick，印每 tick 平均微秒，CI 只檢查不退化 2 倍以上）；畫面用既有 `src/game/perf` 工具在 Playwright 量 FPS。結果寫進 PROGRESS。

### Q5 拆 `RtBattleScene`（V2～V3）
- 目標：場景本體 **< 1,500 行**，只負責生命週期與把系統接起來。拆成 `src/game/rt/` 底下的系統，每個系統是 class，建構時拿到 `ctx`（scene、state 讀取器、事件匯流排）：
  - `CameraSystem`（跟隨、看一眼 `cameraPeek`、震動）
  - `HudSystem`（血條、技能鍵、小地圖、懸賞板）
  - `BannerSystem`（`bigText`／`pinBanner`／`announce`、避讓規則，現在散在場景與 `fx/bannerStack.ts`）
  - `CombatFxSystem`（技能特效、命中、殘影；讀引擎事件）
  - `WorldRenderSystem`（地面、decor、霧、營火、光門）
  - `InputSystem`（搖桿、點地、按鍵 → `BattleCommand[]`；連線版就是送出去的那一層）
  - `StoryDirector`（序章、記憶卡、相遇、抉擇、通關演出的排隊）
  - `PanelHost`（☰、行囊、行商、技能樹、燼牌、返回鍵）
- 做法：一次搬一個系統、一個 commit；搬之前先跑截圖腳本存基準圖，搬完比對（像素差 > 0.5% 就停下來看）。

### Q6 多玩家＋隊伍引擎（V3）
- `Unit.team`（玩家可以是彼此的敵人）；`BattleState.players: number[]`，`playerOf(s, pid = 0)`；指令改成 `{ pid, cmd }`（單人時自動帶 0，舊呼叫相容）。
- 敵人仇恨改成仇恨表最高者；技能命中判斷改成「打敵對隊伍」。單人 golden hash 必須不變。
- PvP 規則 `src/core/battle/rt/pvp.ts`（24 §6.1：HP ×3、傷害 ×0.5、控制減半與遞減、ilvl 壓縮）；競技場地圖 `maps/arena.ts`（24×24、有掩體）。
- 驗收：`tests/rt-multi.test.ts`（兩個 Bot 一起打狼王）、`tests/rt-pvp-balance.test.ts`（三武器互打各 200 場，勝率 40～60%，報表寫 PROGRESS）。

### Q7 伺服器權威的戰鬥（V5）
- **非同步 PvP 驗證**：伺服器 `pvp.start` 給種子與對手快照 → 客戶端本機打 → `pvp.finish(inputs)` → 伺服器用同一份引擎重跑、比對 hash 決定勝負（作弊的指令紀錄會被抓）。
- **即時對戰 `BattleRoom`**：伺服器每 tick 收指令、`step`、送快照差量；`GameClient` 做本地預測＋校正。本機用兩個 client 經 `LocalTransport`（80ms、2% 掉包）驗收（`tests/pvp-realtime.test.ts`）。
- **PvE 掉落改由伺服器擲**：`battle.start` 拿 battleId＋種子、`loot.claim(battleId, killSeq)`（24 §7），速率檢查。
- 文件：`src/net/README.md`、`src/server/README.md` 寫清楚「換成線上版要做哪 5 件事」（24 §1）。

### Q8 工具與規範（隨時）
- 加 ESLint（`typescript-eslint`、`no-restricted-imports`，邊界照 24 §8：`game` 不准 import `server`／`db`；`server` 不准 import `phaser`／`game`／`client`；`core` 只准 import `core`）。CI 跑 `npm run lint`。
- `src/core/battle/rt/README.md` 與新的 `src/server/README.md`、`src/net/README.md` 寫清楚邊界。

## 3. 新功能（F 系列，D-277 後以交易與 PvP 為主）
| 編號 | 功能 | 為什麼好玩 | 依賴 | 里程碑 |
|---|---|---|---|---|
| F1 | **多角色＋帳號共用倉庫**（3 角色欄、倉庫 40 格、金幣分角色） | Jacky 提過（D-271）；三種武器可以同時養 | Q2、Q3 | V4 |
| F2 | **拍賣所**（24 §4.1）：上架、搜尋篩選、購買、手續費、到期退回；**模擬玩家**會上架和買走你的東西（24 §5） | 刷到別人用得到的裝備可以換錢 → 每件掉落都有價值；也是線上版經濟的試驗場 | Q2、Q3 | V4 |
| F3 | **面對面交易（託管）**：雙方鎖定、雙方確認才交換；對象是模擬玩家或自己的其他角色 | 線上交易的核心流程先在本機跑通 | F2 | V4 |
| F4 | **PvP 競技場・天梯**：非同步對戰模擬玩家的配裝（Bot 操作）、Elo、段位、賽季外觀獎勵（不給數值） | 刷寶有了「打人」的出口；三武器互剋有策略 | Q6、Q7 | V5 |
| F5 | **對戰重播**：PvP 與 Boss 戰存種子＋指令（幾 KB），紀錄頁可以重播；Boss 戰可開「幽靈」 | 確定性的最好展示；PvP 輸了能看自己輸在哪 | Q1、F4 | V6 |
| F6 | （砍單第一順位）怪物圖鑑 | 收集感 | Q2 | V6 |
- 原本的「每日秘境」「成就」「AI 協力夥伴」移到 §6 範圍保護之後（有空才做）。

## 4. 美術改進（A 系列）
| 編號 | 項目 | 方法 |
|---|---|---|
| A1 | **星隕高原怪物＋Boss AI 圖** | ART_REQUESTS R-020（Gemini sheet） |
| A2 | **燼紅裂谷／星隕高原的狼換成各自的圖**（現在 6 種狼都是霧狼染色） | ART_REQUESTS R-021（Gemini sheet）；匯入後 `SPRITE` 改 key、拿掉 tint |
| A3 | **動態光照**：營火、技能、熔岩、星光的點光源＋夜晚暗角（一張低解析度光照 RenderTexture 疊 MULTIPLY/ADD），中階手機可關（設定「特效：高／低」） | 程式 |
| A4 | **地圖天氣與氛圍**：霧語森林飄霧與落葉、荊棘谷花粉、燼紅裂谷灰燼上升、星隕高原流星；跟 decor 共用粒子池 | 程式 |
| A5 | **UI 統一外框**：面板改 9-slice 金邊外框＋標題緞帶，按鈕按下有縮放與光澤；傷害數字字型分級（普通／爆擊／大招） | 程式（canvas 產生材質） |
| A6 | **地面去重複感**：地面加大型噪聲色塊與 decal（落葉、石子、裂縫），避免一格一格的感覺 | 程式 |
- 每一項都要附前後截圖到 PROGRESS；手機效能不能退步（A3／A4 要量 FPS）。

## 5. 里程碑與時程（台北）
| 里程碑 | 日期 | 內容 | 驗收 |
|---|---|---|---|
| **V1 地基** | 11/6–11/7 | Q1 確定性、Q2 本機伺服器骨架＋資料層＋舊存檔遷移、Q4 `separate` 空間雜湊、Q8 ESLint 邊界 | golden hash、core-purity、server-contract、通關機器人全過；舊存檔讀得到 |
| **V2 規則上伺服器** | 11/7–11/8 | Q3 core/meta；商店、強化、技能點、裝備穿脫、掉落全部改走 `GameClient`；**`db/mssql` Kysely 實作＋`game` schema 遷移＋CI mssql 契約測試（25 §5）**；Q5 拆場景（Input／Hud／Banner） | `src/game` 沒有規則運算與 localStorage；截圖比對無差 |
| **V3 隊伍引擎與 PvP 規則** | 11/8–11/9 | Q6、競技場地圖、PvP 平衡模擬；Q5 拆場景繼續 | rt-multi、pvp-balance 過；單人 hash 不變 |
| **V4 交易與多角色** | 11/9–11/10 | F1、F2 拍賣所＋模擬玩家、F3 託管交易；`sim:economy` 報表；SQL 版的交易鎖與並發測試 | 交易契約測試（不會複製物品、不會多扣錢、斷線重送不重複）；7 天模擬物價不暴漲 |
| **V5 PvP 上線（本機）** | 11/10–11/11 | Q7 非同步 PvP 驗證＋天梯 UI（F4）、即時 `BattleRoom` 本機兩客戶端驗收、PvE 掉落改伺服器擲 | 作弊指令紀錄被拒；pvp-realtime 過 |
| **V6 雲端落地** | 11/11–11/12 | `server/main.ts`＋`WsTransport`＋`build:online`（不打包 `src/server`）、Dockerfile、`infra/*.bicep`、`deploy-server.yml`（無 secret 時 skip）、`docs/DEPLOY_AZURE.md`；到圖就換 A1／A2 | 本機 `server/` 整合測試（兩個 WS client 交易＋PvP）；online bundle 掃描沒有伺服器程式碼 |
| **V7 凍結與發表** | ~~11/12 12:00~~ **11/27 12:00 起** | 只修 bug、平衡、README／Wiki、1.2.0；**~~11/13~~ 11/30 12:00 最終版** | CI／Pages／APK 全綠、通關機器人過 |

## 6. 範圍保護（時間不夠時依序砍）
1. 每日秘境、成就、AI 協力夥伴（本來就排在最後）。
2. F6 圖鑑、A6 地面、A5 UI 外框 → 只做傷害數字。
3. F5 對戰重播、美術 A3～A6（D-278 為了後端讓位）→ 有空才做。
4. 即時 PvP `BattleRoom` → **已決定（Jacky 不多花錢，25 §4.3）**：只做協定、伺服器實作與本機測試，預設不部署、不做 UI；上線 PvP＝非同步天梯。
5. Q5 拆場景 → 停在 < 4,000 行。

**不砍**：Q1、Q2、Q3、Q6、F1、F2、F3、F4 非同步天梯（線上版的地基，也是 Jacky 直接指定的方向）。
