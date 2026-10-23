# 星燼回響 Echoes of Starfall

> 前世是冷門手遊的全成就玩家，轉生成開場就被騎士團遠征隊丟在遺跡裡的「掌燈人」——只有他知道，這個被當成提燈雜役的職業是全遊戲最強的隱藏職業。

原創冒險 RPG，手機單機（iOS / Android / PWA），**完全離線**、直式單手操作。

🚧 **開發中**（2026-10-23 開工，11/05 成果發表）。進度見 [`docs/PROGRESS.md`](docs/PROGRESS.md)，計畫見 [`docs/PLAN.md`](docs/PLAN.md)。

## 目前可以玩到（2026-10-24）
- 標題 →「新的旅程」：序章對話（屬性檢定、攻略筆記選項、星形骰）→ 教學戰（燈印 + 共鳴）→ 第 1 章節點地圖 → 各地點劇情、戰鬥、燼牌對局、雜貨店 → 狼王 Boss → 章節結算。自動存檔，「繼續旅程」可接續。
- 「戰鬥演示」：森林 ×2 → 野豬 → 霧角狼王連戰；「燼牌演示」：直接開一局燼牌。

## 賣點（設計目標）
- **簡單但吃技巧的戰鬥**：回合制 + 時機輸入（點擊格擋、滑動閃避、長按引路之光），完美判定有打擊停頓、慢動作與光爆。
- **「廢職業」的隱藏玩法**：在敵人身上佈下燈印，一口氣共鳴引爆。
- **攻略知識 = 遊戲機制**：用前世記憶直接通過檢定，但會讓世界偏離劇本，情報逐漸失準。
- **同伴羈絆**：4 位同伴各有個人劇情與羈絆事件（全年齡）。
- **燼牌**：三夜制的酒館卡牌小遊戲，可收集、組牌。
- **選擇與後果**：屬性檢定、聲望、延遲回收的選擇、多結局。

## 怎麼玩
- **PWA（任何手機瀏覽器）**：https://twjackysu.github.io/JackyGame/ （需先在 repo 啟用 Pages）
  - iOS Safari：分享 → 加入主畫面；Android Chrome：選單 → 安裝應用程式。之後可離線遊玩。
- **Android APK**：[Releases → latest](https://github.com/twjackysu/JackyGame/releases/tag/latest) 下載 `jackygame-debug.apk`，允許「安裝未知來源應用程式」後安裝。
- **iOS（原生，需 Mac）**：
  1. 安裝 Xcode、Node 22+。
  2. `npm ci && npm run build && npx cap sync ios && npx cap open ios`
  3. Xcode → Signing & Capabilities → Team 選你的（免費）Apple ID，Bundle ID 若衝突就改一個。
  4. 接上 iPhone，按 ▶︎ 執行。iPhone 上到「設定 → 一般 → VPN 與裝置管理」信任開發者。免費帳號簽署 7 天有效。

## 開發
```bash
npm ci            # 需 Node 22.12+
npm run dev       # 開發伺服器
npm test          # vitest
npm run build     # typecheck + 產出 dist/
npm run screenshot  # Playwright 截圖（需先 build）
```
技術：TypeScript、Vite、Phaser 3、vite-plugin-pwa、Capacitor 8。美術與音效全部程式生成。

## 文件
- 設計：[`docs/design/`](docs/design/)
- 決策：[`docs/DECISIONS.md`](docs/DECISIONS.md)

## 授權
GPL-3.0，見 [LICENSE](LICENSE)。
