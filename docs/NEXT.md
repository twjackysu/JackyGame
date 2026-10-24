# 下一步（依優先順序，最上面先做）

> **設計已定稿（D-013）**。序章～終章全部可以玩到結局（三結局＋片尾統計），Boss 都有特殊機制（第 5 輪）；第 6 輪補了 README 截圖、新手引導、省電畫質、二週目。進度大幅超前 PLAN：接下來是**打磨、平衡檢查、成果發表素材**。LocationScene 暫不做（D-033）。
> 場景：`src/game/scenes/{Title,Dialogue,Map,Battle,Card}Scene.ts`；全域狀態 `src/game/session.ts`；劇本 `src/data/dialogue/ch0–ch5.ts`；章節地圖 `src/data/maps.ts`（`currentChapter`、`waiting`）；敵人/遭遇 `src/data/combatants.ts`（`phase2` 字卡、`mark`/`seal`、traits `erase`/`eyeShield`/`finale`）；羈絆 `src/data/bonds.ts` + `src/game/ui/bondPanel.ts`；片尾 `src/game/credits.ts`；燼牌 `src/data/cards.ts` + CardScene `OPPONENTS`；美術 `src/game/art/{silhouettes,backdrops,mapArt}.ts`；音樂 `src/audio/music.ts`（`chapterTrack`）。
> 除錯入口：`?debug&chapter=2|3|4|5&scene=Map`（建立前一章已完成的新存檔，會覆蓋本機存檔；`&join=serin,liora` 額外加同伴）、`?debug&scene=Battle&enc=boss_starfall_2&party=lian,serin,io&lv=17`、`?scene=Dialogue&script=ch3&node=academy`、`?scene=Cards&match=tourney_dealer`。

1. **截通關存檔的「新的旅程」確認框**（三顆按鈕：二週目／覆蓋／取消；需要有 `ch5_complete` 的存檔，可用機器人通關後的頁面或在 console 設 flag 後 `session.save()`）。勝利畫面已確認（README 10-victory）。
2. **README 截圖更新**：燼牌那張是空桌（只有手牌），改成對局中段（可呼叫 CardScene 方法出幾張牌，或 `match=liora_intro` 等幾手 AI）；考慮加一張片尾統計（`getScene('Dialogue').rollCredits()`）與勝利畫面。`node scripts/promo.mjs http://localhost:4180/ screenshots/promoN <名稱,...>` 可以只截指定幾張。
3. **燼牌對局手感**：拖曳出牌若在 AI 回合結束 render 時按住會失效（極少見）。（收藏入牌組的勝率影響已模擬：+0～8%，見 D-031，不用調。）
4. **全員共鳴演出節奏**：fxFinale 約 3 秒，真機前無法確認；可加「點擊加速」。
5. **羈絆事件覆蓋率檢查**：每位同伴羈絆事件（`src/data/bonds.ts`）在劇情中是否都能觸發；機器人跑一次蒐集 `bond_*` 旗標。
6. **蝕星者第二段回合數約 12–13**；真機若仍偏長再降。
7. **效能**：在 swiftshader 下量各場景 draw call／粒子數，找最重的場景（多半是 Battle 的 preFX glow）；省電畫質已可手動/自動開。

## 已知技術待辦 / 調整
- 狼王模擬新手勝率 94%；鐘喉蠕蟲新手偏低（D-021，已有不屈之燈 D-024 補償）；瓦爾德蘭新手會淨化 58%（不屈之燈補償）。
- 第 6 輪全程機器人：第 2 章「翻倒的礦車」力量檢定失敗會重複挑戰（機器人警告但會繼續），不是 bug。
- `weakRevealed` 只是顯示用狀態，傷害公式不讀。
- headless 約 1fps，Phaser 的場景時間跑得比真實時間慢：截演出要等 10–20 秒。
- 燼牌 AI：實測不弱（D-030），不用調。
- CI（含 Playwright 煙霧測試）、Pages、Android APK 第 5 輪全綠（CI 約 3–7 分鐘）。

## 工具與注意事項
- **機器人**：`npx vite build --outDir /tmp/claude-0/bot/dist --emptyOutDir`、`(setsid python3 -m http.server 4180 -d /tmp/claude-0/bot/dist > /dev/null 2>&1 &)`、`(setsid env GOAL=ch5_complete EXPECT_AFTER=Map WORKAROUNDS=0 node scripts/playthrough.mjs "http://localhost:4180/?debug&chapter=5&scene=Map" /tmp/claude-0/bot/ch5 25 > log 2>&1 &)`。從新遊戲（`?debug` 不加 chapter）到結局約 18–20 分鐘；單章約 3–4 分鐘。達成目標後最多等 90 秒（片尾字幕約 30 秒）。
- **背景程式一律用 `setsid`**，否則 Bash 呼叫結束或被殺時 server 會一起死。**不要 `pkill -f`**（會殺到自己的 shell，exit 144）；用 PID。
- 成果發表截圖：`scripts/promo.mjs`（9:16 視窗；標題要加 `skipIntro`，否則 headless 下淡入太慢整張偏暗）。
- 截圖：一次性 Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址要加 `?debug` 才有 `window.__game`。可直接呼叫場景私有方法（例：`getScene('Battle').starStage()`、`playOne({type:'finale',enemy:1,lamps:10})`、`getScene('Dialogue').rollCredits()`；地圖 ♥：找 `children.list` 中 text==='♥' 的物件 `emit('pointerdown')`）。長腳本用 `setsid timeout N node x.mjs &` 再 sleep 輪詢，避免 Bash 逾時把它殺掉。
- 模擬數值：vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。
- `npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess` / `noUnusedLocals` / `noUnusedParameters`。
- Phaser 相機 `zoomTo/pan` 的 ease 只認 EaseMap 名稱（`'Cubic.easeOut'`），不像 tween 會轉換 `'Cubic.Out'`（有測試）。
- 對話選項容器 `ui.list` 前 N 個必須對應選項（機器人依賴），額外 UI 要加在後面。
- Phaser 場景重啟不會清 `this.events` 自訂監聽器 → 註冊前先 `off`。
- 子代理（Agent 工具）會阻塞到完成；先把自己的工作做完或同一則訊息平行派多個。
