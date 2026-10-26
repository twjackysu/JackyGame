// 法杖（D-152）：第三種武器；武器表 WEAPONS（劍／弓的結果不變由 stateHash 回歸檢查保證）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAGE, STAFF_SKILLS, STAFF_VARIANTS, STAFF_VARIANTS_B, STAGES, SWORDSMAN, WEAPONS, WEAPON_IDS, BOW_SKILLS, SKILLS } from '../src/core/battle/rt/data';
import { createBattle, dashDistance, playerDef, skillDef, step } from '../src/core/battle/rt/engine';
import { toggleVariant } from '../src/game/rtSkills';
import { gearName, gearTitleW } from '../src/game/weapon';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec, u } from '../src/core/battle/rt/types';

const out = (t: string) => (globalThis as any).process.stdout.write(t + '\n');

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
});
afterAll(() => {
  delete STAGES.mistwood;
});

describe('武器表與法杖（D-152）', () => {
  it('每把武器五招 id 相同、招式名（含兩種變化）三把武器之間都不重複', () => {
    const names = new Set<string>();
    for (const w of WEAPON_IDS) {
      const W = WEAPONS[w];
      for (const id of SWORDSMAN.skills) {
        expect(W.skills[id]?.id).toBe(id);
        expect(W.variants[id]?.id).toBe(id);
        expect(W.variantsB[id]?.id).toBe(id);
        for (const n of [W.skills[id]!.name, W.variants[id]!.variantName, W.variantsB[id]!.variantName]) {
          expect(names.has(n), n).toBe(false);
          names.add(n);
        }
      }
    }
    expect(WEAPONS.sword.skills).toBe(SKILLS);
    expect(WEAPONS.bow.skills).toBe(BOW_SKILLS);
  });

  it('法杖：普攻 4.5 格、比劍士脆、閃現往前 5 格、變化切換', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 1, weapon: 'staff' });
    expect(s.weapon).toBe('staff');
    expect(playerDef(s)).toBe(MAGE);
    expect(skillDef(s, 'charge')!.name).toBe('閃現');
    expect(dashDistance(s, 'charge')).toBe(u(5));
    expect(s.units[0]!.maxHp).toBeLessThan(createBattle({ stageId: 'mistwood', seed: 1 }).units[0]!.maxHp);
    const v = createBattle({ stageId: 'mistwood', seed: 1, weapon: 'staff', skillVariants: ['heavy_slash', 'charge:b'] });
    expect(skillDef(v, 'heavy_slash')).toBe(STAFF_VARIANTS.heavy_slash);
    expect(skillDef(v, 'charge')).toBe(STAFF_VARIANTS_B.charge);
    expect(skillDef(v, 'parry')).toBe(STAFF_SKILLS.parry);
    const r = { heavy_slash: 5 };
    const a = toggleVariant([], 'heavy_slash', r, 'staff')!;
    expect(a).toEqual(['heavy_slash']);
    expect(toggleVariant(a, 'heavy_slash', r, 'staff')).toEqual(['heavy_slash:b']);
    expect(toggleVariant(['heavy_slash:b'], 'heavy_slash', r, 'staff')).toEqual([]);
  });

  it('所有武器的位移技能每 tick 最多 50（太快會穿進障礙物裡卡住，D-153）', () => {
    for (const w of WEAPON_IDS) for (const tbl of [WEAPONS[w].skills, WEAPONS[w].variants, WEAPONS[w].variantsB]) for (const sk of Object.values(tbl)) {
      if (sk.dash) expect(Math.abs(sk.dash.distance) / sk.dash.ticks, `${w} ${sk.name}`).toBeLessThanOrEqual(50);
    }
  });

  it('武器欄裝備的顯示名跟著武器換字', () => {
    expect(gearName({ slot: 'weapon', name: '鋒利的王牙大劍・旋' }, 'staff')).toBe('鋒利的王牙法杖・旋');
    expect(gearName({ slot: 'weapon', name: '霧鋼劍' }, 'bow')).toBe('霧鋼弓');
    expect(gearName({ slot: 'weapon', name: '霧鋼劍' }, 'sword')).toBe('霧鋼劍');
    expect(gearName({ slot: 'ring', name: '狼牙戒' }, 'staff')).toBe('狼牙戒');
    expect(gearTitleW({ slot: 'weapon', name: '夜燼・嗜血的鐵劍', enh: 3 }, 'staff')).toBe('+3 夜燼・嗜血的鐵杖');
  });

  it('閃現：瞬移 5 格（開場面向北）', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 3, weapon: 'staff' });
    const p = s.units[0]!;
    const y0 = p.y;
    step(s, [{ type: 'skill', id: 'charge' }]);
    for (let i = 0; i < sec(0.5); i++) step(s, []);
    expect(y0 - p.y).toBeGreaterThan(u(3.5));
  });

  it('三種 Bot 用法杖（原招／變化／變化二）都打得倒霧角狼王', () => {
    const rows: string[] = [];
    let fails = 0;
    const sets: (string[] | undefined)[] = [undefined, ['heavy_slash', 'whirlwind', 'charge', 'parry', 'blade_storm'], ['heavy_slash:b', 'whirlwind:b', 'charge:b', 'parry:b', 'blade_storm:b']];
    for (const who of ['novice', 'normal', 'expert'] as const) {
      sets.forEach((vv, k) => {
        const res = [1, 2].map((seed) => {
          const s = createBattle({ stageId: 'mistwood', seed, level: who === 'novice' ? 6 : 5, weapon: 'staff', skillVariants: vv });
          const bot = new PlayerBot({ ...BOT_PROFILES[who], ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, who);
          let engaged = -1;
          while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(1500)) {
            step(s, bot.decide(s));
            if (engaged < 0 && s.units.some((x) => x.defId === 'wolf_king' && !x.dead && x.mode === 'combat')) engaged = s.tick;
          }
          return { killed: (s.bossKills ?? []).length > 0, total: Math.round(s.tick / 30), fight: Math.round((s.tick - Math.max(0, engaged)) / 30), downs: s.revives ?? 0 };
        });
        rows.push(`${who} 法杖${['原招', '變化', '變化二'][k]}：${res.map((x) => (x.killed ? `全程 ${x.total}s／狼王 ${x.fight}s／倒 ${x.downs}` : `未打倒(${x.total}s 倒 ${x.downs})`)).join('、')}`);
        fails += res.filter((x) => !x.killed).length;
      });
    }
    out(rows.join('\n'));
    expect(fails).toBe(0);
  }, 300000);
});
