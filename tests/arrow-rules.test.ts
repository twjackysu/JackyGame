import { describe, expect, it } from 'vitest';
import { ELITE_ARROW_M, showOffscreenArrow } from '../src/game/arrowRules';

describe('畫面外箭頭（D-176）', () => {
  const base = { mini: true, elite: true, boss: false, combat: false, distM: 10 };
  it('Boss 與追過來的怪一律畫', () => {
    expect(showOffscreenArrow({ ...base, boss: true, distM: 90 })).toBe(true);
    expect(showOffscreenArrow({ ...base, elite: false, combat: true, distM: 90 })).toBe(true);
  });
  it('待機精英只在附近才畫、待機一般怪不畫', () => {
    expect(showOffscreenArrow({ ...base, distM: ELITE_ARROW_M })).toBe(true);
    expect(showOffscreenArrow({ ...base, distM: ELITE_ARROW_M + 1 })).toBe(false);
    expect(showOffscreenArrow({ ...base, elite: false })).toBe(false);
  });
  it('沒有小地圖的小關卡照舊全部畫', () => {
    expect(showOffscreenArrow({ ...base, mini: false, elite: false, distM: 99 })).toBe(true);
  });
});
