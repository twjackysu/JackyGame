# 下一步（依優先順序，最上面先做）

> ✅ **第 12 輪：D-063 的 P1 純 TS 戰鬥核心＋P2 無畫面模擬器第一版已完成**（`src/core/battle/rt/`，README 在該資料夾；取捨見 D-066；指標表見 PROGRESS 第 12 輪；`npm run sim:rt` 重跑）。下面 🎯 D-063 那一條的範圍都做了，除了：仇恨表（單人不需要，D-066）、大招（劍刃風暴，D-065 說之後補）。
>
> **第 12 輪尾也做好了 design/20 §B8 的 P1 試玩場景**：`src/game/scenes/RtBattleScene.ts`（`?debug&scene=RtBattle&stage=forest_entry`，`&bot=expert` 讓 Bot 打）。已在 `FOR_JACKY.md` 請 Jacky 試玩並回答 6 個手感問題。**依 D-065「一次做一個 Phase 並停下來等試玩」，下一輪不要開始森林地圖整合（B8 P2）**，除非 Jacky 已回覆。等待期間可以做：
> 1. **試玩場景打磨**（不改戰鬥規則）：60 FPS 插值（記上一 tick 座標，依 `acc/STEP_MS` 內插）；角色改用 Q 版圖（`hero_lian`、`enemy_*` 的現有 AI 圖縮小）＋程式剪影備援；預告加斜線紋（現在只有填色＋外框）；命中停頓（hit-stop 2～3 幀）；鏡頭跟隨主角（關卡大於畫面時）；技能鍵長按顯示說明。手機直式下按鈕位置用真機尺寸再確認（右下五顆鍵在 360px 寬手機上是否太擠）。
> 2. Playwright：截預告、閃避、格擋、狼王第二階段（`&bot=expert&seed=…`）；人工輸入路徑已驗證（搖桿移動、閃避、旋風斬）。
> 3. 數值與模擬器：大招（劍刃風暴，45 秒、40 MP）與 MP 回復規則（D-065 ②：上限 100、造成／受擊／格擋成功回一點）先做資料與測試，不放進試玩鍵位；一般房時間偏短（見下一條）。
> 4. 數值待校準（不急）：一般關卡時間比 design/19 §6 目標短（9～33 秒 vs 20～45 秒）；新手 Bot 打不過精英與狼王（等裝備接上再看）。

