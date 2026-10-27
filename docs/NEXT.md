# 下一步（依優先順序，最上面先做）

> 第 47 輪（10/27 21:15）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋**四張大地圖**（霧語森林→荊棘谷→燼紅裂谷（結局）→星隕高原（通關後挑戰），D-062／063／065／087／114／125／138）。主規格 `docs/design/20-swordsman-and-map.md`。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）。排程 ⭐ 方向對照：自由走動 ✅（大地圖）、自由買賣 ✅（D-116 行商）、自由點技能 ✅（D-110／112／121）、卡牌小遊戲 ✅（D-127～139 營火燼牌，五位對手）、碰到場景觸發劇情 ✅（D-134 序章、D-137 前世的記憶、D-133 通關演出、**D-159／160 路上的相遇（含護送）**）、**戀愛線依 D-063 停止，不做**。README 不放開發日誌，開發紀錄只寫在 PROGRESS。
> **加地圖的方法**（D-124）：`src/game/worldMaps.ts` 加一筆（稱呼、配色、decor、next、`postGame`）＋ `maps/<id>.ts`（產生器在 `scripts/gen-*-draft.py`）＋敵人資料＋ `SPRITE`＋ 3 段記憶（`memories.ts`，測試會要求）；`tests/rt-world-maps.test.ts`／`memories.test.ts` 會自動檢查。新 decor 要處理：地面 `paint`（`starD` 範例）、`Ambient` kind、`drawVents`／vent 事件顏色。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。CI 的 Smoke test 有時要 13 分鐘（第 37 輪；卡在 `playwright install --with-deps` 的 apt），job 上限 15 分鐘——若之後開始逾時，再考慮快取瀏覽器或拿掉 `--with-deps`。**程式 commit 和 `[skip ci]` 的文件 commit 不要一起推**（最上面是 [skip ci] 時整次 push 都不跑）。

## 現況（第 47 輪）
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
3. **（下一輪建議主工作）「第一眼」第十四段**：①**荊棘谷／燼紅裂谷的相遇與護送面板**在 390×844（相遇面板「助」的頁面座標見下方小抄；第 37 輪以後沒在長螢幕看過）；②**行商的賣出頁、強化（營火「行囊・強化」）**在 390×844 各開一次（第 47 輪只看了買的頁）；③通關演出第 3 段「這趟旅程」用有紀錄的存檔（Boss 討伐、時間）再看一次（第 47 輪是空存檔，全是 0）；④燼牌**隱藏對手伊妲**的大廳／回響特效在 390×844。只修看得到的問題。
   - 第 47 輪已看完（390×844）：標題、選單、設定、序章、選武器、結局（結語／旅程／名單／感謝）、燼牌大廳／我的牌組／對局（含霜寒、放棄）／結算／新牌、行囊（22 件）、技能點、行商買、暫停、前世的記憶、操作設定；360×800 新存檔 40 秒。
   - 第 46 輪已看完：四個 Boss 第二階段、燼牌下注局結算三種、新存檔前 90 秒（法杖、390×844）。
   - 快轉截圖的已知假象：受擊閃白 70ms 在低 fps 下幾乎每張都白；截圖前那 0.7 秒遊戲是即時跑的；相機淡入／閃光不推進。
   - Bot 不會去行商／點技能點；升級大字已寫「技能點 +1（☰ → 技能點）」，☰ 有紅點，等真人回饋。
   - **手機效能**：第 44 輪抽查過 JS（p50 約 1ms、p95 2.5～5.9ms），GPU 要等 Jacky 真機。
4. **README 截圖（選做）**：第 44 輪補了 83～85（左手＋歡迎回來、道謝、善意折扣）；第 45 輪技能鍵冷卻改成「名稱＋秒數」，舊截圖的冷卻鍵只有數字（不影響理解，有空再換）。
5. **打磨期（11/4 起功能凍結）之前**：新手引導第 35 輪看過程式，真人回饋再調。旅商／燼牌對手烘成貼圖**不做**。README 舊截圖 9:16 有黑邊，可接受。
6. **長弓／法杖的主角圖（選做）**：拿弓／拿杖的 Q 版圖（ART_REQUESTS，GPT 只剩 1，FOR_JACKY 第 17／19 題問）；真機聽 `SFX.bowShot`／`magicBolt`／`timeStop`／`voidOpen`。**不要再試「Bot 放風箏」**（D-148）。
7. **星隕高原第三輪（選做）**：還要更好就等 Jacky 回 FOR_JACKY 第 15 題排 GPT 圖。
8. **數值（等真人回饋）**：巡守太硬 → `mist_warden` HP 1050→900；巡獵者 1400→1200；岩王太難 → 6000／35（D-136）；守望者太難 → 8200→7400（D-138）；星蝕狼太硬 → 3600→3000（D-144）；長弓太強 → `ARCHER.atk` 31→30 或 HP 540→500（看 3 個種子以上再改）；長弓變化二太強 → 灼燒 30→25%、中毒 20→15%（D-149）；法杖太強 → `MAGE` HP 540→500 會讓通關機器人慢一倍（D-152），先降攻擊 33→31；抉擇的結晶 3／4／5 或折扣 10% 若真人覺得不平衡再調（`choices.ts`）。
9. PROGRESS 現在約 271 行；超過 300 行再合併第 36～40 輪。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 322 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
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
