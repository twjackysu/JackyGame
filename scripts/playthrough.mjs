#!/usr/bin/env node
// 自動通關機器人：在 headless Chromium 中從標題「新的旅程」玩過序章與第一章，直到 ch1_complete。
// 不靠座標點擊，而是透過 window.__game（需 ?debug）直接呼叫場景方法 / 對互動物件 emit('pointerdown')。
// Usage: node scripts/playthrough.mjs [url] [outDir] [timeoutMin]
//   url 預設 http://localhost:4180/?debug   outDir 預設 screenshots/playthrough   timeoutMin 預設 40
// 環境變數 GOAL=旗標名（預設 ch1_complete），例如 GOAL=ch2_complete 搭配 url ?debug&chapter=2&scene=Map。
// Exit: 0 = 達成目標旗標；1 = 卡住 / 逾時 / 失敗。
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4180/?debug';
const outDir = process.argv[3] ?? 'screenshots/playthrough';
const timeoutMin = Number(process.argv[4] ?? 40);
const GOAL = process.env.GOAL ?? 'ch1_complete'; // 目標旗標（第 2 章：GOAL=ch2_complete）
const STUCK_MS = 20_000; // 無進展多久視為卡住（截圖）
const ABORT_STUCK_MS = 150_000; // 連續卡住多久放棄
mkdirSync(outDir, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !existsSync(base)) return undefined;
  for (const dir of readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = path.join(base, dir, sub);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const t0 = Date.now();
const ts = () => `[${((Date.now() - t0) / 1000).toFixed(1).padStart(7)}s]`;
const log = (...a) => console.log(ts(), ...a);

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
});
const page = await context.newPage();
const problems = [];
let where = 'boot';
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    const p = `[console.${m.type()}] @${where}: ${m.text()}`;
    problems.push(p);
    log(p);
  }
});
page.on('pageerror', (e) => {
  const p = `[pageerror] @${where}: ${e.message}\n${e.stack ?? ''}`;
  problems.push(p);
  log(p);
});
page.on('crash', () => {
  problems.push('[crash] page crashed');
  log('[crash] page crashed');
});