> 🧭 **D-065（Jacky 10/24 拍板 design/20）**：劍士技能組、森林單一地圖、死亡與回復規則已定；**劇情降為次要，可玩性優先**，不要再投入劇情改寫、遊戲記憶機制或結局。P1／P2 完成後的下一批（P3 森林地圖整合）請照 design/20 §B8 的順序，一次做一個 Phase 並停下來等 Jacky 試玩。大招 MP 來源、格擋窗口等實作註記見 D-065。
>
> 🎯 **第一優先（D-063，Jacky 10/24 拍板單人即時戰鬥）**：做 design/19 §8 的 **P1 純 TS 戰鬥核心＋P2 無畫面模擬器**，單人（不做同伴 AI、戀愛線、同伴技能）。範圍：`src/core/battle/` 新引擎（30 ticks/秒、連續座標、圓形碰撞、seeded PRNG、事件固定排序、整數座標、`stateHash`）、普攻與攻速、技能冷卻、**只有大招耗 MP**、閃避、敵人範圍預告（圓／扇形／直線／環形）、仇恨、狀態（秒計）、傷害公式沿用 design/18 §1.5（加算池 +150%）、劍士技能組暫用 design/20 §A6 的四技能（重斬、旋風斬、衝鋒、格擋反擊）＋閃避（資料驅動，`SkillDefinition{cooldownTicks, castTicks, targeting, effects[]}`，禁止 switch(skillId)；冷卻從施放開始計；待 Jacky 拍板可能調整）、敵人與霧角狼王資料、`BattleController` 與 Auto／基礎 Bot、批量模擬與 `MetricsCollector`。驗收：同場戰鬥跑 1,000 次結果一致。**不接 Phaser、不碰探索地圖整合、不刪舊戰鬥與同伴／戀愛程式。** 做完停下來，等 Jacky 決定探索地圖整合方式與 P3 畫面。
>
> ⛔ **D-062（10/24 晚，覆蓋下面「新戰鬥原型」一條）**：Jacky 改成**即時動作戰鬥**（RO／天堂式），回合制作廢。**不要實作回合制引擎、五指令、回合預告。** 即時戰鬥規格見 `docs/design/19-realtime-combat.md`（D-063 已採用，同伴與戀愛部分作廢）；除上一條 P1／P2 外，請只做下面的長尾基礎（強化／分解 UI、材料掉落、三層裝備 UI 等）與測試打磨。design/18 的公式、屬性、職業、技能、名詞表仍有效。
>
> 🎯 **第一優先（D-061，Jacky 10/24 拍板 design/18）：新戰鬥原型**。讀 `docs/design/18-combat-class-world-v2.md` §1、§2.2、§4，做：①新戰鬥引擎（HP/MP 回合制、預告鎖定、5 指令、傷害公式與加算池、狀態、速度順序，純 TS 放 `src/core/battle/`，不依賴 Phaser）②資料表（技能／狀態／敵人／敵人 AI／戰鬥配置，BattleState 與定義表分離）③9 個原型技能＋森林狼王等敵人④模擬器（design/18 §1.12 指標）與單元測試⑤5 場教學戰（連恩劍士＋瑟琳＋莉歐拉）。舊時機戰鬥可並存到新戰鬥驗收後再移除；存檔版本遞增。**不做**：伊歐、洛克、其他主角職業、技能樹、重鑄與詞綴效果、故事改寫、名詞全面改字、美術新單。原型出數據與可玩版後停下來等 Jacky 試玩。
>
> 🛑 **方向重定位（D-060，Jacky 10/24 晚，最優先閱讀）**：Jacky 決定**玩家自選職業、戰鬥系統整個重寫、全部美術重做、專有名詞全部換淺白詞**（細節與影響表見 `docs/design/17-repositioning.md`）。新設計（design/18）還沒出來，所以：
> - **暫停（不要做）**：戰鬥規則與敵人技能的改動、技能樹、**下面第 9 項的 2.7 三流派與 design/15 的星燼核心／傳說／神級／套裝內容**、第 8 項的故事修訂（design/16 §11）、玩家可見名詞的零散改字、`ART_REQUESTS.md` 新單。
> - **可以繼續做**：與職業無關的長尾基礎——第 3 項強化／分解 UI、第 4 項材料來源、第 5 項三層裝備 UI、第 6 項帶詞綴的裝備（只接 `stat` 類詞綴；`effect` 類先不接戰鬥）、第 7 項詞綴對齊（**詞綴名稱與效果文字避免使用 燈印／共鳴／星燼 等舊名詞**；效果框架 `effects.ts` 保留）。
> - 做完上述後若新設計仍未出現，就做打磨、測試與文件，**不要自己決定新職業或新戰鬥規則**。

> 📖 **故事修訂（D-055，優先度次於上一條的階段 1）**：Jacky 已採用「星燼＝記憶殘響」與「戀愛選擇／世界結局分開判定」。工作範圍與驗收見 `docs/design/16-story-upgrade.md` §11（只動文字與結局判定，不改系統）。design/16 其他項目、design/15 技能樹與裝備的方向已拍板（D-056、D-057），但**要等 14 的階段 1 與 2.1 完成後才做**，不要提前動。

