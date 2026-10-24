# 給 Jacky：只有你能處理的事

> 開發迴圈遇到「只有業主能做」的事會記在這裡。處理完請把該項打勾或刪除。

## 待處理

### ★ 即時戰鬥試玩（第 12 輪，10/24 23:10）
- 網址（Pages 部署完成後）：https://twjackysu.github.io/JackyGame/?debug&scene=RtBattle&stage=forest_entry
  - 換關卡：`stage=` 改成 `wolf_den`（狼群巢穴）、`forest_deep`（森林深處：遠程毒刺）、`elite_pack`（精英狼群）、`wolf_king`（霧角狼王）。加 `&bot=expert` 可以看 Bot 自己打。
  - 操作：左下搖桿走位（放開就自動追擊＋普攻）、右下「重斬／旋風斬／衝鋒／格擋反擊」＋「閃避」；點敵人鎖定。桌機：WASD、1–4、空白鍵。
  - **注意**：`?debug` 會蓋掉同一瀏覽器的本機存檔設定；只是試玩入口，主線還是舊戰鬥。
  - **第 13 輪更新（10/25 00:30）**：右上 ☰ 選單可以暫停、重來、換關卡、看 Bot 示範（手機不用改網址）；鏡頭放大並跟著主角、角色改用 Q 版立繪、預告改成「由內往外填滿，填滿就命中」、加了刀光、命中停頓與結束畫面。戰鬥規則與數值沒改，6 個問題照舊。
- 想請你回答（回在 Issue 或直接改 NEXT 最上面）：①移動與普攻手感（太慢／太快？）②預告時間夠不夠反應？紅色扇形、黃框（可格擋）看得懂嗎？③格擋反擊窗口（現在 12 ticks＝0.4 秒）太嚴／太鬆？④狼王約 80 秒，長度可以嗎？⑤畫面先用圓形代表角色，要不要先接 Q 版圖？⑥下一步要先做「森林地圖整合」（design/20 §B8 P2）還是先把這個戰鬥手感調到滿意？


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

