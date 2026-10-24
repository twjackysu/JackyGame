// design/14 階段 2.1：效果觸發框架（含無限循環專用測試）
import { describe, expect, it } from 'vitest';
import {
  EffectBus, MAX_CHAIN_DEPTH, MAX_TRIGGERS_PER_EMIT, checkCondition,
  type EffectDef, type EffectHost, type EffectInstance, type TriggerContext,
} from '../src/core/battle/effects';

const ctx = (event: TriggerContext['event'], extra: Partial<TriggerContext> = {}): TriggerContext => ({ event, origin: 'natural', actionId: 1, round: 1, hero: 0, target: 0, ...extra });
const inst = (key: string, def: EffectDef, ownerHero = 0): EffectInstance => ({ key, def, ownerHero, origin: 'equipment' });

/** 簡易宿主：記錄執行過的操作；extraResonance／createMark 會產生衍生事件 */
function recorder() {
  const log: string[] = [];
  const host: EffectHost = {
    apply(op, eff, c) {
      log.push(`${eff.key}:${op.op}`);
      if (op.op === 'extraResonance') return [{ event: 'OnResonance', actionId: c.actionId, round: c.round, hero: eff.ownerHero, target: c.target }];
      if (op.op === 'createMark') return [{ event: 'OnMarkCreated', actionId: c.actionId, round: c.round, hero: eff.ownerHero, target: c.target }];
      return [];
    },
  };
  return { log, host };
}

const echo: EffectDef = { id: 'echo', trigger: 'OnResonance', ops: [{ op: 'extraResonance', scale: 0.5 }], limit: { count: 99, scope: 'action', owner: 'source' } };

describe('無限循環防護', () => {
  it('「共鳴時再共鳴一次」：衍生共鳴不會再觸發（預設 allowDerived=false）', () => {
    const { log, host } = recorder();
    const bus = new EffectBus([inst('lamp#1:echo', echo)], host);
    expect(bus.emit(ctx('OnResonance'))).toBe(1);
    expect(log).toEqual(['lamp#1:echo:extraResonance']);
  });

  it('即使 allowDerived，同一件裝備的共鳴不會觸發自己', () => {
    const { log, host } = recorder();
    const bus = new EffectBus([inst('lamp#1:echo', { ...echo, allowDerived: true })], host);
    expect(bus.emit(ctx('OnResonance'))).toBe(1);
    expect(log).toHaveLength(1);
  });

  it('兩件裝備互相觸發（都 allowDerived、上限很高）也會在安全閥內停止並記警告', () => {
    const { host } = recorder();
    const a = inst('A', { ...echo, allowDerived: true });
    const b = inst('B', { ...echo, id: 'echo2', allowDerived: true });
    const bus = new EffectBus([a, b], host);
    const n = bus.emit(ctx('OnResonance'));
    expect(n).toBeGreaterThan(2);
    expect(n).toBeLessThanOrEqual(MAX_TRIGGERS_PER_EMIT);
    expect(bus.state.warnings.length).toBeGreaterThan(0);
  });

  it('互相觸發但有 action 上限 → 依上限停止、不需要安全閥', () => {
    const { host } = recorder();
    const lim = { count: 2, scope: 'action' as const, owner: 'source' as const };
    const bus = new EffectBus([inst('A', { ...echo, allowDerived: true, limit: lim }), inst('B', { ...echo, allowDerived: true, limit: lim })], host);
    expect(bus.emit(ctx('OnResonance'))).toBe(4);
    expect(bus.state.warnings).toEqual([]);
  });

  it('跨事件循環（放燈印 → 共鳴 → 放燈印…）也受深度限制', () => {
    const { host } = recorder();
    const mark: EffectDef = { id: 'm', trigger: 'OnResonance', ops: [{ op: 'createMark', count: 1, to: 'target' }], limit: { count: 999, scope: 'battle', owner: 'team' }, allowDerived: true };
    const res: EffectDef = { id: 'r', trigger: 'OnMarkCreated', ops: [{ op: 'extraResonance', scale: 1 }], limit: { count: 999, scope: 'battle', owner: 'team' }, allowDerived: true };
    const bus = new EffectBus([inst('M', mark), inst('R', res)], host);
    const n = bus.emit(ctx('OnResonance'));
    expect(n).toBeLessThanOrEqual(MAX_CHAIN_DEPTH + 1);
    expect(bus.state.warnings.some((w) => w.includes('depth'))).toBe(true);
  });
});

