# 下一步（依優先順序，最上面先做）

> 第 57 輪（10/30 04:45）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋**四張大地圖**（霧語森林→荊棘谷→燼紅裂谷（結局）→星隕高原（通關後挑戰），D-062／063／065／087／114／125／138）。主規格 `docs/design/20-swordsman-and-map.md`。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）。排程 ⭐ 方向對照：自由走動 ✅（大地圖）、自由買賣 ✅（D-116 行商）、自由點技能 ✅（D-110／112／121）、卡牌小遊戲 ✅（D-127～139 營火燼牌，五位對手）、碰到場景觸發劇情 ✅（D-134 序章、D-137 前世的記憶、D-133 通關演出、**D-159／160 路上的相遇（含護送）**）、**戀愛線依 D-063 停止，不做**。README 不放開發日誌，開發紀錄只寫在 PROGRESS。
> **加地圖的方法**（D-124）：`src/game/worldMaps.ts` 加一筆（稱呼、配色、decor、next、`postGame`）＋ `maps/<id>.ts`（產生器在 `scripts/gen-*-draft.py`）＋敵人資料＋ `SPRITE`＋ 3 段記憶（`memories.ts`，測試會要求）；`tests/rt-world-maps.test.ts`／`memories.test.ts` 會自動檢查。新 decor 要處理：地面 `paint`（`starD` 範例）、`Ambient` kind、`drawVents`／vent 事件顏色。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。CI 的 Smoke test 有時要 13 分鐘（第 37 輪；卡在 `playwright install --with-deps` 的 apt），job 上限 15 分鐘——若之後開始逾時，再考慮快取瀏覽器或拿掉 `--with-deps`。**程式 commit 和 `[skip ci]` 的文件 commit 不要一起推**（最上面是 [skip ci] 時整次 push 都不跑）。

## 現況（第 57 輪）
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
3. **（下一輪建議主工作）「第一眼」第二十三段：番外打完與回頭路**：①星隕高原 Lv15（劍、390×844）打星骸守望者（12% 傳過去）→ 星隕抉擇 → `codaLine`／結語有沒有、星蝕狼深夜提示；②從回程門一路回霧語森林（`gateBack` ×3），每張圖的「歡迎回到…」`returnIntro`、回禮卡（LS 先給 `jg_encounters` spare）、回程門字有沒有互壓；③燼牌 360×640 對伊妲一局；④只修看得到的問題。
   - 第 57 輪已做：燼紅裂谷新到前 2 分鐘（法杖）、礦工相遇面板、岩王討伐→抉擇→通關演出→光門→星隕高原番外幕名卡＋開場（長弓 360×640）、旅程／名單（360×640）。修了：結語「劍下」跟武器換字、通關前爆雷的「▶ 前往星隕高原」、箭頭壓地區名稱、星隕高原開場三組字疊在一起（D-189）。
   - 小問題沒修：390×844 燼紅裂谷出生點的回程門字「▼ 回荊棘谷」被右下技能鍵蓋住（門在營火東南，世界物件，走開就看得到）。
   - 第 56 輪已做：新存檔序章→選武器（劍／弓）→第一幕幕名卡只播一次（選弓 `scene.restart` 後才播）；Lv8 狼王討伐→抉擇→光門→荊棘谷第二幕（360×640）；荊棘谷→燼紅裂谷、燼紅裂谷→星隕高原、回程門。修了：寶箱提示和幕名卡疊字、回程門字太早、長螢幕字條蓋主角；新增從門前降臨（D-188）。
   - 第 55 輪已做：光門延後亮起、箭頭、過場、幕名卡（D-187）。燼紅裂谷討伐→演出→門的順序已用 Playwright 確認。
   - 第 54 輪已看完：新存檔前 3 分鐘三把武器（390×844）、Lv4 第一次打狼王→討伐→抉擇面板。舊的第 3 項標題：「新玩家前 10 分鐘」。①新存檔（不設 `jg_weapon`）走一次序章→選武器→霧語森林前 3 分鐘，三把武器各一次（390×844），看教學提示、第一次升級、第一張懸賞、第一次撿裝備有沒有互壓或太吵（快轉截圖每 15 秒一張）。②第一次打狼王（Lv 4～6、劍）看登場→預告→第二階段→討伐→抉擇面板整段。③只修看得到的問題。
   - 第 53 輪已看完：長弓／法杖打燼心岩王、星骸守望者（登場＋第二階段，390×844）、星隕高原開場、燼牌（索爾、傳奇卡、整理牌組）、序章、通關旅程、技能變化面板。
   - 第 52 輪已看完：荊棘谷開場（長弓）、星隕高原開場與 75 秒（法杖）、燼紅裂谷 80 秒（法杖 360×640）、深夜暴怒狼王（360×640）、狼后（長劍／長弓）、行囊與記憶本（360×800）。
   - 第 51 輪以前已看完的見 git 歷史。
   - 「撞牆暈眩！趁現在！」是同一個機制、提示有用，不改。索爾第一局落後就放棄是設計（`bailAt`），不改。
   - 快轉截圖的已知假象：受擊閃白 70ms 在低 fps 下幾乎每張都白；截圖前那 0.7 秒補間是即時跑的；相機淡入／閃光不推進；傳送後鏡頭還沒跟上。
   - Bot 不會去行商／點技能點；升級小字已寫「技能點 +1（☰ → 技能點）」，☰ 有紅點，等真人回饋。
   - **手機效能**：第 44 輪抽查過 JS（p50 約 1ms、p95 2.5～5.9ms），GPU 要等 Jacky 真機。
