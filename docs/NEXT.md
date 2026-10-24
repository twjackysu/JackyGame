# 下一步（依優先順序，最上面先做）

> **設計已定稿（D-013）**。序章～終章全部可以玩到結局（三結局＋片尾統計），Boss 都有特殊機制（第 5 輪）。進度大幅超前 PLAN：接下來是**探索深度、新手引導、真機手感、成果發表素材**。
> 場景：`src/game/scenes/{Title,Dialogue,Map,Battle,Card}Scene.ts`；全域狀態 `src/game/session.ts`；劇本 `src/data/dialogue/ch0–ch5.ts`；章節地圖 `src/data/maps.ts`（`currentChapter`、`waiting`）；敵人/遭遇 `src/data/combatants.ts`（`phase2` 字卡、`mark`/`seal`、traits `erase`/`eyeShield`/`finale`）；羈絆 `src/data/bonds.ts` + `src/game/ui/bondPanel.ts`；片尾 `src/game/credits.ts`；燼牌 `src/data/cards.ts` + CardScene `OPPONENTS`；美術 `src/game/art/{silhouettes,backdrops,mapArt}.ts`；音樂 `src/audio/music.ts`（`chapterTrack`）。
> 除錯入口：`?debug&chapter=2|3|4|5&scene=Map`（建立前一章已完成的新存檔，會覆蓋本機存檔；`&join=serin,liora` 額外加同伴）、`?debug&scene=Battle&enc=boss_starfall_2&party=lian,serin,io&lv=17`、`?scene=Dialogue&script=ch3&node=academy`、`?scene=Cards&match=tourney_dealer`。

1. **成果發表 README（提前打底）**：用 Playwright 截 6–8 張代表畫面（標題、地圖、戰鬥時機光環、共鳴、燼牌、羈絆面板、星空舞台、全員共鳴）存到 `docs/screenshots/`（PNG 壓到 <300KB，總量 <2MB；第 5 輪試截發現 12 秒時畫面還在淡入，要等 25 秒以上或改呼叫場景方法後再截；`screenshots/promo.mjs` 可當起點），README 加截圖區與功能清單、開發時間軸（PROGRESS 每輪一行）、統計（輪數、commit 數 `git log --oneline | wc -l`、測試數）。
2. **新手引導總檢**：新遊戲前 5 分鐘再走一遍（截圖）：教學戰提示、第一次地圖、第一次燼牌（已有逐步提示）、第一次選項檢定。把提示不足的地方補上；設定裡「自動時機」要在第一次防守失敗時提示可以開。
3. **LocationScene（P1）或地點熱點**：目前地圖節點點下去直接進對話。可考慮「地點畫面＋2–3 個熱點（人物/調查/商店）」只做在城鎮（灰燈鎮、王都）提升探索感；工作量大，先評估。
4. **全員共鳴演出節奏**：真機確認 fxFinale 約 3 秒是否太長（finale 後技能鈕脈動提示已加）。
5. **蝕星者第二段回合數約 12–13**（已微調眼 HP 280、核心 DEF 15）；真機若仍偏長再降。
6. **燼牌收藏影響出戰牌組（P1）**：`s.cards`（如「星冠」）加入玩家牌組；牌組畫面。
7. **戰鬥手感**：多段攻擊白閃殘留檢查（`fxDamage`）；拖曳出牌若在 AI 回合結束 render 時按住會失效（極少見）。
8. 低畫質模式（粒子減量）＋效能檢查（中階手機 60fps）。

## 已知技術待辦 / 調整
- 狼王模擬新手勝率 94%；鐘喉蠕蟲新手偏低（D-021，已有不屈之燈 D-024 補償）；瓦爾德蘭新手會淨化 58%（不屈之燈補償）。
- 第 5 輪全程機器人無卡住（獵人小屋「⋯」修正後）。
- `weakRevealed` 只是顯示用狀態，傷害公式不讀。
- headless 約 1fps，Phaser 的場景時間跑得比真實時間慢：截演出要等 10–20 秒。
- 燼牌 AI：實測不弱（D-030），不用調。
- CI（含 Playwright 煙霧測試）、Pages、Android APK 第 5 輪全綠（CI 約 3–7 分鐘）。

## 工具與注意事項
- **機器人**：`npx vite build --outDir /tmp/claude-0/bot/dist --emptyOutDir`、`(setsid python3 -m http.server 4180 -d /tmp/claude-0/bot/dist > /dev/null 2>&1 &)`、`(setsid env GOAL=ch5_complete EXPECT_AFTER=Map WORKAROUNDS=0 node scripts/playthrough.mjs "http://localhost:4180/?debug&chapter=5&scene=Map" /tmp/claude-0/bot/ch5 25 > log 2>&1 &)`。從新遊戲（`?debug` 不加 chapter）到結局約 18–20 分鐘；單章約 3–4 分鐘。達成目標後最多等 90 秒（片尾字幕約 30 秒）。
- **背景程式一律用 `setsid`**，否則 Bash 呼叫結束或被殺時 server 會一起死。**不要 `pkill -f`**（會殺到自己的 shell，exit 144）；用 PID。
- 截圖：一次性 Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址要加 `?debug` 才有 `window.__game`。可直接呼叫場景私有方法（例：`getScene('Battle').starStage()`、`playOne({type:'finale',enemy:1,lamps:10})`、`getScene('Dialogue').rollCredits()`；地圖 ♥：找 `children.list` 中 text==='♥' 的物件 `emit('pointerdown')`）。長腳本用 `setsid timeout N node x.mjs &` 再 sleep 輪詢，避免 Bash 逾時把它殺掉。
- 模擬數值：vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。
- `npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess` / `noUnusedLocals` / `noUnusedParameters`。
- Phaser 場景重啟不會清 `this.events` 自訂監聽器 → 註冊前先 `off`。
- 子代理（Agent 工具）會阻塞到完成；先把自己的工作做完或同一則訊息平行派多個。
