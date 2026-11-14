// 法杖冰霜新星地上那圈結霜的同一瞬間對照（第 206 輪）：<tag>.png＝現在、<tag>-x.png＝舊的平圓盤。先 `npx vite --port 5173`。
// 用法：node scripts/shot-frost.mjs [地圖] [tag]   環境變數 W=390、H=844、LEVEL=14、AGE=450（結霜圈出現後幾毫秒）、OUT=screenshots、LOWFX=1、DSF=2、STILL=1（主角不追怪，站著等怪來）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT || 'screenshots';
mkdirSync(OUT, { recursive: true });
const [stage = 'thornvale', tag = 'frost'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) }, deviceScaleFactor: +(process.env.DSF || 2) });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([low, lv]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', 'staff');
  localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1');
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: lv, bossKills: 1 }));
  if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
}, [!!process.env.LOWFX, +(process.env.LEVEL || 14)]);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate((stage) => __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }), stage);
await pg.waitForTimeout(3500);
await pg.evaluate(async (still) => {
  window.FG = (await import('/src/game/fx/frostGround.ts')).FROST_GROUND;
  window.sc = () => __game.scene.getScene('RtBattle');
  const sn = sc();
  sn.commands = () => {
    const u = sn.s.units[0];
    let best = null, bd = 1e18;
    for (const e of sn.s.units) { if (e.side === 'player' || e.dead) continue; const d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2; if (d < bd) { bd = d; best = e; } }
    if (!best || (still && bd < 300 * 300)) return [];
    return [{ type: 'move', dx: best.x - u.x, dy: best.y - u.y }];
  };
  window.T = 100000; const t0 = Date.now(); window.off = 0; Date.now = () => t0 + off;
  window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
  window.toFrost = (max, age) => { for (let i = 0; i < max; i++) { ff(1); const r = sn.hz.frost.find((f) => f.ring); if (r && sn.time.now - r.born >= age) return true; } return false; };
  __game.loop.sleep();
}, !!process.env.STILL);
let ok = false;
for (let k = 0; k < 40 && !ok; k++) ok = await pg.evaluate((age) => toFrost(120, age), +(process.env.AGE || 450));
console.log('frost', ok);
await pg.screenshot({ path: `${OUT}/${tag}.png` });
await pg.evaluate(() => { FG.on = false; __game.step(T, 0); });
await pg.screenshot({ path: `${OUT}/${tag}-x.png` });
console.log(await pg.evaluate(() => { const S = sc(); const r = S.hz.frost.find((f) => f.ring); const u = S.s.units[0]; return JSON.stringify({ tick: S.s.tick, at: r && [Math.round(S.sx(r.x)), Math.round(S.sy(r.y)), Math.round(r.size * S.k)], action: u.action && [u.action.kind, u.action.id, u.action.start], rings: S.children.list.filter((o) => o.type === "Graphics" && o.depth === 790).length }); }));
await b.close();
