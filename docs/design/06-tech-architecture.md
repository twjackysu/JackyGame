# 06 技術架構

## 1. 技術選型（已實作骨架）
| 項目 | 選擇 | 版本 | 理由 |
|---|---|---|---|
| 語言 | TypeScript | 5.9.3 | 型別安全；刻意不用 7.x 原生編譯器（太新） |
| 建置 | Vite | 8.3.5 | `base: './'` 讓 Pages 子路徑與 Capacitor 都能用 |
| 引擎 | Phaser 3 | 3.90.0 | 成熟 2D、WebGL postFX、粒子、補間、Scale Manager |
| PWA | vite-plugin-pwa (generateSW) | 2.0.0 | 離線預快取、autoUpdate |
| 原生包裝 | Capacitor | 8.5.3 | Android（CI 產 APK）+ iOS 專案（SPM，Jacky 用 Xcode 建置） |
| 測試 | Vitest | 5.0.5 | 純邏輯單元測試 + 無頭平衡模擬 |
| 截圖 | Playwright（預裝 Chromium） | 1.63.0 | `npm run screenshot`，URL 加 `?skipIntro` |

## 2. 目錄結構（目標）
```
src/
  main.ts                 進入點
  game/
    config.ts             Phaser 設定（720×1280 portrait, FIT）
    scenes/               Phaser 場景（只做「呈現」）
      BootScene.ts        生成材質、載入
      TitleScene.ts
      MapScene.ts         區域節點地圖
      LocationScene.ts    地點畫面（熱點）
      DialogueScene.ts    對話覆蓋層（可疊在任何場景上）
      BattleScene.ts      戰鬥
      CardScene.ts        燼牌
      MenuScene.ts        隊伍/裝備/筆記/羈絆/設定
    fx/                   特效工具：shake, hitStop, flash, particles 預設, postFX 包裝
    ui/                   按鈕、面板、對話框、數字彈跳等元件
    art/                  程式生成美術：角色剪影部件、背景生成器、圖示
  core/                   純邏輯（不得 import phaser），全部可測
    rng.ts
    state/                GameState 型別、旗標、聲望、偏移值
    save/                 存讀檔（版本化 + migration）
    battle/               戰鬥規則引擎（回合、傷害、狀態、AI）
    cards/                燼牌規則引擎 + AI
    dialogue/             對話腳本執行器（條件、效果、檢定）
    progression/          經驗、等級、技能樹
    sim/                  無頭模擬（平衡）
  data/                   內容資料（TS 物件，型別檢查）
    characters.ts, enemies.ts, skills.ts, items.ts, cards.ts
    regions/ch0.ts, ch1.ts ...   節點、地點、遭遇
    dialogue/ch0.ts, ch1.ts ...  對話腳本
  i18n/                   zh-TW（預設）、en（預留）
  audio/                  sfx.ts（合成器）、music.ts（程序音樂音序器）
tests/                    vitest
```

## 3. 核心原則
1. **邏輯與呈現分離**：`core/` 是純 TS 狀態機，場景只讀狀態、發出指令、播放動畫。戰鬥引擎回傳「事件列表」（`{type:'damage', target, amount, timing}`），場景依序播放 → 可無頭模擬、可測試。
2. **資料驅動**：內容全部在 `data/`，用 TS 型別約束（漏欄位直接編譯失敗）。
3. **對話腳本格式**（TS 陣列，非外部 DSL，省去解析器）：
```ts
export const ch1_inn: DialogueScript = {
  id: 'ch1.inn',
  nodes: {
    start: [
      { say: 'rourke', text: 'ch1.inn.rourke.01' },
      { choice: [
        { text: 'ch1.inn.c.play', next: 'play' },
        { text: 'ch1.inn.c.know', check: { codex: 'rourke_cheat' }, effects: [{ divergence: 3 }], next: 'expose' },
        { text: 'ch1.inn.c.cha', check: { stat: 'cha', dc: 5 }, next: 'persuade', fail: 'persuade_fail' },
      ]},
    ],
    play: [{ cardBattle: 'rourke_easy', win: 'won', lose: 'lost' }],
  },
};
```
4. **全域狀態** `GameState`：隊伍、背包、旗標 `Record<string, number|boolean|string>`、聲望、偏移值、筆記、羈絆、位置、遊玩時間。單一來源，變更時發事件。
5. **存檔**：
   - `localStorage`（PWA 與 Capacitor WebView 都可用），鍵 `jackygame.save.v1.slot{0..2}` + `autosave`。
   - 自動存檔時機：場景切換、戰鬥結束、對話結束、`visibilitychange → hidden`、`pagehide`。
   - JSON 包含 `version`，讀取時跑 migration。寫入前序列化測試（vitest 驗證 round-trip）。
   - 若 localStorage 不可用（隱私模式），退回記憶體並提示。
6. **i18n**：`t(key, params)`，所有顯示字串走 key；預設 zh-TW。
7. **輸入**：統一 `InputRouter` 判斷 tap / swipe / long-press（閾值：滑動 > 40px 且 < 300ms；長按 > 350ms），戰鬥時機判定用 `performance.now()` 與動畫時間軸比對，並做**輸入延遲校正**（設定頁可校準 ±ms）。

## 4. 效能預算（中階手機 60fps）
- Draw calls：戰鬥 < 60。程式生成材質在 Boot 時 `generateTexture` 一次，之後用 Image/Sprite（不要每幀重畫 Graphics）。
- 粒子：同時 < 300 顆；「低畫質」模式減半並關閉 postFX。
- 單一 JS bundle 目前 1.2MB（Phaser 本體）；可接受（離線預快取）。之後若需要可用 Phaser 自訂建置瘦身。
- 文字：大量動態文字用 `Text` 物件快取，避免每幀 `setText`。
- 視窗切到背景時 `game.loop.sleep()`、音訊 suspend。

## 5. 部署管線
| 工作流程 | 觸發 | 內容 |
|---|---|---|
| `ci.yml` | push / PR | typecheck + test + build |
| `deploy-pages.yml` | push main | build → upload-pages-artifact → deploy-pages |
| `android.yml` | push main | build → `cap sync android` → `gradlew assembleDebug` → 上傳到 prerelease `latest`（`--clobber`），並用 API 移動 `latest` tag |
- 所有工作流程 `paths-ignore: ['.loop/**','docs/**','**.md']`。
- iOS：`ios/` 專案已產生（Capacitor 8 + SPM）。Jacky 用 Mac：`npm ci && npm run build && npx cap sync ios && npx cap open ios`，用免費 Apple ID 簽署側載。

## 6. 測試策略
- `core/` 每個模組有單元測試。
- `core/sim/` 平衡模擬（戰鬥勝率、燼牌陣營勝率）在 vitest 跑，設門檻 assert。
- 每輪結束前：`npm run typecheck && npm test && npm run build`；有視覺變更就 `npm run screenshot` 看圖。
- 端對端煙霧測試（P1）：Playwright 開 `?debug` 自動點過序章，確認沒有 console error。

## 7. 除錯工具
- URL 參數：`?skipIntro`、`?scene=Battle&enc=ch1_wolf`（直接進場景）、`?debug`（顯示 FPS、狀態面板、時機判定窗口視覺化）。
