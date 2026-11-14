# 下一步（依優先順序，最上面先做）

> **第三期「品質優先」（11/10～11/30，D-336）**：不重做遊戲，提升品質、樂趣、留存。評估與排序 `docs/design/27-quality-review.md`；時程 `docs/PLAN.md`（A 11/10–14 低成本高效果｜B 11/15–22 核心玩法｜C 11/23–27 12:00 擴充整合｜11/27 12:00 凍結｜**11/30 12:00 最終版**）。
> **改善順序**：Level 1 參數 → 2 局部（特效、動畫、UI）→ 3 擴充既有系統 → 4 新系統；要大改先在 DECISIONS 寫六點理由。每項都要說得出「玩家會感覺到什麼不同」，附前後截圖。
> **不能退步**：敏感邏輯只在 `src/core`／伺服器（特效只在 `src/game`，由事件驅動，不能影響戰鬥結果）；main 永遠能 build、能通關；離線版完全離線。後端規格 24／25／26 照舊（`game` schema、不碰 `dbo` 與 8 張舊表、`GAME_DB_CONNECTION_STRING`）。
> 每一步都跑 `npm run typecheck`、`npm run lint`、`npm run build`、`npx vitest run`；改數值要 `npm run wiki`。
> 遊戲現況：單人即時動作戰鬥＋四張大地圖、三把武器、技能點＋變化、行商、強化、拍賣所、交易、競技場。**沒有「深淵」模式**（最接近的是深夜／騷動／暴怒 Boss）。

## 🔴 Jacky 11/12 的指示：燼牌拿掉（**verified**，D-379，3181853）；「賭博的形式可以用在其他方式」＝**① 的最小樣本上線（verified，D-383，11f7f31、160fbe0），等他試玩回饋**
- 燼牌相關程式、伺服器方法、測試、截圖都刪了；下面舊筆記裡提到燼牌面板／`openCards`／`jg_cards` 的段落都已過時，不用理。營火旁的薇菈／葛倫／索爾留著（`CAMP_FOLK`）。
- **① 蓋著的牌（第 184 輪）**：祝福三選一第二手起多一張；35% 兩個祝福／35% 一個／30% 一個＋燼痕（被敵人打到 +20%，最多 3 層）。`tests/rt-bless-gamble.test.ts`、`docs/screenshots/bless-gamble.jpg`。開關 `BLESS_GAMBLE.on`。**好不好玩、機率與代價順不順——等 Jacky 實機**；他回了就照他的調。
- 其他候選（Jacky 點名才做，一次一個最小樣本）：②行商／營火旅人賣**未鑑定的裝備** ③強化失敗後的**「再賭一次」** ④Boss 前向旅人**下注**。結算都要在 core／server。

## 🔴 Jacky 11/10 19:30 的指示（對話裡直接說的；排在所有東西前面，照順序做）
> 原話：①「我覺得全部都不用自己點比較好」→ 問他要到哪一層，他選**「技能全自動，閃避和藥水手動」** ②「格擋反擊感覺確實不太適合自動，**整組技能換掉吧**」③「衝鋒和弓和杖的那個看要不要也換掉，確實不太適合自動」④「由於是自動施放，**畫面好像也不用留那個區塊給人按了**」。決策與設計方向 D-344。

| ID | 子項 | 驗收 | 狀態 |
|---|---|---|---|
| P1-c0 | 大招預設自動＋設定版本遷移 | 測試 | **verified**（19:35，`tests/settings-auto-migrate.test.ts`） |
| P1-c1 | 第 4 欄（`parry`）9 招換成攻守一體（護盾＋打一下） | 每招行為測試、campaign、PvP 平衡、舊裝備、截圖 | **verified**（第 160 輪，D-345；`tests/rt-guard.test.ts`、`docs/screenshots/p1c1-guard-skills.jpg`；護盾量手感等 Jacky 實機） |
| P1-c2 | 第 3 欄（`charge`）9 招換成不位移的遠距／控場招 | 同上 | **verified**（第 162 輪，D-350；`tests/rt-slot3.test.ts`、`docs/screenshots/p1c2-slot3-skills.jpg`；**競技場沿用原本的位移招** `ARENA_CHARGE`；手感等 Jacky 實機） |
| P1-c3 | 五欄全自動（`AUTO_SKILL_VERSION` 4） | 測試 | **verified**（第 162 輪；`tests/settings-auto-migrate.test.ts`、`docs/screenshots/p1c2-all-auto.jpg`） |
| P1-d | 戰鬥畫面收掉技能鍵區塊 | 390／360 寬截圖；手動的鍵還按得到 | **verified**（第 160 輪；`docs/screenshots/p1d-compact-skill-row.jpg`）：自動的技能縮成底部一排小冷卻圖示、切回手動才是大鍵、閃避放大。**還沒做**：操作設定面板裡的說明字沒改（調位置時照舊顯示七顆大鍵）、營火捷徑列仍照舊的大鍵位置避讓（保守，沒有重疊）、小圖示只有兩個字（要不要畫圖示等 Jacky 看過）。位移欄還是手動，所以現在右下還有一顆大鍵（衝鋒／後躍射擊／閃現），P1-c2 上了就沒有 |

**主角走路（D-391，`awaiting_visual`，等 Jacky 實機）**：參數都在 `fx/heroWalk.ts` 的 `HERO_WALK`；他回了就照他的調。候選的下一步（他說還不夠才做）：①圍巾／衣襬飄動 ②競技場的主角也分件 ③怪（狼）的腳——同一招要先看圖切不切得開。

**第 202 輪注意（被圍住看得到主角 D-404、開場說明的位置 D-405）**：
- `fx/occlude.ts`：`crowdCoversHero`（重疊面積 ≥ `CROWD_COVER_MIN`）、`OCCLUDE.crowdGhost`（疊畫的主角多實）、`barOverHero`／`BAR_OVER_HERO_ALPHA`；`fx/introLane.ts`。開關 `OCCLUDE.crowd`、`sc().barFade`、`sc().introLow`。
- 拍法：`node scripts/shot-cover.mjs staff starfall tag`（`N=3` 三隻小怪、`ELITE=1` 精英、`OFF=1` 舊樣子；**改過 `occlude.ts` 要重開 vite**，不然 `OFF` 動到的是另一份模組）；`node scripts/shot-survey.mjs 武器 地圖 tag`＝自然打鬥整頁巡看（`INTRO_OFF=1`、`W=360 H=640`）。一次開超過三個瀏覽器會被砍。
- **還沒做（依序）**：①精英的金框血條和傷害數字還是會壓在主角臉上（這輪沒動）②「找到隱藏寶箱！」＋獎勵字條壓在主角頭上的怪身上（星隕出生點旁的寶箱）③兩隻晶殼魔像的紅圈預告疊在一起時中間一塊很實的紅 ④第 201 輪列的 ①～⑤。

**第 201 輪注意（法杖護盾晶片 D-402、受傷紅字 D-403）**：
- `fx/hexPlates.ts`（`HEX_PLATES`：圈的大小 `ring`、晶片大小 `plate`、起始比例 `from`）；畫在 `fieldFx.hexShield`，開關 `sc().ffx.plates`。`fx/hurtLane.ts`（`HURT_LANE.side`／`up`），開關 `RtBattleScene.hurtLane`。
- 拍法：護盾＝`UNTIL='(()=>{const s=sc().s;return s.tick>300&&s.events.slice(-30).some(e=>e.type==="guard"&&e.tick>=s.tick-1)&&s.units.some(u=>u.side==="enemy"&&!u.dead&&Math.hypot(u.x-s.units[0].x,u.y-s.units[0].y)<200)})()' LEVEL=14 DSF=2 node scripts/play.mjs staff emberrift tag 16 90`；紅字＝UNTIL 等 `e.type==="damage"&&e.dst===s.units[0].id`，**開關寫在 UNTIL 最前面**（`sc().hurtLane=false;`）跑兩次，同一條指令兩次的畫面一樣，可以直接上下對照。主角在 `(W/2, H/2)` 附近。
- **還沒做（依序）**：①「護盾 +N」在頭頂正上方，怪站在主角上方時壓到怪 ②選定祝福的大字（「祝福：斬首」）壓在主角上方的怪身上 ③緩速箭頭在紫色的怪身上不突出 ④冰霜新星出手那圈粗白環（兩輪都沒拍到；要用 `REC` 選到冰的打法）⑤競技場的受傷數字沒走身邊 ⑥第 197、198 輪列的其餘候選。

**第 200 輪注意（狀態記號 D-401）**：
- `fx/statusMarks.ts`（`STATUS_MARK` 顏色與緩速箭頭的速度／下沉量／支數；`drawSlow` 裡的 `w` 是箭頭大小）。開關：`RtBattleScene.slowMark`、`poisonDot`；`PvpScene.dotFx`。競技場的 `r` 是碰撞半徑（約 18px），記號用 `mr`（立繪寬 ×0.46）排。
- 拍法：競技場＝`INJECT=slow STATUS=slow NSTAT=1 PAIR='sc().dotFx=false; 1' DSF=3 node scripts/shot-pvp.mjs tag`（`INJECT` 可以是 burn／poison／slow／break／weak；頁面裡 `console.log('DBG …')` 會印出來）；冒險地圖＝`play.mjs` 的 `UNTIL` 等怪身上有 `slow`、`PAIR='sc().slowMark=false; draw=true; __game.step(T,0); 1'`。**PAIR 改的開關不會自己復原**，第二張起兩邊都是舊畫法——一次只拍一張（N=1）。
- **還沒做**：①②（第 201 輪做了，D-402／D-403）③冰霜新星出手那圈粗白環（這輪沒拍到）④緩速箭頭在紫色的怪身上不突出（可以加深色底或換亮一點）⑤第 197、198 輪列的其餘候選。

**第 199 輪注意（冰凍 D-399、競技場狀態 D-400）**：
- 冰凍：`fx/iceCase.ts`（`ICE_CASE` 顏色與霜的濃度 `frostA`、`iceShards` 幾根／多高、`thawBlink`、`drawIceShards`）；霜白剪影是掛在怪 sprite 上的另一張圖（`sp.getData('frost')`，`killSprite` 會收掉）。`RtBattleScene.iceCase=false` 回舊畫法。Boss 不會被冰（引擎改成緩速）。
- 競技場狀態：`PvpScene` 的 `top` 畫筆（depth 46）＋`statusFx` 開關；護盾罩 `drawDome(g, px, 腳下y, r, 顏色, 剩幾成, domeBlink)` 兩個場景共用。
- 拍法：冰凍＝`sh scripts/shot-ice.sh tag [W H]`（`STAGE=mistwood|thornvale|starfall`、`DIST=100`、`MIN=2`、`NIGHT=1 LOWFX=1`；會印 `PAGE [[x,y,…]]`＝遊戲座標，乘 `寬/720×DSF` 才是圖上的像素；`-x` 那張是舊畫法）。競技場＝`WEAPON=sword PRESS=parry STATUS=shield PAIR='sc().statusFx=false; 1' DSF=3 node scripts/shot-pvp.mjs tag`；冰凍等對手的法杖（`WEAPON=bow INJECT=freeze STATUS=freeze`）；暈眩等不到，用 `INJECT=stun STATUS=stun` 直接塞。
- **還沒做（依序）**：①（第 200 輪做了）②杖貼身時主角頭上受傷紅字＋打怪白字＋護盾字疊成一團 ③冰霜新星出手那圈粗白環（`shockRing … 10`）像呼拉圈 ④第 197、198 輪列的其餘候選。

**第 198 輪注意（墜星預告 D-397、護盾罩 D-398）**：
- `fx/starWarn.ts`（`STAR_WARN`：星星起點 `minF`、亮度 `minA`、細光 `guideA`、刻度數量與速度）；畫在 `RtBattleScene.starWarnAt`（地圖落星 `area=true` 畫整套；Boss 召喚的只加刻度與星星）。`fieldFx.fallingStar(g,x,y,f,a?,guide?)` 後兩個是選用的。
- 拍法：`sh scripts/shot-star.sh [tag] [W H]`（`NIGHT=1 LOWFX=1` 可加；`STAGE=emberrift` 拍熔岩口）；Boss 的＝`PHASE2=1 DIST=8 ONLY=sentinel_meteor2 node scripts/shot-boss-attacks.mjs starfall tag`（一階段的 `sentinel_meteor` 叫不出來）。
- 護盾罩（D-398）：`fx/shieldDome.ts`（`domeLook` 邊緣層與高光、`DOME_SIZE` 大小）；`RtBattleScene.shieldDome=false` 回舊畫法。拍同一瞬間的對照：`UNTIL='(()=>{const s=sc().s;const u=s.units[0];return s.tick>540&&u.statuses.some(q=>q.id==="shield"&&q.value>0&&q.until-s.tick>50&&q.until-s.tick<110)&&!(u.action&&u.action.kind==="skill")})()' PAIR='sc().shieldDome=false; draw=true; __game.step(T,0); 1' LEVEL=14 DSF=3 node scripts/play.mjs sword emberrift tag 1 60`（`-x` 那張是舊的），裁 `(W/2-170,H/2-320,W/2+170,H/2+20)`。**沒看**：競技場的護盾、定案後的杖與弓。
- 看過覺得還礙眼、沒做的（依序）：①被冰住的怪身上的冰罩（`5149` 行附近的 strokeEllipse）和舊護盾很像，一次冰好幾隻時滿畫面的圈 ②杖貼身時主角身上四五個數字疊在一起 ③第 197 輪列的 ②③④。

**第 197 輪注意（字幕位置、護盾字 D-396）**：
- 畫面中央的說明句（30px 以下）原位一律用 `TIP_Y`（主角腳下 250）；還留在 560／600 的只有營火旁才出的（祝福消散／休息詢問）與打倒 Boss 後的（新地圖開放、討伐副標），那些時候沒有怪。470／490 的警告（噴發、暴動）在主角上方 220，沒動。
- 「護盾 +N」：`fx/shieldText.ts`；計數 `RtBattleScene.shieldTexts`（`create` 歸零）。
- 拍「某句字幕出現的那一刻」：`UNTIL` 裡走 `sc().children.list` 找 `type==="Text"&&alpha>0.95&&text.startsWith("騾子")`；`LEVEL=9 DSF=2 … sword thornvale` 約 18 秒會遇到騾子，兩次分開跑畫面幾乎一樣。
- 看過覺得還礙眼、沒做的（依序）：①主角身上同時四五個圈（護盾罩、鎖定弧、腳下藍圈、瞄準扇形、紅圈），弓最亂 ②右側方向箭頭蓋在畫面邊緣的怪身上 ③深夜提示在出生點落在營火旅人身上 ④第 196 輪列的 ③④（成群預告外框、競技場大招閃光）。「怪擠成一團血條互相蓋住」放大看過，血條本身分得開，先不做。

