# 下一步（依優先順序，最上面先做）

> **設計已定稿（D-013）**。目標：10/29 垂直切片（序章 + 第 1 章完整可玩）。
> 現況（第 2 輪後）：Title → 序章對話 → 教學戰 → 第 1 章地圖 ⇄ 地點對話 ⇄ 戰鬥／燼牌 已全部串通，可以從頭玩到第 1 章結尾。
> 場景：`src/game/scenes/{Title,Dialogue,Map,Battle,Card}Scene.ts`；全域狀態 `src/game/session.ts`；劇本 `src/data/dialogue/ch0.ts, ch1.ts`（`CH1_ENTRIES` 驅動地圖）。
> 除錯入口：`?scene=Battle&enc=boss_wolfking`、`?scene=Dialogue&script=ch1&node=tavern`、`?scene=Map`、`?scene=Cards&match=rourke_official`，加 `&debug` 會把 `window.__game` 掛出來。

1. **完整走一遍第 1 章並修卡關點**（最高優先）：寫一支 Playwright bot（參考第 2 輪做法：`page.evaluate` 直接呼叫場景方法 `issue/finishTiming/onHand/act`，在背景跑並寫 log，headless ~1fps 很慢）從「新的旅程」玩到 `ch1_complete`，記錄任何錯誤／卡住的節點。注意：
   - 第 1 章劇本裡的 `rename`、`shop`、`summary` 事件目前直接 `resume('win')` 跳過 → 至少做「商店」簡單版（買小回復藥/燈油，用 `gold`），`summary` 做章節結算畫面（偏移值、羈絆、聲望變化）。
   - ch1 劇本用到的旗標 `caravan_ambushed`（伏擊：失去第一回合）、`wolfpack_returned`（狼王戰多一隻霧狼）BattleScene 還沒讀。
   - Io 加入後戰鬥立繪/技能都已有；洛克是 guest，最後 `{leave:'rourke'}`。
2. **戰鬥手感**（需要更真實的節奏判斷）：⏩×2 速度按鈕、設定「自動時機」（固定 Good）、敵人預兆期間在畫面下方顯示手勢圖示（👆/👉/✋ 圖形，不只文字）、狼王戰 Boss BGM。檢查 `fxDamage` 的白閃在多段攻擊時會不會殘留 tint。
3. **燼牌打磨**：拖曳出牌、放牌前比分預覽（`peekAction` + `previewNight`）、教學局逐步提示（對峙、熄燈）、熄燈獎勵提示、餘燼牌標記更明顯；AI 作弊強度（NEXT 舊項：洛克作弊勝率 44% vs 設計 17%）。
4. **LocationScene（P1）**：熱點畫面（07 §3）。目前地點直接進對話，若時間夠再做酒館/孤兒院兩個代表性地點。
5. **美術**：角色剪影再精緻一些（瑟琳/伊歐/連恩正面立繪用於對話）、各地點對話背景（目前全部用遺跡迴廊）→ 依 `state.location.node` 換背景（鎮上/酒館/森林/湖）。
6. **M5 第 2 章**（10/30 起）：見 PLAN。

## 已知技術待辦 / 調整
- 狼王模擬新手勝率 94%（目標 70–85%），劇情戰保底 Lv4。實機手感確認後再調（HP 460→500 或霧襲頻率）。
- `weakRevealed` 只是顯示用狀態，傷害公式不讀（測試子代理指出）。
- Pages 部署失敗是因為 Pages 未啟用（等 Jacky，見 FOR_JACKY），**不要再花時間修**。CI（含 Playwright 煙霧測試）與 Android APK 都是綠燈。
- origin URL 已改成 `https://github.com/twjackysu/JackyGame.git`（舊的小寫網址會提示 repo moved）。

## 工具與注意事項
- 截圖：`npm run build`，`npx vite preview --port 4173 &`（記下 PID，用 `kill PID`，不要 `pkill -f`），`node scripts/screenshot.mjs URL out.png 3000`。headless 只有 ~1fps，別等動畫；`?skipIntro` 跳過標題淡入。
- 超過 2 分鐘的瀏覽器腳本一定要 `(... > log 2>&1 &)` 背景跑，否則 Bash 工具會逾時。
- `npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。
- tsconfig 開了 `noUncheckedIndexedAccess` / `noUnusedLocals` / `noUnusedParameters`。
- 子代理（Agent 工具）很適合平行做純邏輯模組／劇本資料；給明確檔案範圍、禁止 git、限時。
