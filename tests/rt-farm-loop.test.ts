// P4 驗收（D-091／D-092）：普通 Bot 在霧語森林刷 30 分鐘 → 帶著等級與最好的裝備，再打一次狼王要比新角色快。
import { afterAll, beforeAll, expect, it } from 'vitest';
import { STAGES, SWORDSMAN } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { GEAR_SLOTS, gearBonus, gearScore, genGear, type GearSlot, type RtGear } from '../src/core/battle/rt/gear';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec } from '../src/core/battle/rt/types';

const out = (s: string) => (globalThis as unknown as { process: { stdout: { write: (x: string) => void } } }).process.stdout.write(s);
const mkBot = () => new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
});
afterAll(() => {
  delete STAGES.mistwood;
});

function kingFight(seed: number, level: number, bonus?: { hp: number; atk: number; def: number }): { total: number; fight: number } {
  const s = createBattle({ stageId: 'mistwood', seed, level, bonus });
  const bot = mkBot();
  let engaged = -1;
  while (!(s.bossKills ?? []).length && s.tick < sec(900)) {
    step(s, bot.decide(s));
    if (engaged < 0 && s.units.some((u) => u.defId === 'wolf_king' && !u.dead && u.mode === 'combat')) engaged = s.tick;
  }
  return { total: Math.round(s.tick / 30), fight: Math.round((s.tick - Math.max(0, engaged)) / 30) };
}

it('刷 30 分鐘後狼王打得更快', () => {
  const s = createBattle({ stageId: 'mistwood', seed: 7 });
  const bot = mkBot();
  while (s.tick < sec(1800)) step(s, bot.decide(s));
  const got = (s.gearGot ?? []).map((g) => genGear((g.id * 2246822519) >>> 0, g.rarity, g.ilvl));
  const best: Partial<Record<GearSlot, RtGear>> = {};
  for (const g of got) if (gearScore(g, SWORDSMAN.hp, SWORDSMAN.atk) > gearScore(best[g.slot], SWORDSMAN.hp, SWORDSMAN.atk)) best[g.slot] = g;
  const bonus = gearBonus(GEAR_SLOTS.map((k) => best[k]), SWORDSMAN.hp, SWORDSMAN.atk);
  const lv = s.prog!.level;
  const fresh = [1, 2, 3].map((sd) => kingFight(sd, 1));
  const farmed = [1, 2, 3].map((sd) => kingFight(sd, lv, bonus));
  const r = (a: { fight: number }[]) => a.map((x) => x.fight).join('/');
  out(`\n[farm] 30 分鐘：Lv${lv}、撿 ${got.length} 件（稀有 ${got.filter((g) => g.rarity === 3).length}、精良 ${got.filter((g) => g.rarity === 2).length}）、擊殺 ${s.events.filter((e) => e.type === 'death' && e.id !== 1).length}、狼王 ${(s.bossKills ?? []).length ? '有' : '沒'}打倒、裝備加成 ${JSON.stringify(bonus)}\n`);
  out(`[farm] 狼王交戰到倒下（秒）新角色 ${r(fresh)}（全程 ${fresh.map((x) => x.total).join('/')}）・刷過 ${r(farmed)}（全程 ${farmed.map((x) => x.total).join('/')}）\n`);
  const sum = (a: { fight: number }[]) => a.reduce((n, x) => n + x.fight, 0);
  expect(got.length).toBeGreaterThan(3);
  expect(lv).toBeGreaterThan(3);
  expect(sum(farmed)).toBeLessThan(sum(fresh) * 0.8);
}, 240000);