> 🧭 **最高優先（D-053／D-054，design/14）**：階段 1 地基 ✅（第 11 輪，D-059）；階段 2 大半 ✅（2.1 效果框架、2.2 6 格資料＋欄位 UI、2.3 詞綴與保底、2.4 強化（D-058 校準）、2.5／2.6 重鑄與分解的邏輯＋API）。**影響玩家資產的程式一律寫在 `src/server/` 並經 `gameApi`**（`src/game/session.ts` 的 `gameApi`、`opId(kind)`；`tests/game-api.test.ts` 會擋場景直接改 `inventory/gear/gold/equipment`）。design/15 的方向已由 D-056、D-057 拍板（數值待模擬校準）；design/16 只有 D-055 兩件拍板（見上一條故事修訂）。
>
> **第 12 輪（10/24 22:12）已完成 3～6**：強化／分解／上鎖 UI、主線材料掉落（RULES_VERSION 3）、三層裝備 UI、掉落帶 `stat` 詞綴（見 D-064）。
>
> **長尾打磨（優先度低於最上面 🎯 D-063 的 P1／P2 即時戰鬥核心；P1／P2 做完等 Jacky 時再做）：**
> 1. **金幣經濟檢查**：第 12 輪機器人整場金幣常在 50～160，強化 +1～+5 一件要 235 金，買裝備與強化互搶。第 12 輪自動強化的機器人整場只強化 8 次、粉塵剩 55（金幣常在 50～80）——確定金幣是瓶頸；若一週目幾乎強化不到，考慮小怪金幣 +20%，或讓 Boss 多給一點金（RULES_VERSION +1）。
> 2. **商店出售選單**顯示實例差異：現在以模板分組、賣出時自動挑「強化最低→詞綴最少」的那件；若同模板有多件不同詞綴，玩家看不出賣的是哪件 → 出售清單改實例層級（同行囊候選的分組方式），上鎖的顯示 🔒 不能賣。
> 3. **強化入口補強**：只能從「行囊 → 裝備 → 點欄位」進入；可在營火／商店加「強化」捷徑、行囊 🎒 在「材料夠強化」時亮點。
> 4. 掉落卡片：詞綴已顯示；神級特效說明會往下讓位（`dy`）。真機上確認三張卡＋詞綴不擠。
> 5. **不要做**：NEXT 原第 7 項（詞綴對齊 D-057）——D-057 已被 D-060 作廢（D-064）；`effect` 類詞綴、技能樹、職業、故事與名詞改字、美術新單，都等 design/18／19 的原型過關。



> **10/24 13:20 插單**：Jacky 又上傳 6 張 Q 版戰鬥圖，已匯入成 `hero_<id>`（我方背影）與 `enemy_boss_valderan`（Boss）；`scripts/import-art.mjs` 支援 `<id>_battle.png` 與 `npc_<名稱>.png`。
> **第 7 輪（10/24 12:12）**：Jacky 上傳了 6 張 AI 立繪（連恩、伊歐、瑟琳、莉歐拉、洛克、瓦爾德蘭，`public/art/`）；其他有台詞的配角改為動漫風程式立繪（D-037；`src/game/art/animeKit.ts`、`animePortraits.ts`、`animeCompanions.ts`、`animeSprites.ts`）。預覽工具見下方「工具」。
> **設計已定稿（D-013）**。序章～終章全部可以玩到結局（三結局＋片尾統計），Boss 都有特殊機制（第 5 輪）；第 6 輪補了 README 截圖、新手引導、省電畫質、二週目。進度大幅超前 PLAN：接下來是**打磨、平衡檢查、成果發表素材**。LocationScene 暫不做（D-033）。
> 場景：`src/game/scenes/{Title,Dialogue,Map,Battle,Card}Scene.ts`；全域狀態 `src/game/session.ts`；劇本 `src/data/dialogue/ch0–ch5.ts`；章節地圖 `src/data/maps.ts`（`currentChapter`、`waiting`）；敵人/遭遇 `src/data/combatants.ts`（`phase2` 字卡、`mark`/`seal`、traits `erase`/`eyeShield`/`finale`）；羈絆 `src/data/bonds.ts` + `src/game/ui/bondPanel.ts`；片尾 `src/game/credits.ts`；燼牌 `src/data/cards.ts` + CardScene `OPPONENTS`；美術 `src/game/art/{silhouettes,backdrops,mapArt}.ts`；音樂 `src/audio/music.ts`（`chapterTrack`）。
> 除錯入口：`?debug&chapter=2|3|4|5&scene=Map`（建立前一章已完成的新存檔，會覆蓋本機存檔；`&join=serin,liora` 額外加同伴）、`?debug&scene=Battle&enc=boss_starfall_2&party=lian,serin,io&lv=17`、`?scene=Dialogue&script=ch3&node=academy`、`?scene=Cards&match=tourney_dealer`。