**第 196 輪注意（地形 D-394、大招閃光 D-395）**：
- 地形都在 `rt/ground.ts` 的障礙那一段：成片的（`dense`）分 `forest`（`rt/treeCrown.ts` 的 `crownLobes`）／`ember`（`rt/emberRock.ts`）／`tv`（荊棘叢，第 195 輪）／其他（星隕：圓＋晶柱）；零星的三張圖共用 `emberRock`＋`LONE_ROCK` 色票。參數都在各檔最上面的常數（`EMBER_ROCK`、`TREE_CROWN`）。**地面是分塊材質、只畫一次**：改了要重開遊戲才看得到；亂數一律用 `hr(cx, cy, i)`（每塊重畫要一致），岩塊用 50 起、樹冠用 60 起的索引。
- 大招閃光：`feel.ts` 的 `ultFlashLayers`（底光比例、柔光大小）、`ultFlash(scene, color, ms, at?)`；新的大招演出記得給 `at`（畫面座標）。競技場沒給。
- 拍法：地形＝`LEVEL=14 DSF=2 node scripts/play.mjs staff emberrift tag 6 4`（第 5 張在岩壁邊）、`LEVEL=5 DSF=2 … sword mistwood tag 4 9`、`LEVEL=9 DSF=2 … sword thornvale tag 3 7`；大招出手後連續幾幀＝`UNTIL='(()=>{const s=sc().s;return s.events.slice(-20).some(e=>e.type==="cast"&&e.skill==="blade_storm"&&e.tick>=s.tick-1)})()' LEVEL=20 node scripts/play.mjs staff starfall tag 10 90`（三把武器的大招 id 都是 `blade_storm`）。同一條指令兩次跑出來的時間點不一定一樣，對照圖要挑位置相同的。
- 成群預告：`telegraphLook.ts` 的 `crowdCounts`／`crowdFill`（同一群 n 個、每塊填色 ×1/√n；只淡填色）；`RtBattleScene.teleCrowd=false` 可以切回舊樣子拍對照（`PAIR='sc().teleCrowd=false; draw=true; __game.step(T,0); 1'`）。競技場沒套。
- 看過覺得還礙眼、沒做的（依序）：①怪擠成一團時血條互相蓋住 ②說明字幕條常落在主角頭上那一帶 ③成群預告的外框還是幾圈疊在一起（填色已經淡了）④競技場的大招閃光沒拍過。

**第 195 輪注意（小圖示記號 D-392、荊棘叢 D-393、熔岩口火柱）**：
- 小圖示：`fx/skillGlyph.ts`（`skillGlyph` 照資料分類、`drawSkillGlyph` 畫法、`COMPACT_ICON` 透明度與「幾 tick 以上才寫秒數」、`compactLabel`）；`RtBattleScene` 的 `showGlyph`／`glyphImgs`（depth 49.7：按鈕底 49.5 上面、`ui` 畫筆 50 下面，所以冷卻扇形蓋在記號上）；技能樹在 `rtSkillPanel.ts` 的 `gi`。想要秒數回來把 `COMPACT_ICON.longTicks` 改成 0。
- 荊棘叢：`rt/thornBush.ts`（葉簇位置、刺、漿果）＋`worldMaps.ts` 荊棘谷的 `crownA／B／Hi`；`ground.ts` 的 `if (tv)` 那一支。**不要在葉簇上畫弧線或成對的暗點——會變成臉。** 退回：把 `if (tv)` 那支改回和 `else` 一樣、色票改回 `0x3a1828／0x45202f／0x6a2c3e`。
- 粒子天花板：`feel.ts` 的 `setFxCeiling`（`RtBattleScene.create` 設成 `VIEW_TOP`）、`ceilingZone`（給 `add.particles` 的設定用）、`fxOffTop`；新增粒子發射器時記得兩個都套。**從 EVAL 裡 `import('/src/game/fx/feel.ts')` 拿到的是另一份模組**（沒有場景設的天花板），要測就叫場景自己的方法（`sc().emberPuff(x,y)`）。
- 火柱：`fx/ventColumn.ts`＋`bossCues.ventEruptCue`；柔光貼圖是 `levelUp.ts` 的 `softPillarKey`／`softGlowKey`（要做別的光柱可以直接用）。
- 拍法：那一排＝`LEVEL=8 DSF=3 node scripts/play.mjs bow thornvale tag 3 6`，裁 `(390,2340,1170,2532)`；技能樹＝`LEVEL=14 EVAL='(()=>{window.KEEP_MENU=1;if(!sc().menu)sc().openSkills();return !!sc().menu})()' node scripts/play.mjs staff mistwood tag 2 1`（第二張才有）；選了打法／左手＝`REC='{"skills":{"whirlwind":5},"variants":["whirlwind:b"]}' CTL='{"leftHand":true}'`（這輪加的，只對霧語森林那筆存檔）；直接叫出某個演出＝EVAL 裡第一張先 `import('/src/game/fx/bossCues.ts').then(m=>window.__m=m)`，之後每張呼叫再 `ff(0.1)`。
- `play.mjs` 的主角拿弓／杖會停在射程邊緣對著還沒發現他的怪發呆（腳本每 tick 送 stop），不是遊戲的問題。
- 看過覺得還礙眼、沒做的（依序）：①粒子的天花板（`fx/fxCeiling.ts`，這輪做的）只擋標題列（y<110）；小地圖、右上祝福圖示、目標字條上面還是會有火花，衝擊環（`shockRing` depth 790）沒擋——要擋就照同一招加範圍，或把那幾樣 HUD 搬到 800 以上 ②右上方向箭頭擠在祝福圖示下面 ③飄走的數字穿過還在累計的 ④新手教學那句「攻擊技能和大招會自己放了！」可以指一下底部那排圖示。

**第 194 輪注意（目標字條收起來、主角分件補看）**：
- 位置：`rt/goalFade.ts`（`GOAL_FADE.vetMs` 8 秒、`firstKillMs` 25 秒）；`RtBattleScene` 的 `goalVet`（進圖時是不是老玩家，第一次算 `goalBefore` 時定下來）、`goalShown`／`goalShownAt`（字換了重算）、`goalFire`（走回營火再亮）；`setVisible(!boss && alpha > 0)`——收起來時 `goalBounds()` 回 null，箭頭會用那一塊。
- `play.mjs` 會把時間跳到 100 秒，老玩家存檔拍不到字條；要拍就 `EVAL` 裡設 `goalShownAt = time.now`。
- 主角分件：`node scripts/shot-walk-fight.mjs sword|bow|staff [地圖] [tag]`，`PLAN=attack,circle:skill,hit,dodge`（一次一兩項，多了會超時；`dead` 等不到）。劍、弓（省電）、杖各看過幾幀沒脫節；倒下還沒看。
- 第 192 輪候選還剩：②底部自動技能那排冷卻中分不出哪顆是哪招 ③右上方向箭頭擠在祝福圖示下面（字條收起來後有改善，沒重看）④地區名稱細字疊在怪身上 ⑤飄走的數字穿過還在累計的。

**第 193 輪注意（門上的字、360 寬箭頭）**：
- 世界裡的字不要進底部那一排：`arrowRules.aboveBottomRow`（`BOTTOM_ROW_H` 92）；目前只有門上的字用。大箭頭對目標字條的邊界 `goalMargin`；排位置的主體還在 `rt/offscreenArrows.ts` 一條一條接。
- **沒看過**：省電、左手模式、技能切回手動時門上字的位置；荊棘谷的回程門。
- 這輪玩的時候看到、沒做的：①`play.mjs` 的主角在霧語森林第一個岔口卡在樹牆後面約 20 秒（腳本的問題，不是遊戲）②「等級提升！Lv 2」和「祝福：…」同時跳時兩行大字貼得很近（讀得到）③下面第 192 輪列的候選都還在。

**第 192 輪注意（頂端血條 D-390）**：
- 位置：`rt/hudBars.ts`（`HUD_BAR` 座標、`hpColor` 門檻、`lagStep` 殘影速度、`dangerPulse`）；`hudText.ts` 的 `hudSide`／`hudHp`；`RtBattleScene` 建立處（`hudLv`、`hudHpTxt` depth 50.5＝要在 `ui` 畫筆上面）與 `draw` 最後一段。**標題列（y<110）現在左邊是 Lv＋三條、右邊兩行字，中間沒有空位了**；要再加東西先看 360 寬。
- 會飄進標題列的東西：落點在 `VIEW_TOP` 以上的墜星／噴發不放特效（`seen`）；「!」要在 `VIEW_TOP+95` 以下才出。之後看到別的東西蓋在標題列上，照這樣在來源擋，不要去調 depth。
- 拍低血：`HP=0.2 LOWFX=1 LEVEL=8 node scripts/play.mjs sword thornvale d 5 6 360 640`（很慢，五張約兩分鐘；放背景跑時要等它寫完再組圖）。
- 還沒做、看過覺得還礙眼的（依序）：①老玩家的目標字條常駐兩行長字（「…可以再挑戰／▶ 刷深夜的高原、把裝備強化到 +10、挑戰最快討伐」），蓋住畫面上緣的怪——可以考慮幾秒後收成一行或淡掉 ②底部自動技能那排冷卻中只剩數字，分不出哪顆是哪招（Jacky 還沒回要不要畫圖示）③右上方向箭頭擠在祝福圖示下面 ④地區名稱細字疊在怪身上 ⑤飄走的數字穿過還在累計的。
- 上一輪留下的仍在：行商「買」、拍賣所「買到」、強化失敗沒逐幀看；光門換圖、競技場勝負、「第一章・完」的 `camera.flash`。
- 再來：先看 Jacky 對蓋著的牌、數字合併、字幕條、血條的回饋。

**第 191 輪注意（燼紅裂谷岩壁 D-389、結局最後一頁）**：
- 位置：`rt/emberCrack.ts`（比例、長度；`ground.ts` 照著畫，地面是分塊材質、只畫一次）；`ui/finale.ts` 第 5 段（字條 `finale.unique`；檔案裡 `t` 常被拿來當 Text 變數名，i18n 用 `tr`）。
- 拍通關演出：`LEVEL=14 EVAL='(()=>{if(!window.__f){window.__f=1;window.KEEP_MENU=1;sc().showFinale();}return 1})()' node scripts/play.mjs sword emberrift fin 30 2`（每 2 秒一張）；直接跳到最後一頁：EVAL 裡 `ff(1.6)` 後對 `sc().menu.list[0]` 連 `emit("pointerdown")`＋`ff(0.5)` 十二次。假存檔的旅程紀錄會顯示「首次討伐 —」，是拍法的副作用。
- 還沒做、看過覺得還礙眼的（依序）：①怪打主角的數字要不要合併（這輪看一群棘背狼咬主角：同時通常只有一個紅字，不急）②地區名稱細字疊在怪身上 ③飄走的數字穿過還在累計的 ④「第一章・完」的 `camera.flash` 與序章字卡沒逐幀看 ⑤右上方向箭頭（橘色實心三角）在目標在北邊時擠在祝福圖示下面。
- 上一輪留下的仍在：行商「買」、拍賣所「買到」、強化失敗沒逐幀看；光門換圖、競技場勝負。
- 再來：先看 Jacky 對蓋著的牌、數字合併、字幕條的回饋。

**第 190 輪注意（說明句的字幕條 D-388）**：
- 位置：`fx/feel.ts` 的 `CAPTION_MAX_SIZE`／`isCaption`／`captionStyle`／`CAPTION_POP`；`bigText` 字級 ≤30 自動走字幕條。**新增畫面中央的字：喊的用 32 以上、說明用 30 以下。** 地區說明在 `RtBattleScene` 的 `captionStyle(z.danger ? …, 26)`（加了底條後比較寬，會更常走「在・換行」那一支）。
- 測試要 import `fx/feel` 得先 `vi.mock('phaser', …)` 和 `vi.mock('../src/game/settings', …)`（照 `tests/level-up-fx.test.ts`）。
- 同參數的 `play.mjs` 跑兩次，開頭幾十秒的畫面這次幾乎一樣（可以當前後對照，但不保證）。
- 還沒做、看過覺得還礙眼的（依序）：①怪打主角的數字要不要也合併（被一群狼咬時主角頭上好幾個紅字）②相遇結語的位置（現在是字幕條了，仍在主角上方）③地區名稱「— 森林入口 —」細字疊在怪身上 ④飄走的數字穿過還在累計的數字。
- 上一輪留下的仍在：行商「買」、拍賣所「買到」、強化失敗沒逐幀看；光門換圖、競技場勝負、結局的 `camera.flash`。
- 再來：先看 Jacky 對蓋著的牌、數字合併、字幕條的回饋。

**第 189 輪注意（傷害數字合併 D-387）**：
- 位置：`fx/comboNumber.ts`（`COMBO_GAP_MS`／`COMBO_MAX_MS`／`COMBO_GROW_*`，純函式）；`RtBattleScene` 的 `hitNum`（damage 事件裡「玩家打怪、不是持續傷害」那一支）；`PvpScene` 的 `hitNum`；`feel.floatNumber` 的 `fixed`（照給的位置、先把自己上一次佔的格子拿掉再排位置）。
- 拍多段招的數字：`STAGE=emberrift ONLY=blade_storm FRAMES=4,14,24,36 node scripts/shot-skills.mjs bow '' tag`（三隻怪釘在一起＝最擠的情況）。
- **這個環境開工時 `npm ci` 只跑一次、跑完再做別的**：這輪背景跑一次、前景又跑一次，兩個互撞把 `node_modules` 弄壞（`vite: not found`），`rm -rf node_modules && npm ci` 才好。
- 還沒做、看過覺得還礙眼的（依序）：①相遇事件的結語綠字（「騾子甩了甩腿…（下次回到這裡…）」，`bigText(…, 560, …)` 兩處）出現在主角正上方，剛好是下一群怪走過來的位置，帶光暈的兩行字蓋住怪和「!」——可以考慮改成畫面下方的字幕條樣式 ②區域名稱下面那行小字（「岔路：西邊近但會噴發…」）是細白字、疊在怪身上看不清 ③怪打主角的數字要不要也合併 ④停止被打的數字往上飄時穿過旁邊還在累計的數字（`NUM_FRESH_MS` 350ms 之後就不避了）。
- 上一輪留下的仍在：行商「買」、拍賣所「買到」、強化失敗沒逐幀看；光門換圖、競技場勝負、結局的 `camera.flash`。
- 再來：先看 Jacky 對蓋著的牌、數字合併的回饋。

**第 188 輪注意（行囊：強化成功、換上裝備的回饋）**：
- 位置：`fx/feel.ts` 的 `panelFlash`／`panelFlashPeak`（面板上面的淡閃光，depth 986；行囊、行商、拍賣所共用）；`ui/rtBagPanel.ts` 的 `finish`（強化結果：`gained` 綠字＋深色底＋卡片金框 halo）、`equipFx(before, slots)`（字牌蓋在數值那一行、格子 halo）。面板上要加會飄的字都用 `keepFx`（面板關掉一起收）。
- 拍面板的「按下去頭幾幀」：`FRAMES=2 STEPS='[...]' node scripts/shot-unique.mjs 390 844 tag`（每步之後只推 n 幀就拍）。給材料：STEPS 第一步 `(async()=>{const r=await import("/src/game/rtRecord.ts");r.saveRecord("mistwood",{...r.loadRecord("mistwood"),dust:9999,crystal:99});sc().openBag();ff(30)})()`；要 +7：`sc().bagSt.bag[3].enh=6`。**強化走本機伺服器擲骰，是非同步的**：點「確定強化」後那一張還是確認框，結果在下一步才出現。`clk("字")` 是「包含」、會點到第一個符合的（兩把劍都叫「王牙大劍」要寫全名）。行商：`sc().openShop()` → `clk("=賣")`。
- 還沒逐幀看過的：行商「買」、拍賣所「買到」、強化失敗；①走進光門換圖 ②競技場分出勝負 ③標題／結局（`ui/finale.ts` 還有一個 `camera.flash`＋`glow()` 的 postFX）。舊候選：一般小怪風箏脫戰的預告（先量頻率）、主角只被大怪蓋住半邊。
- 這輪玩的兩段裡看到但沒動的：燼紅裂谷的岩壁（深色圓石＋橘色裂紋）鋪滿畫面時很花，主角在護盾六角形裡不太好找；穿透招一次打一排時傷害數字會疊（`numberSlot` 已經有錯開，還是擠）。都先記著，要動先拍多一點再決定。
- 再來：先看 Jacky 對蓋著的牌的回饋。

