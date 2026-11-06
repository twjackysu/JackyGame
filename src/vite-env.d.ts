/// <reference types="vite/client" />

/** Injected by vite.config.ts `define` from package.json. */
declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: number;

interface ImportMetaEnv {
  /** 線上版伺服器根網址（npm run build:online，D-306）；空＝離線版（遊戲裡的本機伺服器） */
  readonly VITE_SERVER_URL?: string;
  /** 'dev'：沒有登入 token 時自動給 dev:<亂數>（只對 AUTH_MODE=dev 的伺服器有效） */
  readonly VITE_AUTH_MODE?: string;
}
