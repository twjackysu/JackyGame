// 主角邊走邊打／特殊狀態下的分件立繪（第 194 輪）：朝最近的怪走，挑「正在出手」「被打白閃」「翻滾」「倒下」的幀裁主角。先 `npx vite --port 5173`。
// 用法：node scripts/shot-walk-fight.mjs sword|bow|staff [地圖] [tag]   環境變數 LOWFX=1、OFF=1、W=390
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [weapon = 'sword', stage = 'mistwood', tag = 'wf'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: +(process.env.W || 390), height: 844 }, deviceScaleFactor: 3 });
pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
await pg.goto('http://localhost:5173/?debug');
await pg.evaluate(([w, low]) => {
  localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', w);
  localStorage.setItem('jg_rt_hint_seen', '1'); localStorage.setItem('jg_tip_seen', '1');
  localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: 5, bossKills: 1 }));
  if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
}, [weapon, !!process.env.LOWFX]);
await pg.reload();
await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
await pg.evaluate((stage) => __game.scene.getScene('Title').scene.start('RtBattle', { stage, bot: '' }), stage);
await pg.waitForTimeout(3500);
await pg.evaluate(async (off) => {
  window.sc = () => __game.scene.getScene('RtBattle');
  if (off) { const m = await import('/src/game/fx/heroWalk.ts'); m.HERO_WALK.on = false; sc().scene.restart({ stage: sc().stageId ?? 'mistwood', bot: '' }); }
}, !!process.env.OFF);
await pg.waitForTimeout(process.env.OFF ? 3000 : 200);
await pg.evaluate(() => {
  const sn = sc();
  window.cmd = 'chase';
  sn.commands = () => {
    const u = sn.s.units[0];
    if (cmd === 'dodge') { cmd = 'chase'; return [{ type: 'dodge', dx: 1000, dy: 0 }]; }
    let best = null, bd = 1e18;
    for (const e of sn.s.units) { if (e.side === 'player' || e.dead) continue; const d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2; if (d < bd) { bd = d; best = e; } }
    if (!best) return [];
    if (cmd === 'circle') return [{ type: 'move', dx: -(best.y - u.y), dy: best.x - u.x }];
    return [{ type: 'move', dx: best.x - u.x, dy: best.y - u.y }];
  };
  window.T = 100000; const t0 = Date.now(); window.off = 0; Date.now = () => t0 + off;
  window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
  // 一幀一幀跑到條件成立（最多 max 幀）
  window.until = (what, max) => {
    for (let i = 0; i < max; i++) {
      ff(1); const s = sc(); const u = s.s.units[0]; const a = u.action;
      if (what === 'attack' && a && a.kind === 'attack' && s.s.tick - a.start >= 4) return true;
      if (what === 'skill' && a && a.kind === 'skill' && s.s.tick - a.start >= 4) return true;
      if (what === 'hit' && (s.flashUntil.get(u.id) ?? 0) > s.time.now) return true;
      if (what === 'dodge' && a && a.kind === 'dodge' && s.s.tick - a.start >= 3) return true;
      if (what === 'dead' && u.dead) { ff(12); return true; }
    }
    return false;
  };
  __game.loop.sleep(); ff(30);
});
const shots = [];
const snap = async (name) => {
  const p = await pg.evaluate(() => { const s = sc(); const u = s.s.units[0]; const c = __game.canvas.getBoundingClientRect(); const sp = s.sprites.get(u.id); return { x: c.left + (sp.x / 720) * c.width, y: c.top + (sp.y / __game.config.height) * c.height }; });
  const f = `screenshots/${tag}-${name}.png`;
  await pg.screenshot({ path: f, clip: { x: Math.max(0, p.x - 55), y: p.y - 80, width: 110, height: 104 } });
  shots.push(f);
};
const plan = (process.env.PLAN || 'attack,attack,circle:attack,circle:skill,hit,dodge,dead').split(',');
let k = 0;
for (const step of plan) {
  const [a, bq] = step.includes(':') ? step.split(':') : ['chase', step];
  const ok = await pg.evaluate(([mode, what]) => { cmd = what === 'dodge' ? 'dodge' : mode; if (what === 'dead') { const u = sc().s.units[0]; u.hp = 1; } return until(what, 500); }, [a, bq]);
  console.log(step, ok);
  await snap(`${k++}-${bq}`);
  await pg.evaluate(() => ff(9));
}
console.log(shots.join(' '));
await b.close();
