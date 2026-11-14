// 營火旁那排捷徑（行囊・強化／行商）的截圖（第 203 輪）。先 `npx vite --port 5173`。
// 用法：node scripts/shot-camp.mjs sword|bow|staff [地圖] [tag]   環境變數 W=390、H=844、OUT=screenshots、LOWFX=1、HOT=1（裝成「有更好的裝備 ▲」）、OFF=1（舊的亮色長方形；要在場景建立前設，所以走網址以外的開關：見下）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT || 'screenshots';
mkdirSync(OUT, { recursive: true });
const [weapon = 'sword', stage = 'mistwood', tag = 'sv'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) }, deviceScaleFactor: 2 });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([w, low, lv]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', w);
  localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1');
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: lv, bossKills: 1 }));
  if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
}, [weapon, !!process.env.LOWFX, +(process.env.LEVEL || 14)]);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate(([stage, off]) => { __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }); }, [stage, !!process.env.INTRO_OFF]);
await pg.waitForTimeout(3500);
await pg.evaluate(() => {
  window.sc = () => __game.scene.getScene('RtBattle');
  const sn = sc();
  sn.commands = () => [];
  window.T = 100000; const t0 = Date.now(); window.off = 0; Date.now = () => t0 + off;
  window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
  __game.loop.sleep();
});
await pg.evaluate((n) => ff(n), +(process.env.WARM || 150));
if (process.env.HOT) await pg.evaluate(() => { const sn = sc(); sn.updateFireBtn = () => {}; sn.fireBtn.setText('行囊・強化 ▲'); sn.placeFireBtns(); ff(2); });
await pg.screenshot({ path: `${OUT}/${tag}.png` });
console.log(await pg.evaluate(() => JSON.stringify([sc().fireBtn.visible, sc().fireBtn.getBounds(), sc().shopBtn.getBounds()])));
await b.close();
