# src/net：客戶端 ↔ 伺服器的協定（D-277，design/24）

- `protocol.ts`：訊息 `{v, id, method, params, requestId?, token?}` → `{id, ok, result | error}`；`Api` 型別表（新增方法加一行）；`WRITE_METHODS`（必須帶 `requestId`）。
- `views.ts`：伺服器回傳的資料形狀（純 JSON）。資料表的列不外流。
- `Transport.ts`：`send(json, timeoutMs)`，只傳字串。
- `LocalTransport.ts`：本機版，同程式內交給 `GameServer.handle`，可設 `latencyMs`、`dropPct`（請求或回應各自可能掉）。
- 之後：`WsTransport.ts`（V6）。

規則：這個資料夾不 import `core`、`server`、`client`、`game`、Phaser。
