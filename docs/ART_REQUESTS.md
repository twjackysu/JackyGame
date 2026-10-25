# 美術需求清單（給 Jacky 回國後的本機 Agent 用 GPT／Gemini 產圖）

> **這是唯一的美術需求佇列。** 開發迴圈需要 AI 繪圖時，只在這裡新增項目，不要另開檔案。Jacky 的本機 Agent 會照這份清單產圖。
> **待產 4 項**：R-013 棘冠狼后（GPT，P1，第 22 輪新增：第二張地圖「荊棘谷」的 Boss）、R-014 棘背狼（Gemini，P2）、R-012 荊棘母樹（GPT，P2）、R-015 荊棘巡獵者（Gemini，P3，第 24 輪）。Jacky 回國前不用產圖；全部已有程式備援（現有立繪染色）。

## 規則（開發迴圈必讀）
1. **額度有限，總量上限：GPT 8 張、Gemini 12 張（整個專案）。** 目前已排定的數量寫在下方「額度統計」，新增前先確認不會超過。
2. **精緻、玩家會盯著看的**（Boss、主視覺、重要角色）→ **GPT**。**普通、一次很多的**（道具圖示、地圖物件、小怪）→ **Gemini**，而且盡量用**一張圖多個物件**（sheet，見下）來省額度。
3. 遊戲**不能依賴這些圖**：每一項都要先有程式美術備援，圖到了才替換（`src/data/handArt.ts` 有該 key 就用圖）。
4. 每一項寫清楚：檔名、工具、優先級、用途與尺寸、prompt、狀態。prompt 用英文，最後接上「共同風格」。
5. 能用程式做好的（地面圖塊、水面、光影、粒子、UI）不要列進來。AI 圖塊很難無縫拼接，所以**不要要求 tileset**；地圖用程式圖塊，加上 AI 畫的獨立物件（建築、樹、箱子）。

## 給產圖 Agent 的流程
1. 從上往下挑「狀態：待產」的項目，P1 先做。照指定工具（GPT／Gemini）產圖，一項一張；不滿意可以重產，但盡量一次到位。
2. prompt = 項目的 prompt + 下方對應的「共同風格」。
3. 存成項目指定的**檔名**（`.png`），放進 repo 的 `art-inbox/`，commit 並 push 到 `main`。
4. 把該項目的狀態改成「已上傳 YYYY-MM-DD」。
5. 匯入（去背、切格、縮圖、更新 `src/data/handArt.ts`）由開發迴圈下一輪自動做；本機要自己跑的話：`pip install "rembg[cpu]"` 後執行 `node scripts/import-art.mjs`。

### 檔名規則（決定匯入時怎麼處理）
| 前綴 | 用途 | 處理 |
|---|---|---|
| `bg_` | 背景（標題主視覺、地圖遠景） | 不去背，寬度縮到 1440 |
| `enemy_` | 敵人、野獸、Boss（正面，Q 版） | 去背，高 640 |
| `npc_` | 配角立繪（半身） | 去背，高 1100 |
| `walk_` | 地圖上行走的小角色 | 去背，高 192 |
| `prop_` | 建築、樹、箱子等地圖物件 | 去背，高 512 |
| `item_` | 道具、裝備圖示 | 去背，高 256 |
| `sheet_` | 一張圖多個物件 | 依 `scripts/art-sheets.json` 均分切格後，每格照上面規則處理 |

### 共同風格
- **角色、敵人（GPT／Gemini 都用）**：
  `Style: high-quality anime gacha game art, clean sharp lineart, painterly cel shading, rich lighting, fantasy RPG, matches a cast drawn in detailed modern anime style. Single subject, full body, transparent background (if not possible: solid pure green #00FF00), no text, no watermark, no frame. All-ages.`
- **地圖物件、道具（sheet 用）**：
  `Style: polished fantasy RPG game asset sheet, top-down 3/4 view (classic JRPG perspective) for map objects / front view for item icons, painterly anime style, soft lighting, each object centered in its own equal grid cell with generous empty margin, objects do not touch or overlap cell borders, solid pure green #00FF00 background, no grid lines, no text, no watermark.`

## 額度統計（已用的照算）
- GPT：已用 4／8；已排定 3（R-012、R-013、R-016）→ 剩 1
- Gemini：已用 5／12；已排定 3（R-014、R-015、R-017）→ 剩 4

## 需求清單（待產）

### R-013 `enemy_boss_thornqueen.png`（GPT，P1）
- **用途**：第二張地圖「荊棘谷」的 Boss「棘冠狼后」（D-114），會動、會衝鋒、會鑽進荊棘從背後出現。畫面高約 3.2 格，和霧角狼王同尺寸。
- **目前備援**：`enemy_boss_wolfking` 染淡綠（`RtBattleScene` 的 `SPRITE.thorn_queen`）。圖匯入後把 `SPRITE.thorn_queen.key` 改成 `enemy_boss_thornqueen`、拿掉 tint。
- **prompt**：`A majestic giant she-wolf boss, the "Thorn-Crowned Queen": sleek moss-green and ash-grey fur, a crown of twisted bramble with long purple-tipped thorns growing from her head and spine, glowing poison-green eyes, thorny vines coiled around her forelegs, a few crimson berries and pale blossoms in the brambles, drifting green spores around her, regal and dangerous, slightly chibi proportions to match a mobile action RPG, standing pose facing the viewer at a slight top-down angle.` ＋ 共同風格（角色、敵人）
- **狀態**：待產

