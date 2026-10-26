# 下一步（依優先順序，最上面先做）

> 第 30 輪（10/26 11:00）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋**四張大地圖**（霧語森林→荊棘谷→燼紅裂谷（結局）→星隕高原（通關後挑戰），D-062／063／065／087／114／125／138）。主規格 `docs/design/20-swordsman-and-map.md`。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）。排程 ⭐ 方向對照：自由走動 ✅（大地圖）、自由買賣 ✅（D-116 行商）、自由點技能 ✅（D-110／112／121）、卡牌小遊戲 ✅（D-127～139 營火燼牌，五位對手）、碰到場景觸發劇情 ✅（D-134 序章、D-137 前世的記憶、D-133 通關演出）、**戀愛線依 D-063 停止，不做**。README 不放開發日誌，開發紀錄只寫在 PROGRESS。
> **加地圖的方法**（D-124）：`src/game/worldMaps.ts` 加一筆（稱呼、配色、decor、next、`postGame`）＋ `maps/<id>.ts`（產生器在 `scripts/gen-*-draft.py`）＋敵人資料＋ `SPRITE`＋ 3 段記憶（`memories.ts`，測試會要求）；`tests/rt-world-maps.test.ts`／`memories.test.ts` 會自動檢查。新 decor 要處理：地面 `paint`（`starD` 範例）、`Ambient` kind、`drawVents`／vent 事件顏色。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。**程式 commit 和 `[skip ci]` 的文件 commit 不要一起推**（最上面是 [skip ci] 時整次 push 都不跑）。

## 現況（第 30 輪）
- 四張大地圖：霧語森林→荊棘谷→燼紅裂谷（打倒岩王＝通關演出）→ **星隕高原**（通關後的挑戰地圖，`postGame`，建議 Lv14＋裝備；墜星＝vents 換皮；Boss 星骸守望者 8200／41；白天巡邏精英彗星巡者）。
- 營火行商、巡邏精英、技能變化二、營火燼牌（五位對手：莫托／薇菈／葛倫／隱藏的伊妲／星隕高原的索爾；四張寶箱燼牌）。
- 有頭有尾：序章 → 12 段前世的記憶（每張圖 3 段）→ 通關演出（`FINALE_MAP = 'emberrift'`）。☰ 紀錄有「下一個目標」＋等級不夠提示（`levelTip`）。
- **截圖注意**：新的 localStorage 會先播序章——Playwright 腳本先 `localStorage.setItem('jg_prologue_seen','1')`；開放星隕高原要 `jg_rt_emberrift = {"bossKills":1}`。preview 網址是 `http://localhost:4173/?debug`（不是 /JackyGame/）。傳送玩家：`window.__rt.state().units[0].x/y = …`（格×100＋50）。要截墜星：把 `s.tick` 設成下一次落星前 26 tick，每 0.5 秒截一張（第 30 輪 `screenshots/r30e.mjs`，gitignored）。
- 通關機器人 `tests/rt-campaign.test.ts`（新存檔→三個 Boss，不含星隕高原）。
- **stateHash 基準換了**：第 30 輪 Bot 修正（D-141）讓 camp_clearing 4 場不同；下一輪比對請用第 30 輪最後的 commit 當舊版。

### 下一輪從這裡開始（依序）
1. **Jacky 有回覆就照他的答案先做**（FOR_JACKY 第 4～15 題）。
2. **星隕高原第二輪（擇一或都做）**：
   - 星光碎片已做（D-141）。可再加：守望者第二階段「召喚墜星」（在玩家腳下追加 1～2 個臨時落點，核心要加臨時 vent）；Bot 會不會去撿碎片（現在不會，只影響數據）。
   - 深夜的高原專屬：深夜限定巡邏精英或夜光寶箱提示文字（目前沿用通用的夜光寶箱提示；`night` 已設）。
   - 守望者／魔像的程式美術再精緻一點（現在近看是晶石塊），或在 ART_REQUESTS 排一張（GPT 剩 1，要先問 Jacky——已寫在 FOR_JACKY 第 15 題）。
