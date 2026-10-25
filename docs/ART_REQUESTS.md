# 美術需求清單（給 Jacky 回國後的本機 Agent 用 GPT／Gemini 產圖）

> **這是唯一的美術需求佇列。** 開發迴圈需要 AI 繪圖時，只在這裡新增項目，不要另開檔案。Jacky 的本機 Agent 會照這份清單產圖。
> **待產 1 項（P2，可有可無）**：R-012 荊棘母樹（第 20 輪新增）。Jacky 回國前不用產圖；遊戲已用程式備援（荊棘射手圖放大＋綠色＋程式畫的荊棘根）。

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
- GPT：已用 4／8；已排定 1（R-012）→ 剩 3
- Gemini：已用 5／12（剩 7）

## 需求清單（待產）

### R-012 `enemy_thorn_mother.png`（GPT，P2）
- **用途**：霧語森林的世界精英「荊棘母樹」（D-107），不會動、體型約狼王的 1.3 倍。畫面高約 2.6 格。
- **目前備援**：`enemy_thorn_shroom` 放大＋綠色調＋程式畫的荊棘根（`RtBattleScene` 的 `SPRITE.thorn_mother`）。圖匯入後把 `SPRITE.thorn_mother.key` 改成 `enemy_thorn_mother`、拿掉 tint。
- **prompt**：`A colossal ancient thorn tree spirit, the "Thorn Mother", rooted in place: gnarled dark trunk with a faintly glowing green core like a heart, a crown of twisting bramble branches with long purple-tipped thorns, roots spreading outward like grasping hands, a few pale blossoms and drifting spores, menacing but beautiful, slightly chibi proportions to match a mobile action RPG, seen from the front at a slight top-down angle.` ＋ 共同風格（角色、敵人）
- **狀態**：待產

## 已完成
- R-001～R-009 與第一批角色立繪都已產過（prompt 見 git 歷史）。舊主線刪除後（D-097），遊戲只用到其中 5 張：`bg_title_keyart`（R-004）、`enemy_boss_wolfking`（R-001）、`enemy_mist_wolf`、`enemy_thorn_shroom`（R-009）、`hero_lian`（第一批 Q 版）；其餘已從 `public/art/` 刪除。

## 已取消
- R-010 `sheet_party_walk`（隊伍正面走路小人）、R-011 `sheet_town_npcs`（鎮民走路小人）：只給舊主線的自由探索（ExploreScene）用；10/24 改成即時戰鬥後舊主線不再加功能（D-065、D-087），所以取消，不佔額度。程式備援（戰鬥背影圖、程式小人）照舊。
