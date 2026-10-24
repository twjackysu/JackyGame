// 即時戰鬥核心（D-063 P1／P2）：確定性、公式、冷卻、閃避、預告、格擋、Boss 階段、模擬器指標。
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addStatus, computeDamage, createBattle, enemiesOf, inShape, playerOf, step } from '../src/core/battle/rt/engine';
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
    for (const f of readdirSync(dir)) {
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
