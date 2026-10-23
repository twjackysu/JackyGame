# 下一步（依優先順序，最上面先做）

> 現在是 **階段 0（規劃）**。設計未定稿前不寫遊戲功能程式碼（可以做管線/工具）。

1. **寫 `docs/design/07-ui-ux.md`**：每個畫面的直式線框（ASCII 示意即可）— 標題、節點地圖、地點、對話、戰鬥（上敵下我、行動順序條、4 大按鈕、時機光環位置）、燼牌（三燈列 ×2、手牌扇形、熄燈按鈕）、選單分頁（隊伍/裝備/筆記/羈絆/設定）。標明拇指熱區、點擊目標尺寸、轉場動畫。
2. **寫 `docs/design/08-script-ch0-ch1.md`**：序章與第 1 章完整劇本（每場景對白 ≤15 則，含選擇、檢定、旗標名、效果）。依 02 與 04 的大綱。
3. **寫 `docs/design/09-data-tables.md`**：P0 燼牌 30 種卡（名稱、燈列、點數、關鍵字、陣營）、第 1 章敵人數值與攻擊模式（預兆顏色、時序）、5 位角色技能表（SP/星燼消耗、倍率）。
4. **一致性審查**：通讀 01–09，修正矛盾（例：數值、名詞），更新 06 目錄結構；然後在 `docs/PLAN.md` 頂端標記「設計定稿：✅」並在 DECISIONS 記一筆。
5. 定稿後（可能仍在 10/24–25）：開始 M0 核心引擎（`src/core/state`、`save`、`dialogue`、`battle` + 測試）。

## 已知狀態 / 注意事項
- Pages 部署失敗是因為 Pages 未啟用（等 Jacky），**不要再花時間修**；CI 與 Android APK 都綠燈。
- 截圖：`npm run build && npm run screenshot`（會用 `?skipIntro`，headless 很慢只有 ~1fps，所以別等動畫）。
- `pkill -f` 會殺到自己的 shell，用 PID kill。
- `npm ci` 前設 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。
