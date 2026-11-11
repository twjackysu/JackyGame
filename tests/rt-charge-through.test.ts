// 第 174 輪：衝鋒是「穿過去」，不是把人一路推著走。
// 以前：Boss 在 separate 裡推不動（heavy），衝鋒每個 tick 往前 0.47 格，站在路上的主角被整段頂著走 7 格、
// 而且還在 Boss 前面 → 下一次衝鋒同一個方向再頂 7 格 → 兩次就被推出巢穴（半徑 13 格）→ Boss 回家回滿血，
// 畫面還說「跑出巢穴的紅圈了」。站著硬打（不閃衝鋒）的玩家每 18 秒左右白打一次。
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBattle, playerOf, step } from '../src/core/battle/rt/engine';
import { ENEMIES, STAGES } from '../src/core/battle/rt/data';
import { makeMistwoodStage } from '../src/core/battle/rt/maps/mistwood';
import { UNIT } from '../src/core/battle/rt/types';
import type { BattleState, Unit } from '../src/core/battle/rt/types';

/** 霧語森林：主角站在狼王正下方貼身，站著不動，等牠出衝鋒並衝完 */
function kingCharge(): { s: BattleState; p: Unit; e: Unit; p0: { x: number; y: number }; e0: { x: number; y: number }; from: number } {
  const s = createBattle({ stageId: 'mistwood', seed: 11 });
  const p = playerOf(s);
  const e = s.units.find((u) => u.defId === 'wolf_king')!;
  s.units = [p, e];
  p.hp = p.maxHp = 1_000_000; e.hp = e.maxHp = 100_000_000;
  p.x = e.x; p.y = e.y + 130;
  let n = 0;
  while (e.action?.kind !== 'charge' && n++ < 3000) step(s, [{ type: 'stop' }]);
  expect(e.action?.kind).toBe('charge');
  const p0 = { x: p.x, y: p.y }; const e0 = { x: e.x, y: e.y }; const from = s.tick;
  // 只看位移那一段（0.5 秒）；收招期間主角會自己追上去打，那不算被推
  const move = ENEMIES.wolf_king!.attacks.find((a) => a.id === 'king_charge')!.charge!.ticks;
  for (let i = 0; i < move; i++) step(s, [{ type: 'stop' }]);
  return { s, p, e, p0, e0, from };
}

describe('敵人的衝鋒會穿過玩家', () => {
  beforeAll(() => { STAGES.mistwood = makeMistwoodStage(); });
  afterAll(() => { delete STAGES.mistwood; });

  it('狼王衝鋒：主角留在原地附近（不被頂著走整段），狼王衝到主角另一邊，而且這一下有打中', () => {
    const { s, p, e, p0, e0, from } = kingCharge();
    expect(ENEMIES.wolf_king!.attacks.find((a) => a.id === 'king_charge')!.shape.type).toBe('line');
    expect(Math.hypot(e.x - e0.x, e.y - e0.y)).toBeGreaterThan(5 * UNIT); // 狼王照樣衝完 7 格（沒有被主角擋住）
    expect(Math.hypot(p.x - p0.x, p.y - p0.y)).toBeLessThan(0.5 * UNIT); // 主角幾乎沒被推（以前 6.6 格）
    expect(e.y).toBeGreaterThan(p.y); // 狼王到了主角的另一邊
    expect(s.events.filter((x) => x.type === 'damage' && x.dst === p.id && x.tick >= from).length).toBe(1); // 命中一次、不重複
  });

  it('站著硬打兩分鐘：不會被狼王推出巢穴（Boss 不會因此回家回滿）', () => {
    const s = createBattle({ stageId: 'mistwood', seed: 11 });
    const p = playerOf(s);
    const e = s.units.find((u) => u.defId === 'wolf_king')!;
    s.units = [p, e];
    p.hp = p.maxHp = 1_000_000; e.hp = e.maxHp = 100_000_000;
    p.x = e.x; p.y = e.y + 130;
    const z = STAGES.mistwood!.bossZone!;
    for (let i = 0; i < 30 * 120; i++) {
      step(s, []); // 不下指令：普攻／技能自動，主角自己追著打
      expect(Math.hypot(p.x - z.x, p.y - z.y)).toBeLessThanOrEqual(z.r);
    }
    expect(s.events.some((x) => x.type === 'leash' && x.id === e.id)).toBe(false);
  });
});
