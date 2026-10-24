# src/server — 之後可以整包搬去後端的權威邏輯

目前遊戲是純前端（離線 PWA），這個資料夾**現在也跑在瀏覽器裡**，但它的寫法等同後端程式：
之後做連線版時，把整個資料夾搬到伺服器、把前端對它的呼叫從「直接呼叫函式」換成「網路請求」即可，規則本身不用重寫。
決策與理由見 `docs/DECISIONS.md` D-054、`docs/design/13-chatgpt-ideas.md` 題目 3。

## 放什麼
會影響**經濟與公平性**、將來需要由伺服器說了算的邏輯：
裝備實例與詞綴生成、強化與重鑄、掉落與保底、深淵房間與獎勵生成、貨幣與材料的增減、交易（未來）、事件紀錄。

## 不放什麼
場景、動畫、音效、UI、鏡頭、特效、輸入手勢（都在 `src/game/`、`src/audio/`）。
戰鬥規則、燼牌規則等**純規則**在 `src/core/`，可被前端（演出）與後端（驗證）共用，不必搬進來。

## 硬規則（`tests/server-boundary.test.ts` 會檢查，違反就紅燈）
1. 不 import `phaser`、`src/game/**`、`src/audio/**`、`src/i18n/**`。
2. 不用瀏覽器全域：`window`、`document`、`localStorage`、`sessionStorage`、`navigator`。
3. 不直接用 `Math.random()`：一律透過注入的 `RandomProvider`（`ports.ts`）。
4. 不直接用 `Date.now()`／`new Date()`：一律透過注入的 `Clock`。
5. 不直接讀寫存檔：透過注入的 `Repository`（本機版用 localStorage／IndexedDB，之後換資料庫）。
6. 輸入與輸出都是**可序列化的純資料**（物件、陣列、字串、數字；不要傳函式、類別實例、Phaser 物件），這樣才能放進 JSON 網路請求。
7. 每個會改變玩家資產的操作都帶 `operationId`（重複送出不能重複扣料或重複給獎）。
8. 數值與機率放在資料表（`src/data/`）或設定，不寫死在函式裡；結果要附規則版本。

## 前端怎麼用它
前端只透過 `GameApi`（`gameApi.ts`）呼叫：場景與 UI 用 `src/game/session.ts` 匯出的 `gameApi` 與 `opId(kind)`，
不直接 import `src/server` 的內部函式，也不直接改 `inventory`／`gear`／`gold`／`equipment`（`tests/game-api.test.ts` 會檢查）。
現在是 `LocalGameApi`（`localGameApi.ts`，同一個程式裡直接呼叫，埠由 session 注入：`SaveStore`、`KvEventJournal`、`systemClock`），
將來是 `RemoteGameApi`（fetch）。新增會改變資產的功能＝在 `GameApi` 加方法＋在 `LocalGameApi` 實作＋測試。

## 已有的東西（階段 1，D-057）
- `ports.ts`：`RandomProvider`、`Clock`、`EventJournal`、`Repository`
- `gameApi.ts`／`localGameApi.ts`：買賣、換裝、重置技能樹、寶箱、小怪金幣、戰鬥獎勵；回傳 `{ ok, error, duplicate, operationId, rulesVersion, data }`
- 亂數：存檔內的 `GameState.rng`（`src/core/rngStreams.ts`，stream：battle／loot／enhance／abyss／story／ui／ids）
- 裝備實例：`src/core/state/gear.ts`；資料表：`src/data/{rules,affixes,enhancement,lootTables,materials}.ts`
