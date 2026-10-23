# 進度紀錄（新的在最上面）

## 2026-10-23 22:19–23:xx（台北）第 1 輪 — 階段 0 啟動
**做了什麼**
- 建立 repo 結構與交接文件（PLAN / NEXT / PROGRESS / DECISIONS / FOR_JACKY）。
- 技術骨架：TypeScript + Vite 8 + Phaser 3.90，720×1280 直式；程式生成的標題場景《星燼回響》（夜空漸層、星點、旋轉星印、發光標題、餘燼粒子、山稜剪影、點擊閃光/震動/音效）；i18n（zh-TW/en）；WebAudio SFX 合成器；mulberry32 RNG。
- PWA：vite-plugin-pwa（離線預快取）、manifest、自產圖示（SVG → PNG）。
- Capacitor 8：`android/`、`ios/`（SPM）專案，鎖直式。
- GitHub Actions：CI、Pages 部署、Android APK → Releases `latest`。
- 設計文件初稿 01–06（市場調查、世界觀與故事、核心玩法、內容規劃、美術音效、技術架構）。

**驗證**
- 本機 `npm run typecheck`、`npm test`（9 tests）、`npm run build` 全過；Playwright 截圖確認標題畫面正常（見下）。
- GitHub Actions：CI ✅、Android APK ✅（第 2 次，修掉 setup-android 後）、Pages ❌（Pages 未啟用 → FOR_JACKY）。

**問題**
- android-actions/setup-android@v3 在 runner 上失敗 → 改用預裝 SDK。
- Pages 需要業主手動啟用。
