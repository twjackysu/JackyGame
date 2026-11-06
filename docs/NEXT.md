# 下一步（依優先順序，最上面先做）

> **第二期（11/6～11/13，D-276／277）**：方向是**單機模擬線上版、以交易與 PvP 為主**（架構 `docs/design/24-online-architecture.md`）；主線是 `docs/design/23-v2-roadmap.md` 的里程碑 V1～V7，每輪照它選工作。11/13 12:00 最終版 1.2.0；11/12 12:00 起功能凍結。
> **後端（D-278）**：Node.js＋TypeScript、Azure Container Apps、**與 JackyAIStudio 共用 Azure SQL，遊戲資料全放既有的小寫 `game` schema（`dbo` 是 JackyAIStudio 的，絕不碰；`game` 裡已有 8 張舊原型表 Battles／Pets／PetSkills／PetTalents／Players／Skills／Species／Talents，Jacky 會自己刪，遷移絕不 DROP／ALTER、不重名）**，資料存取用 Kysely，連線用環境變數 `GAME_DB_CONNECTION_STRING`（ADO.NET 格式，開發用 LocalDB，Jacky 之後自己換）。規格 `docs/design/25-azure-backend.md`、**資安 `docs/design/26-security.md`（敏感邏輯只在後端）**。迴圈只寫程式／測試／Bicep，不建立雲端資源。
> 遊戲現況：單人即時動作戰鬥＋四張大地圖（霧語森林→荊棘谷→燼紅裂谷（結局）→星隕高原（通關後））、三把武器、技能樹、行商、強化、燼牌、相遇與抉擇。主規格 `docs/design/20-swordsman-and-map.md`，索引 `docs/design/README.md`。
> **重構鐵律**：玩家看得到的行為不能變。每一步都跑 `npm run typecheck`、`npm run build`、`npx vitest run`（含通關機器人）；動到畫面就附前後截圖。**改了數值要 `npm run wiki`**（D-273）。
> **加地圖的方法**（D-124）：`src/game/worldMaps.ts` 加一筆＋ `maps/<id>.ts`（產生器 `scripts/gen-*-draft.py`）＋敵人資料＋ `SPRITE`＋ 3 段記憶（`memories.ts`）。

## ★ 第 145 輪起先做（V4 交易畫面＋多角色、V5 收尾，11/7–11/10）
**已經有的（到第 144 輪）**：`src/core/meta/`（`shop`、`bag`、`skills`、`cards`、`choices`、`market`、`pvpRank`、**`trade`**）；伺服器 handler：`inventory.*`、`enhance.do`、`shop.*`、`skills.*`、`migrate.sync`、`cards.*`、`story.choose`、`market.*`、`pvp.start/finish/ladder`、**`trade.open/offer/lock/confirm/cancel/get`（D-300）**；模擬玩家 `src/server/sim/`；拍賣所畫面；隊伍引擎；PvP：`pvp.ts`（**相剋表 `vsPct`，D-298**）、`pvp_arena`、`pvpMatch.ts`；**競技場畫面 `src/game/scenes/PvpScene.ts`＋`src/game/pvpOps.ts`（D-299）**；遷移 `0001`、`0002_market`、**`0003_trade`**。
1. CI（含 mssql job）每輪開頭看一次；第 144 輪最後一個程式 commit 是「交易畫面」（67ae81c）。遷移 0003 在 SQL Server 上已經綠（b830b7b 的 mssql job）。
2. ~~交易對象＝模擬玩家~~：第 144 輪做完（`trade.partners`、`SimMarket.respondTrade`、`GameServer.simTrade`；只做「收購」：你放物品它出價。你只放金幣想「買」它不會回應——之後可以讓它從行囊放一件價格最接近的）。
3. ~~交易畫面~~：第 144 輪做完（行商面板「交易」分頁，`src/game/ui/tradePanel.ts`＋`src/game/tradeOps.ts`）。小改進：交易中途離開面板，下次打開會回到對象清單（伺服器的交易還開著、30 分鐘後過期退回）→ 可以加「進行中的交易」列表（`trade.mine`）；模擬冒險者「賣」給你。
4. **多角色（F1，不砍，下一個最優先）**：3 角色欄、帳號共用倉庫 40 格（location `warehouse`）、金幣分角色；`character.create/delete/select`；過渡期舊 key 只對應「目前角色」——先寫 DECISIONS 再動。
5. **競技場收尾**：(a) `pvp.finish` 頻率限制（26-security；V6 `server/main.ts` 一起）；(b) 模擬玩家的段位分現在是固定的（`simRating` 照 tier）→ 讓它們每天彼此打幾場（用 `hashSeed(sim, day)` 決定勝負、Elo 更新存在 sim 角色的 `pvpRating`）；(c) 結算畫面加「看重播」（F5，紀錄已經有，`replayPvp` 就能重跑）；(d) 對手立繪偏紅不明顯（法杖圖幾乎看不出），可以改成腳下紅圈加粗＋名字底色。
6. **Q5 拆 HUD**（範圍保護 #5）、**V5 `loot.claim`**、**V6 `server/main.ts`＋Bicep**。

**交易注意（第 144 輪）**：
- 截圖腳本思路（/tmp，沒進 repo）：LS 設 `jg_prologue_seen`、`jg_weapon`、`jg_rt_mistwood`（coin、bag、equip、bossKills）→ `?debug&scene=RtBattle&stage=mistwood` → `sc.openTrade()` → 用 `sc.menu.list` 找文字物件 emit `pointerdown`（列是 Rectangle，找同一個 y 的）；每步前 `__game.loop.sleep()` 等 4 秒再 `wake()`（第一次 `trade.partners` 要 9 秒：模擬玩家補跑）。
- 舊 key 只看 bag／equip：放進交易的物品在舊 key 會暫時消失，取消後回來（`mirrorRecord`）。

**競技場注意（第 144 輪）**：
- 截圖：`npx vite preview --port 4173` → `http://localhost:4173/?scene=Pvp`（大廳；`?debug` 才有 `window.__game`）。無頭瀏覽器第一次 `pvp.ladder`／`pvp.start` 要 5～9 秒（模擬玩家建角色＋每次寫入 300 ms）。「開始對戰」按鈕在 720 座標 (210, GAME_HEIGHT−220)。場景狀態 `__game.scene.getScene('Pvp').phase`：lobby → loading → intro → fight → judging → result。
- 平衡報表：`RT_REPORT=1 npx vitest run tests/rt-pvp-balance.test.ts --silent=false`；測試有 30～70% 護欄，**改 PvE 數值（武器、技能）後如果它紅了，調 `PVP.vsPct`，不要動 PvE**。
- Bot 改了（`kiteDir`、衝鋒條件）→ 進行中的 PvP 對局重跑結果會變（對手是 Bot）；一局最多 30 分鐘，影響不大。

**PvP／多人注意（第 143 輪）**：
- 單人（`s.others` 沒有）一定走原本的路徑——golden hash（`tests/rt-golden-hash.test.ts`）、`rt-perf` 基準、通關機器人都要不變；多人才走 `playersOf`／`foesOf`。
- `playersOf` 單人時回傳共用的陣列（不配置），**不要在迴圈裡再呼叫它**。
- 等級經驗 `s.prog` 只算主角；PvP 配裝不算等級（D-297）。
- 伺服器的 PvP 對局與段位分在角色列 `pvpMatch`／`pvpRating`（不是 story）；`account.export` 還沒帶這兩個欄位。
- 26-security 的頻率限制（pvp.finish 重跑一場要 CPU）在 V6 `server/main.ts` 做。

**拍賣所／模擬玩家注意（第 143 輪）**：
- 模擬玩家**只在 `market.browse`／`market.mine` 時補跑**（`GameServer.handle` 的 `SIM_TRIGGER`）；任何會呼叫這兩個的新畫面，都要像 `marketOps` 一樣在同一個 `legacyOp` 裡 authoritative 寫回錢包，不然模擬玩家買走掛單的收入會被下一次 `migrate.sync` 蓋掉。
- 無頭瀏覽器第一次打開拍賣所要 5 秒左右（30 個模擬玩家建角色＋24 個動作 × 300 ms／寫入）；腳本裡 `__game.loop.sleep()` 等 4～5 秒再 `wake()`。Node 量測三種 DB 第一次補跑 9～28 ms。
- 截圖腳本 `screenshots/r143.mjs`（gitignored）：`node screenshots/r143.mjs screenshots '["拍賣所","wait5000","鐵劍","購買","wait3000","上架","皮甲","上架！","wait3000"]'`，`VP='{"width":360,"height":640}'` 換尺寸；步驟是按鈕文字（用 CLICK 規則），`waitN` 會睡迴圈等 N 毫秒。`r143b.mjs` 檢查 ☰ 開關時懸賞板藏／還原。

**過渡期注意（D-285）**：
- 新的面板動作一律：`const before = captureLegacy();` **在本機存檔之前**拿，然後 `legacyOp(before, ['items'|'wallet'|'skills'|'shop'], op, viewOf, authoritative?)`。忘了這個順序會「做兩次」。
- 驗證方法：Playwright 跑完動作後比對「舊 key 算出來的錢包／行囊」和 `client.call('character.list')`，以及 `opStatus`（`done`／`error`／`diverged` 都要合理；在頁面裡用場景原始碼找出 `legacyOps` 模組網址再 import，見 PROGRESS 第 141 輪）。
- **無頭瀏覽器裡每次寫入要 300 ms 左右**（Phaser 軟體繪圖吃滿事件迴圈），等結果至少等 2.5 秒；`__game.loop.sleep()` 後是 1～3 ms。
- CI mssql job：契約測試檔案**不能平行**（共用同一個資料庫），新測試的 GameClient `timeoutMs` 給 15000。

**之後**：V5 PvP 天梯（`pvp.start/finish` 伺服器重跑、模擬玩家的配裝當對手）＋ `loot.claim`（舊 key 退場）、V6 `server/main.ts`＋Bicep。**V6 照零額外費用原則（D-279 補充、25 §4.3）**：ghcr.io、單一 API 縮到 0、上線 PvP 只有非同步天梯（HTTP），即時 BattleRoom 寫好但預設不部署。

**美術**：Jacky 產好 R-020／R-021 推進 `art-inbox/` 後，`node scripts/import-art.mjs`（切格設定已在 `scripts/art-sheets.json`）→ `RtBattleScene.ts` 的 `SPRITE` 表把 `star_sentinel`／`crystal_golem`／`star_wolf`／`ember_wolf`／`magma_stalker`／`obsidian_alpha`／`eclipse_wolf` 改用新 key、拿掉 `tint`；確認原圖**面朝右**。

