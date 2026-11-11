// 第 167 輪：敵人招式落下那一刻的演出照形狀分（純畫面資料）。
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/core/battle/rt/data';
import { enemyImpact } from '../src/game/fx/hitTint';

const kindOf = (enemy: string, attack: string) => {
  const a = ENEMIES[enemy]!.attacks.find((q) => q.id === attack)!;
  return enemyImpact(a.shape, !!a.charge);
};

describe('敵人招式落下的演出', () => {
  it('霧角狼王：爪擊＝爪痕、撕咬＝咬合、震波＝環形震波、衝鋒沒有（衝鋒有自己的殘影）', () => {
    expect(kindOf('wolf_king', 'king_claw')).toBe('claw');
    expect(kindOf('wolf_king', 'king_bite')).toBe('bite');
    expect(kindOf('wolf_king', 'king_mist_rend')).toBe('bite');
    expect(kindOf('wolf_king', 'king_quake')).toBe('quake');
    expect(kindOf('wolf_king', 'king_charge')).toBeUndefined();
  });

  it('有自己演出的招（地面荊棘、熔岩、墜星）不重複畫', () => {
    expect(enemyImpact({ type: 'circle', r: 200 }, true)).toBeUndefined();
  });

  it('每一隻怪的扇形／環形／圓形招都分得到一種；直線招沒有', () => {
    for (const e of Object.values(ENEMIES)) for (const a of e.attacks) {
      const k = enemyImpact(a.shape, false);
      if (a.shape.type === 'line') expect(k, `${e.id}.${a.id}`).toBeUndefined();
      else expect(k, `${e.id}.${a.id}`).toBeDefined();
    }
  });
});
