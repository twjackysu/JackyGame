// 獨特裝備的面板截圖（第 165 輪）。先 `npx vite --port 5173`；塞三件獨特＋四件一般裝備進行囊，照 STEPS（JSON 陣列，每步一段 JS）一步截一張到 screenshots/uq-<tag>-<n>.png。
// 用法：STEPS='["sc().openBag()","clk(\"之王\")","clk(\"分解\")"]' node scripts/shot-unique.mjs 390 844 a　　clk("=賣")＝文字完全相同、clk("之王")＝包含；inj() 重新塞行囊（拍賣所會從伺服器重讀）。
import { chromium } from 'playwright';
const [W='390', H='844', tag='a'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +W, height: +H } });
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('jg_prologue_seen','1'); localStorage.setItem('jg_weapon','sword'); });
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate(() => __game.scene.getScene('Title').scene.start('RtBattle', { stage: 'mistwood', bot: '' }));
await pg.waitForTimeout(4000);
await pg.evaluate(async () => {
  const { genGear } = await import('/src/core/battle/rt/gear.ts');
  window.sc = () => __game.scene.getScene('RtBattle');
  const s = sc();
  const mk = (seed, r, o) => ({ ...genGear(seed, r, 8, { region: 'mistwood', ...o }) });
  const pool = ['ember','thunder','execute','venom'];
  const bag = [];
  let seed = 1; const ids = Object.keys((await import('/src/core/battle/rt/gear.ts')).UNIQUE_TITLES);
  for (const slot of ['weapon','ring','body']) { let g; do { g = genGear(seed++, 3, 10, { region: 'mistwood', slot, uniquePct: 100, uniquePool: ids }); } while (!g.unique); bag.push(g); }
  bag.push(mk(50, 3, { slot: 'weapon' }), mk(51, 2, { slot: 'ring' }), mk(52, 1, { slot: 'body' }), mk(53, 3, {slot:'head'}));
  bag.forEach((g, i) => (g.uid = 'u' + i));
  window.inj = () => (sc().bagSt = { bag, equip: {} }); inj();
  window.clk = (pre) => { const all = []; const walk = (l) => { for (const o of l) { if (o.list) walk(o.list); if (o.type === 'Text' && o.visible && (pre[0] === "=" ? o.text === pre.slice(1) : o.text.includes(pre))) all.push(o); } }; walk(sc().children.list); const t = all[all.length-1]; if (!t) return null; if (t.listenerCount('pointerdown')) { t.emit('pointerdown', {}, 0, 0, { stopPropagation() {} }); return t.text; } const near=[]; const w2=(l)=>{for(const o of l){ if(o.list) w2(o.list); else if (o.listenerCount && o.listenerCount('pointerdown') && o.parentContainer===t.parentContainer && Math.abs(o.y-t.y)<20 && o.width<700) near.push(o);} }; w2(sc().children.list); if(near[0]){near[0].emit('pointerdown', {}, 0, 0, { stopPropagation() {} }); return t.text+'*';} return 'nolistener'; };
  window.T = 100000; const rn = Date.now.bind(Date); window.off = 0; Date.now = () => rn() + off;
  window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16; off += 16; __game.step(T, 16); } };
  __game.loop.sleep();
});
const shot = async (n) => { await pg.evaluate(() => ff(30)); await pg.screenshot({ path: `screenshots/uq-${tag}-${n}.png`, timeout: 90000 }); };
const steps = JSON.parse(process.env.STEPS);
let i = 0;
for (const js of steps) { console.log(i, JSON.stringify(await pg.evaluate(async (js) => await eval(js), js))); await shot(i++); }
await b.close();
