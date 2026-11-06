// PvP 數值正規化（core/battle/rt/pvp.ts）的單元測試
import { describe, expect, it } from 'vitest';
import { PVP, pvpCc, pvpDamage, pvpGear, pvpIlvl, pvpMaxHp, type CcMemo } from '../src/core/battle/rt/pvp';
import { genGear, gearBonus, type RtGear } from '../src/core/battle/rt/gear';
import { sec } from '../src/core/battle/rt/types';

describe('PvP 規則', () => {
  it('HP ×3、傷害 ×0.5（至少 1）', () => {
    expect(pvpMaxHp(200)).toBe(600);
    expect(pvpDamage(31)).toBe(16);
    expect(pvpDamage(1)).toBe(1);
    expect(pvpDamage(0)).toBe(0);
  });

  it('控制：時間減半、15 秒內連續被控遞減到免疫、隔久了重置', () => {
    let m: CcMemo | undefined;
    const got: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = pvpCc(60, i * sec(2), m);
      got.push(r.ticks);
      m = r.memo;
    }
    expect(got).toEqual([30, 15, 8, 0, 0]);
    expect(pvpCc(60, 8 + PVP.ccWindowTicks + sec(2) * 4, m).ticks).toBe(30);
  });

  it('物品等級差距壓到 3 成；同等級不變', () => {
    expect(pvpIlvl(12, 2)).toBe(5);
    expect(pvpIlvl(2, 12)).toBe(9);
    expect(pvpIlvl(7, 7)).toBe(7);
  });

  it('壓縮後的裝備：高等的變弱、低等的變強，差距明顯縮小；同等級完全不變（強化除外）', () => {
    const base = 200;
    const atk = 20;
    const pow = (gs: RtGear[]) => gearBonus(gs, base, atk).atk;
    for (let seed = 1; seed <= 40; seed++) {
      const hi = genGear(seed, 3, 12, { slot: 'weapon' });
      const lo = genGear(seed + 999, 2, 2, { slot: 'weapon' });
      const ref = 7;
      const gap0 = pow([hi]) - pow([lo]);
      const gap1 = pow([pvpGear(hi, ref)]) - pow([pvpGear(lo, ref)]);
      expect(gap1).toBeLessThan(gap0 * 0.6);
      expect(pvpGear(hi, ref).name).toBe(hi.name);
      const same = genGear(seed, 2, 7);
      expect(pvpGear(same, 7)).toEqual(same);
    }
    expect(pvpGear({ ...genGear(5, 3, 9), enh: 10 }, 9).enh).toBe(5);
  });
});
