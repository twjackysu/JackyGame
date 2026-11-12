// 技能特效對照表（第 166 輪）。先 `npx vite --port 5173`。
// 用法：node scripts/shot-skills.mjs sword|bow|staff [變化：''｜a｜b] [tag] [W H]
// 每招：三隻狼釘在主角右邊 → 送出技能 → 在第一段命中的 tick 凍結 → 命中後第 2／6／12 幀各截一張（主角周圍 390×330）。
// 輸出 screenshots/sk-<tag>-<weapon><變化>-<欄位>-<n>.png；用 PIL 拼成對照表。環境變數 ONLY=heavy_slash,charge 只拍某幾招；NIGHT=1 深夜；LOWFX=1 省電畫質；FRAMES=2,6,12（命中後第幾幀，多段招要看後面幾段時用）；DIST=怪離主角幾格（預設劍 1.6、其他 3.5）；STAGE=emberrift（在哪張圖拍，預設霧語森林；第 182 輪：深色地面上才看得出範圍色塊像不像框）。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('screenshots', { recursive: true });
const [weapon = 'sword', variant = '', tag = 'new', W = '390', H = '844'] = process.argv.slice(2);
const IDS = (process.env.ONLY || 'heavy_slash,whirlwind,charge,parry,blade_storm').split(',');
const DIST = +(process.env.DIST || (weapon === 'sword' ? 1.6 : 3.5));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const id of IDS) {
  const pg = await b.newPage({ viewport: { width: +W, height: +H } });
  pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await pg.goto('http://localhost:5173/?debug');
  await pg.evaluate(([w, night, low]) => {
    localStorage.clear(); localStorage.setItem('jg_prologue_seen', '1'); localStorage.setItem('jg_weapon', w);
    if (night) localStorage.setItem('jg_rt_mistwood', JSON.stringify({ level: 20, night: true, furyKills: 1, bossKills: 3 }));
    if (low) localStorage.setItem('jackygame.settings', JSON.stringify({ lowFx: true }));
  }, [weapon, !!process.env.NIGHT, !!process.env.LOWFX]);
  await pg.reload();
  await pg.waitForFunction(() => window.__game?.scene?.getScene('Title')?.sys?.isActive(), null, { timeout: 60000 });
  await pg.evaluate((st) => __game.scene.getScene('Title').scene.start('RtBattle', { stage: st, bot: '' }), process.env.STAGE || 'mistwood');
  await pg.waitForTimeout(3500);
  const info = await pg.evaluate(async ([id, variant, dist]) => {
    window.sc = () => __game.scene.getScene('RtBattle');
    const sn = sc(); const s = sn.s; const p = s.units[0];
    s.autoSkills = [];
    if (variant) s.skillVariants = [id + (variant === 'b' ? ':b' : '')];
    p.mp = 9999; p.hp = p.maxHp; for (const k of Object.keys(p.ready || {})) p.ready[k] = 0;
    // 三隻怪釘在右邊（排成一小排），血量加大、不讓牠們動
    const d2 = (u) => (u.x - p.x) ** 2 + (u.y - p.y) ** 2;
    const foes = s.units.filter((u) => u.side === 'enemy' && !u.dead && u.tier !== 'boss').sort((a, b) => d2(a) - d2(b)).slice(0, 3);
    const spots = [[dist, 0], [dist + 0.9, -0.8], [dist + 0.9, 0.8]];
    const home = { x: foes[0].x - dist * 100, y: foes[0].y };
    window.pin = () => { p.x = home.x; p.y = home.y; foes.forEach((u, i) => { u.x = home.x + spots[i][0] * 100; u.y = home.y + spots[i][1] * 100; u.action = null; u.mode = 'combat'; u.engagedTick = s.tick; u.nextAttackTick = s.tick + 999; u.hp = Math.max(u.hp, 99999); u.maxHp = Math.max(u.maxHp, 99999); if ('homeX' in u) { u.homeX = u.x; u.homeY = u.y; } }); p.targetId = foes[0]?.id; p.facingX = 1; p.facingY = 0; };
    for (const u of s.units) if (u.side === 'enemy' && !foes.includes(u)) { u.x = home.x - 6000; u.y = home.y - 6000; u.homeX = u.x; u.homeY = u.y; }
    pin(); sn.events.on('postupdate', pin);
    window.T = 100000; const rn = Date.now.bind(Date); window.off = 0;
    // 第 178 輪：Phaser 的 tween 用 Date.now 算自己的時間；以前這裡是「真實時間＋位移」，截圖花的真實時間會讓 tween 特效（閃電、光環）一兩幀就淡光 → 改成只走遊戲時間
    const t0real = rn(); Date.now = () => t0real + off;
    window.ff = (n) => { for (let i = 0; i < n; i++) { T += 16.667; off += 16.667; __game.step(T, 16.667); } };
    __game.loop.sleep();
    ff(20); sn.flashUntil?.clear?.();
    window.__rt.send({ type: 'skill', id });
    // 推到第一個傷害事件出現（最多 4 秒）
    let n = 0; const t0 = s.tick; let hitAt = -1;
    const seen = s.events.length;
    while (n < 240) { ff(1); n++; if (s.events.slice(seen).some((e) => e.type === 'damage' && e.src === p.id)) { hitAt = s.tick - t0; break; } }
    const cam = sn.cameras.main; const sx = (p.x / 100 * (sn.UNIT_PX || 0));
    return { hitAt, frames: n, casting: !!p.action, foes: foes.length, zoom: cam.zoom, evTypes: [...new Set(s.events.slice(seen).map((e) => e.type))] };
  }, [id, variant, DIST]);
  console.log(weapon + variant, id, JSON.stringify(info));
  let k = 0; let at = 0;
  for (const f of (process.env.FRAMES || '2,6,12').split(',').map(Number)) {
    await pg.evaluate((d) => ff(d), f - at); at = f;
    await pg.screenshot({ path: `screenshots/sk-${tag}-${weapon}${variant}-${id}-${k++}.png`, timeout: 90000, clip: { x: 0, y: Math.round(+H * 0.5 - 190), width: +W, height: 330 } });
  }
  await pg.close();
}
await b.close();
