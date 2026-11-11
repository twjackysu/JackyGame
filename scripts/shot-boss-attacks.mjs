// Boss 招式預告與命中的逐招截圖（第 167 輪）。先 `npx vite --port 5173`。
// 用法：node scripts/shot-boss-attacks.mjs 地圖 [tag] [W H]
// 每招：主角釘在 Boss 下方（DIST 格，預設照那招的 triggerRange）、只留那一招可用 → 預告出現後進度 35%／90%、命中後第 3／11 幀各截一張。
// 環境變數 ONLY=king_bite,king_quake 只拍某幾招；PHASE2=1 先把 Boss 打到二階段；FURY=1 暴怒；NIGHT=1 深夜；LOWFX=1 省電畫質；DIST=格數；FACE=down|up 主角面向（瞬移招落在主角背後：面向下＝牠落在北邊）。
// 輸出 screenshots/boss-<tag>-<地圖>-<招>-<n>.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [stage = 'mistwood', tag = 'new', W = '390', H = '844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const open = async () => {
  const pg = await b.newPage({ viewport: { width: +W, height: +H } });
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
  return pg;
};
let pg = await open();
const all = await pg.evaluate(() => {
  const s = __game.scene.getScene('RtBattle').s; const B = s.units.find((u) => u.tier === 'boss' && !u.dead);
  return B ? { def: B.defId, fury: !!B.fury } : null;
});
console.log('boss', JSON.stringify(all));
await pg.close();
const IDS = (process.env.ONLY || '').split(',').filter(Boolean);
if (!IDS.length) { console.log('給 ONLY=招式 id（見 src/core/battle/rt/data.ts）'); await b.close(); process.exit(0); }
for (const id of IDS) {
  pg = await open();
  const info = await pg.evaluate(async ([id, distEnv, phase2, face]) => {
    window.sc = () => __game.scene.getScene('RtBattle');
    const sn = sc(); const s = sn.s; const p = s.units[0];
    const B = s.units.find((u) => u.tier === 'boss' && !u.dead);
    if (!B) return { err: 'no boss' };
    s.autoSkills = [];
    const hx = B.homeX ?? B.x; const hy = B.homeY ?? B.y;
    window.dist = distEnv || 2;
    // 主角釘在 Boss 家的正下方、不出手不掉血；其他怪搬走
    for (const u of s.units) if (u.side === 'enemy' && u !== B) { u.dead = true; }
    window.pin = () => { if (face) { p.facingX = 0; p.facingY = face === 'down' ? 1000 : -1000; } p.x = hx; p.y = hy + dist * 100; p.hp = p.maxHp; p.nextAttackTick = s.tick + 999; p.targetId = null; B.hp = Math.max(B.hp, phase2 ? 1 : B.maxHp * 0.9); if (phase2 && B.hp > B.maxHp * 0.45) B.hp = Math.floor(B.maxHp * 0.45); if (!B.action) { B.x = hx; B.y = hy; } B.engagedTick = s.tick; if (B.mode !== 'combat') B.mode = 'combat'; };
    pin(); sn.events.on('postupdate', pin);
    window.T = 100000; const rn = Date.now.bind(Date); window.off = 0; Date.now = () => rn() + off;
    window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
    __game.loop.sleep();
    ff(phase2 ? 150 : 30); sn.flashUntil?.clear?.();
    // 只留這一招
    // 只留這一招：其他招的冷卻永遠沒好
    B.ready = new Proxy({}, { get: (_t, k) => (k === id ? 0 : 1e9), set: () => true });
    const only = () => { B.nextAttackTick = Math.min(B.nextAttackTick, s.tick); };
    window.only = only;
    let n = 0; let tg = null; const seen = s.events.length; const got = [];
    while (n < 900) {
      if (!B.action) only();
      ff(1); n++;
      tg = s.telegraphs.find((t) => t.ownerId === B.id && t.attackId === id);
      if (tg) break;
      for (const t of s.telegraphs) if (t.ownerId === B.id && !got.includes(t.attackId)) got.push(t.attackId);
    }
    if (!tg) return { err: 'no telegraph', got, mode: B.mode, phase: B.phase, d: Math.round(Math.hypot(B.x - p.x, B.y - p.y)) };
    window.tg = { start: tg.startTick, hit: tg.hitTick };
    return { frames: n, warn: tg.hitTick - tg.startTick, phase: B.phase, shape: tg.shape, blockable: tg.blockable, evTypes: [...new Set(s.events.slice(seen).map((e) => e.type))] };
  }, [id, +(process.env.DIST || 0), !!process.env.PHASE2, process.env.FACE || '']);
  console.log(stage, id, JSON.stringify(info));
  if (info.err) { await pg.close(); continue; }
  const shot = (k) => pg.screenshot({ path: `screenshots/boss-${tag}-${stage}-${id}-${k}.png`, timeout: 90000, clip: { x: 0, y: Math.round(+H * 0.5 - 300), width: +W, height: 560 } });
  // 推到某個 tick（tick 是 30/s，畫面是 60/s）
  const toTick = (t) => pg.evaluate((t) => { const s = sc().s; let n = 0; while (s.tick < t && n++ < 600) ff(1); return s.tick; }, t);
  const { start, hit } = await pg.evaluate(() => window.tg);
  await toTick(Math.round(start + (hit - start) * 0.35)); await shot(0);
  await toTick(Math.round(start + (hit - start) * 0.9)); await shot(1);
  await toTick(hit); await pg.evaluate(() => ff(3)); await shot(2);
  await pg.evaluate(() => ff(8)); await shot(3);
  await pg.close();
}
await b.close();
