# 美術需求清單（給 Jacky 的本機 Agent 用 GPT／Gemini 產圖）

> **唯一的美術需求佇列。** 開發迴圈需要 AI 圖時只在這裡新增。11/5 第 137 輪清理過：已完成的舊項目全部刪掉（要查 prompt 看 git 歷史）。

## 規則
1. **額度**：GPT 剩 0 張、Gemini 剩 0 張（整個專案上限 GPT 8／Gemini 12）。11/11 產了 R-020（1 張）、R-021（2 張：第一張底色偏暗玫瑰紅不是純洋紅，Jacky 同意用保留的那張重產）。
2. 精緻、玩家會盯著看的 → **GPT**；普通、量多的 → **Gemini**，盡量一張圖多個物件（sheet）。
3. 遊戲不依賴這些圖：都有程式美術或舊圖備援，圖到了才替換。
4. **第三期（11/10，D-336）**：R-020、R-021 仍是最優先（25 種怪有 13 種是同一張狼圖染色）；倒下、命中、受擊反應都用程式做，不需要圖。若之後有多的額度，候選是主角三把武器的攻擊姿勢各一張（還沒寫成需求，等額度確認再排）。

## 產圖流程
1. 照「工具」產圖，prompt = 項目 prompt + 下方「共同風格」。
2. 存成指定檔名（`.png`）放進 `art-inbox/`，commit 並 push 到 `main`，把狀態改成「已上傳 日期」。
3. 匯入（去背、切格、縮圖、更新 `src/data/handArt.ts`）：`pip install "rembg[cpu]"` 後 `node scripts/import-art.mjs`（開發迴圈也會自動做）。
4. 小技巧：主體有亮綠色時綠幕會吃掉那些部位——GPT 改要「透明背景 PNG」，Gemini 改用洋紅 #FF00FF 底。

### 共同風格
- **角色**：`Style: high-quality anime gacha game art, clean sharp lineart, painterly cel shading, rich lighting, fantasy RPG, detailed modern anime style. No text, no watermark, no frame. All-ages.`
- **主角外觀（每張主角圖都要一致）**：`The hero: a teenage boy with messy dark-brown hair and warm amber eyes, long red scarf flowing in the wind, dark navy-black long coat with gold trim and a small compass emblem, brown leather belts and gloves, brown boots. He does NOT carry a lantern.`

## 需求清單（待產）
### R-020 `sheet_starfall_foes`（Gemini，優先：高）
- **用途**：星隕高原（通關後地圖）現在是程式美術或狼圖染色。一張 1×3 sheet → `enemy_star_sentinel`（Boss「星骸守望者」）、`enemy_crystal_golem`（「晶殼魔像」）、`enemy_star_wolf`（「星痕狼」）；切格設定已寫在 `scripts/art-sheets.json`。三隻都**面朝右**、全身、腳底對齊同一條線。
- **底色**：洋紅 #FF00FF（主體有藍綠光，不用綠幕）。
- **Prompt**：`A horizontal character sheet with 3 separate full-body monsters on a flat solid magenta (#FF00FF) background, evenly spaced with wide empty gaps, all facing right, feet on the same baseline, no overlap. 1) "Star Sentinel" boss: a towering ancient guardian made of cracked dark-blue meteorite stone and floating star fragments, a glowing pale-gold core in its chest, a halo ring of tiny stars behind its head, long stone arms with crystal claws, imposing and majestic. 2) "Crystal Golem": a squat sturdy golem of translucent violet crystal shards over grey rock, glowing seams, small glowing eyes. 3) "Star-marked Wolf": a lean wolf with midnight-blue fur, glowing pale-blue constellation markings along its body, starlight wisps trailing from its tail.`
- **狀態**：已上傳 11/11（`art-inbox/sheet_starfall_foes.png`，1376×768，Gemini 只給 JPG，已轉成 PNG；底色約 (250,50,247)，不是完全純洋紅）
- **切格注意**：三隻大小差很多，**不能均分三格**（守望者寬到 x=526，均分線 459 會切到牠）。主體外框（px）：守望者 x 50–526、魔像 x 556–916、星痕狼 x 940–1340；建議切在 x≈541 與 x≈928。腳底線 y≈688–694。守望者與魔像是偏正面的 3/4 角度，只有狼完全面朝右。

