# 線上版 API 的映像（V6，D-305）。build context＝repo 根目錄：
#   docker build -f server/Dockerfile -t ghcr.io/twjackysu/jackygame-api .
# 只放打包好的 dist-server（伺服器程式＋相依，一個檔案），不含遊戲畫面、不含原始碼與秘密；連線字串等設定一律用環境變數。
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts --no-audit --no-fund
COPY src ./src
COPY server ./server
RUN npm run build:server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/dist-server ./
USER node
EXPOSE 8080
CMD ["node", "main.js"]
