# 下一步（依優先順序，最上面先做）

> 第 74 輪（10/31 14:45）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋**四張大地圖**（霧語森林→荊棘谷→燼紅裂谷（結局）→星隕高原（通關後挑戰），D-062／063／065／087／114／125／138）。主規格 `docs/design/20-swordsman-and-map.md`。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）。排程 ⭐ 方向對照：自由走動 ✅（大地圖）、自由買賣 ✅（D-116 行商）、自由點技能 ✅（D-110／112／121）、卡牌小遊戲 ✅（D-127～139 營火燼牌，五位對手）、碰到場景觸發劇情 ✅（D-134 序章、D-137 前世的記憶、D-133 通關演出、**D-159／160 路上的相遇（含護送）**）、**戀愛線依 D-063 停止，不做**。README 不放開發日誌，開發紀錄只寫在 PROGRESS。
> **加地圖的方法**（D-124）：`src/game/worldMaps.ts` 加一筆（稱呼、配色、decor、next、`postGame`、`bossLv`）＋ `maps/<id>.ts`（產生器在 `scripts/gen-*-draft.py`）＋敵人資料＋ `SPRITE`＋ 3 段記憶（`memories.ts`，測試會要求）；`tests/rt-world-maps.test.ts`／`memories.test.ts` 會自動檢查。新 decor 要處理：地面 `paint`（`starD` 範例）、`Ambient` kind、`drawVents`／vent 事件顏色。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。CI 的 Smoke test 有時要 13 分鐘（第 37 輪；卡在 `playwright install --with-deps` 的 apt），job 上限 15 分鐘——若之後開始逾時，再考慮快取瀏覽器或拿掉 `--with-deps`。**程式 commit 和 `[skip ci]` 的文件 commit 不要一起推**（最上面是 [skip ci] 時整次 push 都不跑）。

