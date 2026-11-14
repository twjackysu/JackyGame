// 怪站在主角正前方（南邊）蓋住主角的對照（第 202 輪）。先 `npx vite --port 5173`。
// 用法：node scripts/shot-cover.mjs sword|bow|staff [地圖] [tag]   環境變數 N=3（幾隻怪貼在南邊）、ELITE=1（挑精英）、OFF=1（關掉小怪也透出主角的新規則）、OUT=screenshots
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT || 'screenshots';
mkdirSync(OUT, { recursive: true });
const [weapon = 'staff', stage = 'starfall', tag = 'cover'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([w]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', w);
  localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1');
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: 14, bossKills: 1 }));
}, [weapon]);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate((stage) => __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }), stage);
await pg.waitForTimeout(3500);
const info = await pg.evaluate(async ([n, elite, off]) => {
  window.sc = () => __game.scene.getScene('RtBattle');
  const sn = sc(); const s = sn.s; const p = s.units[0];
  if (off) { const m = await import('/src/game/fx/occlude.ts'); m.OCCLUDE.crowd = false; sn.barFade = false; }
  s.autoSkills = [];
  const d2 = (u) => (u.x - p.x) ** 2 + (u.y - p.y) ** 2;
  const pool = s.units.filter((u) => u.side === 'enemy' && !u.dead && u.tier !== 'boss' && (elite ? u.tier === 'elite' : u.tier !== 'elite')).sort((a, b) => d2(a) - d2(b));
  const foes = pool.slice(0, n);
  const spots = [[0.05, 0.38], [-0.5, 0.3], [0.55, 0.25]];
  const home = { x: foes[0].x, y: foes[0].y - 40 };
  window.pin = () => { p.x = home.x; p.y = home.y; p.hp = p.maxHp; foes.forEach((u, i) => { u.x = home.x + spots[i][0] * 100; u.y = home.y + spots[i][1] * 100; u.action = null; u.mode = 'combat'; u.engagedTick = s.tick; u.nextAttackTick = s.tick + 999; u.hp = Math.max(u.hp, 99999); u.maxHp = Math.max(u.maxHp, 99999); if ('homeX' in u) { u.homeX = u.x; u.homeY = u.y; } }); p.nextAttackTick = s.tick + 999; };
  for (const u of s.units) if (u.side === 'enemy' && !foes.includes(u)) { u.x = home.x - 6000; u.y = home.y - 6000; u.homeX = u.x; u.homeY = u.y; }
  pin(); sn.events.on('postupdate', pin);
  window.T = 100000; const t0 = Date.now(); window.off = 0; Date.now = () => t0 + off;
  window.ff = (k) => { for (let i = 0; i < k; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
  __game.loop.sleep(); ff(40); sn.flashUntil?.clear?.(); ff(4);
  const hs = sn.sprites.get(p.id); const c = __game.canvas.getBoundingClientRect();
  return { x: c.left + (hs.x / 720) * c.width, y: c.top + (hs.y / __game.config.height) * c.height, ghost: +(hs.getData('ghost')?.visible ? hs.getData('ghost').alpha : 0).toFixed(2), hero: [hs.x, hs.y, hs.displayWidth, hs.displayHeight, hs.originY, hs.depth].map((v) => +v.toFixed(2)), ratios: foes.map((u) => { const sp = sn.sprites.get(u.id); return [u.defId, sp.x, sp.y, sp.displayWidth, sp.displayHeight, sp.originY, sp.depth].map((v) => (typeof v === 'number' ? +v.toFixed(2) : v)); }) };
}, [+(process.env.N || 1), !!process.env.ELITE, !!process.env.OFF]);
console.log(JSON.stringify({ ghost: info.ghost, hero: info.hero, foes: info.ratios }));
await pg.screenshot({ path: `${OUT}/${tag}.png`, clip: { x: Math.max(0, info.x - 70), y: info.y - 85, width: 140, height: 130 } });
await b.close();
