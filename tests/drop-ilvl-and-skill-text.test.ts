// 第 157 輪（D-340）：RF-02a 成品物品等級對照、RF-05b 技能點說明只寫實際有作用的加成。
import { describe, expect, it } from 'vitest';
import { WEAPONS, WEAPON_IDS } from '../src/core/battle/rt/data';
import { GEAR_ILVL_MAX, genGear } from '../src/core/battle/rt/gear';
import { HIDDEN_GROUP, dropIlvlRange, rollEnemyLoot, type LootContext } from '../src/core/battle/rt/loot';
import { makeEmberriftStage } from '../src/core/battle/rt/maps/emberrift';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { makeStarfallStage } from '../src/core/battle/rt/maps/starfall';
import { makeThornvaleStage } from '../src/core/battle/rt/maps/thornvale';
import type { StageDefinition } from '../src/core/battle/rt/types';
import { SKILL_MAX_RANK, SKILL_TREE, dotOf, modApplies, rankMods, rankTotalText } from '../src/core/meta/skills';

const STAGES_ALL: StageDefinition[] = [makeMistwoodStage(), makeThornvaleStage(), makeEmberriftStage(), makeStarfallStage()];

/** 實際擲骰：這個情境下掉出來的裝備（成品）物品等級 */
function rolled(c: LootContext): number[] {
  const out: number[] = [];
  let x = 12345;
  const rand = (): number => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x80000000;
  };
  for (let i = 0; i < 400 && out.length < 6; i++) rollEnemyLoot(c, rand, (kind, amount, rarity) => {
    if (kind === 'gear') out.push(genGear(1000 + i, rarity ?? 1, amount).ilvl);
  });
  return out;
}

describe('成品物品等級（RF-02a，D-340）', () => {
  it('dropIlvlRange 和實際擲骰一致：每張圖每一群、白天／深夜、Boss 一般／暴怒', () => {
    let checked = 0;
    for (const st of STAGES_ALL) {
      for (const night of [false, true]) {
        for (const g of st.spawnGroups ?? []) {
          if (g.nightOnly && !night) continue;
          const got = rolled({ stageId: st.id, defId: g.enemyId, groupId: g.id, night, fury: false, affix: false, firstKill: false });
          const r = dropIlvlRange(st, g.enemyId, { night });
          if (!st.gearDrops?.[g.enemyId]) continue;
          expect(r, `${st.id} ${g.enemyId}`).not.toBeNull();
          for (const v of got) expect(v >= r!.min && v <= r!.max, `${st.id} ${g.id} ${g.enemyId} night=${night}：掉 ${v}，表寫 ${r!.min}～${r!.max}`).toBe(true);
          checked += got.length;
        }
        st.enemies.forEach((e, fixedIdx) => {
          for (const fury of [false, true]) {
            const isBoss = !!st.bossZone && !!st.gearDrops?.[e.enemyId]?.firstRare;
            if (fury && !isBoss) continue;
            const got = rolled({ stageId: st.id, defId: e.enemyId, fixedIdx, night, fury, affix: false, firstKill: false });
            const r = dropIlvlRange(st, e.enemyId, { night, fury });
            if (!got.length) return;
            for (const v of got) expect(v >= r!.min && v <= r!.max, `${st.id} ${e.enemyId} fury=${fury} night=${night}：掉 ${v}，表寫 ${r!.min}～${r!.max}`).toBe(true);
            checked += got.length;
          }
        });
      }
      if (st.hiddenElite) {
        const id = st.hiddenElite.enemyId;
        const r = dropIlvlRange(st, id, { hidden: true })!;
        for (const v of rolled({ stageId: st.id, defId: id, groupId: HIDDEN_GROUP, night: false, fury: false, affix: false, firstKill: false })) expect(v).toBe(r.max);
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('上限 12 是終點：沒有任何情境掉得出更高的；星隕高原的 Boss 白天就頂到上限（深夜／暴怒給的是件數與稀有度，不是等級）', () => {
    const sf = STAGES_ALL[3]!;
    expect(dropIlvlRange(sf, 'star_sentinel')).toEqual({ min: GEAR_ILVL_MAX, max: GEAR_ILVL_MAX, capped: true });
    expect(dropIlvlRange(sf, 'star_sentinel', { night: true, fury: true })).toEqual({ min: GEAR_ILVL_MAX, max: GEAR_ILVL_MAX, capped: true });
    expect(genGear(7, 3, 99).ilvl).toBe(GEAR_ILVL_MAX);
    // 白天沒有的怪（深夜限定）回 null
    expect(dropIlvlRange(sf, 'eclipse_wolf')).toBeNull();
    expect(dropIlvlRange(sf, 'eclipse_wolf', { night: true })).not.toBeNull();
    // 不是 Boss 問暴怒 → null
    expect(dropIlvlRange(sf, 'star_wolf', { fury: true })).toBeNull();
  });
});

describe('技能點說明（RF-05b）', () => {
  it('三把武器每一種打法（原招／變化／變化二）都吃得到這一欄技能點的每一項加成', () => {
    for (const w of WEAPON_IDS) {
      for (const t of SKILL_TREE) {
        for (const def of [WEAPONS[w].skills[t.id], WEAPONS[w].variants[t.id], WEAPONS[w].variantsB[t.id]]) {
          expect(def, `${w} ${t.id}`).toBeDefined();
          for (const k of Object.keys(t.mod(SKILL_MAX_RANK)) as (keyof ReturnType<typeof t.mod>)[]) expect(modApplies(def!, k), `${w}「${def!.name}」吃不到 ${k}，面板卻寫了`).toBe(true);
        }
      }
    }
  });

  it('「現在的加成」和實際套用的是同一份數字', () => {
    expect(rankTotalText('heavy_slash', 0)).toBe('');
    expect(rankTotalText('heavy_slash', 3)).toBe(`傷害 +${rankMods({ heavy_slash: 3 }).heavy_slash!.dmgPct}%`);
    expect(rankTotalText('whirlwind', 5)).toBe('範圍 +30%・傷害 +15%');
    expect(rankTotalText('charge', 2)).toBe('冷卻 −10%・距離 +8%');
    expect(rankTotalText('parry', 1)).toBe('傷害 +6%');
    expect(rankTotalText('parry', 4)).toBe('傷害 +24%・護盾 +10%');
    expect(rankTotalText('blade_storm', 5)).toBe('傷害 +40%・冷卻 −15%');
  });

  it('有持續傷害的打法認得出來（面板會提醒「傷害加成只算直接命中」）', () => {
    expect(dotOf(WEAPONS.bow.variantsB.heavy_slash!)).toBe('burn');
    expect(dotOf(WEAPONS.staff.variantsB.heavy_slash!)).toBe('poison');
    expect(dotOf(WEAPONS.sword.skills.heavy_slash!)).toBeNull();
    expect(dotOf(WEAPONS.sword.variantsB.heavy_slash!)).toBeNull(); // 破甲不是持續傷害
  });
});
