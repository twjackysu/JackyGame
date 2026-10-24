// 即時戰鬥核心（D-063 P1／P2）：確定性、公式、冷卻、閃避、預告、格擋、Boss 階段、模擬器指標。
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addStatus, computeDamage, createBattle, dist, enemiesOf, inShape, playerOf, step } from '../src/core/battle/rt/engine';
import { cellIndex, clearLine, findPath, gridOf } from '../src/core/battle/rt/path';
import { BOT_PROFILES, IdleController, PlayerBot, ScriptedTestController, batch, simulateBattle } from '../src/core/battle/rt/sim';
import { ENEMIES, SKILLS, STAGES } from '../src/core/battle/rt/data';
import { sec, u } from '../src/core/battle/rt/types';

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
  it('熟練 Bot 每一關都能過', () => {
    for (const id of Object.keys(STAGES)) expect(batch(id, expert, 5).winRate, id).toBe(100);
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