**FOR_JACKY**：「想聽你意見的」四題（交易綁定範圍、PvP 獎勵、多角色、GPT 額度），他回了就照他的改計畫。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。CI 的 Smoke test 有時要 13 分鐘（第 37 輪；卡在 `playwright install --with-deps` 的 apt），job 上限 15 分鐘——若之後開始逾時，再考慮快取瀏覽器或拿掉 `--with-deps`。**程式 commit 和 `[skip ci]` 的文件 commit 不要一起推**（最上面是 [skip ci] 時整次 push 都不跑）。

## 現況（第 108 輪）
- **D-256**：燼牌下注贏到新牌後 0.45 秒內離開 → 揭曉動畫改由場景 `announce` 補「得到新牌「X」」。驗證腳本思路：LS 設 `jg_prologue_seen`／`jg_weapon`／`jg_rt_mistwood={coin:999}`，`?debug&scene=RtBattle&stage=mistwood`，`sc.openCards(true)`→`menu.getData('start')(true)`→`getData('end')(0)`→點「回營火」；新存檔會被開場教學（tipBusy）擋約 25 秒才講，正常。
- **D-255**：燼牌面板 `CardCtx.announce`——面板已關時公告改由場景 `announce(text, color, 0, maxWait)` 補講（`announce` 多 `maxWait`，預設 12 秒）。**面板裡延遲出現的公告**都照這樣，不要 `if (!root.active) return` 直接丟掉。
- **D-254**：面板（行囊、行商）放在場景上、不在 root 裡的短命特效字（depth 990～995）要在 `root.once('destroy')` 收掉——**新的面板特效字也照這樣**（行囊用 `keepFx(...)` 登記）。從 ☰ 開的行囊按「完成」會立刻回 ☰。
- **面板按鈕的模擬點擊**（第 106 輪）：很多按鈕是底下矩形可點、字不可點。`CLICK=(l)=>{找 sc().menu 裡 text.includes(l) 的可見 Text t；若 t.input 就用 t，否則在 sc().menu.list 找 input 且寬 < 700、getBounds() 包含 t 世界座標、面積最小的 h}；h.emit('pointerdown',{},0,0,{stopPropagation(){}})`。存檔裝備：`{"uid","slot":"weapon","rarity":2,"ilvl":5,"name","base":{"atk":20},"affixes":[],"enh":7}` 放 `jg_rt_<map>.bag`，`dust`/`crystal` 也放在同一筆。
- **D-253**：`menuBanners` 在 `editing`（調整按鈕位置）時也藏置中大字／`zoneTexts`／說明框／`topCard`，HUD 類（懸賞板、箭頭距離字）照常顯示。模擬拖曳：`sc().editDown/editMove/editUp({x,y,isDown:true})`。**快轉截圖的相機 fadeIn 不會前進**（醒來黑幕截圖是假象）。
- **D-252**：面板開著時 `menuBanners` 也藏 `arrowLabels`／`gateArrow`／`bountyTxt`。截圖腳本 `screenshots/r104.mjs`（gitignored，照 PROGRESS 第 104 輪重寫：STEPS 每步 dump 可見文字＋截圖）。
- **D-251**：營火字條（`calmText`）面板開著時藏起（顯示條件 `!this.menu?.active`＋`menuBanners`）。**新的常駐 HUD 字（depth < 960）也要想：☰ 遮罩 0.84 底下會不會透出來？** 從標題開始的即時截圖：`screenshots/r103t.mjs`（gitignored，照 PROGRESS 第 103 輪重寫；`"@x,y"` 點頁面座標，390×844 的「點擊開始」(195,600)、「進入霧語森林」(195,567)、選法杖 (321,589)、略過 (370,22)）。
- **D-250**：標題武器鈕要 `weaponChosen() || prologueSeen()` 才顯示；相遇「助」的 `metThisVisit`（`markMetThisVisit`／`leftMapsExcept`，同一次停留不道謝）；`menuBanners` 也藏 `zoneTexts`。**從標題開始的快轉截圖**：`screenshots/r102t.mjs`（gitignored，照 PROGRESS 第 102 輪重寫）一定要 `__game.loop.sleep()`，ff 後再 `step` 一幀才有畫面。
- **D-249**：標題只寫下一張要開放的地圖名，後面寫「？？？（未開放）」、`postGame` 地圖寫「？？？（通關後開放）」（`TitleScene` 的 `locked` 值是地圖 id 或 `?`／`?post`）。燼牌對手資料多 `again`／`loseAgain`（**加新對手要填**）。技能點面板說明一律查 `WEAPONS[w].desc`（**加新武器要填 desc**，`tests/rt-staff.test.ts` 會擋）。
- **D-247**：Boss 暴怒要先打倒那隻 Boss 一次才解鎖（`furyUnlocked` 多了 `bossKills ≥ 1`）。**D-248**：`nextGoal`／`returnIntro` 多 `frontier` 參數（`frontierAfter(stage)`＝往後第一張開放但沒打倒 Boss 的圖）——新的「目標」字要照這個傳。
- **劇透掃描**：`screenshots/spoil.mjs`（gitignored，新 session 照 PROGRESS 第 100 輪描述重寫：給 LS，標題→`scene.start('RtBattle')`→依序呼叫 `toggleMenu/openShop/openSkills/openBag/openMemoryBook/openCards`，每次 dump 場景所有可見 Text）。`card-noise.sh` 多 `OPP=伊妲`（先點那個頁籤）。
- **D-246**：還沒開放的地圖不在 UI 上寫名字——燼牌通關後對手頁籤用 `opponentTabs`（在他的營火或交手過才列）、還沒開放的地圖的對手寫「前方地圖的營火」、記憶本寫「？？？（還沒去過的地方）」。**新 UI 要列地圖時用 `mapOpen()` 過濾**。燼牌掃描 `scripts/card-noise.sh`。
- **D-245**：老玩家低血字條講過 45 秒內不重講（`lowTipAt`）。Boss 整場掃描改用 `scripts/boss-noise.sh`（不用再重寫 bn.sh）。
- **D-242～244（一直閃的底部字條）**：老玩家低血「打不過就退回營火」每次只講 8 秒（`LOW_HP_TIP_MS`、`lowHpAt`）；新玩家 Lv2 起底部字條不再教「點怪物開打」（`CALM_TAUGHT_LV`）；燼牌打過 3 場資訊列改「輪到你出牌」。**新的常駐字條**也要想：老手看到第幾次會嫌煩？
- **掃描工具**：`scripts/noise.sh` 可以同時跑多個（暫存檔名帶 PID，3 個並行約 8 分鐘）；燼牌面板除錯鉤子 `sc.menu.getData('auto')()`（輪到你時照 `aiMove` 出一手）／`getData('over')()`。Boss 整場掃描 `scripts/boss-noise.sh`（第 98 輪）。
- **D-238～241（重複的大字）**：撞牆暈眩置中大字每次進圖精英 2 次／Boss 3 次（`STUN_BIG_TIMES`／`STUN_BIG_BOSS`），之後頭上浮字；記憶卡等寶箱提示淡掉（`chestHintUntil`）；`Memory.bossTip`（剛想起同一件事就不跳攻略提示）；攻略提示講瞬移時和第一次瞬移大字只講一次（`tipBlinkFrom/Until`、`blinkSaidAt`）。**新的「每次都會跳」的置中大字要想一下上限**（同一場會出現幾次？）。
- **重複文字掃描**：`scripts/noise.sh`——每 2 秒一段、只統計不截圖，最快找到「一直跳」的字。
- **D-237**：`stackY` 排到主角頭上時間距不夠就縮小間距（貼到主角帶頂端、不高過 ceil 430）。
- **D-235**：`fightKeep(hy, by, top, bottom, boss)`（`bannerStack.ts`）；場景每幀用交戰中的 Boss，沒有就用纏鬥中的巡邏精英（同 `eliteFighting`）。`stackY` 原位壓到在主角**上方**的對手 → 先試主角下方（放得下、不用排隊才挪）。**新的置中大字照舊寫原位 y，不用自己避 Boss／精英。**
- **D-236**：`zoneHinted`——地區說明（第二行）每次進圖只講一次，之後只報地名。
- **D-234**：`gateRules.ts` 的 `eliteFighting()`＋場景 `eliteEngaged()`（精英非 Boss、交戰中、掉血、12 格內）→ `zoneBanner()`／`chestHint()` 跳過；巡邏精英進入交戰就 `tipSilently('jg_tip_stalker')`。**新的「打鬥中不該跳的大字」**：Boss 用 `bossEngaged()`、精英用 `eliteEngaged()`、小怪用 `peekBlocked()`（D-222）。
- **D-233**：`zoneBanner()` 在 `bossEngaged()` 時只記下地區、不報（打 Boss 時在巢穴邊跨區不再跳地名＋危險說明）。
- **D-232**：交戰中的 Boss 在主角**下方**時 `keep`＝[主角腳下＋30, Boss 腳下＋40]；`stackY` 原位／「主角下方」壓到它就先試 Boss 腳下。`keep[0] >= avoid[1]` 才算 Boss 在下方（`bannerStack.ts` 的 `keepBelow`）。
- **D-231**：場景每幀 `setBannerAvoid(scene, 主角帶, keep)`，`keep`＝交戰中 Boss 在主角上方時的 [Boss−230, 主角頭頂]；`stackY`（D-228 排到頭上）和 `pinY`（往上讓）都避開它。**新的「Boss 戰中可能出的大字」照舊用 `bigText`／`pinBanner`，不用自己避 Boss。**
- **D-230（從上次休息的營火出發）**：紀錄每張地圖多一個 `fire`（`MAP_KEYS`；`persist` 寫 `s.campfireId`）；`create` 的 `resumeAtFire()` 把主角放到中段營火南 1.6 格（`via gate` 不套用、Bot 不套用、回程門位置仍以 `spawnAt` 算），開場大字多一行「（從上次休息的營火出發）」（`this.resumed`）。**加新地圖**：`campfires[0]` 要是出生點旁那座（第二座以後才會被當成續行點）。
- **D-229**：面板可以 `root.setData('back', () => boolean)` 自己處理返回鍵（場景先問它）；燼牌對局中要按兩次（第一次跳提示）。
- **D-228**：`stackY` 原位壓主角、下方放不下 → 先試主角頭上（不高過 ceil、不碰其他大字）。360×640 剛進荊棘谷的開場大字以前整塊蓋主角。
- **D-225（核心）**：倒下醒來也補藥水到攜帶上限（`reviveAtCampfire`）。**D-226**：Boss 第二階段大字出現 0.95 秒內（`phaseBannerUntil`）升級 → 數值小字延後。**D-227**：寶箱標題被推走時，內容／燼牌字排在標題正下方（`below()`）。
- **D-223**：隱藏首領現身的字（兩行合一）在首領位於主角上方時排到主角下方（`hiddenEliteBannerY`）；`feel.ts` 新增 `bannerBusy(scene, cy, h)` 可查某一帶有沒有置中大字。**D-224**：醒來 3.5 秒（`reviveUntil`）內不浮休息字、不講新手營火說明。
- **D-222**：記憶卡也等身邊 7 格的小怪打完才跳。
- **D-220／221**：光門亮起的看一眼，主角 9 格內有交戰中的敵人就先不帶（`peekBlocked`，最多等 12 秒）；**新的看一眼也要先檢查 `peekCalm()`**（Boss 登場例外）。地區說明和開場大字有 5 字以上相同就只報地名（`hintRepeats`、`introStr`）；**新地圖的地區說明別和 `intro` 重複**，重複了也只是少講一次。
- **D-219（鏡頭看一眼）**：`src/game/cameraPeek.ts`；場景 `camPeek = {x,y,at,id?,share?}` → `updateCamera` 偏移跟隨點、上緣夾限跟著放開。光門亮起（`revealGate`）與 Boss 登場（`bossIntro`）目標在畫面外時自動帶；**新的「畫面外有重要東西出現」要讓玩家看到，就設 `camPeek`，特效延到 `PEEK_IN` 再放**（特效是畫面座標）。**凍結截圖**：快轉後 `__game.loop.sleep(); T+=16; off+=16; __game.step(T,16)` 再截（不凍結的話 700ms 等待期間 RAF 讓時間跳走）；Boss 自然醒來用 `LV=… bash scripts/shot-meet.sh 地圖 名稱 [W H]`（以前的 `shot-bossmeet` 把主角放在 4.2 公尺內，看不到 10 公尺外醒來的問題）。
- **D-218（光門）**：Boss 交戰中被打掉血 → 往前的門封住（`gateRules.ts` 的 `gateSealed`；場景 `bossEngaged()`），走進去浮字說明。**加新地圖**不用另外處理。畫面外箭頭距離字用 `clearOfHudPanels`（避開小地圖／懸賞板）；**新的左上角 HUD 板子**要加進 `clearOfHudPanels`／`overHudPanel` 的 boxes。
- **D-217（效能）**：每幀跑的程式改文字顏色用 `textColor(t, c)`（`src/game/hudText.ts`），**不要直接 `setColor`／`setStyle`**（Phaser 每次都重畫＋重傳貼圖）；冷卻秒數用 `cdText`。量測腳本見第 83 輪 PROGRESS。
- **D-216**：`src/game/orientation.ts`（觸控手機橫向＝DOM 提示＋`game.loop.sleep()`＋聲音暫停）；`screen.ts` 的 `portraitHeight(w,h,touch)`。**截圖腳本要模擬手機就用 `isMobile:true, hasTouch:true` 且直式 viewport**，不然橫的會被蓋。
- **D-215**：`npm run playthrough`＝跑 `tests/rt-campaign.test.ts`（通關機器人）；離線第 82 輪驗過（precache 18 項、零外部網址），**新增 public/ 素材記得副檔名在 workbox `globPatterns` 裡**。
- **D-214**：`RtBattleScene` 的 `drawnOnce`——面板在第一幀前打開（序章）也先畫一次地圖；**新的「一進場就開面板」不用另外處理**。返回清單多了「回行商」「回營火」；標題回顧結局按返回＝`root.getData('finish')()`。序章／選武器按返回不動作（設計）。
- **D-212／213（原生 App）**：`src/game/backButton.ts`（`setBackHandler(scene, fn)`；**新面板的關閉鈕字要是 `BACK_LABELS` 之一**＝返回／關閉／離開／完成／繼續，有後果的按鈕不要用這幾個字）；切背景 `setAudioPaused`、`APP_HIDDEN` 存檔；震動一律走場景 `buzz(pattern)`（看 `Settings.vibrate`、Bot 不震）；原生圖示 `npm run icons:native`（改 icon.svg 後和 `npm run icons` 一起跑）。測返回鍵用 `history.back()`（vite 改過檔後頁面 import 拿到另一份模組）。
- **D-211**：回禮卡／記憶卡顯示時 `reserveBanner` 佔位（之後的置中大字排到卡片下面）；記憶卡等面板／`storySoon`／`tipCalmUntil`／`topCard`；回禮卡也等記憶卡。**結語／尾聲每行 ≤ 19 字、抉擇選項說明每行 ≤ 22 字**（測試會擋）；只選過一部分抉擇時結局換不點名的句子。截圖：`shot-kill.sh` 可帶 `CH`、`shot-enc.sh` 可帶 `ENC`（第 79 輪 PROGRESS）。
- **D-210**：相遇結語也是一行（**新相遇 `after` ≤ 22 字**，測試會擋）＋後果一行 26px、`patient`；抉擇結語也 `patient`。第一次噴發說明在 Boss 戰中／結語期間／`storySoon`（等通關演出或番外卡）不說；`tipOnce` 在 `slainUntil`／結語／`storySoon` 期間不講。截圖：`scripts/shot-kill.sh`、`scripts/shot-enc.sh`（第 78 輪 PROGRESS）。
- **D-209**：抉擇結語＝`after` 一行＋後果一行 26px（**新抉擇 `after` ≤ 22 字**）；稀有大字／新地圖開放／`announce` 都是 `patient`；第一次噴發說明避開討伐／第二階段／幕名卡／面板，說了就 `holdTips`。凍結截圖要 `editing=true`（不然 Bot 在截圖前走動）。
- **D-208**：`bigText(..., patient)` 不急的說明寧可排隊也不蓋主角（討伐後「首次討伐！…」，抉擇面板等它 2.2 秒）；`tipOnce` 在面板開著時不講。被別的大字往下推到主角身上 → 改排主角下方／上方（不排隊）；固定位置大字用 `pinBanner`（升級數值；沒空位時正在顯示的教學小字 `yieldTip` 讓位、1.7 秒後重講）；「新地圖開放」2 行、多件稀有 30px。**360×640 新的置中多行大字 ≤ 2 行 30～36px**（主角下方只放得下高 ≈146）。
- **截圖時在頁面裡 `import` 場景用的模組要用同一個網址**：vite 改過檔後場景 import 的是 `feel.ts?t=…`，直接 `import('/src/game/fx/feel.ts')` 拿到另一份（`AVOID`／`BANNERS` 是空的，避讓失效）→ `const src=await (await fetch('/src/game/scenes/RtBattleScene.ts')).text(); const F=await import(src.match(new RegExp('from "([^"]*fx.feel[^"]*)"'))[1])`。
- **D-207**：置中大字原位壓主角（重疊 >50）就挪到主角下方，挪了要排隊就照原位；**新的大字照舊寫原位 y，不用自己避主角**。4 行「新地圖開放」在 360×640 仍蓋主角（已知）。`shot-bossmeet.sh 地圖 等級 名稱 武器 秒 W H`。
- **D-206**：置中大字往上疊碰到主角（`setBannerAvoid`，`updateCamera` 每幀登記主角螢幕範圍）就排隊；**新的置中提示照舊用 `bigText`，不用另外處理**。燼牌「N 張＋晴空」。
- **D-205**：危險說明黑底（`zoneBanner` 的 `z.danger`）；「光門 Nm」避開 `placed`／`gb`；建議等級在 Boss 血條字（`bossTxt` 的 `lowLv`）；「被發現了！」夾在 `VIEW_TOP+110` 以下；音量 `Settings.volume`＋`sfx.setVolume`，☰ 右上「音量 N%」。凍結截圖小抄見第 73 輪 PROGRESS。
- **D-204**：碎甲斬命中赤紅月牙＋裂甲環＋頓幀（`skillFx` 的 `st==='break'`、扇形、非大招）；蝕魂彈直線範圍毒綠＋流動芯線（`venom`：法杖、line、`poison`、非大招）；**`TIP_Y` 上限 `GAME_HEIGHT−545`**（360×640 兩行提示以前壓大招鍵）。凍結截圖的 AT 不能超過 `castTicks`，`slash` 命中要多 `EXTRA≈0.12` 秒（第 72 輪 PROGRESS）。
- **D-203**：一般技能施放特效——劍／弓位移招殘影（`shadowGhost`）、衝鋒風壓尾、`arrowShot` 寬光、迴旋箭陣光箭環（弓 `aoe`＋`moveFactor≥1`）、環形箭雨淡範圍、法杖多段範圍元素色（灼熱橘、雷暴紫＋電弧）、寒氣蓄力內收（`frostCharge`：`aoe`、1 段、`freeze`、`atTick≥8`）。**加新技能**時看一下會不會誤套這些條件。休息字條碰按鈕換兩行。凍結截圖腳本見第 71 輪 PROGRESS（`cast.js` 開始施放後就不再補指令）。
- **D-202**：劍刃風暴／旋風斬施放中的持續旋風在 `drawStorm`（`stormLo`／`stormHi`，旋風斬是 `mini`）、星落一閃蓄力 `drawStarCharge`、流星雨星空 `drawMeteorSky`（一波 3 顆）、破甲大招箭 `skyLance`；這些招不再蓋平面藍範圍（`stormed`）。**加新的圓形大招**時看一下 `drawStorm` 的條件會不會誤套。相遇 `takeLeaves`（「取」的台詞寫他走了 → 一拐一拐走開）。燼牌招呼語 `breakAtPunct`（`ui/tipText.ts`）。截圖腳本見第 70 輪 PROGRESS（`run.sh`／`enc.sh`）。
- **D-201**：相遇選完：「取」的人留在原地（`encStay`）、「助」的走開淡出（`encLeave`／`drawEncLeave`，`drawEncounterNpc` 第 8 個參數 `solo` 不畫獵犬／商隊老闆）；**加新相遇**時想一下牠走開的方向（`encLeave` 的 `dir`：頭朝右的固定往右）。行商 `shopStock` 四件部位不重複（`tests/rt-shop.test.ts` 鎖住）。流星箭雨每波 8 支＋地上粉光。截圖凍結多 `tweens.pauseAll(); time.paused=true`（短命特效就留得住），腳本見第 69 輪 PROGRESS。
- **D-200**：Boss 開打期間抉擇痕跡那句話／寶箱「有點熟悉」不說、記憶卡在 Boss 附近／開打／`menu`／`slainUntil`／`reviveUntil` 時留在 `memQ`；**新的「每次進圖都可能講」的說明用 `timesDue(key, 次數)`**（深夜說明 2 次、隱藏精英連殺提示 3 次）；紅「!」不畫在小地圖／懸賞板上（`overHudPanel`）。大招／Boss 登場凍結截圖方法見第 68 輪 PROGRESS。
- **D-199**：`ventHinted`／`hazardHinted` 進圖時看這張圖 `bossKills`；`idleHint` 不對 `veteran` 說；`veteran`（打倒過霧角狼王）不顯示「點怪物開打」字條，`calmText` 沒字整條藏起；行商賣空的說明；記憶 12/12 副標＋收尾（最後一頁）。
- **D-198**：`jg_tip_gear` 只在真的放進行囊才教；`newbie` 要這張圖 `bossKills` 為 0；標題 NEW 另看 `chapterSeen`／`bossKillsOf`（**截標題時 LS 要放真玩家會有的 `jg_chapter_<id>`**，不然走過的圖也會掛 NEW）；未開放地圖的條件換在按鈕上（`lockedHint(id, c, tx, label)`）；紅「!」避開 `zoneTexts`。標題截圖腳本 `screenshots/title.mjs`／`title2.mjs`（gitignored，內容見第 66 輪 PROGRESS）。
- **D-197**：Boss 第二階段大字後 3.2 秒（`phaseUntil`）深夜說明／`announce`／教學小字排隊，正在顯示的 `nightTip` 淡掉；**新的置中說明大字若可能在 Boss 戰出現，也要檢查 `phaseUntil`**。`aggro` 紅「!」只畫在 `VIEW_TOP` 以下。Boss 截圖工具 `scripts/shot-boss.py`（見第 65 輪 PROGRESS）。
- **D-196**：地圖上下緣內側有 `edgeShadeTexture()` 陰影（新地圖自動有）；`drawBossRing` 超出地圖的段不畫；第一次碰上 Boss 的攻略提示在 `TIP_Y`；序章遮罩一開始就蓋滿（通關演出照舊淡入）；`floatNumber` 在畫面內時 x 夾回畫面內。Boss 第二階段截圖腳本見第 64 輪 PROGRESS（`boss.sh`；y 150 可能在巢穴圈外會被回滿，是假象）。
- **D-195**：鏡頭可以往地圖**上緣外多捲 `TOP_EXTRA` 150**（地面材質上緣外接翻轉的 `edgeFadeTexture`）；Boss 戰不再擠在血條底下。`WorldMap.bossLv`（3／6／10／14，**加新地圖要填**，測試鎖住遞增＝`recLevel`）→ 等級不夠時攻略提示多一行建議等級。標題 `jg_last_map` 那顆亮金框＋▶。門字讓開按鈕會重檢。`calmText` 在 `slainUntil` 期間不顯示。標題截圖腳本見第 63 輪 PROGRESS（`screenshots/r63t.mjs`，ff 要藏相機）。
- **D-194**：面板第二輪。燼牌新的教練提示可以用 `maxReach(g, side)`（手上單位牌全出的總分，有特殊牌回 null）。行囊卡片標題縮字／右移、比較字換行改寫；強化結果字在 `cardBottom + 56`。全螢幕面板底色 0.93～0.94（暫停選單 0.84 不動）。截圖小抄見第 62 輪 PROGRESS（`scripts/shot-panel.js` 的 `mt`／`mt2`、`scripts/shot-card.js` 的 `cardLoop`（fetch `/scripts/...`）；**別改 `Math.random`**）。
- **D-193**：**新的「佔住教學小字」程式**：`this.tipBusy = true` 時一定 `const own = ++this.busyRun`，放行時檢查 `own === this.busyRun`（或直接用 `holdTips(t)`）。記憶卡走到先進 `memQ`，開場大字（`introRun`）收掉才出；噴發第一次說明等 `topCard`。長地區說明 `zoneHintBreak`。`shot-newsave` 有 `VIA=gate`；**LS 要放真玩家會有的 `jg_rt_hint_seen`／`jg_tip_*`**，不然會看到重播的第一次教學。
- **D-192**：**新的一次性公告大字用 `announce(text, color)`**（等 tipBusy／幕名卡／topCard／menu／稀有大字／討伐大字 `slainUntil`，顯示時 `holdTips` 擋教學小字）。撞牆暈眩大字只給 Boss／精英。`toggleMenu` 會藏門字。截圖腳本見第 60 輪 PROGRESS（`s1`／`keep`／`e1`）。
- **D-191**：深夜說明大字改由 `nightTipsRun(tips, ++this.nightRun, 3200)` 排隊（等 `tipBusy`／`chapterUntil`／`topCard`／`menu`）；**新的深夜說明**就 `tips.push([字, 顏色])`，不要再寫固定 delayedCall。深夜開場第一行 `nightIntro`（`rtRecord.ts`，測試在 `return-intro.test.ts`）。`menuBanners` 也藏 `topCard`。藥水鍵冷卻「N 秒／×瓶數」。
- 截圖小抄（第 59 輪）：☰ 切深夜＝`[[3,"window.AUTOPICK=null;sc().toggleMenu();1"],[3.5,"clk('🌙')"],[4,"mkBot();1"]]`（restart 後要重新 `mkBot()`；兩步不能寫在同一段，toggle 關掉後 clk 找不到）。暴怒 Boss 快打：LS `jg_rt_mistwood {level:10,bossKills:3,fury:true}`＋`jg_choices {mistwood:'spare'}`，第 3 秒傳到 Boss 南 400、`B.hp=B.maxHp*0.025`，約 8 秒倒下，15 秒出「解鎖：深夜的森林！」。
- **D-190**：番外收尾卡 `postGameEnd()`（`postGameEndLabel`，`chapters.ts`；`jg_chapter_starfall_end`）；「還」的跟班 `spawnCub(x,y)`（選完當場從巢穴出來）；`goalBefore`（存檔打倒過 Boss → 目標字條寫 `nextGoal`）；燼牌最後一局不跳回合大字；門字避開按鈕。截圖要看番外完：清掉 `jg_chapter_starfall_end`，打倒守望者、選完後約 3.6 秒（`afterChoice`）播，卡片是真實時間補間，要在出現後 0.3 秒內截。
- **D-189**：結語 `finaleLinesFor(weapon)`（`finaleStats.ts`，新結語句提到武器就照這樣換字）；`gateWaits` 期間目標字條只寫「✔ 已討伐」；`drawOffscreen` 的箭頭避開 `zoneTexts`；**新的上方卡片**（`this.topCard = c`）要一起呼叫 `hideBountyUnder`＋`hideHintUnder`＋`clearZoneTexts`；`showHint` 遇到 `topCard` 會延後。
- 截圖小抄（第 57 輪）：通關演出點一下＝`sc().children.list.find(o=>o.depth===2000&&o.list).list[0].emit('pointerdown')`；直接播＝`(await import('/src/game/ui/finale.ts')).playFinale(sc(), (await import('/src/game/finaleStats.ts')).loadFinaleStats(), ()=>{}, '繼續冒險')`；面板要截圖先 `window.AUTOPICK=null`。
- **經光門抵達（D-188）**：`via==='gate'` → 主角放在回程門往 `spawnAt` 方向 1.9 格、`arriveAt`＋`arrivePose()`（`draw()` 之後改精靈，warpPose 倒過來）；`'gateBack'` 只有降臨（回營火）。回程門的字 `gateLabelFrom`（抵達＋1.4 秒）與 `chapterUntil` 之後淡入。`chestHint` 在 `tipBusy`／`chapterUntil`／`topCard` 期間不跑；「點怪物開打」字條 y 跟主角腳下。
- **截圖假象（第 56 輪）**：快轉截圖後那 700ms 真實等待，場景時鐘會退回真實時間 → 依 `time.now` 比較的東西（回程門的字、幕名卡）在截圖裡可能消失；要確認就在 JS 裡讀 `label.alpha`／`visible`。標題場景開始的腳本 `screenshots/r56t.mjs`（gitignored）同樣有這問題（`scene.start` 後第一次 ff 時間跳很大，開場大字會提早出），**新存檔流程改用 shot-newsave**。選武器卡＝找 `選長弓` Text 的 parentContainer 裡有 `pointerup` 的 Rectangle，`emit('pointerup')`。
- **光門第二輪（D-187）**：首次討伐的門等抉擇／通關演出結束才亮（`gateWaits`＋`revealGate()`）；畫面外青色箭頭在 `drawOffscreen` 尾段（`gateArrow`）；過場 `warpGate`／`warpPose`（`warpAt>=0` 時 update 只畫），新場景 `init` 的 `via`（`gate`／`gateBack`）決定淡入顏色。目標字條的 `gateAhead`。
- **幕名卡（D-187）**：`ui/chapterCard.ts`（畫面）＋ `chapters.ts`（文字、`jg_chapter_<id>`），在 `opening()` 開頭；`chapterUntil` 期間 `memoryCheck`／`zoneBanner` 先等。**加新地圖**要在 `chapters.ts` 的 `LINES` 補一句（測試會檢查）。
- **截圖小抄（第 55 輪）**：幕名卡＝`localStorage.removeItem('jg_chapter_<id>'); sc().opening(); ff(0.9)`（開場 3 秒真實時間跑，自然的那次截不到）。清怪別用 filter（留下舊精靈）→ `u.y = p.y - 30000`。光門過場＝主角傳到門南 3 格、`ff(0.3)` 再放到門上 `ff(0.25)`。腳本在 scratchpad 寫 `tp.js`／`fz.js`（傳送＋凍結），內容見本輪 PROGRESS。
- **光門（D-186）**：場景 `gates`（`setupGate`／`drawGate`／`gateCheck`，畫在 `ringG` depth 46）；往下一張＝巢穴中心往北 0.55r（`tests/gate-spot.test.ts`）、回程＝`spawnAt` 旁。**加新地圖**：有 `next` 就自動有門，測試會檢查位置是空地。截圖：`sc().gates[0]`，傳送後 `s.moveGoal=undefined` 並在 0.3 秒內凍結（自動追擊會把主角拉走）。
- **巢穴紅圈（D-185）**：`drawBossRing`（Boss `mode==='combat'` 且玩家 > 0.55r）；`leash` 事件是 Boss 且玩家在巢穴外、不在營火 6 格內 → 大字（`leashToldAt` 8 秒）。地區名稱 `zoneSeenAt` 60 秒。
- **截圖腳本 `screenshots/r53.mjs`（gitignored）**＝r52 同一支。另有 `screenshots/r53t.mjs`（標題場景用，照這段重寫）：`STEPS='[["AsyncFunction 本體（要 return）", 等待ms?], …]' LS='{…}' node screenshots/r53t.mjs 名稱 W H`，有全域 `ff(秒)`／`texts()`。序章＝`t=__game.scene.getScene('Title'); t.cameras.main.fadeEffect.reset(); t.scene.start('RtBattle',{stage:'mistwood',bot:''}); ff(1)` 後每步 `ff(2.5)`（**不要點**，會點到「略過」），第 7 步全部字出完。通關旅程＝`playFinale` 後點 7 次（每次 `emit('pointerdown')`＋`ff(2)`）再 `ff(4.8)`。
  - **凍結後 Phaser 補間照真實時間跑**：短命的字（Boss 登場名字 1.8 秒）凍結前只快轉 0.35 秒。**星落一閃光柱**（0.4 秒）：包住 `sc().starfall`，被呼叫後 `ff(0.1)` 就凍結；放大招＝每 0.1 秒 `p.mp=40; p.ready.blade_storm=0; pending.push({type:'skill',id:'blade_storm'})` 直到 `p.action.id==='blade_storm'`。技能點存檔要算得過：`usedPoints ≤ skillPoints(level)`（Lv15＝14 點），不然整組被清掉。
  - **燼牌**：`sc().openCards(); sc().menu.getData('reveal')('hero_colossus')`（傳奇卡）、`clk('我的牌組')`（整理牌組）；出牌＝點手牌一下再 `clk('出牌')`。對手要在 `jg_cards.by` 解鎖。
  - 墜星：`engine.ventLeft(s.tick, v, s.night)` 找快噴的落點（`STAGES[id].vents`、`warnTicks`），傳過去等 `left ≤ warnTicks×0.1`。
