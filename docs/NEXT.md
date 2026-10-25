# 下一步（依優先順序，最上面先做）

> 第 24 輪（10/25 22:55）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋霧語森林／荊棘谷兩張大地圖（D-062／063／065／087／114）。主規格 `docs/design/20-swordsman-and-map.md`。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）。排程 ⭐ 方向對照：自由走動 ✅（大地圖）、自由買賣 ✅（D-116 行商）、自由點技能 ✅（D-110／112）、**戀愛線依 D-063 停止，不做**。README 不放開發日誌，開發紀錄只寫在 PROGRESS。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。**程式 commit 和 `[skip ci]` 的文件 commit 不要一起推**（最上面是 [skip ci] 時整次 push 都不跑；第 23 輪最後的程式 commit 531d8f3 因此沒跑 CI，Pages／APK 已用 workflow_dispatch 補跑，CI 會在下一個程式 push 跑到）。

## 現況（第 24 輪）
- 霧語森林：P4 刷寶＋P5＋技能變化＋精英詞綴（**D-118 起每種詞綴多一招**）✅。荊棘谷 ✅（D-114／115）。營火行商 ✅（D-116，**D-119 今日特價**；營火旁站著程式美術的旅商 `src/game/fx/merchant.ts`）。
- **巡邏**（D-117）：核心 `SpawnGroup.patrol`（`patrolStep`、巡邏怪不進 Boss 區域）。荊棘谷「荊棘巡獵者」（`STALKER_PATROL`）、深夜森林霧影狼（`SHADE_PATROL`）。畫面 `drawPatroller`（凡是 `x.patrol` 都畫仇恨圈＋視線扇形，顏色 `PATROL_COLOR`）、`drawPaws`（腳印共用陣列，`pawLast` 每隻一份）。
- 畫面：地面荊棘 `thornFx`、Boss 登場 `bossIntro`、目標列 `goalNext`、一次性提示 `tipOnce`（開場 3.8 秒內不出）。

### 下一輪從這裡開始（依序）
1. **Jacky 有回覆就照他的答案先做**（FOR_JACKY 第 4～9 題）。
2. **巡獵者數值**（等真人回饋）：太硬 → `data.ts` `thorn_stalker` HP 1400→1200 或 `aggroUnits` 5→4。
3. **Boss 登場 HUD 跟著放大**（第 23 輪疑慮③）：做法是加一台 UI 相機（`this.cameras.add`），每幀把 depth ≥ 48 的物件給 UI 相機、其他給主相機（`cam.ignore`）；世界座標的飄字（depth 790）要留在主相機。風險中等，做之前先截圖比對。或乾脆把 `zoomTo(1.08)` 拿掉、只留黑邊。
4. **詞綴招式數值**：真人體感後調 `AFFIX_ATTACKS`（data.ts）；堅韌震地若太痛 150 → 120。
5. 候選（等 Jacky 回饋）：每個技能第二種變化（三選一）、營火強化失敗降級、第三張地圖、更多巡邏怪（例：霧語森林白天的「迷霧巡守」，要先確認新手 Bot 時間）。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 160 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）：第 24 輪起含荊棘谷共 90 場（荊棘谷用 `level: 6`＋`advanceTo: THORNVALE_QUEEN`、300 秒）；第 19 輪的範本在 PROGRESS 第 19 輪；寫暫時的 vitest（檔名 `tests/zz-*.test.ts`，已 gitignore；第 21 輪的 `zz-hash` 範本見 PROGRESS 第 19 輪），把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案（共 81 場），`git stash push -- <改過的核心檔>` 前後各跑一次 diff。荊棘谷改動另跑 `tests/rt-thornvale.test.ts`。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 無頭瀏覽器不要用 `scene.update()` 快轉（會讓 Playwright 逾時）；要截演出就在頁面裡直接呼叫場景方法（例：`sc.spawnThorns({...})`、`sc.bossIntro(q)`、`sc.openShop()`），存檔用 `localStorage.setItem('jg_rt_mistwood', ...)` 後 reload。第 23 輪腳本 `screenshots/r23*.mjs`（gitignored）。
- 背景程式一律 `setsid`；不要 `pkill -f`／`pgrep -f ... | kill`（會殺到自己的 shell，第 22 輪又踩到），啟動時 `echo $! > pidfile` 再用 PID 殺。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援；待產 R-013 棘冠狼后（GPT，P1）、R-014 棘背狼（Gemini，P2）、R-012 荊棘母樹（GPT，P2）、R-015 荊棘巡獵者（Gemini，P3），都有程式備援；GPT 剩 2、Gemini 剩 5（扣掉已排定）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