**第 187 輪注意（斬首圖示、競技場閃光、獨特裝備說明）**：
- CI：6f5f4c1、b026937 的 CI 都 success（b026937 的 Pages、APK 也是）。
- 位置：`fx/effectIcon.ts`（`EXEC_AXE`；每個效果的記號＝元素＋`glyph`）；`PvpScene` 的大招改用 `ultFlash`、勝利用 `levelUpFlash`；`RtBattleScene.announceUnique`（大字最後一行空白＝替說明小字佔位置，說明畫在那一行裡——**之後要在大字下面掛小字都照這樣，不要掛在大字的範圍外**）。
- 新工具：`node scripts/shot-icons.mjs tag`（全部效果圖示，HUD 大小＋卡片大小）；`FLASH=5 node scripts/shot-pvp.mjs tag`（競技場自己按大招、連拍閃光頭幾幀；`ULT=0` 等對手的）。競技場腳本是真實時間，看不出淡出曲線。
- 拍「撿起獨特裝備」：新存檔（`LEVEL` 不給）第一次打倒 Boss 保底掉一件。`UNTIL` 裡：tick>120 把主角搬到 Boss 南邊 400、`b.mode==="combat"` 後 `b.hp=5`、Boss 死後 75 tick 把主角搬到 `s.ground` 裡 `sc().uniqueOnGround` 那件的位置（機器人不會自己去撿），之後連拍 150 張挑幾張。
- 還沒逐幀看過的時刻：①走進光門換圖（`play.mjs` 換場景後指令會掉，要另外寫）②競技場分出勝負的畫面（勝負由伺服器重播決定，不能硬改血量）③標題／結局／強化與買賣面板的 `camera.flash`（當下沒有戰鬥，優先度低）。舊候選：一般小怪風箏脫戰的預告（先量頻率）、結局／序章字卡的光暈、主角只被大怪蓋住半邊。
- 再來：先看 Jacky 對蓋著的牌的回饋。

**第 186 輪注意（升級／打倒 Boss／倒下醒來 D-386）**：
- CI：c232041 的 CI、Pages、APK 都 success（022988d 的那次被後一次 push 取消，正常）。
- 位置：`fx/levelUp.ts`（`levelUpFlash(scene, color, ms, peak)`、`levelUpPillar`、`pillarLayers`、兩個峰值）；`feel.ts` 的 `popScale`（大字彈出的起始倍率）、`clearBattleTexts`／`staleTexts`（`floatNumber` 與 hold ≥ 0 的 `bigText` 會登記）。
- **逐幀拍「某個時刻」很容易找到東西**（這輪三個都是這樣找到的）。升級：`UNTIL='(()=>{let f=false;const w=(l)=>{for(const o of l){if(o.list)w(o.list);else if(o.type==="Text"&&o.text.startsWith("等級提升"))f=true}};w(sc().children.list);return f})()' node scripts/play.mjs sword mistwood lv 22 120`。打倒 Boss：`UNTIL` 裡把主角搬到 Boss 旁、`b.mode==="combat"` 後把 `b.hp` 壓到 5、回傳 `b.dead`（會順帶造成「暴怒！」大字，那是拍法的副作用）。主角倒下：`UNTIL='(()=>{const s=sc().s;const p=s.units[0];if(s.tick>240)p.hp=Math.min(p.hp,3);return p.dead||p.hp<=0||(s.revives??0)>0})()'`（HUD 的 HP 會一直顯示 3，也是副作用）。拼圖：自己寫幾行 PIL 橫向拼。
- `play.mjs` 的 `NIGHT=1` 對 Lv1 新存檔沒作用（深夜要先打倒暴怒 Boss）；要深夜請加 `LEVEL=`。
- ~~還沒逐幀看過的時刻~~（第 187 輪看了 ①②⑤ 與競技場大招，見上）。舊候選：一般小怪風箏脫戰的預告（先量頻率）、結局／序章字卡的光暈、主角只被大怪蓋住半邊。
- 再來：先看 Jacky 對蓋著的牌的回饋。

**第 185 輪注意（競技場的範圍與名字 D-384）**：
- CI：3bad523、7fd31f4 的 CI、Pages、APK 都 success。
- 位置：`fx/areaDraw.ts`（`drawSoftLane`／`drawSoftSector`／`drawSoftRound`／`drawSoftArea`，兩個場景共用；`RtBattleScene.softLane` 等只剩換算座標）；`fx/areaLook.ts` 的 `teamAreaLook`、`NAME_FADE_NEAR`／`NAME_FADE_FAR`；`PvpScene` 的 `castNames`、`unitGapPx`。
- 拍競技場的範圍：`DSF=2 WEAPON=bow AREA=6 node scripts/shot-pvp.mjs tag`（輸出 `screenshots/pvp-<tag>-<n>-<形狀>.png`；同一種「形狀＋隊伍」只拍一次；對手是隨機配的，前後兩次不會是同一招）。腳本裡的玩家不出招，拍到的都是對手的招。
- **跑 `npm test` 的同時不要跑 Chromium 連拍**：`rt-perf`（不比基準慢 2 倍）會被拖紅；單獨重跑就過。
- **主角被大怪擋住（D-385，7fd31f4）**：`fx/occlude.ts` 的 `OCCLUDE_ALPHA`（怪淡到幾成）、`HERO_GHOST_ALPHA`；`RtBattleScene.syncHeroGhost`（`occMin`／`occDepth` 在畫單位時累計，下一幀用掉）。拍「擋住的那一瞬間」＋同一瞬間的舊樣子：`UNTIL='sc().s.telegraphs.length===0&&[...sc().sprites.values()].some(sp=>sp.getData("occ")<=0.71)' PAIR='<把 occ<1 的 sprite setAlpha(0.34)、hero 的 getData("ghost") 藏起來，再手動畫一幀>' LEVEL=14 DSF=2 node scripts/play.mjs sword starfall occ 1 150`（`play.mjs` 的 UNTIL 現在也會跑 PAIR；PAIR 改了東西要自己 `renderer.preRender(); scene.render(renderer); renderer.postRender()` 才拍得到）。頁面裡 `console.log` 以 `[[` 開頭的字串會印到終端機。
- 再來：看 Jacky 對蓋著的牌的回饋。沒有的話候選：①一般小怪風箏脫戰的預告（先量頻率）②結局／序章字卡的光暈（`ui/finale.ts` 的 `glow()` 還在用 postFX）③主角只被大怪蓋住半邊時（`coversHero` 要身體中心落在怪裡才算）要不要也疊畫——先拍幾張看礙不礙眼。**舊候選「競技場的技能範圍」這輪做完了。**

**第 184 輪注意（蓋著的牌 D-383）**：
- CI：11f7f31、160fbe0 都 success。真的觸控測法：不要 `__game.loop.sleep()`，`newPage({ hasTouch: true })`、`pg.touchscreen.tap(x, y)`，座標用物件的 `getWorldTransformMatrix()` 換算到 canvas 的 `getBoundingClientRect()`。
- 位置：`effects.ts` 的 `BLESS_GAMBLE`、`gambleCursePct`；`engine.ts` 的 `gamblePool`／`blessGamble`、`dealDamage` 裡的燼痕、`stateHash` 多混一個 curse；`blessPanel.ts` 的 `onGamble`（第四張牌）、`openBlessList` 的 `curse`；`RtBattleScene.playBlessEvent` 的 `blessGamble`（同一個 tick 的 `blessPick` 不再各跳一行字）、`drawBlessHud` 的燼痕記號。
- 拍照：`node scripts/shot-gamble.mjs sword mistwood tag`（面板＋三種結果＋HUD＋清單；`NIGHT=1 LOWFX=1 … bow emberrift tag 360 640`）。腳本用 `seedFor` 找翻出指定結果的祝福種子——**小的種子第一個亂數都很小**（一律「兩個」），所以用乘法打散。別的圖會被相遇事件的面板蓋到（霧語最乾淨）。
- 截圖腳本裡**換掉 `sc().commands` 之後，面板送的指令（`inp.push`）進不了 core**：要 `const orig = sn.commands.bind(sn)` 再把 `orig()` 裡的 bless 指令帶進去。
- 守望者的墜星（上一輪沒拍到）這輪用 `play.mjs` 的 `UNTIL` 拍到了：落地是一小團柔光、數字看得到，沒問題，不改。
- 再來：看 Jacky 對蓋著的牌的回饋。沒有的話候選：①（翻牌的牌面這輪已補：`blessPanel.ts` 的 `openGambleReveal`）②一般小怪風箏脫戰的預告（先量頻率）③結局／序章字卡的光暈 ④競技場的技能範圍（`PvpScene.shapePath` 附近）。

**第 183 輪注意（落地閃光 D-380、毒沼 D-381、圓／環範圍）**：
- CI：019885f、da5130b 的 CI、Pages、APK 都 success。
- 位置：`fx/impactLook.ts`（`impactFlash` 的層數／大小／亮度、`TONE` 的顏色）；`fieldFx.starImpact(vx, vy, r, tone)`；`rangedFx.starfall(x, y, r, fire)`；`RtBattleScene.drawUltAim` 開頭的 `k >= h.atTick`；`softRound`（圓／環）；`engine.ts` 的 `inHazard`、`naturalRegen`；字條 `calm.swamp`。
- **要發光的大東西不要用「一整塊 ADD 的實心圓」**：地面不夠暗就飽和成白。用 `fieldFx.ts` 的 `softFlashKey`（中心亮、邊緣淡到 0 的貼圖）上色疊幾層。
- **命中時有停頓（hitStop）的招，tick 會停在 atTick 好幾幀**：只在「k > atTick 才不畫」的蓄力／瞄準圖形會跟命中特效疊在一起。直線大招的瞄準光路（`drawUltAim` 後半）也有同樣情況，但它是淡的光路、沒那麼礙眼，沒動。
- 拍照小工具（沒進 git，重寫很快）：`STAGE=emberrift ONLY=blade_storm FRAMES=1,2,3,5 node scripts/shot-skills.mjs staff '' tag` 後用 PIL 把 `screenshots/sk-tag-*.png` 橫向拼起來看。把主角釘在毒沼：`EVAL` 裡第一次把 4150,5150 周圍 2500 內的怪設成 `dead`、`sc().events.on("postupdate",()=>{p.x=4150;p.y=5150})`、`sc().commands=()=>[]`。
- `shot-boss-attacks.mjs starfall` 的 `ONLY=sentinel_meteor`（一階段）與 `PHASE2=1 ONLY=sentinel_meteor2` 這輪都回「no telegraph」——守望者的墜星沒拍到，下一輪用 `play.mjs` 的真實對戰補看（落地閃光現在是柔光版）。
- 再來：**先看 Jacky 對「賭一把」的回覆，空的就照 D-382 做 ①**。其他候選：①守望者墜星補看 ②一般小怪風箏脫戰的預告（先量頻率）③結局／序章字卡的光暈 ④競技場的技能範圍（`PvpScene.shapePath` 附近）。

**第 182 輪注意（玩家技能範圍的長相 D-378）**：
- CI：257acdd 的 CI、Pages、APK 都 success。
- 位置：`fx/areaLook.ts`（顏色、淡出、分層都在這裡）；`RtBattleScene.softLane`／`softSector`。新增屬性色在 `STATUS` 加一條；不要用敵人預告的紅／亮紫／藍（測試會擋）。
- **調範圍／特效的顏色要在深色地圖看**：`STAGE=emberrift FRAMES=1 node scripts/shot-skills.mjs staff a tag`（霧語的綠地會讓淡色塊看起來沒問題）。
- 再來看 Jacky 的回覆；沒有就挑：①隕星術（杖大招原招）落地那一幀是一顆純白大圓盤，用 `FRAMES=1,2,3,5` 連拍看要不要柔一點 ②弓變化 A 第 3 欄的霜系扇形仍是灰藍（不是走 `soft` 那條路，先找是誰畫的）③一般小怪風箏脫戰的預告（先量頻率）④結局／序章字卡的光暈 ⑤競技場的技能範圍要不要也換（`PvpScene.shapePath` 附近）。

**第 181 輪注意（敵人預告的長相 D-377）**：
- CI：d8db69e 的 check、mssql、Pages、APK 都 success。
- 位置：`fx/telegraphLook.ts`（顏色、粗細、閃白、箭頭間距與速度都在這裡）；`RtBattleScene` 的 `teleFront`／`teleChevrons`。新增預告種類（例如冰＝淺藍）就在 `TeleKind`／`PAL` 加一條。
- 拍某一招的預告：`UNTIL='sc().s.telegraphs.some(t=>t.attackId==="thorn_shot"&&sc().s.tick-t.startTick>8)' LEVEL=8 node scripts/play.mjs sword thornvale tag 2 60`（同樣的參數跑兩次，畫面幾乎一樣，可以當前後對照）。
- `shot-boss-attacks.mjs`：`ONLY=` 給了不存在的 id 會卡到逾時——先 `grep -o "id: '<boss>_[a-z_0-9]*'" src/core/battle/rt/data.ts`；二階段的招要 `PHASE2=1`；外面包 `timeout 200`。
- 再來看 Jacky 的回覆；沒有就挑：①一般小怪風箏脫戰的預告（先量頻率）②結局／序章字卡的光暈 ③升級＋選祝福同一秒時主角四周四行大字（等級提升／祝福名／數值／技能點）要不要錯開。

**第 180 輪注意（大字／標題的光暈 D-376）**：
- CI：d024e1d、dbf43d0 都 success。
- **不要對會留在畫面上的東西加 postFX**（Glow、Bloom、Blur…）：Phaser 的 postFX 是整個畫面跑一次著色器、每幀都跑。要發光用墊一層貼圖／文字陰影／ADD 混色。`ui/finale.ts` 的 `glow()` 還在用（靜止字卡，低優先）。
- 位置：`fx/feel.ts` 的 `bannerGlowStyle`、`BANNER_GLOW_PAD`、`BANNER_GLOW_ALPHA`；`bigText` 裡的 `follow`（每幀把本體的位置／縮放／透明度／深度／文字抄給光暈）。標題在 `TitleScene` 的 `halo`、`TITLE_HALO_MIN`。
- **截圖腳本卡死先懷疑「某一幀很貴」**：一幀一幀 `ff(1)` 量時間；找兇手的方法是把 `scene.children.list` 逐一 `visible = false` 再量一次畫圖時間（`gl.finish()`＋`readPixels` 才量得到）。`page.screenshot` 逾時時可改用 `__game.canvas.toDataURL()`（要在同一段 JS 裡先手動畫一幀）。
- `shot-boss-attacks.mjs` 多了 `OFFS=-6,-2,1,3`（命中前後第幾個畫面幀）。
- 再來看 Jacky 的回覆；沒有就挑：①一般小怪風箏脫戰的預告（先量頻率）②結局／序章字卡的光暈 ③打完 Boss 的大字壓到走進怪堆的主角。上一輪的候選 ①（守望者 20% 以下）③（敵人落下型招式的時差）這輪看過了，沒問題。

**第 179 輪注意（落下型特效提早出發 D-375）**：
- CI：ea8d626、e523d3a 都 success。
- 位置：`fx/hitTint.ts` 的 `fxLead(weapon, ult, hits, shape, status)`；`RtBattleScene.skillFxOf` 與 `PvpScene.skillFx` 用 `k < h.atTick - fxLead(...)` 判斷。新增「會飛一段才落地」的招時：在 `fxLead` 加一條、把那招「落地才該出現」的東西（地上的圈、震動）用 `delayedCall` 延到落地；`tests/fx-lead.test.ts` 會檢查提前量不超過 atTick。
- 拍「扣血後第 N 幀」：`ONLY=blade_storm FRAMES=1,3,5,7,9,12 node scripts/shot-skills.mjs staff a tag`（FRAMES 不能是負數）。`shot-pvp.mjs` 多了 `WEAPON=bow|staff`。
- 再來看 Jacky 的回覆；沒有就挑：①守望者 20% 以下到倒下 ②一般小怪風箏脫戰的預告（先量頻率）③敵人的落下型招式（守望者星落、岩王落石）預告圈與落地有沒有時差。

