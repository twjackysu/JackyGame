# 23 第二期路線圖（11/6 → 11/13）：新功能、美術、程式品質、連線預備

> 2026-11-06 Jacky：「產品做得不錯，想繼續進度。新目標到 2026/11/13，自行列新功能 PLAN 或美術改進和 Code 品質改進計畫（時間或空間複雜度，或是方便之後變成線上多人連線版的架構寫法），一樣留 FOR_JACKY 給 feedback。」決策 D-276。
> 每一輪選工作時以本文件的里程碑 V1～V7 為主線；`docs/NEXT.md` 是逐輪待辦。**main 永遠要能 build、能從新遊戲玩到通關**；任何重構都不能讓玩家看到的行為變差。

## 0. 原則
1. **先打地基、再加功能**：前兩天做「不改玩法」的重構（存檔、確定性、效能、拆場景），後面的功能（多角色、重播、每日挑戰）才蓋得上去。
2. **連線預備 ≠ 現在做連線**：專案要求完全離線、不使用付費服務，所以 11/13 前**不架伺服器**。目標是讓「之後接上伺服器」只需要寫 transport 和 server，不用重寫遊戲。驗收方式是本機兩份引擎在記憶體裡互傳指令、`stateHash` 一致。
3. **重構要可驗證**：每一步都要有 vitest、通關機器人（`npm run playthrough`）和固定種子 `stateHash` 回歸；畫面層的拆分要附前後截圖。
4. **品質優先於數量**：時間不夠時照 §6 的順序砍。

## 1. 現況盤點（11/6，第 138 輪後）
| 項目 | 現況 | 問題 |
|---|---|---|
| 核心 `src/core/battle/rt/` | 純 TS、30 ticks/秒、xorshift32、`step(state, cmds)`、`stateHash` | 很好的基礎。但 `playerOf(s) = s.units[0]`（84 處假設單人）；`engine.ts` 的扇形命中與重生圍圈用 `Math.asin`／`Math.cos`／`Math.sin`（不同 JS 引擎結果可能差最後一位，lockstep 會分歧） |
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

### Q2 存檔層 `src/save/`（V1）
- `SaveStore` 介面：`get<T>(key, schema)`、`set(key, value)`、`remove`、`keys()`；實作 `LocalSaveStore`（現在）與 `MemorySaveStore`（測試、Bot）。之後的 `RemoteSaveStore` 只要實作同一介面。
- 所有 `localStorage` 呼叫改走 `SaveStore`（`src/game/**` 不准直接用，測試擋）。key 集中在 `src/save/keys.ts`。
- `SaveRoot` 加 `schemaVersion` 與 `migrations[]`（v1＝現在的格式，讀舊存檔自動升級、升級前先備份到 `jg_backup_<時間>`）。
- **玩家看得到的功能**：設定裡「匯出存檔／匯入存檔」（壓成一段文字＋複製；匯入前驗證）。換手機或清快取前可以備份。
- 空間：存檔用短 key、裝備用陣列格式會更省，但先求正確；量一下最大存檔大小寫進 PROGRESS，超過 200KB 再壓。

### Q3 規則移到核心 `src/core/meta/`（V2）
- 把「會改存檔的規則」改成純函式：`rollLoot(rng, ctx)`、`buy(state, offer)`、`sell`、`enhance(rng, item)`、`spendSkillPoint`、`applyChoice`… 輸入舊狀態、回傳新狀態＋事件，**不碰 Phaser、不碰存檔**。畫面層只呼叫它們、再交給 `SaveStore` 存。
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

### Q6 多玩家引擎（V3）
- `BattleState.players: number[]`（unit id），`playerOf(s, pid = 0)`；`BattleCommand` 外包一層 `{ pid, cmd }`（單人時畫面層自動帶 pid 0，舊呼叫相容）。
- 敵人仇恨：從「玩家」改成「仇恨表裡最高的玩家」（傷害＋距離），單人時結果與現在相同（golden hash 驗證）。
- 經驗、掉落改成每位玩家各自擲（連線時誰撿到誰的，不搶寶）。
- 驗收：`tests/rt-multi.test.ts` 兩個 `PlayerBot` 一起打霧語森林狼王，能打倒、不當機；單人 golden hash 不變。

### Q7 連線預備層 `src/net/`（V4）
- `protocol.ts`：訊息型別（`Hello`、`Input{tick,pid,cmds}`、`Snapshot{tick,hash,state?}`、`Ack`），JSON 可序列化、帶版本號。
- `Transport` 介面＋`LoopbackTransport`（記憶體，可模擬延遲與掉包）。
- `LockstepSession`：輸入延遲 N tick、等齊所有玩家輸入才 `step`；每 30 tick 交換 `stateHash`，分歧就記錄。
- 文件 `docs/design/24-online.md`：比較 **lockstep**（2～4 人協力、頻寬小、需要確定性——我們已具備）與 **伺服器權威＋客戶端預測**（人多、防作弊強）；建議路線：協力副本用 lockstep 或「房主權威」，帳號／倉庫／交易用伺服器權威（Q3 的 core/meta 直接在 Node 跑）。列出之後要選的服務（WebSocket 伺服器、帳號、資料庫）與粗估成本，給 Jacky 決定。
- 驗收：`tests/net-lockstep.test.ts`：兩個 client 經 Loopback（100ms 延遲、5% 掉包重送）跑 10,000 tick，每次 hash 一致。

