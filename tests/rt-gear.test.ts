// 即時戰鬥裝備（P4-2，D-091）
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES, SWORDSMAN } from '../src/core/battle/rt/data';
import { createBattle, playerOf, setGearBonus, step } from '../src/core/battle/rt/engine';
import { GEAR_SLOTS, gearBonus, gearLines, gearScore, genGear, isGear, type RtGear } from '../src/core/battle/rt/gear';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec } from '../src/core/battle/rt/types';

const out = (s: string) => (globalThis as unknown as { process: { stdout: { write: (x: string) => void } } }).process.stdout.write(s);

describe('裝備產生', () => {
  it('同種子同結果；稀有度決定詞綴數；六個部位都會出現', () => {
    expect(genGear(123, 3, 5)).toEqual(genGear(123, 3, 5));
    expect(genGear(1, 1, 3).affixes.length).toBe(0);
    expect(genGear(1, 2, 3).affixes.length).toBe(1);
    const r = genGear(1, 3, 3);
    expect(r.affixes.length).toBe(2);
    expect(new Set(r.affixes.map((a) => a.stat)).size).toBe(2);
    const slots = new Set<string>();
    for (let i = 1; i < 200; i++) slots.add(genGear(i * 7919, 1, 2).slot);
    expect([...slots].sort()).toEqual([...GEAR_SLOTS].sort());
    expect(isGear(r)).toBe(true);
    expect(isGear({ uid: 'x' })).toBe(false);
    expect(gearLines(r).length).toBeGreaterThanOrEqual(3);
  });
  it('等級越高、稀有度越高，分數越高（平均）', () => {
    const avg = (rar: 1 | 2 | 3, L: number) => {
      let n = 0;
      for (let i = 1; i <= 300; i++) n += gearScore(genGear(i * 104729, rar, L), SWORDSMAN.hp, SWORDSMAN.atk);
      return n / 300;
    };
    expect(avg(1, 5)).toBeGreaterThan(avg(1, 1));
    expect(avg(3, 3)).toBeGreaterThan(avg(1, 3));
  });
  it('百分比詞綴換算成平加成', () => {
    const g: RtGear = { uid: 'a', slot: 'ring', rarity: 2, ilvl: 1, name: 't', base: { atk: 6 }, affixes: [{ stat: 'atkPct', value: 10 }] };
    expect(gearBonus([g], 600, 34)).toEqual({ hp: 0, atk: 6 + 4, def: 0 });
  });
});

describe('霧語森林的裝備掉落與換裝', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });

  it('普通 Bot 打到狼王會撿到裝備；狼王必掉兩件精良以上', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 1 });
    const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');
    let kingTick = -1;
    while (s.tick < sec(600) && (kingTick < 0 || s.tick < kingTick + sec(20))) {
      step(s, bot.decide(s));
      if (kingTick < 0 && (s.bossKills ?? []).length) kingTick = s.tick;
    }
    const drops = s.events.filter((e) => e.type === 'drop' && e.kind === 'gear');
    const kingDrops = drops.filter((e) => e.tick === kingTick);
    out(`\n[gear] 掉 ${drops.length} 件、撿 ${s.gearGot?.length ?? 0} 件：${(s.gearGot ?? []).map((g) => `R${g.rarity}/L${g.ilvl}`).join(' ')}\n`);
    expect(kingTick).toBeGreaterThan(0);
    expect(kingDrops.length).toBe(2);
    expect(kingDrops.every((e) => e.type === 'drop' && (e.rarity ?? 1) >= 2)).toBe(true);
    expect(kingDrops.some((e) => e.type === 'drop' && e.rarity === 3)).toBe(true); // 這場第一次打倒保底稀有
    expect(drops.length).toBeGreaterThan(2);
  });

  it('setGearBonus：戰鬥中換裝立刻改數值、HP 比例不變、等級加成照疊', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 1, level: 3 });
    const p = playerOf(s);
    p.hp = Math.round(p.maxHp / 2);
    setGearBonus(s, { hp: 100, atk: 10, def: 5 });
    expect(p.maxHp).toBe(Math.round(((SWORDSMAN.hp + 100) * 112) / 100));
    expect(p.atk).toBe(Math.round(((SWORDSMAN.atk + 10) * 110) / 100));
    expect(p.def).toBe(SWORDSMAN.def + 5);
    expect(Math.abs(p.hp / p.maxHp - 0.5)).toBeLessThan(0.01);
    setGearBonus(s, { hp: 0, atk: 0, def: 0 });
    expect(p.atk).toBe(Math.round((SWORDSMAN.atk * 110) / 100));
  });

  it('刷過的裝備讓狼王更快倒（Lv5 同等級，初始裝 vs 精良一套）', () => {
    const set = GEAR_SLOTS.map((_, i) => genGear(1000 + i, 2, 5));
    // 每個部位挑一件（產生器隨機部位 → 直接指定）
    const bySlot = GEAR_SLOTS.map((slot, i) => ({ ...set[i]!, slot }));
    const bonus = gearBonus(bySlot, SWORDSMAN.hp, SWORDSMAN.atk);
    const fight = (b?: { hp: number; atk: number; def: number }) => {
      const t: number[] = [];
      for (const seed of [1, 2, 3]) {
        const s = createBattle({ stageId: 'mistwood', seed, level: 5, bonus: b });
        const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');
        let engaged = -1;
        while (!(s.bossKills ?? []).length && s.tick < sec(900)) {
          step(s, bot.decide(s));
          const k = s.units.find((u) => u.defId === 'wolf_king' && !u.dead);
          if (engaged < 0 && k?.mode === 'combat') engaged = s.tick;
        }
        t.push(Math.round((s.tick - Math.max(0, engaged)) / 30));
      }
      return t;
    };
    const a = fight();
    const b = fight(bonus);
    out(`[gear] 狼王交戰到倒下（秒）初始裝 ${a.join('/')}・精良一套 ${b.join('/')}（加成 ${JSON.stringify(bonus)}）\n`);
    expect(b.reduce((x, y) => x + y, 0)).toBeLessThan(a.reduce((x, y) => x + y, 0));
  });
});

