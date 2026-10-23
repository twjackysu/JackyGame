# 進度紀錄（新的在最上面）

## 2026-10-23 22:19–23:20（台北）第 1 輪 — 階段 0 啟動 → 設計定稿 → M0 核心引擎
**做了什麼**
- 建立 repo 結構與交接文件（PLAN / NEXT / PROGRESS / DECISIONS / FOR_JACKY）。
- 技術骨架：TypeScript + Vite 8 + Phaser 3.90，720×1280 直式；程式生成的標題場景《星燼回響》（夜空漸層、星點、旋轉星印、發光標題、餘燼粒子、山稜剪影、點擊閃光/震動/音效）；i18n（zh-TW/en）；WebAudio SFX 合成器；mulberry32 RNG。
- PWA：vite-plugin-pwa（離線預快取）、manifest、自產圖示（SVG → PNG）。
- Capacitor 8：`android/`、`ios/`（SPM）專案，鎖直式。
- GitHub Actions：CI、Pages 部署、Android APK → Releases `latest`。
- 設計文件初稿 01–06（市場調查、世界觀與故事、核心玩法、內容規劃、美術音效、技術架構）。

- 設計文件 07 UI/UX、08 序章+第 1 章劇本、09 P0 資料表、10 第 2 章～終章大綱。
- **兩次獨立設計審查**（子代理）：
  - 第一次：燼牌太像知名卡牌小遊戲 → 改成原創「五燈座對峙 + 月相」v2；序章太像某轉生追放作品開場 → 改成「遠征隊在遺跡拋下提燈雜役」+ 前世 15 秒冷開場；補完戰鬥規則漏洞；第 1 章加入洛克客座。
  - 第二次（含 Python 模擬：燼牌 2000 局、戰鬥 3000 場）：加入「熄燈獎勵」、P0 關鍵字/月相縮減、狼王每輪 2 動與全體攻擊、雜魚 HP 調整。
- **設計定稿**（D-013），提前開始 M0：`src/core/` 純邏輯
  - `cards/`：燼牌 v2 引擎 + AI（400 局模擬玩家勝率 52.5%）
  - `state/`：GameState、效果/條件、檢定機率、經驗
  - `save/`：版本化存檔、備份、壞檔回退、無 localStorage 退路
  - `dialogue/`：對話執行器（條件、屬性/筆記檢定、外部事件）
  - `input/`：觸控手勢分類（tap/swipe/hold）
  - `battle/`：公式 + 事件式回合引擎 + 技能 + 平衡模擬（狼王：新手勝率 94%／9.5 回合；高手 100%／7.7 回合）
- CI 加入 Playwright 煙霧測試（執行期錯誤即失敗、上傳截圖）。

**「好玩嗎？」檢查**：還沒有可玩的場景，無法判斷手感；數值模擬顯示戰鬥長度與威脅在目標附近。下一輪 BattleScene 是關鍵。

**驗證**
- 最終：`npm run typecheck`、`npm test`（70 tests）、`npm run build` 全過；CI ✅（含煙霧測試）。
- 本機 `npm run typecheck`、`npm test`（9 tests）、`npm run build` 全過；Playwright 截圖確認標題畫面正常（見下）。
- GitHub Actions：CI ✅、Android APK ✅（第 2 次，修掉 setup-android 後）、Pages ❌（Pages 未啟用 → FOR_JACKY）。

**問題**
- android-actions/setup-android@v3 在 runner 上失敗 → 改用預裝 SDK。
- Pages 需要業主手動啟用。