- **非 bigText 的置中大字要佔位（D-184）**：`reserveBanner(scene, cy, h, ms)`（`fx/feel.ts`）。上方卡片（`topCard`）新增時呼叫 `hideBountyUnder(c, CW)`。Boss 登場會收掉 `zoneTexts`。
- **截圖腳本 `screenshots/r52.mjs`（gitignored）**＝r51 同一支（`sed 's/const log = \[\]; const step/sc().editing = false; const log = []; const step/' scripts/shot-newsave.mjs`）。長 JS 寫在 scratchpad 檔案，再 `python3 -c "import json;print(json.dumps(open(f).read()))"` 塞進 SHOTS。小抄：
  - **等某個 Boss 預告**：迴圈 `ff(0.1)`＋每步 `p.hp=p.maxHp; s.potions=20`＋補 target，直到 `s.telegraphs.find(t=>t.attackId===…&&(s.tick-t.startTick)/(t.hitTick-t.startTick)>0.55)`。
  - **短命特效**（`frostFx`／`thornFx`）：凍結前包住 `sc().drawFrost`／`sc().drawThorns`，每幀把 `born` 拉回 now−350～600（荊棘另清 `wither`）。Boss 登場演出的上下黑條是刻意的電影框；震動用 `cameras.main.shakeEffect.reset()`。
  - **噴口燒死**：傳到噴口南方 `v.r+260`、`sc().commands=()=>[]`、`sc().ventHinted=true`、2 隻怪每步釘在噴口上、血量 = maxHp×pct×0.8，等 texts() 出現「燒死了」。LS 加 `jg_rt_hint_seen:"1"` 就不會有開場說明框。