### Q8 工具與規範（隨時）
- 加 ESLint（`typescript-eslint`、`no-restricted-imports`：`src/core` 不准 import `phaser`／`src/game`）。CI 跑 `npm run lint`。
- `src/core/battle/rt/README.md` 與新的 `src/save/README.md`、`src/net/README.md` 寫清楚邊界。

## 3. 新功能（F 系列）
| 編號 | 功能 | 為什麼好玩 | 依賴 | 里程碑 |
|---|---|---|---|---|
| F1 | **多角色＋帳號共用倉庫**（RO 式，最多 3 個角色欄；每個角色有自己的武器、等級、技能點、行囊；倉庫 40 格共用；金幣分角色） | Jacky 11/5 提過（D-271）；三種武器可以同時養，刷到別武器的神裝有地方放 | Q2、Q3 | V4 |
| F2 | **Boss 戰重播與幽靈**：每次打倒 Boss 存下種子＋指令紀錄（幾 KB），在紀錄頁看「最快一次」重播；再打時可開「幽靈」——半透明的自己最佳紀錄一起跑（不參與戰鬥） | 「同一隻狼王越打越快」（Jacky 10/25）有了看得見的對手；也是確定性的最好展示 | Q1、Q2 | V5 |
| F3 | **每日秘境**：用台北日期當種子，從四張圖挑一區＋2～3 個詞綴（怪物狂暴、只能用技能、夜晚、毒霧…），限時通關給一次性獎勵；本機紀錄最佳時間（之後連線就是排行榜） | 每天回來玩一下的理由，適合短時段 | Q3 | V5 |
| F4 | **怪物圖鑑與成就**：打過的怪記錄擊殺數、掉落、弱點；成就 20 個左右（首殺、無傷 Boss、全寶箱…）給稱號 | 長尾目標、收集感；資料大多已有（Wiki 產生器） | Q2 | V6 |
| F5 | （選做，等 Jacky 回覆）**AI 協力夥伴**：用 Q6 的多玩家引擎，讓一個 Bot 當隊友 | 證明多人引擎；但 D-063 說過「單人、不做同伴」，**沒有 Jacky 同意只放在 `?debug`** | Q6 | V6 |

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
| **V1 地基** | 11/6–11/7 | Q1 確定性、Q2 存檔層＋匯出匯入、Q4 `separate` 空間雜湊與 `alive` 索引、Q8 ESLint | golden hash、core-purity、perf 測試、通關機器人全過；舊存檔能讀 |
| **V2 規則下沉＋拆場景（上）** | 11/7–11/8 | Q3 core/meta、Q5 拆 Camera／Hud／Banner／Input | 場景 < 4,000 行；截圖比對無差 |
| **V3 拆場景（下）＋多玩家引擎** | 11/8–11/9 | Q5 其餘系統、Q6 | 場景 < 1,500 行；`rt-multi` 過、單人 hash 不變 |
| **V4 多角色＋連線預備** | 11/9–11/10 | F1 多角色＋共用倉庫（含舊存檔遷移成角色 1）、Q7 `src/net` 與 24-online.md | 舊存檔升級測試；net-lockstep 10,000 tick 一致 |
| **V5 重播與每日秘境** | 11/10–11/11 | F2、F3 | 重播與原戰鬥 hash 一致；每日種子同一天相同 |
| **V6 收集與美術** | 11/11–11/12 | F4、A3～A6，到圖就換 A1／A2 | FPS 不退步；截圖 |
| **V7 凍結與發表** | 11/12 12:00 起 | 只修 bug、平衡、README／Wiki 更新、版本 1.2.0；**11/13 12:00 最終版** | CI／Pages／APK 全綠、通關機器人過 |

## 6. 範圍保護（時間不夠時依序砍）
1. F5 AI 協力夥伴（本來就選做）。
2. A6 地面、A5 UI 外框 → 只做傷害數字。
3. F4 → 只做圖鑑，不做成就。
4. F3 每日秘境 → 只做固定詞綴的「挑戰模式」。
5. Q5 拆場景 → 停在 < 4,000 行（拆最亂的 Banner／Story 就好）。
**不砍**：Q1、Q2、Q3、Q6、F1（這幾個是之後連線版的地基，也是 Jacky 直接提過的）。
