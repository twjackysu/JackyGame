import { describe, expect, it } from 'vitest';
import { breakAtPunct } from '../src/game/ui/tipText';

describe('燼牌招呼語換行（D-202）', () => {
  it('在靠中間的標點後面換行，不拆開——與……', () => {
    expect(breakAtPunct('莫托：「婆婆的藥膏？我這裡也有賣——她說要送你的那罐不算。」')).toBe('莫托：「婆婆的藥膏？我這裡也有賣——\n她說要送你的那罐不算。」');
    expect(breakAtPunct('葛倫：「朝聖的人說，他用燼石換了一口水。這裂谷真是越來越貴了。」')).toBe('葛倫：「朝聖的人說，他用燼石換了一口水。\n這裂谷真是越來越貴了。」');
    expect(breakAtPunct('沒有標點的一句話')).toBe('沒有標點的一句話');
  });
});
