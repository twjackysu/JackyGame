# 下一步（依優先順序，最上面先做）

> **設計已定稿（D-013）**。現在做 M0→M1。目標：10/29 垂直切片（序章 + 第 1 章完整可玩）。
> 純邏輯都在 `src/core/`（已完成：cards、state、save、dialogue、battle），接下來重點是**場景與手感**。

1. **M1 BattleScene（最高優先，決定遊戲好不好玩）** `src/game/scenes/BattleScene.ts` + `src/game/fx/*` + `src/game/ui/*`
   - 使用 `src/core/battle/engine.ts`（`createBattle / availableCommands / chooseCommand / resolveTiming / resolveDefense`，回傳 events，依序播放）。
   - 版面照 `docs/design/07-ui-ux.md §5`（上敵下我、行動順序條、4 大按鈕、星燼條）。
   - 時機光環：攻擊時外圈縮到內圈（約 700ms），用 `performance.now()` 對照，`judgeAttack()` 判定。防守：敵人預兆（白/紅/紫光 + 畫面邊緣暈光）→ 收集 tap/swipe/hold 輸入 → `judgeDefense()`。注意 telegraph 事件的 `windowScale`（霧）與 `leadBonusMs`（老兵直覺）由 UI 套用。
   - Game feel：hit-stop、鏡頭震動、白閃、傷害數字彈跳、粒子、完美慢動作、共鳴 5 燈大演出（見 05 §4）。
   - 程式生成角色剪影（連恩提燈、洛克斧槍、伊歐白髮光點）與敵人（狼、蕈、野豬、狼王）— 先做簡單但有邊緣光的版本。
   - 除錯入口：`?scene=Battle&enc=boss_wolfking`（06 §7）。
   - 驗證：`npm run build && npm run screenshot -- 'http://localhost:4173/?scene=Battle&enc=forest_a' screenshots/battle.png` 並 Read 看圖。
2. **手勢**：純邏輯 `src/core/input/gesture.ts`（GestureTracker：tap/swipe/hold，已完成+測試）。在場景中接上 Phaser pointer 事件並每幀呼叫 `update(t)`。
3. **SFX**：05 §6 具名音效已加入 `SFX`（uiTap、hitLight/Heavy、perfect、parry、dodge、break、lampPlace(n)、resonance、cardPlay/Pass、roundWin、levelUp、itemGet、save），BattleScene 直接用。BGM 音序器 `src/audio/music.ts` 已有 `title`、`battle` 兩首（`playMusic(id)`/`stopMusic()`），標題點擊後開始播放；之後補城鎮/森林/Boss/酒館與伊歐主題動機（05 §7）。
4. **M2**：DialogueScene（用 `src/core/dialogue/runner.ts`）、MapScene、LocationScene、自動存檔（`src/core/save/save.ts` 的 `SaveStore` + `detectStorage()`；`visibilitychange` 時存檔）。標題畫面改成「繼續 / 新的旅程 / 設定」。
5. **M3**：CardScene（用 `src/core/cards`：`createMatch / legalActions / applyAction / previewNight / peekAction / chooseAction / chooseTutorialAction`），版面見 07 §6。序章與第 1 章劇本轉成 `src/data/dialogue/ch0.ts, ch1.ts`（08）。

## 已知技術待辦 / 調整
- 戰鬥引擎：`resolve*` 會自動前進到下一位行動者；若 UI 需要在角色間停頓，播放 events 時自己控制節奏即可（不需改引擎）。回溯、靜默、引路之光、老兵直覺、狼王階段 2/霧、野豬撞牆已實作但**沒有測試** → 做 BattleScene 時順手補。
- 狼王模擬新手勝率 94%（目標 70–85%），高手 100%。先做出手感再調；可考慮狼王 HP 460→500 或霧襲頻率提高。
- 燼牌：洛克作弊（騎士保證在起手）模擬勝率 44%，設計預期 ~17%，作弊不夠痛 → 可讓 AI 在第三夜才出騎士、或作弊時多抽 1 張。換座（P1）未實作。
- Pages 部署失敗是因為 Pages 未啟用（等 Jacky，見 FOR_JACKY），**不要再花時間修**。CI（含 Playwright 煙霧測試）與 Android APK 都是綠燈。

## 工具與注意事項
- 截圖：`npm run build`，`npx vite preview --port 4173 &`（記下 PID，用 `kill PID`，不要 `pkill -f`），`node scripts/screenshot.mjs URL out.png 3000`。headless 只有 ~1fps，別等動畫；`?skipIntro` 跳過標題淡入。
- `npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。
- tsconfig 開了 `noUncheckedIndexedAccess`：陣列/Record 索引要處理 undefined。
- 子代理（Agent 工具）很適合平行做純邏輯模組；給明確檔案範圍、禁止 git、限時。