**第 178 輪注意（雷暴／流星雨的落點 D-374、截圖腳本時間）**：
- CI：1192178、4787431 都 success。87e6d88、24c9d2e 的舊 run 一直 `queued`，不用管。
- 位置：`fx/hitTint.ts` 的 `stormStrikes`；`rangedFx.staffFx(..., foes)`（雷暴、流星雨兩段）；`RtBattleScene.stormFoes()`（活著的怪＋剛倒下的）。別的「圈裡隨機落點」的招要對準怪，照這個接。
- **截圖腳本現在只走遊戲時間**（`Date.now = t0real + off`）：tween 特效的淡出和實機一樣長了。第 166／170／177 輪的逐幀圖是舊時間拍的（偏淡）；要判斷「留多久、會不會蓋住東西」請重拍。
- **截圖腳本一次最多同時跑兩個**（三個以上瀏覽器會當：`Target crashed`）。
- `play.mjs` 多了 `FURY=1`（暴怒 Boss）。暴怒守望者：`FURY=1 LEVEL=20 EVAL='…p.hp=Math.max(p.hp,Math.round(p.maxHp*0.6))…' node scripts/play.mjs sword starfall fs 24 5`（看到 59%，沒問題）。
- 再來看 Jacky 的回覆；沒有就挑：①暴怒岩王、守望者 20% 以下的真實對戰 ②流星雨／隕石「落地比傷害數字晚 0.16 秒」的時序（要讓特效早幾個 tick 出發，傷害時機不能動）③一般小怪風箏脫戰的預告（先量頻率）。

**第 177 輪注意（大招閃光 D-372、精英脫戰預告 D-373）**：
- **CI 未確認**：87e6d88、24c9d2e 兩次 run 這輪結束時都還在 `queued`（runner 沒開始跑）。下一輪開頭先看，紅了先修。本機 typecheck／lint／build／build:online／vitest 都過。
- 位置：`fx/feel.ts` 的 `ultFlash`／`ultFlashPeak`；`RtBattleScene.drawLeashWarn`（畫在 `ringG`，和巢穴紅圈同一層）、`leash` 事件裡的 `jg_tip_leash`、`ui/tipText.ts` 的 `leashNear`、文字 `leash.near`／`tip.leash`。
- **拍「某件事發生後的連續幾幀」**：`UNTIL='<js 條件>' node scripts/play.mjs staff emberrift tag 8 90`——不畫圖地走到條件成立（最多 90 秒），之後每張隔一幀。大招閃光的條件：`sc().children.list.some(o=>o.depth===47&&o.type==='Rectangle')`。
- **把主角擺到 Boss 旁邊再讓他自己打**：`EVAL='(()=>{const s=sc().s;const p=s.units[0];const b=s.units.find(u=>u.tier==="boss"&&!u.dead);if(!window.tp&&b){p.x=b.x;p.y=b.y+130;window.tp=1}return b&&{hp:Math.round(b.hp/b.maxHp*100),atk:b.action&&b.action.id}})()' LEVEL=13 node scripts/play.mjs sword emberrift em 32 6`。這輪用它看了岩王（打到倒下）和守望者（到 20%），沒看到壞的。
- 拍精英脫戰預告：同樣用 `EVAL` 把某隻精英的 `homeX／homeY` 改到 1300～1500 外（只是為了拍圖）。
- 再來看 Jacky 的回覆；沒有就挑：①守望者最後 20%、暴怒版岩王／守望者的真實對戰 ②一般小怪風箏脫戰的預告（先量頻率）③法杖 A 雷暴的逐招截圖。

**第 176 輪注意（主角／棘背狼／競技場的亮邊 D-371）**：
- 位置：`src/game/fx/heroRim.ts`（`ensureRim` 做材質、`RIM_*`／`FOE_RIM_*` 常數）；`RtBattleScene.spriteFor` 建立、`draw` 裡每幀跟著立繪（存在 sprite 的 `rim`）、`killSprite` 先拿掉；`PvpScene` 同樣寫法。要讓別的怪也有：`SPRITE` 表加 `rim: 0x顏色`。
- 同一瞬間的對照圖：`PAIR='<js>' node scripts/play.mjs …`——每張拍完跑那段 js 再拍一張 `-x`（這輪用它把 `rim` 藏起來重畫一次）；`DSF=2` 是兩倍解析度。**兩次分開跑的畫面不會一樣**（不是確定性的），不能拿來當前後對照。
- 截圖的同時不要跑整套 vitest：`rt-perf` 會因為搶 CPU 超時。
- 再來看 Jacky 的回覆；沒有就挑：①劇情／提示的綠字壓在戰鬥上（`TIP_Y` 那一類以外、直接出現在主角上方的那種；荊棘谷「騾子甩了甩腿…」、燼紅「燼晶劃出一道光…」）②上一輪留下的：精英脫戰（`tooFar`／`bored`）沒有預警 ③用真實對戰逐招看岩王、守望者。

**第 175 輪注意（巢穴脫戰規則 D-370、CI 冒煙測試重試）**：
- CI：1a9b74a（含 6df00a2、633a30f）的 check／mssql 都 success（這輪結束前確認過）。6df00a2 那一次是紅的——我推之前沒把整套測試的結尾看完，`rt-bless` 有一項壞了，五分鐘後用 1a9b74a 修掉。**教訓：`npx vitest run 2>&1 | grep -E "Test Files|Tests "` 一定要看到「passed」那兩行才推**，不要只看前幾行的 ×。
- CI 冒煙測試那一步（`ci.yml`）：`playwright install --with-deps` 失敗會重試三次，再不行只裝 chromium。上一輪 a625f4f 的紅燈就是 apt 解析不到 security.ubuntu.com。
- 再來看 Jacky 的回覆；沒有就挑：①主角被大怪擋住時要不要加輪廓 ②精英（不是 Boss）的脫戰：`tooFar`／`bored` 兩條沒有預警，玩家看到的只有「脫戰」兩個字 ③繼續用真實對戰看岩王、守望者的招（這輪只跑了核心探針，沒有逐招看畫面）。
- **Bot 的 Boss 脫戰次數不能當成玩家體驗**：Bot 216 場裡 Boss 脫戰 114 次（改前 127）。追了一場（燼紅、法杖、novice）：Bot 交戰中不會回營火，脫戰都是「Boss 走過來 → 風箏型 Bot 直線往後退 → 退出圈外 3 格以上待超過 3 秒」。Bot 不認得紅圈；真人看得到圈和倒數。想讓 campaign 的討伐時間更準，可以教 Bot 在圈邊改成繞圈（`sim.ts`，純 Bot 行為，不影響玩家），低優先。
- **站著打的探針**（這輪的主要工具，沒進 git，寫法就是 `tests/rt-lair-shove.test.ts` 的 `standAndFight`）：`createBattle({ stageId, seed, level, weapon })` → 主角 `hp = maxHp = 1e8`、擺到 Boss 正下方 130 → `step(s, [])` 到 Boss 倒下或 10 分鐘，數 `leash` 事件。四張圖 × 三武器 × 30 種子 × 一般／暴怒（`setBossFury`）跑一次約 2.5 分鐘。等級用 8／14／20／26。**長劍的 `weapon` 要傳 `undefined`**（傳 `'sword'` 型別不過，行為也可能不同）。
- 巢穴規則的位置：`engine.ts` 的 `LAIR_GRACE_TICKS`、`heldLair`（Boss 交戰中才回傳巢穴圈）、`shovedOut`、`separate` 裡的推擠、`step` 裡包住 `updatePlayer` 的那一段、`mapAi` 的 `lairOutTick`、衝鋒位移的 `lz`、`startEnemyAttack` 的瞬移落點。畫面：`RtBattleScene.drawLairCount`、`lairWarn` 事件、`ui/tipText.ts` 的 `lairCountText`、文字 `lair.warn`／`lair.count`。
- 拍巢穴警告：`LEVEL=14 EVAL='(()=>{const s=sc().s,p=s.units[0],B=s.units.find(u=>u.tier==="boss"&&!u.dead);window.tp=(window.tp||0)+1;p.hp=p.maxHp=99999;if(window.tp===1){p.x=B.x;p.y=B.y+200}if(window.tp===12){sc().commands=()=>[{type:"move",dx:0,dy:1000}];p.x=B.homeX;p.y=B.homeY+1060}return B.lairOutTick})()' node scripts/play.mjs sword thornvale lair 15 0.7`，看第 13 張。
- 之後新增 Boss 的位移招（撲、甩尾、瞬移）：位移後要留在 `bossZone` 圈內；落點要檢查障礙物（大隻的 Boss 被 `pushOutSolid` 推出去時可能推到牆的另一邊）。
- 測試裡要一隻「睡著的怪」：不要拿 Boss（搬到巢穴外的 Boss 現在會留下來打 3 秒），挑小怪並設 `aggroUnits = 0.1`。

**第 174 輪注意（衝鋒穿過玩家 D-368、大怪半透明 D-369）**：
- （第 175 輪已處理：`ci.yml` 加了重試）a625f4f 的 CI 是紅的——check job 最後一步冒煙測試在 `npx playwright install --with-deps chromium` 時 `apt` 解析不到 security.ubuntu.com（重跑一次一樣），前面的測試與 build 都過、本機冒煙測試過。用 GitHub MCP 的 `actions_run_trigger`（`rerun_failed_jobs`，run 43040869718）再重跑；還是不行就讓那一步重試幾次。
- 再來看 Jacky 的回覆；沒有就挑：①用「不釘住主角」的真實對戰看荊棘狼后、岩王、守望者和幾隻精英（下面的 `EVAL`）②~~燼紅裂谷拿弓不動會被擠到巢穴外~~（第 175 輪 **verified**，D-370：是小怪的推擠＋Boss 自己衝出圈，`tests/rt-lair-shove.test.ts`）③主角被大怪擋住時只是「看得到」，要不要加輪廓。
- 真實對戰的拍法：`LEVEL=14 EVAL='(()=>{const s=sc().s,p=s.units[0],B=s.units.find(u=>u.tier==="boss"&&!u.dead);if(!window.tp){window.tp=1;p.x=B.x;p.y=B.y+260}return [p.x,p.y,B.x,B.y,B.action?.id,B.mode,B.hp].join(" ")})()' node scripts/play.mjs sword mistwood 標籤 24 1`——每秒印雙方位置與 Boss 血量；**Boss 血量突然回滿＝脫戰重置**。`play.mjs` 沒有 `FURY=1`（只有 `shot-boss-attacks.mjs` 有）。
- 衝鋒：`engine.ts` 的 `chargingThrough`（位移段不和玩家推擠）。之後新增會位移的敵人招式（撲、甩尾）都要想一下會不會把玩家帶出巢穴；「站著不動打 10 分鐘」的探針寫法在 `tests/rt-charge-through.test.ts` 第二項。
- 半透明：`fx/occlude.ts`（`OCCLUDE_ALPHA`、`OCCLUDE_MIN_RATIO`），場景裡每隻怪的目前值存在 sprite 的 `occ`。拍對照：EVAL 裡 `sc().spriteFor(B).setAlpha(1)` 後 `R.preRender(); __game.scene.render(R); R.postRender()` 重畫一次。
- 快轉截圖裡常看到整隻白色剪影（主角或怪）：是受擊白閃在快轉下沒收掉，不是遊戲裡的樣子（`play.mjs` 有清，`shot-newsave.mjs` 沒有）。
- 這個環境 `date` 是準的；`xxd` 沒裝（產生 run_id 用 `od`）。

**第 172 輪追加注意（R-020／R-021 匯入）**：
- **下一輪先補看**：守望者與晶殼魔像的死亡碎裂（新圖比舊的程式圖大很多，`addShardFrame` 切塊的比例要確認）、深夜的星蝕狼、熔岩巡獵者、星輝狼首、360 寬＋省電、守望者頭上血條與招式名的位置。`FURY=1`／`NIGHT=1` 配 `scripts/play.mjs`、`shot-boss-attacks.mjs`。
- 新圖的顯示大小在 `RtBattleScene.ts` 的 `SPRITE`（`h`）；Jacky 嫌大嫌小改這裡。要退回舊圖：把那一行的 `key` 改回 `enemy_mist_wolf` 加 `tint`（火焰鬃毛／星痕會自動回來，條件是 `cfg.key === 'enemy_mist_wolf'`）。
- 之後再有洋紅底的 sheet：`python3 scripts/cut-sheet.py art-inbox/x.png 名字,名字` → 看圖 → 深色的再 `python3 scripts/rim-art.py public/art/名字.webp 顏色 gamma`（只能對剛切好的圖跑一次）→ 把名字加進 `src/data/handArt.ts` → `git rm` 原圖。dev server 在對話回合之間會被停掉，截圖前先確認 `npx vite --port 5173` 還活著。

**第 172 輪注意（撿取小字合併、震波色盤、換圖／倒下檢查）**：
- **下一輪**先看 Jacky 的回覆、確認 077a1c4 的 CI；沒有就挑：①Boss 瞬移招在真實對戰裡落點和主角的距離（`shot-boss-attacks.mjs` 會把主角釘在 Boss 旁邊，看不出來）②360 寬新存檔前十幾秒字太多（地名＋提示＋祝福＋武器提示）③光門「▼ 回某地」在畫面最下面時被搖桿蓋住。
- 「打過一次／換圖之後才壞」這一類這輪看過：換圖四次、倒下重來、營火醒來，都正常。`THEN=starfall,emberrift node scripts/play.mjs sword starfall 標籤 4 12`。
- 撿取小字：`RtBattleScene.pickupFloat`（不走 `floatNumber` 了，自己一個 Text、同種重用），規則 `src/game/pickupMerge.ts`。要擺場面：`sc().pickupFloat('gold',10)`。
- 震波色盤：`fx/hitTint.ts` 的 `groundPalette(stageId)`；新地圖沒設就是土色。只有「環形＋沒有自己演出」的招會用到（`enemyImpact` 回 `quake`）。
- **狼后伏擊 `queen_ambush` 是暴怒限定**（`furyOnly`），拍它要 `FURY=1`；之前四輪調 `DIST` 都白調。拍 Boss 招前先看 `data.ts` 那一招有沒有 `furyOnly`／`phase2Only`。
- Boss 逐招截圖一次只跑一個（三個一起跑會慢到逾時、一張都不存）；一招約兩三分鐘。

**第 171 輪注意（魔像碎塊 frame 的 bug、箭頭躲祝福圖示、競技場紅暈）**：
- **下一輪**先看 Jacky 的回覆、確認 4648d6d 的 CI；沒有就挑：①找「打過一次之後才壞」的東西——同一次開遊戲換圖、倒下重來、回營火之後再看一輪（這輪的魔像 bug 就是這一類，只看每招第一次的截圖抓不到）②補拍狼后伏擊、守望者二階段的環 ③打倒精英時大字和金幣數字擠在一起。
- **Phaser 的坑**：`texture.add(frame)` 會改掉那張貼圖的預設 frame。之後要在既有貼圖上切 frame 一律走 `fx/deathFx.ts` 的 `addShardFrame`（或加完自己把 `firstFrame` 設回去）。
- 箭頭躲右上角：`arrowRules.ts` 的 `blessHudRect`（要和 `RtBattleScene.drawBlessHud` 的排法一致——改那邊的位置或大小時這裡要跟著改）。
- `scripts/play.mjs`：`EVAL='(()=>…)()'` 每張截圖前在頁面裡跑並印結果（查 sprite 狀態很好用）；相遇抉擇面板會自動選，要拍面板本身在 EVAL 裡設 `window.KEEP_MENU=1`。跑幾次的戰況不會完全一樣（不是固定種子），前後對照要用 `EVAL` 擺場面。`NIGHT=1` 只對霧語森林有效。
- `scripts/shot-pvp.mjs [tag] [W H]`（`HP=0.3`、`LOWFX=1`、`SECS=n`）：競技場裡不按鍵的主角只會站著挨打，血壓太低幾秒就輸了（`SECS=3`）。

