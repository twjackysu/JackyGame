// P5 長期驗證（design/20 §B8、C3）：暴怒狼王（D-099）＋三種配裝都打得過狼王（D-098）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES, SWORDSMAN } from '../src/core/battle/rt/data';
import { createBattle, setBossFury, step } from '../src/core/battle/rt/engine';
import { GEAR_SLOTS, gearBonus, gearSkillMods, genGear, type GearSlot, type RtGear } from '../src/core/battle/rt/gear';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import type { BattleState, SkillMod } from '../src/core/battle/rt/types';
import { sec } from '../src/core/battle/rt/types';

const out = (s: string) => (globalThis as unknown as { process: { stdout: { write: (x: string) => void } } }).process.stdout.write(s);
const king = (s: BattleState) => s.units.find((u) => u.defId === 'wolf_king' && !u.dead);

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
});
afterAll(() => {
  delete STAGES.mistwood;
});

describe('暴怒狼王（D-099）', () => {
  it('待機滿血時開啟立刻換成暴怒版；HP／攻擊照設定加成；掉 3 件、物品等級 +3；關掉換回來', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 1 });
    const k0 = king(s)!;
    const fz = STAGES.mistwood!.bossZone!.fury!;
    expect(setBossFury(s, true)).toBe(true);
    const k1 = king(s)!;
    expect(k1.fury).toBe(true);
    expect(k1.maxHp).toBe(Math.round((k0.maxHp * (100 + fz.hpPct)) / 100));
    expect(k1.atk).toBe(Math.round((k0.atk * (100 + fz.atkPct)) / 100));
    expect(setBossFury(s, false)).toBe(true);
    expect(king(s)!.fury).toBeUndefined();
    expect(king(s)!.maxHp).toBe(k0.maxHp);
    // 沒有 fury 設定的關卡：不做事
    const t = createBattle({ stageId: 'wolf_king', seed: 1 });
    expect(setBossFury(t, true)).toBe(false);
    expect(t.bossFury).toBeUndefined();
    // 掉落：把玩家放到暴怒狼王旁邊、狼王剩 1 HP
    for (const fury of [false, true]) {
      const b = createBattle({ stageId: 'mistwood', seed: 3 });
      setBossFury(b, fury);
      const k = king(b)!;
      const p = b.units[0]!;
      p.x = k.x;
      p.y = k.y + 150;
      k.hp = 1;
      let n = 0;
      while (king(b) && n++ < 300) step(b, []);
      const gear = (b.ground ?? []).filter((g) => g.kind === 'gear');
      expect(gear.length).toBe(fury ? 3 : 2);
      expect(new Set(gear.map((g) => g.amount))).toEqual(new Set([fury ? 11 : 8]));
      expect(b.furyKills ?? 0).toBe(fury ? 1 : 0);
    }
  });
});

describe('暴怒狼王專屬招式（D-105）', () => {
  it('暴怒版會霧中瞬移到背後撕咬、衝鋒後回頭再衝；一般版從不出這兩招', () => {
    for (const fury of [false, true]) {
      const used = new Set<string>();
      let blinks = 0;
      let chained = 0;
      for (const seed of [1, 2, 3]) {
        const s = createBattle({ stageId: 'mistwood', seed, level: 8, bonus: { hp: 600, atk: 40, def: 25 } });
        if (fury) setBossFury(s, true);
        const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');
        let lastChargeEnd = -99;
        while (!(s.bossKills ?? []).length && s.tick < sec(900)) {
          const n = s.events.length;
          step(s, bot.decide(s));
          for (let i = n; i < s.events.length; i++) {
            const e = s.events[i]!;
            if (e.type === 'telegraph') {
              used.add(e.attack);
              if (e.attack === 'king_charge2' && s.tick - lastChargeEnd <= 1) chained++;
            }
            if (e.type === 'blink') {
              blinks++;
              // 落點在玩家附近（背後 2.2 格內，加上被夾在場地內的誤差）
              const k = s.units.find((x) => x.id === e.id)!;
              const p = s.units[0]!;
              expect(Math.hypot(k.x - p.x, k.y - p.y)).toBeLessThan(2.6 * 100);
            }
          }
          const k = king(s);
          if (k?.action?.id === 'king_charge') lastChargeEnd = k.action.end;
        }
      }
      out(`[D-105] fury=${fury}：瞬移 ${blinks}、接衝 ${chained}、招式 ${[...used].filter((x) => x.startsWith('king')).join(',')}\n`);
      if (fury) {
        expect(blinks).toBeGreaterThan(0);
        expect(used.has('king_mist_rend')).toBe(true);
        expect(used.has('king_charge2')).toBe(true);
      } else {
        expect(blinks).toBe(0);
        expect(used.has('king_mist_rend') || used.has('king_charge2')).toBe(false);
      }
    }
  }, 120000);
});