// ---------------------------------------------------------------- 頁內機器人
function installBot() {
  const w = window;
  const walk = (list, out = []) => {
    for (const o of list) {
      out.push(o);
      if (o.list && Array.isArray(o.list)) walk(o.list, out);
    }
    return out;
  };
  const texts = (o) => walk(o?.list ?? []).filter((c) => c.type === 'Text').map((c) => c.text);
  const ev = { stopPropagation() {} };
  const fire = (obj) => {
    const p = w.__game.input.activePointer;
    obj.emit('pointerdown', p, 0, 0, ev);
  };
  const flagsFromSave = () => {
    try {
      const raw = localStorage.getItem('jackygame.save.v1.auto');
      return raw ? JSON.parse(raw).flags ?? {} : {};
    } catch {
      return {};
    }
  };
  w.__bot = {
    state() {
      const g = w.__game;
      const active = g.scene.getScenes(true).map((s) => s.sys.settings.key);
      const dlg = g.scene.getScene('Dialogue');
      // 已知 bug 的繞過（WORKAROUNDS=0 關閉）：DialogueScene.create() 每次都 events.on(WAKE)，監聽器累積
      // → 第二次以後的 wake 會呼叫 runner.resume 兩次並丟出 'no pending event'，讓 Phaser 的 rAF 迴圈整個停住。
      let fixed = 0;
      if (window.__botWorkarounds && dlg) {
        const ls = dlg.events.listeners('wake');
        for (let i = 0; i < ls.length - 1; i++) {
          dlg.events.off('wake', ls[i]);
          fixed++;
        }
      }
      let flags = flagsFromSave();
      let node = '';
      if (dlg && dlg.runner && dlg.runner.state) {
        flags = { ...flags, ...dlg.runner.state.flags };
        node = dlg.runner.currentNode;
      }
      return { active, flags, node, fps: Math.round(g.loop.actualFps), script: dlg?.scriptId, fixed };
    },
    tick(cfg) {
      const g = w.__game;
      const sm = g.scene;
      const active = sm.getScenes(true).map((s) => s.sys.settings.key);
      const acts = [];
      // 像真人一樣：畫面淡入/淡出中不操作（Phaser 的 fade 在另一個 fade 進行中時會被忽略）
      for (const k of active) {
        const cam = sm.getScene(k).cameras?.main;
        if (cam && (cam.fadeEffect.isRunning || cam.flashEffect.isRunning)) {
          return { scene: k, acts: [], wait: `camera ${cam.fadeEffect.isRunning ? 'fade' + (cam.fadeEffect.direction ? 'Out' : 'In') : 'flash'} running` };
        }
      }
      // ---------------------------------------------------------------- Battle
      if (active.includes('Battle')) {
        const b = sm.getScene('Battle');
        const bs = b.bs;
        if (!bs) return { scene: 'Battle', acts: [], wait: 'no state' };
        const hp = () => bs.heroes.map((h) => `${h.id}:${h.hp}/${h.maxHp}`).join(' ') + ' | ' + bs.enemies.map((e) => `${e.id}:${e.hp}/${e.maxHp}${e.downed ? 'x' : ''}`).join(' ');
        if (b.mode === 'command') {
          const tgt = Math.max(0, bs.enemies.findIndex((e) => !e.downed));
          b.target = tgt;
          // 低血量時用回復藥（HP 最低者 < 35%）
          const low = bs.heroes.some((h) => !h.downed && h.hp / h.maxHp < 0.35);
          const cur = bs.actor ? bs.heroes[bs.actor.index] : undefined;
          if (cfg.heal && low && (bs.items?.potion_s ?? 0) > 0) {
            void b.issue({ type: 'item', itemId: 'potion_s', target: b.lowestHero() });
            acts.push(`battle[${b.data0.encounter}] ${cur?.id} item potion_s  (${hp()})`);
          } else {
            void b.issue({ type: 'attack', target: tgt });
            acts.push(`battle[${b.data0.encounter}] r${bs.round ?? '?'} ${cur?.id ?? '?'} attack enemy#${tgt}  (${hp()})`);
          }
          return { scene: 'Battle', acts };
        }
        if (b.mode === 'panel') {
          b.closePanel();
          b.mode = 'command';
          return { scene: 'Battle', acts: ['closed panel'] };
        }
        if (b.mode === 'timing' && b.timing && !b.timing.done) {
          b.finishTiming(b.timing.start + 760);
          return { scene: 'Battle', acts: ['timing PERFECT'], quiet: true };
        }
        if (b.mode === 'defense' && b.defense && !b.defense.__bot) {
          const d = b.defense;
          d.__bot = true;
          d.taps.push(...d.impacts);
          d.swipes.push(...d.impacts);
          d.presses.push(...d.impacts.map((t) => ({ at: t - 10 })));
          return { scene: 'Battle', acts: [`defense ${d.tele} x${d.impacts.length} → perfect inputs`], quiet: true };
        }
        if (b.mode === 'end') {
          const btn = walk(b.sys.displayList.list).find((o) => o.type === 'Container' && o.depth === 970 && o.input && !o.__bot);
          if (btn) {
            btn.__bot = true;
            fire(btn);
            return { scene: 'Battle', acts: [`battle[${b.data0.encounter}] END ${bs.phase} (${hp()}) → ${texts(btn).join('')}`], result: bs.phase };
          }
        }
        return { scene: 'Battle', acts: [], wait: `mode=${b.mode} phase=${bs.phase}` };
      }
      // ---------------------------------------------------------------- Cards
      if (active.includes('Cards')) {
        const c = sm.getScene('Cards');
        const st = c.st;
        if (st && st.phase === 'ended') {
          const btn = walk(c.sys.displayList.list).find((o) => o.type === 'Container' && o.input && !o.__bot && texts(o).some((t) => t.includes('繼續') || t.includes('再來')));
          if (btn) {
            btn.__bot = true;
            fire(btn);
            return { scene: 'Cards', acts: [`cards[${c.matchId}] END winner=${st.winner} nightsWon=${JSON.stringify(st.sides.map((s) => s.nightsWon ?? s.wins))}`], result: st.winner === 0 ? 'win' : 'lose' };
          }
          return { scene: 'Cards', acts: [], wait: 'ended, no button yet' };
        }
        if (st && c.canAct()) {
          const me = st.sides[0];
          for (let i = 0; i < me.hand.length; i++) {
            const plays = c.playsFor(i);
            if (plays.length) {
              const a = plays[0];
              void c.act(a);
              return { scene: 'Cards', acts: [`cards[${c.matchId}] night${st.night} play ${me.hand[i]?.id} slot=${a.slot} target=${a.target}`] };
            }
          }
          void c.act({ type: 'pass' });
          return { scene: 'Cards', acts: [`cards[${c.matchId}] night${st.night} pass`] };
        }
        return { scene: 'Cards', acts: [], wait: `busy=${c.busy} phase=${st?.phase} current=${st?.current}` };
      }
      // ---------------------------------------------------------------- Dialogue
      if (active.includes('Dialogue')) {
        const d = sm.getScene('Dialogue');
        const top = d.sys.displayList.list;
        const overlay = top.filter((o) => o.type === 'Container' && o.depth === 300 && o.active).pop();
        if (overlay) {
          const tx = texts(overlay);
          if (tx.includes('為她取個名字')) {
            const row = overlay.list.find((o) => o.type === 'Container' && o.input && !o.__bot);
            if (row && !overlay.__bot) {
              overlay.__bot = true;
              row.__bot = true;
              fire(row);
              return { scene: 'Dialogue', acts: [`rename → ${texts(row).join('')}`] };
            }
            return { scene: 'Dialogue', acts: [], wait: 'rename pending' };
          }
          if (tx.includes('離開')) {
            const rows = overlay.list.filter((o) => o.type === 'Container' && o.input);
            if (!overlay.__bought && rows[0]) {
              overlay.__bought = true;
              fire(rows[0]);
              return { scene: 'Dialogue', acts: [`shop buy → ${texts(rows[0]).join(' ')}`] };
            }
            const leave = overlay.list.find((o) => o.type === 'Text' && o.text === '離開');
            if (leave && !leave.__bot) {
              leave.__bot = true;
              fire(leave);
              return { scene: 'Dialogue', acts: ['shop leave'] };
            }
            return { scene: 'Dialogue', acts: [], wait: 'shop pending' };
          }
          const dim = overlay.list.find((o) => o.type === 'Rectangle');
          if (dim && dim.listenerCount('pointerdown') > 0 && !dim.__bot) {
            dim.__bot = true;
            fire(dim);
            return { scene: 'Dialogue', acts: [`summary closed: ${tx.join(' / ')}`] };
          }
          return { scene: 'Dialogue', acts: [], wait: `overlay: ${tx.slice(0, 2).join(' / ')}` };
        }
        if (d.waiting === 'tap') {
          for (let k = 0; k < cfg.linesPerTick && d.waiting === 'tap'; k++) {
            const node = d.runner.currentNode;
            if (d.shown < d.fullText.length) d.finishTyping();
            acts.push(`say ${d.scriptId}/${node} ${d.nameText?.text || '-'}: ${d.fullText.replace(/\n/g, ' ').slice(0, 60)}`);
            d.onTap();
          }
          return { scene: 'Dialogue', acts, quietSay: true };
        }
        if (d.waiting === 'choice') {
          const r = d.runner;
          const opts = r.pendingChoice ?? [];
          const ui = top.filter((o) => o.type === 'Container' && o.depth === 200 && o.active && !o.__bot).pop();
          if (!ui) return { scene: 'Dialogue', acts: [], wait: 'choice ui missing' };
          const ok = (o) => !(o.check && 'codex' in o.check && r.chanceOf(o.check) <= 0);
          let idx = opts.findIndex((o) => ok(o) && (cfg.prefer ?? []).some((p) => o.text.includes(p)));
          if (idx < 0) idx = opts.findIndex(ok);
          if (idx < 0) idx = 0;
          const o = opts[idx];
          const row = ui.list[idx];
          ui.__bot = true;
          fire(row);
          const all = opts.map((x, i) => `${i === idx ? '>' : ' '}${x.text.replace(/\n/g, ' ')}${x.check ? ` {${JSON.stringify(x.check)} ${Math.round(r.chanceOf(x.check) * 100)}%}` : ''}`);
          return { scene: 'Dialogue', acts: [`CHOICE ${d.scriptId}/${r.currentNode}: ${all.join(' | ')}`], choice: o?.text };
        }
        return { scene: 'Dialogue', acts: [], wait: `waiting=${d.waiting} node=${d.runner?.currentNode}` };
      }
      // ---------------------------------------------------------------- Explore（自由探索，window.__explore 除錯 API）
      if (active.includes('Explore')) {
        const ex = window.__explore;
        if (!ex) return { scene: 'Explore', acts: [], wait: 'no __explore' };
        if (ex.busy()) return { scene: 'Explore', acts: [], wait: 'walking' };
        const obj = ex.objective();
        if (obj) {
          if (cfg.__exLast === obj && Date.now() - (cfg.__exAt ?? 0) < 8000) return { scene: 'Explore', acts: [], wait: `heading to ${obj}` };
          cfg.__exLast = obj;
          cfg.__exAt = Date.now();
          return { scene: 'Explore', acts: [ex.goto(obj) ? `explore goto ${obj}` : `explore goto ${obj} FAILED`] };
        }
        sm.getScene('Explore').leaveToMap();
        return { scene: 'Explore', acts: ['explore → world map'] };
      }
      // ---------------------------------------------------------------- Map
      if (active.includes('Map')) {
        const m = sm.getScene('Map');
        if (m.busy) return { scene: 'Map', acts: [], wait: 'travelling' };
        // EXPLORE=1：第 1 章出鎮前改走可自由探索的灰燈鎮
        if (cfg.explore && m.map?.id === 'ch1' && !g.registry.get('__botExplored') && !flagsFromSave()['ch1_left_town']) {
          g.registry.set('__botExplored', true);
          m.busy = true;
          m.scene.start('Explore', { area: 'greylamp' });
          return { scene: 'Map', acts: ['map → explore greylamp'] };
        }
        if (m.bubble && !m.bubble.__bot) {
          const b = m.bubble;
          b.__bot = true;
          const label = texts(b)[0];
          fire(b);
          return { scene: 'Map', acts: [`map go → ${label}`] };
        }
        if (m.bubble) return { scene: 'Map', acts: [], wait: 'bubble fired' };
        const nodes = m.sys.displayList.list.filter((o) => o.type === 'Container' && o.depth === 20);
        const info = nodes.map((n) => {
          const t = texts(n);
          return { n, title: t.find((x) => x !== '！') ?? '?', bang: t.includes('！'), open: n.list.some((c) => c.type === 'Image') };
        });
        const skip = cfg.skipTitles ?? [];
        let pick = info.find((x) => x.open && (cfg.extraOnce ?? []).includes(x.title)) ?? info.find((x) => x.bang && !skip.includes(x.title)) ?? info.find((x) => x.bang);
        if (!pick) return { scene: 'Map', acts: [], wait: 'no ! node', mapNodes: info.map((x) => `${x.title}${x.open ? '(open)' : ''}`) };
        fire(pick.n);
        return { scene: 'Map', acts: [`map select ${pick.title}`], mapPick: pick.title, mapNodes: info.map((x) => `${x.title}${x.bang ? '!' : x.open ? '(open)' : ''}`) };
      }
      // ---------------------------------------------------------------- Title
      if (active.includes('Title')) {
        const t = sm.getScene('Title');
        if (t.busy) return { scene: 'Title', acts: [], wait: 'fading' };
        if (!t.menu) {
          t.onTap(g.input.activePointer, Math.random);
          return { scene: 'Title', acts: ['title tap → menu'] };
        }
        const btn = t.menu.list.find((c) => texts(c).includes('新的旅程'));
        if (btn) {
          fire(btn);
          return { scene: 'Title', acts: ['title → 新的旅程'] };
        }
        return { scene: 'Title', acts: [], wait: 'menu w/o new game' };
      }
      return { scene: active.join(',') || 'none', acts: [], wait: 'no handled scene' };
    },
  };
}

