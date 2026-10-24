// 即時戰鬥核心（D-063 P1／P2）：確定性、公式、冷卻、閃避、預告、格擋、Boss 階段、模擬器指標。
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addStatus, computeDamage, createBattle, dist, enemiesOf, inShape, playerOf, stateHash, step } from '../src/core/battle/rt/engine';
import { cellIndex, clearLine, findPath, gridOf } from '../src/core/battle/rt/path';
import { BOT_PROFILES, IdleController, PlayerBot, ScriptedTestController, batch, pullRisk, safestPull, simulateBattle } from '../src/core/battle/rt/sim';
import { ENEMIES, SKILLS, STAGES } from '../src/core/battle/rt/data';
import { sec, u, type Unit } from '../src/core/battle/rt/types';

const expert = () => new PlayerBot(BOT_PROFILES.expert, 'expert');

describe('確定性', () => {
  it('同一場戰鬥跑 1,000 次結果完全一致（stateHash）', () => {
    const first = simulateBattle({ stageId: 'wolf_den', seed: 42 }, expert());
    for (let i = 0; i < 1000; i++) {
      const r = simulateBattle({ stageId: 'wolf_den', seed: 42 }, expert());
      expect(r.stateHash).toBe(first.stateHash);
      expect(r.durationTicks).toBe(first.durationTicks);
    }
  }, 120000);

  it('Boss 戰也可重現；輸入紀錄重播得到同樣結果', () => {
    const a = simulateBattle({ stageId: 'wolf_king', seed: 7 }, expert());
    const b = simulateBattle({ stageId: 'wolf_king', seed: 7 }, expert());
    expect(b.stateHash).toBe(a.stateHash);
    // 記下 Bot 的輸入，再用 ScriptedTestController 重播
    const s = createBattle({ stageId: 'wolf_king', seed: 7 });
    const bot = expert();
    const log: Record<number, ReturnType<typeof bot.decide>> = {};
    while (s.outcome === 'running') {
      const c = bot.decide(s);
      if (c.length) log[s.tick + 1] = c;
      step(s, c);
    }
    expect(simulateBattle({ stageId: 'wolf_king', seed: 7 }, new ScriptedTestController(log)).stateHash).toBe(a.stateHash);
  }, 60000);

  it('rt 核心不用 Math.random、不依賴 Phaser、技能不寫 switch(skillId)', () => {
    const dir = 'src/core/battle/rt';
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      const src = readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(src).not.toMatch(/Math\.random/);
      expect(src).not.toMatch(/from 'phaser'/);
      expect(src).not.toMatch(/switch\s*\(\s*(skillId|sk\.id|a\.id|id)\s*\)/);
    }
  });
});

describe('傷害公式（design/18 §1.5）', () => {
  it('單一加算池封頂 +150%、防禦倍率、暴擊乘區', () => {
    expect(computeDamage(100, 100, 0, 0, 1)).toBe(100);
    expect(computeDamage(100, 100, 0.3, 0, 1)).toBe(130);
    expect(computeDamage(100, 100, 5, 0, 1)).toBe(250); // 封頂
    expect(computeDamage(100, 100, 0, 100, 1)).toBe(50);
    expect(computeDamage(100, 180, 0, 0, 1.5)).toBe(270);
    expect(computeDamage(1, 1, 0, 999, 1)).toBe(1); // 至少 1
  });
});

describe('判定形狀', () => {
  it('扇形、直線、環形', () => {
    const s = { type: 'sector', r: u(2), deg: 90 } as const;
    expect(inShape(s, 0, 0, 0, 1000, 0, u(1.5), 0)).toBe(true);
    expect(inShape(s, 0, 0, 0, 1000, 0, -u(1.5), 0)).toBe(false);
    const l = { type: 'line', len: u(4), width: u(1) } as const;
    expect(inShape(l, 0, 0, 1000, 0, u(3), u(0.4), 0)).toBe(true);
    expect(inShape(l, 0, 0, 1000, 0, u(3), u(1), 0)).toBe(false);
    const r = { type: 'ring', rIn: u(2), rOut: u(4) } as const;
    expect(inShape(r, 0, 0, 0, 1000, u(3), 0, 0)).toBe(true);
    expect(inShape(r, 0, 0, 0, 1000, u(1), 0, u(0.4))).toBe(false); // 貼近中心安全
  });
});

describe('技能與閃避', () => {
  it('冷卻從施放開始計；施放中不能再放別的主動技能', () => {
    const s = createBattle({ stageId: 'forest_entry', seed: 1 });
    step(s, [{ type: 'skill', id: 'heavy_slash' }]);
    const p = playerOf(s);
    expect(p.ready['heavy_slash']).toBe(1 + SKILLS.heavy_slash!.cooldownTicks);
    step(s, [{ type: 'skill', id: 'whirlwind' }]);
    expect(p.ready['whirlwind']).toBeUndefined();
  });

  it('閃避：無敵期間不受傷（事件記為 dodged），冷卻 5 秒', () => {
    const s = createBattle({ stageId: 'forest_entry', seed: 1 });
    const p = playerOf(s);
    step(s, [{ type: 'dodge', dx: 1, dy: 0 }]);
    expect(p.invulnUntil).toBeGreaterThan(s.tick);
    expect(p.ready['dodge']).toBe(1 + sec(5));
    const x0 = p.x;
    for (let i = 0; i < 9; i++) step(s);
    expect(p.x - x0).toBeGreaterThan(u(2));
  });

  it('敵人預告出現後位置固定；格擋反擊在窗口內擋下可格擋攻擊並反擊', () => {
    const s = createBattle({ stageId: 'forest_entry', seed: 3 });
    let t0;
    for (let i = 0; i < 600 && !t0; i++) {
      step(s);
      t0 = s.telegraphs[0];
    }
    expect(t0).toBeDefined();
    const snap = { ...t0! };
    const p = playerOf(s);
    // 等到命中前 3 tick 才格擋
    while (s.tick < t0!.hitTick - 3) {
      step(s);
      expect(s.telegraphs.find((t) => t.hitTick === snap.hitTick && t.ownerId === snap.ownerId)?.ox ?? snap.ox).toBe(snap.ox);
    }
    // 讓預告一定打得到：把玩家移到預告原點前方
    p.x = snap.ox + Math.round((snap.dirX / 1000) * u(0.8));
    p.y = snap.oy + Math.round((snap.dirY / 1000) * u(0.8));
    step(s, [{ type: 'skill', id: 'parry' }]);
    while (s.tick < snap.hitTick) step(s);
    const blk = s.events.find((e) => e.type === 'block');
    expect(blk).toBeDefined();
    const taken = s.events.filter((e) => e.type === 'damage' && e.dst === p.id && e.tick === snap.hitTick);
    const full = computeDamage(ENEMIES.wolf!.atk, 100, 0, p.def, 1);
    expect(taken.length).toBe(1);
    expect(taken[0]!.type === 'damage' && taken[0]!.amount).toBeLessThan(full);
    expect(s.events.some((e) => e.type === 'damage' && e.origin === 'counter')).toBe(true);
  });
});

