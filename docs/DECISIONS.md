# 決策紀錄

> 格式：編號、日期（台北）、決策、理由、替代方案。新的放最上面。

## D-008 2026-10-23 Android CI 不使用 android-actions/setup-android
- 該 action 在 ubuntu-latest 上 `sdkmanager` 失敗（Failed to find package 'tools'）。runner 已預裝 Android SDK，直接用 `ANDROID_HOME` 即可，第一次就成功產出 APK。

## D-007 2026-10-23 `latest` 發佈 tag 用 GitHub API 移動
- `gh release edit --target` 不會移動已存在的 tag；改用 `gh api PATCH git/refs/tags/latest force=true`。只動這個 tag，不對分支 force push。

## D-006 2026-10-23 Capacitor 8（而非 7）
- 最新穩定版，支援 Node 22，iOS 預設使用 SPM，Linux 上也能 `cap add ios`，不需 CocoaPods。

## D-005 2026-10-23 TypeScript 5.9.3（不用 7.x）
- 7.x 是新的原生編譯器，生態相容性風險高，這個專案不需要。

## D-004 2026-10-23 遊戲名稱暫定《星燼回響 Echoes of Starfall》
- 原創名稱，世界觀圍繞「墜星留下的星燼」。可在階段 2 前更換。

## D-003 2026-10-23 直式（Portrait）720×1280
- 單手操作、短時段遊玩、對話與卡牌 UI 天生適合直式；手機 RPG 主流慣例。戰鬥做成上敵下我的直式構圖。
- 替代：橫式（戰鬥演出空間較大，但單手不便、對話框佔比高）。

## D-002 2026-10-23 探索採「節點地圖 + 地點熱點」而非自由移動地圖
- 9 天開發期 + 程式美術，自由移動的大地圖（碰撞、tilemap、尋路、美術量）成本過高；節點式在手機上也更好操作，能把資源投入戰鬥演出與劇情。

## D-001 2026-10-23 戰鬥採「回合制 + 時機輸入（點/滑/長按）」
- 符合「簡單但吃技巧」：回合制易懂、時機輸入給高手空間；三種輸入都適合觸控。設定提供「自動時機」照顧輕度玩家。
- 替代：即時 ARPG（觸控虛擬搖桿體驗差、AI 與平衡成本高）、純回合制（缺技巧感）。
