// D-280：src/core/fixedMath.ts 的查表和原本的 Math 版本結果一致（測試可以用 Math.sin，核心不行）。
import { describe, expect, it } from 'vitest';
import { ANGLE_STEPS, cosStep, evenStep, inSectorAngle, randStep, sinStep, xpCurve } from '../src/core/fixedMath';

describe('fixedMath', () => {
  it('sin／cos 表和 Math 版差不到 1e-15，四個象限端點精確', () => {
    for (let i = 0; i < ANGLE_STEPS; i++) {
      const a = (i / ANGLE_STEPS) * Math.PI * 2;
      expect(Math.abs(sinStep(i) - Math.sin(a))).toBeLessThan(1e-15);
      expect(Math.abs(cosStep(i) - Math.cos(a))).toBeLessThan(1e-15);
    }
    expect([cosStep(0), sinStep(180), cosStep(360), sinStep(540)]).toEqual([1, 1, -1, -1]);
    expect(sinStep(-180)).toBe(-1);
  });

  it('角度格數工具', () => {
    expect(randStep(0)).toBe(0);
    expect(randStep(0.9999999)).toBe(ANGLE_STEPS - 1);
    expect(evenStep(1, 8)).toBe(90);
    expect(evenStep(9, 8)).toBe(90);
  });

  it('扇形判定和舊公式（asin＋cos）一致（離邊界 1e-9 以上的點）', () => {
    let seed = 12345;
    const r = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
    let checked = 0;
    for (const deg of [70, 80, 90, 100, 110, 120, 130, 140, 200, 300, 359]) {
      for (let k = 0; k < 4000; k++) {
        const vx = Math.round((r() - 0.5) * 2000);
        const vy = Math.round((r() - 0.5) * 2000);
        const d = Math.sqrt(vx * vx + vy * vy);
        const pr = Math.round(r() * 300);
        if (d <= pr) continue;
        const fa = r() * Math.PI * 2;
        const fx = Math.round(Math.cos(fa) * 1000) / 1000;
        const fy = Math.round(Math.sin(fa) * 1000) / 1000;
        const cos = (vx * fx + vy * fy) / d;
        const half = (deg / 2) * (Math.PI / 180) + Math.asin(Math.min(1, pr / d));
        const lim = Math.cos(Math.min(Math.PI, half));
        if (Math.abs(cos - lim) < 1e-9) continue;
        expect(inSectorAngle(vx, vy, d, fx, fy, deg, pr), `deg=${deg} v=(${vx},${vy}) pr=${pr}`).toBe(cos >= lim);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(30000);
  });

  it('經驗曲線和 round(60·lv^1.7) 一樣', () => {
    expect(xpCurve(1)).toBe(40);
    for (let lv = 2; lv <= 100; lv++) expect(xpCurve(lv)).toBe(Math.round(60 * Math.pow(lv, 1.7)));
  });
});
