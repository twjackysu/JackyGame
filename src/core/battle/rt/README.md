# 即時戰鬥核心（D-063 P1／P2）

純 TypeScript、不依賴 Phaser；畫面層（P3）只能送 `BattleCommand`、讀 `BattleState`。

| 檔案 | 內容 |
|---|---|
| `types.ts` | 型別、單位（1 遊戲單位＝100 整數座標；30 ticks/秒；`sec()`、`u()`）、`SkillDefinition`、`AreaAttack`、狀態規則 |
| `data.ts` | 劍士（design/20 §A6：重斬、旋風斬、衝鋒、格擋反擊＋閃避）、敵人（野狼、小狼、荊棘射手、狼群首領、霧角狼王）、五個原型關卡 |
| `engine.ts` | `createBattle`、`step(state, commands)`、`stateHash`、`computeDamage`、`inShape`、`addStatus` |
| `sim.ts` | `BattleController`、`IdleController`、`ScriptedTestController`、`PlayerBot`（`BOT_PROFILES`：auto／novice／normal／expert）、`simulateBattle`、`batch` |

- 每個 tick 的處理順序固定：輸入 → 玩家 → 敵人（id 順序）→ 分離 → 持續傷害 → 狀態到期 → 勝負。
- 亂數是 xorshift32，狀態存在 `BattleState.rngState`；禁用 `Math.random`（測試會擋）。
- 技能是資料（`hits[]`、`dash`、`block`），引擎不寫 `switch(skillId)`。冷卻從施放開始計。
- 指標報表：`npm run sim:rt`（`RUNS=1000 npm run sim:rt` 可調次數）。
- 驗收測試：`tests/rt-battle.test.ts`（同一場 1,000 次 `stateHash` 一致、輸入重播一致等）。
