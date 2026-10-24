#!/usr/bin/env node
// 成果發表截圖：node scripts/promo.mjs [baseUrl] [outDir] [only]
// 每張圖開一個新頁面，等場景就緒後直接呼叫場景方法擺好畫面，再於多個時間點截圖（檔名 -a/-b/-c），
// 人工挑最好的一張壓縮進 docs/screenshots/。headless 約 1fps，所以等待都很長。
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4180/';
const out = process.argv[3] ?? 'screenshots/promo';
const only = process.argv[4];
mkdirSync(out, { recursive: true });

const getScene = (k) => `window.__game.scene.getScene('${k}')`;
const SHOTS = [
  { name: 'title', url: '?debug&skipIntro', ready: `${getScene('Title')}?.sys.isActive()`, settle: 25000, at: [0, 8000] },
  {
    name: 'map', url: '?debug&chapter=3&scene=Map', ready: `${getScene('Map')}?.sys.isActive()`, settle: 20000, at: [0],
  },
  {
    name: 'bonds', url: '?debug&chapter=5&scene=Map', ready: `${getScene('Map')}?.sys.isActive()`, settle: 18000,
    act: `(() => { const s = ${getScene('Map')}; const h = s.children.list.find((o) => o.text === '♥'); h?.emit('pointerdown'); })()`,
    at: [10000, 20000],
  },
  {
    name: 'timing', url: '?debug&scene=Battle&enc=boss_wolfking&party=lian,rourke,io&lv=6',
    ready: `${getScene('Battle')}?.mode === 'command'`, settle: 2000,
    act: `(() => { const s = ${getScene('Battle')}; const e = s.enemies[0]; s.setLamps(0, 3); void s.runTiming(e.x, e.y - 40); })()`,
    at: [150, 500, 900],
  },
  {
    name: 'resonance', url: '?debug&scene=Battle&enc=forest_b&party=lian,serin,liora&lv=10',
    ready: `${getScene('Battle')}?.mode === 'command'`, settle: 2000,
    act: `(() => { const s = ${getScene('Battle')}; s.enemies.forEach((_, i) => s.setLamps(i, 3)); void s.playOne({ type: 'resonance', totalLamps: 6, perTarget: s.enemies.map((_, i) => ({ target: i, lamps: 3, amount: 120 })) }); })()`,
    at: [3000, 6000, 9000, 12000, 15000],
  },
  {
    name: 'starstage', url: '?debug&scene=Battle&enc=boss_valderan&party=lian,serin,io&lv=15',
    ready: `${getScene('Battle')}?.mode === 'command'`, settle: 2000,
    act: `(() => { const s = ${getScene('Battle')}; s.starStage(); s.setDoomMark?.(1, 2); s.setLamps(0, 4); })()`,
    at: [8000, 16000],
  },
  {
    name: 'finale', url: '?debug&scene=Battle&enc=boss_starfall_2&party=serin,lian,io&lv=17',
    ready: `${getScene('Battle')}?.mode === 'command'`, settle: 2000,
    act: `(() => { const s = ${getScene('Battle')}; const i = s.enemies.length - 1; void s.playOne({ type: 'finale', enemy: i, lamps: 10 }); })()`,
    at: [4000, 7000, 10000, 13000, 16000, 20000],
  },
  {
    name: 'cards', url: '?debug&scene=Cards&match=tourney_dealer', ready: `${getScene('Cards')}?.sys.isActive()`, settle: 20000, at: [0, 6000],
  },
  {
    name: 'dialogue', url: '?debug&scene=Dialogue&script=ch3&node=academy', ready: `${getScene('Dialogue')}?.sys.isActive()`, settle: 20000, at: [0, 10000],
  },
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const shot of SHOTS) {
  if (only && !only.split(',').includes(shot.name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${shot.name}] pageerror ${e.message}`));
  try {
    await page.goto(base + shot.url, { waitUntil: 'load' });
    await page.waitForFunction(`(() => { try { return !!(${shot.ready}); } catch { return false; } })()`, null, { timeout: 120000, polling: 500 });
    await page.waitForTimeout(shot.settle);
    if (shot.act) await page.evaluate(shot.act);
    let t = 0;
    for (const [k, at] of shot.at.entries()) {
      await page.waitForTimeout(at - t);
      t = at;
      const p = `${out}/${shot.name}-${'abcdefg'[k]}.png`;
      await page.screenshot({ path: p });
      console.log('saved', p);
    }
  } catch (e) {
    console.log(`[${shot.name}] FAILED ${e.message}`);
  }
  await ctx.close();
}
await browser.close();
