import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HERO_PARTS } from '../src/game/fx/heroParts.gen';
import { bodyPose, easeAmt, footfall, footPose, HERO_WALK } from '../src/game/fx/heroWalk';

describe('主角走路的步態（第 193 輪）', () => {
  it('停著（幅度 0）兩隻腳都在站姿原位、身體不動', () => {
    for (const ph of [0, 1, 2.5, 4, 6]) {
      for (const f of [0, 1] as const) {
        const p = footPose(ph, f, 0);
        expect(Math.abs(p.dx) + p.lift + Math.abs(p.rot)).toBe(0);
      }
      expect(bodyPose(ph, 0)).toEqual({ up: 0, lean: 0 });
    }
  });
  it('兩隻腳差半圈：任何時刻至少一隻踩在地上，不會同時離地', () => {
    for (let i = 0; i < 200; i++) {
      const ph = (i / 200) * Math.PI * 4;
      const a = footPose(ph, 0, 1);
      const b = footPose(ph, 1, 1);
      expect(a.down || b.down).toBe(true);
      expect(a.lift === 0 || b.lift === 0).toBe(true);
    }
  });
  it('踩地的腳貼地往後滑、離地的腳抬起往前跨；前後不超過設定的幅度', () => {
    const stance0 = footPose(0.2, 0, 1);
    const stance1 = footPose(2.8, 0, 1);
    expect(stance0.lift).toBe(0);
    expect(stance0.dx).toBeGreaterThan(stance1.dx);
    const mid = footPose(Math.PI * 1.5, 0, 1);
    expect(mid.lift).toBeCloseTo(HERO_WALK.lift, 5);
    expect(footPose(Math.PI * 1.9, 0, 1).dx).toBeGreaterThan(footPose(Math.PI * 1.1, 0, 1).dx);
    for (let i = 0; i < 100; i++) expect(Math.abs(footPose(i * 0.13, 1, 1).dx)).toBeLessThanOrEqual(HERO_WALK.swing + 1e-9);
  });
  it('一步的頭尾接得上（不會瞬間跳位）', () => {
    for (const f of [0, 1] as const) {
      for (const edge of [Math.PI, Math.PI * 2]) {
        const a = footPose(edge - 1e-4, f, 1);
        const b = footPose(edge + 1e-4, f, 1);
        expect(Math.abs(a.dx - b.dx)).toBeLessThan(0.05);
        expect(Math.abs(a.lift - b.lift)).toBeLessThan(0.05);
      }
    }
  });
  it('起步與停下是漸進的；每半圈有一隻腳落地', () => {
    expect(easeAmt(0, true, HERO_WALK.easeMs / 2)).toBeCloseTo(0.5);
    expect(easeAmt(0.2, false, 1000)).toBe(0);
    expect(easeAmt(0.9, true, 1000)).toBe(1);
    expect(footfall(0.1, 0.2)).toBe(-1);
    expect(footfall(Math.PI - 0.1, Math.PI + 0.1)).toBe(1);
    expect(footfall(Math.PI * 2 - 0.1, Math.PI * 2 + 0.1)).toBe(0);
  });
  it('三把武器都有分件，檔案在、轉軸落在靴子外框裡', () => {
    for (const w of ['sword', 'bow', 'staff']) {
      const p = HERO_PARTS[w]!;
      expect(existsSync(`public/art/hero_${w}_body.webp`)).toBe(true);
      for (const sd of ['l', 'r'] as const) {
        const f = p.feet[sd];
        expect(existsSync(`public/art/hero_${w}_foot_${sd}.webp`)).toBe(true);
        expect(f.px).toBeGreaterThanOrEqual(f.x);
        expect(f.px).toBeLessThanOrEqual(f.x + f.w);
        expect(f.py).toBeGreaterThanOrEqual(f.y);
        expect(f.y + f.h).toBeLessThanOrEqual(p.h);
      }
      expect(p.feet.l.px).toBeLessThan(p.feet.r.px);
    }
  });
});
