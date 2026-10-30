// 新存檔＋Bot 代打快轉截圖（第 45 輪）。要先 `npx vite --port 5173`（用 dev server 才能 import Bot）。
// 用法：SHOTS='[[遊戲秒數, "要執行的 JS"?], ...]' node scripts/shot-newsave.mjs 名稱 sword|bow|staff [W H] → screenshots/名稱-00.png…
// 快轉：藏起相機（無頭瀏覽器慢在軟體 WebGL）＋ __game.step 手動推進＋假的 Date.now（Phaser 3.60+ 的 tween 用 Date.now 算時間）。
// 每段印出這段時間出現過的文字（教學提示、大字…）。抉擇／相遇面板自動選「還」／「助」。環境變數 STAGE（地圖 id）、VIA（gate＝光門抵達）、LS（先寫進 localStorage 的 JSON）。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [name='b', weapon='sword', W='360', H='640'] = process.argv.slice(2);
const STAGE = process.env.STAGE || 'mistwood';
const VIA = process.env.VIA || ''; // 'gate'＝從上一張圖的光門抵達（D-188）
const shots = JSON.parse(process.env.SHOTS || '[[5],[30],[60]]');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +W, height: +H } });
pg.on('pageerror', e => console.log('PAGEERR', e.message));
pg.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,200)); });
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([w, ls]) => { localStorage.clear(); localStorage.setItem('jg_prologue_seen','1'); localStorage.setItem('jg_weapon', w); for (const [k, v] of Object.entries(JSON.parse(ls))) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }, [weapon, process.env.LS || '{}']);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate(([st, via]) => __game.scene.getScene('Title').scene.start('RtBattle', via ? { stage: st, bot: '', via } : { stage: st, bot: '' }), [STAGE, VIA]);
await pg.waitForTimeout(3000);
await pg.evaluate(async (st) => {
  const { PlayerBot, BOT_PROFILES } = await import('/src/core/battle/rt/sim.ts');
  const { WORLD_MAPS } = await import('/src/game/worldMaps.ts');
  window.sc = () => __game.scene.getScene('RtBattle');
  const wm = WORLD_MAPS.find((m) => m.id === st);
  window.mkBot = () => { const bot = new PlayerBot({ ...BOT_PROFILES.expert, ult: true, potionAtPct: 35, campfireBelowPotions: 8, advanceTo: wm.bossAt }, 'expert'); sc().commands = () => { const out = sc().pending; sc().pending = []; return out.length ? out : bot.decide(sc().s); }; };
  mkBot();
  window.texts = () => { const s = sc(); const out = []; const walk = (l) => { for (const o of l) { if (o.list) { if (o.visible) walk(o.list); } else if (o.type === 'Text' && o.visible && o.alpha > 0.05 && o.text) out.push(o.text.replace(/\n/g,'⏎')); } }; walk(s.children.list); return out.join(' | '); };
  window.clk = (pre) => { const s = sc(); const all = []; const walk = (l) => { for (const o of l) { if (o.list) walk(o.list); if (o.type === 'Text' && o.visible && o.text.startsWith(pre)) all.push(o); } }; walk(s.children.list); const t = all[0]; if (!t) return null; for (let o = t; o; o = o.parentContainer) if (o.listenerCount && o.listenerCount('pointerdown')) { o.emit('pointerdown', { x: 0, y: 0 }, 0, 0, { stopPropagation() {} }); return pre; } const near = []; const walk2 = (l) => { for (const o of l) { if (o.list) walk2(o.list); else if (o.listenerCount && o.listenerCount('pointerdown') && o.parentContainer === t.parentContainer && Math.abs(o.y - t.y) < 60) near.push(o); } }; walk2(s.children.list); if (near[0]) { near[0].emit('pointerdown', { x: 0, y: 0 }, 0, 0, { stopPropagation() {} }); return pre + '*'; } return 'nolistener ' + pre; };
  window.AUTOPICK = () => (clk('還') || clk('助')) && clk('就這麼做') || clk('略過') || clk('繼續');
  window.T = 100000; window.gt = 0; const rn = Date.now.bind(Date); window.off = 0; Date.now = () => rn() + off;
  window.ff = (sec) => { const cams = __game.scene.getScenes(true).map(s => s.cameras.main); cams.forEach(c => c.setVisible(false)); const n = Math.round(sec * 1000 / 50); for (let i = 0; i < n; i++) { T += 50; off += 50; __game.step(T, 50); } gt += sec; cams.forEach(c => c.setVisible(true)); };
}, STAGE);
let i = 0;
for (const [sec, js] of shots) {
  const r = await pg.evaluate(async ([sec, js]) => { const log = []; const step = 0.5; const seen = new Set(); while (gt < sec) { ff(step); const t = texts(); for (const part of t.split(' | ')) if (part.length > 3 && !/⏎[\d.]+$/.test(part) && !/^Lv |^MENU|^MISS|^—|^\+\d|^粉塵|^MP|^懸賞|^\d+!$|^藥水|^[\d.]+$|^\d+m$/.test(part) && !seen.has(part)) { seen.add(part); log.push(gt.toFixed(1) + 's ' + part); } if (sc().menu && window.AUTOPICK) { const r = AUTOPICK(); if (r) log.push(gt.toFixed(1)+'s PICK '+r); } } let ev = null; if (js) ev = await eval(js); const s = sc().s; const p = s.units[0]; return { log: log.slice(0, 80), ev, lv: s.prog?.level, hp: p.hp, x: Math.round(p.x/100), y: Math.round(p.y/100), tick: s.tick, out: s.outcome }; }, [sec, js]);
  console.log('#' + i, sec, JSON.stringify(r));
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `screenshots/${name}-${String(i).padStart(2,'0')}.png` });
  i++;
}
await b.close();
