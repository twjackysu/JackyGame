# src/server：權威伺服器（D-277／278，design/24、25、26）

```
GameServer.handle(json) → parseRequest → Auth.resolve(token) → db.tx( 冪等檢查 → handler → 記住回應 )
```
- `handlers/`：每個命名空間一個檔案，登記在 `handlers/index.ts`；handler 拿 `Ctx`（`accountId`、`r: Repos`、`clock`、`ids`、`rng`、`local`）。規則一律呼叫 `src/core/meta`（行囊 `bag.ts`、行商 `shop.ts`、技能 `skills.ts`），擲骰只用 `ctx.rng`。
- 現有方法：account.*、character.*、migrate.legacy／sync（本機限定）、inventory.equip／unequip／salvage、enhance.do、shop.open／buy／buyGoods／sell／reroll、skills.add／variant／reset。新方法照 `tests/server-contract/inventory-shop.test.ts` 寫契約測試，`fuzz.test.ts` 會自動涵蓋。
- `repos/types.ts`：資料表列與 `Repos`／`Db` 介面（線上版＝`game` schema 的資料表）。
- `db/docDb.ts`：Memory／Local 共用的實作（記憶體快取＋交易暫存層＋互斥鎖，失敗整個回滾）。
- `db/memory/`：測試用。`db/local/`：IndexedDB，沒有就退回 localStorage（`jgdb:` 前綴），再不行只放記憶體。
- 之後：`db/mssql/`（Kysely＋MssqlDialect，`withSchema('game')`，V2）。
- `legacy.ts`：第一期舊存檔 → 角色（`migrate.legacy`，只有 `local: true` 接受）。
- `idempotency.ts`：寫入請求的 `requestId` → 上次回應，存在 `requests` 表 24 小時。

## 換成線上版要做的事（24 §1）
1. 這個資料夾整個放到 Node（`server/main.ts`），`local: false`。
2. 寫 `db/mssql`（介面不變，`tests/server-contract` 共用）。
3. 寫 `WsTransport` 與 WebSocket 入口。
4. `LocalAuth` 換成真的登入（26-security）。
5. 模擬玩家關掉。

## 規則
- 不 import Phaser、`src/game`、`src/client`（`tests/layer-boundary.test.ts` 擋）。
- 只有 `db/local` 可以碰 `localStorage`／`indexedDB`。
- 金錢只能用 `wallets.apply`（寫帳本）；物品移動＝改 `location`，`save` 帶 `version`（樂觀鎖）。
- 時間用 `ctx.clock`、id 用 `ctx.ids`，不要直接 `Date.now()`。
