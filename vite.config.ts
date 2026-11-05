/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const THEME = '#0b0f1e';

// D-270：每次 build 的身分（同一個 commit 在 Pages 和 APK 會一樣），寫進程式和 dist/version.json。
function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}
const BUILD_ID = (process.env.GITHUB_SHA ?? git('rev-parse HEAD')).slice(0, 7) || 'dev';
const BUILD_TIME = Number(git('log -1 --format=%ct')) * 1000 || Date.now();
const BUILD_INFO = { version: pkg.version, build: BUILD_ID, time: BUILD_TIME };

export default defineConfig({
  // Relative base so the same build works on GitHub Pages (sub-path) and inside Capacitor.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  build: {
    target: 'es2022',
    // Phaser alone is ~1.2 MB minified; don't warn about it.
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    {
      name: 'version-json',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(BUILD_INFO) });
      },
    },
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      // Registered by src/swUpdate.ts so every launch also checks for a new deploy (D-267).
      injectRegister: false,
      // Icons are already matched by workbox.globPatterns; avoid duplicate precache entries.
      includeManifestIcons: false,
      manifest: {
        name: '命運之境：轉生後的異世界冒險',
        short_name: '命運之境',
        description: '命運之境：轉生後的異世界冒險 Realm of Fate — a mobile RPG',
        lang: 'zh-TW',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'portrait',
        theme_color: THEME,
        background_color: THEME,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp,svg,webmanifest,woff2,json,mp3,ogg,wav}'],
        // 版本檔每次都要從網路拿（D-270）
        globIgnores: ['**/version.json'],
        // Phaser bundle exceeds the 2 MiB default.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
