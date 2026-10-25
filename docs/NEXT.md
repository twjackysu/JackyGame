# 下一步（依優先順序，最上面先做）

> 第 23 輪（10/25 21:00）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋霧語森林／荊棘谷兩張大地圖（D-062／063／065／087／114）。主規格 `docs/design/20-swordsman-and-map.md`。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）。排程 ⭐ 方向對照：自由走動 ✅（大地圖）、自由買賣 ✅（D-116 行商）、自由點技能 ✅（D-110／112）、**戀愛線依 D-063 停止，不做**。README 不放開發日誌，開發紀錄只寫在 PROGRESS。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。

## 現況（第 23 輪）
- 霧語森林：P4 刷寶＋P5＋技能變化＋精英詞綴 ✅。荊棘谷 ✅（D-114／115）。
- **營火行商** ✅（D-116）：`src/game/rtShop.ts`（價格、貨架、帳）、`src/game/ui/rtShopPanel.ts`（買／賣兩頁＋詳情卡）、場景 `openShop()`／`shopBtn`／`coinBase`／`dustBase`。
- 畫面：地面荊棘 `thornFx`／`spawnThorns`／`thornWither`／`drawThorns`（`THORN_ATTACKS`）、Boss 登場 `bossIntro`、目標列 `goalNext`（都在 `RtBattleScene.ts`）。

### 下一輪從這裡開始（依序）
1. **Jacky 有回覆就照他的答案先做**（FOR_JACKY 第 4～8 題）。
2. **行商後續**（小，空檔做）：行商立繪（目前只有台詞；要圖就排 ART_REQUESTS，Gemini）；真人回饋價格後調 `rtShop.ts` 的 `buyPrice` 倍率 4 或 `shopIlvl`（目前 Lv＋1，整合測試 `tests/rt-shop-farm.test.ts` 會印出 Bot 買了幾件）。
3. **新手引導第二輪**（成果發表重點：第一次玩的人 30 秒內知道要做什麼）：第 23 輪已做紅框／黃框／營火的一次性提示（`tipOnce`、`fireHinted`）。還缺：開場說明框（`showHint`）四行字太多、蓋住畫面上方 → 縮成一行「左下拖曳走路・點怪物開打」，其他交給 `tipOnce`（第一次 MP 滿「放大招」、第一次撿到裝備「到營火換上」、第一次升級「☰ 技能點」）。改完用全新 localStorage 截一輪開場確認不會疊字。
4. **荊棘谷第三輪**：會移動的世界精英（例：在棘刺迴廊來回走的「荊棘巡獵者」，需要核心加巡邏路徑 `patrol`；做之前先跑 81 場 stateHash 範本）；狼后難度若 Jacky 說太簡單 → `thornvale.ts` 狼后 `hpPct` 80 → 110。
5. 候選（等 Jacky 回饋）：每個技能第二種變化（三選一）、精英詞綴新招、營火強化失敗降級、第三張地圖。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 160 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）：第 19 輪的範本在 PROGRESS 第 19 輪（含霧語森林與測試大地圖，共 80 場）；寫暫時的 vitest（檔名 `tests/zz-*.test.ts`，已 gitignore；第 21 輪的 `zz-hash` 範本見 PROGRESS 第 19 輪），把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案（共 81 場），`git stash push -- <改過的核心檔>` 前後各跑一次 diff。荊棘谷改動另跑 `tests/rt-thornvale.test.ts`。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 無頭瀏覽器不要用 `scene.update()` 快轉（會讓 Playwright 逾時）；要截演出就在頁面裡直接呼叫場景方法（例：`sc.spawnThorns({...})`、`sc.bossIntro(q)`、`sc.openShop()`），存檔用 `localStorage.setItem('jg_rt_mistwood', ...)` 後 reload。第 23 輪腳本 `screenshots/r23*.mjs`（gitignored）。
- 背景程式一律 `setsid`；不要 `pkill -f`／`pgrep -f ... | kill`（會殺到自己的 shell，第 22 輪又踩到），啟動時 `echo $! > pidfile` 再用 PID 殺。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援；待產 R-013 棘冠狼后（GPT，P1）、R-014 棘背狼（Gemini，P2）、R-012 荊棘母樹（GPT，P2），都有程式備援；GPT 剩 2、Gemini 剩 6（扣掉已排定）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
