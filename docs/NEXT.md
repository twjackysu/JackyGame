# 下一步（依優先順序，最上面先做）

> 第 21 輪（10/25 16:55）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋霧語森林大地圖（D-062／063／065／087）。主規格 `docs/design/20-swordsman-and-map.md`，實作順序 §B8：P1 核心 ✅、P2 地圖 ✅、P3 Boss ✅、P4 刷寶 ✅、P5 ✅ → **下一個目標（現在）**。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）：遊戲只剩霧語森林。README 不放開發日誌，開發紀錄只寫在 PROGRESS。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。

## P4 刷寶 ✅＋P5 ✅＋技能變化／精英詞綴 ✅（第 21 輪）
檔案：核心 `src/core/battle/rt/gear.ts`、engine（`gearDrops`／`progression`／`setGearBonus`／`setSkillMods`／**`skillDef`／`setSkillVariants`**／`setBossFury`／**`applyAffix`**）、`data.ts`（**`SKILL_VARIANTS`**）、`types.ts`（**`aggroUnits`／`aggroUnitsOf`、`ELITE_AFFIXES`、`eliteAffixes`**）；畫面 `src/game/rtBag.ts`、`ui/rtBagPanel.ts`、`fx/gearIcons.ts`、`rtRecord.ts`（錢包、`furyUnlocked`、`skills`、**`variants`**、`bounty`）、`rtBounty.ts`、`rtSkills.ts`（**`cleanVariants`／`toggleVariant`**）＋`ui/rtSkillPanel.ts`；測試 `rt-gear`、`rt-progression`、`rt-farm-loop`、`rt-p5`、`rt-thorn-mother`、`rt-night-chest`、`rt-bounty`、`rt-skills`、**`rt-variants`、`rt-affix`**。
- 第 21 輪已做：母樹仇恨 5 格＋Bot 繞過不會動的精英（D-111）、技能變化五招（D-112）、精英詞綴（D-113）、五招都有專屬演出（裂地斬地裂劍氣、龍捲旋風、流星衝落地爆炸、不動架勢金色護罩、星落一閃光柱）。

### 下一輪從這裡開始（依序）
1. **Jacky 有回覆就照他的答案先做**（FOR_JACKY 第 4～6 題：下一個目標、暴怒難度、變化招喜好）。
2. **Bot 會用變化招**（目前 Bot 照原本規則施放：龍捲只在身邊有 2 隻以上才放、不會利用「邊轉邊走」）：在 `sim.ts` 的技能段落看 `skillDef(s, id).moveFactor >= 1` 時，旋轉中往目標走；裂地斬用 `useRange` 4 格已經會遠距離放。改完跑 `rt-variants` 看流星衝＋不動架勢那組的時間（118～197 秒，變異大）。
3. **下一個目標候選**（Jacky 沒回就自己選一個，記 DECISIONS）：
   - 第二張地圖（例如「荊棘谷」：母樹成為那張圖的真 Boss；核心 `bossZone` 一張圖一個，換圖就能有新 Boss）。需要：地圖產生器 `scripts/gen-mistwood-draft.py` 改一份、霧語森林北端出口＋標題入口／傳送、獨立紀錄共用等級與行囊。**建議下一輪就開始做**（內容量是成果發表最缺的），先做地圖草稿＋validateStage＋Bot 走得到 Boss，再接畫面。
   - 每個技能第二種變化（三選一）——等 Jacky 回饋。
   - 精英詞綴加新招（例如狂暴精英血量低於 30% 進入連續撲咬），或深夜精英雙詞綴。
   - 營火強化的緊張感（+6 以上失敗 30% 強化值 −1）——等 Jacky 回饋「強化太無聊」再做。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 148 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）：第 19 輪的範本在 PROGRESS 第 19 輪（含霧語森林與測試大地圖，共 80 場）；寫暫時的 vitest（檔名 `tests/zz-*.test.ts`，已 gitignore；第 21 輪的 `zz-hash` 範本見 PROGRESS 第 19 輪），把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案，`git stash -- src` 前後各跑一次 diff。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 背景程式一律 `setsid`；不要 `pkill -f`（會殺到自己的 shell），用 PID。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援；待產只有 R-012 荊棘母樹（GPT，P2，有程式備援）；GPT 剩 3（扣掉已排定）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