### R-014 `enemy_thorn_wolf.png`（Gemini，P2）
- **用途**：荊棘谷的小怪「棘背狼」（D-114），數量多。畫面高約 2.9 格，和霧狼同尺寸。
- **目前備援**：`enemy_mist_wolf` 染綠（`SPRITE.thorn_wolf`）。圖匯入後改 key、拿掉 tint。
- **prompt**：`A lean feral wolf with dark olive fur and a ridge of sharp bramble thorns growing along its back and tail, small dripping green poison on its fangs, crouched ready to pounce, slightly chibi proportions to match a mobile action RPG, facing the viewer at a slight top-down angle.` ＋ 共同風格（角色、敵人）
- **狀態**：待產

### R-015 `enemy_thorn_stalker.png`（Gemini，P3）
- **用途**：荊棘谷會巡邏的世界精英「荊棘巡獵者」（D-117），在迴廊來回走、玩家會盯著牠的動向。畫面高約 3.1 格，比棘背狼大一號。
- **目前備援**：`enemy_mist_wolf` 染橘紅（`SPRITE.thorn_stalker`）＋程式畫的仇恨圈、視線扇形與腳印。圖匯入後改 key、拿掉 tint。
- **prompt**：`A large hunting wolf, the "Thorn Stalker": rust-red and charcoal fur, a mane and spine of long curved bramble thorns, a tattered vine wrapped around its neck like a hunter's scarf, one glowing amber eye and one scarred eye, low prowling stance mid-stride as if patrolling, menacing and alert, slightly chibi proportions to match a mobile action RPG, facing the viewer at a slight top-down angle.` ＋ 共同風格（角色、敵人）
- **狀態**：待產

### R-016 `enemy_ember_colossus.png`（GPT，P2）
- **用途**：第三張地圖「燼紅裂谷」的 Boss「燼心岩王」（D-125），慢、重，拳擊、熔岩裂地、重踏。畫面高約 3.2 格（半徑比狼王大一點）。
- **目前備援**：程式畫的玄武岩巨像（`src/game/fx/emberArt.ts` 的 `makeEmberColossus`，開機時產生 `enemy_ember_colossus` 材質）。圖匯入後同名檔案會蓋過程式材質（`makeEmberColossus` 看到材質已存在就不畫）；若檔名不同，改 `RtBattleScene` 的 `SPRITE.ember_colossus.key`。
- **prompt**：`A towering basalt golem boss, the "Ember-Heart Colossus": a body of stacked black volcanic rock slabs held together by glowing orange magma seams, a blazing molten core visible in its chest like a heart, small head with two slit eyes of white-hot light, massive boulder fists hanging to its knees, small flames flickering on its shoulders, drifting embers and ash, heavy and ancient, slightly chibi proportions to match a mobile action RPG, standing pose facing the viewer at a slight top-down angle.` ＋ 共同風格（角色、敵人）
- **狀態**：待產

### R-017 `enemy_slag_slime.png`（Gemini，P3）
- **用途**：燼紅裂谷的小怪「熔渣史萊姆」（D-125），數量多、會跳過來壓人。畫面高約 1.1 格（矮胖）。
- **目前備援**：程式畫的焦黑殼熔岩團（`makeSlagSlime`，材質 `enemy_slag_slime`）。圖匯入後同名蓋過即可。
- **prompt**：`A round blob of molten slag, the "Slag Slime": a crust of cracked black volcanic rock plates floating on a bright orange-yellow molten body, glowing cracks between the plates, two small glowing yellow eyes, drips of lava at the bottom, cute but dangerous, slightly chibi proportions to match a mobile action RPG, facing the viewer at a slight top-down angle.` ＋ 共同風格（角色、敵人）
- **狀態**：待產

### R-012 `enemy_thorn_mother.png`（GPT，P2）
- **用途**：霧語森林的世界精英「荊棘母樹」（D-107），不會動、體型約狼王的 1.3 倍。畫面高約 2.6 格。
- **目前備援**：`enemy_thorn_shroom` 放大＋綠色調＋程式畫的荊棘根（`RtBattleScene` 的 `SPRITE.thorn_mother`）。圖匯入後把 `SPRITE.thorn_mother.key` 改成 `enemy_thorn_mother`、拿掉 tint。
- **prompt**：`A colossal ancient thorn tree spirit, the "Thorn Mother", rooted in place: gnarled dark trunk with a faintly glowing green core like a heart, a crown of twisting bramble branches with long purple-tipped thorns, roots spreading outward like grasping hands, a few pale blossoms and drifting spores, menacing but beautiful, slightly chibi proportions to match a mobile action RPG, seen from the front at a slight top-down angle.` ＋ 共同風格（角色、敵人）
- **狀態**：待產

## 已完成
- R-001～R-009 與第一批角色立繪都已產過（prompt 見 git 歷史）。舊主線刪除後（D-097），遊戲只用到其中 5 張：`bg_title_keyart`（R-004）、`enemy_boss_wolfking`（R-001）、`enemy_mist_wolf`、`enemy_thorn_shroom`（R-009）、`hero_lian`（第一批 Q 版）；其餘已從 `public/art/` 刪除。

## 已取消
- R-010 `sheet_party_walk`（隊伍正面走路小人）、R-011 `sheet_town_npcs`（鎮民走路小人）：只給舊主線的自由探索（ExploreScene）用；10/24 改成即時戰鬥後舊主線不再加功能（D-065、D-087），所以取消，不佔額度。程式備援（戰鬥背影圖、程式小人）照舊。
