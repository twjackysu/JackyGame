# 下一步（依優先順序，最上面先做）

> **設計已定稿（D-013）**。序章 → 第 1 章 → 第 2 章 → 第 3 章都可以從頭玩到尾（機器人驗證，第 4 輪）。進度大幅超前 PLAN（M6 第 3 章原訂 10/31）。
> 場景：`src/game/scenes/{Title,Dialogue,Map,Battle,Card}Scene.ts`；全域狀態 `src/game/session.ts`；劇本 `src/data/dialogue/ch0–ch3.ts`；章節地圖 `src/data/maps.ts`（`currentChapter`）；敵人/遭遇 `src/data/combatants.ts`；燼牌 `src/data/cards.ts` + CardScene `OPPONENTS`；美術 `src/game/art/{silhouettes,backdrops,mapArt}.ts`；隊伍面板 `src/game/ui/partyPanel.ts`。
> 除錯入口：`?debug&chapter=2|3&scene=Map`（建立前一章已完成的新存檔，會覆蓋本機存檔；`&join=serin,liora` 額外加同伴）、`?scene=Battle&enc=rourke_1&party=lian,serin,liora&lv=12`、`?scene=Dialogue&script=ch3&node=academy`、`?scene=Cards&match=tourney_dealer`。

1. **M7 第 4 章「星核」**（見下方第 2 項細節，現在是最高優先）。
   - 附註（第 4 輪後段查過）：機器人「永遠出第一張可出的牌」在第 3 章連贏大賽三場，但無頭模擬中同樣的天真出牌對五位對手只有 21–26% 勝率、完美 AI 玩家 41–59% → AI 不算弱，該次多半是運氣（CardScene 每局隨機種子）。若之後機器人多次連勝再查 CardScene 與模擬的差異（例如手牌排序讓「第一張」剛好是強牌）。
2. **第 4 章細節**（研究院地下，Lv 13–16）：見 `docs/design/10-story-ch2-final.md` §第 4 章。比照第 3 章做法：
   - 先自己定好契約（地點/旗標/遭遇/燼牌 id），**同一則訊息**派兩個子代理（劇本 `ch4.ts`+測試、美術），自己做資料接線（`combatants.ts`、`maps.ts` ch4 + `currentChapter`、`session.ts` SCRIPTS、DialogueScene `ENCOUNTER_LEVEL_FLOOR`/finish/PORTRAIT、MapScene 背景、BootScene `?chapter=4`）。
   - 依 3-5 選擇分歧：`exposed_valderan`（正面突破）/ `double_agent`（內應潛入）；`rourke_turned` / `rourke_lost`；`tourney_champion`。
   - Boss 瓦爾德蘭 3 階段：階段 2「反燈印」（3 回合內用引路之光清掉，否則引爆）需要引擎新機制 + 測試；階段 3「星空舞台」大演出。
   - 第 4 章結尾 `chapterCard` 'ch5'；MapScene 目標列 `ch4_complete` 文字。
3. **洛克決鬥偏簡單**：模擬新手 100%。考慮 `boss_rourke_1` ATK 42→48、或第 3 段加紅光連段；保持說服是主要解法。
4. **第 3 章 BGM/演出**：王都探索曲、洛克決鬥曲（程序音樂 `src/audio/music.ts`）；燼牌大賽加觀眾歡呼音效、冠軍演出。
5. **戰鬥手感**：`fxDamage` 白閃多段攻擊 tint 殘留檢查；敵人 `ART.glow`（美術已提供）在戰鬥中沒畫出來，比照英雄加上。
6. **燼牌打磨**：拖曳出牌、教學局逐步提示、熄燈獎勵提示、餘燼牌標記；收藏（`s.cards`，如「星冠」）影響出戰牌組（P1）。
7. **LocationScene（P1）**、羈絆 UI（P1）。
8. 終章（M8，11/02）：蝕星者、3 結局、後日談。

## 已知技術待辦 / 調整
- 狼王模擬新手勝率 94%；鐘喉蠕蟲新手偏低（D-021，已有不屈之燈 D-024 補償）。
- `weakRevealed` 只是顯示用狀態，傷害公式不讀。
- headless 約 1fps，Phaser 的場景時間跑得比真實時間慢：截演出要等 10–20 秒。
- CI（含 Playwright 煙霧測試）、Pages、Android APK 第 4 輪全綠（CI 約 12 分鐘）。

## 工具與注意事項
- **機器人**：`npx vite build --outDir /tmp/claude-0/bot/dist --emptyOutDir`、`python3 -m http.server 4180 -d /tmp/claude-0/bot/dist &`、`(GOAL=ch3_complete EXPECT_AFTER=Map WORKAROUNDS=0 node scripts/playthrough.mjs "http://localhost:4180/?debug&chapter=3&scene=Map" /tmp/claude-0/bot/ch3 25 > log 2>&1 &)`。從新遊戲到第 3 章完結約 7–8 分鐘（`?debug` 不加 chapter）。單章約 3–4 分鐘。
- 截圖：一次性 Playwright 腳本放 `screenshots/`（gitignored，才找得到 playwright），`executablePath: '/opt/pw-browsers/chromium'`。可透過 `window.__game.scene.getScene('X')` 直接呼叫場景私有方法（例：`openPanel('skill')`、`codexBurn('rourke_betrayal')`）。
- `vite preview` 用 PID 殺，**不要 `pkill -f`**（會殺到自己的 shell）。
- `npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess` / `noUnusedLocals` / `noUnusedParameters`。
- Phaser 場景重啟不會清 `this.events` 自訂監聽器 → 註冊前先 `off`。
- 子代理（Agent 工具）即使 `run_in_background` 也會阻塞到完成；先把自己的工作做完或同一則訊息平行派多個。給明確檔案範圍、禁止 git、限時。
