import { describe, expect, it } from 'vitest';
import { cdText, hudClock, hudLine } from '../src/game/hudText';
import { TICKS_PER_SEC } from '../src/core/battle/rt/types';

describe('按鈕冷卻秒數（第 83 輪）', () => {
  it('3 秒以上整數（無條件進位），最後 3 秒小數一位', () => {
    expect(cdText(TICKS_PER_SEC * 8)).toBe('8');
    expect(cdText(TICKS_PER_SEC * 7.2)).toBe('8');
    expect(cdText(TICKS_PER_SEC * 3)).toBe('3');
    expect(cdText(TICKS_PER_SEC * 2.9)).toBe('2.9');
    expect(cdText(1)).toBe('0.0');
  });
  it('每秒換字次數：10 秒冷卻從 100 次降到 ≤ 40 次', () => {
    const seen = new Set<string>();
    for (let t = TICKS_PER_SEC * 10; t > 0; t--) seen.add(cdText(t));
    expect(seen.size).toBeLessThanOrEqual(40);
  });
});

describe('頂端 HUD 一行（Q5 拆出 hudLine，第 148 輪；字跟搬家前一樣）', () => {
  it('時間：一分鐘內「12.3 秒」、之後「3:05」', () => {
    expect(hudClock(TICKS_PER_SEC * 12.3)).toBe('12.3 秒');
    expect(hudClock(TICKS_PER_SEC * 185)).toBe('3:05');
  });
  it('大地圖：等級、強化、金幣、粉塵；沒強化不寫；沒有掉落的關卡寫敵人數', () => {
    expect(hudLine({ lv: 7, hp: 300, maxHp: 620, mp: 12, loot: { enh: 3, coin: 120, dust: 8 }, enemies: 5, tick: TICKS_PER_SEC * 65 })).toBe('Lv 7　HP 300/620　MP 12　武器 +3　金 120　粉塵 8　1:05');
    expect(hudLine({ lv: 1, hp: 620, maxHp: 620, mp: 0, loot: { enh: 0, coin: 0, dust: 0 }, enemies: 9, tick: TICKS_PER_SEC })).toBe('Lv 1　HP 620/620　MP 0　金 0　粉塵 0　1.0 秒');
    expect(hudLine({ hp: 50, maxHp: 100, mp: 3, enemies: 4, tick: 0 })).toBe('HP 50/100　MP 3　敵人 4　0.0 秒');
  });
});
