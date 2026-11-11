// 模擬「只管走位」的真人玩一段，定時截整個畫面（第 168 輪寫過、沒進 git；第 170 輪重寫進來）。先 `npx vite --port 5173`。
// 用法：node scripts/play.mjs sword|bow|staff [地圖] [tag] [張數] [每張間隔秒] [W H]
// 主角：走向最近的活怪、進射程就停（技能五欄自動）、血量 35% 以下喝水、祝福一律選第一張；不閃避。
// 快轉時不畫圖（只有截圖前三幀才畫），所以很快；主角直線走向怪，會卡在樹牆後面，拍前幾分鐘夠用。
// 環境變數 NIGHT=1、LOWFX=1、EVAL='js'（每張截圖前在頁面裡跑、印出結果）、LEVEL=n（存檔等級）、HP=0.3（把血量上限壓成幾成，看低血畫面）。輸出 screenshots/play-<tag>-<n>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [weapon = 'sword', stage = 'mistwood', tag = 'new', N = '8', GAP = '8', W = '390', H = '844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +W, height: +H } });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([w, stage, night, low, level]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', w);
  localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1');
  const base = { level: level || 1, ...(level > 1 ? { bossKills: 3, furyKills: 1 } : {}) };
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ ...base, ...(night && stage === 'mistwood' ? { night: true } : {}) }));
  if (stage !== 'mistwood') localStorage.setItem('jg_rt_' + stage, JSON.stringify({ bossKills: 1, ...(night ? { night: true, bossKills: 3, furyKills: 1 } : {}) })); // 深夜要先打倒過暴怒 Boss 才開（第 173 輪：以前少了 furyKills，NIGHT=1 對霧語以外的圖沒作用）
  if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
}, [weapon, stage, !!process.env.NIGHT, !!process.env.LOWFX, +(process.env.LEVEL || 1)]);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate((stage) => __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }), stage);
await pg.waitForTimeout(3500);
await pg.evaluate(([weapon]) => {
  window.sc = () => __game.scene.getScene('RtBattle');
  const sn = sc();
  const reach = weapon === 'sword' ? 120 : 420;
  sn.commands = () => {
    const s = sn.s; const p = s.units[0]; const out = [];
    if (s.bless?.offer) { out.push({ type: 'bless', pick: 0 }); return out; }
    let best = null; let bd = 1e18;
    for (const u of s.units) { if (u.side !== 'enemy' || u.dead) continue; const d = (u.x - p.x) ** 2 + (u.y - p.y) ** 2; if (d < bd) { bd = d; best = u; } }
    if (best) {
      const d = Math.sqrt(bd);
      if (p.targetId !== best.id && d < 900) out.push({ type: 'target', id: best.id });
      if (d > reach) out.push({ type: 'move', dx: Math.round(((best.x - p.x) / d) * 1000), dy: Math.round(((best.y - p.y) / d) * 1000) });
      else out.push({ type: 'stop' });
    }
    if (p.hp < p.maxHp * 0.35 && s.potions > 0 && (p.ready.potion ?? 0) <= s.tick) out.push({ type: 'potion' });
    return out;
  };
  window.clk = (pre) => { const s = sc(); const all = []; const walk = (l) => { for (const o of l) { if (o.list) walk(o.list); if (o.type === 'Text' && o.visible && o.text.startsWith(pre)) all.push(o); } }; walk(s.children.list); const t = all[0]; if (!t) return null; for (let o = t; o; o = o.parentContainer) if (o.listenerCount && o.listenerCount('pointerdown')) { o.emit('pointerdown', { x: 0, y: 0 }, 0, 0, { stopPropagation() {} }); return pre; } const near = []; const walk2 = (l) => { for (const o of l) { if (o.list) walk2(o.list); else if (o.listenerCount && o.listenerCount('pointerdown') && o.parentContainer === t.parentContainer && Math.abs(o.y - t.y) < 60) near.push(o); } }; walk2(s.children.list); if (near[0]) { near[0].emit('pointerdown', { x: 0, y: 0 }, 0, 0, { stopPropagation() {} }); return pre + '*'; } return 'nolistener ' + pre; };
  // 相遇抉擇／劇情面板會把戰鬥停住：自動選（KEEP_MENU=1 時不選，拿來拍面板本身）
  window.autopick = () => (clk('還') || clk('助') || clk('取')) && clk('就這麼做') || clk('略過') || clk('繼續');
  window.T = 100000; const rn = Date.now.bind(Date); window.off = 0; Date.now = () => rn() + off;
  const render = __game.scene.render ? null : null; void render;
  const R = __game.renderer; const pre = R.preRender.bind(R); const rr = R.render.bind(R); const post = R.postRender.bind(R);
  window.draw = true;
  R.preRender = () => { if (draw) pre(); }; R.render = (...a) => { if (draw) rr(...a); }; R.postRender = () => { if (draw) post(); };
  window.ff = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { draw = i >= n - 3; T += 16.667; off += 16.667; __game.step(T, 16.667); if (i % 20 === 19 && sc().menu && !window.KEEP_MENU) autopick(); } draw = true; };
  __game.loop.sleep();
}, [weapon]);
const hpCap = +(process.env.HP || 0);
// THEN=thornvale,starfall：拍完之後在同一次開遊戲裡換到下一張圖再拍一輪（找「打過一次／換過圖之後才壞」的東西）
const stages = [stage, ...(process.env.THEN ? process.env.THEN.split(',') : [])];
for (let si = 0; si < stages.length; si++) {
if (si > 0) {
  await pg.evaluate((st) => { localStorage.setItem('jg_rt_' + st, JSON.stringify({ bossKills: 1 })); __game.loop.wake(); sc().scene.start('RtBattle', { stage: st, bot: '' }); }, stages[si]);
  await pg.waitForTimeout(3500);
  await pg.evaluate(() => __game.loop.sleep());
}
for (let k = 0; k < +N; k++) {
  const st = await pg.evaluate(([gap, hpCap]) => {
    const s = sc().s; const p = s.units[0];
    if (hpCap) { const n = Math.round(gap * 4); for (let i = 0; i < n; i++) { p.hp = Math.min(p.hp, Math.round(p.maxHp * hpCap)); ff(0.25); } } else ff(gap);
    sc().flashUntil?.clear?.();
    return { t: Math.round(s.tick / 30), hp: Math.round((p.hp / p.maxHp) * 100), kills: s.units.filter((u) => u.side === 'enemy' && u.dead).length, lv: p.level ?? s.level, bless: s.bless?.taken?.length ?? 0, revives: s.revives ?? 0 };
  }, [+GAP, hpCap]);
  console.log(k, JSON.stringify(st));
  if (process.env.EVAL) console.log('  eval', JSON.stringify(await pg.evaluate(process.env.EVAL)));
  await pg.screenshot({ path: `screenshots/play-${tag}-${si ? stages[si] + '-' : ''}${k}.png`, timeout: 90000 });
}
}
await b.close();
