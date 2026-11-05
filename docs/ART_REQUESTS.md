# 美術需求清單（給 Jacky 的本機 Agent 用 GPT／Gemini 產圖）

> **唯一的美術需求佇列。** 開發迴圈需要 AI 圖時只在這裡新增。11/5 第 137 輪清理過：已完成的舊項目全部刪掉（要查 prompt 看 git 歷史）。

## 規則
1. **額度**：GPT 剩 1 張、Gemini 剩 4 張（整個專案上限 GPT 8／Gemini 12）。
2. 精緻、玩家會盯著看的 → **GPT**；普通、量多的 → **Gemini**，盡量一張圖多個物件（sheet）。
3. 遊戲不依賴這些圖：都有程式美術或舊圖備援，圖到了才替換。

## 產圖流程
1. 照「工具」產圖，prompt = 項目 prompt + 下方「共同風格」。
2. 存成指定檔名（`.png`）放進 `art-inbox/`，commit 並 push 到 `main`，把狀態改成「已上傳 日期」。
3. 匯入（去背、切格、縮圖、更新 `src/data/handArt.ts`）：`pip install "rembg[cpu]"` 後 `node scripts/import-art.mjs`（開發迴圈也會自動做）。
4. 小技巧：主體有亮綠色時綠幕會吃掉那些部位——GPT 改要「透明背景 PNG」，Gemini 改用洋紅 #FF00FF 底。

### 共同風格
- **角色**：`Style: high-quality anime gacha game art, clean sharp lineart, painterly cel shading, rich lighting, fantasy RPG, detailed modern anime style. No text, no watermark, no frame. All-ages.`
- **主角外觀（每張主角圖都要一致）**：`The hero: a teenage boy with messy dark-brown hair and warm amber eyes, long red scarf flowing in the wind, dark navy-black long coat with gold trim and a small compass emblem, brown leather belts and gloves, brown boots. He does NOT carry a lantern.`

## 需求清單（待產）

### R-018 標題主視覺（換掉提燈版）
- **工具**：GPT（P1，用掉最後 1 張 GPT）
- **檔名**：`bg_title_keyart.png`（直式 9:16，例如 1024×1820；不去背，匯入後寬 1440）
- **為什麼**：現在的標題圖主角手上提著燈，但遊戲裡已經沒有燈這種武器（只有長劍、長弓、法杖）；旁邊的白髮少女遊戲裡也沒有。
- **構圖重點**：上方 1/3 是星空（標題字會疊在這裡，不要放重要東西）；下方 1/4 會壓暗放按鈕。主角在畫面中下、略偏左。
- **prompt**：
  `Vertical 9:16 key art for a mobile fantasy action RPG title screen. A lone young swordsman stands on a mossy cliff edge at night, seen from slightly below and behind at a 3/4 angle, looking out over a vast fantasy world. He holds a slender longsword with a faint cyan glowing edge lowered at his side; a longbow is slung across his back. The hero: a teenage boy with messy dark-brown hair and warm amber eyes, long red scarf flowing in the wind, dark navy-black long coat with gold trim and a small compass emblem, brown leather belts and gloves, brown boots. He does NOT carry a lantern. Below and beyond him the world unfolds in layers: a misty violet forest with drifting light motes nearest, then a crimson thorn valley, then a far volcanic rift glowing with orange lava cracks, and on the horizon a crystal plateau of blue-violet star crystals. The upper third of the image is a breathtaking starry night sky with the Milky Way and several falling meteors streaking down (keep this area clear of characters for the title text). A glowing cyan portal of light rises faintly in the distant forest. Warm campfire embers float up from the bottom of the frame. Epic, hopeful, cinematic lighting, strong rim light on the hero from the stars, rich deep blues and purples with orange accents. No other characters, no text, no logo, no watermark. Style: high-quality anime gacha game art, clean sharp lineart, painterly cel shading, rich lighting, fantasy RPG, detailed modern anime style. All-ages.`
- **狀態**：待產

### R-019 主角 Q 版戰鬥圖：三把武器（換掉提燈版）
- **工具**：Gemini（P2，1 張 sheet）
- **檔名**：`sheet_hero_weapons.png`（橫式 3 格，例如 1536×640；`scripts/art-sheets.json` 已設定切成 `hero_sword`／`hero_bow`／`hero_staff`）
- **為什麼**：戰鬥中的主角圖（`hero_lian`）也是提燈的。到圖後遊戲會依目前武器自動換圖（程式已寫好，`heroKey()`）。
- **prompt**：
  `A character sheet with 3 equal cells side by side, the same chibi (Q-version, about 2.5 heads tall) anime hero in each cell, full body, standing in a ready battle pose, 3/4 view FACING RIGHT, each centered in its own cell with generous empty margin, not touching the cell borders. Cell 1: holding a longsword with a faint cyan glowing edge. Cell 2: holding a wooden longbow with a nocked glowing arrow, quiver on the back. Cell 3: holding a tall star-tipped magic staff with a glowing violet crystal. The hero: a teenage boy with messy dark-brown hair and warm amber eyes, long red scarf flowing in the wind, dark navy-black long coat with gold trim and a small compass emblem, brown leather belts and gloves, brown boots. He does NOT carry a lantern. Solid pure magenta #FF00FF background, no grid lines, no text, no watermark. Style: high-quality anime gacha game art, clean sharp lineart, painterly cel shading, rich lighting, fantasy RPG, detailed modern anime style. All-ages.`
- **狀態**：待產

## 目前遊戲用到的 AI 圖（`public/art/`）
`bg_title_keyart`（R-018 會取代）、`hero_lian`（R-019 會取代，取代後保留當備援）、`enemy_boss_wolfking`、`enemy_mist_wolf`、`enemy_thorn_shroom`、`enemy_thorn_mother`、`enemy_boss_thornqueen`、`enemy_thorn_wolf`、`enemy_thorn_stalker`、`enemy_ember_colossus`、`enemy_slag_slime`。
