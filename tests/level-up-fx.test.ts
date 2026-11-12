import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/game/settings', () => ({ getSettings: () => ({ lowFx: false }), highFx: () => true }));

import { bossSlainFlashPeak, levelUpFlashPeak, pillarAcross, pillarAlong, pillarLayers } from '../src/game/fx/levelUp';
import { ultFlashPeak } from '../src/game/fx/feel';
import { popScale, staleTexts } from '../src/game/fx/feel';

describe('升級演出（第 186 輪）', () => {
  it('全畫面只亮一下：比大招的閃光淡，省電畫質更淡', () => {
    expect(levelUpFlashPeak(false)).toBeLessThanOrEqual(ultFlashPeak(false) / 2);
    expect(levelUpFlashPeak(true)).toBeLessThan(levelUpFlashPeak(false));
    // 打倒 Boss 比升級亮、仍比大招淡
    expect(bossSlainFlashPeak(false)).toBeGreaterThan(levelUpFlashPeak(false));
    expect(bossSlainFlashPeak(false)).toBeLessThan(ultFlashPeak(false));
    expect(bossSlainFlashPeak(true)).toBeLessThan(bossSlainFlashPeak(false));
  });
  it('光柱沒有硬邊：中線最亮、邊緣是 0、腳下最亮、柱頂是 0', () => {
    expect(pillarAcross(0)).toBe(1);
    expect(pillarAcross(1)).toBe(0);
    expect(pillarAcross(-1)).toBe(0);
    expect(pillarAcross(0.5)).toBeGreaterThan(pillarAcross(0.9));
    expect(pillarAlong(0)).toBe(1);
    expect(pillarAlong(1)).toBe(0);
    for (let v = 0; v < 1; v += 0.1) expect(pillarAlong(v)).toBeGreaterThan(pillarAlong(v + 0.1));
  });
  it('光柱由外到內越來越細、越來越亮；省電畫質少一層外暈', () => {
    const l = pillarLayers(1, false);
    expect(l).toHaveLength(3);
    for (let i = 1; i < l.length; i++) { expect(l[i]!.w).toBeLessThan(l[i - 1]!.w); expect(l[i]!.alpha).toBeGreaterThan(l[i - 1]!.alpha); }
    expect(pillarLayers(1, true)).toHaveLength(2);
    // 鏡頭拉很近／很遠時不會大到蓋住畫面或小到看不見
    expect(pillarLayers(5, false)[0]!.w).toBeLessThanOrEqual(320 * 1.4);
    expect(pillarLayers(0.1, false)[1]!.h).toBeGreaterThanOrEqual(680 * 0.7);
  });
});

describe('大字彈出的起始倍率（第 186 輪）', () => {
  it('短字照舊 2.2 倍；長句子不超出畫面', () => {
    expect(popScale(200, 720)).toBe(2.2);
    const w = 620;
    expect(w * popScale(w, 720)).toBeLessThanOrEqual(720);
    expect(popScale(900, 720)).toBe(1.12);
  });
});

describe('倒下醒來時收掉舊的戰場文字（第 186 輪）', () => {
  it('只收這一幀之前跳出來的；同一幀的（祝福消散的通知）留著', () => {
    const born: Array<[string, number]> = [['傷害 28', 900], ['劍刃風暴！', 400], ['燼火祝福消散了', 1000]];
    expect(staleTexts(born, 1000)).toEqual(['傷害 28', '劍刃風暴！']);
    expect(staleTexts([], 1000)).toEqual([]);
  });
});
