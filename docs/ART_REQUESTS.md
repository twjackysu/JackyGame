# 美術需求清單（給 Jacky 回國後的本機 Agent 用 GPT／Gemini 產圖）

> **這是唯一的美術需求佇列。** 開發迴圈需要 AI 繪圖時，只在這裡新增項目，不要另開檔案。Jacky 的本機 Agent 會照這份清單產圖。
> 已完成的角色立繪與 Q 版戰鬥圖紀錄在 `docs/ART_PROMPTS.md`。

## 規則（開發迴圈必讀）
1. **額度有限，總量上限：GPT 8 張、Gemini 12 張（整個專案）。** 目前已排定的數量寫在下方「額度統計」，新增前先確認不會超過。
2. **精緻、玩家會盯著看的**（Boss、主視覺、重要角色）→ **GPT**。**普通、一次很多的**（道具圖示、地圖物件、小怪）→ **Gemini**，而且盡量用**一張圖多個物件**（sheet，見下）來省額度。
3. 遊戲**不能依賴這些圖**：每一項都要先有程式美術備援，圖到了才替換（`src/data/handArt.ts` 有該 key 就用圖）。
4. 每一項寫清楚：檔名、工具、優先級、用途與尺寸、prompt、狀態。prompt 用英文，最後接上「共同風格」。
5. 能用程式做好的（地面圖塊、水面、光影、粒子、UI）不要列進來。AI 圖塊很難無縫拼接，所以**不要要求 tileset**；地圖用程式圖塊，加上 AI 畫的獨立物件（建築、樹、箱子）。

## 給產圖 Agent 的流程
1. 從上往下挑「狀態：已上傳 2026-10-24」的項目，P1 先做。照指定工具（GPT／Gemini）產圖，一項一張；不滿意可以重產，但盡量一次到位。
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

## 額度統計
- GPT：已排 4／8
- Gemini：已排 5／12

## 需求清單

### R-001 ｜ GPT ｜ P1 ｜ `enemy_boss_wolfking.png` ｜ 狀態：已上傳 2026-10-24
- 用途：第 1 章 Boss「霧角狼王」戰鬥圖（正面，Q 版，跟現有我方 Q 版圖同畫風）。要接上 `import-art.mjs` 的 `enemy_` → `enemy_boss_wolfking` 材質。
```
Chibi / SD style (2.5 heads tall) giant mist wolf king boss, front 3/4 view, huge pale antlers like a stag that glow faint violet,
dark grey-blue fur dissolving into mist at the edges, glowing violet eyes, snarling, mist swirling around its paws,
menacing but stylish.
```

### R-002 ｜ GPT ｜ P1 ｜ `enemy_boss_bellworm.png` ｜ 狀態：已上傳 2026-10-24
- 用途：第 2 章 Boss「鐘喉蠕蟲」（礦坑）。
```
Chibi / SD style giant armored mine worm boss rising from rubble, its mouth is shaped like a cracked bronze bell with glowing
amber light inside, rocky segmented carapace with embedded crystals and old mining lanterns, dust and sparks, front view.
```

### R-003 ｜ GPT ｜ P1 ｜ `enemy_boss_starfall.png` ｜ 狀態：已上傳 2026-10-24
- 用途：最終 Boss「蝕星者」本體（第一段＋核心共用）。
```
Chibi / SD style cosmic final boss "the Eclipsar": a floating black sun-like core with a cracked violet slit eye in the center,
surrounded by orbiting shards of fallen stars and dark tendrils of starlight, ominous purple and gold glow, front view,
awe-inspiring and beautiful.
```