## 現況（第 74 輪）
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
3. **（下一輪建議主工作）「第一眼」第四十段＋11/4 打磨期準備**：①390×844 Boss 第一次見面（`shot-bossmeet.sh` 現在寫死 360×640，加 W H 參數）看 D-206 排隊後提示有沒有晚太久。②相遇選完 after 大字壓 NPC（舊小問題）在 360×640 用 D-206 的 avoid 思路看能不能順便避開（只修看得到的）。③新存檔前 20 秒教學提示很密（3／7／13／17／17／18 秒），想一下要不要把「小心石頭後的射手」延後（真人回饋前不大改）。④11/4 起功能凍結，之後只修 bug／平衡／新手引導。
   - 第 74 輪已做（第三十九段）：三個面板 360×640、荊棘谷／星隕高原／燼紅裂谷 Boss 第一次見面 360×640 → 提示往上疊不蓋主角（D-206）；FOR_JACKY 真機待驗清單（第 3 項）。
   - 第 73 輪已做（第三十八段）：光門距離字錯開、危險說明黑底（四張圖）、Boss 第一次見面 360×640（霧語森林 Lv1／Lv4、燼紅裂谷 Lv7）→ 建議等級搬到血條；「被發現了！」不浮在 HUD；音量四段（D-205）。
   - 第 72 輪已做（第三十七段）：流光見切、鏡像反射、碎甲斬、霜箭後躍、蝕魂彈凍結（碎甲斬、蝕魂彈加量，D-204）；新存檔三把武器 360×640 各 5 分鐘、老玩家四張圖 390×844 各 2 分鐘（只修了提示壓大招鍵）；README 賣點四張維持，新增 101～103；PROGRESS 第 60～65 輪合併。
   - 第 71 輪已做（第三十六段）：一般技能＋格擋（除流光見切、鏡像反射）凍結看過＋加量（D-203）；效能抽查 Graphics 指令多 10～25%（不處理）；README 60 重拍、新增 98～100；新存檔長劍 360×640 前 3 分鐘（休息字條換行）。
   - 第 70 輪已做（第三十五段）：大招全部凍結看過（劍刃風暴、星落一閃、流星雨、天穹一矢／星河貫射加量）、旋風斬持續旋風、四個相遇 360×640 取／助（盜賊、朝聖者「取」改成走開）、燼牌相遇回聲 360×640（標點換行）；README 24 重拍、新增 95～97。
   - 小問題（不改）：盜賊相遇旁 2 格是隱藏寶箱（選完連著出寶箱大字，有錯開）；相遇 after 大字壓在 NPC 上（上方沒空間）；兩個畫面外箭頭的距離字貼很近。
   - 第 68 輪已做（第三十三段）：README 62／75（大招，下緣硬切）、38／57（Boss 登場）、31（暫停選單）重拍；深夜荊棘谷老玩家 2 分鐘（長劍 390×844）、燼牌整理牌組 38 張（兩種尺寸）、回顧結局（360×640）、四張圖 Boss 登場。修了：深夜說明／隱藏精英提示每次開遊戲都講、Boss 登場疊字、紅「!」壓小地圖（D-200）。
   - 小問題（不改）：設定面板沒有音量（只有開關）；傷害數字可能落在懸賞板上（怪在那裡）；快轉截圖的受擊閃白讓深夜畫面偏粉紅（假象）。
   - 第 67 輪已做（第三十二段）：深夜燼紅裂谷老玩家前 2 分鐘（法杖 360×640）、行商賣到 0（兩種尺寸）、技能點重置後再點（長弓 390×844）、記憶 12/12（兩種尺寸）。修了：老玩家每次被教噴發、老玩家一直掛「點怪物開打」、行商賣空、記憶 12/12 收尾（D-199）。
   - 第 66 輪已做（第三十一段）：燼牌五位對手開場／結算（390×844）、行囊 60 滿（自動分解／撿不起來）、Bot 示範↔自己操作（360×640）、通關 Lv16 長弓回霧語森林 2 分鐘、標題（通關後、剛打倒狼王、設定、未開放提示）、通關玩家的 ☰。修了：行囊滿還說「撿到裝備了」、老玩家又被教營火、走過的圖掛 NEW、未開放提示離按鈕太遠、「!」壓地區名稱（D-198）。
   - 小問題（不改）：星隕高原懸賞板會掛「荊棘母樹 0/1（別圖）」（設計如此）；標題「回顧結局」快轉截圖底下按鈕淡淡透出（假象，veil 0.985）。
   - 第 65 輪已做（第三十段）：390×844 新存檔第一次打開（不閃地圖）、☰ 中途換武器三把（兩種尺寸）＋法杖操作設定、四張圖暴怒／深夜 Boss 第二階段、荊棘谷／燼紅裂谷光門抵達後往南到下緣。修了：深夜 Boss 第二階段三層大字、上緣外怪的「!」浮在 HUD 上（D-197）。
   - 小問題（不改）：換武器後從最近的營火重新出發，開場大字「往北穿過森林…」每次都重播（重新進入地圖，合理）；aggro「!」偶爾和地區名稱大字疊一瞬間；長弓在 Boss 腳本裡會自己後躍出巢穴被回滿（腳本只下 target 指令，真人會控距離）。
   - 第 64 輪已做（第二十九段）：四張圖 Boss 第二階段（390×844 三張、360×640 霧語森林）、Lv 不夠第一次碰 Boss、倒在狼王手上→醒來→再挑戰、新存檔 360×640 標題→序章→選武器。修了：上緣硬切亮線（加陰影）、紅圈畫出地圖、攻略提示蓋住 Boss、序章前閃地圖、跳字被切（D-196）。
   - 小問題（不改）：第二次碰上同一隻 Boss 完全沒提示（`bossMemo`），安靜剛好；傳送腳本把主角放在巢穴圈外會連續出「跑出巢穴的紅圈了」（真人走過去不會）。
   - 第 63 輪已做（第二十八段）：燼牌整理牌組 38 張、標題回來的玩家、荊棘谷 Lv5 倒下、行商背包 60 滿一鍵賣、暫停選單、記憶本、燼牌對索爾、新存檔長弓／長劍 360×640 前 4 分鐘。修了：牌組說明重複牌名、門字被重斬蓋住、Boss 戰擠在血條下、討伐時還叫你退回營火；加了 Boss 建議等級、標題 ▶（D-195）。
   - 小問題（不改）：燼牌下注贏的錢在無頭截圖裡「+708 金」淡出中看起來偏暗（真實時間補間）；Bot 示範一路衝 Boss，Lv2 就打（是 Bot 設定 `advanceTo`）。
   - 第 62 輪已做（第二十七段）：技能點面板（三把武器、兩種尺寸）點滿 5 級切變化；行囊 15 件、強化 +4→+6；燼牌對薇菈下注兩場到結算；操作設定。修了：解鎖提示疊字、隕星術兩行說明壓等級格、行囊長名字壓圖示／比較字孤字／強化結果字落在按鈕上、面板標題和 HUD 疊字、燼牌「追不上」還叫你出牌、門字間距；加了強化火花（D-194）。
   - 小問題（不改）：技能點面板在 390×844 下方留白多（按鈕在拇指範圍內）；燼牌結算大字下面還看得到最後一局的牌桌（沒有疊字）。
   - 第 61 輪已做（第二十六段）：光門抵達荊棘谷（長弓 390×844／長劍 360×640）、燼紅裂谷（長劍 360×640／長弓 390×844）、星隕高原（法杖 360×640）前 1～2 分鐘；行商買一件賣一件、燼牌練習一局（360×640）；霧語森林新存檔法杖 390×844。修了：營火說明解開開場大字的鎖（「長弓」小字疊開場大字）、記憶卡＋開場大字＋噴發說明同時出現、長地區說明壓小地圖、行商提示字壓說明字、精英箭頭錯開後蓋字條（D-193）。
   - 小問題（不改）：燼紅裂谷從光門抵達時偶爾一落地就有怪在旁邊開打（Bot 主動點的）；畫面上緣剛進畫面的怪偶爾還有箭頭一幀（快轉截圖時間差）。
   - 第 60 輪已做（第二十五段）：荊棘谷／燼紅裂谷／星隕高原暴怒快打 → 解鎖深夜；狼后第二階段；深夜霧語森林霧影狼、深夜燼紅裂谷熔核巡者。修了：解鎖公告和教學小字／討伐大字疊在一起、史萊姆撞牆搶大字、暫停選單透出門字（D-192）。小問題「墜星慢慢升起…」和撞牆暈眩貼近：一般怪已改小字，剩 Boss 撞牆時，不改。
   - 第 59 輪已做（第二十四段）：霧語森林 Lv10 暴怒狼王討伐 → 解鎖深夜 → ☰（390×844、360×640）切深夜 → 深夜開場；星隕高原／荊棘谷／燼紅裂谷深夜開場（390×844、360×640）；星蝕狼巡邏。修了：深夜說明和開場大字／記憶卡四層疊字、切深夜還說「歡迎回到」、暫停選單透出記憶卡、藥水鍵冷卻看不到瓶數（D-191）。（暫停選單門字第 60 輪已修。）
   - 第 58 輪已做：星隕高原 Lv15 守望者討伐→抉擇（還）→小星星→**番外　完**（新加）；三道回程門回霧語森林、「歡迎回到…」與目標字條；少年獵人回禮卡（360×640）；燼牌對伊妲一局（360×640）。修了：跟班當場出現、舊玩家目標字條、燼牌最後一局大字、門字被技能鍵蓋住（D-190）。
   - 小問題：剛經回程門抵達的畫面在快轉截圖裡偏白（淡入是真實時間，假象）。
   - 第 57 輪已做：燼紅裂谷新到前 2 分鐘（法杖）、礦工相遇面板、岩王討伐→抉擇→通關演出→光門→星隕高原番外幕名卡＋開場（長弓 360×640）、旅程／名單（360×640）。修了：結語「劍下」跟武器換字、通關前爆雷的「▶ 前往星隕高原」、箭頭壓地區名稱、星隕高原開場三組字疊在一起（D-189）。
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
8. PROGRESS 約 200 行（第 54～65 輪已合併）；超過 300 行時把第 66～71 輪合併成每日摘要。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 338 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
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
