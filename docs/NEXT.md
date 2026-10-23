# 下一步（依優先順序，最上面先做）

> **設計已定稿（D-013）**。垂直切片（序章 + 第 1 章）已可從頭玩到 `ch1_complete`（自動通關機器人驗證，第 3 輪）。第 2 章資料與地圖已接上（D-022），**還沒有從頭到尾驗證過**。
> 場景：`src/game/scenes/{Title,Dialogue,Map,Battle,Card}Scene.ts`；全域狀態 `src/game/session.ts`；劇本 `src/data/dialogue/ch0.ts, ch1.ts, ch2.ts`；章節地圖資料 `src/data/maps.ts`；設定 `src/game/settings.ts` + `src/game/ui/settingsPanel.ts`。
> 除錯入口：`?scene=Battle&enc=boss_bellworm&party=lian,serin,liora&lv=8`、`?scene=Dialogue&script=ch2&node=bell_hall`、`?scene=Map`、`?scene=Cards&match=liora_intro`，加 `&debug` 掛出 `window.__game`。

1. **第 2 章通關驗證**（最高優先；第 3 輪機器人在新地圖程式下仍通關第 1 章，但停在 `ch1_complete` 旗標當下，尚未看到「第 1 章結尾 → 第 2 章地圖」轉場）：擴充 `scripts/playthrough.mjs`，讓它在 `ch1_complete` 後繼續玩第 2 章直到 `ch2_complete`（地圖會自動切到 ch2）。要跑 4 人隊伍（莉歐拉加入後 party 有 4 人，戰鬥只帶前 3 人）。修所有卡關點。
   - 機器人：`npx vite build --outDir /tmp/claude-0/bot/dist --emptyOutDir`、`python3 -m http.server 4180 -d /tmp/claude-0/bot/dist &`、`(WORKAROUNDS=0 node scripts/playthrough.mjs http://localhost:4180/?debug /tmp/claude-0/bot > log 2>&1 &)`，約 4 分鐘。機器人會關掉 render 加速（`RENDER=1` 可開）。
   - 可以加一個 `?debug&save=ch1done` 類的除錯入口直接從第 2 章開始，省時間。
2. **第 2 章系統缺口**（10 §新系統，挑最有感的）：
   - ~~`blast_bottle` 爆燈瓶道具~~（第 3 輪完成）。
   - 鐘喉蠕蟲階段 3「吞噬星燼」：EnemyDef 不支援 → 引擎加 `drainEmber` 攻擊效果 + 測試。
   - 隊伍替換（地圖 ☰ 旁加「隊伍」頁，選 3 人上場）。
   - 連攜技（P1，時間不夠就砍，見 PLAN 範圍保護）。
3. **戰鬥手感**：`fxDamage` 白閃在多段攻擊時會不會殘留 tint；自動時機開啟時防守提示文字改為「自動防守」。
4. **燼牌打磨**：拖曳出牌、教學局逐步提示（對峙、熄燈）、熄燈獎勵提示、餘燼牌標記更明顯。（放牌前分差預覽已完成）
5. **美術**：連恩對話立繪頭稍小（脖子長）；鎮民 NPC 立繪偏簡單；戰鬥中背影剪影可比照對話立繪升級（`generateCombatantArt`）。
6. **LocationScene（P1）**：熱點畫面（07 §3），酒館/孤兒院兩個代表性地點。
7. **M6 第 3 章**（10/31）：見 PLAN 與 `docs/design/10-story-ch2-final.md`。`chapterCard ch3` 標題已存在。

## 已知技術待辦 / 調整
- 狼王模擬新手勝率 94%（目標 70–85%）；鐘喉蠕蟲新手 1–3%、中等 85%（D-021）。實機手感確認後再調。
- `weakRevealed` 只是顯示用狀態，傷害公式不讀。
- 第 2 章完成後重訪任何第 2 章地點也會回到標題（DialogueScene `finish()`）；第 3 章做好時改成回地圖。
- GitHub Pages 已啟用、部署成功（10/24 第 3 輪起）：https://twjackysu.github.io/JackyGame/ 。CI（含 Playwright 煙霧測試）、Pages、Android APK 全綠。
- 標題「新的旅程」在淡入期間按下的軟鎖：Phaser 的 fadeOut 其實是 force，可能不是真問題；已用 `fadeOutThen()`（`src/game/fx/feel.ts`，逾時保險）統一所有淡出轉場。

## 工具與注意事項
- 截圖：`npm run build`，`npx vite preview --port 4173 &`（記下 PID，用 `kill PID`，**不要 `pkill -f`**，會把自己的 shell 殺掉），`node scripts/screenshot.mjs URL out.png 3000`。headless 只有 ~1fps，別等動畫；`?skipIntro` 跳過標題淡入。一次性截圖腳本放 `screenshots/`（gitignored，才找得到 playwright）。
- 超過 2 分鐘的瀏覽器腳本一定要 `(... > log 2>&1 &)` 背景跑。
- `npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。
- tsconfig 開了 `noUncheckedIndexedAccess` / `noUnusedLocals` / `noUnusedParameters`。
- Phaser 場景重啟（`scene.start`）不會清掉 `this.events` 上的自訂監聽器 → 在 create 註冊前先 `off`，或 SHUTDOWN 時移除（第 3 輪的當機 bug）。
- 子代理（Agent 工具）很適合平行做純邏輯模組／劇本資料／美術；給明確檔案範圍、禁止 git、限時。兩個子代理同一則訊息送出會平行跑。