describe('Boss：霧角狼王', () => {
  it('HP 50% 進第二階段並召喚小狼', () => {
    const r = createBattle({ stageId: 'wolf_king', seed: 5 });
    const king = enemiesOf(r)[0]!;
    king.hp = Math.floor(king.maxHp / 2);
    for (let i = 0; i < sec(5); i++) step(r);
    expect(king.phase).toBe(2);
    expect(r.events.some((e) => e.type === 'summon')).toBe(true);
  });
});

describe('模擬器指標（第一版基準；之後校準時更新）', () => {
  it('森林入口：任何 Bot 都能過；熟練 Bot 打狼王勝率 ≥ 90%、P50 在 60～120 秒；只放著不操作打不過狼王', () => {
    expect(batch('forest_entry', () => new IdleController(), 20).winRate).toBe(100);
    const k = batch('wolf_king', expert, 40);
    expect(k.winRate).toBeGreaterThanOrEqual(90);
    expect(k.durationSec.p50).toBeGreaterThanOrEqual(60);
    expect(k.durationSec.p50).toBeLessThanOrEqual(120);
    expect(batch('wolf_king', () => new IdleController(), 10).winRate).toBe(0);
  }, 60000);
});

describe('狀態（秒計，持續傷害每 30 ticks）', () => {
  it('燃燒疊到 3 層、每秒結算；冰凍對 Boss 變緩速；護盾先吸收且總量 ≤ 最大 HP 50%', () => {
    const s = createBattle({ stageId: 'wolf_king', seed: 1 });
    const p = playerOf(s);
    const king = enemiesOf(s)[0]!;
    for (let i = 0; i < 5; i++) addStatus(s, king, { id: 'burn', ticks: sec(5), powerPct: 10 }, p);
    const burn = king.statuses.find((x) => x.id === 'burn')!;
    expect(burn.stacks).toBe(3);
    const hp0 = king.hp;
    p.x = 0; // 讓雙方碰不到，只看持續傷害
    p.y = 0;
    king.x = s.arena.w - king.r;
    king.y = s.arena.h - king.r;
    king.nextAttackTick = 1e9;
    for (let i = 0; i < sec(1); i++) step(s);
    const dots = s.events.filter((e) => e.type === 'damage' && e.origin === 'dot');
    expect(dots.length).toBe(1);
    expect(hp0 - king.hp).toBe(burn.value * 3);
    addStatus(s, king, { id: 'freeze', ticks: sec(2) });
    expect(king.statuses.some((x) => x.id === 'freeze')).toBe(false);
    expect(king.statuses.some((x) => x.id === 'slow')).toBe(true);
    addStatus(s, p, { id: 'shield', ticks: sec(8), powerPct: 100000 }, p);
    expect(p.statuses.find((x) => x.id === 'shield')!.value).toBe(Math.floor(p.maxHp / 2));
  });
});

describe('五個原型關卡', () => {
  it('熟練 Bot 每一關都能過（刷怪關除外）', () => {
    for (const st of Object.values(STAGES)) if (!st.spawnGroups?.length) expect(batch(st.id, expert, 5).winRate, st.id).toBe(100);
  }, 60000);

  it('營火空地（刷怪關）：5 分鐘到才結束；熟練 Bot 持續擊殺、倒下會在營火醒來、可重現', () => {
    const a = simulateBattle({ stageId: 'camp_clearing', seed: 1 }, expert());
    const b = simulateBattle({ stageId: 'camp_clearing', seed: 1 }, expert());
    expect(a.outcome).toBe('timeout');
    expect(a.durationTicks).toBe(sec(300));
    expect(a.kills).toBeGreaterThanOrEqual(25);
    expect(b.stateHash).toBe(a.stateHash);
  }, 60000);
});

