# 下一步（依優先順序，最上面先做）

> 第 18 輪（10/25 10:12）整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋霧語森林大地圖（D-062／063／065／087）。主規格 `docs/design/20-swordsman-and-map.md`，實作順序 §B8：P1 核心 ✅、P2 地圖 ✅、P3 Boss ✅ → **P4 刷寶（現在）** → P5 長期驗證。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索，序章到三結局）**保留可玩、不再加功能**；不要刪它的程式。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。

## P4 刷寶（Jacky：「等級、裝備、強化提升後，同一隻狼王應該越打越快」）
全部做在霧語森林（`maps/mistwood.ts`）＋獨立紀錄（`src/game/rtRecord.ts`，`localStorage jg_rt_mistwood`）。**不碰主線 `session` 存檔**。核心改動一律 opt-in（沒設＝不變），改完跑「舊關卡雜湊比對」。
1. **經驗值與等級**（最先做，最快有感）：怪物 `xp` 欄位（野狼 5、小狼 3、射手 6、首領 25、狼王 120 之類）、`StageDefinition.progression` 開啟；升級曲線約 Lv1→10 要 2～3 小時、每級 HP +6%、攻擊 +5%；**升級要在這一場裡立刻生效**（核心事件 `levelUp`，改玩家單位的 maxHp／atk，HP 同比例補）。等級與經驗存進紀錄，下次進來帶著（`createBattle` 已收 `setup.player`，可在畫面層把等級換算進 `PlayerDefinition`）。畫面：HUD 等級＋經驗條、升級金光演出。
2. **裝備掉落**：6 格（武器、頭、身、手、飾品 ×2）；稀有度 普通／精良（藍）／稀有（金）；精英、暴動、Boss 機率較高（design/20 C3 表）。地上掉落物用既有 `loot` 機制擴充成 `item` 類（獨立亂數，不影響戰鬥）；稀有以上有光柱。可重用 `src/server/` 的詞綴與強化邏輯（`enhancement.ts`、`loot.ts`），但存在獨立紀錄裡。
3. **背包與比較**：☰ 加「行囊」：清單、點一件看詳情與「換上後的數值差」、換裝立刻生效（重建玩家數值）、賣掉／分解成粉塵。背包上限 60。
4. **強化**：在營火旁用粉塵／結晶強化裝備（沿用 D-058 成功率表）；現在「撿粉塵武器 +1～+5」（`lootEnhance`，D-082）在霧語森林改成真的強化後就關掉。
5. **驗收**：Bot 也要會自動換裝（取總分高的）；模擬「新手裝 vs 刷 30 分鐘後的裝」打狼王時間，目標明顯變快（例如 5 分 → 2～3 分）。數字寫進 PROGRESS。

## 其他（P4 空檔再做）
- 小地圖：已開寶箱小點、狼王巢穴骷髏圖示。
- 暫停選單打開時，把還在畫面上的開場大字收掉（無頭截圖會疊；真機 2.6 秒就消失，不急）。
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：第 17 輪新手 Bot 打到狼王 411～767 秒、最多倒 5 次；若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run`（目前 561 項）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）：寫暫時的 vitest，把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案，`git stash -- src` 前後各跑一次 diff。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 背景程式一律 `setsid`；不要 `pkill -f`（會殺到自己的 shell），用 PID。
- 舊主線通關機器人（只有動到舊主線才需要跑）：`npx vite build --outDir /tmp/claude-0/bot/dist --emptyOutDir`、`(setsid python3 -m http.server 4180 -d /tmp/claude-0/bot/dist > /dev/null 2>&1 &)`、`(setsid env GOAL=ch5_complete EXPECT_AFTER=Map WORKAROUNDS=0 node scripts/playthrough.mjs "http://localhost:4180/?debug" /tmp/claude-0/bot/full 25 > log 2>&1 &)`，約 18～20 分鐘。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援。P4 的裝備圖示先用程式畫（形狀＋稀有度外框）。
