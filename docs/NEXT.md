# 下一步（依優先順序，最上面先做）

> 第 18 輪（10/25 10:12）整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋霧語森林大地圖（D-062／063／065／087）。主規格 `docs/design/20-swordsman-and-map.md`，實作順序 §B8：P1 核心 ✅、P2 地圖 ✅、P3 Boss ✅、P4 刷寶第一版 ✅ → **P4 收尾＋P5 長期驗證（現在）**。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）：遊戲只剩霧語森林。README 不放開發日誌，開發紀錄只寫在 PROGRESS。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。

## P4 刷寶 ✅ 第一版（第 18 輪：D-090 等級、D-091 裝備與行囊、D-092 強化與分解）→ 接著做 P4 收尾＋P5
檔案：核心 `src/core/battle/rt/gear.ts`（產生、加成、強化費用）、engine `gearDrops`／`progression`／`setGearBonus`；畫面 `src/game/rtBag.ts`（純函式）、`src/game/ui/rtBagPanel.ts`、`src/game/rtRecord.ts`（錢包 `walletOf`／`spend`、`cleanBag`）；測試 `tests/rt-gear.test.ts`、`rt-progression.test.ts`、`rt-farm-loop.test.ts`（刷 30 分鐘 → 狼王約 170 → 90 秒）。
1. ~~平衡~~：第 18 輪已把裝備數值調到「刷 30 分鐘狼王快約 1.9 倍」（D-091）；等真人回饋再調。
2. **掉落的手感**：☰ 紅點、營火捷徑已做（D-093）。還沒做：行囊滿時自動分解最差的普通裝（行囊加開關）、撿到精良以上時小地圖／畫面邊緣提示。
3. ~~營火捷徑~~ ✅（D-093）。
4. ~~Bot 示範帶裝備~~ ✅（D-093）。
5. **P5 長期驗證**（design/20 §B8、C3）——**下一輪從這裡開始**：
   - 已做：狼王每次進森林第一次保底稀有（D-093）、稀有裝備技能特效「冷卻 −%／傷害 +%」（D-094，`skillMods`）。
   - **更高難度**：狼王「暴怒」版（Lv8 以上或討伐 3 次解鎖，HP／攻擊 +60%、掉落物品等級 +3、稀有率提高），入口放在巢穴旁或暫停選單；核心用新的固定敵人或 `bossZone` 參數，opt-in。
   - **參數型特效**：旋風斬範圍 +%、格擋窗口 +ticks、衝鋒距離 +%（擴 `skillMods` 欄位；`resolveSkillHit` 的 shape 半徑乘上去）。
   - **至少 3 種可行配裝**：寫模擬比較「全攻擊」「全 HP／防禦」「冷卻流（重斬／旋風斬冷卻）」打狼王時間與倒地次數，結果寫進 PROGRESS。
   - 精英（首領）掉落再分層：隱藏精英 `hidden` 物品等級 +2、稀有率 ×2。

## 其他（P4 空檔再做）
- 小地圖：已開寶箱小點、狼王巢穴骷髏圖示。
- 暫停選單打開時，把還在畫面上的開場大字收掉（無頭截圖會疊；真機 2.6 秒就消失，不急）。
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：第 17 輪新手 Bot 打到狼王 411～767 秒、最多倒 5 次；若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run`（目前 579 項，約 1 分鐘）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）：第 18 輪的暫時測試範本在 PROGRESS 第 18 輪；寫暫時的 vitest，把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案，`git stash -- src` 前後各跑一次 diff。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 背景程式一律 `setsid`；不要 `pkill -f`（會殺到自己的 shell），用 PID。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限：GPT 剩 4、Gemini 剩 7），一律先做程式備援；目前沒有待產項目（D-095）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