/** 普通 Bot 在霧語森林實際刷 minutes 分鐘撿到的裝備（含狼王掉落），每件強化 +3（營火材料夠用的程度） */
function farm(minutes: number): { items: RtGear[]; level: number } {
  const s = createBattle({ stageId: 'mistwood', seed: 11 });
  const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');
  while (s.tick < sec(minutes * 60)) step(s, bot.decide(s));
  const items = (s.gearGot ?? []).map((g) => ({ ...genGear((g.id * 2246822519) >>> 0, g.rarity, g.ilvl), enh: 3 }));
  return { items, level: s.prog!.level };
}

type Build = { name: string; score: (g: RtGear) => number };
const B = (g: RtGear) => gearBonus([g], SWORDSMAN.hp, SWORDSMAN.atk);
const BUILDS: Build[] = [
  { name: '全攻擊', score: (g) => B(g).atk * 10 + B(g).hp * 0.01 },
  { name: '全 HP／防禦', score: (g) => B(g).hp + B(g).def * 12 + B(g).atk * 0.1 },
  { name: '冷卻流', score: (g) => (g.special?.kind === 'cd' && (g.special.skill === 'heavy_slash' || g.special.skill === 'whirlwind') ? 1000 + g.special.value * 10 : 0) + (g.special?.kind === 'area' ? 400 : 0) + B(g).atk * 4 + B(g).hp * 0.2 },
];

function pick(b: Build, items: RtGear[]): RtGear[] {
  const best: Partial<Record<GearSlot, RtGear>> = {};
  for (const g of items) if (!best[g.slot] || b.score(g) > b.score(best[g.slot]!)) best[g.slot] = g;
  return GEAR_SLOTS.map((k) => best[k]!).filter(Boolean);
}