### R-004 ｜ GPT ｜ P2 ｜ `bg_title_keyart.png` ｜ 狀態：已上傳 2026-10-24
- 用途：標題畫面主視覺（直式 9:16，1080×1920 左右，**不去背**）。連恩舉著提燈、伊歐在身旁，背景是墜星的夜空與遠方城堡。標題字由遊戲程式疊上去，**圖上不要有字**，上方 1/3 留給標題。
```
Vertical 9:16 key visual for an anime fantasy RPG title screen. A handsome 16-year-old boy with messy dark brown hair, amber eyes,
long black coat and red scarf, holding up a glowing ornate brass lantern; beside him a gentle silver-haired girl in a flowing
white-and-blue dress with glowing motes. They stand on a cliff at night, looking at a sky full of falling stars over a distant
castle city. Upper third of the image is open night sky for a logo. Cinematic warm lantern light vs cool starlight.
No text. High-quality anime gacha game art, painterly.
```

### R-005 ｜ Gemini ｜ P1 ｜ `sheet_items.jpg`（4×4 共 16 格）｜ 狀態：已上傳 2026-10-24
- 用途：道具／送禮物品圖示（商店、背包、送禮）。格子順序見 `scripts/art-sheets.json` 的 `sheet_items`。
```
A 4x4 grid of 16 fantasy RPG item icons, front view, in this order (left to right, top to bottom):
small red healing potion, large red healing potion, small flask of golden lamp oil, round glass bomb bottle with fuse,
bundle of green healing herbs, blue mana ether vial, ornate brass key, bouquet of white wildflowers,
old leather-bound book, small brass clockwork gear toy, silk ribbon with star charm, bottle of red wine,
pack of tarot-like playing cards, glowing orange star-ember crystal, rolled parchment map, leather coin pouch.
```

### R-006 ｜ Gemini ｜ P1 ｜ `sheet_gear.jpg`（4×3 共 12 格）｜ 狀態：已上傳 2026-10-24
- 用途：裝備圖示（商店、裝備欄）。順序見 `art-sheets.json` 的 `sheet_gear`。
```
A 4x3 grid of 12 fantasy RPG equipment icons, front view, in this order:
simple brass lantern, ornate star-engraved lantern, plain steel longsword, silver knight longsword with blue gem,
heavy halberd, alchemist staff with glowing orange bulb, cloth traveler's tunic, brown leather armor,
silver plate armor with star crest, silver ring with violet gem, golden amulet with sun emblem, small lucky charm with bell.
```

### R-007 ｜ Gemini ｜ P1 ｜ `sheet_town_props.jpg`（3×2）｜ 狀態：已上傳 2026-10-24
- 用途：灰燈鎮地圖物件（探索場景 E1／E2）。順序見 `sheet_town_props`。
```
A 3x2 grid of 6 medieval fantasy town map objects for a top-down JRPG, in this order:
small stone cottage with red tiled roof, timber-framed two-story house, tavern with hanging sign and warm windows,
general store with awning and crates, stone well with wooden roof, iron street lamp post with glowing lantern.
```

### R-008 ｜ Gemini ｜ P2 ｜ `sheet_forest_props.jpg`（3×2）｜ 狀態：已上傳 2026-10-24
- 用途：霧語森林、礦坑周邊地圖物件。順序見 `sheet_forest_props`。
```
A 3x2 grid of 6 fantasy forest map objects for a top-down JRPG, in this order:
tall dark pine tree, round leafy oak tree, mossy boulder, bush with small glowing blue flowers,
wooden treasure chest with brass trim, wooden signpost with two arrows.
```

### R-009 ｜ Gemini ｜ P2 ｜ `sheet_forest_enemies.jpg`（3×2）｜ 狀態：已上傳 2026-10-24
- 用途：第 1、2 章小怪（戰鬥＋地圖明雷縮小用）。順序見 `sheet_forest_enemies`。
```
A 3x2 grid of 6 chibi / SD fantasy monsters, front view, in this order:
mist wolf (grey-blue fur fading into fog, violet eyes), thorn mushroom creature (red cap with thorns, angry face),
shadow boar (black bristles, glowing ember tusks), rock beetle (stone shell with crystals),
lantern wraith (ghost holding a broken mining lantern, teal flame), blast lizard (orange lizard with glowing volatile belly).
```
