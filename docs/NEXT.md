# 下一步（依優先順序，最上面先做）

> 第 19 輪（10/25 12:10）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋霧語森林大地圖（D-062／063／065／087）。主規格 `docs/design/20-swordsman-and-map.md`，實作順序 §B8：P1 核心 ✅、P2 地圖 ✅、P3 Boss ✅、P4 刷寶 ✅、P5 長期驗證大部分 ✅ → **P5 收尾＋下一個目標（現在）**。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）：遊戲只剩霧語森林。README 不放開發日誌，開發紀錄只寫在 PROGRESS。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。

## P4 刷寶 ✅＋P5 長期驗證（大部分 ✅，第 19 輪）
檔案：核心 `src/core/battle/rt/gear.ts`（產生、加成、特效）、engine `gearDrops`／`progression`／`setGearBonus`／`setSkillMods`／`setBossFury`；畫面 `src/game/rtBag.ts`（純函式，含 `addWithAutoSalvage`）、`src/game/ui/rtBagPanel.ts`、`src/game/fx/gearIcons.ts`（程式繪製裝備圖示）、`src/game/rtRecord.ts`（錢包、`furyUnlocked`）；測試 `tests/rt-gear.test.ts`、`rt-progression`、`rt-farm-loop`、**`rt-p5.test.ts`**（暴怒版＋三種配裝，`FARM_MIN=60` 預設）。
- 已做：等級、裝備、強化、分解（D-090～092）、營火捷徑、☰ 紅點、首殺保底（D-093）、技能特效 cd／dmg（D-094）＋**範圍／格擋判定／衝鋒距離**（D-098）、**暴怒狼王**（D-099）、**行囊滿自動分解、地上好裝備的小地圖／邊緣提示、隱藏精英掉落分層**（D-100）、**裝備圖示**（D-101）。
- 第 19 輪配裝比較（刷 60 分鐘：Lv8、56 件、稀有 18；每件 +3）：全攻擊／全 HP 防禦／冷卻流打一般狼王 51～108 秒、暴怒 119～182 秒，三種都 0 倒（數字在 PROGRESS 第 19 輪）。

### 下一輪從這裡開始（依序）
1. **P5 收尾**：
   - 暴怒版目前 Bot 都沒倒（只是吃藥）。第 19 輪試過「一開打就第二階段」（HP +120%）→ 小狼分散 Bot 注意力、反而受傷更少，已放棄。要更有壓力可考慮：暴怒版專屬新招（例如連續兩次衝鋒、霧中分身），或限制這場藥水數。改之前先跑 `npx vitest run tests/rt-p5.test.ts` 看數字。
   - 「冷卻流」在數值上沒比較強（冷卻特效抽不到夠多）。第 19 輪已做「強化 +7／+10 特效 ×1.25／×1.5」（D-102）；還可以讓特效也能出現在**精良**（數值減半）。
2. **下一個目標**：第 19 輪已做「深夜的森林」（D-103，打倒暴怒狼王解鎖）。之後的候選：
   - 第二位 Boss（例如東邊森林深處的「荊棘母樹」，用現有 thorn_shooter 美術＋程式特效），深夜限定出現也可以。
   - 深夜專屬的東西（例如只在深夜出現的稀有怪、夜光寶箱），讓深夜不只是數值變大。
   - 深夜的畫面再加強：主角周圍的光圈（目前只是整片壓暗）。
3. **營火強化的緊張感**（D-092 刻意溫和）：+6 以上失敗時有 30% 機率「強化值 −1」並在設定提示？——先記在這裡，等 Jacky 回饋「強化太無聊」再做。

## 其他（P4 空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：第 17 輪新手 Bot 打到狼王 411～767 秒、最多倒 5 次；若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run`（目前 127 項，約 1 分鐘）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）：第 19 輪的範本在 PROGRESS 第 19 輪（含霧語森林與測試大地圖，共 80 場）；寫暫時的 vitest，把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案，`git stash -- src` 前後各跑一次 diff。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 背景程式一律 `setsid`；不要 `pkill -f`（會殺到自己的 shell），用 PID。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限：GPT 剩 4、Gemini 剩 7），一律先做程式備援；目前沒有待產項目（D-095）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
