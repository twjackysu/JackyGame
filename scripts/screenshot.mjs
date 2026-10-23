#!/usr/bin/env node
// Take a mobile-viewport screenshot of a running dev/preview server.
// Usage: node scripts/screenshot.mjs [url] [out.png] [waitMs]
// Uses a preinstalled Chromium if CHROMIUM_PATH is set (or found under
// PLAYWRIGHT_BROWSERS_PATH); never downloads browsers itself.
import { existsSync, readdirSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/?skipIntro';
const out = process.argv[3] ?? 'screenshots/title.png';
const waitMs = Number(process.argv[4] ?? 3000);
mkdirSync(path.dirname(out), { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !existsSync(base)) return undefined;
  for (const dir of readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = path.join(base, dir, sub);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
});
const page = await context.newPage();
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`);
  else console.log(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(waitMs);
const renderer = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c ? `${c.width}x${c.height}` : 'no canvas';
});
await page.screenshot({ path: out });
console.log(`canvas: ${renderer}`);
console.log(`saved ${out}`);
if (problems.length) console.log(problems.join('\n'));
await browser.close();
// SMOKE_STRICT=1：有 pageerror 或 console.error 就失敗（CI 煙霧測試用）
const fatal = problems.filter((p) => p.startsWith('[pageerror]') || p.startsWith('[error]'));
if (process.env.SMOKE_STRICT === '1' && (fatal.length || renderer === 'no canvas')) {
  console.error(`SMOKE FAILED: ${fatal.length} error(s), canvas=${renderer}`);
  process.exit(1);
}