> 🎨 **美術需求**：需要 AI 圖時只寫進 `docs/ART_REQUESTS.md`（總額度 GPT 8／Gemini 12，目前排 GPT 4、Gemini 7），一律先做程式備援。R-001～R-009 已到貨並匯入（第 8 輪；Jacky 本機 Agent 也同時匯入，保留他 rembg 版的圖）。R-010（隊伍正面走路小人 `walk_*`）、R-011（鎮民 `walk_npc_*`）待產，ExploreScene 有圖會自動換。
> ⭐ **方向（D-038）：自由探索 RPG。** 讀 `docs/design/11-open-world.md`。**第 1 章已全部可走**（第 8 輪）：`src/data/areas/{greylamp,mistwood,wolfpath}.ts`；引擎 `src/game/scenes/ExploreScene.ts`＋`ExploreHudScene.ts`；純邏輯 `src/core/explore/{grid,area}.ts`（測試 `tests/explore.test.ts`）。序章後直接站在灰燈鎮；世界地圖上第 1 章所有地點都會走進對應區域（MapScene `GREYLAMP_/MISTWOOD_/WOLFPATH_NODES`）。
> 除錯：`?debug&scene=Explore&area=mistwood&spawn=north`；`window.__explore.{goto(id), tap(x,y), pos(), objective(), entities(), setFlags({...}), busy()}`。機器人在 Explore 場景會 `goto(objective)`，沒有目標就回世界地圖。

> ⭐ **第 9 輪（10/24 16:11）完成**：E3 商店與裝備、E4 技能樹 v1、E5 營火羈絆 v1、第 2 章（`minecamp`＋`mine`）與第 3 章（`capital`）可走、第 1 章支線 ×2、等級差逃跑。相關檔案：`src/data/{equipment,skillTree,sideQuests}.ts`、`src/data/dialogue/camp.ts`、`src/core/state/{equip,skillTree}.ts`、`src/game/ui/{shopPanel,bagPanel,gearUi}.ts`、`src/data/areas/{minecamp,mine,capital}.ts`。

> ⭐ **第 10 輪（10/24 18:12）完成 Jacky 17:30 的指示（D-049）**：稀有／神級掉落（`src/data/drops.ts`、`equipment.ts` 的 `rarity`/`perk`/`source`、engine `Perk`、BattleScene `showDrops`、行囊「收藏」頁）、技能樹 v2（`src/data/skillTree.ts` 版型 A→B/C→D→E→U、`src/core/state/skillTree.ts` 的 `rankOf/missingText/branchPoints/resetCost/treeSkills`、5 個 `tree: true` 主動技能、bagPanel 樹狀圖）；Boss 數值上調（D-050）；地圖裝飾物件＋隱藏寶箱（D-052）；城鎮約會 ×4（D-051，`src/data/dialogue/dates.ts`）；機器人自動配裝點技能（`src/core/state/autoBuild.ts`）。

A0. **機器人**：第 10 輪 autobuild（自動配裝點技能）從新遊戲全程通關 1076 秒；Boss 上調後第 4 章→結局 487 秒。做完任何改動後，背景跑一次從新遊戲到 `ch5_complete`（約 20 分鐘）。
A1. **掉落／技能樹打磨**：①掉落卡片已可點畫面加速；真機上再確認節奏；②（已做：第一次掉裝備會提示去行囊換）；③（已做：技能樹兩段式點選）；④主動技能在戰鬥中的專屬演出（現在共用技能字卡＋閃光；千燈共鳴可加五盞燈依序飛入、梭哈可加硬幣翻轉）；⑤（已做：收藏頁未取得顯示圖示剪影）。
A2. **E5 第二版剩下的**：羈絆事件（`bonds.ts` 的 `bond_*`）目前仍綁在劇情節點；可把一部分改成「好感門檻＋到地點」（和約會同一套 `date`/`when`）；同伴閒聊泡泡已依好感加親近台詞（`BANTER_CLOSE`，好感 ≥ 50）。
A3. **地圖品質（E6 收尾）**：裝飾物件已加（`props`），但地形仍是「長方形房間＋走廊」：加彎道、寬窄變化；王都夜市可再加攤位（噴水池已換成真的噴泉）；`引路之光` 謎題（11-open-world §2.1）還沒做。
A4. **商店依章節進貨**（`ShopDef.stock` 加 `requires`），王都商店後期多幾件；普通裝備的小特效（星燼提燈「開場燈印 +1」等）可改用 `perk` 機制做弱化版。
A5. 第 1 章探索小項：建築內部仍是「門 → 直接跑劇本」；古燈塔是程式建築（可在 ART_REQUESTS 加 `prop_lighthouse_ruin`）。

