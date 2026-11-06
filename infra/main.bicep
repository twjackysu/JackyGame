// 線上版 API 的 Azure 資源（V6，D-305，25 §4.3 零額外費用原則）。
// 部署：az deployment group create -g <資源群組> -f infra/main.bicep -p @infra/main.parameters.json（步驟見 docs/DEPLOY_AZURE.md）
// 只建：Container Apps 環境（Consumption、不送日誌）＋一個 Container App（縮到 0、最多 1 個副本）＋每月 1 美元預算告警。
// 不建：ACR（映像放 ghcr.io）、Redis、Log Analytics、資料庫（共用 JackyAIStudio 既有的 Azure SQL，只用連線字串）。
targetScope = 'resourceGroup'

@description('區域')
param location string = resourceGroup().location

@description('名稱前綴')
param name string = 'jackygame'

@description('映像（ghcr.io 公開映像，免費）')
param image string = 'ghcr.io/twjackysu/jackygame-api:latest'

@secure()
@description('GAME_DB_CONNECTION_STRING（ADO.NET 格式）；建議用 Authentication=Active Directory Managed Identity，就不用密碼')
param gameDbConnectionString string

@description('資料表放哪個 schema（固定 game；絕不放 dbo）')
param gameDbSchema string = 'game'

@description('Entra External ID：JWT 的 issuer、audience、JWKS 網址')
param jwtIssuer string
param jwtAudience string
param jwtJwksUrl string

@description('允許的網頁來源（逗號分隔），例如 GitHub Pages')
param corsOrigins string = 'https://twjackysu.github.io'

@description('預算告警寄給誰')
param budgetEmail string

@description('預算開始月份（每月 1 號，例如 2026-11-01）')
param budgetStart string

@description('即時 PvP（WebSocket）預設不部署：長連線會讓副本無法縮到 0（25 §4.4）')
param deployRealtime bool = false

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-env'
  location: location
  properties: {
    // 不設 appLogsConfiguration＝不送日誌到 Log Analytics（超過免費量要錢）；要查問題時用 az containerapp logs show 看即時輸出
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${name}-api'
  location: location
  identity: {
    // 用受控識別連 Azure SQL（連線字串不放密碼）；Jacky 要在資料庫裡把這個識別加成只對 game schema 有權限的使用者
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: env.id
    workloadProfileName: 'Consumption'
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'http'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'game-db'
          value: gameDbConnectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: image
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'GAME_DB_CONNECTION_STRING', secretRef: 'game-db' }
            { name: 'GAME_DB_SCHEMA', value: gameDbSchema }
            { name: 'AUTH_MODE', value: 'jwt' }
            { name: 'JWT_ISSUER', value: jwtIssuer }
            { name: 'JWT_AUDIENCE', value: jwtAudience }
            { name: 'JWT_JWKS_URL', value: jwtJwksUrl }
            { name: 'CORS_ORIGINS', value: corsOrigins }
            { name: 'PORT', value: '8080' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        // 沒人玩就縮到 0（不收運算費）；最多 1 個副本封頂
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// 每月 1 美元：一有花費就寄信（50%、100%）
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: '${name}-budget'
  properties: {
    category: 'Cost'
    amount: 1
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: budgetStart
    }
    notifications: {
      half: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 50
        contactEmails: [budgetEmail]
      }
      full: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        contactEmails: [budgetEmail]
      }
    }
  }
}

output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output apiPrincipalId string = api.identity.principalId
output realtimeDeployed bool = deployRealtime
