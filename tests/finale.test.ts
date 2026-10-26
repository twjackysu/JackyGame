// 通關演出（D-133）：旅程統計從三張地圖的紀錄算出來、文字不會太長擠爆畫面。
import { describe, expect, it } from 'vitest';
import { FINALE_CREDITS, FINALE_LINES, PROLOGUE_LINES, finaleStats, fmtPlay } from '../src/game/finaleStats';
import { WORLD_MAPS } from '../src/game/worldMaps';

describe('通關演出', () => {
  it('統計：共用欄位看第一張圖、Boss／寶箱每張圖各自算', () => {
    const st = finaleStats({
      mistwood: { level: 12, playSec: 4000, kills: 900, chests: ['a', 'b'], bossKills: 5, firstAt: 1, bestBossSec: 200 },
      thornvale: { bossKills: 2, chests: ['c'] },
      emberrift: { bossKills: 1, bestBossSec: 300 },
    }, 7);
    expect(st.level).toBe(12);
    expect(st.kills).toBe(900);
    expect(st.chests).toBe(3);
    expect(st.cardsWon).toBe(7);
    expect(st.bosses.map((b) => b.kills)).toEqual([5, 2, 1]);
    expect(st.bosses.map((b) => b.name)).toEqual(WORLD_MAPS.filter((m) => !m.postGame).map((m) => m.boss));
    expect(st.bosses[2]!.best).toBe(300);
  });
  it('空紀錄不會壞', () => {
    const st = finaleStats({});
    expect(st.level).toBe(1);
    expect(st.chests).toBe(0);
  });
  it('遊玩時間格式', () => {
    expect(fmtPlay(42 * 60 + 5)).toBe('42 分');
    expect(fmtPlay(3 * 3600 + 5 * 60)).toBe('3 小時 05 分');
  });
  it('每行序章／結語不超過 20 字（直式畫面一行放得下）', () => {
    for (const ln of [...FINALE_LINES, ...PROLOGUE_LINES]) for (const part of ln.split('\n')) expect(part.length).toBeLessThanOrEqual(20);
    expect(FINALE_CREDITS.length).toBeGreaterThan(2);
  });
});