0. **【每輪開頭都做】檢查 Jacky 有沒有上傳手繪立繪**：`art-inbox/` 有圖或 GitHub 有標題含「立繪」的 Issue → `pip install "rembg[cpu]" --break-system-packages`、`node scripts/import-art.mjs`（流程見 D-036）；手繪會自動取代同名程式立繪。沒圖就照常往下做。
1. **配角程式立繪與手繪主角的畫風落差**：主角群是 AI 厚塗，配角是賽璐珞程式繪。可做：配角立繪加一層柔光／顆粒（`ensurePortrait` 畫完後 soft-light 漸層＋邊緣暈影）讓質感接近；或在 FOR_JACKY 已請 Jacky 補 `npc_tia`／`npc_gwen`／`npc_bern`。
2. **戰鬥圖已換成 Jacky 的 Q 版手繪**（程式背影 `animeSprites.ts` 只剩備援）：README 戰鬥截圖要重拍；檢查多段攻擊／死亡（灰化 tint）／PERFECT 演出在手繪圖上是否正常；敵人仍是程式剪影，Boss 瓦爾德蘭是 Q 版正面，跟其他敵人畫風有落差——可考慮請 Jacky 補 Boss（狼王、鐘喉蠕蟲、洛克、蝕星者）Q 版正面圖（檔名 `enemy_boss_wolfking.png` 等，需先在 import-art 加對應）。
3. **截通關存檔的「新的旅程」確認框**（三顆按鈕：二週目／覆蓋／取消；需要有 `ch5_complete` 的存檔，可用機器人通關後的頁面或在 console 設 flag 後 `session.save()`）。勝利畫面已確認（README 10-victory）。
4. **README 截圖更新**（標題／戰鬥／羈絆／對話已在第 7 輪重拍）：燼牌已換成對局中段（新紋章，`screenshots/cards.mjs` 寫法：等 `canAct()` 後 `act(playsFor(i)[0])`）；可再加一張片尾統計（`getScene('Dialogue').rollCredits()`；直接呼叫沒有暗幕，要先加全螢幕黑色 rectangle depth 400，或讓機器人從 `?chapter=5` 跑到終幕再截）。燼牌紋章在小卡上偏小（左上點數會擋到），可微調 `drawEmblem` 半徑/位置。`node scripts/promo.mjs http://localhost:4180/ screenshots/promoN <名稱,...>` 可以只截指定幾張。
5. **燼牌對局手感**：拖曳出牌若在 AI 回合結束 render 時按住會失效（極少見）。（收藏入牌組的勝率影響已模擬：+0～8%，見 D-031，不用調。）
6. **全員共鳴演出節奏**：fxFinale 約 3 秒，真機前無法確認；可加「點擊加速」。
7. **羈絆事件覆蓋率檢查**：每位同伴羈絆事件（`src/data/bonds.ts`）在劇情中是否都能觸發；機器人跑一次蒐集 `bond_*` 旗標。
8. **蝕星者第二段回合數約 12–13**；真機若仍偏長再降。
9. **效能**（新增：立繪是執行時 canvas 繪製，DialogueScene／Title 建立時一次畫 ~20 張 600×900，低階機可能卡一下 → 可改成第一次用到才畫）：在 swiftshader 下量各場景 draw call／粒子數，找最重的場景（多半是 Battle 的 preFX glow）；省電畫質已可手動/自動開。

