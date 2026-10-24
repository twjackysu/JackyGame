# 角色立繪：請用 Gemini / ChatGPT 產生後上傳（給 Jacky）

> 📌 **新的美術需求一律寫在 [`docs/ART_REQUESTS.md`](ART_REQUESTS.md)**（有額度上限、GPT／Gemini 分工、檔名規則）。本檔保留第一批角色立繪的紀錄。

> **10/24 更新**：遊戲裡已經有動漫風程式立繪（D-037），這份流程改為「想要更高品質時」的可選項目。上傳的圖會自動取代同名角色的程式立繪。

> 雲端開發環境連不到 Gemini／ChatGPT 網頁，也不能用你的帳號，所以這一步需要你在手機上做。
> 你上傳之後，下一輪開發迴圈會自動去背、縮圖，然後換進遊戲（對話立繪、羈絆面板）。不用改程式。

## 流程（手機約 10 分鐘）
1. 把下面的「共同風格」接在每個角色描述後面，貼進 **ChatGPT**（建議用這個，可以要求透明背景）或 **Gemini**。
2. 每個角色挑一張最滿意的。不滿意可以接著說「臉再帥一點」「眼睛大一點」「換個角度」。
3. **檔名就是角色 id**：`lian.png`、`io.png`、`serin.png`、`liora.png`、`rourke.png`（jpg／webp 也可以）。
4. 上傳到 repo 的 `art-inbox/` 資料夾。
   - 手機瀏覽器開 https://github.com/twjackysu/JackyGame/tree/main/art-inbox ，右上「…」切到「電腦版網站」，按 **Add file → Upload files**，選圖，Commit 到 main。
   - 不方便的話，也可以開一個 GitHub Issue，標題寫「立繪」，把圖片拖進留言。迴圈會從 Issue 下載。
5. **優先順序**：連恩（男主角）→ 伊歐（女主角）→ 瑟琳 → 莉歐拉 → 洛克。先給前兩張就有很大差別。

## 規格（很重要）
- **半身像**（腰部以上），角色正面或微側，**直式 2:3**（例如 1024×1536）。
- **背景**：最好是**透明背景 PNG**。做不到的話，用**純綠色（#00FF00）背景**，不要有漸層、地面或光暈。伊歐是白髮，所以**不要用白色或淺灰背景**。
- 不要有文字、浮水印、邊框。
- 同一套風格畫全部角色（同一個對話串接著產生，風格最一致）。

## 共同風格（每次都接在描述後面）
```
Style: high-quality anime gacha game character portrait, clean sharp lineart, cel shading with soft gradients,
beautiful detailed eyes, dramatic warm rim light from a lantern, fantasy RPG, half body (waist up), facing slightly
to the side, 2:3 vertical, single character, transparent background (if not possible: solid pure green #00FF00
background), no text, no watermark, no frame. All-ages, tasteful.
```

## 角色描述

### 1. 連恩（lian）— 男主角
```
A handsome 16-17 year old boy, the "Lampbearer". Messy dark brown hair with a few amber highlights, sharp but gentle
amber-gold eyes, confident slight smirk (he secretly knows everything about this world). Long dark navy traveler's
coat with brass buttons, worn red scarf, leather gloves. Holds up an ornate brass lantern glowing warm gold with
tiny star-like embers floating out of it. Cool, heroic, a bit mysterious.
```

### 2. 伊歐（io）— 女主角
```
A beautiful ethereal girl around 16, long flowing silver-white hair that softly glows at the tips, pale blue eyes
like starlight, gentle shy expression with a faint smile. Simple white and pale-blue layered dress with a translucent
shawl, barefoot feel, small glowing motes of light floating around her. Mysterious "deleted heroine" aura, fragile
but kind. Elegant and pretty.
```

### 3. 瑟琳（serin）— 女劍士
```
A proud beautiful knight girl around 17, long dark violet hair in a high ponytail, sharp violet eyes, determined
confident expression. Silver-and-navy knight armor with a star crest on the chestplate, short blue cape, holds a
longsword resting on her shoulder. Elegant, strong, cool beauty.
```

### 4. 莉歐拉（liora）— 發明家
```
A cheerful energetic alchemist girl around 16, fluffy short copper-orange hair, big brass goggles pushed up on her
forehead, bright green eyes, wide grin. Brown leather vest with many pouches, rolled-up sleeves, small glowing orange
bomb in one hand, little smoke puffs. Cute and lively.
```

### 5. 洛克（rourke）— 老傭兵
```
A rugged handsome veteran mercenary in his 40s, short grey-streaked dark hair, stubble, a scar across one eyebrow,
tired but warm eyes, half smile. Broad shoulders, heavy dark cloak over battered plate armor, holds a halberd.
Reliable big-brother / father figure vibe.
```

### （可選）6. 大司星 瓦爾德蘭（valdran）— 反派
```
An elegant cold villain in his 50s, long silver hair, pale violet eyes, calm cruel smile. Ornate white-and-gold
high priest robes with a star crown and orbiting constellation ornaments. Intimidating, beautiful, regal.
```

## 之後
- 戰鬥畫面的小人目前還是程式剪影。立繪換好、風格確定後，可以再請你生成「Q 版戰鬥站姿」（同樣規格，全身、透明背景）。
- 生成的圖會記在 `docs/CREDITS.md`（「角色立繪：由 Jacky 使用 ChatGPT／Gemini 生成」）。

## 已完成
- 10/24：6 張半身立繪＋6 張 Q 版戰鬥圖（`<id>_battle.png`）都已匯入。之後若要補 Boss 的 Q 版正面圖，檔名先問開發迴圈（需要加對應）；配角立繪用 `npc_tia.png` 這種名稱即可。