describe('大招與 MP（D-065 ②、D-068）', () => {
  it('開場 MP 0、上限 100；MP 不夠不能放大招；造成傷害、受傷、格擋成功會回 MP', () => {
    const s = createBattle({ stageId: 'forest_entry', seed: 3 });
    const p = playerOf(s);
    expect(p.mp).toBe(0);
    step(s, [{ type: 'skill', id: 'blade_storm' }]);
    expect(p.action?.id).not.toBe('blade_storm');
    expect(p.ready['blade_storm']).toBeUndefined();
    // 打一陣子：MP 只增不超過上限
    const bot = expert();
    let maxMp = 0;
    for (let i = 0; i < sec(20) && s.outcome === 'running'; i++) {
      step(s, bot.decide(s));
      maxMp = Math.max(maxMp, p.mp);
    }
    expect(maxMp).toBeGreaterThan(0);
    expect(maxMp).toBeLessThanOrEqual(100);
    const dealt = s.events.filter((e) => e.type === 'damage' && e.src === p.id && e.origin !== 'dot').length;
    const hurt = s.events.filter((e) => e.type === 'damage' && e.dst === p.id && e.amount > (e.absorbed ?? 0)).length;
    const blocks = s.events.filter((e) => e.type === 'block').length;
    expect(p.mp).toBe(Math.min(100, dealt + hurt * 2 + blocks * 5));
  });

  it('MP 夠就能放：扣 40 MP、冷卻 45 秒、8 段＋終結一擊、施放中可以慢慢走', () => {
    const s = createBattle({ stageId: 'wolf_king', seed: 1 });
    const p = playerOf(s);
    p.mp = 100;
    const boss = enemiesOf(s)[0]!;
    p.x = boss.x;
    p.y = boss.y + u(1.5);
    step(s, [{ type: 'skill', id: 'blade_storm' }]);
    expect(p.action?.id).toBe('blade_storm');
    expect(p.ready['blade_storm']).toBe(1 + sec(45));
    const before = s.events.length;
    for (let i = 0; i < sec(2.4); i++) step(s);
    const hits = s.events.slice(before).filter((e) => e.type === 'damage' && e.skill === 'blade_storm');
    expect(hits.length).toBe(9);
    expect(p.mp).toBeGreaterThanOrEqual(60);
  });

  it('會放大招的熟練 Bot：狼王更快（大招有感），勝率不下降', () => {
    const ultBot = () => new PlayerBot({ ...BOT_PROFILES.expert, ult: true }, 'expert+ult');
    const a = batch('wolf_king', expert, 20);
    const b = batch('wolf_king', ultBot, 20);
    expect(b.winRate).toBeGreaterThanOrEqual(a.winRate);
    expect(b.durationSec.p50).toBeLessThan(a.durationSec.p50);
  }, 60000);
});

describe('HP 藥水（design/20 B、D-069）', () => {
  it('回 30% 最大 HP、冷卻 15 秒、扣攜帶數；滿血與冷卻中無效', () => {
    const s = createBattle({ stageId: 'forest_entry', seed: 2, potions: 2 });
    const p = playerOf(s);
    step(s, [{ type: 'potion' }]);
    expect(s.potions).toBe(2); // 滿血不能喝
    p.hp = 100;
    step(s, [{ type: 'potion' }]);
    expect(p.hp).toBe(100 + Math.round(p.maxHp * 0.3));
    expect(s.potions).toBe(1);
    expect(p.ready['potion']).toBe(s.tick + sec(15));
    const hp1 = p.hp;
    step(s, [{ type: 'potion' }]);
    expect(p.hp).toBeLessThanOrEqual(hp1); // 冷卻中
    expect(s.potions).toBe(1);
    // 不會補超過上限
    p.hp = p.maxHp - 10;
    p.ready['potion'] = 0;
    step(s, [{ type: 'potion' }]);
    expect(p.hp).toBeLessThanOrEqual(p.maxHp);
    expect(s.potions).toBe(0);
  });

  it('會喝藥水的新手 Bot：精英狼群從打不過變成有機會（藥水數有上限）', () => {
    const plain = batch('elite_pack', () => new PlayerBot(BOT_PROFILES.novice, 'novice'), 10);
    const withPot = batch('elite_pack', () => new PlayerBot({ ...BOT_PROFILES.novice, potionAtPct: 45 }, 'novice+pot'), 10);
    expect(withPot.winRate).toBeGreaterThanOrEqual(plain.winRate);
    expect(withPot.avgPotions).toBeGreaterThan(0);
    expect(withPot.avgPotions).toBeLessThanOrEqual(20);
  }, 60000);
});

describe('障礙物格（design/21 §3 第 1 步、D-070）', () => {
  // 每格 1 單位；第 10 列 x=5..8 有一排石頭
  const rows = Array.from({ length: 20 }, (_, y) => (y === 10 ? '.....####.......' : '................'));
  const solid = { cell: u(1), rows };

  it('走不進石頭、會沿邊滑動；外牆照舊', () => {
    const s = createBattle({ stageId: 'wolf_king', seed: 1 });
    s.arena = { ...s.arena, solid };
    const p = playerOf(s);
    s.units = [p, ...enemiesOf(s)];
    p.x = u(6.5);
    p.y = u(12.5);
    for (let i = 0; i < sec(2); i++) step(s, [{ type: 'move', dx: 0, dy: -1000 }]);
    expect(p.y - p.r).toBeGreaterThanOrEqual(u(11) - 2); // 停在石頭下緣
    // 斜著走：y 被擋住、x 照樣前進（滑動）
    const x0 = p.x;
    for (let i = 0; i < sec(0.5); i++) step(s, [{ type: 'move', dx: 707, dy: -707 }]);
    expect(p.x).toBeGreaterThan(x0 + u(0.5));
    expect(p.y - p.r).toBeGreaterThanOrEqual(u(11) - 2);
  });

  it('狼王隔著石頭衝鋒會撞上石頭暈眩', () => {
    let stunned = 0;
    for (let seed = 1; seed <= 6 && !stunned; seed++) {
      const s = createBattle({ stageId: 'wolf_king', seed });
      s.arena = { ...s.arena, solid };
      const p = playerOf(s);
      const k = enemiesOf(s)[0]!;
      k.x = u(6.5);
      k.y = u(5);
      p.x = u(6.5);
      p.y = u(15.5);
      p.speedPerTick = 0; // 站著不動，讓狼王想用衝鋒
      for (let i = 0; i < sec(40) && s.outcome === 'running'; i++) {
        step(s);
        p.hp = p.maxHp;
      }
      stunned += s.events.filter((e) => e.type === 'wallStun').length;
    }
    expect(stunned).toBeGreaterThan(0);
  }, 60000);

  it('有障礙物時一樣可重現；不會有單位卡在石頭裡', () => {
    const run = () => {
      const s = createBattle({ stageId: 'wolf_king', seed: 5 });
      s.arena = { ...s.arena, solid };
      const bot = expert();
      while (s.outcome === 'running' && s.tick < sec(120)) step(s, bot.decide(s));
      return s;
    };
    const a = run();
    const b = run();
    expect(b.events.length).toBe(a.events.length);
    expect(b.units.map((x) => [x.x, x.y, x.hp])).toEqual(a.units.map((x) => [x.x, x.y, x.hp]));
    // 不會有單位卡在石頭裡
    for (const x of a.units) {
      if (x.dead) continue;
      const cx = Math.floor(x.x / solid.cell);
      const cy = Math.floor(x.y / solid.cell);
      expect(rows[cy]?.[cx], `unit ${x.id}`).not.toBe('#');
    }
  }, 60000);
});