// ---------------------------------------------------------------- 主迴圈
async function snap(file) {
  try {
    await page.evaluate(() => (window.__botRender = true));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: file });
  } catch {
    /* ignore */
  } finally {
    await page.evaluate(() => (window.__botRender = false)).catch(() => {});
  }
}
let exitCode = 1;
let afterGoalScene = '';
let steps = 0;
let shot = 0;
const visits = {};
const battleResults = [];
const cardResults = [];
const choices = [];
const stuckPoints = [];
const sayCount = { n: 0 };
try {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60_000 });
  await page.evaluate(installBot);
  await page.evaluate((on) => (window.__botWorkarounds = on), process.env.WORKAROUNDS !== '0');
  // swiftshader 渲染一幀要 ~2 秒；平時跳過 scene.render 讓邏輯以 ~60fps 跑，只在截圖時開啟渲染
  if (!process.env.RENDER) {
    await page.evaluate(() => {
      const g = window.__game;
      const orig = g.scene.render.bind(g.scene);
      g.scene.render = (r) => {
        if (window.__botRender) orig(r);
      };
    });
  }
  log('loaded; bot installed');
  let lastProgress = Date.now();
  let stuckShotAt = 0;
  let lastWait = '';
  let lastFlags = {};
  const deadline = t0 + timeoutMin * 60_000;
  // extraOnce：沒有「！」的支線地點各去一次（雜貨店商店、倒木寶箱）；prefer：優先選的選項（觸發改名介面）
  const cfg = { explore: process.env.EXPLORE === '1', linesPerTick: 25, heal: true, skipTitles: [], extraOnce: ['雜貨店', '倒木下的寶箱'], prefer: ['自己取個名字'] };
  let goalAt = null;
  let lastMapPick = '';
  let samePickCount = 0;
  while (Date.now() < deadline) {
    let st;
    try {
      st = await page.evaluate(() => window.__bot.state());
    } catch (e) {
      log('state eval failed:', e.message);
      await page.waitForTimeout(1000);
      continue;
    }
    if (st.fixed) {
      const msg = `workaround: removed ${st.fixed} stale DialogueScene WAKE listener(s) (would throw 'no pending event' and freeze the game loop)`;
      if (!stuckPoints.includes(msg)) {
        stuckPoints.push(msg);
        log(msg);
      }
    }
    where = `${st.active.join('+')}${st.node ? ` ${st.script}/${st.node}` : ''}`;
    // 旗標變化
    const newFlags = Object.keys(st.flags).filter((k) => !k.startsWith('__') && JSON.stringify(st.flags[k]) !== JSON.stringify(lastFlags[k]));
    if (newFlags.length) {
      log(`FLAGS +${newFlags.map((k) => `${k}=${JSON.stringify(st.flags[k])}`).join(' ')}`);
      lastFlags = { ...st.flags };
      lastProgress = Date.now();
    }
    if (st.flags[GOAL]) {
      // 達成後再等場景收尾，確認回到地圖（不是卡在對話或被踢回標題）
      goalAt ??= Date.now();
      const settled = !st.active.includes('Dialogue') && !st.active.includes('Battle') && !st.active.includes('Cards');
      if (settled || Date.now() - goalAt > 90_000) {
        log(`*** ${GOAL} reached; now in ${st.active.join('+')} ***`);
        afterGoalScene = st.active.join('+');
        exitCode = process.env.EXPECT_AFTER && !st.active.includes(process.env.EXPECT_AFTER) ? 1 : 0;
        break;
      }
    }
    let r;
    try {
      r = await page.evaluate((c) => window.__bot.tick(c), cfg);
    } catch (e) {
      log('tick eval failed:', e.message);
      problems.push(`[bot] tick threw @${where}: ${e.message}`);
      await page.waitForTimeout(1000);
      continue;
    }
    if (r.acts.length) {
      steps += r.acts.length;
      lastProgress = Date.now();
      lastWait = '';
      for (const a of r.acts) {
        if (a.startsWith('say ')) {
          sayCount.n++;
          if (process.env.VERBOSE) log(a);
        } else if (!r.quiet || process.env.VERBOSE) log(a);
      }
      if (r.choice) choices.push(r.acts[0]);
      if (r.result && r.scene === 'Battle') battleResults.push(r.acts[0]);
      if (r.result && r.scene === 'Cards') cardResults.push(r.acts[0]);
      if (r.mapPick) {
        visits[r.mapPick] = (visits[r.mapPick] ?? 0) + 1;
        cfg.extraOnce = cfg.extraOnce.filter((t) => t !== r.mapPick);
        if (r.mapPick === lastMapPick) samePickCount++;
        else samePickCount = 0;
        lastMapPick = r.mapPick;
        log(`  map nodes: ${r.mapNodes.join(', ')}`);
        if (samePickCount >= 3) {
          const msg = `map loop: "${r.mapPick}" picked ${samePickCount + 1}x in a row without its ! clearing (flags: ${Object.keys(st.flags).filter((k) => !k.startsWith('__')).join(',')})`;
          log('STUCK?', msg);
          stuckPoints.push(msg);
          await snap(path.join(outDir, `stuck-${++shot}.png`));
          cfg.skipTitles = [r.mapPick];
          if (samePickCount >= 6) throw new Error(msg);
        }
      }
    } else {
      if (r.wait !== lastWait) {
        if (process.env.VERBOSE) log(`  (wait ${r.scene}: ${r.wait})`);
        lastWait = r.wait;
      }
      if (r.wait === 'no ! node') {
        const msg = `map has no "！" node but ${GOAL} unset; nodes: ${r.mapNodes.join(', ')}`;
        stuckPoints.push(msg);
        log('STUCK', msg);
        await snap(path.join(outDir, `stuck-${++shot}.png`));
        throw new Error(msg);
      }
      const idle = Date.now() - lastProgress;
      if (idle > STUCK_MS && Date.now() - stuckShotAt > STUCK_MS) {
        stuckShotAt = Date.now();
        const file = path.join(outDir, `stuck-${++shot}.png`);
        await snap(file);
        const msg = `no progress for ${(idle / 1000).toFixed(0)}s @${where}: ${r.scene} ${r.wait} (fps=${st.fps})`;
        log('STUCK', msg, '→', file);
        stuckPoints.push(msg);
      }
      if (idle > ABORT_STUCK_MS) throw new Error(`aborting: stuck ${idle / 1000}s @${where}: ${r.wait}`);
    }
    await page.waitForTimeout(r.acts.length ? 50 : 250);
  }
  if (exitCode !== 0) log(`TIMEOUT after ${timeoutMin} min @${where}`);
} catch (e) {
  log('FAILED:', e.message);
  await snap(path.join(outDir, `fail.png`));
}
await snap(path.join(outDir, `final.png`));
const summary = {
  goal: GOAL,
  reached: exitCode === 0,
  afterGoalScene,
  elapsedSec: Math.round((Date.now() - t0) / 1000),
  steps,
  linesRead: sayCount.n,
  visits,
  battleResults,
  cardResults,
  choices,
  stuckPoints,
  problems,
};
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
log('SUMMARY', JSON.stringify({ ...summary, choices: choices.length }, null, 2));
await browser.close();
process.exit(exitCode);