**第 170 輪注意（流星箭雨、瞬移大字、危險紅暈 D-367）**：
- **下一輪**先看 Jacky 的回覆；沒有就挑：①`node scripts/play.mjs bow|staff 地圖 標籤 張數 間隔秒`（這輪進 git 了；`LEVEL=`、`NIGHT=1`、`HP=0.3`）跑弓／杖與後三張圖，找礙眼的地方 ②競技場（PvpScene）也加危險紅暈與敵人招式音效 ③補拍：狼后伏擊（`queen_ambush`，`DIST=3～5`，荊棘谷很慢）、守望者二階段的環。
- 上一輪候選 ①（暴怒狼王瞬移的大字蓋住預告）是真的，修了：`RtBattleScene.refreshBannerAvoid()`，在 `blink` 事件排大字前呼叫。之後任何「Boss 瞬間換位置後馬上排大字」的地方都要先呼叫它。
- 流星箭雨：`fx/rangedFx.ts` 的 `meteorRain`（長弓＋大招＋圓）；底下範圍的顏色和星河貫射同一條分支（`starRiver`）。
- 危險紅暈：規則 `fx/hitTint.ts` 的 `dangerAlpha`（門檻 40%／20%、被打 0.38 秒），貼圖 `fx/feel.ts` 的 `dangerVignette`（深度 46），場景在 `draw()` 最後設不透明度、`damage` 事件記 `heroHitAt`。截圖 `node scripts/shot-danger.mjs 標籤 [W H]`。Jacky 嫌煩就把被打那一下（0.26／0.5）調小，低血的部分留著。
- Q 清單第 1 項（技能特效逐招檢查）**verified**：45 招都看過（雷暴沒動）。
- `shot-boss-attacks.mjs` 多了 `FACE=down|up`，但主角每個 tick 會自動面向 Boss，實際沒作用（瞬移招永遠落在主角離 Boss 較遠的那一邊）；要拍落在北邊得把 Boss 的家搬到主角南邊。

**第 169 輪注意（開場 D-366、敵人招式音效、星河貫射）**：
- **下一輪**先看 Jacky 的回覆；沒有就挑：①暴怒狼王霧中瞬移時，大字「狼王遁入霧中——小心背後！」是不是蓋在主角和預告上（`FURY=1 ONLY=king_mist_rend node scripts/shot-boss-attacks.mjs mistwood 標籤` 拍到的是蓋住，但腳本把狼王和主角釘在一起，要用真實對戰確認）②長弓變化二「流星箭雨」偏稀疏（一大塊灰色圓＋幾支細箭；`fx/rangedFx.ts` 的 `arrowRain`）③補拍：狼后伏擊（`queen_ambush` 這次 `got: queen_claw`，試 `DIST=3～5`；荊棘谷一招要四五分鐘，`timeout` 給 400 秒、不要和別的截圖同時跑）、守望者二階段的環、法杖 A 雷暴（`DIST=2`）。
- **技能特效逐招檢查（Q 清單第 1 項）**：九個大招這輪都看過了；45 招只剩法杖 A 的雷暴沒看。多段招看後面幾段：`FRAMES=3,14,26,50 ONLY=blade_storm node scripts/shot-skills.mjs bow '' 標籤`（命中後第幾幀）。
- 開場：`RtBattleScene.opening()` 的 `skipFirstIntro`（條件在 `ui/tipText.ts`）；目標字條亮一下是 `pulseGoal()`；開場那一區的地名在 `zoneBanner()` 等 `this.hint` 收掉。要看真的新存檔流程：把 `scripts/shot-newsave.mjs` 裡 `localStorage.setItem('jg_prologue_seen','1')` 拿掉（序章會被 AUTOPICK 的「略過」跳掉）、不裝 Bot 就是站著不動的玩家（這輪的 `screenshots/open.mjs`，沒進 git）。
- 敵人招式音效：`audio/sfx.ts` 的 `SFX.enemyImpact(種類, 大小)`，在 `RtBattleScene` 畫落下演出的同一處呼叫；波形檢查 `NAMES=impact:bite:1,impact:claw:0.5 node scripts/probe-sfx.mjs`。**改了 `sfx.ts` 之後要重開 vite**，不然頁面用的是 HMR 的另一份模組、從外面 `import('/src/audio/sfx.ts')` 攔不到呼叫。競技場（PvpScene）沒有加。
- 星河貫射：`fx/rangedFx.ts` 的 `starStream`（大招＋直線＋不是破甲那一箭）；底下範圍的顏色在 `RtBattleScene` 畫技能範圍那段的 `starRiver`。
- 這個環境的時鐘是準的、截圖比上一輪筆記寫的快（新存檔八張約一分鐘）；荊棘谷例外，很慢。

**第 168 輪注意（閃避的回饋與回報 D-365、說明文字對齊全自動）**：
- **下一輪**先看 Jacky 的回覆；沒有就挑：①補拍沒拍到的 Boss 招（狼后伏擊 `queen_ambush`、守望者二階段的環、暴怒狼王的霧中瞬移撕咬）與法杖 A 的雷暴、四把大招 ②開場前十秒太擠（第一幕大字、目標、說明框、金色劇情字、區域名同時出現，第一場戰鬥就在字底下打）③敵人的招落下沒有聲音。
- P1-d 剩下的「操作設定面板說明字」這輪做完了（**verified**，`docs/screenshots/auto-hint-text.jpg`）。
- 閃避回報的參數都在 `data.ts`：`mpGain.dodge`（6）、`DODGE_REFUND_PCT`（50）；規則在 `engine.ts` 的 `dealDamage` 開頭（`Action.paid`）。畫面分級在 `fx/hitTint.ts` 的 `dodgeFeedback`，演出在 `RtBattleScene` 的 `dodged` 事件。**競技場沒有回報**（`s.pvp`）；PvpScene 有自己的事件處理，只共用大字與亮音、沒有停頓。
- 之後若加「閃避成功觸發」的祝福／獨特效果，掛在同一個分支（`act.paid` 那裡）；現有的影步、殘影是「翻滾開始」觸發，不是「閃過」。
- 模擬真人遊玩的截圖：`npx vite --port 5173` → `node screenshots/play.mjs sword|bow|staff 地圖 標籤 張數 每張間隔秒 [W H]`（沒進 git；快轉時把 `__game.scene.render` 換成空函式，最後三幀才畫，不然每幀都畫會慢到逾時）。這個腳本的主角會卡在樹牆後面（直線走向最近的怪），拍前一分鐘夠用。
- Bash 工具回報「逾時 6 分 40 秒」時實際只過了兩分鐘左右（預設逾時是 2 分鐘）；長的截圖指令丟背景、把輸出寫到檔案再看。

**第 173 輪注意（新圖補看、箭頭）**：
- 逐隻拍怪：`npx vite --port 5173` → `node scripts/shot-foe.mjs 地圖 怪id,怪id 標籤 [W H]`（`NIGHT=1`、`LOWFX=1`、`SIDE=left`、`DSF=2`）。Boss 一倒會跳結算面板（其他怪被清掉的關係），看不到 Boss 的碎裂。
- 箭頭「算不算看得到」在 `arrowRules.inViewForArrow`；排位置（讓小地圖／懸賞板／地區名／祝福圖示）還在 `rt/offscreenArrows.ts` 裡一條一條接，再加規則前先想能不能抽成純函式。
- 立繪的發光紋路在遊戲大小下糊掉：`python3 scripts/glow-art.py 圖 顏色 半徑 強度 gamma`（要從原圖做）。燼狼用 `ff7a20 5 0.8 0.8`。
- `play.mjs` 同樣參數跑兩次結果一樣（可以拿來做前後對照）；但 `LOWFX`／視窗大小不同路線就不同。

**第 167 輪注意（打斷、敵人招式落下的演出，D-363／364）**：
- **下一輪**先看 Jacky 的回覆；沒有就挑：①補拍沒拍到的 Boss 招（狼后伏擊 `queen_ambush`、守望者二階段的環、暴怒狼王的霧中瞬移撕咬）與法杖 A 的雷暴、四把大招 ②P1-d 剩下的操作設定面板說明字 ③咬空／震地沒有聲音（要加的話照 `audio` 裡祝福音效的做法，並用 `scripts/probe-sfx.mjs` 看波形）。
- Boss 逐招截圖：`npx vite --port 5173` → `ONLY=king_bite,king_claw node scripts/shot-boss-attacks.mjs mistwood 標籤 [W H]`（`PHASE2=1`、`FURY=1`、`NIGHT=1`、`LOWFX=1`、`DIST=格數`）；招式 id 在 `data.ts`。一招約一兩分鐘，一次最多同時跑三個。輸出若是 `no telegraph`，看 `got`（牠實際出了哪幾招）調 `DIST`。
- 敵人招式落下的演出：分類在 `fx/hitTint.ts` 的 `enemyImpact(形狀, 已有自己演出, 是不是野獸)`；畫在 `fx/fieldFx.ts`（`clawMarks`／`fangBite`／`quakeBurst`／`slamBurst`，月牙用現成的 `cleave`）；場景在 `telegraph` 事件把它排進 `impacts`，畫預告的那一段後面在命中 tick 觸發（`o.action?.id` 還是那一招才畫＝沒被打斷）。新怪只要形狀對就自動有。
- `interrupt` 事件只在怪被 `stun`／`freeze` 時發；玩家目前沒有暈眩技、Boss 免疫冰凍。之後若加「暈 Boss」的效果（祝福／獨特），Boss 的大招就會被打斷——加之前要先想清楚要不要給 Boss 霸體。
- 這輪發現但沒做：`shot-boss-attacks.mjs` 進場的大字（第一幕／歡迎回來）會蓋到前幾張截圖；要乾淨的圖就把 `ff(30)` 加大。

**第 166 輪注意（技能特效逐招檢查，D-361／362）**：
- **下一輪**先看 Jacky 的回覆；沒有就接著逐招（Q 清單第 1 項，**in_progress**：45 招裡 40 招看過；**還沒看**＝法杖 A 的雷暴（怪要擺近：`DIST=2`）、四把大招截圖逾時）；或 Boss 招牌招的預告。
- 逐招截圖：`npx vite --port 5173` → `node scripts/shot-skills.mjs sword|bow|staff ''|a|b 標籤 [W H]`（`ONLY=`、`DIST=`、`NIGHT=1`、`LOWFX=1`）；一次最多同時跑三個。圓形招半徑小於 3.5 格的要 `DIST=2`，不然拍到的是普攻（看輸出的 `hitAt` 是不是等於那招的 atTick）。命中停頓會讓「命中後第 n 幀」前後差一兩個 tick。
- 技能長相的分支都照資料：劍在 `RtBattleScene.skillFxOf`（扇形：護盾招銀白／重擊沒狀態 `ffx.cleave` 金／虛弱 `cleave` 紫；圓：護盾招加金環）；弓的直線箭在 `fx/hitTint.ts` 的 `bowLineLook`（pierce／snare／guard）→ `rangedFx.bowFx` 最後一個參數；繩環 `ffx.snare` 在傷害事件畫。新招只要資料像，就會自動拿到同一種長相。
- 一般技能要全畫面染色用 `feel.ts` 的 `softFlash(scene, 顏色)`，不要再用 `cameras.main.flash`（留給大招與 Boss）。
- 省電畫質的 localStorage：`jackygame.settings` = `{"lowFx":true}`（第 157 輪沒查到的那個）。

**第 165 輪注意（P3-d 收尾、小圖示分色、祝福音效、安全區說明）**：
- **下一輪**先看 Jacky 的回覆；沒有就挑：①Q 清單第 1 項技能特效逐招檢查 ②Boss 招牌招的預告與演出（RF-07 還沒看；`scripts/shot-boss.py` 這次一進場 Boss 就脫戰——主角被放在巢穴紅圈外或被撞出去，要先把主角釘在紅圈內）③P1-d 剩下的小項（操作設定面板說明字）。P1～P3 的子項表全部 verified 了，剩下的是 Jacky 的實機回饋。
- **這輪進 git 的腳本**：`scripts/shot-unique.mjs`（塞獨特裝備進行囊、照 STEPS 一步一張；拍賣所會從伺服器重讀行囊，要 `inj()` 再塞一次）、`scripts/probe-clear-speed.test.ts.txt`（清怪效率）、`scripts/probe-sfx.mjs`（音效離線算波形：峰值／長度／RMS）。
- **快轉截圖裡主角或怪整隻變白不是 bug**：`flashUntil` 用場景時間，`__game.step` 快轉完回到真實 RAF 時間會倒退，白閃一直不結束。要拍立繪就不要快轉，或拍之前 `sc().flashUntil.clear()`。
- 小圖示的顏色在 `fx/hitTint.ts` 的 `skillBadge(欄位 id, 招式定義)`；加新元素色要過 `tests/skill-badge.test.ts`（兩兩 RGB 距離 > 90）。
- 祝福音效在 `audio/sfx.ts` 的 `blessOffer`／`blessPick`／`blessProc(種類)`；種類在 `fx/blessFx.ts` 的 `playBlessProc` 開頭照效果的欄位決定（和演出同一套分支）。新增演出分支時記得給一個種類。
- 星隕高原無裝備 Lv18 的 Bot，帶任何一條獨特效果清怪都沒有變快（瓶頸是生存）；綻光、燼爆略慢，可能是範圍爆炸把旁邊待機的怪拉進來。真人若也覺得「星隕帶爆炸系反而危險」，看 `blessBurst` 要不要不打待機中的怪。
- 安全區：目前只有提示（D-360）；真正的修法候選寫在 D-360。


**第 164 輪注意（P3-a2／b／c 上線）**：
- ~~下一輪：P3-d 剩下的四個小項~~（第 165 輪做完，見上）。
- 獨特裝備的三個地方：機率與每張圖的池在 `loot.ts`（`UNIQUE_DROP`、`UNIQUE_POOLS`）；哪十條與名字在 `gear.ts`（`UNIQUE_TITLES`）；演出在 `RtBattleScene`（`uniqueOnGround`＝地上哪幾件是獨特、`announceUnique`＝撿到的公告、`gearFor`＝這一趟第 n 件掉落的實際裝備）。
- 公告的順序：`announceUnique` 等「稀有裝備！」播完（`rareAt + 1700`）與面板關掉；`showChoice`（討伐後的抉擇）等 `uniqueUntil`／`uniqueBanner`（最多 `uniqueCap` 7 秒）。**無頭瀏覽器的補間時鐘比場景時鐘慢很多**（實測大字在排隊區卡幾十秒），用真實時間驗這種先後會誤判；快轉（`__game.step`＋假 `Date.now`）又會和真的 RAF 混成兩個時鐘。要驗只能看程式邏輯＋Jacky 實機。
- 截圖腳本（沒進 git）：`screenshots/uq.mjs`（塞三件獨特進行囊 → 行囊／詳細／HUD／撿到）、`beam.mjs`（地上四種稀有度並排＋撿起來）、`codex.mjs`、`real.mjs`（把主角攻擊改成 5000 傳到狼王旁邊，真的打倒、撿起來）。
- 量測腳本（沒進 git）：各來源的期望掉落＝對 `rollEnemyLoot` 擲 20,000 次、把 `uq` 加起來；王戰時間＝`createBattle({ effects, level, autoSkills })`＋普通 Bot 濾掉 `skill`，從 Boss 第一次掉血算到倒下。
- **跑測試時不要同時跑無頭瀏覽器**：`tests/rt-perf.test.ts` 會因為搶 CPU 失敗（這輪兩次，單獨跑都過）。
- 畫面層不能新增 localStorage（`tests/game-ratchet.test.ts`）——這輪的圖鑑紀錄因此改成從現有物品算（D-357）。