- **開場說明框（D-183）**：走進第二個地區且已出現 ≥ 3 秒 → `dismissHint()`；`hintAt` 記出現時間。**記憶卡／回禮卡 `topCard`** 還在時 `zoneBanner` 不出（新的上方卡片也要設 `this.topCard`）。
- **Boss 名稱＋％（D-183）**：`bossTxt`（y 136）；`drawOffscreen` 的 `gb` 會避開它。
- **截圖腳本 `screenshots/r51.mjs`（gitignored，照這段重寫）**＝`scripts/shot-newsave.mjs` 複製一份，把每段 `pg.evaluate(async ([sec, js]) => { const log = [];` 改成開頭先 `sc().editing = false;`（上一段結尾凍結的畫面，下一段要繼續跑）。凍結截圖的 JS：`sc().flashUntil.clear(); sc().cameras.main.flashEffect.reset(); if (sc().hint) sc().dismissHint(); for (const o of sc().children.list) if (o.type==='Text' && /^(回到營火|黃框|往北穿過|休息中)/.test(o.text||'')) o.setVisible(false); sc().editing=true; 1`。JS 裡要 `await import` 就包成 `(async()=>{ …; return 1 })()`（eval 不吃頂層 await）。**最多 2 個並行**（3～4 個會截圖逾時）。
  - 截升級：`sc().s.events.push({type:'levelUp', level:2, maxHp:657, atk:36, tick:sc().s.tick}); sc().playEvents(); ff(0.5)` 再凍結。
  - 截特定精英：第 3 秒傳送到牠旁邊＋`sc().pending.push({type:"target", id:w.id})`，**之後每段都要再推一次 target**（不然 Bot 照 advanceTo 走開）。
  - 暫停選單：`sc().toggleMenu()`；操作設定：再 `clk("操作設定")`。技能變化存檔：`jg_rt_mistwood: {level:10, skills:{whirlwind:5}, variants:["whirlwind:b"]}`。
