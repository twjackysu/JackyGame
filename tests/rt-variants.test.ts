// 技能變化（D-112）：技能滿 5 級可以切換成另一種招式（同一顆按鈕、同一個 id）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SKILL_VARIANTS, SKILL_VARIANTS_B, SKILLS, STAGES } from '../src/core/battle/rt/data';
import { blockWindow, createBattle, dashDistance, setBossFury, setSkillVariants, skillDef, stateHash, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage, MISTWOOD_KING } from '../src/core/battle/rt/maps/mistwood';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import { sec, u } from '../src/core/battle/rt/types';
import { SKILL_TREE, cleanVariants, rankMods, toggleVariant, variantIndex, type SkillRanks } from '../src/game/rtSkills';

const out = (s: string) => (globalThis as unknown as { process: { stdout: { write: (x: string) => void } } }).process.stdout.write(s);

beforeAll(() => {
  STAGES.mistwood = makeMistwoodStage();
});
afterAll(() => {
  delete STAGES.mistwood;
});

describe('技能變化（D-112）', () => {
  it('五個技能都有變化版、id 相同、名字不同', () => {
    for (const t of SKILL_TREE) {
      const v = SKILL_VARIANTS[t.id];
      expect(v).toBeDefined();
      expect(v!.id).toBe(t.id);
      expect(v!.name).not.toBe(SKILLS[t.id]!.name);
      expect(v!.desc.length).toBeGreaterThan(10);
    }
  });

  it('滿 5 級才能切換；退點或壞資料自動失效', () => {
    const r: SkillRanks = { heavy_slash: 5, charge: 4 };
    expect(toggleVariant([], 'charge', r)).toBeNull();
    expect(toggleVariant([], 'dragon', r)).toBeNull();
    const v = toggleVariant([], 'heavy_slash', r)!;
    expect(v).toEqual(['heavy_slash']);
    // D-121：原招 → 變化 → 變化二 → 原招
    const vb = toggleVariant(v, 'heavy_slash', r)!;
    expect(vb).toEqual(['heavy_slash:b']);
    expect(toggleVariant(vb, 'heavy_slash', r)).toEqual([]);
    expect(cleanVariants(['heavy_slash', 'charge', 'dragon', 3, 'heavy_slash'], r)).toEqual(['heavy_slash']);
    expect(cleanVariants(['heavy_slash'], {})).toEqual([]);
    expect(cleanVariants('x', r)).toEqual([]);
  });

  it('變化版真的進到戰鬥：冷卻、衝刺距離、格擋窗口、名字；沒選變化時跟原本一模一樣', () => {
    const a = createBattle({ stageId: 'mistwood', seed: 1 });
    const b = createBattle({ stageId: 'mistwood', seed: 1, skillVariants: ['charge', 'parry', 'heavy_slash', 'nope'] });
    expect(b.skillVariants).toEqual(['charge', 'heavy_slash', 'parry']);
    expect(skillDef(b, 'charge')!.name).toBe('流星衝');
    expect(skillDef(a, 'charge')!.name).toBe('衝鋒');
    expect(dashDistance(b, 'charge')).toBe(u(6));
    expect(dashDistance(a, 'charge')).toBe(u(4));
    expect(blockWindow(b, 'parry')).toBe(24);
    step(a, [{ type: 'skill', id: 'heavy_slash' }]);
    step(b, [{ type: 'skill', id: 'heavy_slash' }]);
    expect(a.units[0]!.ready.heavy_slash! - a.tick).toBe(sec(4));
    expect(b.units[0]!.ready.heavy_slash! - b.tick).toBe(sec(5));
    // 空陣列＝原本版本，stateHash 相同
    const c = createBattle({ stageId: 'mistwood', seed: 1 });
    const d = createBattle({ stageId: 'mistwood', seed: 1, skillVariants: [] });
    for (let i = 0; i < 90; i++) {
      step(c, []);
      step(d, []);
    }
    expect(stateHash(d)).toBe(stateHash(c));
    setSkillVariants(d, ['whirlwind']);
    expect(skillDef(d, 'whirlwind')!.moveFactor).toBe(1);
    setSkillVariants(d, []);
    expect(d.skillVariants).toBeUndefined();
  });

  it('裂地斬打得到 4 格外的怪（原版重斬 2 格打不到）', () => {
    for (const [vars, want] of [[[], false], [['heavy_slash'], true]] as const) {
      const s = createBattle({ stageId: 'mistwood', seed: 1, skillVariants: [...vars] });
      step(s, []);
      const p = s.units[0]!;
      const e = s.units.find((x) => x.side === 'enemy' && !x.dead && x.defId === 'wolf')!;
      for (const o of s.units) if (o !== p && o !== e) o.dead = true;
      p.x = e.x;
      p.y = e.y + u(3.8);
      p.targetId = e.id;
      const hp0 = e.hp;
      step(s, [{ type: 'skill', id: 'heavy_slash' }]);
      for (let i = 0; i < sec(0.5); i++) step(s, []);
      const hit = s.events.some((x) => x.type === 'damage' && x.dst === e.id && x.origin === 'skill' && x.skill === 'heavy_slash');
      expect(hit).toBe(want);
      expect(e.hp < hp0).toBe(want);
    }
  });

  it('Lv11 普通 Bot：四種點法（含變化）都打得倒暴怒狼王', () => {
    const rows: string[] = [];
    const bonus = { hp: 450, atk: 45, def: 25 };
    for (const [name, ranks, vars] of [
      ['原招 重斬5＋旋風5', { heavy_slash: 5, whirlwind: 5 }, []],
      ['裂地斬＋龍捲', { heavy_slash: 5, whirlwind: 5 }, ['heavy_slash', 'whirlwind']],
      ['流星衝＋不動架勢', { charge: 5, parry: 5 }, ['charge', 'parry']],
      ['星落一閃＋裂地斬', { blade_storm: 5, heavy_slash: 5 }, ['blade_storm', 'heavy_slash']],
      // D-121 變化二
      ['碎甲斬＋霜旋', { heavy_slash: 5, whirlwind: 5 }, ['heavy_slash:b', 'whirlwind:b']],
      ['影步＋迴光一閃', { charge: 5, parry: 5 }, ['charge:b', 'parry:b']],
      ['破空斬月＋碎甲斬', { blade_storm: 5, heavy_slash: 5 }, ['blade_storm:b', 'heavy_slash:b']],
    ] as const) {
      const res = [1, 2].map((seed) => {
        const s = createBattle({ stageId: 'mistwood', seed, level: 11, bonus, skillMods: rankMods(ranks), skillVariants: [...vars] });
        setBossFury(s, true);
        const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 40, campfireBelowPotions: 8, advanceTo: MISTWOOD_KING }, 'normal');
        let engaged = -1;
        while (s.outcome === 'running' && !(s.bossKills ?? []).length && s.tick < sec(1200)) {
          step(s, bot.decide(s));
          if (engaged < 0 && s.units.some((x) => x.defId === 'wolf_king' && !x.dead && x.mode === 'combat')) engaged = s.tick;
        }
        return { killed: (s.bossKills ?? []).length > 0, fight: Math.round((s.tick - Math.max(0, engaged)) / 30), downs: s.revives ?? 0 };
      });
      rows.push(`${name}：${res.map((x) => (x.killed ? `${x.fight}s/倒${x.downs}` : '未打倒')).join('、')}`);
      for (const x of res) expect(x.killed).toBe(true);
    }
    out(`\n[技能變化 暴怒狼王 Lv11]\n${rows.join('\n')}\n`);
  }, 300000);
});