describe('行囊（純資料）', () => {
  it('換上會把舊的放回背包；卸下；全部最好；壞存檔清掉', async () => {
    const { equipWith, unequip, isUpgrade, bonusOf } = await import('../src/game/rtBag');
    const { cleanBag } = await import('../src/game/rtRecord');
    const a: RtGear = { uid: 'a', slot: 'weapon', rarity: 1, ilvl: 1, name: 'a', base: { atk: 3 }, affixes: [] };
    const b: RtGear = { uid: 'b', slot: 'weapon', rarity: 2, ilvl: 3, name: 'b', base: { atk: 8 }, affixes: [] };
    let st = { bag: [a, b], equip: {} };
    expect(isUpgrade(st, a)).toBe(true);
    st = equipWith(st, a);
    expect(st.equip).toEqual({ weapon: a });
    expect(st.bag).toEqual([b]);
    st = equipWith(st, b);
    expect(st.bag).toEqual([a]);
    expect(isUpgrade(st, a)).toBe(false);
    expect(bonusOf(st).atk).toBe(8);
    st = unequip(st, 'weapon');
    expect(st.equip).toEqual({});
    expect(st.bag.map((g) => g.uid)).toEqual(['b', 'a']);
    const c = cleanBag({ bag: [a, { uid: 1 } as unknown as RtGear], equip: { weapon: b, head: a } });
    expect(c.bag).toEqual([a]);
    expect(c.equip).toEqual({ weapon: b });
  });
});

describe('強化與錢包（D-092）', () => {
  it('費用與成功率；強化提高數值；分解給粉塵', async () => {
    const { enhanceCost, salvageDust, gearTitle } = await import('../src/core/battle/rt/gear');
    expect(enhanceCost(0)).toEqual({ dust: 4, crystal: 0, rate: 100 });
    expect(enhanceCost(4).rate).toBe(100);
    expect(enhanceCost(5)).toMatchObject({ crystal: 1, rate: 86 });
    expect(enhanceCost(9).rate).toBeGreaterThanOrEqual(30);
    const g: RtGear = { uid: 'w', slot: 'weapon', rarity: 2, ilvl: 4, name: '劍', base: { atk: 10 }, affixes: [] };
    expect(gearBonus([{ ...g, enh: 5 }], 600, 34).atk).toBe(15);
    expect(gearTitle({ ...g, enh: 3 })).toBe('+3 劍');
    expect(salvageDust({ ...g, enh: 2 })).toBe(4 + 2 + 2);
  });
  it('錢包＝累計撿到 − 花掉；不夠就不能花；分解是負的花費', async () => {
    const { walletOf, spend } = await import('../src/game/rtRecord');
    const r0 = { dust: 20, crystal: 1 };
    expect(walletOf(r0)).toEqual({ dust: 20, crystal: 1 });
    const r1 = spend(r0, 12, 1)!;
    expect(walletOf(r1)).toEqual({ dust: 8, crystal: 0 });
    expect(spend(r1, 9, 0)).toBeNull();
    expect(walletOf(spend(r1, -5, 0)!)).toEqual({ dust: 13, crystal: 0 });
  });
});
