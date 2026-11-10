// D-345（P1-c1）：第 4 欄（id 仍是 parry）三把武器 × 三種打法換成「攻守一體」——
// 施放瞬間給自己護盾（最大 HP 的固定比例）、同時打一下；沒有時機窗口，所以可以自動施放。
import { describe, expect, it } from 'vitest';
import { AUTO_SKILL_DEFAULT, autoPick } from '../src/core/battle/rt/auto';
import { BOW_SKILLS, BOW_VARIANTS, BOW_VARIANTS_B, SKILLS, SKILL_VARIANTS, SKILL_VARIANTS_B, STAFF_SKILLS, STAFF_VARIANTS, STAFF_VARIANTS_B } from '../src/core/battle/rt/data';
import { createBattle, guardAmount, playerOf, skillDef, stateHash, step } from '../src/core/battle/rt/engine';
import { gearSkillMods, specialText } from '../src/core/battle/rt/gear';
import { modApplies, rankMods } from '../src/core/meta/skills';
import type { BattleState, Unit } from '../src/core/battle/rt/types';

type W = 'sword' | 'bow' | 'staff';
const WS: W[] = ['sword', 'bow', 'staff'];
const VARS: (string[] | undefined)[] = [undefined, ['parry'], ['parry:b']];
const mk = (weapon: W, skillVariants?: string[], extra: Record<string, unknown> = {}): BattleState =>
  createBattle({ stageId: 'forest_entry', seed: 7, weapon: weapon === 'sword' ? undefined : weapon, skillVariants, ...extra });
/** 把場上的怪換成指定位置的幾隻（交戰中、暫時不會出手） */
function arrange(s: BattleState, at: [number, number][]): Unit[] {
  const p = playerOf(s);
  const proto = s.units.find((u) => u.side === 'enemy')!;
  const es = at.map(([dx, dy], i) => ({ ...structuredClone(proto), id: 900 + i, x: p.x + dx, y: p.y + dy, dead: false, hp: 100000, maxHp: 100000, mode: 'combat' as const, nextAttackTick: 1e9 }));
  s.units = [p, ...es];
  return es;
}

