// 主角走路的連續幀（第 193 輪）：往一個方向走，每隔幾幀裁主角附近一張，拼成一列。先 `npx vite --port 5173`。
// 用法：node scripts/shot-walk.mjs sword|bow|staff [地圖] [tag] [dx] [dy]   環境變數 OFF=1（關掉分件，拍舊的）、N=8、EVERY=3、LOWFX=1
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [weapon = 'sword', stage = 'mistwood', tag = 'walk', DX = '1000', DY = '0'] = process.argv.slice(2);
const N = +(process.env.N || 8); const EVERY = +(process.env.EVERY || 3);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([w, low]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', w);
  localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1');
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: 5, bossKills: 1 }));
  if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
}, [weapon, !!process.env.LOWFX]);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate((stage) => __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }), stage);
await pg.waitForTimeout(3500);
await pg.evaluate(async ([dx, dy, off]) => {
  window.sc = () => __game.scene.getScene('RtBattle');
  if (off) { const m = await import('/src/game/fx/heroWalk.ts'); m.HERO_WALK.on = false; sc().scene.restart({ stage: sc().stageId ?? 'mistwood', bot: '' }); }
  window.mv = { dx, dy };
}, [+DX, +DY, !!process.env.OFF]);
await pg.waitForTimeout(process.env.OFF ? 3000 : 200);
await pg.evaluate(() => {
  const sn = sc();
  sn.commands = () => [{ type: 'move', dx: mv.dx, dy: mv.dy }];
  window.T = 100000; const t0 = Date.now(); window.off = 0; Date.now = () => t0 + off;
  window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
  __game.loop.sleep(); ff(40);
});
const shots = [];
for (let k = 0; k < N; k++) {
  const p = await pg.evaluate((n) => { ff(n); sc().flashUntil?.clear?.(); const s = sc(); const u = s.s.units[0]; const c = __game.canvas.getBoundingClientRect(); const sp = s.sprites.get(u.id); return { x: c.left + (sp.x / 720) * c.width, y: c.top + (sp.y / __game.config.height) * c.height, key: sp.texture.key }; }, EVERY);
  const f = `screenshots/${tag}-${k}.png`;
  await pg.screenshot({ path: f, clip: { x: Math.max(0, p.x - 45), y: p.y - 78, width: 90, height: 100 } });
  shots.push(f); if (k === 0) console.log(p.key);
}
console.log(shots.join(' '));
await b.close();
