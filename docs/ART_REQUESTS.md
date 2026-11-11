# 美術需求清單（給 Jacky 的本機 Agent 用 GPT／Gemini 產圖）

> **唯一的美術需求佇列。** 開發迴圈需要 AI 圖時只在這裡新增。11/5 第 137 輪清理過：已完成的舊項目全部刪掉（要查 prompt 看 git 歷史）。

## 規則
1. **額度**：GPT 剩 0 張、Gemini 剩 0 張（整個專案上限 GPT 8／Gemini 12）。11/11 產了 R-020（1 張）、R-021（2 張：第一張底色偏暗玫瑰紅不是純洋紅，Jacky 同意用保留的那張重產）。
2. 精緻、玩家會盯著看的 → **GPT**；普通、量多的 → **Gemini**，盡量一張圖多個物件（sheet）。
3. 遊戲不依賴這些圖：都有程式美術或舊圖備援，圖到了才替換。
4. **第三期（11/10，D-336）**：R-020、R-021 已在 11/11 匯入（還剩 7 種怪是霧狼染色：幼狼、狼群首領、影狼、夜棘狼首、迷霧巡守、彗星巡者，和霧狼自己）；倒下、命中、受擊反應都用程式做，不需要圖。若之後有多的額度，候選是主角三把武器的攻擊姿勢各一張（還沒寫成需求，等額度確認再排）。

## 產圖流程
1. 照「工具」產圖，prompt = 項目 prompt + 下方「共同風格」。
2. 存成指定檔名（`.png`）放進 `art-inbox/`，commit 並 push 到 `main`，把狀態改成「已上傳 日期」。
3. 匯入（去背、切格、縮圖、更新 `src/data/handArt.ts`）：`pip install "rembg[cpu]"` 後 `node scripts/import-art.mjs`（開發迴圈也會自動做）。
4. 小技巧：主體有亮綠色時綠幕會吃掉那些部位——GPT 改要「透明背景 PNG」，Gemini 改用洋紅 #FF00FF 底。

### 共同風格
- **角色**：`Style: high-quality anime gacha game art, clean sharp lineart, painterly cel shading, rich lighting, fantasy RPG, detailed modern anime style. No text, no watermark, no frame. All-ages.`
- **主角外觀（每張主角圖都要一致）**：`The hero: a teenage boy with messy dark-brown hair and warm amber eyes, long red scarf flowing in the wind, dark navy-black long coat with gold trim and a small compass emblem, brown leather belts and gloves, brown boots. He does NOT carry a lantern.`

## 需求清單（待產）
（目前沒有待產的項目。）

## 已完成（prompt 見 git 歷史）
| 編號 | 工具 | 檔名 | 用在 |
|---|---|---|---|
| R-018 | GPT | `bg_title_keyart` | 標題主視覺：主角拿劍背弓站在崖上，遠景是四張地圖（11/5，取代提燈版） |
| R-020 | Gemini | `sheet_starfall_foes` → `enemy_star_sentinel`／`enemy_crystal_golem`／`enemy_star_wolf` | 星隕高原：Boss 星骸守望者、晶殼魔像、星痕狼（星輝狼首用同一張放大）（11/11） |
| R-021 | Gemini | `sheet_wolf_variants` → `enemy_ember_wolf`／`enemy_magma_stalker`／`enemy_obsidian_alpha`／`enemy_eclipse_wolf` | 燼紅裂谷三種狼＋星隕的星蝕狼（11/11） |
| R-019 | Gemini | `sheet_hero_weapons` → `hero_sword`／`hero_bow`／`hero_staff` | 戰鬥中的主角，依目前武器換圖（11/5）。拿著弓／杖的圖就不再疊程式畫的弓與木杖，只留拉弓、施法的發光 |

- R-019 的切格沒用 `art-sheets.json` 均分：弓的箭尖貼到第 2／3 格分界，均分＋內縮會切掉箭尖，所以照空白欄手切（494／1053 px）。洋紅底改用「跟背景相連、而且是純洋紅」的區塊去背，法杖的紫水晶才不會被當背景吃掉。

## 目前遊戲用到的 AI 圖（`public/art/`）
`bg_title_keyart`（R-018）、`hero_sword`／`hero_bow`／`hero_staff`（R-019）、`hero_lian`（舊提燈版，保留當備援）、`enemy_boss_wolfking`、`enemy_mist_wolf`、`enemy_thorn_shroom`、`enemy_thorn_mother`、`enemy_boss_thornqueen`、`enemy_thorn_wolf`、`enemy_thorn_stalker`、`enemy_ember_colossus`、`enemy_slag_slime`。

- R-020／R-021 沒用 `import-art.mjs`：`python3 scripts/cut-sheet.py sheet.png 名字,名字`（照離洋紅底色的距離算透明度、取相連區塊分開每一隻，尾巴互相重疊也不會切到），再 `python3 scripts/rim-art.py 圖 顏色 gamma`（深色的狼在深色地圖上看不見，調亮＋加一圈柔光邊）。