- **升級（D-182）**：標題 y 430 置中大字；數值／技能點小字固定在主角腳下。**傷害數字**經 `numberSlot` 自動往上錯開（新的跳字一律走 `floatNumber` 就好）。
- **截圖腳本 `screenshots/r50.mjs`（gitignored，照這段重寫）**：r49 的精簡版——`STEPS='[["JS（AsyncFunction 本體，要 return）", 等待ms?], …]' STAGE=地圖id|title LS='{…}' WEAPON=sword|bow|staff node screenshots/r50.mjs 名稱 W H`；有 `sc()`／`texts()`／`clk(字)`（`INC=1` 包含比對）／`ff(秒)`。標題：`STAGE=title`，`sc().cameras.main.fadeEffect.reset(); ff(1); sc().input.emit('pointerdown',{x:270,y:700,worldX:270,worldY:700}); ff(2.5)` 再 reset fade／flash。技能面板：`sc().editing=true; sc().openSkills()`，變化鍵＝`sc().menu.list` 裡 x＝250 且可點的 Text。行囊：`sc().bagSt={bag,equip:{}}; sc().openBag(false)` 後 `INC=1; clk('【武器】霧鋼劍')`、`clk('返回')`。
- **行囊詳細卡（D-181）**：比較字＝數值下緣＋44，強化區／按鈕跟著比較字走。**升級大字（D-181）**：標題＋小字兩則（自動錯開）。
- **抉擇／相遇面板由上往下排、整塊置中（D-180）**：說明下緣＋70 接選項卡；新抉擇說明 ≤ 5 行。**回禮卡／記憶卡** 544 寬靠右（左緣約 160），回禮一行 ≤ 21 字。畫面外箭頭也避開懸賞板（`bountyTxt` bounds）。行商詳細卡高度跟行數。
- **截圖腳本 `screenshots/r49.mjs`（gitignored，照這段重寫）**：用 vite dev（5173）；`STEPS='[["JS 函式本體（要 return）", 等待ms?], …]' STAGE=… LS='{…}' node screenshots/r49.mjs 名稱 W H`；進地圖後定義 `sc()`／`texts()`／`clk(字)`（`window.INC=1` 改成「包含」比對，商店列「▲ 【…」要用）。JS 用 AsyncFunction 包起來（可以 `await import(...)`，最後 `return`）。範例：開相遇面板 `const m=await import('/src/game/ui/choicePanel.ts'); const E=await import('/src/game/encounters.ts'); sc().menu=m.openChoice(sc(), E.ENCOUNTERS[0], ()=>{}, {kicker:'相遇', spareTag:'助'})`；回禮卡 LS `jg_encounters:{"mw_hunter":"spare"}` 後 `sc().giveThanks(E.ENCOUNTERS[0])`；把精英擺到畫面外某個螢幕 y：`k=(sc().sy(p.y+100)-sc().sy(p.y))/100; el.y=p.y+(目標y-sc().sy(p.y))/k`（世界→畫面有縮放，390×844 約 0.55）。
- **快轉截圖去掉受擊閃白**：`shot-newsave.mjs` 那段 JS 寫 `sc().flashUntil.clear(); sc().editing=true`（凍結後 0.7 秒內不會再閃）。README 26、22、23 就是這樣截的（23＝長弓 Lv8、第 3 秒傳到狼王南方 500、`pending.push({type:"target"})`、第 11 秒截；另加 `cameras.main.flashEffect.reset()`，不然 Boss 登場閃光讓畫面發白）。
- **地圖下緣外的漸層（D-179）**：`edgeFadeTexture()` 接在地面材質下緣（只有大地圖）；地面塊剔除用 `displayWidth`。**新地圖不用另外處理**（顏色取 `palette.ground／under`）。
- **行商（D-179）**：賣的頁一頁 `7＋floor(TALL×0.75/74)` 列、「離開」`560＋TALL×0.4`；裝備詳細的數值從上往下排（行囊、行商兩處）。**新面板一樣：多行的說明用 origin (0.5, 0) 從上往下排，不要置中在固定 y。**
- **截圖腳本 `screenshots/r48.mjs`（gitignored，照這段重寫）**：通用版——`STEPS='[["JS", 等待ms?], …]' STAGE=地圖id|title LS='{…}' node screenshots/r48.mjs 名稱 [W H]`；進地圖後定義 `sc()`／`texts()`／`clk(前綴)`／`ff(秒)`（和 shot-newsave 一樣的快轉），每步執行 JS、印出文字、截圖。小抄：
  - 背包塞裝備：`const g=await import("/src/core/battle/rt/gear.ts"); bag.push(g.genGear(seed, 1|2|3, 6, {region:"mistwood"})); sc().bagSt={bag,equip}`，再 `sc().openShop()`／`sc().openBag(false)`；`clk('賣')`、`clk('【頭盔】')`、`clk('強化！')`。
  - 相遇：傳送 `p.x=tx*100+50; p.y=ty*100+150; ff(0.3)` 兩次再 `ff(1)`（附近有交戰中的怪不會觸發，燼紅裂谷的礦工 24,62 就是）；回禮：LS `jg_encounters: {"tv_thief":"spare"}`。護送：選「助」後每步 `p.y+=300; ff(2.5)`。
  - 通關演出：`STAGE=title`，`window.sc=()=>__game.scene.getScene('Title')`、`cameras.main.fadeEffect.reset()`、`fin=F.playFinale(t, S.loadFinaleStats(), ()=>{}, '回到標題')`；下一段＝`fin.list[0].emit('pointerdown')`（間隔 > 350ms 遊戲時間，中間 `ff(0.4)`）。旅程那段在第 4 次點擊後，**ff 不要超過 6.5 秒**（會自動跳到名單）。
  - 燼牌對伊妲：LS `jg_cards: {played:3,won:3,cards:[],by:{merchant:{played:1,won:1},vela:{…},goran:{…}},off:[]}`，`sc().editing=true; sc().openCards(); clk('伊妲'); sc().menu.getData('start')(true)`；手牌點名稱：找 100×144 Rectangle 旁邊同名 Text 再 emit（手牌隨機）。