**第 163 輪注意（效果池第二批、祝福擴圖、P3-a1）**：
- ~~下一輪：P3-a2~~（第 164 輪做完 a2／b／c，見上）。
- 加新效果的地方：資料 `effects.ts`；觸發在 `engine.ts`——範圍傷害一律走 `blessBurst(s, p, x, y, burst, id, skip?)`（事件自動帶半徑；`burstDepth > 0` 時暴擊不再觸發綻光）；圖示 `fx/effectIcon.ts`（`glyph` 現在是 1｜2，同元素最多三種）；演出 `fx/blessFx.ts` 的 `playBlessProc`（照效果的欄位分支，不是照 id）。
- 裝備效果與祝福的差別全在 `s.bless.perm`／`off`（D-354）。`blessEffects(s)` 回「裝備＋祝福」；多人（pid ≥ 1）的隊友沒有任何效果（現有限制，沿用）。
- 量測腳本沒進 git（`screenshots/probe.test.ts.txt`、這輪的 `probe2`）：搬到 `tests/tmp/*.test.ts` 用 `npx vitest run 檔名 --silent=false` 跑；`probe2` 的寫法＝`createBattle({ bless, level, autoSkills })`＋普通 Bot `advanceTo` Boss、指令濾掉 `skill`，記 `blessOffer` 的秒數與王戰時間。
- 截演出：`screenshots/bfx.mjs`（沒進 git）——進場後 `loop.sleep()`，直接呼叫 `sc().playBlessEvent({ type: 'blessProc', id, x, y, r })` 再手動推 3／9 幀；`page.screenshot` 要給 `timeout: 90000`（軟體 WebGL 很慢）。
- 沒做：新效果沒有各自的音效（現在只有畫面）；深夜下的演出沒截圖；祝福清單帶滿 8 個新圖示的版面沒重截（版面程式沒動）。
- 荊棘谷直衝 Boss 的 Bot 常常一個祝福都沒拿到就開王（路短）；真人實測若也這樣，可以把第一個門檻降到 2 或在入口多放一組怪。

**第 162 輪注意（P1-c2 上線、祝福）**：
- ~~下一輪從 P2-c 剩下的開始~~（第 163 輪做完，見上）。
- 冒險地圖的第 3 欄九招可以單獨調，不會動到競技場（競技場用 `data.ts` 的 `ARENA_CHARGE`；`skillDef` 在 `s.pvp` 時回那份）。要測位移招就開 `pvp_arena` 的場次＋`addPlayer(s, { team: 1 })`。
- **無裝備長弓在燼紅裂谷偏弱**：Lv5 普通 Bot 10 種子只有 4 勝（換招前也是 4；劍 10、杖 9）。campaign 測試因此常多跑一兩趟（每趟超時 +15 分鐘，總時間不能直接比）。想處理的話先看 Bot 是被什麼打死，再決定調縛足箭還是弓的護盾；量法：臨時測試跑 `createBattle({ stageId: 'emberrift', level: 5, weapon })`＋`advanceTo` 的普通 Bot × 10 種子數勝場。
- 祝福節奏的量法：`createBattle({ bless: true, autoSkills: [...AUTO_SKILL_DEFAULT] })`＋普通 Bot 的指令濾掉 `skill`、有 `s.bless.offer` 就送 `{ type: 'bless', pick: 0 }`，記每個 `blessOffer` 事件的秒數。第二到第三個之間的 130～250 秒是走路（入口 → 下一片怪區），P2-d 擴圖時看要不要在路上多放一組怪。
- 截特效的凍結圖：無頭瀏覽器每幀很慢，tween 走真實時間——**要在命中的那一個 tick 就 `loop.sleep()`**（晚一個 tick 特效已經播完），再用假 `Date.now`＋`__game.step(T, 16)` 推 5 幀。腳本 `screenshots/slot3.mjs`／`full.mjs`／`blist.mjs`（沒進 git）。
- 還沒做的小項：操作設定面板的說明字（照舊顯示七顆大鍵）、競技場對戰畫面重新截圖確認按鍵名、深夜下的月牙劍氣與落雷。

**第 161 輪注意（Jacky 21:05 的三件事，D-347～349，已上線）**：
- 邊走邊打＝`engine.ts` 的 `moveAttack`（只在玩家自己走的時候）；施放中自己走＝`MOVE_CAST_FACTOR` 0.6；疊放＝`Unit.casts`（`startSkill` 裡 `stack`，`updatePlayer` 開頭跑每一招的命中）；遠程不貼怪＝`updatePlayer` 技能分支的 `ranged`。
- **競技場（`s.pvp`）沒開邊走邊打（普攻）與遠程不貼怪**：做 P1-c2 的 PvP 平衡時一起開、一起調（開了之後杖對劍 18–2、弓對劍 19–1）。PvpScene 的操作因此和冒險地圖不一樣，是暫時的。
- 待看：①`castingSkill` 現在包含疊放中的招——全自動連續疊放時，換打法／祝福要等全部放完才套用，實測有沒有等太久 ②PvpScene 沒畫疊放招的特效（它用事件畫，應該有，沒截圖確認）③Jacky 對 60% 施放移速與疊放的回饋。
- 截圖腳本 `screenshots/move.mjs`（沒進 git）：`sc().commands = () => [{type:'move',…}]` 模擬搖桿繞圈。

**第 160 輪注意（P1-c／P1-d）**：
- **P1-c2 的 PvP**（先 `git apply docs/wip/p1c2-charge-slot.patch`，再 `PVP_PROBE=1 npx vitest run tests/rt-pvp-balance.test.ts` 看三組對戰的勝場，patch 裡已經加了這個開關）：試過「縛足箭 160%＋減速 3.5 秒、落雷 120%」→ 弓對杖從 1–19 翻成 20–0、弓對劍還是 0–20。方向候選：①PvP 的遠程 Bot 走位（`kiteDir`）現在只在普攻冷卻時走，少了後躍後應該「被近身就一直退、放縛足箭再射」；②第 3 欄在競技場給近戰一個追擊手段、給遠程一個脫身手段（例如縛足箭在 PvP 改成定身 0.8 秒，`pvpCc` 有遞減）；③調 `pvp.ts` 的武器別修正。也要重跑 `pvp-ladder-balance`（patch 上去後好裝的分數 1286，門檻 1343）。**做不出平衡就先讓競技場沿用舊的位移招**（`s.pvp` 時 `skillDef` 回舊定義）是保底方案，要記 DECISIONS。
- patch 上去後還有約 20 個測試是「名字／位移距離」的舊斷言（rt-bow、rt-staff、rt-variants、rt-gear、rt-auto-skill 的位移技、settings-auto-migrate、rt-multi、rt-p5、rt-skills、rt-battle 的拉怪判斷）要改；golden hash 要重產。
- 第 4 欄的護盾：`SkillDefinition.guard { hpPct, ticks }`，`startSkill` 裡直接給（事件 `guard`）；`blockTicks` 修正＝護盾量 +5%／點（`GUARD_PCT_PER_POINT`）。護盾量是用「只開自動、不閃不喝水」的腳本調的：長劍 12／18／6%、長弓 9／13／6%、法杖 12／7／9%（原招／變化／變化二）——再高的話（14～22%）不閃的玩家連精英群都穩過，太強。
- 伺服器打怪速度上限改成每分鐘 48、開場 14（`src/server/handlers/loot.ts`）；之後祝福／獨特裝備讓清怪更快時，`tests/loot-kill-cap.test.ts` 會先紅，再調。
- 小圖示排在 `RtBattleScene.btnPos／btnR` 的 `compactList()`；自動清單一變就 `makeButtons()` 重建文字。競技場（`PvpScene`）沒有自動施放，按鍵照舊。
- 截圖腳本 `screenshots/guard.mjs`（沒進 git）：進霧語森林、把主角放到最近的狼旁邊、等 `guard` 事件後第 N tick 凍結截圖；`FULL=1` 拍整個畫面，否則裁主角周圍；第二個參數給 `parry`／`parry:b` 換打法、`ONE` 只留兩欄自動。

## ★★★ 第 158 輪起：Jacky 核准的三項玩法 P1～P3（第三期主軸；排在 Q 清單與剩下的 RF 前面）
> 11/10 17:41 Jacky 核准：自動施放開關、燼火祝福（探索中三選一）、獨特效果裝備。三項共用同一池「會改變打法的效果」。每個子項一輪做得完、做完能 build 能通關；每個小樣做完在 FOR_JACKY 寫去哪裡試。外部審查「不要做局內三選一」這一點 Jacky 已決定不採納。
> **「營火燼牌」已在 D-379（11/12）拿掉**；它和祝福無關（D-342）。

| ID | 子項 | 驗收 | 狀態 |
|---|---|---|---|
| **P1-a** | 自動施放開關：core 規則＋技能樹開關＋技能鍵小標＋存設定 | 測試證明時機與目標由 core 決定、可重播；實際跑三把武器 | **verified**（第 158 輪，D-342；`tests/rt-auto-skill.test.ts` 14 項、`docs/screenshots/p1-auto-cast.jpg`；手感等 Jacky 實機） |
| P1-b | 自動施放收尾 | Jacky 已回饋 → 併入最上面的 P1-c／P1-d | superseded |
| **P2-a** | 效果池＋祝福核心（`src/core/battle/rt/effects.ts`、`BattleState.bless`） | 每個效果的行為測試、可重播、不開的場次雜湊不變 | **verified**（第 158 輪，D-343；`tests/rt-bless.test.ts` 13 項） |
| **P2-b** | 祝福畫面：三選一面板、HUD 計量與圖示、選到／觸發／消散的演出；霧語森林開放 | 390／360 寬、深夜＋省電截圖；實際點擊（換一批、選第二張） | **verified**（第 158 輪；`docs/screenshots/p2-bless-sample.jpg`）；**好不好玩 `awaiting_visual`（等 Jacky 實機）** |
| P2-c | 小樣驗證與調整 | 數據表；Jacky 的回饋優先 | **verified**（第 163 輪，D-352）：①②強度量完（12 種子，數據在 D-352）、③節奏（D-351）、④休息前提醒、⑤清單；效果池 8 → 14（`docs/screenshots/p2c-bless-batch2.jpg`）。**好不好玩仍等 Jacky 實機**，他有回饋就照改 |
| P2-d | 擴到其他三張圖與深夜／暴怒 Boss | campaign 全綠 | **verified**（第 163 輪，D-353；四張圖白天＋深夜都開，`tests/rt-bless.test.ts`；Bot 帶／不帶比較在 D-353） |
| P3-a1 | 獨特效果的戰鬥核心＋物品欄位：`BattleSetup.effects`／`setEffects`、`RtGear.unique`、`isGear`、`gearEffects` | 行為測試；不給效果時雜湊不變 | **verified**（第 163 輪，D-354；`tests/rt-unique-effects.test.ts` 7 項）。還沒有任何物品帶效果，玩起來沒差別 |
| P3-a2 | 獨特裝備真的出現並生效：`genGear` 的 `uniquePct`／`uniquePool`、core `uniqueDropPct`＋掉落事件的 `uq`、伺服器 `loot.claim`、場景 `effects`／`setEffects`、HUD 橘框圖示、行囊等五個面板的顯示 | 行為測試；舊存檔不壞；契約測試；行囊截圖 | **verified**（第 164 輪，D-355；`tests/rt-unique-drop.test.ts`、`docs/screenshots/p3a2-unique-gear.jpg`） |
| P3-b | 掉落演出（光柱、星、音效、撿到的公告）＋來源分層（每張圖四條、精英 4%／Boss 6%／隱藏精英 15%／暴怒 15%／深夜 +5%、第一次打倒 Boss 保底） | 截圖；一般稀有與獨特一眼分得出來 | **verified**（第 164 輪，D-356；`docs/screenshots/p3b-unique-drop.jpg`）；**動態、音效、公告與抉擇面板的先後 `awaiting_visual`（等 Jacky 實機）** |
| P3-c | 效果圖鑑（MENU →「效果圖鑑 n/10」：作用、哪張圖掉、手上有沒有、機率）＝ RF-09 | 截圖 | **verified**（第 164 輪，D-357；`docs/screenshots/p3c-codex.jpg`）。沒做：「曾經取得」的紀錄（要放伺服器角色資料）、打贏 Boss 把效果解鎖進祝福池（現在十條本來就都在祝福池裡，先不做） |
| P3-d | 交易市場顯示與交易獨特裝備；PvP 預設不生效並在介面標明；Bot 比有無效果的討伐時間 | 契約測試、平衡表 | **verified**（第 164～165 輪，D-358）：競技場大廳有寫、`server-http-flow` 驗拍賣所＋面對面交易後效果還在、王戰時間表（PROGRESS 第 164 輪）、清怪效率表（PROGRESS 第 165 輪，`scripts/probe-clear-speed.test.ts.txt`）、圖示橘色＋分解／賣出要點兩次＋拍賣所卡片截圖（`docs/screenshots/p3d-unique-icon-confirm.jpg`）。沒調數值 |

**第 158 輪注意（P2）**：
- 加新效果：在 `effects.ts` 的 `EFFECTS` 加一筆資料（說明裡 `{heavy_slash}` 會換成那把武器的招式名、要短），需要新的觸發時機才動 `engine.ts`（`blessEffects(s)` 的呼叫點：普攻命中、`resolveSkillHit`、`blessKill`、`startDodge`、`dealDamage` 的暴擊）；圖示在 `src/game/fx/effectIcon.ts`（元素＋`glyph`），演出在 `RtBattleScene.playBlessEvent`（`blessProc` 事件帶位置）。P3 的裝備要用同一池：把 `blessEffects` 改成「祝福＋裝備上的效果」即可。
- 開關：場景 `createBattle({ bless: this.tracked && !this.bot })`；地圖要 `stage.bless`（現在只有 `maps/mistwood.ts`）。
- **無頭瀏覽器的場景時鐘比真實時間慢**（每幀 delta 被夾住）：面板的「0.45 秒不收點擊」已改用 `Date.now()`；截圖腳本裡真的滑鼠點擊前要等 6 秒左右（`screenshots/p2click.mjs`，沒進 git）。
- 截圖腳本 `screenshots/p2.mjs`（沒進 git）：`window.HOLD=1` 讓面板停著拍、`PICK=n` 自動選第 n 張；手動 `__game.step` 之後直接 `page.screenshot` 會逾時，要先 `__game.loop.sleep()`。
- 討伐後的「抉擇」面板如果剛好蓋掉祝福面板：祝福面板會留在底下，抉擇關掉後還能選（`blessRoot`）；送出的選擇 1.5 秒沒被 core 處理會重開面板。

**第 158 輪注意（P1）**：
- 自動施放的開關：`getSettings().autoSkills`（`jackygame.settings`）；場景在 `createBattle` 帶進去（有 `?bot=` 就不帶）。測試／截圖要關掉：`LS='{"jackygame.settings":{"autoSkills":[]}}'`。
- **遠程在營火安全區裡打怪，怪會馬上脫戰重置**（`mapAi` 的 `inSafeZone(s, p)`，舊行為）：截圖腳本要先把主角移出安全區（例如 `p.y = 狼.y − 500`）。新玩家拿弓／法杖站在營火旁點狼會看到「脫戰」——第 165 輪加了第一次發生時的說明（D-360，規則沒動）。
- 截圖腳本（`screenshots/p1.mjs`，沒進 git）：照 `scripts/shot-newsave.mjs` 改的，不裝 Bot，改成每 0.5 秒「沒有交戰中的怪就點最近的一隻」＝只管走位的玩家；`sc().openSkills()` 開技能樹後要再 `ff(1.2, true)`（面板淡入要推幾幀，不然截到全黑）。