function fight(seed: number, level: number, bonus: { hp: number; atk: number; def: number }, mods: Record<string, SkillMod>, fury: boolean, prof: 'novice' | 'normal' | 'expert' = 'normal') {
  const s = createBattle({ stageId: 'mistwood', seed, level, bonus, skillMods: mods });
  if (fury) setBossFury(s, true);
  const bot = new PlayerBot({ ...BOT_PROFILES[prof], ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, prof);
  let engaged = -1;
  let revAt = 0;
  while (!(s.bossKills ?? []).length && s.tick < sec(1200)) {
    step(s, bot.decide(s));
    if (engaged < 0 && s.units.some((u) => u.defId === 'wolf_king' && !u.dead && u.mode === 'combat')) {
      engaged = s.tick;
      revAt = s.revives ?? 0;
    }
  }
  const killed = (s.bossKills ?? []).length > 0;
  const p = s.units[0]!;
  const taken = s.events.filter((e) => e.type === 'damage' && e.dst === p.id && e.tick >= engaged).reduce((n, e) => n + (e.type === 'damage' ? e.amount : 0), 0);
  const pots = s.events.filter((e) => e.type === 'potion' && e.tick >= engaged).length;
  return { killed, fight: Math.round((s.tick - Math.max(0, engaged)) / 30), downs: (s.revives ?? 0) - revAt, taken: Math.round((taken / p.maxHp) * 100), pots };
}

describe('P5 配裝比較（Lv8、同一批裝備）', () => {
  it('三種配裝都打得倒狼王；暴怒版明顯更難但刷過的角色打得過', async () => {
    const { items, level } = farm(Number((globalThis as any).process.env.FARM_MIN ?? 60));
    const rows: string[] = [`刷 ${(globalThis as any).process.env.FARM_MIN ?? 60} 分鐘：Lv${level}、${items.length} 件（稀有 ${items.filter((g) => g.rarity === 3).length}）`];
    for (const b of BUILDS) {
      const gear = pick(b, items);
      const bonus = gearBonus(gear, SWORDSMAN.hp, SWORDSMAN.atk);
      const mods = gearSkillMods(gear);
      const normal = [1, 2].map((sd) => fight(sd, level, bonus, mods, false));
      const fury = [1, 2].map((sd) => fight(sd, level, bonus, mods, true));
      const f = (a: typeof normal) => a.map((x) => (x.killed ? `${x.fight}s/倒${x.downs}/傷${x.taken}%/藥${x.pots}` : '未打倒')).join('、');
      const nov = [1, 2].map((sd) => fight(sd, level, bonus, mods, true, 'novice'));
      rows.push(`${b.name}：加成 ${JSON.stringify(bonus)} 特效 ${JSON.stringify(mods)}\n   普通 Bot：狼王 ${f(normal)}｜暴怒 ${f(fury)}｜新手 Bot 暴怒 ${f(nov)}`);
      for (const x of normal) expect(x.killed).toBe(true);
      for (const x of fury) expect(x.killed).toBe(true);
    }
    // 技能點（D-110）：Lv8 的 7 點兩種點法，疊在「全攻擊」配裝上比暴怒版
    const { mergeMods, rankMods } = await import('../src/game/rtSkills');
    const g0 = pick(BUILDS[0]!, items);
    for (const [name, ranks] of [['重斬5＋風暴2', { heavy_slash: 5, blade_storm: 2 }], ['衝鋒5＋格擋2', { charge: 5, parry: 2 }]] as const) {
      const mods = mergeMods(gearSkillMods(g0), rankMods(ranks));
      const fury = [1, 2].map((sd) => fight(sd, level, gearBonus(g0, SWORDSMAN.hp, SWORDSMAN.atk), mods, true));
      rows.push(`全攻擊＋技能點 ${name}：暴怒 ${fury.map((x) => (x.killed ? `${x.fight}s/倒${x.downs}/藥${x.pots}` : '未打倒')).join('、')}`);
      for (const x of fury) expect(x.killed).toBe(true);
    }
    out(`\n[P5 配裝]\n${rows.join('\n')}\n`);
  }, 300000);
});

describe('深夜的森林（D-103）', () => {
  it('重生點的怪更兇、Boss 不變；沒設 night 的關卡不受影響；刷過的角色打得完', () => {
    const day = createBattle({ stageId: 'mistwood', seed: 1 });
    const night = createBattle({ stageId: 'mistwood', seed: 1, night: true });
    const nt = STAGES.mistwood!.night!;
    expect(night.night).toBe(true);
    const hp = (s: BattleState, g: string) => s.units.find((u) => u.groupId === g)!.maxHp;
    expect(hp(night, 'entry')).toBe(Math.round((hp(day, 'entry') * (100 + nt.hpPct)) / 100));
    expect(king(night)!.maxHp).toBe(king(day)!.maxHp);
    expect(createBattle({ stageId: 'wolf_king', seed: 1, night: true }).night).toBeUndefined();
    // 霧影狼（D-104）只在深夜
    expect(day.units.some((u) => u.defId === 'shade_wolf')).toBe(false);
    expect(night.units.filter((u) => u.defId === 'shade_wolf' && u.tier === 'elite').length).toBe(1);
    // Lv8＋一般裝備的普通 Bot：深夜也能從南營地打到狼王
    const s = createBattle({ stageId: 'mistwood', seed: 2, night: true, level: 8, bonus: { hp: 450, atk: 40, def: 25 } });
    const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');
    while (!(s.bossKills ?? []).length && s.tick < sec(900)) step(s, bot.decide(s));
    const ilvls = (s.gearGot ?? []).map((g) => g.ilvl);
    out(`\n[深夜] Lv8 普通 Bot：狼王 ${Math.round(s.tick / 30)} 秒、營火醒來 ${s.revives ?? 0} 次、撿 ${ilvls.length} 件（物品等級 ${Math.min(...ilvls)}～${Math.max(...ilvls)}）\n`);
    expect(s.bossKills ?? []).toContain('wolf_king');
  }, 120000);
});
