// 拍「蓋著的牌」（D-383）：三選一面板（含蓋著的牌）＋翻開的三種結果。先 `npx vite --port 5173`。
// 用法：node scripts/shot-gamble.mjs [sword|bow|staff] [地圖] [tag] [W H]；環境變數 NIGHT=1、LOWFX=1。
// 輸出 screenshots/gamble-<tag>-panel.png、-double.png、-single.png、-cursed.png、-hud.png、-list.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [weapon = 'sword', stage = 'mistwood', tag = 'new', W = '390', H = '844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DSF || 1) });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([w, stage, night, low]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', w);
  localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1'); localStorage.setItem('jg_tip_bless', '1');
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: 6, ...(night && stage === 'mistwood' ? { night: true, bossKills: 3, furyKills: 1 } : {}) }));
  if (stage !== 'mistwood') localStorage.setItem('jg_rt_' + stage, JSON.stringify({ bossKills: 1, ...(night ? { night: true, bossKills: 3, furyKills: 1 } : {}) }));
  if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
}, [weapon, stage, !!process.env.NIGHT, !!process.env.LOWFX]);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate((stage) => __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }), stage);
await pg.waitForTimeout(3500);
await pg.evaluate(([weapon]) => {
  window.sc = () => __game.scene.getScene('RtBattle');
  const sn = sc();
  const reach = weapon === 'sword' ? 120 : 420;
  window.HOLD = false; // true＝有三選一時不自動選（留著面板拍照）
  const orig = sn.commands.bind(sn);
  sn.commands = () => {
    const s = sn.s; const p = s.units[0]; const out = orig().filter((c) => c.type === 'bless'); // 面板送出的選擇照樣進 core
    if (s.bless?.offer && !window.HOLD && !s.bless.dark) { out.push({ type: 'bless', pick: 0 }); return out; }
    let best = null; let bd = 1e18;
    for (const u of s.units) { if (u.side !== 'enemy' || u.dead) continue; const d = (u.x - p.x) ** 2 + (u.y - p.y) ** 2; if (d < bd) { bd = d; best = u; } }
    if (best) {
      const d = Math.sqrt(bd);
      if (p.targetId !== best.id && d < 900) out.push({ type: 'target', id: best.id });
      if (d > reach) out.push({ type: 'move', dx: Math.round(((best.x - p.x) / d) * 1000), dy: Math.round(((best.y - p.y) / d) * 1000) });
      else out.push({ type: 'stop' });
    }
    return out;
  };
  window.T = 100000; const rn = Date.now.bind(Date); window.off = 0; const t0real = rn(); Date.now = () => t0real + off;
  // 快轉時不畫圖（只有最後三幀才畫）
  const R = __game.renderer; const pre = R.preRender.bind(R); const rr = R.render.bind(R); const post = R.postRender.bind(R);
  window.draw = true;
  R.preRender = () => { if (draw) pre(); }; R.render = (...a) => { if (draw) rr(...a); }; R.postRender = () => { if (draw) post(); };
  window.ff = (sec, quiet) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { draw = !quiet && i >= n - 3; T += 16.667; off += 16.667; __game.step(T, 16.667); } draw = true; };
  // 走到「有蓋著的牌的面板開著」（最多 sec 秒）
  // 不等 Bot 慢慢打：計量直接給滿，抓一隻小怪放到面前、剩 1 滴血
  window.feed = () => { const s = sc().s; const p = s.units[0]; if (!s.bless || s.bless.offer) return; s.bless.meter = 5; const e = s.units.find((u) => u.side === 'enemy' && !u.dead && u.tier === 'normal'); if (!e) return; e.x = p.x + 100; e.y = p.y; e.homeX = e.x; e.homeY = e.y; e.mode = 'combat'; e.engagedTick = s.tick; e.hp = 1; };
  window.toDark = (sec) => { feed(); for (let i = 0; i < sec * 60; i++) { ff(1 / 60, true); const s = sc().s; if (s.bless?.dark && sc().blessRoot) { ff(0.7); return true; } if (i % 120 === 119) feed(); } return false; };
  // 找一個翻出指定結果的祝福種子（和 engine.ts 的 blessRand 同一個算法；只給拍照用）
  window.seedFor = (want, dbl, cur) => { for (let k = 1; k < 5000; k++) { const r = Math.imul(k, 2654435761) >>> 0 || 1; let x = r; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; const roll = (x / 0x100000000) * 100; const got = roll < dbl ? 'double' : roll < dbl + cur ? 'cursed' : 'single'; if (got === want) return r; } return 1; };
  window.clickText = (pre) => { const all = []; const walk = (l) => { for (const o of l) { if (o.list) walk(o.list); if (o.type === 'Text' && o.visible && o.text.startsWith(pre)) all.push(o); } }; walk(sc().children.list); const t = all[0]; if (!t) return 'notext'; const bg = t.parentContainer.list.find((o) => o.listenerCount && o.listenerCount('pointerdown')); if (!bg) return 'nolistener'; bg.emit('pointerdown', { x: 0, y: 0 }, 0, 0, { stopPropagation() {} }); return 'ok'; };
  __game.loop.sleep();
}, [weapon]);
const shot = (name) => pg.screenshot({ path: `screenshots/gamble-${tag}-${name}.png`, timeout: 90000 });
const results = ['double', 'single', 'cursed'];
for (let k = 0; k < results.length; k++) {
  const ok = await pg.evaluate(() => toDark(120));
  if (!ok) { console.log('沒等到蓋著的牌', k); break; }
  if (k === 0) await shot('panel');
  const r = await pg.evaluate(async (want) => {
    const s = sc().s; s.bless.rng = seedFor(want, 35, 30);
    const c = clickText('蓋著的牌'); ff(0.6);
    const ev = s.events.filter((e) => e.type === 'blessGamble').at(-1);
    return { c, n: s.events.filter((e) => e.type === 'blessGamble').length, tick: s.tick, rng: s.bless.rng, ev, taken: s.bless.taken.length, curse: s.bless.curse ?? 0 };
  }, results[k]);
  console.log(results[k], JSON.stringify(r));
  await shot(results[k]);
  await pg.evaluate(() => ff(2.5));
}
await shot('hud');
await pg.evaluate(() => { sc().openBlessList(); ff(0.4); });
await shot('list');
await b.close();