describe('格子尋路與視線（D-071）', () => {
  // 第 10 列一整排石頭，只在 x=13 留一個缺口
  const wallRows = Array.from({ length: 20 }, (_, y) => (y === 10 ? '#############...' : '................'));
  const wall = { cell: u(1), rows: wallRows };

  it('A* 繞過石頭、不切角、同樣輸入同樣路徑', () => {
    const arena = { w: u(16), h: u(20), solid: wall };
    const g = gridOf(arena)!;
    const from = cellIndex(g, u(2.5), u(5.5));
    const to = cellIndex(g, u(2.5), u(15.5));
    const a = findPath(g, from, to)!;
    expect(a).not.toBeNull();
    expect(findPath(g, from, to)).toEqual(a);
    let prev = from;
    for (const i of a) {
      expect(g.walk[i]).toBe(1);
      const px = prev % g.w, py = Math.floor(prev / g.w), x = i % g.w, y = Math.floor(i / g.w);
      expect(Math.max(Math.abs(px - x), Math.abs(py - y))).toBe(1);
      if (px !== x && py !== y) {
        expect(g.walk[py * g.w + x]).toBe(1);
        expect(g.walk[y * g.w + px]).toBe(1);
      }
      prev = i;
    }
    // 一定經過缺口（x≥13 的第 10 列）
    expect(a.some((i) => Math.floor(i / g.w) === 10 && i % g.w >= 13)).toBe(true);
    expect(clearLine(g, u(2.5), u(5.5), u(2.5), u(15.5))).toBe(false);
    expect(clearLine(g, u(14.5), u(5.5), u(14.5), u(15.5))).toBe(true);
    // 完全封死 → null
    const closed = gridOf({ w: u(16), h: u(20), solid: { cell: u(1), rows: Array.from({ length: 20 }, (_, y) => (y === 10 ? '################' : '................')) } })!;
    expect(findPath(closed, from, to)).toBeNull();
  });

  it('狼會繞過整排石頭追到人（直線追會卡在牆後）', () => {
    const s = createBattle({ stageId: 'forest_entry', seed: 3 });
    s.arena = { ...s.arena, w: u(16), h: u(20), solid: wall };
    const p = playerOf(s);
    const w = enemiesOf(s)[0]!;
    s.units = [p, w];
    p.x = u(2.5);
    p.y = u(15.5);
    p.speedPerTick = 0;
    w.x = u(2.5);
    w.y = u(5.5);
    let reached = -1;
    for (let i = 0; i < sec(15); i++) {
      step(s, [{ type: 'stop' }]);
      p.hp = p.maxHp;
      if (reached < 0 && dist(w.x, w.y, p.x, p.y) < u(2)) reached = s.tick;
    }
    expect(reached).toBeGreaterThan(0);
    expect(reached).toBeLessThan(sec(10));
  });

  it('荊棘射手隔著石頭不會射擊；繞出來看得到才射', () => {
    const rows = Array.from({ length: 20 }, (_, y) => (y === 8 ? '......###.......' : '................'));
    const s = createBattle({ stageId: 'forest_deep', seed: 2 });
    s.arena = { ...s.arena, w: u(16), h: u(20), solid: { cell: u(1), rows } };
    const p = playerOf(s);
    const sh = enemiesOf(s).find((e) => e.defId === 'thorn_shooter')!;
    s.units = [p, sh];
    p.x = u(7.5);
    p.y = u(10.5);
    p.speedPerTick = 0;
    sh.x = u(7.5);
    sh.y = u(5);
    sh.speedPerTick = 0; // 不讓它走出來
    for (let i = 0; i < sec(8); i++) {
      step(s, [{ type: 'stop' }]);
      p.hp = p.maxHp;
    }
    expect(s.events.filter((e) => e.type === 'telegraph').length).toBe(0);
    sh.x = u(11.5); // 移到看得到的位置
    sh.y = u(8.5);
    for (let i = 0; i < sec(4); i++) {
      step(s, [{ type: 'stop' }]);
      p.hp = p.maxHp;
    }
    expect(s.events.filter((e) => e.type === 'telegraph').length).toBeGreaterThan(0);
  });

  it('碎石林道：熟練 Bot 穩定通關、可重現、沒有單位卡進石頭', () => {
    const a = simulateBattle({ stageId: 'rock_grove', seed: 9 }, expert());
    const b = simulateBattle({ stageId: 'rock_grove', seed: 9 }, expert());
    expect(b.stateHash).toBe(a.stateHash);
    expect(batch('rock_grove', expert, 10).winRate).toBe(100);
    const s = createBattle({ stageId: 'rock_grove', seed: 4 });
    const bot = expert();
    const rows = s.arena.solid!.rows;
    while (s.outcome === 'running') {
      step(s, bot.decide(s));
      if (s.tick % 15) continue;
      for (const x of s.units) if (!x.dead) expect(rows[Math.floor(x.y / u(1))]?.[Math.floor(x.x / u(1))], `unit ${x.id} t${s.tick}`).not.toBe('#');
    }
  }, 60000);
});

