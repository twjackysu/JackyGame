# 星燼回響 Echoes of Starfall

> 前世是冷門手遊的全成就玩家，轉生進那款遊戲的世界——他記得森林裡哪裡藏著寶箱、狼王撞上岩壁會暈、連續打倒幾群狼就會引出首領。

原創冒險 RPG，手機單機（iOS / Android / PWA），**完全離線**、直式單手操作、單人即時動作戰鬥。

🚧 **開發中**（2026-10-23 開工，11/05 成果發表）。進度見 [`docs/PROGRESS.md`](docs/PROGRESS.md)，計畫見 [`docs/PLAN.md`](docs/PLAN.md)。

## 霧語森林
- **一整張可以自由走的森林**（48×96 格、六個地區），整張地圖就是一場即時戰鬥：走過去、狼看到你就醒、直接開打，沒有切換戰鬥畫面，也沒有時間限制。
- **簡單但吃技巧**：左下搖桿或點地面移動，放開就自動追擊＋普攻；右下重斬、旋風斬、衝鋒、格擋反擊、閃避，打出傷害集滿 MP 放大招「劍刃風暴」。敵人出手前地上會出現紅色範圍，**由內往外填滿就命中**；黃框的攻擊可以格擋反擊。
- **越深越兇、也掉得越多**：南營地 → 森林入口 → 狼群巢穴／森林深處 → 精英狼群 → **霧角狼王**（兩階段、衝鋒撞岩壁會暈）。狼王打倒後離開巢穴會回來，可以一直挑戰、刷最快紀錄。
- **越刷越強**：打怪得經驗、升級立刻變強；怪物會掉**裝備**（6 格：武器、頭盔、鎧甲、護手、戒指、項鍊；普通／精良／稀有，精良以上地上有光柱、帶隨機詞綴；稀有還有「重斬冷卻 −12%」「旋風斬範圍 +25%」「格擋判定 +0.1 秒」這類技能特效）。在「行囊」看「換上後攻擊 +12・HP +80」再決定；用不到的分解成粉塵，**在營火旁強化 +1～+10**；每次進森林第一次打倒狼王保底稀有。實測普通 Bot 刷 30 分鐘後，同一隻狼王從約 170 秒打到約 90 秒。
- **暴怒狼王**（Lv8 或討伐 3 次解鎖，☰ 開關）：HP、攻擊大增、出招更快，但一次掉 3 件、物品等級更高、稀有 70%。
- **深夜的森林**（打倒暴怒狼王解鎖）：同一張森林變暗，狼群更兇、掉得更多更好。
- **營火**：怪不追進火堆旁；點營火休息回滿、補藥水；倒下會在營火醒來；營火旁可以直接開行囊、強化。
- **遊戲記憶**：靠近隱藏寶箱會浮現「這個地方似乎有點熟悉……」；不倒下連殺 12 隻會引出隱藏首領；偶爾會有狼群暴動。
- **紀錄**：等級、行囊、累計擊殺與材料、開過的寶箱、狼王討伐次數與最快時間，自動存在手機上。
- **操作自訂**：拖曳調整每顆按鈕與搖桿的位置、交換技能欄、左手模式、按鈕大小、桌機改鍵（☰ → 操作設定）。

## 畫面

| 霧語森林 | 霧角狼王 | 預告＋格擋反擊 |
|:-:|:-:|:-:|
| ![霧語森林](docs/screenshots/26-mistwood.jpg) | ![狼王](docs/screenshots/23-realtime-boss.jpg) | ![即時戰鬥](docs/screenshots/22-realtime.jpg) |
| **行囊（裝備比較、▲ 比較好）** | **等級提升** | **操作設定（改鍵、左手、按鈕位置）** |
| ![行囊](docs/screenshots/27-rt-bag.jpg) | ![升級](docs/screenshots/28-rt-levelup.jpg) | ![操作設定](docs/screenshots/29-rt-controls.jpg) |
| **營火（怪不追進來、休息與復活）** | **繞石尋路、拉怪、大招與藥水** | **標題** |
| ![營火](docs/screenshots/25-camp-clearing.jpg) | ![碎石林道](docs/screenshots/24-rock-grove.jpg) | ![標題](docs/screenshots/01-title.jpg) |

> 音效、音樂全部程式即時生成（WebAudio），repo 裡沒有音訊素材檔。標題主視覺、主角與怪物圖由 Jacky 用 AI 繪圖產生（`public/art/`，需求清單 `docs/ART_REQUESTS.md`）；地面、樹林、營火、光影、粒子、介面是程式繪製，每張 AI 圖都有程式備援。

## 怎麼玩
- **PWA（任何手機瀏覽器）**：https://twjackysu.github.io/JackyGame/ 
  - iOS Safari：分享 → 加入主畫面；Android Chrome：選單 → 安裝應用程式。之後可離線遊玩。
- **Android APK**：[Releases → latest](https://github.com/twjackysu/JackyGame/releases/tag/latest) 下載 `jackygame-debug.apk`，允許「安裝未知來源應用程式」後安裝。
- **iOS（原生，需 Mac）**：
  1. 安裝 Xcode、Node 22+。
  2. `npm ci && npm run build && npx cap sync ios && npx cap open ios`
  3. Xcode → Signing & Capabilities → Team 選你的（免費）Apple ID，Bundle ID 若衝突就改一個。
  4. 接上 iPhone，按 ▶︎ 執行。iPhone 上到「設定 → 一般 → VPN 與裝置管理」信任開發者。免費帳號簽署 7 天有效。
- 開發用試玩小關卡：`?debug&scene=RtBattle&stage=wolf_king`（`forest_entry`／`wolf_den`／`forest_deep`／`elite_pack`／`rock_grove`／`camp_clearing`，☰ 可換關；加 `&bot=expert` 看 Bot 自己打）。

## 開發
```bash
npm ci            # 需 Node 22.12+
npm run dev       # 開發伺服器
npm test          # vitest
npm run build     # typecheck + 產出 dist/
npm run sim:rt    # 即時戰鬥無畫面模擬報表
```
技術：TypeScript、Vite、Phaser 3、vite-plugin-pwa、Capacitor 8。戰鬥核心是純 TypeScript（`src/core/battle/rt/`，30 ticks/秒、可重現），畫面層在 `src/game/`。

## 文件
- 設計：[`docs/design/`](docs/design/README.md)　決策：[`docs/DECISIONS.md`](docs/DECISIONS.md)　開發紀錄：[`docs/PROGRESS.md`](docs/PROGRESS.md)

## 授權
GPL-3.0，見 [LICENSE](LICENSE)。
