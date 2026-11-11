// 危險紅暈截圖（第 170 輪）。先 `npx vite --port 5173`。
// 用法：node scripts/shot-danger.mjs [tag] [W H]；環境變數 NIGHT=1 深夜、LOWFX=1 省電畫質。
// 四張：100%（沒事）、滿血剛被重擊、血量 28%、血量 10%＋剛被打。輸出 screenshots/danger-<tag>-<n>.png（整個畫面）。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [tag = 'new', W = '390', H = '844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +W, height: +H } });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([night, low]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', 'sword');
  localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1');
  if (night) localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: 20, night: true, furyKills: 1, bossKills: 3 }));
  if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
}, [!!process.env.NIGHT, !!process.env.LOWFX]);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate(() => __game.scene.getScene('Title').scene.start('RtBattle', { stage: 'mistwood', bot: '' }));
await pg.waitForTimeout(3500);
await pg.evaluate(() => {
  window.sc = () => __game.scene.getScene('RtBattle');
  const sn = sc(); const s = sn.s; const p = s.units[0];
  s.autoSkills = [];
  // 把主角搬到最近的三隻狼旁邊（離開營火安全區），狼不出手
  const d2 = (u) => (u.x - p.x) ** 2 + (u.y - p.y) ** 2;
  const foes = s.units.filter((u) => u.side === 'enemy' && !u.dead && u.tier !== 'boss').sort((a, b) => d2(a) - d2(b)).slice(0, 3);
  const home = { x: foes[0].x - 160, y: foes[0].y };
  window.hpPct = 1;
  window.pin = () => { p.x = home.x; p.y = home.y; p.hp = Math.max(1, Math.round(p.maxHp * hpPct)); p.nextAttackTick = s.tick + 999; p.targetId = null; foes.forEach((u, i) => { u.x = home.x + 160 + (i ? 80 : 0); u.y = home.y + (i - 1) * 90 * (i ? 1 : 0); u.action = null; u.mode = 'combat'; u.engagedTick = s.tick; u.nextAttackTick = s.tick + 999; }); };
  pin(); sn.events.on('postupdate', pin);
  window.T = 100000; const rn = Date.now.bind(Date); window.off = 0; const t0real = rn(); Date.now = () => t0real + off; /* 只走遊戲時間：Phaser 的 tween 用 Date.now（第 178 輪） */
  window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
  __game.loop.sleep();
  ff(40); sn.flashUntil?.clear?.();
});
const STEPS = [[1, false, false], [1, true, true], [0.28, false, false], [0.1, true, false]];
let k = 0;
for (const [hp, hit, big] of STEPS) {
  const a = await pg.evaluate(([hp, hit, big]) => { hpPct = hp; ff(30); if (hit) { sc().heroHitAt = sc().time.now; sc().heroHitBig = big; } ff(3); return +sc().danger.alpha.toFixed(3); }, [hp, hit, big]);
  console.log('hp', hp, 'hit', hit, 'alpha', a);
  await pg.screenshot({ path: `screenshots/danger-${tag}-${k++}.png`, timeout: 90000 });
}
await b.close();