describe('點地移動 moveTo（D-071）', () => {
  const wallRows = Array.from({ length: 20 }, (_, y) => (y === 10 ? '#############...' : '................'));
  const solo = (stageId = 'forest_entry') => {
    const s = createBattle({ stageId, seed: 1 });
    const p = playerOf(s);
    return { s, p };
  };

  it('繞過石頭走到目的地，到了就清掉目的地', () => {
    const { s, p } = solo();
    s.arena = { ...s.arena, w: u(16), h: u(20), solid: { cell: u(1), rows: wallRows } };
    s.units = [p, ...enemiesOf(s).map((e) => ({ ...e, x: u(14.5), y: u(1) }))];
    for (const e of enemiesOf(s)) e.speedPerTick = 0;
    p.x = u(2.5);
    p.y = u(15.5);
    step(s, [{ type: 'moveTo', x: u(2.5), y: u(5.5) }]);
    expect(s.moveGoal).toBeTruthy();
    for (let i = 0; i < sec(9) && s.moveGoal; i++) step(s, [{ type: 'stop' }]);
    expect(s.moveGoal).toBeNull();
    expect(s.tick).toBeLessThan(sec(9));
    expect(dist(p.x, p.y, u(2.5), u(5.5))).toBeLessThanOrEqual(40); // 抵達那一 tick 會接著自動追擊走一步
  });

  it('搖桿一動或點敵人就取消；點到石頭或走不到的地方無效', () => {
    const { s, p } = solo();
    step(s, [{ type: 'moveTo', x: u(2), y: u(2) }]);
    expect(s.moveGoal).toBeTruthy();
    step(s, [{ type: 'move', dx: 1000, dy: 0 }]);
    expect(s.moveGoal).toBeNull();
    step(s, [{ type: 'moveTo', x: u(2), y: u(2) }]);
    step(s, [{ type: 'target', id: enemiesOf(s)[0]!.id }]);
    expect(s.moveGoal).toBeNull();
    // 'stop'（放開搖桿）不會取消
    step(s, [{ type: 'moveTo', x: u(2), y: u(2) }, { type: 'stop' }]);
    expect(s.moveGoal).toBeTruthy();
    const closed = Array.from({ length: 18 }, (_, y) => (y === 9 ? '##############' : '..............'));
    const t = solo();
    t.s.arena = { ...t.s.arena, solid: { cell: u(1), rows: closed } };
    step(t.s, [{ type: 'moveTo', x: u(7.5), y: u(9.5) }]);
    expect(t.s.moveGoal ?? null).toBeNull(); // 點在石頭上
    step(t.s, [{ type: 'moveTo', x: u(7.5), y: u(3) }]);
    expect(t.s.moveGoal ?? null).toBeNull(); // 牆另一邊走不到
    expect(p.dead).toBe(false);
  });

  it('沒用點地移動的紀錄，雜湊與重播都不受影響（可重現）', () => {
    const a = simulateBattle({ stageId: 'rock_grove', seed: 3 }, expert());
    const b = simulateBattle({ stageId: 'rock_grove', seed: 3 }, expert());
    expect(b.stateHash).toBe(a.stateHash);
  });
});

describe('地圖怪：待機／戰鬥／返回（D-072，design/20 B1）', () => {
  const setup = () => {
    const s = createBattle({ stageId: 'rock_grove', seed: 1 });
    const p = playerOf(s);
    return { s, p };
  };

  it('開場全部待機；玩家站著不動就不會被打', () => {
    const { s, p } = setup();
    expect(enemiesOf(s).every((e) => e.mode === 'idle')).toBe(true);
    p.speedPerTick = 0; // 站著不動（不然會自動走去打最近的怪）
    for (let i = 0; i < sec(10); i++) step(s);
    expect(p.hp).toBe(p.maxHp);
    expect(s.events.some((e) => e.type === 'telegraph')).toBe(false);
  });

  it('走進仇恨半徑會醒，同組的狼一起醒；看不到（隔石）不會醒', () => {
    const { s, p } = setup();
    const [w1, w2] = enemiesOf(s);
    p.x = w1!.x;
    p.y = w1!.y + u(3);
    for (let i = 0; i < 12; i++) step(s, [{ type: 'move', dx: 0, dy: 0 }, { type: 'moveTo', x: p.x, y: p.y }]);
    expect(w1!.mode).toBe('combat');
    expect(w2!.mode).toBe('combat');
    // 射手在第 2～3 列石頭後面：從石頭正下方靠近也看不到
    const t = setup();
    const sh = enemiesOf(t.s).find((e) => e.defId === 'thorn_shooter')!;
    t.s.units = [t.p, sh];
    t.p.x = u(4);
    t.p.y = u(4.6); // 第 2～3 列 x=3..4 是石頭，射手在 (4,1.5)
    for (let i = 0; i < 24; i++) step(t.s, [{ type: 'moveTo', x: t.p.x, y: t.p.y }]);
    expect(sh.mode).toBe('idle');
  });

  it('拉太遠會返回原位、返回途中不吃傷害、回到原位回滿', () => {
    const { s, p } = setup();
    const w = enemiesOf(s)[0]!;
    s.units = [p, w];
    w.mode = 'combat';
    w.hp = 100;
    // 玩家跑到很遠（超過最大追擊 12）且一直不交手
    p.x = u(15);
    p.y = u(21.5);
    w.x = u(15);
    w.y = u(20);
    w.homeX = u(2);
    w.homeY = u(4);
    for (let i = 0; i < 3 && w.mode === 'combat'; i++) step(s, [{ type: 'moveTo', x: p.x, y: p.y }]);
    expect(w.mode).toBe('returning');
    expect(s.events.some((e) => e.type === 'leash')).toBe(true);
    // 返回途中打不到
    const hp0 = w.hp;
    p.x = w.x;
    p.y = w.y + u(1);
    step(s, [{ type: 'skill', id: 'whirlwind' }]);
    for (let i = 0; i < sec(1.2); i++) step(s);
    expect(w.hp).toBe(hp0);
    for (let i = 0; i < sec(15) && (w.mode as string) !== 'idle'; i++) {
      step(s, [{ type: 'moveTo', x: u(15), y: u(21.5) }]);
    }
    expect(w.mode).toBe('idle');
    expect(w.hp).toBe(w.maxHp);
    expect(dist(w.x, w.y, u(2), u(4))).toBeLessThanOrEqual(25);
  });

  it('普通 Bot 一定通關、可重現；自動戰鬥（只放著打）會一次拉太多而輸', () => {
    expect(batch('rock_grove', () => new PlayerBot(BOT_PROFILES.normal, 'normal'), 10).winRate).toBe(100);
    expect(batch('rock_grove', () => new PlayerBot(BOT_PROFILES.auto, 'auto'), 5).winRate).toBeLessThan(100);
    const a = simulateBattle({ stageId: 'rock_grove', seed: 11 }, expert());
    expect(simulateBattle({ stageId: 'rock_grove', seed: 11 }, expert()).stateHash).toBe(a.stateHash);
  }, 60000);
});

