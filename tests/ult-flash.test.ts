import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { BlendModes: { ADD: 1 }, Math: { Between: () => 0 } } }));
vi.mock('../src/game/settings', () => ({ getSettings: () => ({ lowFx: false }), highFx: () => true }));

import { ultFlashLayers, ultFlashPeak } from '../src/game/fx/feel';

// 大招的全畫面閃光（第 177 輪，D-372）：以前 camera.flash 第一幀整個畫面連 HUD、Boss 的紅圈全白。
// 大招是自動施放，所以這是玩家沒按鍵也會來的全白；改成壓在 HUD 下面、峰值四成的加亮。這裡擋的是「有人又寫回 camera.flash」。
const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('大招閃光不蓋掉畫面', () => {
  it('遠程大招的特效不再用 camera.flash', () => {
    expect(read('../src/game/fx/rangedFx.ts')).not.toMatch(/cameras\.main\.flash\(/);
  });

  it('大招出手那一下用 ultFlash', () => {
    const src = read('../src/game/scenes/RtBattleScene.ts');
    const i = src.indexOf("if (skillDef(this.s, e.skill)?.role === 'ult') {");
    expect(i).toBeGreaterThan(0);
    const block = src.slice(i, i + 700);
    expect(block).toMatch(/ultFlash\(/);
    expect(block).not.toMatch(/cameras\.main\.flash\(/);
  });

  it('峰值不超過五成、省電模式更淡，而且畫在 HUD 下面', () => {
    const src = read('../src/game/fx/feel.ts');
    const m = /ultFlashPeak\(lowFx: boolean\): number \{\s*return lowFx \? ([\d.]+) : ([\d.]+);/.exec(src);
    expect(m).not.toBeNull();
    const low = Number(m?.[1]);
    const high = Number(m?.[2]);
    expect(high).toBeLessThanOrEqual(0.5);
    expect(low).toBeLessThan(high);
    const f = src.slice(src.indexOf('export function ultFlash('));
    expect(/setDepth\((\d+)\)/.exec(f)?.[1]).toBe('47'); // HUD 與按鍵在 50 以上
  });

  it('第 196 輪：光從出招的地方散開——全畫面那一層只是薄薄的底光，中心加起來不超過五成', () => {
    for (const low of [false, true]) {
      const peak = ultFlashPeak(low);
      const L = ultFlashLayers(peak);
      expect(L.flat).toBeLessThanOrEqual(peak * 0.3); // 畫面角落只剩以前的三成以下
      expect(L.glow).toBeGreaterThan(L.flat * 2);
      expect(L.flat + L.glow).toBeLessThanOrEqual(0.5 + 1e-9); // 中心再亮也看得到紅圈
      expect(L.sizeK).toBeLessThanOrEqual(1.2); // 柔光不能大到又變成整個畫面一樣亮
    }
  });
});
