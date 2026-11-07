# 線上版部署到 Azure（草稿，第 145 輪）

> 對象：Jacky。照順序做，大約 30～60 分鐘。開發迴圈**不會**幫你建任何雲端資源；部署工作流程只能手動觸發。
> 設計：`docs/design/25-azure-backend.md`（後端）、`26-security.md`（資安）；決策 D-278／279／305。

## 會建哪些東西、為什麼不收費（25 §4.3）
| 資源 | 設定 | 為什麼不收費 |
|---|---|---|
| Container Apps 環境 `jackygame-env` | Consumption、不送日誌 | 環境本身不收費；沒有 Log Analytics |
| Container App `jackygame-api` | 0.25 vCPU／0.5 GiB、**0～1 個副本** | 沒人玩縮到 0；有人玩時在每月免費額度內 |
| 預算 `jackygame-budget` | 每月 1 美元，50%／100% 寄信 | 一有花費就知道 |
| 映像 | `ghcr.io/twjackysu/jackygame-api`（公開） | GitHub 公開套件免費（不用 ACR） |
| 資料庫 | **共用 JackyAIStudio 既有的 Azure SQL**，只用 `game` schema | 不多開一台 |
| 登入 | Entra External ID | 免費額度內 |

**不建**：ACR、Redis、Log Analytics、資料庫、即時對戰（WebSocket，`deployRealtime=false`）。

## 步驟
1. **資源群組**：`az group create -n jackygame-rg -l japaneast`（區域自己選，離台灣近的）。
2. **Entra External ID**：建一個外部租用戶（或用既有的）→ 註冊一個「API」應用程式，記下：
   - issuer：`https://<租用戶>.ciamlogin.com/<租用戶 id>/v2.0`
   - audience：API 應用程式的「應用程式 (用戶端) 識別碼」
   - JWKS：`https://<租用戶>.ciamlogin.com/<租用戶 id>/discovery/v2.0/keys`
3. **參數檔**：複製 `infra/main.parameters.example.json` 成 `infra/main.parameters.json`（已列在 .gitignore，**不會進 git**：裡面有連線字串），填好連線字串、JWT 三項、信箱。連線字串建議用 `Authentication=Active Directory Managed Identity`（不放密碼）。
4. **先建一次 Container App**（映像還沒有時，可以先用 `-p image=mcr.microsoft.com/k8se/quickstart:latest` 讓它建得起來）：
   ```
   az deployment group create -g jackygame-rg -f infra/main.bicep -p @infra/main.parameters.json
   ```
   輸出的 `apiPrincipalId` 是 API 的受控識別。
5. **資料庫權限**（用有權限的帳號連 JackyAIStudio 的資料庫，在 SSMS 或 Azure Portal 查詢編輯器）：
   ```sql
   CREATE USER [jackygame-api] FROM EXTERNAL PROVIDER;
   GRANT CREATE TABLE TO [jackygame-api];
   GRANT ALTER, SELECT, INSERT, UPDATE, DELETE, REFERENCES ON SCHEMA::game TO [jackygame-api];
   ```
   只給 `game` schema，碰不到 `dbo`。遷移（啟動時跑）只建遊戲自己的表（Account、Character、Item…），**不會碰** `game` 裡你那 8 張舊原型表。
6. **GitHub 部署權限**（聯合認證，不用存密碼）：在 Entra 建一個應用程式，加「同盟認證」給 `repo:twjackysu/JackyGame:ref:refs/heads/main`，在資源群組給它「參與者」角色。然後在 GitHub repo → Settings → Secrets 加：`AZURE_CLIENT_ID`、`AZURE_TENANT_ID`、`AZURE_SUBSCRIPTION_ID`、`AZURE_RESOURCE_GROUP`。
7. **部署**：GitHub → Actions → 「Deploy server」→ Run workflow。它會 build 映像、推到 ghcr.io、更新 Container App。第一次推完到 GitHub → Packages 把 `jackygame-api` 設成 Public。
8. **確認**：`curl https://<apiUrl>/health` 回 `{"ok":true}`（縮到 0 時第一次要等幾秒）。

