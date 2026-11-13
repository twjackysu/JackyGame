// 競技場對戰截圖（第 171 輪）。先 `npx vite --port 5173`。
// 用法：node scripts/shot-pvp.mjs [tag] [W H]　環境變數 HP=0.3（把自己的血壓成幾成，看危險紅暈）、LOWFX=1、WEAPON=bow|staff（第 179 輪）、STATUS=shield|freeze|stun（第 199 輪）、SECS=6（開打後幾秒截）
// 輸出 screenshots/pvp-<tag>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [tag = 'x', W = '390', H = '844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DSF || 1) });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
pg.on('console', (m) => { if (m.text().startsWith('DBG')) console.log(m.text()); }); // 第 200 輪：頁面裡 console.log('DBG …') 會印出來
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([low, w]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', w);
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: 10, bossKills: 2 }));
  if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
}, [!!process.env.LOWFX, process.env.WEAPON || 'sword']);
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
// 第 185 輪：連拍「範圍閃一下」的那一刻（AREA=n 張）。偵測到 fx 裡有 shape 就把迴圈停住再拍。
const nArea = +(process.env.AREA || 0);
if (nArea) {
  await pg.evaluate(() => { window.seen = new Set(); window.frozen = false; sc().events.on('postupdate', () => { if (window.frozen) return; const now = sc().time.now; const f = sc().fx.find((f) => f.shape && !seen.has(f.shape.type + (f.col)) && (f.until - now) / f.dur < 0.8); if (f) { seen.add(f.shape.type + f.col); window.frozen = f.shape.type; __game.loop.sleep(); } }); });
  for (let i = 0; i < nArea; i++) {
    const got = await pg.waitForFunction(() => window.frozen, null, { timeout: 40000 }).then((h) => h.jsonValue()).catch(() => null);
    if (!got) { console.log('no more shapes'); break; }
    await pg.evaluate(() => { const g = __game; g.renderer.preRender(); g.scene.render(g.renderer); g.renderer.postRender(); });
    await pg.screenshot({ path: `screenshots/pvp-${tag}-${i}-${got}.png`, timeout: 90000 });
    console.log('shot', i, got);
    await pg.evaluate(() => { window.frozen = false; __game.loop.wake(); });
  }
  await b.close(); process.exit(0);
}
// 第 187 輪：連拍「全畫面閃光」的頭幾幀（FLASH=n 張）。偵測到 camera.flash 或深度 47 的加亮矩形就停住，之後一幀一幀走。
const nFlash = +(process.env.FLASH || 0);
if (nFlash) {
  await pg.evaluate((ULT) => { window.frozen = false; sc().events.on('preupdate', () => { if (!window.frozen && ULT) sc().inp.push({ type: 'skill', id: ULT }); }); const on = () => sc().cameras.main.flashEffect.isRunning || sc().children.list.some((o) => o.type === 'Rectangle' && o.depth === 47 && o.alpha > 0.01); sc().events.on('postupdate', () => { if (!window.frozen && on()) { window.frozen = true; __game.loop.sleep(); } }); }, process.env.ULT === '0' ? '' : 'blade_storm'); // 自己一直按大招（ULT=0 不按，等對手的）
  const got = await pg.waitForFunction(() => window.frozen, null, { timeout: 90000 }).then(() => true).catch(() => false);
  if (!got) { console.log('no flash'); await b.close(); process.exit(0); }
  for (let i = 0; i < nFlash; i++) {
    await pg.evaluate((i) => { const g = __game; if (i) { window.T = (window.T ?? g.loop.now) + 16.667; g.step(window.T, 16.667); } else { g.renderer.preRender(); g.scene.render(g.renderer); g.renderer.postRender(); } }, i);
    await pg.screenshot({ path: `screenshots/pvp-${tag}-f${i}.png`, timeout: 90000 });
  }
  console.log('flash frames', nFlash);
  await b.close(); process.exit(0);
}
// 第 199 輪：拍「場上有人帶著某個狀態」的那一刻（STATUS=shield|stun|freeze|slow；NSTAT=張數，預設 2）。印出那個人在畫面上的位置；PRESS=技能欄 id（自己一直按，例如 parry 拿護盾）；PAIR='js' 會在每張後跑一段再拍一張 -x（對照）
if (process.env.STATUS) {
  if (process.env.INJECT) await pg.evaluate((id) => sc().events.on('preupdate', () => { const s = sc().s; const u = s.units[1]; if (s.tick > 90 && !window.inj && u && !u.dead) { window.inj = 1; u.statuses.push({ id, until: s.tick + 45, stacks: 1, value: 0, srcId: 0, next: 0 }); } }), process.env.INJECT); // INJECT=freeze|stun：直接在對手身上塞一個狀態（只為了看畫法；實戰裡被控時間很短，等不到）
  if (process.env.PRESS) await pg.evaluate((id) => sc().events.on('preupdate', () => { if (!window.frozen) sc().inp.push({ type: 'skill', id }); }), process.env.PRESS); // PRESS=parry：自己一直按這一招
  await pg.evaluate((ID) => { window.frozen = false; window.cool = 0; sc().events.on('postupdate', () => { if (window.frozen) return; const s = sc().s; if (s.tick < window.cool) return; const u = s.units.find((u) => !u.dead && (sc().flashUntil.get(u.id) ?? 0) < sc().time.now && u.statuses.some((q) => q.id === ID && q.until - s.tick > 2 && (ID !== 'shield' || q.value > 0))); if (u) { window.frozen = [Math.round(sc().sx(u.x)), Math.round(sc().sy(u.y)), u.pid ? 'foe' : 'me']; window.cool = s.tick + 150; __game.loop.sleep(); } }); }, process.env.STATUS);
  for (let i = 0; i < +(process.env.NSTAT || 2); i++) {
    const got = await pg.waitForFunction(() => window.frozen, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => null);
    if (!got) { console.log('沒等到', process.env.STATUS); break; }
    const draw = () => pg.evaluate(() => { const g = __game; g.step(g.loop.now, 0); });
    await draw();
    await pg.screenshot({ path: `screenshots/pvp-${tag}-${i}.png`, timeout: 90000 });
    if (process.env.PAIR) { await pg.evaluate(process.env.PAIR); await draw(); await pg.screenshot({ path: `screenshots/pvp-${tag}-${i}-x.png`, timeout: 90000 }); }
    console.log('shot', i, JSON.stringify(got));
    await pg.evaluate(() => { window.frozen = false; __game.loop.wake(); });
  }
  await b.close(); process.exit(0);
}
const hp = +(process.env.HP || 0);
const secs = +(process.env.SECS || 6);
for (let t = 0; t < secs * 4; t++) {
  if (hp) await pg.evaluate((hp) => { const p = sc().s.units[0]; p.hp = Math.min(p.hp, Math.round(p.maxHp * hp)); }, hp);
  await pg.waitForTimeout(250);
}
console.log(JSON.stringify(await pg.evaluate(() => { const s = sc().s; const p = s.units[0]; return { phase: sc().phase, hp: Math.round((p.hp / p.maxHp) * 100), danger: +sc().danger.alpha.toFixed(2), vis: sc().danger.visible }; })));
await pg.screenshot({ path: `screenshots/pvp-${tag}.png`, timeout: 90000 });
await b.close();