## ★★ 第 156 輪起：Jacky 回報的 bug 與外部審查 RF 項目（排在下面 Q 清單前面）
> 外部審查（另一個 AI，11/10，針對 d0dd144，沒跑過遊戲）只是參考；「我的判斷」欄是我看程式／畫面後的結論。狀態：`todo`／`in_progress`／`verified`／`awaiting_visual`／`blocked`／`superseded`／`rejected`。
> **精力分配（第 158 輪更新）**：Jacky 的 bug → 可信度問題（都做完了）→ **P1～P3（上面那張表，主軸）** → 空檔做看得到的打磨（下面 Q 清單第 1、3 項）；量測與盤點（RF-04／08／10）有症狀才做——P2／P3 特效變多後若掉幀就要處理 RF-04。

| ID | 內容 | 我的判斷 | 狀態 |
|---|---|---|---|
| **PVP-1** | Jacky 11/10：PvP 沒套用等級／技能／裝備效果、放技能沒出現 | 兩件都是真的（D-338） | **verified**（第 156 輪；`tests/server-contract/pvp-build.test.ts`、`docs/screenshots/pvp-fx-before-after.jpg`；等 Jacky 實機再打一場） |
| RF-01a | 施放中把原招切成變化，這一招沒有傷害 | 同意，是真 bug（在最新 main 重現） | **verified**（第 156 輪，D-339；`tests/rt-midcast-variant.test.ts`） |
| RF-01b | 同上擴及多段、反擊、大招、mods；三武器 | 同意，一起修 | **verified**（同上：三武器 × 五招 × 四種切換＋mods；重置／退點走同一個 setSkillVariants／setSkillMods） |
| RF-05a | 碎甲斬說明寫「更容易爆擊」，實際是受傷 +30% | 同意，改字就好 | **verified**（第 156 輪 fa3137e；全 repo 只有這一處寫錯，Wiki 重產） |
| RF-02a | 四張圖實際掉落的成品對照表（設定 ilvl 對成品 ilvl） | 同意 | **verified**（第 157 輪，D-340；`dropIlvlRange`＋`docs/wiki/monsters.md` 每張圖的成品等級表；`tests/drop-ilvl-and-skill-text.test.ts`） |
| RF-02b | ilvl 12 上限保留或調整 | **保留 12**（D-340；後期獎勵改由 P3 的獨特效果提供），說明已改可信。查到：燼紅裂谷 Boss 白天就掉 12、星隕全圖幾乎都是 12、霧語森林暴怒＋深夜狼王也掉 12 | todo（低～中）：先量「20 級刷哪張圖的暴怒深夜 Boss 最划算」（擊殺秒數 × 件數 × 稀有率），再決定要不要壓低前兩張圖或讓星隕獨有 13～14 |
| RF-05b | 共用 rank 說明套到各武器後有些加成沒作用 | **大部分不成立**：45 種打法全部吃得到（測試鎖住）；只有「傷害 +% 不含灼燒／中毒」會誤會 | **verified**（第 157 輪，D-340；面板多「現在（Lv n）：…」與持續傷害說明，`docs/screenshots/skill-panel-rank-total.jpg`） |
| RF-03 | 弓箭／魔彈在傷害出現後才飛；普攻停頓太頻繁 | 前半成立（逐幀看得出來）；停頓截圖判斷不了 | 箭的時序 **verified**（第 157 輪，D-341；`docs/screenshots/rf03-shot-timing-before-after.jpg`）／普攻停頓 `awaiting_visual`（等 Jacky 實機） |
| RF-07 | 狼系比例與畫風、精英辨識 | 精英辨識現況其實不差（1.4 倍大＋各自標記＋詞綴環）；補了不靠顏色的血條記號 | 精英辨識 **verified**（第 157 輪；`docs/screenshots/elite-hpbar-before-after.jpg`）／狼系畫風不一致 blocked（等 R-021 的圖）／Boss 招式落下的演出 **verified**（第 167 輪，D-364；`docs/screenshots/boss-impact-before-after.jpg`；節奏等 Jacky 實機） |
| RF-06 | 1～4 級只有數值成長；三種打法的用途 | 部分同意；改由 P2 的「這趟暫時用變化打法」祝福處理（原 Q8 技能點里程碑暫緩） | superseded（→ P2-a） |
| RF-09 | 通關後「下一趟去哪、換什麼」的提示 | 同意；由 P3 的效果圖鑑與掉落來源處理 | superseded（→ P3-c） |
| RF-04 | 戰鬥數字／粒子沒有重用 | 有症狀才做（＝ Q7，降到量測類） | todo（低） |
| RF-08 | 長場次 events／units 成長 | 有症狀才做；不直接清 events | todo（低） |
| RF-10 | hash 不完整；PvP 回饋比 PvE 少 | PvP 回饋已併入 PVP-1 做完；hash 需要時再補 | PvP 部分 verified／hash todo（低） |

**競技場還可以再看的（小）**：兩個人疊在一起時名字、招式名、傷害數字會擠成一團；場地縮放 0.44，角色只有約 60px 高，特效是照冒險地圖尺寸縮的；模擬冒險者一律原招。測試用 `window.__pvp`（`state()`／`phase()`／`setup()`／`send(cmd)`）。

## ★ 第 156 輪起：品質 Q 清單（階段 A，最上面先做）
**已完成（第 155 輪，D-335／D-337）**：Q1 倒下依種類（`src/game/fx/deathFx.ts`：`deathKind(defId)`＋`playDeath`，新怪要加進 `KIND`／`DEBRIS` 表，沒加就是野獸倒地）、Q2 命中火花（`fx/feel.ts` 的 `hitSparks`＋`fx/hitTint.ts` 的 `hitLook`，新狀態要加進 `ELEMENT`）、Q3 受擊後仰（`RtBattleScene.knock(id, dx, dy, px, strong)`）、Q4 掉落彈出（`dropPop`＋`DROP_POP_MS`，在 `draw` 的地面掉落段）、Q5 技能冷卻轉好的提示（`cdWas`／`cdReadyAt`，在 `drawUi` 技能鍵段）、Q6 血條殘影（`ghostHp(id, 比例)`，怪頭上／主角／Boss 大血條）。

0. **每輪開頭**：FOR_JACKY「回覆」、Issue、`art-inbox/`、Jacky 的 commit、CI（第 155 輪最後的程式 commit 是「Q5 技能冷卻剛轉好」daba688）。
1. **常用技能特效逐招檢查（Level 2，階段 A 的主菜）**｜**verified**（第 170 輪：45 招全部看過）｜以下是當時的做法紀錄：（第 166 輪：`scripts/shot-skills.mjs`；重斬／鐵壁斬／弓三支箭／影襲／不動架勢／範圍色塊／冰系閃白已修，見上面第 166 輪注意）：第 155 輪沒有逐招看。先用 `window.__rt.send({ type: 'skill', id })`（見下面第 150 輪注意）把三把武器 × 5 招 × 兩種變化各截一張凍結圖，排成對照表存 `docs/screenshots/`，在 27-quality-review 補「哪幾招只有一層特效」，再挑最常用的（劍：普攻、重斬、旋風斬；弓：普攻；杖：星焰彈）補「施法前搖光／拖尾／命中爆點」（`fx/fieldFx.ts` 的 `slash`、`fx/rangedFx.ts`）。**驗收**：每招改動前後並排截圖；特效不改命中形狀（形狀在 core）。
2. ~~Q9 精英辨識~~：第 157 輪做完（血條金框＋金菱形；體型與詞綴環原本就有，沒加 postFX 光暈——截圖看已經夠分得出來）。原構想留著備查：**Q9 精英辨識（Level 2）**：13 種怪是霧狼染色。精英（`x.tier === 'elite'`）：體型 ×1.12（`spriteFor` 的 `hPx`）、腳下詞綴色的環（`AFFIX_COLOR`）、高畫質加 `postFX.addGlow`（只有畫面上的精英、最多 3 隻）。先截圖確認現況精英長什麼樣（可能已經有部分標記）。**驗收**：同畫面普通狼和精英狼一眼分得出來；純畫面。
3. **UI 回饋剩下的（Level 2）**：①裝備稀有度在行囊／掉落提示的呈現（先截圖行囊面板再決定）②競技場（`PvpScene`）也套用 Q2 火花／Q3 後仰／Q6 殘影——競技場有自己的命中處理，第 155 輪沒動；血條是貼圖＋setCrop（D-332），殘影要另外畫一張白條。③~~主角被打的回饋~~（第 170 輪做完：危險紅暈，D-367，`docs/screenshots/danger-vignette.jpg`；競技場還沒有）。
4. **Q7 效能：傷害數字池＋上限、粒子發射器共用**：①`floatNumber` 每個數字 `new Text`（建 canvas＋上傳貼圖）。先量：60 秒 Bot 戰鬥裡 `floatNumber` 呼叫次數與同時存在數的峰值（hook 計數）。做法候選：純數字（沒有 tier、沒有中文字）改用 `BitmapText`＋BootScene 用 canvas 產一張 `0-9!+` 字型貼圖（`RetroFont`）＋物件池（上限 24，超過時最舊的非暴擊數字直接收掉）；有 tier／中文的維持 Text。②`sparks`／`hitSparks`／`deathFx.puff` 每次 `add.particles` 再 destroy → 每個場景每張貼圖一個常駐 emitter，用 `emitter.setConfig`／`emitParticleAt`（Phaser 3.90 的 API 先查文件確認）。**驗收**：旋風斬掃 8 隻以上時新建的 Text 數 = 0；60 秒戰鬥中 `ParticleEmitter` 物件數峰值 ≤ 6；畫面舊新並排看不出差別。
5. **Q10 三情境效能量測腳本**：`scripts/perf-probe.mjs`（照第 154 輪注意的量法：包每個物件的 `renderWebGL` 計時）跑 ①霧語森林白天 60 秒 ②荊棘谷深夜 60 秒 ③星隕高原深夜＋騷動；輸出每幀 JS 更新毫秒（`scene.update` 包計時）、渲染毫秒、活躍單位／Text／ParticleEmitter／Image 數的平均與峰值，表格寫進 PROGRESS。無頭瀏覽器的 fps 不能當手機數據，只比相對值。
6. **Q8 技能點里程碑＝行為升級（Level 3，階段 B 11/15 起；要先寫 DECISIONS）**：`core/meta/skills.ts` 的 `SKILL_TREE` 每級只有數值。構想：3 級、5 級各解鎖一個看得到的變化（例：重斬 3 級劍氣多飛 1 格、5 級命中留一道燃燒地面；旋風斬 3 級多轉一圈、5 級收招放一圈衝擊波），用既有 `SkillMod`（`areaPct`、`distPct`…）或加欄位，**結算在 core**；要跑平衡 Bot（`npm run sim:rt`）、golden hash、`npm run wiki`、伺服器 `skills.*` 契約測試。
7. **線上版遺留（輔，約三成）**：見下面「第二期遺留」第 2、5、6、7 項；阻擋品質工作才提前。
8. **凍結（11/27 12:00 起）**：原 V7 清單（下面第 8 項）＋品質改善前後對照截圖放 README。

**第 157 輪注意**：
- 逐幀看時序的截圖法（`screenshots/` 與根目錄的臨時腳本都沒進 git，要重寫）：dev server 進場 → `scene.events.on('postupdate')` 等條件成立（例：`p.action?.kind === 'attack'`）就 `__game.loop.sleep()` → 假 `Date.now`（加 offset）＋`__game.step(T, 16.667)` 一幀一幀推、每推 2 幀截一張。**不要在 evaluate 裡一次推幾百幀**（無頭瀏覽器每幀都真的畫，會逾時）。
- 把怪釘在主角旁邊拍：改 `u.x／u.y` 後在 `postupdate` 每幀擺回去並清 `u.action`；怪離重生點太遠會「脫戰」變半透明（拍特效沒差，拍立繪要放近一點）。
- `window.__rt.send` 沒有「普攻」指令：把 `p.targetId` 設成目標、站在射程內就會自動打（脫戰的怪只會被打一下）。
- 省電畫質的 localStorage key 這輪沒查到（我試的 `jg_lowfx` 沒作用）；要拍省電畫質先看 `getSettings()`。
- 物品等級的事實看 `docs/wiki/monsters.md` 的成品表，不要看 `gearDrops.ilvl`（那是加成前、截斷前的設定值）。

**第 155 輪注意**：
- 截圖腳本（`screenshots/` 是 gitignore 的，要重寫）：`r155death.mjs`＝dev server 進 RtBattle 後 `__game.loop.sleep()`、假 `Date.now`、`__game.step(T, 16)` 手動推進，場景上直接 `add.image` 四種怪再 `playDeath`，推 130ms 截圖（**遊戲座標是 720 寬**，螢幕 390 寬時要 ×1.85）。受擊後仰：`scripts/shot-newsave.mjs` 的 SHOTS 第二欄塞 JS：`sc().knock(id, 1, 0, 16, true)` → `loop.sleep()` → `step` 一幀（先 `cameras.main.resetFX()`，不然大招的粉紅閃光蓋住整個畫面）。
- 掉落彈出截圖：SHOTS 的 JS 直接 `s.s.ground.push({...})`＋`s.dropPop.set(id, { fx, fy, at: s.time.now })`，`loop.sleep()` 後推 9 幀（放離主角 4 格以上才不會被撿走）。血條殘影：推一幀 → 把怪的 `hp` 改小 → 再推兩幀。技能鍵：把 `p.ready[*]` 設成 `tick + 2` 再推 10 幀。
- `playDeath` 之後立繪由它自己 destroy；`killSprite(id)` 不帶 defId＝離場（despawn），照舊白閃淡出。
- 碎裂倒下會在立繪的貼圖上加 frame（`shard{n}_{i}_{j}`，每張貼圖只加一次）。
- 這個沙盒的 `uptime`／時鐘看起來正常，但第 154 輪之後有一輪（11/7 22:14 的鎖）沒收尾就斷了，原因不明；鎖過期後這輪正常接手。