describe('自然恢復（D-073）', () => {
  it('地圖怪關卡：脫戰 5 秒後每秒回 2%，有怪在戰鬥就不回；舊關卡不回', () => {
    const s = createBattle({ stageId: 'rock_grove', seed: 1 });
    const p = playerOf(s);
    p.speedPerTick = 0;
    p.hp = 300;
    for (let i = 0; i < sec(5) - 1; i++) step(s);
    expect(p.hp).toBe(300);
    for (let i = 0; i < sec(3); i++) step(s); // 第 150、180、210 tick 各回一次
    const per = Math.round(p.maxHp * 0.02);
    expect(p.hp).toBe(300 + per * 3);
    expect(s.events.filter((e) => e.type === 'regen').length).toBe(3);
    // 有怪在戰鬥中：不回
    enemiesOf(s)[0]!.mode = 'combat';
    enemiesOf(s)[0]!.speedPerTick = 0;
    enemiesOf(s)[0]!.engagedTick = 1e9; // 不讓它因為太久沒交手而脫戰
    const hp = p.hp;
    for (let i = 0; i < sec(2); i++) step(s);
    expect(p.hp).toBe(hp);
    // 不超過上限
    enemiesOf(s)[0]!.mode = 'idle';
    for (let i = 0; i < sec(60); i++) step(s);
    expect(p.hp).toBe(p.maxHp);
    // 舊關卡沒有自然恢復
    const o = createBattle({ stageId: 'forest_entry', seed: 1 });
    const op = playerOf(o);
    o.units = [op];
    op.hp = 300;
    for (let i = 0; i < sec(10); i++) step(o);
    expect(op.hp).toBe(300);
  });
});

describe('流場尋路效能（D-074）', () => {
  it('48×96 石陣地圖、12 隻狼同時繞路追人：每 tick 遠低於 1 毫秒，80 秒內全部追到', () => {
    const W = 48;
    const H = 96;
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    // 每 8 列一道牆（只留一個缺口）＋8% 散石
    const rows = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => ((y % 8 === 4 && x % 12 !== 6) || rnd() < 0.08 ? '#' : '.')).join(''));
    const s = createBattle({ stageId: 'wolf_den', seed: 1 });
    s.arena = { w: u(W), h: u(H), solid: { cell: u(1), rows } };
    const p = playerOf(s);
    p.x = u(6.5);
    p.y = u(90.5);
    p.hp = p.maxHp = 1e9;
    p.speedPerTick = 0;
    const es = enemiesOf(s);
    while (es.length < 12) es.push({ ...es[0]!, id: 100 + es.length, statuses: [], ready: {} });
    s.units = [p, ...es];
    es.forEach((e, i) => {
      e.x = u(6.5 + (i % 4) * 12);
      e.y = u(10.5 + Math.floor(i / 4) * 2);
      e.hp = e.maxHp = 1e9;
    });
    const t0 = performance.now();
    for (let i = 0; i < sec(80); i++) step(s, [{ type: 'stop' }]);
    const ms = (performance.now() - t0) / sec(80);
    expect(ms).toBeLessThan(2); // 本機約 0.12ms；CI 機器慢一些也有餘裕
    expect(es.filter((e) => dist(e.x, e.y, p.x, p.y) < u(4)).length).toBe(12);
  }, 60000);
});

