// 自然打鬥的整頁巡看（第 202 輪）：主角追最近的怪，每隔幾幀截一張整頁，用來挑「最礙眼的地方」。先 `npx vite --port 5173`。
// 用法：node scripts/shot-survey.mjs sword|bow|staff [地圖] [tag]   環境變數 W=390、H=844、LEVEL=14、N=8（張數）、GAP=45（每張隔幾幀）、WARM=240、OUT=screenshots、LOWFX=1、INTRO_OFF=1（開場說明回舊位置）
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
await pg.evaluate(([stage, off]) => { if (off) __game.scene.getScene('RtBattle').introLow = false; __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }); }, [stage, !!process.env.INTRO_OFF]);
await pg.waitForTimeout(3500);
await pg.evaluate(() => {
  window.sc = () => __game.scene.getScene('RtBattle');
  const sn = sc();
  sn.commands = () => {
    const u = sn.s.units[0];
    let best = null, bd = 1e18;
    for (const e of sn.s.units) { if (e.side === 'player' || e.dead) continue; const d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2; if (d < bd) { bd = d; best = e; } }
    if (!best) return [];
    return [{ type: 'move', dx: best.x - u.x, dy: best.y - u.y }];
  };
  window.T = 100000; const t0 = Date.now(); window.off = 0; Date.now = () => t0 + off;
  window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
  __game.loop.sleep();
});
const N = +(process.env.N || 8), GAP = +(process.env.GAP || 45);
await pg.evaluate((n) => ff(n), +(process.env.WARM || 240));
for (let i = 0; i < N; i++) {
  await pg.evaluate((n) => ff(n), GAP);
  await pg.screenshot({ path: `${OUT}/${tag}-${String(i).padStart(2, '0')}.png` });
}
console.log(await pg.evaluate(() => { const s = sc().s; const u = s.units[0]; return JSON.stringify({ tick: s.tick, hp: u.hp, lv: u.level, dead: u.dead }); }));
await b.close();
