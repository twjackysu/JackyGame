# 即時戰鬥核心（D-063 P1／P2）

純 TypeScript、不依賴 Phaser；畫面層（P3）只能送 `BattleCommand`、讀 `BattleState`。

| 檔案 | 內容 |
|---|---|
| `types.ts` | 型別、單位（1 遊戲單位＝100 整數座標；30 ticks/秒；`sec()`、`u()`）、`SkillDefinition`、`AreaAttack`、狀態規則 |
| `data.ts` | 劍士（design/20 §A6：重斬、旋風斬、衝鋒、格擋反擊＋閃避）、敵人（野狼、小狼、荊棘射手、狼群首領、霧角狼王）、五個原型關卡 |
| `engine.ts` | `createBattle`、`step(state, commands)`、`stateHash`、`computeDamage`、`inShape`、`addStatus` |
| `path.ts` | 可走格、`clearLine` 視線／身體寬度、**流場** `flowField`（D-074，追擊共用）、`nextWaypoint` 沿流場＋拉直路徑；`findPath`（A*，保留給路徑預覽） |
| `sim.ts` | `BattleController`、`IdleController`、`ScriptedTestController`、`PlayerBot`（`BOT_PROFILES`：auto／novice／normal／expert）、`simulateBattle`、`batch` |

- 每個 tick 的處理順序固定：輸入 → 玩家 → 敵人（id 順序）→ 分離 → 持續傷害 → 狀態到期 → 勝負。
- 亂數是 xorshift32，狀態存在 `BattleState.rngState`；禁用 `Math.random`（測試會擋）。
- 技能是資料（`hits[]`、`dash`、`block`），引擎不寫 `switch(skillId)`。冷卻從施放開始計。
- 指標報表：`npm run sim:rt`（`RUNS=1000 npm run sim:rt` 可調次數）。
- 驗收測試：`tests/rt-battle.test.ts`（同一場 1,000 次 `stateHash` 一致、輸入重播一致等）。
- **MP 與大招**（D-068）：上限 100、開場 0；造成直接傷害 +1、受傷 +2、格擋成功 +5（`SWORDSMAN.mpGain`）。只有大招 `blade_storm`（劍刃風暴）耗 MP；試玩鍵位還沒放，Bot 用 `{ ...BOT_PROFILES.expert, ult: true }` 開啟。
- **HP 藥水**（D-069）：`{ type: "potion" }`，30% 最大 HP、冷卻 15 秒、攜帶 20、瞬間不打斷動作；Bot 用 `potionAtPct` 開啟。
- 報表另有「普攻／技能／反擊」傷害占比（design/20 C3 目標：普攻 35～45%、技能 45～55%）。
- 畫面層：`src/game/scenes/RtBattleScene.ts`（鏡頭、立繪、刀光、命中停頓都只在畫面層，不影響模擬結果；D-067）。
- **障礙物格**（D-070）：`Arena.solid = { cell, rows }`，`'#'` 不可通行；所有位移經 `clampArena` 推出並沿邊滑動，衝鋒撞到算撞牆。五個試玩關卡目前沒放障礙物。
- **尋路與視線**（D-071）：有 `solid` 時，敵人追擊與玩家自動追擊在直線被擋時走 A*；敵人非衝鋒攻擊需要視線（隔石衝鋒照樣會撞暈）。沒有障礙物的關卡完全不走這段。
- **點地移動**（D-071）：`{ type: "moveTo", x, y }`；搖桿 `move` 或 `target` 取消，`stop` 不取消；點石頭或走不到無效；最多 10 秒。
- **地圖怪**（D-072）：`StageDefinition.mapAi` 開啟後敵人待機（`mode: idle`），進仇恨半徑＋看得到、或被打到才進戰鬥，3 單位內同伴連鎖；超過最大追擊或脫戰等待就 `returning`（不吃傷害），回原位回滿。參數 `AGGRO_RULES`（design/20 B1）。目前只有第六關「碎石林道」開啟。
- **自然恢復**（D-073）：`regen`（預設＝`mapAi`）關卡，5 秒沒受傷沒出手且沒有戰鬥中的怪 → 每秒 2%。地圖怪關卡的自動追擊只找戰鬥中的怪（待機的要點它）。Bot `restUntilPct` 休息到指定血量才拉下一組。
