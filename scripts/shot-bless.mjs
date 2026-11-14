// 拍祝福三選一面板（第 205 輪）：直接指定檯面上的三張與身上已有的祝福，不用等 Bot 打。先 `npx vite --port 5173`。
// 用法：OFFER=storm_caller,crit_bloom,frost_touch TAKEN=shadow_step,quick_hands DARK=1 node scripts/shot-bless.mjs [武器] [地圖] 輸出.png [W H]
// 環境變數 DSF=2、LOWFX=1、LEVEL=6、WAIT=0.9（面板開了之後等幾秒再拍）、CLICK=1（點第幾張，拍點下去那一瞬間）、LIST=1（改拍「身上的祝福」清單）、PAIR='要先在頁面裡跑的程式'
import { chromium } from 'playwright';
const [weapon = 'sword', stage = 'mistwood', out = 'screenshots/bless.png', W = '390', H = '844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DSF || 2) });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([w, low, lv]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', w);
  localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1'); localStorage.setItem('jg_tip_bless', '1');
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: lv, bossKills: 1 }));
  if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
}, [weapon, !!process.env.LOWFX, +(process.env.LEVEL || 6)]);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate((stage) => __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }), stage);
await pg.waitForTimeout(3500);
const r = await pg.evaluate(([offer, taken, dark, wait, pair, click, list]) => {
  window.sc = () => __game.scene.getScene('RtBattle');
  window.T = 100000; const t0 = Date.now(); window.off = 0; Date.now = () => t0 + off;
  window.ff = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
  __game.loop.sleep();
  ff(2);
  if (pair) (0, eval)(pair);
  const s = sc().s;
  s.bless.taken = taken; s.bless.dark = dark;
  sc().menu?.destroy(); sc().menu = null;
  if (list) sc().openBlessList(); else sc().openBless(offer);
  ff(wait);
  if (click >= 0) { const bgs = []; const walk = (l) => { for (const o of l) { if (o.list) walk(o.list); if (o.type === 'Rectangle' && o.width === 640 && o.listenerCount('pointerdown')) bgs.push(o); } }; walk(sc().blessRoot.list); bgs[click].emit('pointerdown', {}, 0, 0, { stopPropagation() {} }); ff(0.12); }
  return { open: !!sc().blessRoot || !!sc().menu, taken: s.bless.taken };
}, [(process.env.OFFER || 'executioner,storm_caller,guard_pulse').split(','), (process.env.TAKEN || '').split(',').filter(Boolean), !!process.env.DARK, +(process.env.WAIT || 0.9), process.env.PAIR || '', +(process.env.CLICK ?? -1), !!process.env.LIST]);
console.log(JSON.stringify(r));
await pg.screenshot({ path: out });
await b.close();
