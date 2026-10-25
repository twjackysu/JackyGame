// 迷霧巡守（D-120）：霧語森林白天就在精英狼群區西側巡邏的世界精英；會「霧隱突襲」（瞬移到背後出招）。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENEMIES, STAGES } from '../src/core/battle/rt/data';
import { createBattle, step } from '../src/core/battle/rt/engine';
import { makeMistwoodStage, WARDEN_PATROL } from '../src/core/battle/rt/maps/mistwood';
import { validateStage } from '../src/core/battle/rt/maps/validate';
import { sec, u, type BattleState, type Unit } from '../src/core/battle/rt/types';

const warden = (s: BattleState): Unit | undefined => s.units.find((x) => x.defId === 'mist_warden' && !x.dead);
/** 玩家站在西邊通道口（看得到巡邏、在仇恨範圍外） */
function watch(s: BattleState): void {
  const p = s.units[0]!;
  p.x = u(12) + 50;
  p.y = u(46) + 50;
}

describe('迷霧巡守', () => {
  beforeAll(() => {
    STAGES.mistwood = makeMistwoodStage();
  });
  afterAll(() => {
    delete STAGES.mistwood;
  });

  it('白天就在、是精英、站在第一個巡邏點；霧隱突襲不是暴怒限定', () => {
    expect(validateStage(makeMistwoodStage())).toEqual([]);
    const s = createBattle({ stageId: 'mistwood', seed: 1 });
    const e = warden(s)!;
    expect(e.tier).toBe('elite');
    expect(Math.hypot(e.x - WARDEN_PATROL[0]!.x, e.y - WARDEN_PATROL[0]!.y)).toBeLessThan(u(0.5));
    const amb = ENEMIES.mist_warden!.attacks.find((a) => a.blink);
    expect(amb && !amb.furyOnly).toBe(true);
  });

  it('玩家不靠近時沿路線走完一圈、不會進戰鬥', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 1 });
    watch(s);
    const seen = new Set<number>();
    while (s.tick < sec(120)) {
      step(s, []);
      watch(s);
      const e = warden(s)!;
      expect(e.mode).not.toBe('combat');
      for (let i = 0; i < WARDEN_PATROL.length; i++) if (Math.hypot(e.x - WARDEN_PATROL[i]!.x, e.y - WARDEN_PATROL[i]!.y) <= u(0.5)) seen.add(i);
    }
    expect(seen.size).toBe(WARDEN_PATROL.length);
  });

  it('交戰中會霧隱到玩家背後出招（blink 事件）', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 3 });
    const e = warden(s)!;
    const p = s.units[0]!;
    p.x = e.x + u(2.5);
    p.y = e.y;
    let blinks = 0;
    for (let t = 0; t < sec(60) && !blinks; t++) {
      const n = s.events.length;
      p.hp = p.maxHp;
      step(s, []);
      for (let i = n; i < s.events.length; i++) if (s.events[i]!.type === 'blink' && (s.events[i] as { id: number }).id === e.id) blinks++;
    }
    expect(blinks).toBeGreaterThan(0);
  });
});
