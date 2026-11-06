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

## 還沒做（之後的輪次）
- 線上版客戶端 `npm run build:online`（畫面改連 API、不打包本機伺服器）與登入畫面。在那之前部署上去的 API 只能用工具呼叫。
