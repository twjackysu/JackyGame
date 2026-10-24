# 給 Jacky：只有你能處理的事

> 開發迴圈遇到「只有業主能做」的事會記在這裡。處理完請把該項打勾或刪除。

## 待處理

### 0. 回國後產圖：照 `docs/ART_REQUESTS.md`
- 開發迴圈需要的美術都排在那份清單（有 GPT／Gemini 分工、額度上限、完整 prompt 與檔名）。請本機 Agent 照「給產圖 Agent 的流程」產圖、放進 `art-inbox/` 並 push，匯入會自動完成。

### 1. iOS 建置（回國後，需 Mac + Xcode）
- 見 README「iOS 安裝」。專案在 `ios/`（Capacitor 8，使用 Swift Package Manager，不需要 CocoaPods）。

### 2. 正式上架前（非必要）
- 遊戲名《星燼回響 Echoes of Starfall》只做了網路搜尋，未查商標。若要上架商店請先確認。
- Android 目前是 debug 簽章 APK；上架需要你自己的 release keystore（不能放進 repo）。

## 已完成
- ~~角色立繪~~：10/24 收到 6 張（連恩、伊歐、瑟琳、莉歐拉、洛克、瓦爾德蘭）已換進遊戲；其餘配角用程式繪製的動漫風立繪。想再加（例如緹雅、葛文、伯恩）照 `docs/ART_PROMPTS.md` 上傳到 `art-inbox/` 即可，檔名用 `npc_tia.png`、`npc_gwen.png`、`npc_bern.png`。
- ~~啟用 GitHub Pages~~：2026-10-24 起「Deploy to GitHub Pages」已成功（PWA：https://twjackysu.github.io/JackyGame/ ）。謝謝！

