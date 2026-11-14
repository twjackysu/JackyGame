// 面板巡看（第 204 輪）。先 `npx vite --port 5173`。存檔＝Lv14、技能點了一些；照 STEPS（JSON 陣列，每步一段 JS）一步截一張到 screenshots/pn-<tag>-<n>.png。
// 用法：STEPS='["sc().openSkills()"]' node scripts/shot-panels.mjs sword|bow|staff [地圖] [tag] [W H]　環境變數 REC='{"skills":{…},"variants":{…}}' 蓋掉預設存檔、FRAMES=每步之後推幾幀（預設 30）、DSF=2
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [weapon = 'sword', stage = 'mistwood', tag = 'a', W = '390', H = '844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DSF || 1) });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([w, rec]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', w);
  localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1');
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: 14, bossKills: 1, skills: { heavy_slash: 5, whirlwind: 5, charge: 3 }, variants: { heavy_slash: 1 }, ...rec }));
}, [weapon, JSON.parse(process.env.REC || '{}')]);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate((stage) => __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }), stage);
await pg.waitForTimeout(3500);
await pg.evaluate(() => {
  window.sc = () => __game.scene.getScene('RtBattle');
  window.clk = (pre) => { const all = []; const walk = (l) => { for (const o of l) { if (o.list) walk(o.list); if (o.type === 'Text' && o.visible && (pre[0] === '=' ? o.text === pre.slice(1) : o.text.includes(pre))) all.push(o); } }; walk(sc().children.list); const t = all[all.length - 1]; if (!t) return null; t.emit('pointerdown', {}, 0, 0, { stopPropagation() {} }); t.emit('pointerup', {}, 0, 0, { stopPropagation() {} }); return t.text; };
  window.T = 100000; const t0 = Date.now(); window.off = 0; Date.now = () => t0 + off;
  window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
  __game.loop.sleep(); ff(60);
});
let i = 0;
for (const js of JSON.parse(process.env.STEPS)) {
  console.log(i, JSON.stringify(await pg.evaluate(async (js) => await eval(js), js)));
  await pg.evaluate((f) => ff(f), +(process.env.FRAMES || 30));
  await pg.screenshot({ path: `screenshots/pn-${tag}-${i++}.png`, timeout: 90000 });
}
await b.close();
