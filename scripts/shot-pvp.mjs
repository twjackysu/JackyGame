// 競技場對戰截圖（第 171 輪）。先 `npx vite --port 5173`。
// 用法：node scripts/shot-pvp.mjs [tag] [W H]　環境變數 HP=0.3（把自己的血壓成幾成，看危險紅暈）、LOWFX=1、SECS=6（開打後幾秒截）
// 輸出 screenshots/pvp-<tag>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [tag = 'x', W = '390', H = '844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +W, height: +H } });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate((low) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', 'sword');
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: 10, bossKills: 2 }));
  if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
}, !!process.env.LOWFX);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate(() => __game.scene.getScene('Title').scene.start('Pvp'));
await pg.waitForTimeout(2500);
const clicked = await pg.evaluate(() => {
  window.sc = () => __game.scene.getScene('Pvp');
  const s = sc(); let hit = null;
  const walk = (l) => { for (const o of l) { if (o.list) walk(o.list); if (o.type === 'Text' && o.visible && o.text.startsWith('開始對戰')) hit = o; } };
  walk(s.children.list);
  if (!hit) return 'no button';
  for (let o = hit; o; o = o.parentContainer) if (o.listenerCount && o.listenerCount('pointerdown')) { o.emit('pointerdown', { x: 0, y: 0 }, 0, 0, { stopPropagation() {} }); return 'ok'; }
  const near = []; const walk2 = (l) => { for (const o of l) { if (o.list) walk2(o.list); else if (o !== hit && o.listenerCount && o.listenerCount('pointerdown') && Math.abs(o.y - hit.y) < 40 && Math.abs(o.x - hit.x) < 200) near.push(o); } };
  walk2(s.children.list);
  if (near[0]) { near[0].emit('pointerdown', { x: 0, y: 0 }, 0, 0, { stopPropagation() {} }); return 'ok*'; }
  return 'no listener';
});
console.log('start:', clicked);
await pg.waitForFunction(() => sc().phase === 'fight', null, { timeout: 30000 }).catch(() => console.log('not fighting; phase =', 'unknown'));
const hp = +(process.env.HP || 0);
const secs = +(process.env.SECS || 6);
for (let t = 0; t < secs * 4; t++) {
  if (hp) await pg.evaluate((hp) => { const p = sc().s.units[0]; p.hp = Math.min(p.hp, Math.round(p.maxHp * hp)); }, hp);
  await pg.waitForTimeout(250);
}
console.log(JSON.stringify(await pg.evaluate(() => { const s = sc().s; const p = s.units[0]; return { phase: sc().phase, hp: Math.round((p.hp / p.maxHp) * 100), danger: +sc().danger.alpha.toFixed(2), vis: sc().danger.visible }; })));
await pg.screenshot({ path: `screenshots/pvp-${tag}.png`, timeout: 90000 });
await b.close();
