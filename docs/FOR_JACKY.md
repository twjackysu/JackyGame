# 給 Jacky：只有你能處理的事

> 開發迴圈遇到「只有業主能做」的事會記在這裡。處理完請把該項打勾或刪除。

## 待處理

### 1. 啟用 GitHub Pages（PWA 網址需要）— 2026-10-23
- 現況：`deploy-pages.yml` 建置成功，但 `actions/configure-pages` 回報 `Create Pages site failed. Resource not accessible by integration`（工作流程的 token 沒有權限幫 repo 開啟 Pages）。
- 請到 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
- 之後到 Actions → 「Deploy to GitHub Pages」→ **Run workflow** 重跑一次（或等下一次 push 自動部署）。
- 網址：https://twjackysu.github.io/JackyGame/
- 在你啟用之前，Android APK（Releases 的 `latest`）照常產出，不受影響。

### 2. iOS 建置（回國後，需 Mac + Xcode）
- 見 README「iOS 安裝」。專案在 `ios/`（Capacitor 8，使用 Swift Package Manager，不需要 CocoaPods）。

## 已完成
（無）
