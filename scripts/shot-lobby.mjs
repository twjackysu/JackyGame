// 競技場大廳的截圖（第 203 輪）。先 `npx vite --port 5173`。用法：node scripts/shot-lobby.mjs <輸出.png> [W H]
import { chromium } from 'playwright';
const [out = 'screenshots/lobby.png', W = '390', H = '844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2 });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', 'staff'); localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: 14, bossKills: 1 })); });
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.waitForTimeout(1500);
await pg.evaluate(() => __game.scene.getScene('Title').scene.start('Pvp'));
await pg.waitForTimeout(2500);
await pg.screenshot({ path: out });
await b.close();
