// 模擬「只管走位」的真人玩一段，定時截整個畫面（第 168 輪寫過、沒進 git；第 170 輪重寫進來）。先 `npx vite --port 5173`。
// 用法：node scripts/play.mjs sword|bow|staff [地圖] [tag] [張數] [每張間隔秒] [W H]
// 主角：走向最近的活怪、進射程就停（技能五欄自動）、血量 35% 以下喝水、祝福一律選第一張；不閃避。
// 快轉時不畫圖（只有截圖前三幀才畫），所以很快；主角直線走向怪，會卡在樹牆後面，拍前幾分鐘夠用。
// 環境變數 NIGHT=1、LOWFX=1、LEVEL=n（存檔等級）、HP=0.3（把血量上限壓成幾成，看低血畫面）。輸出 screenshots/play-<tag>-<n>.png
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
  if (stage !== 'mistwood') localStorage.setItem('jg_rt_' + stage, JSON.stringify({ bossKills: 1, ...(night ? { night: true } : {}) }));
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
  window.T = 100000; const rn = Date.now.bind(Date); window.off = 0; Date.now = () => rn() + off;
  const render = __game.scene.render ? null : null; void render;
  const R = __game.renderer; const pre = R.preRender.bind(R); const rr = R.render.bind(R); const post = R.postRender.bind(R);
  window.draw = true;
  R.preRender = () => { if (draw) pre(); }; R.render = (...a) => { if (draw) rr(...a); }; R.postRender = () => { if (draw) post(); };
  window.ff = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { draw = i >= n - 3; T += 16.667; off += 16.667; __game.step(T, 16.667); } draw = true; };
  __game.loop.sleep();
}, [weapon]);
const hpCap = +(process.env.HP || 0);
for (let k = 0; k < +N; k++) {
  const st = await pg.evaluate(([gap, hpCap]) => {
    const s = sc().s; const p = s.units[0];
    if (hpCap) { const n = Math.round(gap * 4); for (let i = 0; i < n; i++) { p.hp = Math.min(p.hp, Math.round(p.maxHp * hpCap)); ff(0.25); } } else ff(gap);
    sc().flashUntil?.clear?.();
    return { t: Math.round(s.tick / 30), hp: Math.round((p.hp / p.maxHp) * 100), kills: s.units.filter((u) => u.side === 'enemy' && u.dead).length, lv: p.level ?? s.level, bless: s.bless?.taken?.length ?? 0, revives: s.revives ?? 0 };
  }, [+GAP, hpCap]);
  console.log(k, JSON.stringify(st));
  await pg.screenshot({ path: `screenshots/play-${tag}-${k}.png`, timeout: 90000 });
}
await b.close();