### R-021 `sheet_wolf_variants`（Gemini，優先：中）
- **用途**：燼紅裂谷與星隕高原有 6 種狼都是霧狼圖染色，看起來一樣。一張 1×4 sheet → `enemy_ember_wolf`（燼狼）、`enemy_magma_stalker`（熔岩巡獵者）、`enemy_obsidian_alpha`（黑曜狼首）、`enemy_eclipse_wolf`（蝕月狼）。都**面朝右**、全身、同一條腳底線，體型和現有 `enemy_mist_wolf` 相近。
- **底色**：洋紅 #FF00FF。
- **Prompt**：`A horizontal creature sheet with 4 separate full-body wolves on a flat solid magenta (#FF00FF) background, evenly spaced with wide empty gaps, all facing right in a prowling pose, feet on the same baseline, no overlap, similar size. 1) "Ember Wolf": charcoal-grey fur with glowing orange cracks like cooling lava, ember sparks rising from its back. 2) "Magma Stalker": a larger, leaner wolf with molten-red mane, armored with black volcanic rock plates, glowing yellow eyes. 3) "Obsidian Alpha": a heavy pack-leader wolf covered in glossy black obsidian spikes with purple reflections, scarred muzzle. 4) "Eclipse Wolf": deep violet-black fur, a dark crescent-moon mark on its forehead, a faint purple corona outline around its body.`
- **狀態**：已上傳 11/11（`art-inbox/sheet_wolf_variants.png`，1376×768，Gemini 只給 JPG，已轉成 PNG；底色約 (254,1,249)）
- **切格注意**：四隻狼彼此沒有相連，但**尾巴和前一隻的頭在 x 方向重疊**，直線切格（均分或手切）都會切到尾巴——請用「去背後取相連區塊」的方式分開四隻。主體外框（px，左到右）：燼狼 x 14–353、熔岩巡獵者 x 317–701、黑曜狼首 x 650–1036、蝕月狼 x 996–1355；腳底線 y≈560–567。

## 已完成（prompt 見 git 歷史）
| 編號 | 工具 | 檔名 | 用在 |
|---|---|---|---|
| R-018 | GPT | `bg_title_keyart` | 標題主視覺：主角拿劍背弓站在崖上，遠景是四張地圖（11/5，取代提燈版） |
| R-019 | Gemini | `sheet_hero_weapons` → `hero_sword`／`hero_bow`／`hero_staff` | 戰鬥中的主角，依目前武器換圖（11/5）。拿著弓／杖的圖就不再疊程式畫的弓與木杖，只留拉弓、施法的發光 |

- R-019 的切格沒用 `art-sheets.json` 均分：弓的箭尖貼到第 2／3 格分界，均分＋內縮會切掉箭尖，所以照空白欄手切（494／1053 px）。洋紅底改用「跟背景相連、而且是純洋紅」的區塊去背，法杖的紫水晶才不會被當背景吃掉。

## 目前遊戲用到的 AI 圖（`public/art/`）
`bg_title_keyart`（R-018）、`hero_sword`／`hero_bow`／`hero_staff`（R-019）、`hero_lian`（舊提燈版，保留當備援）、`enemy_boss_wolfking`、`enemy_mist_wolf`、`enemy_thorn_shroom`、`enemy_thorn_mother`、`enemy_boss_thornqueen`、`enemy_thorn_wolf`、`enemy_thorn_stalker`、`enemy_ember_colossus`、`enemy_slag_slime`。
