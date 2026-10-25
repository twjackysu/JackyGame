# 下一步（依優先順序，最上面先做）

> 第 18 輪（10/25 10:12）整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋霧語森林大地圖（D-062／063／065／087）。主規格 `docs/design/20-swordsman-and-map.md`，實作順序 §B8：P1 核心 ✅、P2 地圖 ✅、P3 Boss ✅、P4 刷寶第一版 ✅ → **P4 收尾＋P5 長期驗證（現在）**。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索，序章到三結局）**保留可玩、不再加功能**；不要刪它的程式。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。

## P4 刷寶 ✅ 第一版（第 18 輪：D-090 等級、D-091 裝備與行囊、D-092 強化與分解）→ 接著做 P4 收尾＋P5
檔案：核心 `src/core/battle/rt/gear.ts`（產生、加成、強化費用）、engine `gearDrops`／`progression`／`setGearBonus`；畫面 `src/game/rtBag.ts`（純函式）、`src/game/ui/rtBagPanel.ts`、`src/game/rtRecord.ts`（錢包 `walletOf`／`spend`、`cleanBag`）；測試 `tests/rt-gear.test.ts`、`rt-progression.test.ts`、`rt-farm-loop.test.ts`（刷 30 分鐘 → 狼王約 170 → 90 秒）。
1. ~~平衡~~：第 18 輪已把裝備數值調到「刷 30 分鐘狼王快約 1.9 倍」（D-091）；等真人回饋再調。
2. **掉落的手感**：撿到裝備時右下 ☰ 加小紅點／「▲」提示（現在只有第一次大字提示＋暫停選單的「行囊 ▲N」）；行囊滿時自動分解最差的普通裝（可在行囊加開關）。
3. **營火旁的捷徑**：站在營火圈內時，畫面上出現「行囊／強化」按鈕（不用開 ☰）。
4. **Bot 示範**也帶著裝備：`?bot=normal` 觀戰時用紀錄裡的等級與裝備（現在 Bot 一律 Lv1 空手）。
5. **P5 長期驗證**（design/20 §B8、C3）：精英與重複狼王的掉落表再分層（狼王第二次以後稀有率提高、首殺保底稀有）、裝備特殊效果（例：重斬冷卻 −1 秒、旋風斬範圍 +20%，用資料驅動的技能參數修改，不寫 switch）、至少 3 種可行配裝、更高難度（狼王「暴怒」版，Lv8 以上解鎖）。

## 其他（P4 空檔再做）
- 小地圖：已開寶箱小點、狼王巢穴骷髏圖示。
- 暫停選單打開時，把還在畫面上的開場大字收掉（無頭截圖會疊；真機 2.6 秒就消失，不急）。
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：第 17 輪新手 Bot 打到狼王 411～767 秒、最多倒 5 次；若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run`（目前 578 項，約 1 分鐘）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）：第 18 輪的暫時測試範本在 PROGRESS 第 18 輪；寫暫時的 vitest，把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案，`git stash -- src` 前後各跑一次 diff。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 背景程式一律 `setsid`；不要 `pkill -f`（會殺到自己的 shell），用 PID。
- 舊主線通關機器人（只有動到舊主線才需要跑）：`npx vite build --outDir /tmp/claude-0/bot/dist --emptyOutDir`、`(setsid python3 -m http.server 4180 -d /tmp/claude-0/bot/dist > /dev/null 2>&1 &)`、`(setsid env GOAL=ch5_complete EXPECT_AFTER=Map WORKAROUNDS=0 node scripts/playthrough.mjs "http://localhost:4180/?debug" /tmp/claude-0/bot/full 25 > log 2>&1 &)`，約 18～20 分鐘。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援。P4 的裝備圖示先用程式畫（形狀＋稀有度外框）。