describe('同時追擊上限與沉睡（design/20 B1）', () => {
  /** 空曠的大地圖（rock_grove 的 mapAi 行為），玩家不動、雙方都打不死 */
  function openField(w: number, h: number, px: number, py: number, wolves: [number, number][]) {
    const s = createBattle({ stageId: 'rock_grove', seed: 3 });
    s.arena = { w: u(w), h: u(h) };
    s.timeLimitTicks = sec(9999);
    const p = playerOf(s);
    p.x = u(px);
    p.y = u(py);
    p.hp = p.maxHp = 1e9;
    p.speedPerTick = 0;
    const proto = enemiesOf(s).find((e) => e.defId === 'wolf')!;
    const es = wolves.map(([x, y], i) => ({ ...proto, id: 100 + i, x: u(x), y: u(y), homeX: u(x), homeY: u(y), hp: 1e9, maxHp: 1e9, statuses: [], ready: {}, action: null, mode: 'idle' as Unit['mode'], tier: 'normal' as const }));
    s.units = [p, ...es];
    return { s, p, es };
  }

  it('12 隻一起醒：只有 8 隻出手，其餘排隊；前面的倒下後排隊的補上', () => {
    const ring: [number, number][] = Array.from({ length: 12 }, (_, i) => [20 + 3 * Math.cos((i / 12) * Math.PI * 2), 20 + 3 * Math.sin((i / 12) * Math.PI * 2)]);
    const { s, es } = openField(40, 40, 20, 20, ring);
    for (let i = 0; i < sec(8); i++) step(s, [{ type: 'stop' }]);
    expect(es.every((e) => e.mode === 'combat')).toBe(true);
    const owners = () => new Set(s.events.filter((ev) => ev.type === 'telegraph').map((ev) => (ev as { owner: number }).owner));
    const first = owners();
    expect(first.size).toBe(8);
    // 前面 4 隻倒下 → 排隊的補上
    for (const e of es.filter((x) => first.has(x.id)).slice(0, 4)) {
      e.dead = true;
      e.hp = 0;
      e.action = null;
    }
    s.telegraphs = s.telegraphs.filter((t) => !es.find((e) => e.id === t.ownerId)?.dead);
    s.events = [];
    for (let i = 0; i < sec(8); i++) step(s, [{ type: 'stop' }]);
    const second = owners();
    expect(second.size).toBe(8);
    expect([...second].filter((id) => !first.has(id)).length).toBe(4);
  });

  it('排隊的怪不會因為「太久沒交手」脫戰回家', () => {
    const ring: [number, number][] = Array.from({ length: 10 }, (_, i) => [20 + 2.5 * Math.cos(i), 20 + 2.5 * Math.sin(i)]);
    const { s, es } = openField(40, 40, 20, 20, ring);
    for (let i = 0; i < sec(20); i++) step(s, [{ type: 'stop' }]);
    expect(es.filter((e) => e.mode === 'combat').length).toBe(10);
    expect(s.events.some((ev) => ev.type === 'leash')).toBe(false);
  });

  it('離玩家 24 單位外的待機怪沉睡：不動、不跑 AI；玩家走近就醒來', () => {
    const far: [number, number][] = Array.from({ length: 30 }, (_, i) => [3 + (i % 10) * 3, 5 + Math.floor(i / 10) * 3]);
    const { s, p, es } = openField(40, 120, 20, 110, far);
    for (let i = 0; i < sec(10); i++) step(s, [{ type: 'stop' }]);
    expect(es.every((e) => e.mode === 'dormant')).toBe(true);
    expect(es.every((e, i) => e.x === u(far[i]![0]) && e.y === u(far[i]![1]))).toBe(true);
    // 玩家來到 10 單位外：醒成待機（還沒進仇恨半徑）
    p.y = u(21);
    for (let i = 0; i < 12; i++) step(s, [{ type: 'stop' }]);
    expect(es.every((e) => e.mode === 'idle')).toBe(true);
  });

  it('沉睡的怪 tick 成本近乎 0：200 隻遠處的怪每 tick 遠低於 0.5 毫秒', () => {
    const far: [number, number][] = Array.from({ length: 200 }, (_, i) => [2 + (i % 20) * 2, 2 + Math.floor(i / 20) * 2]);
    const { s } = openField(44, 200, 22, 190, far);
    for (let i = 0; i < 20; i++) step(s, [{ type: 'stop' }]);
    const t0 = performance.now();
    for (let i = 0; i < sec(30); i++) step(s, [{ type: 'stop' }]);
    const ms = (performance.now() - t0) / sec(30);
    expect(ms).toBeLessThan(0.5);
  });

  it('Bot 拉怪判斷：避開會連鎖到第二組的怪，先打落單的；只放著打的 Bot 照樣點最近的', () => {
    // A 組（2 隻）離玩家 6 單位，旁邊 4 單位有 B 組；C 落單、離玩家 9 單位
    const pack: [number, number][] = [[20, 24], [21, 24], [24.2, 23], [25.2, 23], [12, 28]];
    const { s, p, es } = openField(40, 40, 20, 30, pack);
    expect(pullRisk(s, es[0]!)).toEqual({ group: 2, extra: 2 });
    expect(pullRisk(s, es[4]!)).toEqual({ group: 1, extra: 0 });
    expect(safestPull(s)?.id).toBe(es[4]!.id);
    expect(p.hp).toBeGreaterThan(0);
    const peak = (bot: PlayerBot) => {
      const { s: s2 } = openField(40, 40, 20, 30, pack);
      const p2 = playerOf(s2);
      p2.speedPerTick = 9;
      let most = 0;
      for (let i = 0; i < sec(6); i++) {
        step(s2, bot.decide(s2));
        most = Math.max(most, enemiesOf(s2).filter((e) => e.mode === 'combat').length);
      }
      return most;
    };
    expect(peak(new PlayerBot(BOT_PROFILES.normal, 'normal'))).toBe(1);
    expect(peak(new PlayerBot(BOT_PROFILES.auto, 'auto'))).toBeGreaterThanOrEqual(3);
  });
});