describe('技能第二種變化（D-121）', () => {
  it('五個技能都有變化二、名字和原招／變化都不同；存檔寫成 id:b、同一技能只留一種', () => {
    for (const t of SKILL_TREE) {
      const b = SKILL_VARIANTS_B[t.id]!;
      expect(b.id).toBe(t.id);
      expect(new Set([b.name, SKILL_VARIANTS[t.id]!.name, SKILLS[t.id]!.name]).size).toBe(3);
      expect(b.desc.length).toBeGreaterThan(10);
    }
    const r: SkillRanks = { heavy_slash: 5, whirlwind: 5, charge: 3 };
    expect(cleanVariants(['heavy_slash:b', 'heavy_slash', 'whirlwind:b', 'charge:b', 'x:b'], r)).toEqual(['heavy_slash:b', 'whirlwind:b']);
    expect(variantIndex(['heavy_slash:b'], 'heavy_slash')).toBe(2);
    const s = createBattle({ stageId: 'mistwood', seed: 1, skillVariants: ['heavy_slash:b', 'parry:b', 'nope:b'] });
    expect(s.skillVariants).toEqual(['heavy_slash:b', 'parry:b']);
    expect(skillDef(s, 'heavy_slash')!.name).toBe('碎甲斬');
    expect(skillDef(s, 'parry')!.name).toBe('迴光一閃');
    expect(blockWindow(s, 'parry')).toBe(9);
    expect(skillDef(s, 'charge')!.name).toBe('衝鋒');
  });

  for (const [id, status] of [['heavy_slash', 'break'], ['whirlwind', 'freeze'], ['charge', 'weak']] as const) {
    it(`${SKILL_VARIANTS_B[id]!.name}：打中的狼身上有 ${status}`, () => {
      const s = createBattle({ stageId: 'mistwood', seed: 1, skillVariants: [`${id}:b`] });
      step(s, []);
      const p = s.units[0]!;
      const e = s.units.find((x) => x.side === 'enemy' && !x.dead && x.defId === 'wolf')!;
      for (const o of s.units) if (o !== p && o !== e) o.dead = true;
      p.x = e.x;
      p.y = e.y + u(1.2);
      p.targetId = e.id;
      p.facingX = 0;
      p.facingY = -1000;
      step(s, [{ type: 'skill', id }]);
      let got = false;
      for (let i = 0; i < sec(0.8) && !got; i++) {
        step(s, []);
        got = e.statuses.some((x) => x.id === status);
      }
      expect(got).toBe(true);
    });
  }
});
