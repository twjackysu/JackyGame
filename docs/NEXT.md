# 下一步（依優先順序，最上面先做）

> 第 25 輪（10/26 00:50）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋霧語森林／荊棘谷兩張大地圖（D-062／063／065／087／114）。主規格 `docs/design/20-swordsman-and-map.md`。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）。排程 ⭐ 方向對照：自由走動 ✅（大地圖）、自由買賣 ✅（D-116 行商）、自由點技能 ✅（D-110／112）、**戀愛線依 D-063 停止，不做**。README 不放開發日誌，開發紀錄只寫在 PROGRESS。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。**程式 commit 和 `[skip ci]` 的文件 commit 不要一起推**（最上面是 [skip ci] 時整次 push 都不跑；第 23 輪最後的程式 commit 531d8f3 因此沒跑 CI，Pages／APK 已用 workflow_dispatch 補跑，CI 會在下一個程式 push 跑到）。

## 現況（第 25 輪）
- 霧語森林：P4 刷寶＋P5＋技能變化＋精英詞綴（D-118 每種詞綴多一招）✅。荊棘谷 ✅（D-114／115）。營火行商 ✅（D-116／D-119 特價／**D-122 為你挑選**：`weakestSlot`＋`shop.pick`）。
- **巡邏**（D-117）：核心 `SpawnGroup.patrol`。荊棘谷「荊棘巡獵者」、深夜森林霧影狼、**霧語森林白天「迷霧巡守」（D-120，`WARDEN_PATROL`，精英狼群區西側）**。畫面 `drawPatroller`／`PATROL_COLOR`。
- **技能變化二**（D-121）：`SKILL_VARIANTS_B`，存檔與 `skillVariants` 寫 `id:b`；`toggleVariant` 三段輪流；`variantIndex`。
- Boss 登場（D-123）：黑邊＋世界壓暗（不推鏡頭）。

### 下一輪從這裡開始（依序）
1. **Jacky 有回覆就照他的答案先做**（FOR_JACKY 第 4～10 題）。
2. **變化二的專屬演出**（第 25 輪疑慮②）：霜旋目前是寒氣環＋閃光、破空斬月是裂地斬的劍氣＋紅光。可以做：霜旋地面結霜（像 `thornFx` 一樣的純畫面陣列，1.5 秒融化）、破空斬月畫一道很寬的白金弧光（`groundSplit` 加寬＋月牙形）、碎甲斬命中時敵人身上碎裂的盾片粒子。都在 `RtBattleScene` 的技能 fx（搜尋「變化二（D-121）」）。
3. **Bot 會用變化二**（選做）：破空斬月是直線，Bot 對 Boss 用起來比星落一閃差（100～133 vs 91～96 秒）；可在 `sim.ts` 讓 ult 是直線時先轉向目標再放。
4. **巡守／巡獵者數值**（等真人回饋）：巡守太硬 → `mist_warden` HP 1050→900 或 `aggroUnits` 4→3；巡獵者 HP 1400→1200。
5. **validateStage 抓巡邏路線的窄縫**（第 25 輪踩到）：沿相鄰巡邏點的直線每 0.25 格取樣，檢查 `pushOutSolid` 半徑 0.6 能不能過（或直接在驗證裡跑 `navToward` 模擬一圈）。
6. 候選（等 Jacky 回饋）：第三張地圖、營火強化失敗降級、行商可以「預訂」指定部位。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 182 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做；`tests/zz-hash.test.ts` 不在 git，新 session 要照範本重寫）：第 24 輪起含荊棘谷共 90 場（荊棘谷用 `level: 6`＋`advanceTo: THORNVALE_QUEEN`、300 秒）；第 19 輪的範本在 PROGRESS 第 19 輪；寫暫時的 vitest（檔名 `tests/zz-*.test.ts`，已 gitignore；第 21 輪的 `zz-hash` 範本見 PROGRESS 第 19 輪），把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案（共 81 場），`git stash push -- <改過的核心檔>` 前後各跑一次 diff。荊棘谷改動另跑 `tests/rt-thornvale.test.ts`。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 無頭瀏覽器不要用 `scene.update()` 快轉（會讓 Playwright 逾時）；要截演出就在頁面裡直接呼叫場景方法（例：`sc.spawnThorns({...})`、`sc.bossIntro(q)`、`sc.openShop()`），存檔用 `localStorage.setItem('jg_rt_mistwood', ...)` 後 reload。第 23 輪腳本 `screenshots/r23*.mjs`（gitignored）。
- 背景程式一律 `setsid`；不要 `pkill -f`／`pgrep -f ... | kill`（會殺到自己的 shell，第 22 輪又踩到），啟動時 `echo $! > pidfile` 再用 PID 殺。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援；待產 R-013 棘冠狼后（GPT，P1）、R-014 棘背狼（Gemini，P2）、R-012 荊棘母樹（GPT，P2）、R-015 荊棘巡獵者（Gemini，P3），都有程式備援；GPT 剩 2、Gemini 剩 5（扣掉已排定）。迷霧巡守（D-120）目前用霧狼圖染青色，沒有排新圖（額度留給 Boss）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