describe('重生點 SpawnGroup（design/20 B1、design/21 §3 第 2 步）', () => {
  beforeAll(() => {
  STAGES.test_spawn = {
    id: 'test_spawn', name: '測試重生', timeLimitTicks: sec(9999), player: { x: u(15), y: u(9) }, mapAi: true, enemies: [],
    arena: { w: u(30), h: u(40) },
    spawnGroups: [{ id: 'wolves', enemyId: 'wolf', cx: u(15), cy: u(6), spawnRadius: u(2), maxAlive: 3, respawnTicks: sec(30) }],
  };
  });
  afterAll(() => {
    delete STAGES.test_spawn;
  });
  const killAll = (s: ReturnType<typeof createBattle>) => {
    const p = playerOf(s);
    p.atk = 99999;
    p.hp = p.maxHp = 1e9;
    const bot = expert();
    for (let i = 0; i < sec(30) && enemiesOf(s).length; i++) step(s, bot.decide(s));
  };

  it('開場生滿 maxAlive 隻待機怪；清光後不算勝利，30 秒後在玩家走遠時補回', () => {
    const s = createBattle({ stageId: 'test_spawn', seed: 5 });
    expect(enemiesOf(s).map((e) => [e.groupId, e.mode])).toEqual([['wolves', 'idle'], ['wolves', 'idle'], ['wolves', 'idle']]);
    killAll(s);
    expect(enemiesOf(s).length).toBe(0);
    expect(s.outcome).toBe('running');
    const deaths = s.events.filter((e) => e.type === 'death').map((e) => e.tick);
    expect(deaths.length).toBe(3);
    const p = playerOf(s);
    p.x = u(15);
    p.y = u(36); // 離重生點 30 單位
    for (let i = 0; i < sec(40); i++) step(s, [{ type: 'stop' }]);
    const rs = s.events.filter((e) => e.type === 'respawn').map((e) => e.tick);
    expect(rs).toEqual(deaths.map((t) => t + sec(30)));
    const es = enemiesOf(s);
    expect(es.length).toBe(3);
    for (const e of es) expect(dist(e.x, e.y, u(15), u(6))).toBeLessThanOrEqual(u(2) + 1);
    // 倒下的舊單位被換掉，陣列不會一直變大
    expect(s.units.length).toBe(4);
  });

  it('玩家站在重生點旁邊時延後重生，離開後才補', () => {
    const s = createBattle({ stageId: 'test_spawn', seed: 6 });
    killAll(s);
    const p = playerOf(s);
    p.x = u(15);
    p.y = u(10); // 只有 4 單位
    for (let i = 0; i < sec(45); i++) step(s, [{ type: 'stop' }]);
    expect(s.events.some((e) => e.type === 'respawn')).toBe(false);
    p.y = u(36);
    for (let i = 0; i < sec(2); i++) step(s, [{ type: 'stop' }]);
    expect(enemiesOf(s).length).toBe(3);
  });

  it('有重生點也可重現（stateHash 一致）', () => {
    const run = () => {
      const s = createBattle({ stageId: 'test_spawn', seed: 9 });
      killAll(s);
      playerOf(s).y = u(36);
      for (let i = 0; i < sec(35); i++) step(s, [{ type: 'stop' }]);
      return stateHash(s);
    };
    expect(run()).toBe(run());
  });
});

describe('營火：安全範圍、休息、復活（design/20 B4）', () => {
  beforeAll(() => {
    STAGES.test_camp = {
      id: 'test_camp', name: '測試營火', timeLimitTicks: sec(9999), player: { x: u(15), y: u(35) }, mapAi: true, enemies: [],
      arena: { w: u(30), h: u(40) }, reviveAtCampfire: true,
      campfires: [{ id: 'south', x: u(15), y: u(34) }, { id: 'north', x: u(15), y: u(4) }],
      spawnGroups: [{ id: 'wolves', enemyId: 'wolf', cx: u(15), cy: u(16), spawnRadius: u(1.5), maxAlive: 3, respawnTicks: sec(30) }],
    };
  });
  afterAll(() => {
    delete STAGES.test_camp;
  });

  it('營火旁休息：HP 全滿、補藥水、設復活點；有怪在打你時不能休息', () => {
    const s = createBattle({ stageId: 'test_camp', seed: 1, potions: 3 });
    const p = playerOf(s);
    p.hp = 50;
    step(s, [{ type: 'rest' }]);
    expect(p.hp).toBe(p.maxHp);
    expect(s.potions).toBe(20);
    expect(s.campfireId).toBe('south');
    // 走離營火就不能休息
    p.y = u(28);
    p.hp = 50;
    step(s, [{ type: 'rest' }]);
    expect(p.hp).toBeLessThan(p.maxHp);
    // 有戰鬥中的怪 → 無效
    p.y = u(34.5);
    enemiesOf(s)[0]!.mode = 'combat';
    step(s, [{ type: 'rest' }]);
    expect(p.hp).toBeLessThan(p.maxHp);
  });

  it('怪不追進營火：被追著跑回營火，追兵脫戰回家', () => {
    const s = createBattle({ stageId: 'test_camp', seed: 2 });
    const p = playerOf(s);
    p.hp = p.maxHp = 1e9;
    p.y = u(20); // 走進仇恨範圍
    for (let i = 0; i < sec(2); i++) step(s, [{ type: 'stop' }]);
    expect(enemiesOf(s).every((e) => e.mode === 'combat')).toBe(true);
    for (let i = 0; i < sec(6); i++) step(s, i === 0 ? [{ type: 'moveTo', x: u(15), y: u(34) }] : []);
    expect(dist(p.x, p.y, u(15), u(34))).toBeLessThan(u(3));
    expect(enemiesOf(s).every((e) => e.mode !== 'combat')).toBe(true);
    // 待在營火旁，牠們不會再醒
    for (let i = 0; i < sec(10); i++) step(s, [{ type: 'stop' }]);
    expect(enemiesOf(s).every((e) => e.mode === 'idle' || e.mode === 'dormant')).toBe(true);
  });

  it('倒下在最後休息的營火復活：不算失敗、HP 全滿、短暫無敵、追兵回家', () => {
    const s = createBattle({ stageId: 'test_camp', seed: 3 });
    const p = playerOf(s);
    p.x = u(15);
    p.y = u(4.5);
    step(s, [{ type: 'rest' }]);
    expect(s.campfireId).toBe('north');
    p.y = u(17);
    p.hp = 1;
    p.atk = 1;
    for (let i = 0; i < sec(10) && !s.revives; i++) step(s, [{ type: 'stop' }]);
    expect(s.revives).toBe(1);
    expect(s.outcome).toBe('running');
    expect(p.dead).toBe(false);
    expect(p.hp).toBe(p.maxHp);
    expect(dist(p.x, p.y, u(15), u(4))).toBeLessThanOrEqual(u(1));
    expect(p.invulnUntil).toBeGreaterThan(s.tick);
    expect(enemiesOf(s).some((e) => e.mode === 'combat')).toBe(false);
  });

  it('沒開 reviveAtCampfire 的關卡倒下照樣失敗', () => {
    const r = simulateBattle({ stageId: 'rock_grove', seed: 1 }, new PlayerBot(BOT_PROFILES.auto, 'auto'));
    expect(r.outcome).toBe('defeat');
  });
});
