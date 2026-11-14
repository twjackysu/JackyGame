// 第 202 輪：進地圖的開場說明放到主角下方那條字幕帶（不貼在主角腳邊）
import { describe, expect, it } from 'vitest';
import { introY } from '../src/game/fx/introLane';

describe('開場說明的位置', () => {
  it('兩行以內就放在字幕帶上', () => {
    expect(introY(968, 1)).toBe(968);
    expect(introY(968, 2)).toBe(968);
  });
  it('三行、四行往上挪一點（下緣不壓到底部技能列），但仍比舊位置 760 低', () => {
    expect(introY(968, 3)).toBe(954);
    expect(introY(968, 4)).toBe(940);
    expect(introY(968, 4)).toBeGreaterThan(760);
  });
});