---
## 第二期遺留（線上版為輔；編號是原本的）
## ★ 第 155 輪起先做（V5／V6 收尾＋美術，11/7–11/11；11/12 12:00 凍結）
**已經有的（到第 154 輪）**：美術 `fx/nightLight.ts`、`fx/pressFx.ts`、`floatNumber` 的 `tier`、`rt/ground.ts` 的 `paintVariety`、`fx/ambient.ts`、`fx/arenaArt.ts`（場地貼圖＋火盆＋`cheer()` 勝利彩紙＋**`roar()` 大招小歡呼**）、`fx/vsIntro.ts`、`fx/bossCues.ts`；**效能：`fx/cachedDraw.ts`（CachedDraw：旅商／燼牌對手／相遇人物／光門畫進 RenderTexture，24fps 重畫）、`rt/uiDisc.ts`（DiscLayer：按鈕圓底貼圖，冒險地圖與競技場共用）、競技場血條貼圖＋setCrop（D-332）**；`simGearRating`（D-326）；賽季（D-328）；`market.history`＋`priceStats`（D-329）、**`market.browse { refs: true }`＋`bargainPct`／`refKey`（D-333）、SQL 遷移 0005 `IX_MarketListing_Sold`**；**`src/server/ledgerCheck.ts` 的 `reconcileCharacter`（D-334）**；`src/game/shopOps.ts`、`ui/memoryBook.ts`；`src/core/meta/`（`shop`、`bag`、`skills`、`cards`、`choices`、`market`、`pvpRank`、`trade`、`roster`、`bounty`、`encounters`）；`core/battle/rt/loot.ts`、`maps/world.ts`；伺服器 handler：`inventory.*`、`enhance.do`、`shop.*`、`skills.*`、`migrate.*`、`cards.*`、`story.*`、`market.*`、`pvp.*`、`trade.*`、`character.*`、`warehouse.*`、`battle.start`／`loot.claim`／`loot.chest`；拒絕稽核；登入 PKCE＋續期＋登出；段位光環。**畫面拆出來的**：`src/game/fx/`（`rangedFx`、`fieldFx`、`groundHazards`、`stormFx`、`companion`、`landmarks`、`eliteFall`、`dashFx`、`coinFly`、`bossCues`）、`src/game/rt/`（`ground`、`offscreenArrows`、`uiDisc`）、`src/game/pvpRecent.ts`。Wiki `docs/wiki/online.md`（手寫）。
1. CI 每輪開頭看一次（第 154 輪最後的程式 commit 是「每日對帳接上線上伺服器」；0005 遷移那次 CI（含 mssql）已綠）。
2. **效能續（D-332 的方法）**：量法見下面「第 154 輪注意」。剩下比較大的：冒險地圖主畫筆 `g` 的**單位**（每隻怪的影子 fillEllipse＋外圈 strokeEllipse＋血條，24 隻約 1,150 筆；要注意影子圖片跟 g 裡其他東西的上下順序）（**做法建議**：影子／外圈若改成圖片，放在 g 前面會被預告染色、放在後面會蓋住段位光環與荊棘根——要拆成「單位底層」一支新畫筆或圖片池＋把段位光環一起搬；第 154 輪評估後沒做）、`drawMinimap`。跟班已做（第 154 輪）。各面板（燼牌 837 行、行商）開著時也可以量一次。
3. ~~帳本對帳接排程~~：第 154 輪做完（`wallets.activeSince`＋`runLedgerAudit`，server/main.ts 每 24 小時）。之後可選：LedgerEntry 加 At 索引（遷移 0006，量大了再說）。
4. **美術續**：A1／A2 等 Jacky 的圖；A5 面板 9-slice 外框（範圍保護第 2 項，可以不做）。小項：拍賣所／交易面板的標題列。**改外觀要附舊／新截圖**。
5. **線上版還沒對上伺服器的**：燼牌面板的錢包仍讀舊 key（已是伺服器快取）；引擎本身的等級在進場時讀舊 key。之後刪掉 `mirrorOnline`、畫面全讀 `characterCache`（大工程，V7 前不一定做）。
6. **Q5 拆場景繼續**（`RtBattleScene` 約 4,900 行，範圍保護：停在 < 4,000 不強求）。剩下的大塊：`draw()` 545 行、`playEvents()` 約 470 行、`drawUi()` 約 190 行、`toggleMenu()`、`openBag()`。
7. **PvE 抽查重跑（選做，26 §3.1）**：只對 Boss 戰；風險低、工程大。
8. **V7（11/12 12:00 起凍結）**：截圖（競技場 VS 開場、結果「今日首勝」＋彩紙、拍賣所「▼便宜」列表與掛單卡片行情、天梯賽季字）、版本 1.2.0、`docs/DEPLOY_AZURE.md` 對照 Bicep 再檢查（遷移已到 0005）、手機效能、`npm run wiki`、開發數字（輪數、commit 數、測試數）。截圖用 `scripts/shot-newsave.mjs`（要先 `npx vite --port 5173`）。

**第 154 輪注意**：
- **量哪個物件慢**：Playwright 進場後把 `scene.children.list` 每個物件的 `renderWebGL` 包一層計時（`performance.now()`），再包 `game.renderer.render` 數幀數 → 每幀每個物件幾 ms。`Graphics.commandBuffer.length` 是「指令＋參數」的數量，只能當參考；**真正貴的是圓／弧／圓角**（每段弧 100 個點）。無頭瀏覽器的 fps 主要卡在軟體繪圖，看不出 JS 的差別，要看 renderWebGL 時間。
- `CachedDraw` 要在**同 depth、該在它上面的東西之前**建立（同 depth 照加入順序）：營火／相遇的在 `this.g` 之前（create 裡），光門在門上的字之前（`setupGate`）。範圍不夠會被切掉：用 `screenshots/bounds.js` 的作法（Proxy 假畫筆收所有座標，跑 10 秒的 now）量。
- `DiscLayer.show(i, …)` 用固定編號；按鈕收掉時 `hideFrom(n)`。
- `market.browse` 的 `refs` 只有面板（`marketOps.step`）帶；模擬冒險者（`SimMarket`）不要帶。
- 開場故事／選武器：截圖腳本先點「略過 ▶▶」(335, 33)、再點「選長劍」(69, 590)。
- `screenshots/` 是 gitignore 的，每輪要自己重寫腳本（這輪的：`probe*.mjs`、`prof2.mjs`、`pvpprof.mjs`、`cmp.mjs`、`mkt.mjs`、`roar.mjs`、`res.mjs`）。

**第 153 輪注意**：
- **Graphics 很多筆畫又不動 → 烤成貼圖**（`arenaArt` 的做法：`scene.make.graphics({}, false)` 畫完 `generateTexture(KEY, W, H)`、`destroy`，`textures.exists(KEY)` 就跳過）。無頭 fps 掉到 3 時 Phaser 的 delta 有上限，`time.delayedCall` 會被拖慢好幾倍（看起來像「卡在某個 phase」）。
- 賽季：`pvp.ladder` 是唯讀（write: false）→ 換季只在 `pvp.finish` 存；ladder 每次用 `pvpSeasonNow` 現算。測試用 `clock.advance(season.leftMs + 60_000)` 跳到下一季。
- 角色新欄位照舊要加進 `MssqlDb.ts` 的 `charRow` Pick 和 save 的 `Data`（`pvpSeason` 已加）。
- 截圖：競技場 VS 開場 `screenshots/r153vs.mjs`（點「開始對戰」→ 等 `phase === 'intro'` → 700ms → `cameras.main.resetFX()`＋`loop.sleep()`）；結果＋彩紙 `r153res.mjs`（`FREEZE=1 WAIT=700`）；上架卡片假 ops `r153mkt.mjs`（`openMarketPanel` 的 ops 要有 `history`）；假 ladder 資料：dev server 裡 `await import('/src/game/pvpOps.ts')` 改 `pvpOps.ladder` 再 `scene.restart()`（**改過檔案後要重開 vite**，HMR 的模組網址帶時間戳會對不上）。

**第 152 輪注意**：
- 無頭 Chromium 截圖有約 1 秒延遲，短動畫拍不到：拍彈跳數字用 `tweens.killTweensOf(t)` 再 `setScale` 固定；按鈕回饋用 `scene.events.on('postupdate')` 逐幀記 scale（無頭約 5 fps）。dev server 裡 `await import('/src/game/fx/feel.ts')` 可以直接呼叫 `floatNumber(sc, …)`。
- 深夜截圖：LS `jg_rt_mistwood`／`jg_rt_thornvale` 設 `{ level: 20, night: true, furyKills: 1, bossKills: 3 }` → `?debug&scene=RtBattle&stage=thornvale`；`__game.scene.getScene('RtBattle').nightLight` 有值就是新光照（省電畫質是 `nightShade`）。
- 舊／新並排：`git stash && npx vite build --outDir /tmp/claude-0/dist-old && git stash pop`，兩個 `vite preview`（4181 舊、4182 新），PIL 左右拼。
- 全域掛場景監聽：`game.isBooted` 在 READY 前就是 true，但 SceneManager 要到 READY 才加場景 → 看 `game.isRunning`；InputPlugin 關場景時會清自己的監聽，所以每次 CREATE 重掛（不會重複）。

**第 151 輪注意**：
- 連勝／首勝存在角色列 `pvpStreak`／`pvpWinDay`（SQL 版在 `Character.Data` JSON，已加進 `MssqlDb.ts` 的 Pick 與 save）；`account.export` 不帶（跟 `pvpHistory` 一樣）。
- 競技場結果畫面截圖：`?debug&scene=Pvp` → 點「開始對戰」(105, 724 @390×844) → 等 `phase === 'fight'` → `sc.showResult({ outcome: 'victory', rating, delta, streak: 3, firstWin: true })`（直接呼叫，不用真的打贏；`this.open` 要是真的，所以要先開局）。
- 拍賣所假 ops 截圖：dev server（5173）頁面裡 `await import('/src/game/ui/marketPanel.ts')` 再 `openMarketPanel(sc, { ops: { view, list, cancel, buy 都回同一個假 page }, bag, coin, coinBefore }, () => {})`（`screenshots/r151mkt.mjs` 的做法）。
- 線上整套飄字驗證：`screenshots/r151online.mjs` 思路：hook `sc.add.text` 收集含「金／粉塵／結晶」的字、推 death 事件殺 6 隻，最後用頁面的 `jg_online_token` 打 `character.list` 比錢包。

**復仇／拆場景注意（第 150 輪）**：
- PvP 場景 `scene.restart({ rematch })`：Phaser 的 `restart()` 沒帶資料會**沿用上一次的 data**，所以 `init` 讀完就把 `this.sys.settings.data` 清成 `{}`。其他場景如果也用 restart 帶資料，一樣要清。
- 戰績每筆的 `foeId` 只有第 150 輪之後打的才有；`historyOf` 會把壞欄位修成安全值。
- 拆出去的特效類別都是場景的欄位初始化（`ffx` 要在 `hz`、`rfx` 之前宣告，因為它們的 host 直接拿 `this.ffx`）。
- Playwright 觸發技能：`window.__rt.send({ type: 'skill', id })`（id 三把武器共用：`heavy_slash`／`whirlwind`／`charge`／`parry`／`blade_storm`），先把 `me.mp = 9999`、`me.ready[*] = 0`；變化用 `s.skillVariants = ['blade_storm']`／`['blade_storm:b']`；地面特效可以直接 `scene.hz.queue({...})`（座標單位 UNIT＝100）。

**沙盒注意（第 149 輪）**：無頭 Chromium 的 IndexedDB 在這個沙盒**一次寫入約 3 秒**（裸 IDB 測過，不是遊戲的問題）→ 新存檔第一次開拍賣所（30 個模擬冒險者補跑）會逾時。截圖拍賣所時用假的 ops（`screenshots/r149mkt.mjs` 的做法），或只拍不需要大量寫入的畫面。

**指名挑戰／戰績／賣出通知注意（第 149 輪）**：
- 角色多了 `pvpHistory`、`marketSeenAt`（和 `pvpRating` 一樣：記憶體／本機 DB 存整列，SQL 版在 `Character.Data` 的 JSON——**新欄位要加進 `MssqlDb.ts` 的 `charRow` Pick 和 save 的 `Data`**，不然 SQL 版會掉）。匯出／匯入不帶這兩個（沒有就是空）。
- `market.mine` 第一次看（`marketSeenAt` 沒有）只記時間、不通知舊的成交。
- 冒險地圖的段位光環只在 **荊棘（1100）以上**才畫（起始 1000 是霧語，不想讓沒打過競技場的人腳下多一圈）；`refreshRank` 每次開遊戲第一次進地圖問一次 `pvp.ladder`。

**登入注意（第 148 輪）**：
- 只有 `import.meta.env.VITE_SERVER_URL` 分支裡才用（離線版 bundle 不含，已檢查）；`crypto.subtle` 要安全來源（https 或 localhost）。
- 自動轉登入頁的防迴圈旗標是 sessionStorage `jg_login_tried`（拿到 token 就清）。

**防作弊注意（第 148 輪）**：
- 改地圖的重生規則（`maxAlive`、`respawnTicks`、`riot`、`hiddenElite`、`bossZone.respawnTicks`）會改到伺服器的上限——`tests/loot-kill-cap.test.ts` 會用 Bot 實打檢查不會擋到正常玩家；它紅了是上限算錯，不是 Bot 太強。
- 新的「客戶端說我拿到了 X」類 handler：照 `loot.claim` 做「規則算得出的上限」＋跨 `battle.start` 帶著走；被拒絕的方法加進 `GameServer.ts` 的 `AUDIT_REJECTED`。
- 帶大資料的新方法（像 `pvp.finish`）要加進 `LARGE_BODY_METHODS`，不然超過 16 KB 會被擋。
- HTTP 整合測試 `tests/server-http-flow.test.ts`：dev token 只能 `dev:[a-z0-9_]`；交易類每秒 2 次，連續動作之間 `breath()`。

**線上版注意（第 147 輪）**：
- 線上版的伺服器結果一律走 `onlineLoot.ts` 的 `synced()`：更新快取 → `mirrorOnline`（items／wallet／level）＋`mirrorEncounters` → 通知場景 `onlineBounty` 重讀行囊。新的線上 handler 照這條走。
- `src/game` 不能碰 localStorage（`tests/game-ratchet.test.ts`）：寫舊 key 要放在 `src/client/legacyOps.ts`。
- 線上整套 Playwright：見第 146 輪的指令；打怪用 `s.events.push({ type: 'death', id, tick })`＋`hp = 0`（會走真的 playEvents → loot.claim）；狼王第一次保底稀有，拿來測行囊。

**線上版注意（第 146 輪）**：
- 判斷線上版一律用 `import.meta.env.VITE_SERVER_URL`（**直接寫在 if 條件裡**，Vite 才會在建置時把離線版的分支拿掉）；新的 src/server import 只能出現在 `localServer.ts` 這條動態載入的路上，不然 `check-online-bundle.mjs` 會擋。
- 線上整套本機試：`npm run build:server && (cd dist-server && AUTH_MODE=dev CORS_ORIGINS=http://localhost:4174 node main.js) &`，`npm run build:online && npx vite preview --outDir dist-online --port 4174`；`screenshots/r146boot.mjs <url> <png>` 會印出 boot 的 kind 與 account。
- vitest 裡測線上路徑：`vi.stubEnv('VITE_SERVER_URL', base)` 再動態 import（見 `tests/online-loot.test.ts`）。
- `loot.claim` 的掉落規則改 `core/battle/rt/loot.ts` 一個地方就好；改了要跑 golden hash（亂數順序不能變）。

**多角色注意（第 145 輪）**：
- 換角色流程在 `src/client/roster.ts`：`switchCharacter` 排在 `legacySerial`（和面板動作同一條佇列）。**新的「角色的」localStorage key 不用做什麼**（預設跟著角色走）；**新的「裝置的」key（教學、操作設定）要加進 `src/net/legacyKeys.ts` 的 `DEVICE_KEY`**，不然換角色會被清掉。
- 伺服器 `toLegacy` 只輸出 `fromLegacy` 認得的欄位；**RtRecord 加新欄位時兩邊都要加**（`tests/server-contract/roster.test.ts` 的來回測試會抓到）。
- 截圖腳本 `screenshots/r145.mjs`（標題 → 角色 → 建立 → 法杖 → 等標題重開（等「武器\n法杖 ⇄」出現）→ 切回）、`r145w.mjs`（`sc.openShop()` → 倉庫 → 點裝備）。無頭瀏覽器換角色後標題重開要好幾秒。
- 線上伺服器本機跑：`npm run server:dev`（記憶體 DB）或 `npm run build:server && cd dist-server && AUTH_MODE=dev node main.js`；`curl -X POST -H 'Content-Type: application/json' -d '{"v":1,"id":1,"method":"character.list","params":{},"token":"dev:me"}' localhost:8080/api`。

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