- **長螢幕面板（D-178）**：燼牌按鈕 `500 + btnDy()`（`TALL×0.45`）、說明 `infoDy()`；行囊一頁 `8＋floor(TALL×0.9/68)` 列；記憶本置中。**新面板的底部按鈕也照這樣往下**（360×640 不變）。面板遮罩 ≥ 0.84。開場說明框面板開著時藏起。燼牌天候寫在排名下一行。
- **截圖腳本（第 47 輪，gitignored，照這段重寫）**：`r47title.mjs`＝`shot-newsave` 的 `ff`／`texts` 搬到標題場景（`localStorage.clear()` 後等 Title active；**先 `cam.fadeEffect.reset()`，點擊後 `flashEffect.reset()`**，不然快轉截到的是暗的／白的）；序章＝`scene.start('RtBattle',{stage:'mistwood',bot:''})`；結局＝`import('/src/game/ui/finale.ts')` 後 `playFinale(titleScene, loadFinaleStats(), ()=>{}, '回到標題')`。`r47cards.mjs`＝進霧語森林→`sc.editing=true; sc.openCards(); menu.getData('start')(true)`，`hand()`＝`menu.list` 裡 100×144 且 `input.enabled` 的 Rectangle，點兩下出牌，`ffUntilMyTurn()` 每 0.5 秒快轉到又有可點的手牌。要截天候：找手牌上方 44px 有「霜寒／濃霧」字的那張先出（隨機發牌，重跑幾次）。README 用 540×960 截（TALL＝0）。
- **HUD／按鈕不互壓（D-177）**：目標字條 y 114（MP 條 96～104、經驗條 104～110、Boss 血條 113～133）；畫面外箭頭下緣照 `btnPos`／`btnR` 停在按鈕上方；開場說明框 500 寬、中心 (GAME_WIDTH/2＋50, 250)；大招鍵 `ultLabel`；墜星類預告不觸發「紅色範圍」提示；暴怒 Boss 第二階段喊「徹底失控了」。
- **截 Boss 第二階段的方法**（第 46 輪；腳本沒進 git，照這段重寫）：`STAGE=starfall LS='{"jg_rt_mistwood":{"level":16,"bossKills":1},"jg_rt_thornvale":{"bossKills":1},"jg_rt_emberrift":{"bossKills":1}}'`，`SHOTS` 第一段（第 3 秒）的 JS：找 `s.units.find(u => u.defId === 'star_sentinel')`、玩家傳到 `b.y + 400`、`b.hp = b.maxHp * 0.52`、`s.potions = 20`、`sc().pending.push({ type: 'target', id: b.id })`；之後每段補 `p.hp = p.maxHp; s.potions = 20` 並在 `B.mode !== 'combat'` 時再推一次 target。**藥水 < 8 時 Bot 會跑去營火**（`campfireBelowPotions`），這就是以前「Bot 會離開巢穴」的原因。暴怒：`jg_rt_mistwood: {level:10, bossKills:3, fury:true}`。拿弓的 Bot 會放風箏把 Boss 拉出巢穴（Boss 回滿），截 Boss 用劍。
- 燼牌截圖腳本（gitignored）：`sc.editing = true; sc.openCards()` → `sc.menu.getData('start')(true)` → `getData('end')(0|1|-1)`；存檔先給 `jg_rt_mistwood: {level:6, coin:500, bossKills:1}`。結算畫面的「第 1 局 勝…」是除錯鉤子假造的，局數寶石不會跟著變（不是 bug）。
- **新存檔減噪（D-176）**：`arrowRules.ts` `showOffscreenArrow`（待機精英 25m 內才畫箭頭）；`tipOnce` 回傳 boolean、兩則間隔 `TIP_GAP_MS` 2.5 秒；一次性事件提示用 `tipSoon`（會重試）；`this.menu` 開著時場景 `menuBanners` 藏起 `BANNER_DEPTH` 大字（**面板上要顯示的大字一律 `setDepth(990)`**）；技能鍵冷卻顯示「名稱＋秒數」。
- **快轉截圖 `scripts/shot-newsave.mjs`**（第 45 輪，進 git）：先 `setsid npx vite --port 5173`；`SHOTS='[[秒數, "JS"?], ...]' node scripts/shot-newsave.mjs 名稱 sword|bow|staff [W H]`。Bot 代打、遊戲 10 分鐘約 3 分鐘；印出每段出現的文字。要測別的地圖改腳本裡的 `stage: 'mistwood'` 與 `WORLD_MAPS[0]`。
- **新存檔第一張懸賞＝野狼 ×12（D-175）**：`makeBounty(0)`。
- **老存檔開場（D-174）**：`returnIntro`（`rtRecord.ts`）＝「歡迎回到○○！＋▶ nextGoal」，Boss 打倒過才用；`encThanks` 有人就多一行「✦ 你幫過的人在老地方等你」；開場大字依行數往上挪（`nl`）、`tipMs`。畫面外大箭頭避開上緣 `this.goal` 字條（`drawOffscreen` 的 `gb`）。
- **營火捷徑排版（D-172）**：`fireRowLayout`（`rtControls.ts`）＋場景 `placeFireBtns()`（建立、操作設定完成、`endEdit` 時重排）。**新增營火捷徑**要加進 `placeFireBtns` 的 `row`／`PREF`，`tests/fire-row.test.ts` 的 `ITEMS` 一起改。
- **抉擇／相遇面板開著時藏起置中大字（D-172）**：`choicePanel.ts` 用 `BANNER_DEPTH`（`fx/feel.ts`）找 Text；其他全螢幕面板要同樣效果就照抄。`bigText` 多行已置中。
- **懸賞板名稱（D-173）**：`bountyIdsHere`；完成大字用剛打倒的怪名。操作設定面板的技能名由呼叫端傳 `nameOf`。
- **Bot 示範（D-171）**：`tipOnce` 在 Bot 模式直接 return、`calm` 提示也不顯示；新加的教學一律走 `tipOnce`。☰ 前世的記憶依 `GAME_HEIGHT` 分頁。置中大字間距 16。相遇／抉擇的 `after` 一律 `wrapTip`（測試 `encounter-text` 鎖每行 ≤ 22 字，新相遇的台詞照這個寫）。**Bot 撿星光碎片（D-170）**：`sim.ts` 的 `shardNear`。
- **畫面外箭頭／☰ 選單排版（D-168）**：`drawOffscreen` 的 `placed` 陣列（箭頭錯開、距離字錯開、避開 `this.mini`）；選單換地圖按鈕兩欄、紀錄太長縮字＋上推。**新增選單按鈕**時注意 360×640 的高度（GAME_HEIGHT 1280）。
- **記號（D-169）**：`drawShroomMarks`（燼芯菇／星芒菇）、`drawWolfMarks`（首領狼／霧影狼）。霧狼圖是 3/4 正面。
- 燼牌面板除錯鉤子：`sc.menu.getData('start')(true)`（下注開局）、`getData('end')(1)`（直接結束，0 你贏／1 輸／-1 平）。行囊自動分解合成一則（`salvageQ`）。
- **染色立繪的記號（D-166）**：`THORN_BACK`（荊棘刺）、`STAR_MARKS`／`drawStarMarks`（星痕、彗尾、日蝕）、`FLAME_MANE`（火焰鬃毛）都在 `drawUnits` 立繪之後畫；霧狼圖朝右，前方 `dir = sp.flipX ? -1 : 1`。霧團（迷霧巡守）試過不好看，不要再試。
- **護送遇敵（D-167）**：`escort.scared`（附近 `ESCORT_SCARED_TILES` 6 格有交戰中的怪就停）。
- **提示停留時間**：`tipMs(text)`（`ui/tipText.ts`），長提示請用它算 `bigText` 的停留時間。
- **路上的相遇（D-159／160）**：`src/game/encounters.ts`（`ENCOUNTERS` 7 筆：主線三張圖各 2、星隕高原 1；`meet`／`pendingThanks`／`claimThanks`／`openEncounters`／`rivalEncounterEcho(rival, cur, rnd)`）＋ `fx/encounterNpc.ts`（7 種 `npc`）；場景 `encounterCheck`／`giveThanks`／`drawEncounters`（`encOpen`／`encThanks`／`encDone`，`encAt` 覆寫畫的位置）。**護送**：`Encounter.escort {tx, ty, place}`＋場景 `escort`／`drawEscort`（目前只有採藥婆婆 `mw_herbs`）。存 `jg_encounters`（take／spare／thanked）。**加一個相遇**：`ENCOUNTERS` 加一筆（`tests/encounters.test.ts` 第一條鎖住每張圖的數量，要一起改；新相遇要離重生點 > 8 格、離記憶／其他相遇 ≥ 6 格）＋ `drawEncounterNpc` 加一種 `npc`＋（選）`RIVAL_ENC` 加回聲。找位置：照 PROGRESS 第 37 輪重寫 `tests/zz-encspot.test.ts`。通關演出「幫助過的人」只算 `STORY_ENCOUNTERS`（`finaleStats.ts`）。截圖腳本（gitignored，新 session 照 PROGRESS 第 36／37 輪重寫）：傳送玩家到格子附近；面板「助」在 390×844 頁面座標 (195, 551)、「就這麼做」(195, 675)。
- 星隕高原也有抉擇（D-158）：`BOSS_CHOICES` 第四筆 `postGame: true`；`codaLine` 接在結語最後；小星星 `cub.kind === 'star'`。
- **討伐後的抉擇（D-157）**：`src/game/choices.ts`（`BOSS_CHOICES`、`loadChoices`／`makeChoice`／`shopDiscountPct`／`withEpilogue`）＋ `ui/choicePanel.ts`；場景 `showChoice`／`afterChoice`／`drawChoiceMark`。存 `jg_choices`（截圖：`localStorage.setItem('jg_choices', JSON.stringify({ mistwood: 'spare' }))`；直接開面板要用 vite dev（5173）`const m = await import('/src/game/choices.ts'); sc.showChoice(m.choiceOf('thornvale'))`）。`stockPrice`／`buyGear` 多一個 `offPct` 參數。
- 四張大地圖：霧語森林→荊棘谷→燼紅裂谷（打倒岩王＝通關演出）→ **星隕高原**（通關後的挑戰地圖，`postGame`，建議 Lv14＋裝備；墜星＝vents 換皮；Boss 星骸守望者 8200／41，第二階段「召喚墜星」（D-143）；白天巡邏精英彗星巡者、**深夜限定星蝕狼**（D-144））。
- 營火行商、巡邏精英、技能變化二、營火燼牌（五位對手）。有頭有尾：序章 → 12 段前世的記憶 → 通關演出（`FINALE_MAP = 'emberrift'`）。
- **長螢幕（D-142）**：`src/game/screen.ts` 開機時依 `#game` 比例算 `GAME_HEIGHT`（1280～1600）與 `TALL`。**新 UI 一律這樣排**：貼齊下緣的 y 加 `TALL`、置中的用 `GAME_HEIGHT / 2`、全螢幕遮罩高 `GAME_HEIGHT`；不要再寫死 640／1280。
- 核心新招式欄位（D-143）：`AreaAttack.atTarget`（預告在玩家腳下）、`hitsEnemiesPct`（也砸範圍內追你的一般怪）。畫面上屬於 `METEOR_ATTACKS` 的招式畫成藍白墜星。
- 換地圖會丟掉別張圖的地面材質（D-145）；Boss 慢動作只在第一次放滿（D-146）。
- **截圖注意**：新的 localStorage 會先播序章——先 `localStorage.setItem('jg_prologue_seen','1')`；開放星隕高原要 `jg_rt_emberrift = {"bossKills":1}`；深夜要 `jg_rt_starfall = {"bossKills":1,"furyKills":1,"night":true}`。preview 網址 `http://localhost:4173/?debug`。進地圖：`__game.scene.getScene('Title').scene.start('RtBattle', { stage: 'starfall', bot: '' })`。傳送：`window.__rt.state().units[0].x/y = …`。**viewport 比例會改變畫面高度**：390×844 → `GAME_HEIGHT` 1558、頁面座標＝遊戲座標 × 390/720（不再有上下黑邊的 75.5 偏移）；360×640 → 1280（跟以前一樣）。預告圈的截圖可以直接 `s.telegraphs.push({...})`（第 31 輪 `screenshots/r31a.mjs`）。
- **三種武器（D-147／152）＝查表**：`WEAPONS`（`data.ts`：`{ name, player, skills, variants, variantsB, desc }`）＋ `WEAPON_IDS`；`BattleState.weapon` 是 `'bow' | 'staff'`（劍＝不寫）。`playerDef(s)`／`skillDef` 查表；選擇存 `jg_weapon`（`src/game/weapon.ts`：`loadWeapon`／`nextWeapon`／`weaponSetup`／`gearName`／`gearTitleW`）。**加第四種武器**：data 加一組 skills＋兩組變化＋player，`WeaponKind`／`WEAPON_IDS`／`WEAPONS` 加一筆，`weaponPick.ts` 的 `INFO`＋圖示（卡片寬 224，四張要改排版）、TitleScene 按鈕顏色、`RtBattleScene` 普攻特效（`magicBolt`／`arrowShot`／`slash`）、`skillFx` 的武器分支（`bowFx`／`staffFx`）、拿在手上的畫法（`drawUnits` 裡 `this.s.weapon === …`）、`gearIcons.ts`、`weapon.ts` 的 `NOUN`；`tests/rt-staff.test.ts` 會自動檢查名字不重複與位移上限。
- **位移技能上限（D-153）**：`|distance| / ticks ≤ 50`（每 tick 超過半格會穿進厚牆裡卡住），測試會擋。
- **`SkillHit.ahead`（D-155）**：判定中心往前移；`drawUltAim` 對「圓＋ahead」畫落點圈。
- **置中大字（D-162／164）**：`bigText` x＝畫面寬／2 時會自動避開還沒淡出的其他置中大字（`fx/bannerStack.ts`），上下都沒位置（往上會超過 `BANNER_CEIL` 430）就**排隊**等前面的淡出（最多約 6 秒）；新加的大字不用自己算錯開；要固定位置（不想被推開／不想排隊）就把 x 偏 1px 以上。提示高度用 `TIP_Y`（D-163），不要再寫死 700。同一刻多件稀有裝備合成一則（`rareQueue`）。
- **Boss 第一次遇到的提示**：`worldMaps.ts` 的 `bossTip`（加新地圖要填；提到「衝鋒」的 Boss 必須有 `wallStunTicks` 衝鋒，測試會擋）。通關那張圖的「新地圖開放」排在通關演出之後（`afterFinale`）。
- **第一次升級 40 經驗（D-165）**：`xpToNext(1) = 40`，其餘 60×Lv^1.7。stateHash 基準從第 39 輪的 commit 起算（霧語森林／測試大地圖的雜湊和第 34 輪不同）。
- 截圖：`localStorage.setItem('jg_weapon','staff')`（或 bow）；**不設 `jg_weapon` 的新存檔會在序章後跳選武器**；凍結模擬只畫畫面用 `sc.editing = true`；特效可直接 `sc.staffFx(x, y, ang, shape, ult, single, blink, status)`／`sc.bowFx(...)`；`window.__rt.send({ type: 'skill', id })` 放技能。
- 通關機器人 `tests/rt-campaign.test.ts`（新存檔→三個 Boss，不含星隕高原；劍、弓、杖各一趟）。stateHash 基準：第 34 輪最後的 commit（第 35 輪沒動核心；本輪 89 場＋長弓 18 場與開頭相同；長弓那組 `tests/zz-hashbow.test.ts` 是 mistwood／wolf_king × 種子 1–3 × 三組變化、Lv8、200 秒）。
- **畫面剔除（D-151）**：`draw()` 的單位迴圈、營火、掉落都會跳過畫面外的；新加的世界物件也要照做（`px/py` 超出 `GAME_WIDTH`／`VIEW_TOP`～`VIEW_BOTTOM`＋邊界就 `continue`）。量測腳本：Graphics `commandBuffer.length` 加總（第 33 輪 `screenshots/r33perf.mjs`）。