4. **打磨期（11/4 起功能凍結）之前**：新手引導第 35 輪看過程式，真人回饋再調。旅商／燼牌對手烘成貼圖**不做**。
5. **長弓／法杖的主角圖（選做）**：拿弓／拿杖的 Q 版圖（ART_REQUESTS，GPT 只剩 1，FOR_JACKY 第 17／19 題問）；真機聽 `SFX.bowShot`／`magicBolt`／`timeStop`／`voidOpen`。**不要再試「Bot 放風箏」**（D-148）。
6. **星隕高原第三輪（選做）**：還要更好就等 Jacky 回 FOR_JACKY 第 15 題排 GPT 圖。
7. **數值（等真人回饋）**：巡守太硬 → `mist_warden` HP 1050→900；巡獵者 1400→1200；岩王太難 → 6000／35（D-136）；守望者太難 → 8200→7400（D-138）；星蝕狼太硬 → 3600→3000（D-144）；長弓太強 → `ARCHER.atk` 31→30 或 HP 540→500（看 3 個種子以上再改）；長弓變化二太強 → 灼燒 30→25%、中毒 20→15%（D-149）；法杖太強 → `MAGE` HP 540→500 會讓通關機器人慢一倍（D-152），先降攻擊 33→31；抉擇的結晶 3／4／5 或折扣 10% 若真人覺得不平衡再調（`choices.ts`）。
8. PROGRESS 第 54 輪後約 190 行（第 42～47 輪已合併）；超過 300 行時再把第 48～53 輪合併。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 330 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
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
- 需要 AI 圖只寫進 `docs/ART_REQUESTS.md`（遵守額度上限），一律先做程式備援；待產 R-013 棘冠狼后（GPT，P1）、R-014 棘背狼（Gemini，P2）、R-012 荊棘母樹（GPT，P2）、R-016 燼心岩王（GPT，P2）、R-015 荊棘巡獵者（Gemini，P3）、R-017 熔渣史萊姆（Gemini，P3），都有程式備援；星隕高原的守望者／魔像（程式美術）沒有排圖（額度不夠，FOR_JACKY 第 15 題問 Jacky）；**GPT 剩 1、Gemini 剩 4**（扣掉已排定）。迷霧巡守（D-120）目前用霧狼圖染青色，沒有排新圖（額度留給 Boss）。完成或作廢的項目移到「已完成／已取消」，不要留在待產。