describe('第 4 欄攻守一體（D-345）', () => {
  it('九招都沒有格擋判定、都有護盾與一段打擊、名字互不相同、施放中可以走', () => {
    const names = new Set<string>();
    for (const w of WS)
      for (const v of VARS) {
        const s = mk(w, v);
        const sk = skillDef(s, 'parry')!;
        expect(sk.block, sk.name).toBeUndefined();
        expect(sk.role).toBe('guard');
        expect(sk.guard!.hpPct).toBeGreaterThanOrEqual(5);
        expect(sk.hits.length).toBe(1);
        expect(sk.hits[0]!.mult).toBeGreaterThan(0);
        expect(sk.moveFactor).toBeGreaterThan(0);
        expect(sk.dash).toBeUndefined();
        names.add(sk.name);
      }
    expect(names.size).toBe(9);
    // 玩家的招式裡已經沒有任何一招用格擋判定
    const all = [SKILLS, BOW_SKILLS, STAFF_SKILLS, SKILL_VARIANTS, SKILL_VARIANTS_B, BOW_VARIANTS, BOW_VARIANTS_B, STAFF_VARIANTS, STAFF_VARIANTS_B].flatMap((t) => Object.values(t));
    for (const sk of all) expect((sk as { block?: unknown }).block).toBeUndefined();
  });

  it('放了就有護盾（不看時機）：護盾量＝最大 HP × 比例，先扣護盾再扣血，時間到就沒了；同時打到形狀裡的敵人', () => {
    for (const w of WS)
      for (const v of VARS) {
        const s = mk(w, v);
        const p = playerOf(s);
        const sk = skillDef(s, 'parry')!;
        const [e] = arrange(s, [[150, 0]]);
        p.targetId = e!.id;
        step(s, [{ type: 'skill', id: 'parry' }]);
        const want = Math.floor((p.maxHp * sk.guard!.hpPct) / 100);
        const g = s.events.find((x) => x.type === 'guard');
        expect(g && g.type === 'guard' && g.amount, sk.name).toBe(want);
        expect(guardAmount(s, 'parry', p)).toBe(want);
        const sh = p.statuses.find((q) => q.id === 'shield')!;
        expect(sh.value).toBe(want);
        for (let i = 0; i < 12; i++) step(s);
        expect(s.events.some((x) => x.type === 'damage' && x.dst === e!.id && x.skill === 'parry' && x.origin === 'skill'), sk.name).toBe(true);
        expect(s.events.some((x) => x.type === 'block')).toBe(false);
        // 護盾還在的時候再放不會疊加（冷卻比持續久，這裡直接把冷卻清掉驗）
        p.ready['parry'] = 0;
        step(s, [{ type: 'skill', id: 'parry' }]);
        expect(p.statuses.find((q) => q.id === 'shield')!.value).toBe(want);
        for (let i = 0; i < sk.guard!.ticks + 2; i++) step(s);
        const left = p.statuses.find((q) => q.id === 'shield');
        expect(!left || left.until <= s.tick).toBe(true);
      }
  });

  it('技能點與舊裝備的「格擋窗口」變成護盾量 +5%／點（上限 6 點）；面板與裝備寫的是同一個數字', () => {
    const mods = rankMods({ parry: 5 });
    expect(mods.parry).toEqual({ dmgPct: 30, blockTicks: 2 });
    const a = mk('sword');
    const b = mk('sword', undefined, { skillMods: mods });
    const pa = playerOf(a);
    expect(guardAmount(b, 'parry', playerOf(b))).toBe(Math.floor((pa.maxHp * 12 * 110) / 10000));
    const old = { id: 'g', slot: 'weapon', rarity: 3, ilvl: 10, affixes: [], special: { skill: 'parry', kind: 'block', value: 4 } } as never;
    expect(gearSkillMods([old]).parry).toEqual({ blockTicks: 4 });
    expect(specialText({ skill: 'parry', kind: 'block', value: 4 })).toBe('★ 鐵壁斬護盾 +20%');
    for (const w of WS) for (const v of VARS) expect(modApplies(skillDef(mk(w, v), 'parry')!, 'blockTicks')).toBe(true);
  });

  it('自動施放：預設就開；範圍內有交戰中的敵人就放、沒有就不放；敵人的預告快打到自己時優先放', () => {
    expect(AUTO_SKILL_DEFAULT).toContain('parry');
    for (const w of WS) {
      const s = mk(w, undefined, { autoSkills: ['parry', 'heavy_slash'] });
      const p = playerOf(s);
      const [e] = arrange(s, [[150, 0]]);
      p.targetId = e!.id;
      // 平常：重斬欄排在前面
      expect(autoPick(s, p)?.id).toBe('heavy_slash');
      // 預告 8 tick 後打在腳下：先墊護盾
      s.telegraphs.push({ ownerId: e!.id, attackId: 'x', shape: { type: 'circle', r: 200 }, ox: p.x, oy: p.y, dirX: 1000, dirY: 0, hitTick: s.tick + 8, startTick: s.tick, blockable: false });
      expect(autoPick(s, p)?.id).toBe('parry');
      s.telegraphs.length = 0;
      p.ready['heavy_slash'] = 1e9;
      expect(autoPick(s, p)?.id).toBe('parry');
      // 敵人太遠（打不到）：不對空放
      e!.x = p.x + 3000;
      expect(autoPick(s, p)).toBeNull();
    }
  });

  it('可重播：同種子同設定結果一樣', () => {
    const run = (): BattleState => {
      const s = mk('staff', ['parry:b'], { autoSkills: ['parry', 'heavy_slash', 'whirlwind'] });
      for (let i = 0; i < 900 && s.outcome === 'running'; i++) step(s, i === 0 ? [{ type: 'target', id: s.units.find((u) => u.side === 'enemy')!.id }] : []);
      return s;
    };
    const a = run();
    expect(stateHash(a)).toBe(stateHash(run()));
    expect(a.events.some((e) => e.type === 'cast' && e.skill === 'parry' && e.auto)).toBe(true);
  });
});
