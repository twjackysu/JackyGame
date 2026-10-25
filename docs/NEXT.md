# 下一步（依優先順序，最上面先做）

> 第 27 輪（10/26 04:50）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋**三張大地圖**（霧語森林→荊棘谷→燼紅裂谷，D-062／063／065／087／114／125）。主規格 `docs/design/20-swordsman-and-map.md`。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）。排程 ⭐ 方向對照：自由走動 ✅（大地圖）、自由買賣 ✅（D-116 行商）、自由點技能 ✅（D-110／112／121）、卡牌小遊戲 ✅（D-127 營火燼牌）、**戀愛線依 D-063 停止，不做**。README 不放開發日誌，開發紀錄只寫在 PROGRESS。
> **加地圖的方法**（D-124）：`src/game/worldMaps.ts` 加一筆（稱呼、配色、decor、next）＋ `maps/<id>.ts`（產生器在 `scripts/gen-*-draft.py`）＋敵人資料＋ `SPRITE`；`tests/rt-world-maps.test.ts` 會自動檢查。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。**程式 commit 和 `[skip ci]` 的文件 commit 不要一起推**（最上面是 [skip ci] 時整次 push 都不跑；第 23 輪最後的程式 commit 531d8f3 因此沒跑 CI，Pages／APK 已用 workflow_dispatch 補跑，CI 會在下一個程式 push 跑到）。

## 現況（第 27 輪）
- 三張大地圖（霧語森林→荊棘谷→燼紅裂谷）、營火行商、巡邏精英、技能變化二都在；**營火燼牌**（D-127：行商面板「燼牌」分頁，核心 `src/core/cards/emberCards.ts`、畫面 `src/game/ui/emberCardPanel.ts`，戰績與贏來的牌存 `localStorage jg_cards`）。
- 第 27 輪另外做了：熔核巡者 HP 2600＋測試（D-128）、噴發口燒死回饋（`ventKill`）、熔核巡者／黑曜首領倒下大字、標題新地圖 NEW 脈動（`jg_map_seen_<id>`）、環境粒子 `src/game/fx/ambient.ts`（`decor` 決定種類，深夜森林換螢火蟲）。

### 下一輪從這裡開始（依序）
1. **Jacky 有回覆就照他的答案先做**（FOR_JACKY 第 4～12 題）。
2. **燼牌第二輪**（第 27 輪已補：放牌／天候音效、斥候與天候說明、牌飛進桌面動畫）：
   - 戰號可以吹在空排（點數 0 也能出，等於浪費一張）：要嘛 `legalMoves` 禁止「兩排都沒牌時出戰號」，要嘛詳情說明提醒。
   - 莫托 AI 很單純（`aiMove`）：若真人覺得太好贏，讓他第一局更願意早點放棄、保留斥候到第二局。
   - 擴充候選（等 Jacky）：每張地圖一個對手（例：荊棘谷的獵人）、自己組牌。
3. **燼紅裂谷**：岩王仍偏簡單（Bot 不倒）——真人回饋前先不加強。燼鬃狼／黑曜首領仍是染色狼＋火焰鬃毛（ART_REQUESTS 額度只剩 GPT 1、Gemini 4，先不排）。
4. **巡守／巡獵者數值**（等真人回饋）：巡守太硬 → `mist_warden` HP 1050→900 或 `aggroUnits` 4→3；巡獵者 HP 1400→1200。
5. 候選（等 Jacky 回饋）：營火強化失敗降級、行商可以「預訂」指定部位、燼牌每張地圖一個對手／自己組牌、第四張地圖（11/1 之後再考慮）。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 211 項，約 1～2 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）——**第 26 輪起的做法**：範本存在 `scripts/zz-hash.template.ts.txt`（90 場），複製成 `tests/zz-hash.test.ts`；`git worktree add /tmp/claude-0/old <本輪開頭 commit>`＋`ln -s $PWD/node_modules /tmp/claude-0/old/node_modules`，兩邊各跑一次（`HASH_OUT=/tmp/claude-0/hash-old.txt` / `hash-new.txt`）再 `diff`，最後 `git worktree remove --force`。以下是舊說明：（`tests/zz-hash.test.ts` 不在 git，新 session 要照範本重寫）：第 24 輪起含荊棘谷共 90 場（荊棘谷用 `level: 6`＋`advanceTo: THORNVALE_QUEEN`、300 秒）；第 19 輪的範本在 PROGRESS 第 19 輪；寫暫時的 vitest（檔名 `tests/zz-*.test.ts`，已 gitignore；第 21 輪的 `zz-hash` 範本見 PROGRESS 第 19 輪），把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案（共 81 場），`git stash push -- <改過的核心檔>` 前後各跑一次 diff。荊棘谷改動另跑 `tests/rt-thornvale.test.ts`。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 燼牌面板的座標：容器在 (360,640)，頁面座標＝`(gx×390/720, 75.5＋gy×390/720)`（390×844 視窗）；手牌第 i 張 x＝(i%6−(n−1)/2)×110。莫托的回合在無頭瀏覽器要等 15～25 秒（delayedCall 是遊戲時間），太早點會點到停用的按鈕。腳本 `screenshots/r27d.mjs`（gitignored，新 session 要照這段重寫）。
- 短命特效（冰晶 1.9 秒、荊棘）在無頭瀏覽器截不到：包住畫圖函式、每幀把 `born` 拉回來（第 25 輪 `screenshots/r25e.mjs`）。
- 無頭瀏覽器不要用 `scene.update()` 快轉（會讓 Playwright 逾時）；要截演出就在頁面裡直接呼叫場景方法（例：`sc.spawnThorns({...})`、`sc.bossIntro(q)`、`sc.openShop()`），存檔用 `localStorage.setItem('jg_rt_mistwood', ...)` 後 reload。第 23 輪腳本 `screenshots/r23*.mjs`（gitignored）。
- 背景程式一律 `setsid`；不要 `pkill -f`／`pgrep -f ... | kill`（會殺到自己的 shell，第 22 輪又踩到），啟動時 `echo $! > pidfile` 再用 PID 殺。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援；待產 R-013 棘冠狼后（GPT，P1）、R-014 棘背狼（Gemini，P2）、R-012 荊棘母樹（GPT，P2）、R-016 燼心岩王（GPT，P2）、R-015 荊棘巡獵者（Gemini，P3）、R-017 熔渣史萊姆（Gemini，P3），都有程式備援；**GPT 剩 1、Gemini 剩 4**（扣掉已排定）。迷霧巡守（D-120）目前用霧狼圖染青色，沒有排新圖（額度留給 Boss）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