### 下一輪從這裡開始（依序）
1. **Jacky 有回覆就照他的答案先做**（FOR_JACKY 第 4～21 題）。
2. **相遇（選做，先等 Jacky 回 FOR_JACKY 第 21 題）**：他說「相遇減少」就把每張圖砍回一個（刪 `ENCOUNTERS` 第 4～7 筆、改測試數量、README）。沒回覆就**先不要再加**。**不要**把抉擇／相遇做成永久戰鬥加成（D-157）。
3. **（下一輪建議主工作）「第一眼」＋打磨期**：①只修看得到的問題（凍結截圖，D-219 注意）；②README 成果發表版已完成（D-257）；③11/4 起功能凍結、11/5 中午前定最終版。
   - **README 成果發表版已在第 109 輪提前做完（D-257）**：版本 1.0.0、開頭「🎉 成果發表版 1.0.0」＋一行統計、「第一次玩：10 分鐘試玩路線」。**11/5 最後一輪**再跑 `bash scripts/stats.sh`，統計若差很多（例如輪數 > 130）就更新那一行；之後只修 bug 的話版本改 1.0.x（`package.json`＋`package-lock.json` 前兩處）。
   - **第 117 輪建議接著看**（11/4 打磨期，**功能凍結**）：①只修看得到的 bug；②回顧結局（360×640／412×915）第 116 輪看過不改，不用再排；③main 第 116 輪全跑 401 項過，之後沒改程式就不用每輪重跑；④PROGRESS 第 116 輪已合併到 177 行；⑤11/5 最後一輪：`bash scripts/stats.sh` 更新 README 統計行（輪數已 > 110，若 > 130 就改）、版本視修 bug 情況改 1.0.x。
   - **第 119 輪建議接著看**：①只修看得到的 bug；②亂點測試腳本思路見第 118 輪 PROGRESS，想再跑可以換種子（無頭很慢，同時最多開 4 個）；③效能只剩標題 glow（真機回饋再降，D-262），不要再動其他特效；④11/5 最後一輪照上面⑤更新 README 統計行與版本（本輪有程式修改 → 版本可改 1.0.1）。
   - **第 120 輪建議接著看**：①只修看得到的 bug；②健壯性大致掃完（儲存壞掉、旋轉、換場景洩漏、Boss 陣亡都過，第 119 輪），不用再排；③效能只剩標題 glow（D-262），不動；④11/5 最後一輪照上面⑤更新 README 統計行與版本（第 118 輪有程式修改 → 版本可改 1.0.1）；⑤若沒有新的東西可查，可以只確認 CI 綠＋Issue 就收尾，不要為了做事而改程式。
   - **第 121 輪建議接著看**：①只修看得到的 bug；②桌機第 120 輪看過（D-263～266），其他桌機項目（標題按 Enter 開始等）不做；③效能只剩標題 glow（D-262），不動；④11/5 最後一輪照上面⑤更新 README 統計行與版本（第 118、120 輪有程式修改 → 版本改 1.0.1）；⑤沒有新的東西可查就只確認 CI 綠＋Issue 收尾，不要為了做事而改程式。
   - **第 132 輪起**：第 131 輪（11/5 08:12）只做健康檢查（全綠、無錯誤）。照下面「第 131 輪起」：只做健康檢查＋修看得到的 bug，不改統計行／版本；11/6 00:00 起停用排程。
   - **第 131 輪起**：第 130 輪（11/5 06:12）已做⑤——版本 1.0.1、README 統計行（約 130 輪、1100+ commits，D-268）。**之後每輪只做健康檢查＋修看得到的 bug**（CI 綠、Issue、art-inbox、FOR_JACKY 回覆），不要再改統計行或版本（除非修了 bug 才改 1.0.2）、不要為了做事而改程式。11/6 00:00 起照排程第 0 步停用排程。
   - **第 130 輪起**：第 129 輪（11/5 04:11）只做健康檢查（全綠、無錯誤）。下一輪若在 11/5 06:00 前開始，只做健康檢查；**11/5 08:00～12:00 開始的那一輪**一定要做⑤（`bash scripts/stats.sh` 更新 README 統計行＋版本 1.0.1，build／vitest 過再推）。若下一輪在 06:00～08:00 開始，也可以提前做⑤（之後只修 bug）。
   - **第 129 輪起**：第 128 輪（11/5 02:12）只做健康檢查（全綠、無錯誤）。11/5 凌晨只做健康檢查；**11/5 08:00～12:00 開始的那一輪**一定要做⑤（`bash scripts/stats.sh` 更新 README 統計行＋版本 1.0.1，build／vitest 過再推）。
   - **第 128 輪起**：第 127 輪（11/5 00:14）只做健康檢查（全綠、無錯誤）。照下面：11/5 凌晨只做健康檢查；**11/5 08:00～12:00 開始的那一輪**一定要做⑤（`bash scripts/stats.sh` 更新 README 統計行＋版本 1.0.1，build／vitest 過再推）。
   - **第 127 輪起**：第 126 輪只做健康檢查（全綠、無錯誤，360×640 標題→序章正常）。照下面「第 126 輪起」：11/5 凌晨只做健康檢查；**11/5 08:00～12:00 開始的那一輪**一定要做⑤（`bash scripts/stats.sh` 更新 README 統計行＋版本 1.0.1，build／vitest 過再推）。
   - **第 126 輪起**：第 125 輪只做健康檢查（全綠、無錯誤）。11/5 凌晨的輪照①～⑤只做健康檢查；**11/5 08:00～12:00 開始的那一輪**一定要做⑤（stats 更新 README 統計行＋版本 1.0.1）。
   - **第 125 輪起**：第 124 輪修了 PWA 不會自己換新版（D-267，有程式修改）。其餘照下面「第 124 輪起」；**11/5 中午前那一輪**的⑤照做（stats 更新 README 統計行＋版本改 1.0.1；build／vitest 過再推）。PWA 換版測試腳本思路見 D-267（A／B 兩份 dist、本機 http.server 換內容、重整看 `index-*.js` 檔名），不用再測。
   - **第 124 輪起**：第 121～123 輪只做健康檢查（第 123 輪 stats 預看 128 輪／1107 commits → 最後一輪 README 統計行要改成約 130 輪、1100+ commits，以當時實際數字為準）。第 121、122 輪只做健康檢查（第 122 輪另查 README 85 個相對連結都存在，不用再查）。第 121 輪只做健康檢查（全綠、無錯誤）。照第 121 輪①～⑤；**11/5 中午前的那一輪**（約 11/5 08:00～12:00 開始的輪）一定要做⑤：`bash scripts/stats.sh` 更新 README 統計行＋版本改 1.0.1（`package.json`＋`package-lock.json` 前兩處），build／vitest 過再推。
   - 第 120 輪已做：電腦展示——拖搖桿出畫面放開會停（D-263）、寬螢幕兩側模糊主視覺＋右鍵不跳選單（D-264）、按鈕角落標快捷鍵（D-265）、Esc＝返回鍵（D-266）；CDP 多指觸控實測正常。
   - 第 119 輪已做：localStorage 丟例外、玩到一半改尺寸／旋轉、四張圖↔標題換 12 次（heap 穩定）、四位 Boss 亂點與陣亡復活，都沒有錯誤（見 PROGRESS）。
   - 第 118 輪已做：亂點測試 14 趟沒有錯誤；燼牌牌桌烘成貼圖（D-262）。
   - 第 117 輪已做：通關後最擠的 ☰（星隕高原，暴怒＋深夜＋三個換地圖）、記憶本、操作設定（法杖）360×640／412×915 看過不改；playthrough 三把武器過。
   - 第 116 輪已做：vitest 全跑 401 項過；標題「✦ 回顧結局」整段 360×640、412×915（四位 Boss）看過不改；PROGRESS 合併第 103～114 輪。
   - 第 115 輪已做：正式版 vite preview 從標題真實點擊走到霧語森林、離線 reload 後四張地圖都能進（見 PROGRESS）。
   - 第 114 輪已做：新存檔長弓 360×640 前 400 秒、荊棘谷光門抵達長弓 240 秒看過不改。
   - 第 113 輪已做：`jg_memories`／`jg_encounters`／`jg_choices`／`jg_rt_controls` 等其他存檔鍵塞錯型別實機掃過都沒事，補 `tests/save-garbage.test.ts`；iPad 直／橫看過不改（D-261）。
   - 第 112 輪已做：讀檔檢查欄位型別（D-260：地圖紀錄、裝備、設定、燼牌戰績），壞存檔不再出現「Lv NaN」；新存檔法杖 390×844 前 400 秒看過不改。
   - 第 111 輪已做：Boss 已討伐 3 次以上不再重講攻略提示（D-259）；荊棘谷暴怒長劍 390×844、燼紅裂谷深夜法杖 360×640 240 秒重複文字掃完——所有地圖×武器×（一般／暴怒／深夜）的主要組合都掃過了，之後不用再排掃描。
   - 第 110 輪已做：README「畫面」精選 9 張＋「更多畫面」摺疊、標題截圖重拍（D-258）；燼紅裂谷長劍 412×915、荊棘谷深夜長弓、星隕高原深夜長劍、霧語森林暴怒法杖 240 秒重複文字看過不改。
   - 第 109 輪已做：版本 1.0.0＋README 成果發表版（D-257）；燼牌輸掉賭局／行商換貨後馬上離開沒有延遲公告；長弓／法杖霧語森林、法杖荊棘谷光門抵達 240 秒重複文字看過不改。
   - 第 108 輪已做：燼牌贏了賭局馬上離開，新牌改由場景補講（D-256）；燼紅裂谷法杖 360×640 光門抵達 240 秒重複文字、星隕高原長弓 360×640 240 秒（見 PROGRESS）看過不改。
   - 第 51～107 輪逐輪「已做」清單第 108 輪刪掉（太長），要查看 PROGRESS 或 git 歷史。這段期間的結論：Boss 見面／討伐／第二階段、光門、相遇、面板透字、重複文字、返回鍵、長螢幕都掃過，修正都記在 D-205～D-255。
   - 「撞牆暈眩！趁現在！」是同一個機制、提示有用，不改。索爾第一局落後就放棄是設計（`bailAt`），不改。
   - 快轉截圖的已知假象：受擊閃白 70ms 在低 fps 下幾乎每張都白；截圖前那 0.7 秒補間是即時跑的；相機淡入／閃光不推進；傳送後鏡頭還沒跟上。
   - Bot 不會去行商／點技能點；升級小字已寫「技能點 +1（☰ → 技能點）」，☰ 有紅點，等真人回饋。
   - **手機效能**：第 44 輪抽查過 JS（p50 約 1ms、p95 2.5～5.9ms），GPU 要等 Jacky 真機。
