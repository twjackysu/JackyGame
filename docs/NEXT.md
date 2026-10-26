# 下一步（依優先順序，最上面先做）

> 第 37 輪（10/27 00:50）更新；第 18 輪整理過：過時指示全部刪掉（Jacky 10/25 要求，D-089）。舊內容要查就看 git 歷史或 `docs/DECISIONS.md`。
> **現在的方向**：單人即時動作戰鬥＋**四張大地圖**（霧語森林→荊棘谷→燼紅裂谷（結局）→星隕高原（通關後挑戰），D-062／063／065／087／114／125／138）。主規格 `docs/design/20-swordsman-and-map.md`。設計文件索引：`docs/design/README.md`。
> 舊主線（回合制＋自由探索）**已刪除**（D-097）。排程 ⭐ 方向對照：自由走動 ✅（大地圖）、自由買賣 ✅（D-116 行商）、自由點技能 ✅（D-110／112／121）、卡牌小遊戲 ✅（D-127～139 營火燼牌，五位對手）、碰到場景觸發劇情 ✅（D-134 序章、D-137 前世的記憶、D-133 通關演出、**D-159／160 路上的相遇（含護送）**）、**戀愛線依 D-063 停止，不做**。README 不放開發日誌，開發紀錄只寫在 PROGRESS。
> **加地圖的方法**（D-124）：`src/game/worldMaps.ts` 加一筆（稱呼、配色、decor、next、`postGame`）＋ `maps/<id>.ts`（產生器在 `scripts/gen-*-draft.py`）＋敵人資料＋ `SPRITE`＋ 3 段記憶（`memories.ts`，測試會要求）；`tests/rt-world-maps.test.ts`／`memories.test.ts` 會自動檢查。新 decor 要處理：地面 `paint`（`starD` 範例）、`Ambient` kind、`drawVents`／vent 事件顏色。

## 每輪開頭先看
1. Jacky 有沒有回覆：`docs/FOR_JACKY.md` 的「回覆」、GitHub Issue、`git log --format='%an %s' -15` 看有沒有他的 commit。有就照他的答案先改。
2. `art-inbox/` 有圖 → `node scripts/import-art.mjs`（D-036；需要 `pip install "rembg[cpu]" --break-system-packages`）。
3. CI：同一輪連推多個 commit 會互相取消，只看最後一次結果。**程式 commit 和 `[skip ci]` 的文件 commit 不要一起推**（最上面是 [skip ci] 時整次 push 都不跑）。

## 現況（第 37 輪）
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
- 截圖：`localStorage.setItem('jg_weapon','staff')`（或 bow）；**不設 `jg_weapon` 的新存檔會在序章後跳選武器**；凍結模擬只畫畫面用 `sc.editing = true`；特效可直接 `sc.staffFx(x, y, ang, shape, ult, single, blink, status)`／`sc.bowFx(...)`；`window.__rt.send({ type: 'skill', id })` 放技能。
- 通關機器人 `tests/rt-campaign.test.ts`（新存檔→三個 Boss，不含星隕高原；劍、弓各一趟）。stateHash 基準：第 34 輪最後的 commit（第 35 輪沒動核心；本輪 89 場＋長弓 18 場與開頭相同；長弓那組的寫法在 PROGRESS 第 34 輪，`tests/zz-hashbow.test.ts` 是 mistwood／wolf_king × 種子 1–3 × 三組變化、Lv8、200 秒）。
- **畫面剔除（D-151）**：`draw()` 的單位迴圈、營火、掉落都會跳過畫面外的；新加的世界物件也要照做（`px/py` 超出 `GAME_WIDTH`／`VIEW_TOP`～`VIEW_BOTTOM`＋邊界就 `continue`）。量測腳本：Graphics `commandBuffer.length` 加總（第 33 輪 `screenshots/r33perf.mjs`）。

