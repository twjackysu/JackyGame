import { describe, expect, it } from 'vitest';
import { HURT_LANE, hurtNumberPos } from '../src/game/fx/hurtLane';

describe('主角被打的紅字位置（第 201 輪，D-403）', () => {
  it('往打過來的反方向那一側跳', () => {
    expect(hurtNumberPos(200, 400, 30).x).toBeLessThan(200);
    expect(hurtNumberPos(200, 400, -30).x).toBeGreaterThan(200);
  });
  it('沒有來源（持續傷害）固定走左邊', () => {
    expect(hurtNumberPos(200, 400, 0).x).toBe(200 - HURT_LANE.side);
  });
  it('離中線夠遠：加上 floatNumber 的 ±18 抖動和兩位數的半寬，也不壓到主角的臉（半寬約 14）', () => {
    const halfText = (2 * 26 * 0.62) / 2;
    expect(HURT_LANE.side - 18 - halfText).toBeGreaterThanOrEqual(14);
  });
});