4. **打磨期（11/4 起功能凍結）之前**：新手引導第 35 輪看過程式，真人回饋再調。旅商／燼牌對手烘成貼圖**不做**。
5. **長弓／法杖的主角圖**：已完成（R-019，11/5）；真機聽 `SFX.bowShot`／`magicBolt`／`timeStop`／`voidOpen`。**不要再試「Bot 放風箏」**（D-148）。
6. **星隕高原第三輪（選做）**：還要更好就等 Jacky 回 FOR_JACKY 第 15 題排 GPT 圖。
7. **數值（等真人回饋）**：巡守太硬 → `mist_warden` HP 1050→900；巡獵者 1400→1200；岩王太難 → 6000／35（D-136）；守望者太難 → 8200→7400（D-138）；星蝕狼太硬 → 3600→3000（D-144）；長弓太強 → `ARCHER.atk` 31→30 或 HP 540→500（看 3 個種子以上再改）；長弓變化二太強 → 灼燒 30→25%、中毒 20→15%（D-149）；法杖太強 → `MAGE` HP 540→500 會讓通關機器人慢一倍（D-152），先降攻擊 33→31；抉擇的結晶 3／4／5 或折扣 10% 若真人覺得不平衡再調（`choices.ts`）。
8. PROGRESS 約 180 行（第 103～114 輪已在第 116 輪合併）；超過 300 行時再合併。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 401 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）——**第 26 輪起的做法**：範本存在 `scripts/zz-hash.template.ts.txt`（90 場），複製成 `tests/zz-hash.test.ts`；`git worktree add /tmp/claude-0/old <本輪開頭 commit>`＋`ln -s $PWD/node_modules /tmp/claude-0/old/node_modules`，兩邊各跑一次（`HASH_OUT=/tmp/claude-0/hash-old.txt` / `hash-new.txt`）再 `diff`，最後 `git worktree remove --force`（`tests/zz-hash.test.ts` 不在 git，新 session 照範本複製）。荊棘谷改動另跑 `tests/rt-thornvale.test.ts`。
- `RUNS=60 npm run sim:rt`（刷怪關會略過）；霧語森林測試 `tests/rt-mistwood.test.ts`（含 15 分鐘耐久）。
- 截圖：`npx vite preview --port 4173`（背景用 `setsid`），Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址加 `?debug` 才有 `window.__game`；即時戰鬥 `window.__rt.state()`。第 18 輪的 `screenshots/r18.mjs` 示範從標題點按鈕進森林、開 ☰、操作設定、拖曳按鈕。**無頭瀏覽器 Phaser 時間很慢（約 4 ticks/秒）**，長演出只能截到開頭；效能比較拿舊版當基準。
- 燼牌模擬：寫 `tests/zz-cardsim.test.ts`（gitignored）跑 `newCardGame(seed, [deck, who.deck], who.short)`＋`aiMove(g, side, who)` 400 場看勝率；調牌組時**先看斥候張數**（影響最大）。面板有除錯鉤子：`sc.menu.getData('reveal')('hero_echo')`、`sc.menu.getData('burn')([[0,0,'bear']])`（`sc = __game.scene.getScene('RtBattle')`，先 `sc.openCards()`）。
- 燼牌面板的座標：容器在 (360, GAME_HEIGHT/2)，390×844 視窗的頁面座標＝`(gx×390/720, gy×390/720)`、GAME_HEIGHT＝1558（D-142 之前是 `75.5＋…`、容器在 640）；手牌第 i 張 x＝(i%6−(n−1)/2)×110。莫托的回合在無頭瀏覽器要等 15～25 秒（delayedCall 是遊戲時間），太早點會點到停用的按鈕。腳本 `screenshots/r27d.mjs`（gitignored，新 session 要照這段重寫）。
- 短命特效（冰晶 1.9 秒、荊棘）在無頭瀏覽器截不到：包住畫圖函式、每幀把 `born` 拉回來（第 25 輪 `screenshots/r25e.mjs`）。
- 無頭瀏覽器不要用 `scene.update()` 快轉（會讓 Playwright 逾時）；要截演出就在頁面裡直接呼叫場景方法（例：`sc.spawnThorns({...})`、`sc.bossIntro(q)`、`sc.openShop()`），存檔用 `localStorage.setItem('jg_rt_mistwood', ...)` 後 reload。第 23 輪腳本 `screenshots/r23*.mjs`（gitignored）。
- 背景程式一律 `setsid`；不要 `pkill -f`／`pgrep -f ... | kill`（會殺到自己的 shell，第 22 輪又踩到），啟動時 `echo $! > pidfile` 再用 PID 殺。
- vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。`npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess`／`noUnusedLocals`／`noUnusedParameters`。
- Phaser：場景重啟不會清 `this.events` 自訂監聽器（註冊前先 `off` 或用 `once`）；相機 `zoomTo/pan` 的 ease 只認 `'Cubic.easeOut'` 這種名稱。

## 美術
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援；R-012～R-019 都已產好換進遊戲，目前沒有待產；星隕高原的守望者／魔像（程式美術）沒有排圖（額度不夠，FOR_JACKY 第 15 題問 Jacky）；**GPT 剩 0、Gemini 剩 3**。迷霧巡守（D-120）目前用霧狼圖染青色，沒有排新圖（額度留給 Boss）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
