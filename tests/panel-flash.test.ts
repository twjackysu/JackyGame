import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { BlendModes: { ADD: 1 }, Math: { Between: () => 0 } } }));
vi.mock('../src/game/settings', () => ({ getSettings: () => ({ lowFx: false }), highFx: () => true }));

import { panelFlashPeak, ultFlashPeak } from '../src/game/fx/feel';

const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('面板上的成功閃光（第 188 輪）', () => {
  it('比大招的閃光淡一半以上、省電畫質更淡：卡片上的字一直看得到', () => {
    expect(panelFlashPeak(false)).toBeLessThanOrEqual(ultFlashPeak(false) / 2);
    expect(panelFlashPeak(true)).toBeLessThan(panelFlashPeak(false));
  });
  it('行囊、行商、拍賣所不再用 camera.flash 把整個面板洗掉', () => {
    for (const f of ['rtBagPanel', 'rtShopPanel', 'marketPanel']) {
      const src = read(`../src/game/ui/${f}.ts`);
      expect(src.includes('cameras.main.flash('), f).toBe(false);
      expect(src.includes('panelFlash('), f).toBe(true);
    }
  });
});