3. **打磨期（11/4 起功能凍結）之前的檢查**：手機效能（四張圖都開環境粒子＋晶簇材質，看 `GROUND_CHUNK` 材質數量）、標題六顆按鈕在小螢幕的排版、README 截圖是否需要重拍。
4. **巡守／巡獵者數值**（等真人回饋）：巡守太硬 → `mist_warden` HP 1050→900；巡獵者 HP 1400→1200。岩王若 Jacky 說太難 → 回 6000／35（D-136）；守望者若太難 → 8200→7400（D-138）。
5. 候選：慢動作在暴怒刷 Boss 時嫌拖 → 只在第一次討伐或暴怒時放；燼牌：只看不切換的組牌模式；新武器類型（雙手斧、弓）——工作量大，先寫設計。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 242 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）——**第 26 輪起的做法**：範本存在 `scripts/zz-hash.template.ts.txt`（90 場），複製成 `tests/zz-hash.test.ts`；`git worktree add /tmp/claude-0/old <本輪開頭 commit>`＋`ln -s $PWD/node_modules /tmp/claude-0/old/node_modules`，兩邊各跑一次（`HASH_OUT=/tmp/claude-0/hash-old.txt` / `hash-new.txt`）再 `diff`，最後 `git worktree remove --force`。以下是舊說明：（`tests/zz-hash.test.ts` 不在 git，新 session 要照範本重寫）：第 24 輪起含荊棘谷共 90 場（荊棘谷用 `level: 6`＋`advanceTo: THORNVALE_QUEEN`、300 秒）；第 19 輪的範本在 PROGRESS 第 19 輪；寫暫時的 vitest（檔名 `tests/zz-*.test.ts`，已 gitignore；第 21 輪的 `zz-hash` 範本見 PROGRESS 第 19 輪），把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案（共 81 場），`git stash push -- <改過的核心檔>` 前後各跑一次 diff。荊棘谷改動另跑 `tests/rt-thornvale.test.ts`。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 燼牌模擬：寫 `tests/zz-cardsim.test.ts`（gitignored）跑 `newCardGame(seed, [deck, who.deck], who.short)`＋`aiMove(g, side, who)` 400 場看勝率；調牌組時**先看斥候張數**（影響最大）。面板有除錯鉤子：`sc.menu.getData('reveal')('hero_echo')`、`sc.menu.getData('burn')([[0,0,'bear']])`（`sc = __game.scene.getScene('RtBattle')`，先 `sc.openCards()`）。
- 燼牌面板的座標：容器在 (360,640)，頁面座標＝`(gx×390/720, 75.5＋gy×390/720)`（390×844 視窗）；手牌第 i 張 x＝(i%6−(n−1)/2)×110。莫托的回合在無頭瀏覽器要等 15～25 秒（delayedCall 是遊戲時間），太早點會點到停用的按鈕。腳本 `screenshots/r27d.mjs`（gitignored，新 session 要照這段重寫）。
- 短命特效（冰晶 1.9 秒、荊棘）在無頭瀏覽器截不到：包住畫圖函式、每幀把 `born` 拉回來（第 25 輪 `screenshots/r25e.mjs`）。
- 無頭瀏覽器不要用 `scene.update()` 快轉（會讓 Playwright 逾時）；要截演出就在頁面裡直接呼叫場景方法（例：`sc.spawnThorns({...})`、`sc.bossIntro(q)`、`sc.openShop()`），存檔用 `localStorage.setItem('jg_rt_mistwood', ...)` 後 reload。第 23 輪腳本 `screenshots/r23*.mjs`（gitignored）。
- 背景程式一律 `setsid`；不要 `pkill -f`／`pgrep -f ... | kill`（會殺到自己的 shell，第 22 輪又踩到），啟動時 `echo $! > pidfile` 再用 PID 殺。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援；待產 R-013 棘冠狼后（GPT，P1）、R-014 棘背狼（Gemini，P2）、R-012 荊棘母樹（GPT，P2）、R-016 燼心岩王（GPT，P2）、R-015 荊棘巡獵者（Gemini，P3）、R-017 熔渣史萊姆（Gemini，P3），都有程式備援；星隕高原的守望者／魔像（程式美術）沒有排圖（額度不夠，FOR_JACKY 第 15 題問 Jacky）；**GPT 剩 1、Gemini 剩 4**（扣掉已排定）。迷霧巡守（D-120）目前用霧狼圖染青色，沒有排新圖（額度留給 Boss）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
