# 下一步（依優先順序，最上面先做）

> **設計已定稿（D-013）**。序章～終章全部可以玩到結局（三結局；機器人第 4 輪驗證各章）。進度大幅超前 PLAN：接下來是**深度、手感、Boss 機制、打磨**。
> 場景：`src/game/scenes/{Title,Dialogue,Map,Battle,Card}Scene.ts`；全域狀態 `src/game/session.ts`；劇本 `src/data/dialogue/ch0–ch5.ts`；章節地圖 `src/data/maps.ts`（`currentChapter`）；敵人/遭遇 `src/data/combatants.ts`；燼牌 `src/data/cards.ts` + CardScene `OPPONENTS`；美術 `src/game/art/{silhouettes,backdrops,mapArt}.ts`；隊伍面板 `src/game/ui/partyPanel.ts`。
> 除錯入口：`?debug&chapter=2|3|4|5&scene=Map`（建立前一章已完成的新存檔，會覆蓋本機存檔；`&join=serin,liora` 額外加同伴）、`?scene=Battle&enc=rourke_1&party=lian,serin,liora&lv=12`、`?scene=Dialogue&script=ch3&node=academy`、`?scene=Cards&match=tourney_dealer`。

1. **全程通關驗證 + 存檔相容**（最高優先）：機器人從新遊戲一路跑到 `GOAL=ch5_complete`（預計 15–18 分鐘，timeout 給 30）。第 4 輪只做過「新遊戲→ch3_complete」和各章 `?chapter=N` 單章。注意 ch3→ch4→ch5 銜接時的隊伍（伊歐離隊/回歸、洛克）與等級保底。
2. **Boss 特殊機制**（「好玩」與「震撼」的關鍵，D-027 刻意延後）：
   - 瓦爾德蘭階段 2「反燈印」：在我方身上放標記，3 回合內沒用引路之光清掉就引爆（引擎新狀態 + BattleScene 顯示 + 測試）；階段 3「星空舞台」演出（背景翻轉成星空、伊歐歌聲 BGM 變奏）。
   - 蝕星者：階段 2「吞噬記憶」隨機封印一個技能；階段 3「刪除之眼」（新的可攻擊目標，伊歐 HP 持續下降）；階段 4「全員共鳴」可放 10 盞燈的終極共鳴（最華麗的演出）。可以考慮把蝕星者拆成 2–3 段戰鬥（像洛克 D-026）在中間插劇情。
   - 片尾：開發統計彩蛋（遊玩時間、完美次數、燈印總數、偏移值）。
3. **洛克決鬥**：第 4 輪末 ATK 調高（47/49/51），尚未重跑模擬；確認新手勝率仍 ≥ 80%。
4. **第 3 章 BGM/演出**：王都探索曲、洛克決鬥曲（程序音樂 `src/audio/music.ts`）；燼牌大賽加觀眾歡呼音效、冠軍演出。
5. **戰鬥手感**：`fxDamage` 白閃多段攻擊 tint 殘留檢查。（敵人 `ART.glow` 脈動光點第 4 輪已加上）
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