## 本機先試
```
npm run server:dev                       # 記憶體資料庫、AUTH_MODE=dev
npm run build:server && cd dist-server && AUTH_MODE=dev node main.js
```
連 LocalDB：設 `GAME_DB_CONNECTION_STRING`（見 `server/.env.example`），並 `npm install msnodesqlv8`（Windows）。

## 線上版客戶端（第 146 輪，D-306）
- 建置：`VITE_SERVER_URL=https://<apiUrl> npm run build:online` → `dist-online/`（不打包本機伺服器，CI 用 `scripts/check-online-bundle.mjs` 檢查）。沒設就用 `.env.online` 的 `http://localhost:8080`（連本機 `npm run server:dev`）。
- 登入（第 148 輪，D-317）：Entra External ID 授權碼＋PKCE（`src/client/oidcLogin.ts`，不加套件）。Jacky 要做的：
  1. 建 Entra External ID 租戶 → App registrations → 新增「單頁應用程式（SPA）」平台，重新導向 URI 填 `https://twjackysu.github.io/JackyGame/online/`（本機試加 `http://localhost:4174/`）。
  2. 建置變數：`VITE_ENTRA_AUTHORITY`＝`https://<租戶>.ciamlogin.com/<租戶>.onmicrosoft.com`、`VITE_ENTRA_CLIENT_ID`＝應用程式（用戶端）識別碼（GitHub Actions 的 Variables 也加這兩個，deploy-pages 的線上版建置會帶）。
  3. API 環境變數：`AUTH_MODE=jwt`、`JWT_ISSUER`＝`https://<租戶 id>.ciamlogin.com/<租戶 id>/v2.0`、`JWT_AUDIENCE`＝同一個 client id（我們送的是 id_token）、`JWT_JWKS_URL`＝`https://<租戶>.ciamlogin.com/<租戶 id>/discovery/v2.0/keys`。
  沒設 Entra 變數：不轉登入頁（跟以前一樣）。`VITE_AUTH_MODE=dev` 只給本機：自動產生 `dev:<亂數>`，只對 `AUTH_MODE=dev` 的伺服器有效。
- **CORS**：API 的 `CORS_ORIGINS` 要列出客戶端網址（例如 `https://twjackysu.github.io`），不然瀏覽器會擋。
- **放上 GitHub Pages（第 148 輪）**：API 部署好之後，到 GitHub repo → Settings → Secrets and variables → Actions → **Variables** 新增 `ONLINE_API_URL`＝API 網址（例如 `https://jackygame-api.<region>.azurecontainerapps.io`），下一次推 main（或手動跑 Deploy to GitHub Pages）就會把線上版放在 `https://twjackysu.github.io/JackyGame/online/`。沒設這個變數就跟以前一樣只有離線版。記得 API 的 `CORS_ORIGINS` 加 `https://twjackysu.github.io`。
- 線上版現在能用的：競技場天梯（含看重播）、角色列表、拍賣所／交易、**PvE 掉落、經驗、懸賞、寶箱、相遇獎勵都由伺服器給**；HUD／行囊／行商面板的金幣與等級讀伺服器的角色。
- 防作弊（26-security）：打怪有速度上限（跨場）、同一個重生點／Boss／暴動／隱藏精英的數量上限（照地圖的重生規則算）、Boss 出去再進來也要等重生時間、夜光寶箱 5 分鐘補滿；被拒絕的申請寫進 `game.AuditLog`（`action` 開頭是 `rejected:`），可以用 SQL 查可疑帳號。
- 請求大小：HTTP 層最多 1 MB（只有 `pvp.finish` 帶整場指令紀錄會用到），其他方法超過 16 KB 直接拒絕。
- 本機整套試：
  ```
  npm run build:server && (cd dist-server && AUTH_MODE=dev CORS_ORIGINS=http://localhost:4174 node main.js) &
  npm run build:online && npx vite preview --outDir dist-online --port 4174
  ```

## 還沒做（之後的輪次）
- token 過期（約 1 小時）會在下次開遊戲時重新登入；還沒做 refresh token 與遊戲中途過期的提示。舊 key 完全退場。