## 已知技術待辦 / 調整
- 狼王模擬新手勝率 94%；鐘喉蠕蟲新手偏低（D-021，已有不屈之燈 D-024 補償）；瓦爾德蘭新手會淨化 58%（不屈之燈補償）。
- 第 6 輪全程機器人：第 2 章「翻倒的礦車」力量檢定失敗會重複挑戰（機器人警告但會繼續），不是 bug。
- `weakRevealed` 只是顯示用狀態，傷害公式不讀。
- headless 約 1fps，Phaser 的場景時間跑得比真實時間慢：截演出要等 10–20 秒。
- 燼牌 AI：實測不弱（D-030），不用調。
- CI（含 Playwright 煙霧測試）、Pages、Android APK 第 5 輪全綠（CI 約 3–7 分鐘）。

## 工具與注意事項
- **立繪預覽**（不用開遊戲）：寫 `/tmp/.../entry.ts` import `drawXxx` 畫到 600×900 canvas → `npx vite build -c <lib config：formats iife>` → Playwright 開本機 html 截圖（Playwright 腳本要放在 repo 內 `screenshots/` 才找得到套件）。第 7 輪的做法見 PROGRESS。
- 立繪座標系：600×900，臉中心 x=300、眼睛 y≈305、下巴 y=432、肩線 y≈500；`drawNeckAndFace(c, 300, FaceStyle)` 畫脖子/耳朵/臉/陰影/腮紅，五官另外畫。對話顯示時 900→600px（0.667 倍），canvas y>735 會被對話框蓋住。
- **機器人會自動配裝點技能**（`window.__auto(area)`，`src/core/state/autoBuild.ts`；`AUTOBUILD=0` 關閉）。兩個機器人可以同時跑：各自 build 到不同 outDir、不同 port。
- **機器人**：`npx vite build --outDir /tmp/claude-0/bot/dist --emptyOutDir`、`(setsid python3 -m http.server 4180 -d /tmp/claude-0/bot/dist > /dev/null 2>&1 &)`、`(setsid env GOAL=ch5_complete EXPECT_AFTER=Map WORKAROUNDS=0 node scripts/playthrough.mjs "http://localhost:4180/?debug&chapter=5&scene=Map" /tmp/claude-0/bot/ch5 25 > log 2>&1 &)`。從新遊戲（`?debug` 不加 chapter）到結局約 18–20 分鐘；單章約 3–4 分鐘。達成目標後最多等 90 秒（片尾字幕約 30 秒）。
- **背景程式一律用 `setsid`**，否則 Bash 呼叫結束或被殺時 server 會一起死。**不要 `pkill -f`**（會殺到自己的 shell，exit 144）；用 PID。
- 成果發表截圖：`scripts/promo.mjs`（9:16 視窗；標題要加 `skipIntro`，否則 headless 下淡入太慢整張偏暗）。
- 截圖：一次性 Playwright 腳本放 `screenshots/`（gitignored），`executablePath: '/opt/pw-browsers/chromium'`，網址要加 `?debug` 才有 `window.__game`。可直接呼叫場景私有方法（例：`getScene('Battle').starStage()`、`playOne({type:'finale',enemy:1,lamps:10})`、`getScene('Dialogue').rollCredits()`；地圖 ♥：找 `children.list` 中 text==='♥' 的物件 `emit('pointerdown')`）。長腳本用 `setsid timeout N node x.mjs &` 再 sleep 輪詢，避免 Bash 逾時把它殺掉。
- 模擬數值：vitest 裡 `console.log` 可能被吞，用 `(globalThis as any).process.stdout.write(...)`。
- `npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。tsconfig 開了 `noUncheckedIndexedAccess` / `noUnusedLocals` / `noUnusedParameters`。
- Phaser 相機 `zoomTo/pan` 的 ease 只認 EaseMap 名稱（`'Cubic.easeOut'`），不像 tween 會轉換 `'Cubic.Out'`（有測試）。
- 對話選項容器 `ui.list` 前 N 個必須對應選項（機器人依賴），額外 UI 要加在後面。
- Phaser 場景重啟不會清 `this.events` 自訂監聽器 → 註冊前先 `off`。
- 子代理（Agent 工具）會阻塞到完成；先把自己的工作做完或同一則訊息平行派多個。
