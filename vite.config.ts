/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const THEME = '#0b0f1e';

export default defineConfig({
  // Relative base so the same build works on GitHub Pages (sub-path) and inside Capacitor.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    // Phaser alone is ~1.2 MB minified; don't warn about it.
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Icons are already matched by workbox.globPatterns; avoid duplicate precache entries.
      includeManifestIcons: false,
      manifest: {
        name: '星燼回響 Echoes of Starfall',
        short_name: '星燼回響',
        description: '星燼回響 Echoes of Starfall — a mobile RPG',
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
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2,json,mp3,ogg,wav}'],
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
