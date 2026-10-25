# 下一步（依優先順序，最上面先做）

> 第 22 輪（10/25 19:00）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋霧語森林大地圖（D-062／063／065／087）。主規格 `docs/design/20-swordsman-and-map.md`，實作順序 §B8：P1～P5 ✅；**第二張地圖荊棘谷 ✅ 第一版（D-114）→ 現在：荊棘谷第二輪內容＋新手引導**。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）：遊戲是霧語森林＋荊棘谷兩張大地圖（共用等級與行囊）。README 不放開發日誌，開發紀錄只寫在 PROGRESS。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。

## 現況（第 22 輪）
- 霧語森林：P4 刷寶＋P5＋技能變化＋精英詞綴 ✅（檔案導覽見 git 歷史第 21 輪 NEXT）。
- **荊棘谷 ✅ 第一版**（D-114）：`src/core/battle/rt/maps/thornvale.ts`（產生器 `scripts/gen-thornvale-draft.py`）、怪物 `thorn_wolf`／`thorn_queen`（`data.ts`）、地形危害 `StageDefinition.hazards`（engine `processHazards`、validate、畫面 `makeGround`／`makeMinimap`）、共用紀錄 `rtRecord` 的 `LINKED_MAPS`／`MAP_KEYS`／`joinRecord`／`splitRecord`／`thornvaleOpen`、懸賞 `BOUNTY_ALIAS`、標題 `TitleScene.showMenu`、場景裡的 `bw`／`mw`（狼王／狼后、森林／山谷）；測試 `tests/rt-thornvale.test.ts`。

### 下一輪從這裡開始（依序）
1. **Jacky 有回覆就照他的答案先做**（FOR_JACKY 第 4～7 題）。
2. **荊棘谷第二輪內容**（缺的依重要性）：
   - 深夜的山谷專屬精英（夜光寶箱 ×2 已做）：用現有立繪染色，例如染紫的狼群首領「夜棘首領」（`spawnGroups` 的 `nightOnly`、`tier: 'elite'`，照霧語森林 `night_shade`）。
   - 荊棘谷的世界精英（像母樹那樣的「刷點」）：現在母樹空地的母樹 hpPct 40；可以考慮第二棵或換成會移動的精英。
   - 狼后演出：「荊棘綻放」已有綠色孢子＋衝擊環＋第一次提示；還可以加命中時地面長出程式畫的荊棘、討伐時荊棘枯萎粒子。
   - 狼后難度：新手 Bot（Lv8＋裝備）85 秒偏快；如果 Jacky 說太簡單，先把 `thornvale.ts` 的狼后 `hpPct` 80 → 110。
3. **新手引導**：☰ 紀錄最上面已有「▶ 下一個目標」（`rtRecord.nextGoal`）。可以再做：畫面上方目標列（`RtBattleScene` 的 `this.goal`，打倒後顯示「✔ 已討伐」）在這場已討伐時改顯示 `nextGoal` 的下一步。
4. 候選（等 Jacky 回饋）：每個技能第二種變化（三選一）、精英詞綴新招、營火強化失敗降級。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 158 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）：第 19 輪的範本在 PROGRESS 第 19 輪（含霧語森林與測試大地圖，共 80 場）；寫暫時的 vitest（檔名 `tests/zz-*.test.ts`，已 gitignore；第 21 輪的 `zz-hash` 範本見 PROGRESS 第 19 輪），把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案（共 81 場），`git stash push -- <改過的核心檔>` 前後各跑一次 diff。荊棘谷改動另跑 `tests/rt-thornvale.test.ts`。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 背景程式一律 `setsid`；不要 `pkill -f`／`pgrep -f ... | kill`（會殺到自己的 shell，第 22 輪又踩到），啟動時 `echo $! > pidfile` 再用 PID 殺。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援；待產 R-013 棘冠狼后（GPT，P1）、R-014 棘背狼（Gemini，P2）、R-012 荊棘母樹（GPT，P2），都有程式備援；GPT 剩 2、Gemini 剩 6（扣掉已排定）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
