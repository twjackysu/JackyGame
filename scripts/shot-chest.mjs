// 開隱藏寶箱那一刻的整頁截圖（第 206 輪）：主角直直走向最近、還沒開的寶箱，開到之後每隔幾幀截一張。先 `npx vite --port 5173`。
// 用法：node scripts/shot-chest.mjs sword|bow|staff [地圖] [tag]   環境變數 W=390、H=844、LEVEL=14、AT=20,50,90（開箱後第幾幀各截一張）、OUT=screenshots、OFF=1（舊的置中大字）、CLOSED=1（先在旁邊拍一張蓋著的箱子 `-closed`）、LOWFX=1、NTH=0（第幾近的寶箱）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT || 'screenshots';
mkdirSync(OUT, { recursive: true });
const [weapon = 'sword', stage = 'starfall', tag = 'chest'] = process.argv.slice(2);
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
await pg.evaluate(([stage]) => { __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }); }, [stage]);
await pg.waitForTimeout(3500);
const ok = await pg.evaluate(async ([stage, off, nth]) => {
  const { STAGES } = await import('/src/core/battle/rt/data.ts');
  window.sc = () => __game.scene.getScene('RtBattle');
  const sn = sc();
  if (off) sn.chestPop = false;
  const u0 = sn.s.units[0];
  const list = (STAGES[stage]?.chests ?? []).filter((c) => !c.nightOnly).sort((a, b) => Math.hypot(a.x - u0.x, a.y - u0.y) - Math.hypot(b.x - u0.x, b.y - u0.y));
  const c = list[nth];
  if (!c) return false;
  window.CH = c;
  sn.commands = () => { const u = sn.s.units[0]; return sn.s.chestsOpened?.includes(c.id) ? [] : [{ type: 'move', dx: c.x - u.x, dy: c.y - u.y }]; };
  window.T = 100000; const t0 = Date.now(); window.off = 0; Date.now = () => t0 + off;
  window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
  window.toChest = (max) => { for (let i = 0; i < max; i++) { ff(1); if (sn.s.chestsOpened?.includes(c.id)) return i; } return -1; };
  __game.loop.sleep();
  return true;
}, [stage, !!process.env.OFF, +(process.env.NTH || 0)]);
if (!ok) { console.log('這張圖沒有白天的寶箱'); await b.close(); process.exit(1); }
// 第 207 輪：先站在旁邊（還不會開的距離）拍一張蓋著的箱子
if (process.env.CLOSED) {
  await pg.evaluate(() => { const sn = sc(); const u = sn.s.units[0]; const keep = sn.commands; sn.commands = () => []; u.x = CH.x + 210; u.y = CH.y + 30; ff(40); sn.commands = keep; });
  await pg.screenshot({ path: `${OUT}/${tag}-closed.png` });
}
let n = -1;
for (let k = 0; k < 40 && n < 0; k++) n = await pg.evaluate(() => toChest(120));
console.log('opened', n >= 0);
let at = 0;
for (const a of (process.env.AT || '20,50,90').split(',').map(Number)) {
  await pg.evaluate((d) => ff(d), a - at); at = a;
  await pg.screenshot({ path: `${OUT}/${tag}-${String(a).padStart(3, '0')}.png` });
}
console.log(await pg.evaluate(() => { const s = sc().s; const u = s.units[0]; return JSON.stringify({ tick: s.tick, hp: u.hp, chest: CH, hero: [u.x, u.y] }); }));
await b.close();