describe('上限、冷卻、優先順序', () => {
  const onAtk = (id: string, extra: Partial<EffectDef> = {}): EffectDef => ({ id, trigger: 'OnAttack', ops: [{ op: 'modifyDamage', pct: 10 }], limit: { count: 1, scope: 'action', owner: 'source' }, ...extra });

  it('action 上限：多目標攻擊（同一 actionId 打 3 隻）只觸發 1 次；下個行動重置', () => {
    const { host } = recorder();
    const bus = new EffectBus([inst('X', onAtk('x'))], host);
    for (const t of [0, 1, 2]) bus.emit(ctx('OnAttack', { target: t }));
    expect(bus.state.fired.X).toBe(1);
    bus.emit(ctx('OnAttack', { actionId: 2 }));
    expect(bus.state.fired.X).toBe(2);
  });

  it('owner=target：每個目標各自計數', () => {
    const { host } = recorder();
    const bus = new EffectBus([inst('X', onAtk('x', { limit: { count: 1, scope: 'battle', owner: 'target' } }))], host);
    for (const t of [0, 1, 1, 2]) bus.emit(ctx('OnAttack', { target: t, actionId: t + 10 }));
    expect(bus.state.fired.X).toBe(3);
  });

  it('round 上限與冷卻回合', () => {
    const { host } = recorder();
    const bus = new EffectBus([inst('R', onAtk('r', { limit: { count: 2, scope: 'round', owner: 'source' } })), inst('C', onAtk('c', { limit: { count: 9, scope: 'battle', owner: 'source' }, cooldownRounds: 2 }))], host);
    for (let a = 0; a < 5; a++) bus.emit(ctx('OnAttack', { actionId: a, round: 1 }));
    expect(bus.state.fired.R).toBe(2);
    expect(bus.state.fired.C).toBe(1);
    bus.emit(ctx('OnAttack', { actionId: 9, round: 2 }));
    expect(bus.state.fired.C).toBe(1); // 冷卻中
    bus.emit(ctx('OnAttack', { actionId: 10, round: 3 }));
    expect(bus.state.fired.C).toBe(2);
    expect(bus.state.fired.R).toBe(4);
  });

  it('依 priority 結算，同優先依加入順序', () => {
    const { log, host } = recorder();
    const bus = new EffectBus([inst('late', onAtk('l', { priority: 5 })), inst('first', onAtk('f', { priority: -1 })), inst('mid', onAtk('m'))], host);
    bus.emit(ctx('OnAttack'));
    expect(log.map((x) => x.split(':')[0])).toEqual(['first', 'mid', 'late']);
  });

  it('不同事件不觸發', () => {
    const { host } = recorder();
    const bus = new EffectBus([inst('X', onAtk('x'))], host);
    expect(bus.emit(ctx('OnBlock'))).toBe(0);
  });
});

describe('條件白名單', () => {
  const c = ctx('OnAttack', { isPerfect: true, targetMarks: 3, skill: 'lantern_strike', skillTags: ['fire'], heroHpPct: 40 });
  it('eq／gte／lte、AND／OR、技能標籤', () => {
    expect(checkCondition({ field: 'isPerfect', op: 'eq', value: true }, c)).toBe(true);
    expect(checkCondition({ field: 'targetMarks', op: 'gte', value: 3 }, c)).toBe(true);
    expect(checkCondition({ field: 'targetMarks', op: 'gte', value: 4 }, c)).toBe(false);
    expect(checkCondition({ field: 'heroHpPct', op: 'lte', value: 50 }, c)).toBe(true);
    expect(checkCondition({ field: 'skillTag', op: 'eq', value: 'fire' }, c)).toBe(true);
    expect(checkCondition({ all: [{ field: 'isPerfect', op: 'eq', value: true }, { field: 'skill', op: 'eq', value: 'x' }] }, c)).toBe(false);
    expect(checkCondition({ any: [{ field: 'isPerfect', op: 'eq', value: false }, { field: 'skill', op: 'eq', value: 'lantern_strike' }] }, c)).toBe(true);
  });
  it('缺欄位一律不成立；型別不符的大小比較不成立', () => {
    expect(checkCondition({ field: 'targetBroken', op: 'eq', value: true }, c)).toBe(false);
    expect(checkCondition({ field: 'skill', op: 'gte', value: 1 }, c)).toBe(false);
  });
  it('條件會擋下觸發', () => {
    const { host } = recorder();
    const def: EffectDef = { id: 'p', trigger: 'OnAttack', when: { field: 'isPerfect', op: 'eq', value: true }, ops: [{ op: 'modifyResource', resource: 'ember', delta: 1 }], limit: { count: 9, scope: 'battle', owner: 'team' } };
    const bus = new EffectBus([inst('P', def)], host);
    bus.emit(ctx('OnAttack', { isPerfect: false }));
    bus.emit(ctx('OnAttack', { isPerfect: true, actionId: 2 }));
    expect(bus.state.fired.P).toBe(1);
  });
});

describe('可重現與可序列化', () => {
  it('狀態是純資料（JSON 往返後繼續計數結果一樣）', () => {
    const { host } = recorder();
    const def: EffectDef = { id: 'x', trigger: 'OnAttack', ops: [], limit: { count: 2, scope: 'battle', owner: 'source' } };
    const bus = new EffectBus([inst('X', def)], host);
    bus.emit(ctx('OnAttack'));
    const bus2 = new EffectBus([inst('X', def)], host, JSON.parse(JSON.stringify(bus.state)));
    bus2.emit(ctx('OnAttack', { actionId: 2 }));
    bus2.emit(ctx('OnAttack', { actionId: 3 }));
    expect(bus2.state.fired.X).toBe(2);
  });
});