### 下一輪從這裡開始（依序）
1. **Jacky 有回覆就照他的答案先做**（FOR_JACKY 第 4～21 題）。
2. （PROGRESS 約 190 行；超過 300 行就合併第 30～35 輪。）
3. **相遇（選做，先等 Jacky 回 FOR_JACKY 第 21 題）**：他說「相遇減少」就把每張圖砍回一個（刪 `ENCOUNTERS` 第 4～7 筆、改測試數量、README）。沒回覆就**先不要再加**——現在 7 個已經夠，打磨期前把時間留給別的。真機待確認：護送路上婆婆被怪追時會不會出戲（純畫面、不受傷）；人物大小（`this.k * 2.1`）、氣泡會不會擋到怪。**不要**把抉擇／相遇做成永久戰鬥加成（D-157）。「會記仇的盜賊」（取了錢下次帶人埋伏）要動核心＝要重跑 stateHash，不做。
4. **（下一輪建議主工作）新存檔的「第一眼」檢查**：成果發表最重要的是 Jacky 打開的頭 3 分鐘。用 Playwright（390×844 與 360×640）從空的 localStorage 走一遍：標題 → 序章（點完）→ 選武器 → 霧語森林開場（截 5～8 張：開場大字、第一次接敵、第一次升級、營火、旅商），逐張看有沒有文字疊在一起（第 37 輪截圖看到：開場大字「往北穿過森林…」和區域名稱、相遇的大字會同時出現、疊在畫面中段）、按鈕被擋、提示太多。修掉看得到的問題；新手引導節奏（`showHint`／`tipOnce`／`tipBusy`）只做小調整。
5. **打磨期（11/4 起功能凍結）之前**：新手引導第 35 輪看過程式（`showHint`→開場大字→`tipOnce` 排隊，`tipBusy` 會擋重疊；升級大字已提示技能點），沒發現問題，真人回饋再調。旅商／燼牌對手烘成貼圖**不做**（有呼吸、眨眼動畫，而且已有畫面外剔除，只畫畫面內的 1～2 個）。README 舊截圖 9:16 有黑邊，可接受。
6. **長弓／法杖的主角圖（選做）**：拿弓／拿杖的 Q 版圖（ART_REQUESTS，GPT 只剩 1，FOR_JACKY 第 17／19 題問）；真機聽 `SFX.bowShot`／`magicBolt`／`timeStop`／`voidOpen`。**不要再試「Bot 放風箏」**（D-148）。
7. **星隕高原第三輪（選做）**：還要更好就等 Jacky 回 FOR_JACKY 第 15 題排 GPT 圖；星蝕狼／彗星巡者是霧狼染色；Bot 撿星光碎片。
8. **數值（等真人回饋）**：巡守太硬 → `mist_warden` HP 1050→900；巡獵者 1400→1200；岩王太難 → 6000／35（D-136）；守望者太難 → 8200→7400（D-138）；星蝕狼太硬 → 3600→3000（D-144）；長弓太強 → `ARCHER.atk` 31→30 或 HP 540→500（看 3 個種子以上再改）；長弓變化二太強 → 灼燒 30→25%、中毒 20→15%（D-149）；法杖太強 → `MAGE` HP 540→500 會讓通關機器人慢一倍（D-152），先降攻擊 33→31；抉擇的結晶 3／4／5 或折扣 10% 若真人覺得不平衡再調（`choices.ts`）。

## 其他（空檔再做）
- 操作設定後續：搖桿要不要「跟著手指」或固定、按鈕透明度（等 Jacky 回覆）。
- 新手難度：若真人回報太難，先降狼王 `hpPct`（100 → 70）。
- 隱藏精英若真人覺得太常出現，把 `hiddenElite.streak` 從 12 調到 15～20。
- 懸賞若太慢，把野狼數量 12～20 降成 8～14（`BOUNTY_POOL`）。
- 舊試玩小關卡（七關）只留給 ☰ 換關與模擬器；不要再加新的小關卡。

## 驗證小抄
- **commit 前一定要** `npm run build`（含 tsc）＋ `npx vitest run --exclude 'tests/zz-*'`（目前 272 項，約 1 分鐘；如果突然變很久，多半是某個 Bot 迴圈打轉到上限）。
- 場景檔不要寫出 `{ gold: …}`／`.gold +=` 這種字樣：`tests/game-api.test.ts` 會掃 `src/game/**`（獨立紀錄裡的金幣欄位因此叫 `coin`）。
- **舊關卡雜湊比對**（核心改動必做）——**第 26 輪起的做法**：範本存在 `scripts/zz-hash.template.ts.txt`（90 場），複製成 `tests/zz-hash.test.ts`；`git worktree add /tmp/claude-0/old <本輪開頭 commit>`＋`ln -s $PWD/node_modules /tmp/claude-0/old/node_modules`，兩邊各跑一次（`HASH_OUT=/tmp/claude-0/hash-old.txt` / `hash-new.txt`）再 `diff`，最後 `git worktree remove --force`。以下是舊說明：（`tests/zz-hash.test.ts` 不在 git，新 session 要照範本重寫）：第 24 輪起含荊棘谷共 90 場（荊棘谷用 `level: 6`＋`advanceTo: THORNVALE_QUEEN`、300 秒）；第 19 輪的範本在 PROGRESS 第 19 輪；寫暫時的 vitest（檔名 `tests/zz-*.test.ts`，已 gitignore；第 21 輪的 `zz-hash` 範本見 PROGRESS 第 19 輪），把 `Object.keys(STAGES)`＋霧語森林／測試大地圖 × 種子 1–3 × novice／normal／expert 的 `stateHash` 寫進檔案（共 81 場），`git stash push -- <改過的核心檔>` 前後各跑一次 diff。荊棘谷改動另跑 `tests/rt-thornvale.test.ts`。
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
