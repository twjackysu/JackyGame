// 把某一種怪擺到主角旁邊拍：活著一張、打倒後第 3／9／20 幀各一張（第 173 輪；看新圖的大小、血條位置、死亡演出）。先 `npx vite --port 5173`。
// 用法：node scripts/shot-foe.mjs 地圖 怪id[,怪id…] [tag] [W H]　環境變數 NIGHT=1、LOWFX=1、FURY=1、SIDE=left（擺在主角左邊，看翻面）、DSF=2（照手機的像素密度截，立繪細節才看得準）。
// 輸出 screenshots/foe-<tag>-<怪id>-<n>.png（只截主角周圍）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [stage = 'starfall', ids = '', tag = 'new', W = '390', H = '844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const id of ids.split(',').filter(Boolean)) {
  const pg = await b.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DSF || 1) });
  pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await pg.goto('http://localhost:5173/?debug');
  await pg.evaluate(([stage, night, low, fury]) => {
    localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', 'sword');
    localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1');
    const base = { level: 16, bossKills: 3, furyKills: 1 };
    const flags = { ...(night ? { night: true } : {}), ...(fury ? { fury: true } : {}) };
    if (stage === 'mistwood') localStorage.setItem('jg_rt_mistwood', JSON.stringify({ ...base, ...flags }));
    else { localStorage.setItem('jg_rt_mistwood', JSON.stringify(base)); localStorage.setItem('jg_rt_' + stage, JSON.stringify({ bossKills: 3, furyKills: 1, ...flags })); }
    if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
  }, [stage, !!process.env.NIGHT, !!process.env.LOWFX, !!process.env.FURY]);
  await pg.reload();
  await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
  await pg.evaluate((stage) => __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }), stage);
  await pg.waitForTimeout(3500);
  const info = await pg.evaluate(([id, left]) => {
    window.sc = () => __game.scene.getScene('RtBattle');
    const sn = sc(); const s = sn.s; const p = s.units[0];
    const U = s.units.find((u) => u.side === 'enemy' && !u.dead && u.defId === id);
    if (!U) return { err: 'no ' + id, have: [...new Set(s.units.filter((u) => u.side === 'enemy').map((u) => u.defId))] };
    s.autoSkills = []; sn.commands = () => [];
    for (const u of s.units) if (u.side === 'enemy' && u !== U) u.dead = true;
    // 主角搬到怪的家旁邊（怪不動，才不會被拉回家）
    const hx = U.homeX ?? U.x; const hy = U.homeY ?? U.y;
    window.pin = () => { U.x = hx; U.y = hy; p.x = hx + (left ? 1 : -1) * (U.r + p.r + 40); p.y = hy; p.hp = p.maxHp; p.nextAttackTick = s.tick + 9999; U.nextAttackTick = s.tick + 9999; for (const k in U.ready) U.ready[k] = s.tick + 9999; };
    window.T = 100000; const rn = Date.now.bind(Date); window.off = 0; const t0real = rn(); Date.now = () => t0real + off; /* 只走遊戲時間：Phaser 的 tween 用 Date.now（第 178 輪） */
    window.ff = (frames) => { for (let i = 0; i < frames; i++) { if (!U.dead) pin(); T += 16.667; off += 16.667; __game.step(T, 16.667); if (sc().menu) { /* 抉擇面板 */ } } };
    window.U = U;
    __game.loop.sleep(); pin(); ff(50);
    return { id, r: U.r, tier: U.tier, hp: U.maxHp };
  }, [id, process.env.SIDE === 'left']);
  console.log(JSON.stringify(info));
  if (info.err) { await pg.close(); continue; }
  const clip = { x: 0, y: Math.round(+H * 0.18), width: +W, height: Math.round(+H * 0.5) };
  await pg.screenshot({ path: `screenshots/foe-${tag}-${id}-0.png`, clip, timeout: 120000 });
  await pg.evaluate(() => { const s = sc().s; const p = s.units[0]; U.hp = 1; p.nextAttackTick = 0; s.autoSkills = undefined; });
  let n = 1; let prev = 0;
  await pg.evaluate(() => { for (let i = 0; i < 240 && !U.dead; i++) { const p = sc().s.units[0]; p.x = U.x - (U.r + p.r + 40); p.y = U.y; U.hp = Math.min(U.hp, 1); T += 16.667; off += 16.667; __game.step(T, 16.667); } });
  for (const f of [3, 9, 20, 45]) { await pg.evaluate((k) => { for (let i = 0; i < k; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } }, f - prev); prev = f; await pg.screenshot({ path: `screenshots/foe-${tag}-${id}-${n++}.png`, clip, timeout: 120000 }); }
  await pg.close();
}
await b.close();
