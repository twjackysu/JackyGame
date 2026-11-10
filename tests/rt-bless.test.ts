// P2-a（第 158 輪，D-343）：燼火祝福的核心——擊殺累積 → 三選一 → 這趟暫時擁有 → 回營火休息／倒下清空。
// 效果資料在 effects.ts（P3 的獨特效果裝備會從同一池取用）；結算都在 core，畫面還沒接（P2-b）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAGES, WEAPONS } from '../src/core/battle/rt/data';
import { BLESS_RULES, EFFECT_IDS, EFFECTS, blessNeed, effectDef, mergeEffectMods, tryVariantId } from '../src/core/battle/rt/effects';
import { createBattle, playerOf, setSkillMods, skillDef, skillShape, stateHash, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { BOT_PROFILES, PlayerBot } from '../src/core/battle/rt/sim';
import type { BattleCommand, BattleState, Unit } from '../src/core/battle/rt/types';

type W = 'sword' | 'bow' | 'staff';
const mk = (weapon: W = 'sword', bless = true, seed = 7, extra: Partial<Parameters<typeof createBattle>[0]> = {}): BattleState =>
  createBattle({ stageId: 'mistwood', seed, weapon: weapon === 'sword' ? undefined : weapon, bless, ...extra });
const evs = <T extends BattleState['events'][number]['type']>(s: BattleState, type: T) => s.events.filter((e): e is Extract<BattleState['events'][number], { type: T }> => e.type === type);
/** 把一隻怪擺到主角旁邊、設成交戰中、血量改成 hp */
function wolfAt(s: BattleState, dx: number, dy: number, hp = 1, n = 0): Unit {
  const p = playerOf(s);
  const e = s.units.filter((u) => u.side === 'enemy' && !u.dead && u.tier === 'normal' && u.mode !== 'combat')[n]!;
  e.x = p.x + dx;
  e.y = p.y + dy;
  e.homeX = e.x;
  e.homeY = e.y;
  e.mode = 'combat';
  e.engagedTick = s.tick;
  e.hp = hp;
  e.hitstunUntil = 1e9; // 不讓牠動（只測祝福）
  return e;
}
/** 主角離開營火安全區（安全區裡怪會脫戰） */
function leaveCamp(s: BattleState): void {
  const p = playerOf(s);
  p.y -= 1500;
  p.x += 300;
}
const give = (s: BattleState, ...ids: string[]): void => {
  for (const id of ids) {
    s.bless!.offer = [id];
    step(s, [{ type: 'bless', pick: 0 }]);
  }
};
/** 打倒 n 隻（一隻一隻擺到面前讓普攻打死） */
function killWolves(s: BattleState, n: number, cmd: () => BattleCommand[] = () => []): void {
  for (let k = 0; k < n; k++) {
    const e = wolfAt(s, 110, 0);
    playerOf(s).targetId = e.id;
    for (let i = 0; i < 90 && !e.dead; i++) step(s, cmd());
    expect(e.dead, `第 ${k + 1} 隻打倒了`).toBe(true);
  }
}

describe('燼火祝福核心（P2-a）', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });

  it('效果池：每個效果都有名字、短說明、元素；「試招」三把武器 × 五欄 × 兩種變化都查得到', () => {
    expect(EFFECT_IDS.length).toBeGreaterThanOrEqual(8);
    for (const id of EFFECT_IDS) {
      const d = EFFECTS[id]!;
      expect(d.name.length).toBeGreaterThan(0);
      for (const w of ['sword', 'bow', 'staff'] as W[]) {
        const desc = effectDef(id, w)!.desc;
        expect(desc.length, `${id} 的說明手機上要看得完`).toBeLessThanOrEqual(26);
        expect(desc, '招式名換好了').not.toContain('{');
      }
      expect(['fire', 'ice', 'thunder', 'poison', 'phys', 'light', 'dark']).toContain(d.element);
    }
    for (const w of ['sword', 'bow', 'staff'] as W[])
      for (const skill of Object.keys(WEAPONS[w].skills))
        for (const k of [1, 2] as const) {
          const d = effectDef(tryVariantId(skill, k), w)!;
          expect(d.variant).toEqual({ skill, idx: k });
          expect(d.name).toContain((k === 1 ? WEAPONS[w].variants : WEAPONS[w].variantsB)[skill]!.variantName);
        }
    expect(effectDef('try:nope:1')).toBeUndefined();
    expect(mergeEffectMods({ whirlwind: { dmgPct: 10 } }, [EFFECTS.wide_arc!, EFFECTS.quick_hands!])!.whirlwind).toEqual({ dmgPct: 25, areaPct: 30, cdPct: 20 });
  });

  it('沒開＝完全沒有（預設、其他地圖、PvP）：不出事件、雜湊和以前一樣', () => {
    const a = mk('sword', false);
    expect(a.bless).toBeUndefined();
    expect(createBattle({ stageId: 'forest_entry', seed: 1, bless: true }).bless).toBeUndefined();
    const b = createBattle({ stageId: 'mistwood', seed: 7 });
    for (let i = 0; i < 300; i++) {
      step(a);
      step(b);
    }
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('打倒 3 隻出第一次三選一（三張不重複）；選了就拿到、計量歸零；第二次要 5 隻', () => {
    const s = mk();
    leaveCamp(s);
    killWolves(s, 2);
    expect(s.bless!.offer).toBeUndefined();
    killWolves(s, 1);
    const offer = s.bless!.offer!;
    expect(offer.length).toBe(3);
    expect(new Set(offer).size).toBe(3);
    expect(evs(s, 'blessOffer').length).toBe(1);
    // 沒選之前繼續打也不會再出一手
    step(s, [{ type: 'bless', pick: 9 }]);
    expect(s.bless!.offer).toEqual(offer);
    step(s, [{ type: 'bless', pick: 1 }]);
    expect(s.bless!.taken).toEqual([offer[1]]);
    expect(s.bless!.offer).toBeUndefined();
    expect(s.bless!.meter).toBe(0);
    expect(evs(s, 'blessPick')[0]!.id).toBe(offer[1]);
    expect(blessNeed(1)).toBe(4); // D-351：3／5／7／8／9／10 → 3／4／5／5／6／6
    killWolves(s, 3);
    expect(s.bless!.offer).toBeUndefined();
    killWolves(s, 1);
    expect(s.bless!.offer!.length).toBe(3);
    expect(s.bless!.offer).not.toContain(offer[1]);
  });

  it('三選一：同一趟不重複、「試招」最多一張、不出現玩家已經在用的打法；重抽有次數', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = mk(seed % 3 === 0 ? 'bow' : seed % 3 === 1 ? 'staff' : 'sword', true, seed, { skillVariants: ['heavy_slash'] });
      const seen: string[] = [];
      leaveCamp(s);
      for (let n = 0; n < BLESS_RULES.max; n++) {
        // 計量灌滿，再打倒一隻（計量是擊殺時檢查的）
        s.bless!.meter = 99;
        killWolves(s, 1);
        const offer = s.bless!.offer!;
        expect(offer.length, `seed ${seed} 第 ${n + 1} 手`).toBe(3);
        expect(new Set(offer).size).toBe(3);
        if (EFFECT_IDS.filter((id) => !seen.includes(id)).length >= 3) expect(offer.filter((id) => id.startsWith('try:')).length).toBeLessThanOrEqual(1);
        expect(new Set(offer.filter((id) => id.startsWith('try:')).map((id) => id.split(':')[1])).size, '試招不會同一欄出兩張').toBe(offer.filter((id) => id.startsWith('try:')).length);
        for (const id of offer) expect(seen, `seed ${seed} 不重複`).not.toContain(id);
        expect(offer).not.toContain(tryVariantId('heavy_slash', 1));
        if (n === 0) {
          step(s, [{ type: 'bless', reroll: true }]);
          expect(s.bless!.rerolls).toBe(0);
          const again = s.bless!.offer!;
          expect(again.some((id) => !offer.includes(id))).toBe(true);
          step(s, [{ type: 'bless', reroll: true }]);
          expect(s.bless!.offer).toEqual(again); // 沒次數了
        }
        const pick = s.bless!.offer![0]!;
        s.bless!.meter = 0;
        step(s, [{ type: 'bless', pick: 0 }]);
        seen.push(pick);
      }
      // 拿滿了就不再出
      s.bless!.meter = 99;
      killWolves(s, 1);
      expect(s.bless!.offer).toBeUndefined();
      expect(s.bless!.taken.length).toBe(BLESS_RULES.max);
    }
  });

  it('餘燼之刃：普攻讓敵人灼燒', () => {
    const s = mk();
    leaveCamp(s);
    give(s, 'ember_edge');
    const e = wolfAt(s, 110, 0, 9999);
    e.maxHp = 9999;
    playerOf(s).targetId = e.id;
    for (let i = 0; i < 40; i++) step(s);
    expect(e.statuses.some((st) => st.id === 'burn')).toBe(true);
    for (let i = 0; i < 60; i++) step(s);
    expect(evs(s, 'damage').some((d) => d.origin === 'dot' && d.dst === e.id)).toBe(true);
  });

  it('燼爆：打倒的敵人炸開波及旁邊交戰中的敵人（不炸醒睡著的）；會連鎖', () => {
    const s = mk();
    leaveCamp(s);
    give(s, 'ember_burst');
    const a = wolfAt(s, 110, 0, 1, 0);
    const b = wolfAt(s, 230, 0, 1, 0);
    const c = wolfAt(s, 350, 0, 9999, 0);
    const p = playerOf(s);
    const sleeper = s.units.find((u) => u.side === 'enemy' && !u.dead && u.mode !== 'combat')!;
    sleeper.x = p.x + 110;
    sleeper.y = p.y + 130;
    sleeper.homeX = sleeper.x;
    sleeper.homeY = sleeper.y;
    const hp0 = sleeper.hp;
    p.targetId = a.id;
    for (let i = 0; i < 40 && !a.dead; i++) step(s);
    expect(a.dead).toBe(true);
    expect(b.dead, '第二隻被爆炸打倒（連鎖）').toBe(true);
    expect(c.hp).toBeLessThan(9999);
    expect(sleeper.hp).toBe(hp0);
    expect(sleeper.mode).not.toBe('combat');
    expect(evs(s, 'blessProc').filter((e) => e.id === 'ember_burst').length).toBe(2);
    expect(evs(s, 'damage').some((d) => d.skill === 'ember_burst')).toBe(true);
  });

  it('影步：閃避後 3 秒內下一擊必定暴擊（只有一擊）；沒閃避就照機率', () => {
    const s = mk();
    leaveCamp(s);
    give(s, 'shadow_step');
    const e = wolfAt(s, 110, 0, 99999);
    e.maxHp = 99999;
    const p = playerOf(s);
    p.maxHp = p.hp = 1e6; // 附近的狼會醒來咬人：這裡只測暴擊
    p.targetId = e.id;
    let crits = 0;
    for (let round = 0; round < 12; round++) {
      const from = s.events.length;
      step(s, [{ type: 'dodge', dx: 0, dy: 1 }]);
      p.ready['dodge'] = 0;
      for (let i = 0; i < 60; i++) {
        p.x = e.x - 110;
        p.y = e.y;
        step(s);
      }
      const hits = s.events.slice(from).filter((d) => d.type === 'damage' && d.src === p.id && d.origin !== 'dot');
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]!.type === 'damage' && hits[0]!.crit, `第 ${round + 1} 次閃避後的第一擊`).toBe(true);
      crits += hits.slice(1).filter((d) => d.type === 'damage' && d.crit).length;
    }
    expect(s.bless!.critUntil).toBeUndefined();
    expect(crits).toBeLessThan(12); // 後面幾擊照原本的暴擊率
  });

  it('疾雷／廣域：技能冷卻 −20%、範圍技範圍 +30%，疊在裝備的修正上；換裝後還在', () => {
    const s = mk('sword', true, 7, { skillMods: { whirlwind: { areaPct: 10 } } });
    const base = skillDef(s, 'whirlwind')!.hits[0]!.shape;
    const r0 = (skillShape(s, 'whirlwind', base) as { r: number }).r;
    give(s, 'quick_hands', 'wide_arc');
    const r1 = (skillShape(s, 'whirlwind', base) as { r: number }).r;
    expect(r1).toBe(Math.round((r0 / 1.1) * 1.4));
    leaveCamp(s);
    wolfAt(s, 110, 0, 9999);
    step(s, [{ type: 'skill', id: 'heavy_slash' }]);
    expect(playerOf(s).ready['heavy_slash']! - s.tick).toBe(Math.round(skillDef(s, 'heavy_slash')!.cooldownTicks * 0.8));
    for (let i = 0; i < 30; i++) step(s);
    setSkillMods(s, { whirlwind: { areaPct: 20 } });
    expect((skillShape(s, 'whirlwind', base) as { r: number }).r).toBe(Math.round((r0 / 1.1) * 1.5));
    expect(s.skillMods).toEqual({ whirlwind: { areaPct: 20 } }); // 玩家自己的修正沒被祝福改掉
  });

  it('回響：第一欄技能命中後多一段 50% 的傷害；霜觸：技能命中緩速', () => {
    const s = mk();
    leaveCamp(s);
    give(s, 'heavy_echo', 'frost_touch');
    const e = wolfAt(s, 110, 0, 99999);
    e.maxHp = 99999;
    playerOf(s).targetId = e.id;
    step(s, [{ type: 'skill', id: 'heavy_slash' }]);
    for (let i = 0; i < 20; i++) step(s);
    const main = evs(s, 'damage').find((d) => d.skill === 'heavy_slash')!;
    const echo = evs(s, 'damage').find((d) => d.skill === 'heavy_echo')!;
    expect(main).toBeTruthy();
    expect(echo).toBeTruthy();
    expect(echo.tick).toBe(main.tick);
    expect(e.statuses.some((st) => st.id === 'slow')).toBe(true);
    // 別欄的技能沒有回響
    const n = evs(s, 'damage').filter((d) => d.skill === 'heavy_echo').length;
    step(s, [{ type: 'skill', id: 'whirlwind' }]);
    for (let i = 0; i < 40; i++) step(s);
    expect(evs(s, 'damage').some((d) => d.skill === 'whirlwind')).toBe(true);
    expect(evs(s, 'damage').filter((d) => d.skill === 'heavy_echo').length).toBe(n);
  });

  it('燼心：打倒敵人回 5% 生命', () => {
    const s = mk();
    leaveCamp(s);
    give(s, 'vital_ember');
    const p = playerOf(s);
    p.hp = Math.round(p.maxHp / 2);
    const hp0 = p.hp;
    killWolves(s, 1);
    expect(p.hp).toBe(hp0 + Math.round(p.maxHp * 0.05));
  });

  // ---- 第二批（第 163 輪，D-352） ----
  /** 一隻不會死的目標狼＋旁邊幾隻（dx 相對目標） */
  const dummy = (s: BattleState, dx: number, dy = 0): Unit => {
    const e = wolfAt(s, dx, dy, 99999);
    e.maxHp = 99999;
    return e;
  };
  const tank = (s: BattleState): Unit => {
    const p = playerOf(s);
    p.maxHp = p.hp = 1e6;
    return p;
  };

  it('召雷：每第 4 下普攻在目標處落雷，波及旁邊交戰中的敵人；事件帶實際半徑', () => {
    const s = mk();
    leaveCamp(s);
    give(s, 'storm_caller');
    const p = tank(s);
    const e = dummy(s, 110);
    const near = dummy(s, 110 + 150);
    const far = dummy(s, 110 + 600);
    p.targetId = e.id;
    let hits = 0;
    for (let i = 0; i < 600 && hits < 8; i++) {
      const from = s.events.length;
      step(s);
      const now = s.events.slice(from);
      const hit = now.some((d) => d.type === 'damage' && d.skill === 'attack' && d.src === p.id);
      if (hit) hits++;
      const bolt = now.some((d) => d.type === 'blessProc' && d.id === 'storm_caller');
      expect(bolt, `第 ${hits} 下`).toBe(hit && hits % 4 === 0);
    }
    expect(hits).toBe(8);
    const procs = evs(s, 'blessProc').filter((d) => d.id === 'storm_caller');
    expect(procs.length).toBe(2);
    expect(procs[0]!.r).toBe(EFFECTS.storm_caller!.onAttack!.every!.burst.r);
    expect(evs(s, 'damage').filter((d) => d.skill === 'storm_caller' && d.dst === e.id).length).toBe(2);
    expect(evs(s, 'damage').filter((d) => d.skill === 'storm_caller' && d.dst === near.id).length).toBe(2);
    expect(evs(s, 'damage').some((d) => d.skill === 'storm_caller' && d.dst === far.id)).toBe(false);
  });

  it('綻光：暴擊時在目標處炸開，只波及「其他」敵人；炸開的傷害不會再炸', () => {
    const s = mk();
    leaveCamp(s);
    give(s, 'crit_bloom', 'shadow_step');
    const p = tank(s);
    const e = dummy(s, 110);
    const near = dummy(s, 110 + 140);
    p.targetId = e.id;
    step(s, [{ type: 'dodge', dx: 0, dy: 1 }]);
    for (let i = 0; i < 60 && !evs(s, 'blessProc').some((d) => d.id === 'crit_bloom'); i++) {
      p.x = e.x - 110;
      p.y = e.y;
      step(s);
    }
    const procs = evs(s, 'blessProc').filter((d) => d.id === 'crit_bloom');
    expect(procs.length, '影步的必暴觸發一次綻光').toBe(1);
    expect(procs[0]).toMatchObject({ x: e.x, y: e.y, r: EFFECTS.crit_bloom!.onCrit!.burst.r });
    const bloom = evs(s, 'damage').filter((d) => d.skill === 'crit_bloom' && d.tick === procs[0]!.tick);
    // 附近被吵醒的狼也可能被波及；重點是旁邊那隻有吃到、暴擊的目標自己沒有
    expect(bloom.map((d) => d.dst)).toContain(near.id);
    expect(bloom.map((d) => d.dst)).not.toContain(e.id);
    expect(bloom.every((d) => !evs(s, 'blessProc').some((q) => q.id === 'crit_bloom' && q.tick === d.tick && q.x !== e.x))).toBe(true);
  });

  it('殘影：閃避的起點炸開（打到留在原地的敵人），而且不會吃掉影步的必暴', () => {
    const s = mk();
    leaveCamp(s);
    give(s, 'after_image', 'shadow_step');
    const p = tank(s);
    const e = dummy(s, 110);
    const ox = p.x;
    const oy = p.y;
    step(s, [{ type: 'dodge', dx: -1, dy: 0 }]);
    const proc = evs(s, 'blessProc').find((d) => d.id === 'after_image')!;
    expect(proc).toMatchObject({ x: ox, y: oy, r: EFFECTS.after_image!.onDodge!.burst!.r });
    expect(evs(s, 'damage').filter((d) => d.skill === 'after_image' && d.dst === e.id).length).toBe(1);
    expect(s.bless!.critUntil, '必暴還在').toBeGreaterThan(s.tick);
    // 沒有敵人在旁邊：照樣有殘影（事件），沒有傷害
    const s2 = mk();
    give(s2, 'after_image');
    step(s2, [{ type: 'dodge', dx: 1, dy: 0 }]);
    expect(evs(s2, 'blessProc').length).toBe(1);
    expect(evs(s2, 'damage').length).toBe(0);
  });

  it('震盾：三把武器的護盾招展開時，震傷身邊的敵人並緩速；遠的打不到', () => {
    for (const w of ['sword', 'bow', 'staff'] as W[]) {
      const s = mk(w);
      leaveCamp(s);
      give(s, 'guard_pulse');
      const p = tank(s);
      const e = dummy(s, 150);
      const far = dummy(s, 0, 700);
      p.targetId = e.id;
      const at = { x: p.x, y: p.y };
      step(s, [{ type: 'skill', id: 'parry' }]);
      expect(evs(s, 'guard').length, `${w} 護盾有展開`).toBe(1);
      const proc = evs(s, 'blessProc').find((d) => d.id === 'guard_pulse')!;
      expect(proc).toMatchObject(at);
      expect(evs(s, 'damage').some((d) => d.skill === 'guard_pulse' && d.dst === e.id), `${w} 震到身邊的`).toBe(true);
      expect(e.statuses.some((st) => st.id === 'slow')).toBe(true);
      expect(evs(s, 'damage').some((d) => d.skill === 'guard_pulse' && d.dst === far.id)).toBe(false);
    }
  });

  it('蝕毒：技能命中上中毒（多段會疊層）、之後持續掉血；普攻不會上', () => {
    const s = mk();
    leaveCamp(s);
    give(s, 'venom_skill');
    const p = tank(s);
    const e = dummy(s, 110);
    p.targetId = e.id;
    for (let i = 0; i < 45; i++) step(s);
    expect(e.statuses.some((st) => st.id === 'poison'), '普攻不會上毒').toBe(false);
    step(s, [{ type: 'skill', id: 'heavy_slash' }]);
    for (let i = 0; i < 20; i++) step(s);
    expect(e.statuses.find((st) => st.id === 'poison')?.stacks).toBe(1);
    step(s, [{ type: 'skill', id: 'whirlwind' }]);
    for (let i = 0; i < 50; i++) step(s);
    expect(e.statuses.find((st) => st.id === 'poison')!.stacks).toBeGreaterThan(1);
    expect(evs(s, 'damage').some((d) => d.origin === 'dot' && d.dst === e.id)).toBe(true);
  });

  it('斬首：對生命低於 30% 的敵人傷害 +50%（高於就沒有）；收掉敵人時有記號', () => {
    const dmg = (hpPct: number, bless: boolean): number => {
      const s = mk('sword', true, 11);
      leaveCamp(s);
      if (bless) give(s, 'executioner');
      const p = tank(s);
      const e = dummy(s, 110);
      e.hp = Math.round((e.maxHp * hpPct) / 100);
      p.targetId = e.id;
      for (let i = 0; i < 40; i++) step(s);
      const d = evs(s, 'damage').find((x) => x.skill === 'attack' && x.dst === e.id)!;
      return d.crit ? NaN : d.amount;
    };
    const base = dmg(20, false);
    expect(base).toBeGreaterThan(0);
    expect(dmg(60, true)).toBe(dmg(60, false));
    const up = dmg(20, true);
    expect(up / base).toBeGreaterThan(1.4);
    expect(up / base).toBeLessThan(1.6);
    const s = mk();
    leaveCamp(s);
    give(s, 'executioner');
    killWolves(s, 1);
    expect(evs(s, 'blessProc').filter((d) => d.id === 'executioner').length).toBe(1);
  });

  it('第二批不改沒拿到的場次：開祝福但沒選這些效果時，雜湊和事件數不受影響（普攻計數只在有召雷時才數）', () => {
    const s = mk();
    leaveCamp(s);
    give(s, 'ember_edge');
    const e = dummy(s, 110);
    playerOf(s).targetId = e.id;
    for (let i = 0; i < 120; i++) step(s);
    expect(s.bless!.hits).toBeUndefined();
    expect(evs(s, 'blessProc').length).toBe(0);
  });

  it('試招：這趟改用還沒練到的變化打法；施放到一半選的，這一招照原本的打完（RF-01）', () => {
    for (const w of ['sword', 'bow', 'staff'] as W[]) {
      const s = mk(w);
      leaveCamp(s);
      const e = wolfAt(s, w === 'sword' ? 110 : 300, 0, 99999);
      e.maxHp = 99999;
      playerOf(s).targetId = e.id;
      const plain = structuredClone(s);
      const run = (st: BattleState, mid?: () => void): string[] => {
        const t0 = st.tick;
        step(st, [{ type: 'skill', id: 'heavy_slash' }]);
        mid?.();
        for (let i = 0; i < 60 && playerOf(st).action?.kind === 'skill'; i++) step(st);
        return st.events.filter((d) => d.type === 'damage' && d.tick > t0 && d.skill === 'heavy_slash').map((d) => (d.type === 'damage' ? `${d.tick - t0}:${d.amount}` : ''));
      };
      const base = run(plain);
      expect(base.length, `${w} 原招有命中`).toBeGreaterThan(0);
      const got = run(s, () => {
        s.bless!.offer = [tryVariantId('heavy_slash', 1)];
        step(s, [{ type: 'bless', pick: 0 }]);
      });
      // 中途多跑了一個 tick（選祝福那一下），命中的相對 tick 與傷害和沒選一樣
      expect(got, `${w} 這一招照原招打完`).toEqual(base);
      step(s);
      expect(skillDef(s, 'heavy_slash')).toBe(WEAPONS[w].variants.heavy_slash);
      expect(s.skillVariants, '玩家平常選的打法沒被改').toBeUndefined();
    }
  });

  it('回營火休息或倒下：祝福清空、計量歸零、重抽補回；技能回到原本的樣子', () => {
    const s = mk();
    give(s, 'quick_hands', tryVariantId('whirlwind', 2));
    step(s);
    expect(skillDef(s, 'whirlwind')).toBe(WEAPONS.sword.variantsB.whirlwind);
    s.bless!.meter = 2;
    s.bless!.rerolls = 0;
    const fire = STAGES.mistwood!.campfires![0]!;
    playerOf(s).x = fire.x;
    playerOf(s).y = fire.y + 80;
    step(s, [{ type: 'rest' }]);
    expect(evs(s, 'rest').length).toBe(1);
    expect(s.bless).toMatchObject({ meter: 0, taken: [], rerolls: BLESS_RULES.rerolls });
    expect(s.bless!.mods).toBeUndefined();
    expect(skillDef(s, 'whirlwind')).toBe(WEAPONS.sword.skills.whirlwind);
    expect(evs(s, 'blessClear')[0]).toMatchObject({ reason: 'rest', count: 2 });
    // 倒下
    give(s, 'ember_edge');
    const p = playerOf(s);
    p.hp = 0;
    p.dead = true;
    step(s);
    expect(p.dead).toBe(false);
    expect(s.bless!.taken).toEqual([]);
    expect(evs(s, 'blessClear')[1]).toMatchObject({ reason: 'down', count: 1 });
  });

  it('可重播：同種子＋同指令（含選祝福）＝同結果；Bot 會自己選', () => {
    const run = (): BattleState => {
      const s = mk('sword', true, 11);
      const bot = new PlayerBot({ ...BOT_PROFILES.normal, ult: true, potionAtPct: 35 }, 'normal');
      for (let i = 0; i < 4500 && s.outcome === 'running'; i++) step(s, bot.decide(s));
      return s;
    };
    const a = run();
    const b = run();
    expect(stateHash(a)).toBe(stateHash(b));
    expect(evs(a, 'blessPick').length).toBeGreaterThanOrEqual(1);
    (globalThis as unknown as { process: { stdout: { write(x: string): void } } }).process.stdout.write(
      `mistwood normal Bot 150 秒：祝福 ${evs(a, 'blessPick').map((e) => `${Math.round(e.tick / 30)}s ${effectDef(e.id)?.name}`).join('、')}；擊殺 ${evs(a, 'death').length}\n`,
    );
  });
});
